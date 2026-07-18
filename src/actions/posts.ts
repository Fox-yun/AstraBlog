"use server";

import { dbQuery, withTransaction } from "@/db";
import { posts, postVersions, postTags } from "@/db/schema/posts";
import { media, mediaReferences } from "@/db/schema/media";
import { auditLogs } from "@/db/schema/audit";
import { requireRole } from "@/lib/authorization";
import { markdownToHtml } from "@/lib/markdown";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { isReservedPageSlug } from "@/config/site";
import { normalizeSlug } from "@/lib/content-utils";

interface CreatePostInput {
  type: "note" | "chat" | "page";
  title?: string;
  slug?: string;
  description?: string;
  contentMarkdown: string;
  categoryId?: string;
  coverMediaId?: string;
}

export async function createPost(input: CreatePostInput) {
  // 1. Authorize admin/owner
  const { user } = await requireRole("admin", "owner");
  const userId = user.id;

  // 2. Validate input fields
  const contentMarkdown = input.contentMarkdown || "";
  const contentHtml = await markdownToHtml(contentMarkdown);

  // Generate title and slug for chat posts if empty
  let title = input.title?.trim() || "";
  let slug = input.slug?.trim() || "";

  if (input.type === "chat") {
    if (!title) {
      title = contentMarkdown.slice(0, 50).trim() || "Untitled Chat";
    }
    if (!slug) {
      slug = `chat-${Date.now()}`;
    }
  } else {
    if (!title) throw new Error("Title is required for notes and pages.");
    if (!slug) throw new Error("Slug is required for notes and pages.");
  }

  slug = normalizeSlug(slug);
  if (!slug) throw new Error("Slug must contain at least one letter or number.");
  if (input.type === "page" && isReservedPageSlug(slug)) {
    throw new Error(`Slug "${slug}" is reserved by the application.`);
  }

  const newPost = await withTransaction(async (tx) => {
    // Check slug uniqueness
    const existing = await tx.query.posts.findFirst({
      where: eq(posts.slug, slug),
    });
    if (existing) {
      throw new Error(`Slug "${slug}" already exists.`);
    }

    // 3. Insert Post
    const [inserted] = await tx
      .insert(posts)
      .values({
        type: input.type,
        title,
        slug,
        description: input.description || null,
        contentMarkdown,
        contentHtml,
        searchText: [title, input.description, contentMarkdown].filter(Boolean).join("\n"),
        status: "draft", // Starts as draft
        categoryId: input.categoryId || null,
        coverMediaId: input.coverMediaId || null,
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        revision: 1,
      })
      .returning();

    // Create initial post version (version 1)
    await tx.insert(postVersions).values({
      postId: inserted.id,
      versionNumber: 1,
      title: inserted.title,
      description: inserted.description,
      contentMarkdown: inserted.contentMarkdown,
      createdBy: userId,
      createdAt: new Date(),
    });

    // Write cover coverMediaId and parsed inline mediaReferences
    const newRefs = [];
    if (inserted.coverMediaId) {
      newRefs.push({
        mediaId: inserted.coverMediaId,
        resourceType: "post",
        resourceId: inserted.id,
        referenceType: "cover",
      });
    }

    const uuids = Array.from(inserted.contentMarkdown.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)).map((m: any) => m[0]);
    if (uuids.length > 0) {
      const matchingMedia = await tx.query.media.findMany({
        where: inArray(media.id, uuids),
      });
      for (const m of matchingMedia) {
        newRefs.push({
          mediaId: m.id,
          resourceType: "post",
          resourceId: inserted.id,
          referenceType: "inline",
        });
      }
    }

    if (newRefs.length > 0) {
      await tx.insert(mediaReferences).values(newRefs);
    }

    // Write audit log
    await tx.insert(auditLogs).values({
      actorId: userId,
      action: "post_create",
      resourceType: "post",
      resourceId: inserted.id,
      metadata: {
        type: inserted.type,
        slug: inserted.slug,
      },
    });

    return inserted;
  });

  return { success: true, post: newPost };
}

interface UpdatePostInput {
  title?: string;
  slug?: string;
  description?: string;
  contentMarkdown: string;
  categoryId?: string;
  coverMediaId?: string;
  status?: "draft" | "scheduled" | "published" | "archived";
  allowComments?: boolean;
  isFeatured?: boolean;
  isPinned?: boolean;
  scheduledAt?: string;
  clientRevision: number; // Optimistic concurrency check
  isManualSave?: boolean;
  tagIds?: string[]; // Array of tag IDs to sync
}

export async function updatePost(postId: string, input: UpdatePostInput) {
  // 1. Authorize
  const { user } = await requireRole("admin", "owner");
  const userId = user.id;

  const contentHtml = await markdownToHtml(input.contentMarkdown);

  const res = await withTransaction(async (tx) => {
    // 2. Fetch current post
    const currentPost = await tx.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!currentPost) {
      throw new Error("Post not found.");
    }

    // 3. Optimistic Concurrency Control
    if (currentPost.revision !== input.clientRevision) {
      return { success: false, errorCode: "EDIT_CONFLICT" };
    }

    // 4. Resolve slug/title validations
    let title = input.title?.trim() ?? currentPost.title;
    let slug = input.slug?.trim() ?? currentPost.slug;

    if (currentPost.type === "chat" && !title) {
      title = input.contentMarkdown.slice(0, 50).trim() || "Untitled Chat";
    }

    if (currentPost.type !== "chat" && !title) {
      throw new Error("Title is required for notes and pages.");
    }

    if (slug !== currentPost.slug) {
      slug = normalizeSlug(slug);
      if (!slug) throw new Error("Slug must contain at least one letter or number.");
      const existing = await tx.query.posts.findFirst({
        where: eq(posts.slug, slug),
      });
      if (existing) {
        throw new Error(`Slug "${slug}" is already in use.`);
      }
    }

    if (currentPost.type === "page" && isReservedPageSlug(slug)) {
      throw new Error(`Slug "${slug}" is reserved by the application.`);
    }

    // Status transitions
    let publishedAt = currentPost.publishedAt;
    let scheduledAt = currentPost.scheduledAt;

    if (input.status === "published" && currentPost.status !== "published") {
      publishedAt = new Date();
    }
    if (input.status === "scheduled") {
      if (!input.scheduledAt) {
        throw new Error("A scheduled post requires a release date.");
      }
      scheduledAt = new Date(input.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new Error("Scheduled release date is invalid.");
      }
    } else if (input.status) {
      scheduledAt = null;
    }

    // 5. Update Post incrementing revision code
    const [updatedPost] = await tx
      .update(posts)
      .set({
        title,
        slug,
        description: input.description ?? null,
        contentMarkdown: input.contentMarkdown,
        contentHtml,
        searchText: [title, input.description, input.contentMarkdown]
          .filter(Boolean)
          .join("\n"),
        status: input.status ?? currentPost.status,
        categoryId: input.categoryId ?? null,
        coverMediaId: input.coverMediaId ?? null,
        allowComments: input.allowComments ?? currentPost.allowComments,
        isFeatured: input.isFeatured ?? currentPost.isFeatured,
        isPinned: input.isPinned ?? currentPost.isPinned,
        publishedAt,
        scheduledAt,
        revision: currentPost.revision + 1,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, postId), eq(posts.revision, input.clientRevision)))
      .returning();

    if (!updatedPost) {
      return { success: false, errorCode: "EDIT_CONFLICT" };
    }

    // 6. Manage Tag associations
    if (input.tagIds) {
      await tx.delete(postTags).where(eq(postTags.postId, postId));
      if (input.tagIds.length > 0) {
        await tx.insert(postTags).values(
          input.tagIds.map((tagId) => ({
            postId,
            tagId,
          }))
        );
      }
    }

    // 7. Post Versioning Control
    const lastVersion = await tx.query.postVersions.findFirst({
      where: eq(postVersions.postId, postId),
      orderBy: [desc(postVersions.versionNumber)],
    });

    const hasContentChanged = !lastVersion || lastVersion.contentMarkdown !== updatedPost.contentMarkdown;
    const isStatusChange = input.status && input.status !== currentPost.status;
    const shouldCreateVersion = (input.isManualSave || isStatusChange || !lastVersion) && hasContentChanged;

    if (shouldCreateVersion) {
      const nextVersionNum = (lastVersion?.versionNumber || 0) + 1;
      await tx.insert(postVersions).values({
        postId: updatedPost.id,
        versionNumber: nextVersionNum,
        title: updatedPost.title,
        description: updatedPost.description,
        contentMarkdown: updatedPost.contentMarkdown,
        createdBy: userId,
        createdAt: new Date(),
      });
    }

    // 8. Update media references
    await tx.delete(mediaReferences).where(
      and(
        eq(mediaReferences.resourceType, "post"),
        eq(mediaReferences.resourceId, postId)
      )
    );

    const newRefs = [];
    if (updatedPost.coverMediaId) {
      newRefs.push({
        mediaId: updatedPost.coverMediaId,
        resourceType: "post",
        resourceId: postId,
        referenceType: "cover",
      });
    }

    const uuids = Array.from(updatedPost.contentMarkdown.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)).map((m: any) => m[0]);
    if (uuids.length > 0) {
      const matchingMedia = await tx.query.media.findMany({
        where: inArray(media.id, uuids),
      });
      for (const m of matchingMedia) {
        newRefs.push({
          mediaId: m.id,
          resourceType: "post",
          resourceId: postId,
          referenceType: "inline",
        });
      }
    }

    if (newRefs.length > 0) {
      await tx.insert(mediaReferences).values(newRefs);
    }

    // Write audit log
    await tx.insert(auditLogs).values({
      actorId: userId,
      action: "post_update",
      resourceType: "post",
      resourceId: updatedPost.id,
      metadata: {
        type: updatedPost.type,
        slug: updatedPost.slug,
        status: updatedPost.status,
      },
    });

    return { success: true, post: updatedPost };
  });

  // 9. Revalidate Cache Tags outside of transaction execution
  if (res.success && res.post) {
    try {
      revalidateTag(`post:${postId}`, "max");
      revalidateTag(`post-slug:${res.post.slug}`, "max");
      revalidateTag("posts", "max");
      if (res.post.type === "note") {
        revalidateTag("notes", "max");
      } else if (res.post.type === "chat") {
        revalidateTag("chat", "max");
      } else if (res.post.type === "page") {
        revalidateTag("pages", "max");
      }
    } catch (err) {
      console.error("Cache revalidation failed:", err);
    }
  }

  return res;
}

export async function deletePost(postId: string) {
  const { user } = await requireRole("admin", "owner");
  const userId = user.id;

  const currentPost = await dbQuery.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!currentPost) {
    throw new Error("Post not found.");
  }

  await withTransaction(async (tx) => {
    // Delete the post
    await tx.delete(posts).where(eq(posts.id, postId));

    // Write audit log
    await tx.insert(auditLogs).values({
      actorId: userId,
      action: "post_delete",
      resourceType: "post",
      resourceId: postId,
      metadata: {
        type: currentPost.type,
        slug: currentPost.slug,
      },
    });
  });

  // Revalidate Cache outside of transaction execution
  try {
    revalidateTag("posts", "max");
    if (currentPost.type === "note") {
      revalidateTag("notes", "max");
    } else if (currentPost.type === "chat") {
      revalidateTag("chat", "max");
    } else if (currentPost.type === "page") {
      revalidateTag("pages", "max");
    }
  } catch (err) {
    console.error("Cache revalidation failed:", err);
  }

  return { success: true };
}

export async function renderMarkdown(markdownContent: string) {
  await requireRole("admin", "owner");
  return await markdownToHtml(markdownContent);
}

export async function getPostRevision(postId: string) {
  await requireRole("admin", "owner");
  const postRecord = await dbQuery.query.posts.findFirst({
    where: eq(posts.id, postId),
    columns: {
      revision: true,
    },
  });
  return postRecord?.revision || 0;
}

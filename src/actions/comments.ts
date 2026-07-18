"use server";

import { dbQuery, withTransaction } from "@/db";
import { comments, commentReports } from "@/db/schema/comments";
import { posts } from "@/db/schema/posts";
import { notifications } from "@/db/schema/notifications";
import { requireActiveUser, requireRole } from "@/lib/authorization";
import { auditLogs } from "@/db/schema/audit";
import { markdownToHtml } from "@/lib/markdown";
import { and, eq, gte, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

interface SubmitCommentInput {
  postId?: string;
  isGuestbook?: boolean;
  contentMarkdown: string;
  parentId?: string;
}

export async function submitComment(input: SubmitCommentInput) {
  // 1. Authorize active, verified user
  const { user } = await requireActiveUser();
  const userId = user.id;

  // 2. Validate input
  const content = input.contentMarkdown?.trim();
  if (!content || content.length < 2 || content.length > 1000) {
    throw new Error("Comment must be between 2 and 1000 characters.");
  }

  if (!input.postId && !input.isGuestbook) {
    throw new Error("Target is required (postId or isGuestbook).");
  }

  // 3. Compile markdown to sanitized HTML
  const contentHtml = await markdownToHtml(content);

  // Determine status (direct display for approved/verified accounts, else review)
  let status: "visible" | "pending" = "visible";
  const linkCount = (content.match(/https?:\/\//gi) || []).length;
  if (linkCount > 2) {
    status = "pending"; // Moderate comments with more than 2 links
  }

  const res = await withTransaction(async (tx) => {
    // 4. Enforce Rate Limiting (queries inside transaction for isolation)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [minCount] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(and(eq(comments.authorId, userId), gte(comments.createdAt, oneMinuteAgo)));

    if (Number(minCount?.count || 0) >= 2) {
      throw new Error("Rate limit exceeded: Max 2 comments per minute.");
    }

    const [hourCount] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(and(eq(comments.authorId, userId), gte(comments.createdAt, oneHourAgo)));

    if (Number(hourCount?.count || 0) >= 10) {
      throw new Error("Rate limit exceeded: Max 10 comments per hour.");
    }

    const [dayCount] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(and(eq(comments.authorId, userId), gte(comments.createdAt, oneDayAgo)));

    if (Number(dayCount?.count || 0) >= 50) {
      throw new Error("Rate limit exceeded: Max 50 comments per day.");
    }

    // 5. Resolve parent/child depth logic (0 for root, 1 for nested replies)
    let resolvedParentId: string | null = null;
    let resolvedRootId: string | null = null;
    let resolvedDepth = 0;

    if (input.parentId) {
      const parentComment = await tx.query.comments.findFirst({
        where: eq(comments.id, input.parentId),
      });

      if (!parentComment) {
        throw new Error("Parent comment not found.");
      }

      resolvedParentId = parentComment.id;
      resolvedRootId = parentComment.rootId || parentComment.id;
      resolvedDepth = 1;
    }

    // 6. Insert comment
    const [newComment] = await tx
      .insert(comments)
      .values({
        postId: input.postId || null,
        isGuestbook: input.isGuestbook || false,
        authorId: userId,
        parentId: resolvedParentId,
        rootId: resolvedRootId,
        depth: resolvedDepth,
        contentMarkdown: content,
        contentHtml: contentHtml,
        status: status,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 7. Write Notifications
    if (status === "visible") {
      if (resolvedParentId) {
        // Find parent comment author
        const parentComment = await tx.query.comments.findFirst({
          where: eq(comments.id, resolvedParentId),
        });
        if (parentComment && parentComment.authorId !== userId) {
          await tx.insert(notifications).values({
            userId: parentComment.authorId,
            type: "comment_reply",
            actorId: userId,
            commentId: newComment.id,
            postId: input.postId || null,
          });
        }
      } else if (input.postId) {
        // Find post author
        const postRecord = await tx.query.posts.findFirst({
          where: eq(posts.id, input.postId),
        });
        if (postRecord && postRecord.createdBy !== userId) {
          await tx.insert(notifications).values({
            userId: postRecord.createdBy,
            type: "post_comment",
            actorId: userId,
            commentId: newComment.id,
            postId: input.postId,
          });
        }
      }
    }

    return newComment;
  });

  // 8. Revalidate tags outside of transaction
  try {
    if (input.postId) {
      revalidateTag(`comments:${input.postId}`, "max");
    } else if (input.isGuestbook) {
      revalidateTag("guestbook", "max");
    }
  } catch (err) {
    console.error("Cache revalidation failed:", err);
  }

  return { success: true, comment: res };
}

export async function deleteComment(commentId: string) {
  const { user } = await requireActiveUser();
  const userId = user.id;

  const targetComment = await dbQuery.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });

  if (!targetComment) {
    throw new Error("Comment not found.");
  }

  // Author of comment, or admin/owner can delete
  if (targetComment.authorId !== userId && user.role !== "admin" && user.role !== "owner") {
    throw new Error("Forbidden: You cannot delete this comment.");
  }

  await withTransaction(async (tx) => {
    // Check if the comment has replies to dictate hard/soft deletion
    const hasReplies = await tx.query.comments.findFirst({
      where: eq(comments.parentId, commentId),
    });

    if (hasReplies) {
      // Exist replies: clear public content and set status to deleted to retain structure
      await tx
        .update(comments)
        .set({
          status: "deleted",
          contentMarkdown: "This comment was deleted.",
          contentHtml: "<p><em>This comment was deleted.</em></p>",
          updatedAt: new Date(),
        })
        .where(eq(comments.id, commentId));
    } else {
      // No replies: hard-delete comment
      await tx.delete(comments).where(eq(comments.id, commentId));
    }
  });

  try {
    if (targetComment.postId) {
      revalidateTag(`comments:${targetComment.postId}`, "max");
    } else if (targetComment.isGuestbook) {
      revalidateTag("guestbook", "max");
    }
  } catch (err) {
    console.error("Cache revalidation failed:", err);
  }

  return { success: true };
}

export async function moderateComment(
  commentId: string,
  newStatus: "pending" | "visible" | "hidden" | "deleted" | "spam"
) {
  const { user } = await requireRole("admin", "owner");
  const userId = user.id;

  const targetComment = await dbQuery.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });

  if (!targetComment) {
    throw new Error("Comment not found.");
  }

  await withTransaction(async (tx) => {
    if (newStatus === "deleted") {
      // Enforce the same deletion cascade checks
      const hasReplies = await tx.query.comments.findFirst({
        where: eq(comments.parentId, commentId),
      });
      if (hasReplies) {
        await tx
          .update(comments)
          .set({
            status: "deleted",
            contentMarkdown: "This comment was deleted.",
            contentHtml: "<p><em>This comment was deleted.</em></p>",
            updatedAt: new Date(),
          })
          .where(eq(comments.id, commentId));
      } else {
        await tx.delete(comments).where(eq(comments.id, commentId));
      }
    } else {
      await tx
        .update(comments)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(comments.id, commentId));
    }

    // Resolve reports associated with the moderated comment
    await tx
      .update(commentReports)
      .set({
        status: "reviewed",
        reviewedBy: userId,
        reviewedAt: new Date(),
      })
      .where(eq(commentReports.commentId, commentId));

    // Log in audit log
    await tx.insert(auditLogs).values({
      actorId: userId,
      action: `comment_moderate_${newStatus}`,
      resourceType: "comment",
      resourceId: commentId,
    });
  });

  try {
    if (targetComment.postId) {
      revalidateTag(`comments:${targetComment.postId}`, "max");
    } else if (targetComment.isGuestbook) {
      revalidateTag("guestbook", "max");
    }
  } catch (err) {
    console.error("Cache revalidation failed:", err);
  }

  return { success: true };
}

interface ReportCommentInput {
  commentId: string;
  reason: string;
  details?: string;
}

export async function reportComment(input: ReportCommentInput) {
  const { user } = await requireActiveUser();
  const userId = user.id;

  const targetComment = await dbQuery.query.comments.findFirst({
    where: eq(comments.id, input.commentId),
  });

  if (!targetComment) {
    throw new Error("Comment not found.");
  }

  // Rate limit: Max 10 reports per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [reportCount] = await dbQuery
    .select({ count: sql<number>`count(*)` })
    .from(commentReports)
    .where(and(eq(commentReports.reporterId, userId), gte(commentReports.createdAt, oneHourAgo)));

  if (Number(reportCount?.count || 0) >= 10) {
    throw new Error("Rate limit exceeded: Max 10 comment reports per hour.");
  }

  await withTransaction(async (tx) => {
    // Check if reporter already reported this comment
    const existingReport = await tx.query.commentReports.findFirst({
      where: and(
        eq(commentReports.commentId, input.commentId),
        eq(commentReports.reporterId, userId)
      ),
    });

    if (existingReport) {
      throw new Error("You have already reported this comment.");
    }

    await tx.insert(commentReports).values({
      commentId: input.commentId,
      reporterId: userId,
      reason: input.reason,
      details: input.details || null,
      status: "pending",
      createdAt: new Date(),
    });
  });

  return { success: true };
}

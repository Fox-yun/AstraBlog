import { cache } from "react";
import { dbQuery } from "@/db";
import { categories, tags } from "@/db/schema/taxonomy";
import { posts, postTags } from "@/db/schema/posts";
import { comments } from "@/db/schema/comments";
import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { siteConfig } from "@/config/site";

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

const noteRelations = {
  category: true,
  tags: {
    with: {
      tag: true,
    },
  },
} as const;

export interface NotesIndexInput {
  query?: string;
  categorySlug?: string;
  tagSlug?: string;
  page?: number;
  pageSize?: number;
}

export async function getNotesIndex(input: NotesIndexInput = {}) {
  const pageSize = Math.max(1, input.pageSize || siteConfig.postsPerPage || 12);
  const requestedPage = Math.max(1, input.page || 1);

  if (!isDatabaseConfigured) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      activeCategory: null,
      activeTag: null,
    };
  }

  const query = input.query?.trim();
  const activeCategory = input.categorySlug
    ? await dbQuery.query.categories.findFirst({
        where: eq(categories.slug, input.categorySlug),
      })
    : null;
  const activeTag = input.tagSlug
    ? await dbQuery.query.tags.findFirst({
        where: eq(tags.slug, input.tagSlug),
      })
    : null;

  let taggedPostIds: string[] | null = null;
  if (activeTag) {
    const links = await dbQuery.query.postTags.findMany({
      where: eq(postTags.tagId, activeTag.id),
      columns: { postId: true },
    });
    taggedPostIds = links.map((link) => link.postId);
  }

  if (activeTag && taggedPostIds?.length === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      activeCategory,
      activeTag,
    };
  }

  const searchPattern = query ? `%${query}%` : null;
  const where = and(
    eq(posts.type, "note"),
    eq(posts.status, "published"),
    activeCategory ? eq(posts.categoryId, activeCategory.id) : undefined,
    taggedPostIds ? inArray(posts.id, taggedPostIds) : undefined,
    searchPattern
      ? or(
          ilike(posts.title, searchPattern),
          ilike(posts.description, searchPattern),
          ilike(posts.contentMarkdown, searchPattern),
        )
      : undefined,
  );

  const [{ value: total }] = await dbQuery
    .select({ value: count() })
    .from(posts)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(Number(total) / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const items = await dbQuery.query.posts.findMany({
    where,
    orderBy: [desc(posts.isPinned), desc(posts.publishedAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    with: noteRelations,
  });

  return {
    items,
    total: Number(total),
    page,
    pageSize,
    totalPages,
    activeCategory,
    activeTag,
  };
}

export async function getPublicTaxonomy() {
  if (!isDatabaseConfigured) return { categories: [], tags: [] };

  const [categoryList, tagList] = await Promise.all([
    dbQuery.query.categories.findMany({ orderBy: [asc(categories.name)] }),
    dbQuery.query.tags.findMany({ orderBy: [asc(tags.name)] }),
  ]);

  return { categories: categoryList, tags: tagList };
}

export const getPublishedNote = cache(async (slug: string) => {
  if (!isDatabaseConfigured) return null;

  return dbQuery.query.posts.findFirst({
    where: and(
      eq(posts.slug, slug),
      eq(posts.type, "note"),
      eq(posts.status, "published"),
    ),
    with: {
      ...noteRelations,
      author: {
        with: {
          profile: true,
        },
      },
    },
  });
});

export const getPublishedPage = cache(async (slug: string) => {
  if (!isDatabaseConfigured) return null;

  return dbQuery.query.posts.findFirst({
    where: and(
      eq(posts.slug, slug),
      eq(posts.type, "page"),
      eq(posts.status, "published"),
    ),
    with: {
      author: {
        with: {
          profile: true,
        },
      },
    },
  });
});

export async function getPublishedChats(limit = 50) {
  if (!isDatabaseConfigured) return [];

  return dbQuery.query.posts.findMany({
    where: and(eq(posts.type, "chat"), eq(posts.status, "published")),
    orderBy: [desc(posts.isPinned), desc(posts.publishedAt)],
    limit,
    with: {
      author: {
        with: {
          profile: true,
        },
      },
      comments: {
        where: or(eq(comments.status, "visible"), eq(comments.status, "deleted")),
        orderBy: (comment, { asc: ascending }) => [ascending(comment.createdAt)],
        with: {
          author: {
            with: {
              profile: true,
            },
          },
        },
      },
    },
  });
}

export async function getPublicComments(postId: string) {
  if (!isDatabaseConfigured) return [];

  return dbQuery.query.comments.findMany({
    where: and(
      eq(comments.postId, postId),
      or(eq(comments.status, "visible"), eq(comments.status, "deleted")),
    ),
    orderBy: [asc(comments.createdAt)],
    with: {
      author: {
        with: {
          profile: true,
        },
      },
    },
  });
}

export async function getGuestbookComments() {
  if (!isDatabaseConfigured) return [];

  return dbQuery.query.comments.findMany({
    where: and(
      eq(comments.isGuestbook, true),
      or(eq(comments.status, "visible"), eq(comments.status, "deleted")),
    ),
    orderBy: [desc(comments.createdAt)],
    with: {
      author: {
        with: {
          profile: true,
        },
      },
    },
  });
}

export async function getPublishedPostsForDiscovery() {
  if (!isDatabaseConfigured) return [];

  return dbQuery.query.posts.findMany({
    where: and(eq(posts.status, "published"), inArray(posts.type, ["note", "page"])),
    columns: {
      slug: true,
      type: true,
      updatedAt: true,
    },
  });
}

export async function getFeedNotes(limit = 20) {
  if (!isDatabaseConfigured) return [];

  return dbQuery.query.posts.findMany({
    where: and(eq(posts.type, "note"), eq(posts.status, "published")),
    orderBy: [desc(posts.publishedAt)],
    limit,
  });
}

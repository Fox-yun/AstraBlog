"use server";

import { withTransaction } from "@/db";
import { categories, tags } from "@/db/schema/taxonomy";
import { auditLogs } from "@/db/schema/audit";
import { requireRole } from "@/lib/authorization";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { normalizeSlug } from "@/lib/content-utils";

interface CategoryInput {
  name: string;
  slug: string;
  description?: string;
}

export async function createCategory(input: CategoryInput) {
  const { user } = await requireRole("admin", "owner");
  const userId = user.id;

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);

  if (!name || !slug) {
    throw new Error("Name and Slug are required.");
  }

  const newCat = await withTransaction(async (tx) => {
    const existing = await tx.query.categories.findFirst({
      where: eq(categories.slug, slug),
    });
    if (existing) {
      throw new Error(`Category slug "${slug}" already exists.`);
    }

    const [inserted] = await tx
      .insert(categories)
      .values({
        name,
        slug,
        description: input.description || null,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorId: userId,
      action: "category_create",
      resourceType: "category",
      resourceId: inserted.id,
      metadata: { name: inserted.name, slug: inserted.slug },
    });

    return inserted;
  });

  try {
    revalidateTag("posts", "max");
    revalidateTag("taxonomy", "max");
  } catch (err) {
    console.error(err);
  }

  return { success: true, category: newCat };
}

export async function deleteCategory(categoryId: string) {
  const { user } = await requireRole("owner"); // Owner only to delete taxonomies
  const userId = user.id;

  const target = await withTransaction(async (tx) => {
    const [deleted] = await tx
      .delete(categories)
      .where(eq(categories.id, categoryId))
      .returning();

    if (deleted) {
      await tx.insert(auditLogs).values({
        actorId: userId,
        action: "category_delete",
        resourceType: "category",
        resourceId: categoryId,
        metadata: { name: deleted.name, slug: deleted.slug },
      });
    }
    return deleted;
  });

  try {
    revalidateTag("posts", "max");
    revalidateTag("taxonomy", "max");
  } catch (err) {
    console.error(err);
  }

  return { success: true, category: target };
}

interface TagInput {
  name: string;
  slug: string;
}

export async function createTag(input: TagInput) {
  const { user } = await requireRole("admin", "owner");
  const userId = user.id;

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);

  if (!name || !slug) {
    throw new Error("Name and Slug are required.");
  }

  const newTag = await withTransaction(async (tx) => {
    const existing = await tx.query.tags.findFirst({
      where: eq(tags.slug, slug),
    });
    if (existing) {
      throw new Error(`Tag slug "${slug}" already exists.`);
    }

    const [inserted] = await tx
      .insert(tags)
      .values({
        name,
        slug,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorId: userId,
      action: "tag_create",
      resourceType: "tag",
      resourceId: inserted.id,
      metadata: { name: inserted.name, slug: inserted.slug },
    });

    return inserted;
  });

  try {
    revalidateTag("posts", "max");
    revalidateTag("taxonomy", "max");
  } catch (err) {
    console.error(err);
  }

  return { success: true, tag: newTag };
}

export async function deleteTag(tagId: string) {
  const { user } = await requireRole("owner");
  const userId = user.id;

  const target = await withTransaction(async (tx) => {
    const [deleted] = await tx
      .delete(tags)
      .where(eq(tags.id, tagId))
      .returning();

    if (deleted) {
      await tx.insert(auditLogs).values({
        actorId: userId,
        action: "tag_delete",
        resourceType: "tag",
        resourceId: tagId,
        metadata: { name: deleted.name, slug: deleted.slug },
      });
    }
    return deleted;
  });

  try {
    revalidateTag("posts", "max");
    revalidateTag("taxonomy", "max");
  } catch (err) {
    console.error(err);
  }

  return { success: true, tag: target };
}

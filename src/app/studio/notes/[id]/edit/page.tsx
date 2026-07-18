import { db } from "@/db";
import { posts, postTags, postVersions } from "@/db/schema/posts";
import { categories, tags } from "@/db/schema/taxonomy";
import { eq, desc, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import NoteEditor from "@/components/studio/NoteEditor";

export const revalidate = 0; // Dynamic route

interface EditPostPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;

  // 1. Retrieve the post
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
  });

  if (!post) {
    notFound();
  }

  const [allCategories, allTags, versions, currentTags] = await Promise.all([
    db.query.categories.findMany({ orderBy: [asc(categories.name)] }),
    db.query.tags.findMany({ orderBy: [asc(tags.name)] }),
    db.query.postVersions.findMany({
      where: eq(postVersions.postId, id),
      orderBy: [desc(postVersions.versionNumber)],
    }),
    db.query.postTags.findMany({
      where: eq(postTags.postId, id),
      columns: { tagId: true },
    }),
  ]);

  return (
    <NoteEditor
      post={post as any}
      categories={allCategories}
      tags={allTags}
      initialTagIds={currentTags.map((item) => item.tagId)}
      versions={versions as any}
    />
  );
}

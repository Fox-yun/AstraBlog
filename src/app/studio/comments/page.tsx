import { db } from "@/db";
import { comments } from "@/db/schema/comments";
import { desc } from "drizzle-orm";
import CommentsModerator from "@/components/studio/CommentsModerator";

export const revalidate = 0; // Dynamic route

export default async function StudioCommentsPage() {
  const allComments = await db.query.comments.findMany({
    orderBy: [desc(comments.createdAt)],
    with: {
      author: {
        with: {
          profile: true,
        },
      },
      post: true,
      reports: {
        with: {
          reporter: true,
        },
      },
    },
  });

  return <CommentsModerator initialComments={allComments as any} />;
}

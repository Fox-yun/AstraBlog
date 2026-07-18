import type { Metadata } from "next";
import CommentForm from "@/components/comments/CommentForm";
import CommentItem from "@/components/comments/CommentItem";
import { getGuestbookComments, isDatabaseConfigured } from "@/lib/content";

export const revalidate = 10; // Rapid revalidation for guestbook activity
export const metadata: Metadata = {
  title: "Guestbook",
  description: "Reader messages, links, and feedback.",
  alternates: { canonical: "/guestbook" },
};

export default async function GuestbookPage() {
  const guestbookComments = await getGuestbookComments();

  // Group comments: root comments vs nested replies
  const rootComments = guestbookComments.filter((c) => c.parentId === null);
  const repliesGroupedByParent = guestbookComments.reduce<Record<string, typeof guestbookComments>>(
    (acc, comment) => {
      if (comment.parentId) {
        if (!acc[comment.parentId]) acc[comment.parentId] = [];
        acc[comment.parentId].push(comment);
      }
      return acc;
    },
    {}
  );

  // Sort replies chronologically (oldest to newest) in memory
  for (const parentId in repliesGroupedByParent) {
    repliesGroupedByParent[parentId].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  return (
    <div className="max-w-2xl py-6 space-y-12">
      <div>
        <h1 className="text-3xl tracking-widest mb-4 font-serif font-light">GUESTBOOK</h1>
        <p className="text-sm text-text-muted font-sans tracking-wide">
          Leave a message on the wall. Share your thoughts, links, or feedback.
        </p>
      </div>

      {/* Guestbook Submission Form */}
      {isDatabaseConfigured ? (
        <div className="hairline-border p-4 bg-bg-surface/20">
          <CommentForm isGuestbook={true} />
        </div>
      ) : (
        <p className="hairline-border p-4 text-xs font-mono text-text-muted">
          GUESTBOOK IS UNAVAILABLE UNTIL PERSISTENT STORAGE IS CONFIGURED.
        </p>
      )}

      {/* Guestbook Comments List */}
      <div className="space-y-8">
        {rootComments.length === 0 ? (
          <p className="text-xs font-mono text-text-muted">
            The wall is empty. Be the first to leave a message.
          </p>
        ) : (
          rootComments.map((rootComment) => {
            const replies = repliesGroupedByParent[rootComment.id] || [];

            return (
              <div key={rootComment.id} className="hairline-border p-4 bg-bg-surface/10 space-y-6">
                <CommentItem comment={rootComment as any} isGuestbook={true} />

                {replies.length > 0 && (
                  <div className="pl-6 border-l border-border-base/50 space-y-6 mt-4">
                    {replies.map((reply) => (
                      <CommentItem key={reply.id} comment={reply as any} isGuestbook={true} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

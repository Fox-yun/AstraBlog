import CommentForm from "@/components/comments/CommentForm";
import CommentItem from "@/components/comments/CommentItem";

interface CommentsSectionProps {
  comments: Array<any>;
  postId: string;
  allowComments: boolean;
}

export default function CommentsSection({
  comments,
  postId,
  allowComments,
}: CommentsSectionProps) {
  const rootComments = comments.filter((comment) => comment.parentId === null);
  const repliesByParent = comments.reduce<Record<string, any[]>>(
    (acc, comment) => {
      if (comment.parentId) {
        acc[comment.parentId] ||= [];
        acc[comment.parentId].push(comment);
      }
      return acc;
    },
    {},
  );
  const visibleCount = comments.filter((comment) => comment.status === "visible").length;

  return (
    <section className="space-y-8" aria-labelledby="comments-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="comments-heading" className="text-lg font-serif font-semibold tracking-wide uppercase">
          COMMENTS ({visibleCount})
        </h2>
        {!allowComments && (
          <span className="text-[10px] font-mono tracking-widest text-text-muted">
            COMMENTS CLOSED
          </span>
        )}
      </div>

      {allowComments && (
        <div className="hairline-border p-4 bg-bg-surface/20">
          <CommentForm postId={postId} />
        </div>
      )}

      <div className="space-y-8 mt-12">
        {rootComments.length === 0 ? (
          <p className="text-xs font-mono text-text-muted">
            {allowComments
              ? "No comments yet. Write the first one above."
              : "No comments were posted before this thread closed."}
          </p>
        ) : (
          rootComments.map((rootComment) => {
            const replies = repliesByParent[rootComment.id] || [];
            return (
              <div
                key={rootComment.id}
                className="hairline-border p-4 bg-bg-surface/10 space-y-6"
              >
                <CommentItem comment={rootComment} postId={postId} />
                {replies.length > 0 && (
                  <div className="pl-6 border-l border-border-base/50 space-y-6 mt-4">
                    {replies.map((reply) => (
                      <CommentItem key={reply.id} comment={reply} postId={postId} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

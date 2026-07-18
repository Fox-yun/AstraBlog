import type { Metadata } from "next";
import ArticleBody from "@/components/content/ArticleBody";
import CommentForm from "@/components/comments/CommentForm";
import CommentItem from "@/components/comments/CommentItem";
import { getPublishedChats } from "@/lib/content";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Chat",
  description: "Short posts, fragments, and field notes.",
  alternates: { canonical: "/chat" },
};

export default async function ChatPage() {
  const chats = await getPublishedChats();

  return (
    <div className="max-w-[576px] mx-auto py-6 w-full">
      <h1 className="text-3xl tracking-widest mb-12 font-serif font-light">CHAT</h1>

      {chats.length === 0 ? (
        <p className="text-text-muted font-mono text-sm">No thoughts posted yet.</p>
      ) : (
        <div className="relative border-l border-border-base ml-2 space-y-12">
          {chats.map((chat) => {
            const date = chat.publishedAt ? new Date(chat.publishedAt) : new Date();
            const rootComments = chat.comments.filter((comment) => comment.parentId === null);
            const repliesByParent = chat.comments.reduce<Record<string, typeof chat.comments>>(
              (acc, comment) => {
                if (comment.parentId) {
                  acc[comment.parentId] ||= [];
                  acc[comment.parentId].push(comment);
                }
                return acc;
              },
              {},
            );

            return (
              <article key={chat.id} className="relative pl-8 group">
                <div className="absolute left-[-2.5px] top-1.5 w-[5px] h-[5px] bg-bg-void border border-border-base transition-strict group-hover:border-accent-amber" />
                <div className="text-[10px] font-mono text-text-muted tracking-widest mb-2 flex flex-wrap justify-between gap-2 items-center">
                  <time dateTime={chat.publishedAt?.toISOString()}>
                    {date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <span>BY {chat.author.profile?.displayName || chat.author.name}</span>
                </div>

                <ArticleBody html={chat.contentHtml} compact />

                {chat.comments.length > 0 && (
                  <div className="space-y-4 mt-6 pt-4 border-t border-border-base/30">
                    <div className="text-[10px] font-mono text-text-muted tracking-wider uppercase mb-2">
                      Replies ({chat.comments.filter((comment) => comment.status === "visible").length})
                    </div>
                    {rootComments.map((rootComment) => (
                      <div key={rootComment.id} className="text-xs space-y-3 bg-bg-surface/20 p-3 hairline-border">
                        <CommentItem comment={rootComment as any} postId={chat.id} />
                        {(repliesByParent[rootComment.id] || []).length > 0 && (
                          <div className="pl-4 border-l border-border-base/50 space-y-3 mt-3">
                            {repliesByParent[rootComment.id].map((reply) => (
                              <CommentItem key={reply.id} comment={reply as any} postId={chat.id} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {chat.allowComments && (
                  <div className="mt-4 pt-2">
                    <CommentForm postId={chat.id} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

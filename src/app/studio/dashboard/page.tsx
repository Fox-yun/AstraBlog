import { db } from "@/db";
import { posts } from "@/db/schema/posts";
import { comments } from "@/db/schema/comments";
import { and, eq, sql } from "drizzle-orm";

export const revalidate = 0; // Dynamic data

export default async function StudioDashboard() {
  // Select counts
  const [publishedNotesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(eq(posts.type, "note"), eq(posts.status, "published")));

  const [draftNotesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(eq(posts.type, "note"), eq(posts.status, "draft")));

  const [chatEntriesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.type, "chat"));

  const [pendingCommentsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.status, "pending"));

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h2 className="text-xl font-serif font-light mb-1">DASHBOARD</h2>
        <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase">
          SYSTEM METRICS
        </p>
      </div>

      <div className="border border-border-base bg-bg-surface/10 p-6 space-y-6">
        <div>
          <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-3">
            CONTENT METRICS
          </div>
          <div className="font-mono text-xs space-y-2.5">
            <div className="flex justify-between border-b border-border-base/40 pb-1.5">
              <span>Published Notes</span>
              <span className="text-text-primary font-semibold">
                {publishedNotesCount?.count || 0}
              </span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-1.5">
              <span>Draft Notes</span>
              <span className="text-text-primary font-semibold">
                {draftNotesCount?.count || 0}
              </span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-1.5">
              <span>Chat Entries</span>
              <span className="text-text-primary font-semibold">
                {chatEntriesCount?.count || 0}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-3">
            MODERATION QUEUES
          </div>
          <div className="font-mono text-xs">
            <div className="flex justify-between border-b border-border-base/40 pb-1.5">
              <span>Pending Comments</span>
              <span
                className={`font-semibold ${
                  (pendingCommentsCount?.count || 0) > 0 ? "text-accent-amber" : "text-text-primary"
                }`}
              >
                {pendingCommentsCount?.count || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { db } from "@/db";
import { posts } from "@/db/schema/posts";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

export const revalidate = 0; // Dynamic data

export default async function StudioChatPage() {
  const chatPosts = await db.query.posts.findMany({
    where: eq(posts.type, "chat"),
    orderBy: [desc(posts.createdAt)],
  });

  return (
    <div className="space-y-6 w-full font-mono text-xs">
      <div className="flex justify-between items-center border-b border-border-base pb-3">
        <div>
          <h2 className="text-sm font-serif font-light tracking-widest uppercase">CHAT MANAGEMENT</h2>
          <p className="text-[10px] text-text-muted mt-0.5">MANAGE ALL CHAT MICRO-POSTS</p>
        </div>
        <Link
          href="/studio/notes/new?type=chat"
          className="hairline-border px-3 py-1 hover:text-accent-amber hover:border-accent-amber transition-strict"
        >
          + NEW CHAT
        </Link>
      </div>

      <div className="border border-border-base bg-bg-surface/10 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-base bg-bg-surface/20 text-[10px] text-text-muted uppercase tracking-wider">
              <th className="p-3">Snippet Content</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created At</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/50">
            {chatPosts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-text-muted">
                  No chats created yet. Click "+ NEW CHAT" to post a snippet.
                </td>
              </tr>
            ) : (
              chatPosts.map((item) => {
                const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <tr key={item.id} className="hover:bg-bg-surface/10 transition-strict">
                    <td className="p-3 text-text-primary font-sans max-w-md truncate">
                      {item.contentMarkdown.slice(0, 80) || "Untitled Snippet"}
                    </td>
                    <td className="p-3 uppercase">
                      <span
                        className={
                          item.status === "published"
                            ? "text-text-primary"
                            : "text-accent-amber"
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-text-muted">{dateStr}</td>
                    <td className="p-3 text-right space-x-3">
                      <Link
                        href={`/studio/notes/${item.id}/edit`}
                        className="text-text-primary hover:text-accent-amber transition-strict"
                      >
                        [EDIT]
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

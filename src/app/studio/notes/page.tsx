import { db } from "@/db";
import { posts } from "@/db/schema/posts";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { deletePost } from "@/actions/posts";

export const revalidate = 0; // Dynamic data

export default async function StudioNotesPage() {
  const allPosts = await db.query.posts.findMany({
    orderBy: [desc(posts.createdAt)],
  });

  return (
    <div className="space-y-6 w-full font-mono text-xs">
      <div className="flex justify-between items-center border-b border-border-base pb-3">
        <div>
          <h2 className="text-sm font-serif font-light tracking-widest uppercase">CONTENT MANAGEMENT</h2>
          <p className="text-[10px] text-text-muted mt-0.5">MANAGE ALL ARTICLES, NOTES AND CHATS</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/studio/notes/new?type=note"
            className="hairline-border px-3 py-1 hover:text-accent-amber hover:border-accent-amber transition-strict"
          >
            + NEW NOTE
          </Link>
          <Link
            href="/studio/notes/new?type=chat"
            className="hairline-border px-3 py-1 hover:text-accent-amber hover:border-accent-amber transition-strict"
          >
            + NEW CHAT
          </Link>
          <Link
            href="/studio/notes/new?type=page"
            className="hairline-border px-3 py-1 hover:text-accent-amber hover:border-accent-amber transition-strict"
          >
            + NEW PAGE
          </Link>
        </div>
      </div>

      <div className="border border-border-base bg-bg-surface/10 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-base bg-bg-surface/20 text-[10px] text-text-muted uppercase tracking-wider">
              <th className="p-3">Title / Summary</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Created At</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/50">
            {allPosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-text-muted">
                  No contents created yet. Click one of the buttons above to write a post.
                </td>
              </tr>
            ) : (
              allPosts.map((item) => {
                const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                });
                return (
                  <tr key={item.id} className="hover:bg-bg-surface/10 transition-strict">
                    <td className="p-3 text-text-primary font-sans max-w-xs truncate">
                      {item.title || item.contentMarkdown.slice(0, 50) + "..."}
                    </td>
                    <td className="p-3 uppercase font-semibold text-[10px]">{item.type}</td>
                    <td className="p-3 uppercase">
                      <span
                        className={
                          item.status === "published"
                            ? "text-text-primary"
                            : item.status === "draft"
                            ? "text-text-muted"
                            : "text-accent-amber"
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[10px] text-text-muted max-w-[150px] truncate">
                      {item.slug}
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

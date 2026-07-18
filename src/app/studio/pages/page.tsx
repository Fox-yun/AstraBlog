import { db } from "@/db";
import { posts } from "@/db/schema/posts";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

export const revalidate = 0; // Dynamic data

export default async function StudioPagesPage() {
  const pagePosts = await db.query.posts.findMany({
    where: eq(posts.type, "page"),
    orderBy: [desc(posts.createdAt)],
  });

  return (
    <div className="space-y-6 w-full font-mono text-xs">
      <div className="flex justify-between items-center border-b border-border-base pb-3">
        <div>
          <h2 className="text-sm font-serif font-light tracking-widest uppercase">PAGES MANAGEMENT</h2>
          <p className="text-[10px] text-text-muted mt-0.5">MANAGE SYSTEM STATIC PAGES</p>
        </div>
        <Link
          href="/studio/notes/new?type=page"
          className="hairline-border px-3 py-1 hover:text-accent-amber hover:border-accent-amber transition-strict"
        >
          + NEW PAGE
        </Link>
      </div>

      <div className="border border-border-base bg-bg-surface/10 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-base bg-bg-surface/20 text-[10px] text-text-muted uppercase tracking-wider">
              <th className="p-3">Page Title</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created At</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/50">
            {pagePosts.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-text-muted">
                  No static pages created yet. Click "+ NEW PAGE" to build one.
                </td>
              </tr>
            ) : (
              pagePosts.map((item) => {
                const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                });
                return (
                  <tr key={item.id} className="hover:bg-bg-surface/10 transition-strict">
                    <td className="p-3 text-text-primary font-sans font-medium">
                      {item.title || "Untitled Page"}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-text-muted">
                      /{item.slug}
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

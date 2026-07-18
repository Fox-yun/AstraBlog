"use client";

import { useTransition, useState } from "react";
import { createCategory, deleteCategory, createTag, deleteTag } from "@/actions/taxonomy";
import { useRouter } from "next/navigation";

interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

interface TaxonomyManagerProps {
  type: "category" | "tag";
  initialItems: TaxonomyItem[];
}

export default function TaxonomyManager({ type, initialItems }: TaxonomyManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setErrorMsg(null);
    startTransition(async () => {
      try {
        let res;
        if (type === "category") {
          res = await createCategory({ name, slug, description });
        } else {
          res = await createTag({ name, slug });
        }

        if (res.success) {
          setName("");
          setSlug("");
          setDescription("");
          router.refresh();
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to create item.");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    startTransition(async () => {
      try {
        let res;
        if (type === "category") {
          res = await deleteCategory(id);
        } else {
          res = await deleteTag(id);
        }

        if (res.success) {
          router.refresh();
        }
      } catch (err: any) {
        alert(err.message || "Failed to delete item. Make sure you are the Owner.");
      }
    });
  };

  return (
    <div className="space-y-8 font-mono text-xs w-full">
      {/* Title */}
      <div className="border-b border-border-base pb-3">
        <h2 className="text-sm font-serif font-light tracking-widest uppercase">{type.toUpperCase()} MANAGEMENT</h2>
        <p className="text-[10px] text-text-muted mt-0.5">CREATE AND ORGANIZE BLOG {type.toUpperCase()}S</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
        {/* Creation Form Pane */}
        <form onSubmit={handleSubmit} className="hairline-border p-4 bg-bg-surface/20 space-y-4 h-fit">
          <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase border-b border-border-base pb-2">
            NEW {type.toUpperCase()}
          </div>

          {errorMsg && (
            <div className="text-accent-amber border border-accent-amber/50 p-2 bg-bg-void uppercase text-[10px]">
              ERROR: {errorMsg}
            </div>
          )}

          <div className="flex flex-col">
            <label className="text-[10px] text-text-muted mb-1 uppercase">NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Systems Engineering"
              className="bg-bg-void border-b border-border-base py-1 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] text-text-muted mb-1 uppercase">SLUG</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. systems-engineering"
              className="bg-bg-void border-b border-border-base py-1 focus:outline-none"
              required
            />
          </div>

          {type === "category" && (
            <div className="flex flex-col">
              <label className="text-[10px] text-text-muted mb-1 uppercase">DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="bg-bg-void border border-border-base p-2 focus:outline-none h-16 resize-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full text-center py-2 hairline-border bg-bg-void hover:text-accent-amber transition-strict font-bold uppercase"
          >
            [SUBMIT {type.toUpperCase()}]
          </button>
        </form>

        {/* Existing Items Table Pane */}
        <div className="border border-border-base bg-bg-surface/10 overflow-x-auto h-fit">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-base bg-bg-surface/20 text-[10px] text-text-muted uppercase tracking-wider">
                <th className="p-3">Name</th>
                <th className="p-3">Slug</th>
                {type === "category" && <th className="p-3">Description</th>}
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base/50">
              {initialItems.length === 0 ? (
                <tr>
                  <td colSpan={type === "category" ? 4 : 3} className="p-4 text-center text-text-muted">
                    No items created yet. Use the form to make one.
                  </td>
                </tr>
              ) : (
                initialItems.map((item) => (
                  <tr key={item.id} className="hover:bg-bg-surface/10 transition-strict">
                    <td className="p-3 text-text-primary font-sans font-medium">{item.name}</td>
                    <td className="p-3 font-mono text-[10px] text-text-muted">/{item.slug}</td>
                    {type === "category" && (
                      <td className="p-3 font-sans text-text-muted max-w-xs truncate">
                        {item.description || "—"}
                      </td>
                    )}
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        className="text-text-primary hover:text-accent-amber transition-strict border-0 p-0"
                      >
                        [DELETE]
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

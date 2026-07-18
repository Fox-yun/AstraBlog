import type { Metadata } from "next";
import Link from "next/link";
import NoteList from "@/components/content/NoteList";
import Pagination from "@/components/content/Pagination";
import { getNotesIndex, getPublicTaxonomy } from "@/lib/content";
import { toPositiveInteger } from "@/lib/content-utils";
import { siteConfig } from "@/config/site";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Notes",
  description: `Long-form notes from ${siteConfig.name}.`,
  alternates: { canonical: "/notes" },
};

interface NotesPageProps {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
    tag?: string | string[];
    page?: string | string[];
  }>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const params = await searchParams;
  const query = first(params.q)?.trim() || "";
  const categorySlug = first(params.category) || "";
  const tagSlug = first(params.tag) || "";
  const page = toPositiveInteger(params.page);

  const [index, taxonomy] = await Promise.all([
    getNotesIndex({ query, categorySlug, tagSlug, page }),
    getPublicTaxonomy(),
  ]);

  return (
    <div className="max-w-2xl py-6 w-full">
      <div className="mb-10">
        <h1 className="text-3xl tracking-widest mb-3 font-serif font-light">NOTES</h1>
        <p className="text-xs font-mono text-text-muted tracking-wider">
          {index.total} PUBLISHED {index.total === 1 ? "ENTRY" : "ENTRIES"}
        </p>
      </div>

      <form
        action="/notes"
        method="get"
        role="search"
        className="hairline-border p-4 mb-12 bg-bg-surface/10 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <label className="flex flex-col md:col-span-2 text-[10px] font-mono tracking-widest text-text-muted">
          SEARCH ARCHIVE
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Title, summary, or content"
            className="mt-1 text-sm font-sans"
          />
        </label>

        <label className="flex flex-col text-[10px] font-mono tracking-widest text-text-muted">
          CATEGORY
          <select name="category" defaultValue={categorySlug} className="mt-1 text-xs">
            <option value="">All categories</option>
            {taxonomy.categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-[10px] font-mono tracking-widest text-text-muted">
          TAG
          <select name="tag" defaultValue={tagSlug} className="mt-1 text-xs">
            <option value="">All tags</option>
            {taxonomy.tags.map((tag) => (
              <option key={tag.id} value={tag.slug}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center gap-4 pt-1 text-[10px] font-mono tracking-wider">
          <button type="submit" className="px-4 py-2">
            [APPLY FILTERS]
          </button>
          {(query || categorySlug || tagSlug) && (
            <Link href="/notes" className="text-text-muted">
              [CLEAR]
            </Link>
          )}
        </div>
      </form>

      <NoteList
        notes={index.items}
        emptyMessage="No notes match the current filters."
      />
      <Pagination
        page={index.page}
        totalPages={index.totalPages}
        pathname="/notes"
        query={{ q: query, category: categorySlug, tag: tagSlug }}
      />
    </div>
  );
}

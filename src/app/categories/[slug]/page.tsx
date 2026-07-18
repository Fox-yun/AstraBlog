import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NoteList from "@/components/content/NoteList";
import Pagination from "@/components/content/Pagination";
import { getNotesIndex } from "@/lib/content";
import { toPositiveInteger } from "@/lib/content-utils";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getNotesIndex({ categorySlug: slug, pageSize: 1 });
  if (!result.activeCategory) return {};
  return {
    title: `Category: ${result.activeCategory.name}`,
    description:
      result.activeCategory.description ||
      `Published notes in ${result.activeCategory.name}.`,
    alternates: { canonical: `/categories/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const page = toPositiveInteger(search.page);
  const result = await getNotesIndex({ categorySlug: slug, page });
  if (!result.activeCategory) notFound();

  return (
    <div className="max-w-2xl py-6 w-full">
      <header className="mb-12">
        <p className="text-[10px] font-mono tracking-widest text-accent-amber mb-3">
          CATEGORY ARCHIVE
        </p>
        <h1 className="text-3xl tracking-widest mb-4 font-serif font-light">
          {result.activeCategory.name.toUpperCase()}
        </h1>
        {result.activeCategory.description && (
          <p className="text-sm text-text-muted leading-relaxed">
            {result.activeCategory.description}
          </p>
        )}
      </header>
      <NoteList notes={result.items} emptyMessage="No notes in this category yet." />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        pathname={`/categories/${slug}`}
      />
    </div>
  );
}

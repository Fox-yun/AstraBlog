import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NoteList from "@/components/content/NoteList";
import Pagination from "@/components/content/Pagination";
import { getNotesIndex } from "@/lib/content";
import { toPositiveInteger } from "@/lib/content-utils";

interface TagPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getNotesIndex({ tagSlug: slug, pageSize: 1 });
  if (!result.activeTag) return {};
  return {
    title: `Tag: ${result.activeTag.name}`,
    description: `Published notes tagged ${result.activeTag.name}.`,
    alternates: { canonical: `/tags/${slug}` },
  };
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const page = toPositiveInteger(search.page);
  const result = await getNotesIndex({ tagSlug: slug, page });
  if (!result.activeTag) notFound();

  return (
    <div className="max-w-2xl py-6 w-full">
      <header className="mb-12">
        <p className="text-[10px] font-mono tracking-widest text-accent-amber mb-3">
          TAG ARCHIVE
        </p>
        <h1 className="text-3xl tracking-widest font-serif font-light">
          #{result.activeTag.name.toUpperCase()}
        </h1>
      </header>
      <NoteList notes={result.items} emptyMessage="No notes use this tag yet." />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        pathname={`/tags/${slug}`}
      />
    </div>
  );
}

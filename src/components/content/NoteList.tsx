import Link from "next/link";
import { estimateReadingMinutes } from "@/lib/content-utils";

export interface NoteListItem {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  contentMarkdown: string;
  publishedAt: Date | null;
  isPinned: boolean;
  category: { name: string; slug: string } | null;
  tags: Array<{
    tag: { name: string; slug: string };
  }>;
}

interface NoteListProps {
  notes: NoteListItem[];
  emptyMessage?: string;
  groupByYear?: boolean;
}

function NoteRow({ note }: { note: NoteListItem }) {
  const date = note.publishedAt ? new Date(note.publishedAt) : new Date();
  const dateLabel = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;

  return (
    <article className="group relative">
      <Link href={`/notes/${note.slug}`} className="block">
        <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-8">
          <time
            dateTime={note.publishedAt?.toISOString()}
            className="font-mono text-text-muted text-sm tracking-widest min-w-[60px]"
          >
            {dateLabel}
          </time>
          <div className="flex-1 space-y-1">
            <h3 className="text-base text-text-primary group-hover:text-accent-amber transition-strict">
              {note.title || "Untitled note"}
            </h3>
            <div className="text-xs font-mono text-text-muted tracking-wide flex flex-wrap items-center gap-x-2 gap-y-1">
              {note.isPinned && <span className="text-accent-amber">PINNED</span>}
              {note.isPinned && <span aria-hidden="true">·</span>}
              <span>{note.category?.name || "Uncategorized"}</span>
              <span aria-hidden="true">·</span>
              <span>{estimateReadingMinutes(note.contentMarkdown)} min</span>
            </div>
          </div>
        </div>
      </Link>

      {note.tags.length > 0 && (
        <div className="mt-3 md:ml-[92px] flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono tracking-wider text-text-muted">
          {note.tags.map(({ tag }) => (
            <Link
              key={tag.slug}
              href={`/tags/${tag.slug}`}
              className="hover:text-accent-amber transition-strict"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}
      <div className="hairline-border-b mt-6 opacity-30" />
    </article>
  );
}

export default function NoteList({
  notes,
  emptyMessage = "No notes published yet.",
  groupByYear = true,
}: NoteListProps) {
  if (notes.length === 0) {
    return <p className="text-text-muted font-mono text-sm">{emptyMessage}</p>;
  }

  if (!groupByYear) {
    return (
      <div className="space-y-6">
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} />
        ))}
      </div>
    );
  }

  const grouped = notes.reduce<Record<number, NoteListItem[]>>((acc, note) => {
    const year = note.publishedAt
      ? new Date(note.publishedAt).getFullYear()
      : new Date().getFullYear();
    acc[year] ||= [];
    acc[year].push(note);
    return acc;
  }, {});

  return (
    <div className="space-y-16">
      {Object.keys(grouped)
        .map(Number)
        .sort((a, b) => b - a)
        .map((year) => (
          <section key={year} className="space-y-8" aria-labelledby={`year-${year}`}>
            <h2
              id={`year-${year}`}
              className="text-xl font-mono text-text-primary tracking-widest border-b border-border-base pb-2"
            >
              {year}
            </h2>
            <div className="space-y-6">
              {grouped[year].map((note) => (
                <NoteRow key={note.id} note={note} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

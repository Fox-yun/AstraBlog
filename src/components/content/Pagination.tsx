import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  pathname: string;
  query?: Record<string, string | undefined>;
}

function pageHref(
  pathname: string,
  page: number,
  query: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export default function Pagination({
  page,
  totalPages,
  pathname,
  query = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 pt-6 border-t border-border-base flex items-center justify-between text-xs font-mono tracking-wider"
    >
      {page > 1 ? (
        <Link href={pageHref(pathname, page - 1, query)}>[PREVIOUS]</Link>
      ) : (
        <span className="text-border-base">[PREVIOUS]</span>
      )}
      <span className="text-text-muted">
        PAGE {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={pageHref(pathname, page + 1, query)}>[NEXT]</Link>
      ) : (
        <span className="text-border-base">[NEXT]</span>
      )}
    </nav>
  );
}

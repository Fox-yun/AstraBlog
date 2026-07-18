import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col justify-center max-w-xl py-16">
      <p className="text-[10px] font-mono tracking-[0.25em] text-accent-amber mb-4">
        ERROR / 404
      </p>
      <h1 className="text-4xl font-serif font-light tracking-wider mb-5">
        PAGE NOT FOUND
      </h1>
      <p className="text-sm text-text-muted leading-relaxed mb-10">
        The requested record does not exist, is unpublished, or has moved to a
        different address.
      </p>
      <div className="flex flex-wrap gap-5 text-xs font-mono tracking-wider">
        <Link href="/">[HOME]</Link>
        <Link href="/notes">[NOTES INDEX]</Link>
      </div>
    </div>
  );
}

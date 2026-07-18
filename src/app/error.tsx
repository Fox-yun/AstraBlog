"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col justify-center max-w-xl py-16">
      <p className="text-[10px] font-mono tracking-[0.25em] text-accent-amber mb-4">
        ERROR / RENDER
      </p>
      <h1 className="text-4xl font-serif font-light tracking-wider mb-5">
        CONTENT UNAVAILABLE
      </h1>
      <p className="text-sm text-text-muted leading-relaxed mb-10">
        The request could not be completed. Retry once, or return to the archive.
      </p>
      <div className="flex flex-wrap gap-5 text-xs font-mono tracking-wider">
        <button type="button" onClick={reset}>[TRY AGAIN]</button>
        <Link href="/notes">[NOTES INDEX]</Link>
      </div>
    </div>
  );
}

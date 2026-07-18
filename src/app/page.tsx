import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-center max-w-2xl py-12">
      <h1 className="text-4xl tracking-wider mb-6 font-serif font-light">
        {siteConfig.ownerName.toUpperCase()}
      </h1>

      <div className="space-y-4 mb-12 text-base font-sans tracking-wide">
        <p className="text-text-primary leading-relaxed">{siteConfig.description}</p>
        <p className="text-text-muted leading-relaxed">
          {siteConfig.secondaryDescription}
        </p>
      </div>

      <nav
        aria-label="Content sections"
        className="flex flex-col space-y-3 mb-16 text-sm font-mono tracking-wider"
      >
        {siteConfig.homeLinks.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2 border-b border-border-base/50 hover:border-accent-amber hover:text-accent-amber transition-strict"
          >
            <span>{String(index + 1).padStart(2, "0")} / {item.label}</span>
            <span className="text-text-muted text-xs">{item.description}</span>
          </Link>
        ))}
      </nav>

      <div className="text-xs font-mono tracking-widest text-text-muted flex items-center space-x-2">
        <span className="inline-block w-1.5 h-1.5 bg-accent-amber animate-pulse" />
        <span>CURRENTLY BUILDING · {siteConfig.wordmark}</span>
      </div>
    </div>
  );
}

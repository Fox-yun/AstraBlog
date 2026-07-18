import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: `About ${siteConfig.ownerName} and ${siteConfig.name}.`,
  alternates: { canonical: "/about" },
};

const stack = [
  ["LANGUAGES & RUNTIMES", "TypeScript, Node.js, modern web runtimes"],
  ["FRAMEWORKS & ENGINES", "Next.js, React, Drizzle ORM"],
  ["DATABASES & STORAGE", "PostgreSQL, Cloudflare R2"],
  ["DELIVERY", "Server rendering, RSS, sitemap, scheduled publishing"],
] as const;

export default function AboutPage() {
  const contacts = [
    siteConfig.contact.email
      ? { label: "EMAIL", href: `mailto:${siteConfig.contact.email}`, value: siteConfig.contact.email }
      : null,
    siteConfig.contact.github
      ? { label: "GITHUB", href: siteConfig.contact.github, value: new URL(siteConfig.contact.github).host }
      : null,
    siteConfig.contact.x
      ? { label: "X / TWITTER", href: siteConfig.contact.x, value: new URL(siteConfig.contact.x).host }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; value: string }>;

  return (
    <div className="max-w-2xl py-6 space-y-12 font-sans tracking-wide">
      <header>
        <h1 className="text-3xl tracking-widest mb-4 font-serif font-light">ABOUT</h1>
        <p className="text-xs font-mono text-text-muted uppercase tracking-widest">
          FACT-ORIENTED RETROSPECTIVE
        </p>
      </header>

      <section className="space-y-4 text-sm text-text-primary leading-relaxed">
        <p>{siteConfig.description}</p>
        <p className="text-text-muted">
          This site is a durable archive for long-form notes, technical writing,
          micro-posts, and reader conversations. Its interface favors semantic
          structure, straight lines, restrained color, and minimal noise.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-mono text-text-primary tracking-widest border-b border-border-base pb-2 uppercase">
          Technical Stack
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {stack.map(([label, value]) => (
            <div key={label} className="space-y-2">
              <div className="font-bold text-text-primary">{label}</div>
              <div className="text-text-muted">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-mono text-text-primary tracking-widest border-b border-border-base pb-2 uppercase">
          Publishing Values
        </h2>
        <ul className="list-none space-y-3 text-sm text-text-muted pl-4 border-l border-accent-amber">
          <li><strong className="text-text-primary">01 / Durable:</strong> Stable URLs, feeds, metadata, and portable Markdown source.</li>
          <li><strong className="text-text-primary">02 / Focused:</strong> Reading and writing stay central; decoration remains secondary.</li>
          <li><strong className="text-text-primary">03 / Safe:</strong> Role-gated publishing and sanitized rendered content.</li>
        </ul>
      </section>

      {contacts.length > 0 && (
        <section className="space-y-4 text-xs font-mono">
          <h2 className="text-sm text-text-primary tracking-widest border-b border-border-base pb-2 uppercase">
            Connect
          </h2>
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div key={contact.label} className="flex justify-between gap-6 border-b border-border-base/50 py-1">
                <span className="text-text-muted">{contact.label}</span>
                <a href={contact.href} rel="me noopener noreferrer" className="text-right">
                  {contact.value}
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: `About ${siteConfig.ownerName} and ${siteConfig.name}.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl py-6 space-y-12 font-sans tracking-wide">
      <header>
        <h1 className="text-3xl tracking-widest mb-4 font-serif font-light">ABOUT</h1>
      </header>

      <section className="space-y-4 text-sm text-text-primary leading-relaxed">
        <p>I tend to follow things further than necessary.</p>
        <p>
          A small question can turn into a program, a server, a broken system, or
          several hours spent somewhere entirely unrelated to where I started.
        </p>
        <p>
          These days, most of those questions happen somewhere around software,
          systems, infrastructure, local AI, and security.
        </p>
        <p>This place keeps some of what remains.</p>
      </section>
    </div>
  );
}

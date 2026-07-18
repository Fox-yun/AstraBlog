import { NextResponse } from "next/server";
import { absoluteUrl, siteConfig } from "@/config/site";
import { getFeedNotes } from "@/lib/content";
import { escapeXml, plainTextExcerpt } from "@/lib/content-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const notes = await getFeedNotes(20);
  const items = notes
    .map((post) => {
      const url = absoluteUrl(`/notes/${post.slug}`);
      const description = post.description || plainTextExcerpt(post.contentMarkdown);
      return [
        "    <item>",
        `      <title>${escapeXml(post.title || "Untitled note")}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${(post.publishedAt || post.createdAt).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const feedUrl = absoluteUrl("/feed.xml");
  const rssFeed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(siteConfig.name)}</title>`,
    `    <link>${escapeXml(siteConfig.url)}</link>`,
    `    <description>${escapeXml(siteConfig.description)}</description>`,
    `    <language>${escapeXml(siteConfig.language)}</language>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new NextResponse(rssFeed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

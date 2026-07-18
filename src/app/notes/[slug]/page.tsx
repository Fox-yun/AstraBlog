import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleBody from "@/components/content/ArticleBody";
import CommentsSection from "@/components/comments/CommentsSection";
import { absoluteUrl, siteConfig } from "@/config/site";
import { getPublishedNote, getPublicComments } from "@/lib/content";
import { estimateReadingMinutes, plainTextExcerpt } from "@/lib/content-utils";
import { addHeadingIdsAndExtractToc } from "@/lib/markdown";

export const revalidate = 60;

interface NoteDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: NoteDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedNote(slug);
  if (!post) return {};

  const description = post.description || plainTextExcerpt(post.contentMarkdown);

  return {
    title: post.title || "Untitled note",
    description,
    alternates: { canonical: `/notes/${post.slug}` },
    openGraph: {
      title: post.title || "Untitled note",
      description,
      type: "article",
      url: absoluteUrl(`/notes/${post.slug}`),
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      authors: [post.author.profile?.displayName || post.author.name],
      tags: post.tags.map(({ tag }) => tag.name),
      images: [absoluteUrl("/og.png")],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title || "Untitled note",
      description,
      images: [absoluteUrl("/og.png")],
    },
  };
}

export default async function NoteDetailPage({ params }: NoteDetailPageProps) {
  const { slug } = await params;
  const post = await getPublishedNote(slug);
  if (!post) notFound();

  const comments = await getPublicComments(post.id);
  const { html: contentHtml, toc } = addHeadingIdsAndExtractToc(post.contentHtml);
  const authorName = post.author.profile?.displayName || post.author.name;
  const description = post.description || plainTextExcerpt(post.contentMarkdown);
  const publishDate = post.publishedAt
    ? new Intl.DateTimeFormat(siteConfig.locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(post.publishedAt)
    : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString(),
    mainEntityOfPage: absoluteUrl(`/notes/${post.slug}`),
    author: { "@type": "Person", name: authorName },
    publisher: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <div className="w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className="mb-12 max-w-3xl">
        <Link
          href="/notes"
          className="inline-block mb-6 text-[10px] font-mono tracking-widest text-text-muted"
        >
          ← NOTES INDEX
        </Link>
        <h1 className="text-3xl md:text-4xl tracking-tight leading-tight mb-4 font-serif font-bold">
          {post.title || "Untitled note"}
        </h1>
        {description && (
          <p className="text-sm text-text-muted leading-relaxed mb-5 max-w-2xl">
            {description}
          </p>
        )}
        <div className="text-xs font-mono text-text-muted tracking-wide flex flex-wrap gap-x-2 gap-y-1">
          <span>{publishDate}</span>
          <span aria-hidden="true">·</span>
          {post.category ? (
            <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link>
          ) : (
            <span>Uncategorized</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{estimateReadingMinutes(post.contentMarkdown)} MIN READ</span>
          <span aria-hidden="true">·</span>
          <span>BY {authorName}</span>
        </div>
        {post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-mono tracking-wider text-text-muted">
            {post.tags.map(({ tag }) => (
              <Link key={tag.slug} href={`/tags/${tag.slug}`}>
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-12 items-start">
        {toc.length > 0 && (
          <aside className="hidden lg:block sticky top-8 w-[200px] border-l border-border-base pl-4 text-xs font-mono tracking-wide py-2">
            <div className="text-[10px] text-text-muted tracking-widest mb-3 uppercase">
              CONTENTS
            </div>
            <nav className="space-y-3" aria-label="Table of contents">
              {toc.map((item) => (
                <Link
                  key={item.id}
                  href={`#${item.id}`}
                  className={`block transition-strict hover:text-accent-amber ${
                    item.level === 3
                      ? "pl-3 text-text-muted/80"
                      : "text-text-muted font-medium"
                  }`}
                >
                  {item.text}
                </Link>
              ))}
            </nav>
          </aside>
        )}

        <div className="max-w-[768px] w-full flex-1">
          {toc.length > 0 && (
            <details className="lg:hidden hairline-border p-4 mb-8 bg-bg-surface/30 cursor-pointer text-xs font-mono">
              <summary className="select-none tracking-wider font-semibold uppercase text-[10px]">
                Table of contents
              </summary>
              <nav className="mt-4 space-y-2.5" aria-label="Table of contents">
                {toc.map((item) => (
                  <Link
                    key={item.id}
                    href={`#${item.id}`}
                    className={`block hover:text-accent-amber transition-strict ${
                      item.level === 3 ? "pl-3 text-text-muted" : "text-text-primary"
                    }`}
                  >
                    {item.text}
                  </Link>
                ))}
              </nav>
            </details>
          )}

          <ArticleBody html={contentHtml} className="mb-16" />
          <div className="hairline-border-b my-12" />
          <CommentsSection
            comments={comments}
            postId={post.id}
            allowComments={post.allowComments}
          />
        </div>
      </div>
    </div>
  );
}

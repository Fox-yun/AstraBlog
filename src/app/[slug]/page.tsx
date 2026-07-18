import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleBody from "@/components/content/ArticleBody";
import CommentsSection from "@/components/comments/CommentsSection";
import { absoluteUrl, siteConfig } from "@/config/site";
import { getPublishedPage, getPublicComments } from "@/lib/content";
import { plainTextExcerpt } from "@/lib/content-utils";

interface PublicPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return {};
  const description = page.description || plainTextExcerpt(page.contentMarkdown);
  return {
    title: page.title || "Untitled page",
    description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: page.title || "Untitled page",
      description,
      url: absoluteUrl(`/${page.slug}`),
      type: "article",
      images: [absoluteUrl("/og.png")],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title || "Untitled page",
      description,
      images: [absoluteUrl("/og.png")],
    },
  };
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  const comments = await getPublicComments(page.id);
  const authorName = page.author.profile?.displayName || page.author.name;

  return (
    <article className="max-w-3xl py-6 w-full">
      <header className="mb-12">
        <p className="text-[10px] font-mono tracking-widest text-text-muted mb-3">
          {siteConfig.wordmark} / PAGE
        </p>
        <h1 className="text-3xl md:text-4xl tracking-tight leading-tight mb-4 font-serif font-bold">
          {page.title || "Untitled page"}
        </h1>
        {page.description && (
          <p className="text-sm text-text-muted leading-relaxed">{page.description}</p>
        )}
        <p className="mt-4 text-[10px] font-mono tracking-wider text-text-muted">
          LAST UPDATED {page.updatedAt.toLocaleDateString(siteConfig.locale)} · BY {authorName}
        </p>
      </header>

      <ArticleBody html={page.contentHtml} />
      {(page.allowComments || comments.length > 0) && (
        <>
          <div className="hairline-border-b my-12" />
          <CommentsSection
            comments={comments}
            postId={page.id}
            allowComments={page.allowComments}
          />
        </>
      )}
    </article>
  );
}

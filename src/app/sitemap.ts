import type { MetadataRoute } from "next";
import { absoluteUrl, siteConfig } from "@/config/site";
import { getPublishedPostsForDiscovery, getPublicTaxonomy } from "@/lib/content";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [published, taxonomy] = await Promise.all([
    getPublishedPostsForDiscovery(),
    getPublicTaxonomy(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteConfig.url, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/notes"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/chat"), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/guestbook"), changeFrequency: "daily", priority: 0.5 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
  ];

  const contentRoutes: MetadataRoute.Sitemap = published.map((post) => ({
    url: absoluteUrl(post.type === "note" ? `/notes/${post.slug}` : `/${post.slug}`),
    lastModified: post.updatedAt,
    changeFrequency: "weekly",
    priority: post.type === "page" ? 0.7 : 0.8,
  }));

  const taxonomyRoutes: MetadataRoute.Sitemap = [
    ...taxonomy.categories.map((category) => ({
      url: absoluteUrl(`/categories/${category.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...taxonomy.tags.map((tag) => ({
      url: absoluteUrl(`/tags/${tag.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];

  return [...staticRoutes, ...contentRoutes, ...taxonomyRoutes];
}

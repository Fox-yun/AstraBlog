const configuredUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";
const configuredPostsPerPage = Number.parseInt(
  process.env.NEXT_PUBLIC_POSTS_PER_PAGE || "12",
  10,
);

function normalizeSiteUrl(value: string) {
  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

function optionalUrl(value: string | undefined) {
  if (!value) return null;

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "AstraBlog",
  wordmark: process.env.NEXT_PUBLIC_SITE_WORDMARK || "ASTRABLOG",
  ownerName: process.env.NEXT_PUBLIC_SITE_OWNER || "Astra",
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
    "Software, systems and long-form thinking.",
  secondaryDescription:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION_ZH ||
    "关于软件工程、人工智能与数字世界的持续记录。",
  url: normalizeSiteUrl(configuredUrl),
  locale: process.env.NEXT_PUBLIC_SITE_LOCALE || "en",
  language: process.env.NEXT_PUBLIC_SITE_LANGUAGE || "en-us",
  postsPerPage:
    Number.isFinite(configuredPostsPerPage) && configuredPostsPerPage > 0
      ? configuredPostsPerPage
      : 12,
  contact: {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,
    github: optionalUrl(process.env.NEXT_PUBLIC_GITHUB_URL),
    x: optionalUrl(process.env.NEXT_PUBLIC_X_URL),
  },
  navigation: [
    { href: "/notes", label: "Notes" },
    { href: "/chat", label: "Chat" },
    { href: "/bar", label: "Bar" },
    { href: "/guestbook", label: "Guestbook" },
    { href: "/about", label: "About" },
  ],
  homeLinks: [
    { href: "/notes", label: "NOTES" },
    { href: "/chat", label: "CHAT" },
    { href: "/bar", label: "BAR" },
    { href: "/guestbook", label: "GUESTBOOK" },
    { href: "/about", label: "ABOUT" },
  ],
  footerStack: ["NEON PG", "BETTER AUTH", "CLOUDFLARE R2"],
} as const;

export const reservedPageSlugs = new Set([
  "account",
  "api",
  "auth",
  "bar",
  "categories",
  "chat",
  "feed.xml",
  "guestbook",
  "notes",
  "robots.txt",
  "sitemap.xml",
  "studio",
  "tags",
]);

export function absoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.url}/`).toString();
}

export function isReservedPageSlug(slug: string) {
  return reservedPageSlugs.has(slug.toLowerCase().split("/")[0]);
}

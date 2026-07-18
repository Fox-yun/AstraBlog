import type { Metadata } from "next";
import Link from "next/link";
import { Fira_Code, Inter, Playfair_Display } from "next/font/google";
import { absoluteUrl, siteConfig } from "@/config/site";
import { getSession } from "@/lib/authorization";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.ownerName }],
  creator: siteConfig.ownerName,
  alternates: {
    types: { "application/rss+xml": absoluteUrl("/feed.xml") },
  },
  openGraph: {
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: absoluteUrl("/og.png"),
        alt: `${siteConfig.name} — ${siteConfig.description}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [absoluteUrl("/og.png")],
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessionResult = await getSession();
  const user = sessionResult?.user;
  const isAdminOrOwner = user?.role === "admin" || user?.role === "owner";

  return (
    <html
      lang={siteConfig.locale}
      className={`${inter.variable} ${playfair.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-void text-text-primary">
        <a href="#main-content" className="skip-link">
          SKIP TO CONTENT
        </a>

        <header className="hairline-border-b bg-bg-void py-5 sm:py-6">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <Link
              href="/"
              className="font-serif text-xl tracking-wider text-text-primary hover:text-accent-amber transition-strict"
            >
              {siteConfig.wordmark}
            </Link>
            <nav
              aria-label="Primary navigation"
              className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 text-sm font-sans tracking-wide"
            >
              {siteConfig.navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-text-muted hover:text-text-primary transition-strict"
                >
                  {item.label}
                </Link>
              ))}
              <span className="hidden sm:inline text-border-base" aria-hidden="true">
                |
              </span>
              {user ? (
                <>
                  {isAdminOrOwner && (
                    <Link
                      href="/studio/dashboard"
                      className="text-text-muted hover:text-text-primary transition-strict underline decoration-accent-amber underline-offset-4"
                    >
                      Studio
                    </Link>
                  )}
                  <Link
                    href="/account/profile"
                    className="text-text-muted hover:text-text-primary transition-strict"
                  >
                    Account
                  </Link>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="text-text-muted hover:text-text-primary transition-strict"
                >
                  Sign In
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main
          id="main-content"
          className="flex-1 max-w-4xl mx-auto px-5 sm:px-6 py-10 sm:py-12 w-full flex flex-col"
        >
          {children}
        </main>

        <footer className="hairline-border-t bg-bg-void py-8 text-xs text-text-muted font-mono">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              © {new Date().getFullYear()} {siteConfig.wordmark}. ALL RIGHTS RESERVED.
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {siteConfig.footerStack.map((item, index) => (
                <span key={item} className="contents">
                  {index > 0 && <span aria-hidden="true">•</span>}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

import { requireRole } from "@/lib/authorization";
import Link from "next/link";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure that the user is an admin or owner before mounting the studio
  await requireRole("admin", "owner");

  const links = [
    ["Dashboard", "/studio/dashboard"],
    ["Notes", "/studio/notes"],
    ["Chat", "/studio/chat"],
    ["Pages", "/studio/pages"],
    ["Categories", "/studio/categories"],
    ["Tags", "/studio/tags"],
    ["Media", "/studio/media"],
    ["Comments", "/studio/comments"],
  ] as const;

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[180px_1fr] gap-8 py-6">
      {/* Sidebar workspace */}
      <aside className="space-y-6 md:border-r border-border-base md:pr-6">
        <div>
          <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-4">
            STUDIO WORKSPACE
          </div>
          <nav className="flex flex-col space-y-3 text-xs font-mono tracking-wide">
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="text-text-muted hover:text-text-primary transition-strict underline underline-offset-4 decoration-1 hover:decoration-accent-amber"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main dashboard viewport */}
      <main className="flex-1 w-full overflow-hidden">{children}</main>
    </div>
  );
}

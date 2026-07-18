import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dbQuery } from "@/db";
import { profiles } from "@/db/schema/profiles";
import { eq } from "drizzle-orm";
import SignOutButton from "@/components/auth/SignOutButton";
import { getSession } from "@/lib/authorization";
import { isDatabaseConfigured } from "@/lib/content";

export const metadata: Metadata = { title: "Account" };
export const revalidate = 0;

export default async function AccountProfilePage() {
  const session = await getSession();
  if (!session?.user) redirect("/auth/login?next=/account/profile");

  const profile = isDatabaseConfigured
    ? await dbQuery.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
      })
    : null;

  const rows = [
    ["DISPLAY NAME", profile?.displayName || session.user.name],
    ["USERNAME", profile?.username || "Not configured"],
    ["EMAIL", session.user.email],
    ["ROLE", (session.user.role || "member").toUpperCase()],
    ["EMAIL STATUS", session.user.emailVerified ? "VERIFIED" : "UNVERIFIED"],
  ];

  return (
    <div className="max-w-xl py-6 w-full space-y-10">
      <header>
        <h1 className="text-3xl tracking-widest mb-4 font-serif font-light">ACCOUNT</h1>
        <p className="text-xs font-mono text-text-muted tracking-widest">
          SESSION & PROFILE
        </p>
      </header>

      <dl className="hairline-border bg-bg-surface/10 text-xs font-mono">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-6 px-4 py-3 border-b border-border-base/60 last:border-b-0"
          >
            <dt className="text-text-muted">{label}</dt>
            <dd className="text-text-primary break-all">{value}</dd>
          </div>
        ))}
      </dl>

      <SignOutButton />
    </div>
  );
}

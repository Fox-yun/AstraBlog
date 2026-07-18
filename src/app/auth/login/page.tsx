"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message || "Failed to sign in.");
      } else {
        const requestedPath = searchParams.get("next");
        const destination =
          requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
            ? requestedPath
            : "/";
        router.push(destination);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-20 font-mono text-xs">
      <div className="w-full max-w-[340px] hairline-border p-6 bg-bg-surface/10 space-y-6">
        <div>
          <h2 className="text-sm font-serif font-light tracking-widest uppercase">SIGN IN</h2>
          <p className="text-[10px] text-text-muted mt-0.5">
            ACCESS YOUR {siteConfig.wordmark} ACCOUNT
          </p>
        </div>

        {errorMsg && (
          <div className="text-accent-amber border border-accent-amber/40 p-2 bg-bg-void uppercase text-[10px]">
            ERROR: {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex flex-col">
            <label className="text-[10px] text-text-muted mb-1 uppercase tracking-wider">EMAIL ADDRESS</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@example.com"
              className="bg-bg-void border-b border-border-base py-1.5 focus:outline-none focus:border-accent-amber font-sans"
              required
            />
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] text-text-muted uppercase tracking-wider">PASSWORD</label>
              <Link href="/auth/forgot-password" className="text-[9px] text-text-muted hover:text-accent-amber transition-strict">
                [FORGOT?]
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="bg-bg-void border-b border-border-base py-1.5 focus:outline-none focus:border-accent-amber font-sans"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-center py-2.5 hairline-border bg-bg-void hover:text-accent-amber hover:border-accent-amber transition-strict font-bold uppercase tracking-wider"
          >
            {loading ? "AUTHENTICATING..." : "[SIGN IN]"}
          </button>
        </form>

        <div className="border-t border-border-base/50 pt-4 text-center text-text-muted text-[10px] space-x-1">
          <span>DON'T HAVE AN ACCOUNT?</span>
          <Link href="/auth/register" className="text-text-primary hover:text-accent-amber underline decoration-accent-amber">
            CREATE ONE
          </Link>
        </div>
      </div>
    </div>
  );
}

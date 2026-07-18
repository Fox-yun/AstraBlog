"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !username || !name || !password) return;

    // Client-side username formatting validation
    const usernameRegex = /^[a-zA-Z0-9_-]{3,24}$/;
    if (!usernameRegex.test(username)) {
      setErrorMsg("Username must be between 3 and 24 characters, and only contain letters, numbers, dashes, or underscores.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
        username,
      });

      if (error) {
        setErrorMsg(error.message || "Failed to create account.");
      } else {
        setRegistered(true);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20 font-mono text-xs text-text-muted">
        <div className="w-full max-w-[360px] hairline-border p-6 bg-bg-surface/10 space-y-4 text-center">
          <div className="text-accent-amber text-lg font-serif">✓ SUCCESS</div>
          <p className="text-text-primary uppercase tracking-wider">REGISTRATION SUCCESSFUL</p>
          <p className="leading-relaxed text-[11px] font-sans">
            We have sent a verification link to <strong className="text-text-primary">{email}</strong>.{" "}
            Please open the link to verify your account before logging in.
          </p>
          <div className="border-t border-border-base/50 pt-3">
            <Link href="/auth/login" className="text-text-primary hover:text-accent-amber underline decoration-accent-amber">
              [GO TO LOGIN]
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-16 font-mono text-xs">
      <div className="w-full max-w-[340px] hairline-border p-6 bg-bg-surface/10 space-y-6">
        <div>
          <h2 className="text-sm font-serif font-light tracking-widest uppercase">CREATE ACCOUNT</h2>
          <p className="text-[10px] text-text-muted mt-0.5">
            REGISTER FOR {siteConfig.wordmark} MEMBER PROFILE
          </p>
        </div>

        {errorMsg && (
          <div className="text-accent-amber border border-accent-amber/40 p-2 bg-bg-void uppercase text-[10px] leading-normal">
            ERROR: {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="flex flex-col">
            <label className="text-[10px] text-text-muted mb-1 uppercase tracking-wider">FULL NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alan Turing"
              className="bg-bg-void border-b border-border-base py-1.5 focus:outline-none focus:border-accent-amber font-sans"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] text-text-muted mb-1 uppercase tracking-wider">USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="e.g. turing_123"
              className="bg-bg-void border-b border-border-base py-1.5 focus:outline-none focus:border-accent-amber font-mono"
              required
            />
          </div>

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
            <label className="text-[10px] text-text-muted mb-1 uppercase tracking-wider">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 10 characters"
              className="bg-bg-void border-b border-border-base py-1.5 focus:outline-none focus:border-accent-amber font-sans"
              minLength={10}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-center py-2.5 hairline-border bg-bg-void hover:text-accent-amber hover:border-accent-amber transition-strict font-bold uppercase tracking-wider"
          >
            {loading ? "CREATING PROFILE..." : "[REGISTER]"}
          </button>
        </form>

        <div className="border-t border-border-base/50 pt-4 text-center text-text-muted text-[10px] space-x-1">
          <span>ALREADY HAVE AN ACCOUNT?</span>
          <Link href="/auth/login" className="text-text-primary hover:text-accent-amber underline decoration-accent-amber">
            SIGN IN
          </Link>
        </div>
      </div>
    </div>
  );
}

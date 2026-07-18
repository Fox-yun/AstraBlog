"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);

    try {
      // Better Auth requestPasswordReset API
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      // Silently set submitted to true without checking for "user not found" errors
      // to prevent account enumeration leakage.
      setSubmitted(true);
    } catch (err) {
      console.error("Forgot password API call failed:", err);
      // Suppress error leakage, show success screen
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20 font-mono text-xs text-text-muted">
        <div className="w-full max-w-[340px] hairline-border p-6 bg-bg-surface/10 space-y-4 text-center">
          <div className="text-accent-amber text-lg font-serif">✉️ SUBMITTED</div>
          <p className="text-text-primary uppercase tracking-wider">REQUEST COMPLETED</p>
          <p className="leading-relaxed text-[11px] font-sans">
            If an account with the email address <strong className="text-text-primary">{email}</strong> exists,{" "}
            we have sent a password reset link to it. Please check your inbox.
          </p>
          <div className="border-t border-border-base/50 pt-3">
            <Link href="/auth/login" className="text-text-primary hover:text-accent-amber underline decoration-accent-amber">
              [RETURN TO LOGIN]
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-20 font-mono text-xs">
      <div className="w-full max-w-[340px] hairline-border p-6 bg-bg-surface/10 space-y-6">
        <div>
          <h2 className="text-sm font-serif font-light tracking-widest uppercase">FORGOT PASSWORD</h2>
          <p className="text-[10px] text-text-muted mt-0.5">REQUEST A LINK TO RESET YOUR PASSWORD</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full text-center py-2.5 hairline-border bg-bg-void hover:text-accent-amber hover:border-accent-amber transition-strict font-bold uppercase tracking-wider"
          >
            {loading ? "SENDING RESET LINK..." : "[REQUEST RESET]"}
          </button>
        </form>

        <div className="border-t border-border-base/50 pt-4 text-center">
          <Link href="/auth/login" className="text-[10px] text-text-muted hover:text-accent-amber transition-strict uppercase">
            [BACK TO SIGN IN]
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    if (!token) {
      setErrorMsg("Missing or invalid password reset token.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token: token,
      });

      if (error) {
        setErrorMsg(error.message || "Failed to reset password.");
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-[340px] hairline-border p-6 bg-bg-surface/10 space-y-4 text-center">
        <div className="text-accent-amber text-lg font-serif">✓ UPDATED</div>
        <p className="text-text-primary uppercase tracking-wider">PASSWORD RESET SUCCESSFUL</p>
        <p className="leading-relaxed text-[11px] font-sans text-text-muted">
          Your account password has been successfully updated. You can now log in using your new credentials.
        </p>
        <div className="border-t border-border-base/50 pt-3">
          <Link href="/auth/login" className="text-text-primary hover:text-accent-amber underline decoration-accent-amber">
            [PROCEED TO LOGIN]
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[340px] hairline-border p-6 bg-bg-surface/10 space-y-6">
      <div>
        <h2 className="text-sm font-serif font-light tracking-widest uppercase">RESET PASSWORD</h2>
        <p className="text-[10px] text-text-muted mt-0.5">CHOOSE A NEW SECURE PASSWORD</p>
      </div>

      {errorMsg && (
        <div className="text-accent-amber border border-accent-amber/40 p-2 bg-bg-void uppercase text-[10px] leading-normal">
          ERROR: {errorMsg}
        </div>
      )}

      <form onSubmit={handleReset} className="space-y-4">
        <div className="flex flex-col">
          <label className="text-[10px] text-text-muted mb-1 uppercase tracking-wider">NEW PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 10 characters"
            className="bg-bg-void border-b border-border-base py-1.5 focus:outline-none focus:border-accent-amber font-sans"
            minLength={10}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full text-center py-2.5 hairline-border bg-bg-void hover:text-accent-amber hover:border-accent-amber transition-strict font-bold uppercase tracking-wider"
        >
          {loading ? "RESETTING..." : "[UPDATE PASSWORD]"}
        </button>
      </form>

      {!token && (
        <div className="text-accent-amber text-[10px] uppercase text-center mt-2 border border-accent-amber/30 p-2">
          CRITICAL: ACCESS TOKEN IS MISSING. RESET CANNOT BE TRIGGERED.
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-20 font-mono text-xs">
      <Suspense fallback={
        <div className="w-full max-w-[340px] hairline-border p-6 bg-bg-surface/10 text-center py-12">
          <p className="text-text-muted uppercase tracking-widest text-[10px]">LOADING SECURE SESSION...</p>
        </div>
      }>
        <ResetPasswordInner />
      </Suspense>
    </div>
  );
}

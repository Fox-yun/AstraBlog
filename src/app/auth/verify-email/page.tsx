"use client";

import { useEffect, useState, Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/config/site";

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Missing verification token.");
      setLoading(false);
      return;
    }

    authClient.verifyEmail({
      query: {
        token,
      },
    })
      .then(({ error }) => {
        if (error) {
          setErrorMsg(error.message || "Failed to verify email address.");
        } else {
          setSuccess(true);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setErrorMsg(err.message || "Verification error occurred.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="w-full max-w-[360px] hairline-border p-6 bg-bg-surface/10 space-y-4 text-center">
      {loading ? (
        <div className="space-y-3 py-6">
          <span className="inline-block w-1.5 h-1.5 bg-accent-amber animate-ping" />
          <p className="text-text-primary uppercase tracking-widest text-[10px]">VERIFYING EMAIL ADDRESS...</p>
        </div>
      ) : success ? (
        <div className="space-y-4">
          <div className="text-accent-amber text-lg font-serif">✓ VERIFIED</div>
          <p className="text-text-primary uppercase tracking-wider">EMAIL VERIFICATION SUCCESSFUL</p>
          <p className="leading-relaxed text-[11px] font-sans text-text-muted">
            Your email address has been successfully verified. You can now access your {siteConfig.name} profile and post comments.
          </p>
          <div className="border-t border-border-base/50 pt-3">
            <Link href="/auth/login" className="text-text-primary hover:text-accent-amber underline decoration-accent-amber">
              [PROCEED TO LOGIN]
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-accent-amber text-lg font-serif">✗ FAILED</div>
          <p className="text-text-primary uppercase tracking-wider">VERIFICATION FAILED</p>
          <p className="leading-relaxed text-[11px] font-sans text-text-muted">
            {errorMsg}
          </p>
          <div className="border-t border-border-base/50 pt-3">
            <Link href="/auth/login" className="text-text-primary hover:text-accent-amber underline decoration-accent-amber">
              [GO TO SIGN IN]
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-20 font-mono text-xs">
      <Suspense fallback={
        <div className="w-full max-w-[360px] hairline-border p-6 bg-bg-surface/10 text-center py-12">
          <p className="text-text-muted uppercase tracking-widest text-[10px]">LOADING PARAMS...</p>
        </div>
      }>
        <VerifyEmailInner />
      </Suspense>
    </div>
  );
}

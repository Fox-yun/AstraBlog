"use client";

import { useState, useTransition } from "react";
import { submitComment } from "@/actions/comments";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

interface CommentFormProps {
  postId?: string;
  isGuestbook?: boolean;
  parentId?: string;
  onSuccess?: () => void;
}

export default function CommentForm({ postId, isGuestbook, parentId, onSuccess }: CommentFormProps) {
  const { data: session } = authClient.useSession();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmitting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 1000) {
      setError("Content must be between 2 and 1000 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitComment({
          postId,
          isGuestbook,
          contentMarkdown: trimmed,
          parentId,
        });

        if (res.success) {
          setContent("");
          if (onSuccess) onSuccess();
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      }
    });
  };

  if (!session?.user) {
    return (
      <div className="hairline-border p-4 bg-bg-surface/50 text-xs font-mono text-text-muted text-center tracking-wide">
        Please{" "}
        <Link href="/auth/login" className="text-text-primary underline hover:text-accent-amber transition-strict">
          Sign In
        </Link>{" "}
        with a verified account to write a comment.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitting} className="space-y-4">
      <div className="relative">
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={parentId ? "Write a reply..." : "Write a comment..."}
          disabled={isPending}
          className="w-full text-sm py-2 px-0 bg-transparent border-0 border-b border-border-base focus:border-accent-amber focus:ring-0 focus:outline-none resize-none font-sans"
        />
        {content.length > 0 && (
          <span className="absolute bottom-2 right-0 text-[10px] font-mono text-text-muted">
            {content.length} / 1000
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs font-mono text-text-primary underline decoration-accent-amber decoration-2">
          ERROR: {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="text-xs font-mono uppercase tracking-widest disabled:opacity-50 transition-strict"
        >
          {isPending ? "SUBMITTING..." : parentId ? "SUBMIT REPLY" : "SUBMIT COMMENT"}
        </button>
      </div>
    </form>
  );
}

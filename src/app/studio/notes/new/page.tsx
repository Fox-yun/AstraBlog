"use client";

import { useEffect, useTransition, useState } from "react";
import { createPost } from "@/actions/posts";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewPostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = (searchParams.get("type") || "note") as "note" | "chat" | "page";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        const timestamp = Date.now();
        const res = await createPost({
          type,
          title: `Untitled Draft ${new Date().toLocaleDateString()}`,
          slug: `draft-${timestamp}`,
          contentMarkdown: type === "chat" ? "Write a short thought..." : "# Untitled Draft\n\nWrite content here...",
        });

        if (res.success && res.post) {
          router.replace(`/studio/notes/${res.post.id}/edit`);
        }
      } catch (err: any) {
        console.error("Failed to create draft:", err);
        setError(err.message || "Failed to create new draft post.");
      }
    });
  }, [type, router]);

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-24 font-mono text-xs text-text-muted space-y-4">
      {error ? (
        <div className="space-y-4 text-center">
          <p className="text-text-primary underline decoration-accent-amber decoration-2 uppercase">
            ERROR: {error}
          </p>
          <button
            onClick={() => router.push("/studio/notes")}
            className="text-text-primary hover:text-accent-amber tracking-widest uppercase transition-strict"
          >
            [BACK TO LIST]
          </button>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <span className="inline-block w-1.5 h-1.5 bg-accent-amber animate-ping" />
          <span>CREATING NEW {type.toUpperCase()} DRAFT...</span>
        </div>
      )}
    </div>
  );
}

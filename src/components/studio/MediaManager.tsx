"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  status: "pending" | "ready" | "orphaned" | "deleted";
  createdAt: string;
  publicUrl: string | null;
  objectKey: string;
}

function fileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function imageDimensions(file: File) {
  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve({});
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

export default function MediaManager({ items }: { items: MediaItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setMessage("Requesting upload slot...");

    try {
      const presignResponse = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          type: "note",
        }),
      });
      const presign = await presignResponse.json();
      if (!presignResponse.ok) throw new Error(presign.error || "Could not prepare upload.");

      setMessage("Uploading image...");
      const uploadResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("Storage rejected the upload.");

      const dimensions = await imageDimensions(file);
      setMessage("Verifying upload...");
      const completeResponse = await fetch("/api/media/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: presign.mediaId,
          altText: altText.trim() || file.name,
          ...dimensions,
        }),
      });
      const complete = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(complete.error || "Could not verify upload.");

      setStatus("done");
      setMessage("Upload complete.");
      setFile(null);
      setAltText("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function copyMarkdown(item: MediaItem) {
    if (!item.publicUrl) {
      setStatus("error");
      setMessage("Set R2_PUBLIC_BASE_URL before copying public Markdown URLs.");
      return;
    }
    await navigator.clipboard.writeText(
      `![${item.altText || item.filename}](${item.publicUrl})`,
    );
    setStatus("done");
    setMessage(`Copied Markdown for ${item.filename}.`);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={upload} className="hairline-border p-4 bg-bg-surface/10 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="flex flex-col text-[10px] font-mono tracking-widest text-text-muted">
            IMAGE FILE · JPEG / PNG / WEBP / AVIF · MAX 10 MB
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-1 text-xs"
            />
          </label>
          <label className="flex flex-col text-[10px] font-mono tracking-widest text-text-muted">
            ALT TEXT
            <input
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="Describe the image"
              className="mt-1 text-xs font-sans"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={!file || status === "uploading"}>
            {status === "uploading" ? "[UPLOADING...]" : "[UPLOAD IMAGE]"}
          </button>
          {message && (
            <p
              role="status"
              className={`text-[10px] font-mono tracking-wider ${
                status === "error" ? "text-accent-amber" : "text-text-muted"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </form>

      <div className="hairline-border overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-border-base bg-bg-surface/20 text-[10px] text-text-muted tracking-wider">
              <th className="p-3">FILE</th>
              <th className="p-3">STATUS</th>
              <th className="p-3">SIZE</th>
              <th className="p-3">CREATED</th>
              <th className="p-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/50">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-text-muted">
                  No media uploaded yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3 max-w-[260px]">
                    <div className="truncate text-text-primary">{item.filename}</div>
                    <div className="truncate text-[9px] text-text-muted mt-1">{item.objectKey}</div>
                  </td>
                  <td className="p-3 uppercase">{item.status}</td>
                  <td className="p-3 text-text-muted">{fileSize(item.sizeBytes)}</td>
                  <td className="p-3 text-text-muted">
                    {new Date(item.createdAt).toLocaleDateString("en-US")}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => copyMarkdown(item)}
                      disabled={item.status !== "ready"}
                      className="border-0 p-0 text-[10px]"
                    >
                      [COPY MARKDOWN]
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

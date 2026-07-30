"use client";

import { useId, useRef, useState } from "react";
import { uploadImage, type UploadImageResource } from "@/lib/upload-image";

interface MarkdownImageUploadProps {
  resourceType: Extract<UploadImageResource, "note" | "chat" | "page">;
  onInsert: (markdown: string) => void;
}

function escapeMarkdownAltText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\r?\n/g, " ");
}

export default function MarkdownImageUpload({
  resourceType,
  onInsert,
}: MarkdownImageUploadProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  function resetSelection() {
    setFile(null);
    setAltText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file || status === "uploading") return;

    setStatus("uploading");
    setMessage("Requesting upload slot...");

    try {
      const uploaded = await uploadImage({
        file,
        altText,
        resourceType,
        onProgress: setMessage,
      });
      const markdown = `![${escapeMarkdownAltText(uploaded.altText)}](${uploaded.publicUrl})`;
      onInsert(markdown);
      resetSelection();
      setIsOpen(false);
      setStatus("done");
      setMessage("Image uploaded and inserted.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    }
  }

  return (
    <div className="mb-2 text-[10px] font-mono">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => {
            setIsOpen((current) => !current);
            setMessage("");
            setStatus("idle");
          }}
          className="px-2.5 py-1 text-[10px] tracking-wider uppercase"
        >
          {isOpen ? "[CLOSE IMAGE UPLOAD]" : "[INSERT IMAGE]"}
        </button>
        {message && (
          <p
            role={status === "error" ? "alert" : "status"}
            className={status === "error" ? "text-accent-amber" : "text-text-muted"}
          >
            {message}
          </p>
        )}
      </div>

      {isOpen && (
        <div className="mt-3 hairline-border bg-bg-surface/10 p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label
              htmlFor={fileInputId}
              className="min-w-0 flex flex-col tracking-widest text-text-muted"
            >
              IMAGE / JPEG, PNG, WEBP, AVIF / MAX 10 MB
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setFile(selected);
                  if (selected && !altText) {
                    setAltText(selected.name.replace(/\.[^.]+$/, ""));
                  }
                  setMessage("");
                  setStatus("idle");
                }}
                className="mt-1 w-full min-w-0 text-xs"
              />
            </label>

            <label className="min-w-0 flex flex-col tracking-widest text-text-muted">
              ALT TEXT
              <input
                value={altText}
                maxLength={160}
                onChange={(event) => setAltText(event.target.value)}
                placeholder="Describe the image"
                className="mt-1 w-full min-w-0 box-border text-xs font-sans"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!file || status === "uploading"}
              onClick={handleUpload}
              className="px-3 py-1.5 text-[10px] tracking-wider uppercase disabled:opacity-50"
            >
              {status === "uploading" ? "[UPLOADING...]" : "[UPLOAD & INSERT]"}
            </button>
            {file && (
              <span className="max-w-full truncate text-text-muted">
                {file.name} / {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { updatePost, renderMarkdown, getPostRevision } from "@/actions/posts";
import CodeMirrorEditor from "../editor/CodeMirrorEditor";
import { useRouter } from "next/navigation";

interface VersionItem {
  id: string;
  versionNumber: number;
  title: string | null;
  description: string | null;
  contentMarkdown: string;
  createdAt: Date;
}

interface NoteEditorProps {
  post: {
    id: string;
    type: "note" | "chat" | "page";
    title: string | null;
    slug: string;
    description: string | null;
    contentMarkdown: string;
    categoryId: string | null;
    status: "draft" | "scheduled" | "published" | "archived";
    allowComments: boolean;
    isFeatured: boolean;
    isPinned: boolean;
    scheduledAt: Date | null;
    updatedAt: Date;
    revision: number;
  };
  categories: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  initialTagIds: string[];
  versions: VersionItem[];
}

type SaveStatusType = "CLEAN" | "UNSAVED" | "SAVING" | "SAVED" | "OFFLINE" | "CONFLICT" | "SAVE_FAILED";

export default function NoteEditor({
  post,
  categories,
  tags,
  initialTagIds,
  versions,
}: NoteEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState(post.title || "");
  const [slug, setSlug] = useState(post.slug || "");
  const [description, setDescription] = useState(post.description || "");
  const [contentMarkdown, setContentMarkdown] = useState(post.contentMarkdown);
  const [categoryId, setCategoryId] = useState(post.categoryId || "");
  const [selectedTagIds, setSelectedTagIds] = useState(initialTagIds);
  const [status, setStatus] = useState(post.status);
  const [scheduledAt, setScheduledAt] = useState(
    post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : ""
  );
  const [allowComments, setAllowComments] = useState(post.allowComments);
  const [isFeatured, setIsFeatured] = useState(post.isFeatured);
  const [isPinned, setIsPinned] = useState(post.isPinned);

  // Concurrency and Saved Indicators
  const [revision, setRevision] = useState(post.revision);
  const [saveStatus, setSaveStatus] = useState<SaveStatusType>("CLEAN");
  const [lastSavedTime, setLastSavedTime] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Markdown Preview State
  const [htmlPreview, setHtmlPreview] = useState("");

  // Refs for tracking changes
  const hasChangesRef = useRef(false);
  const saveSequenceRef = useRef(0);
  const formStateRef = useRef({
    title,
    slug,
    description,
    contentMarkdown,
    categoryId,
    selectedTagIds,
    status,
    scheduledAt,
    allowComments,
    isFeatured,
    isPinned,
  });

  // Update tracking ref on state changes
  useEffect(() => {
    formStateRef.current = {
      title,
      slug,
      description,
      contentMarkdown,
      categoryId,
      selectedTagIds,
      status,
      scheduledAt,
      allowComments,
      isFeatured,
      isPinned,
    };
  }, [
    title,
    slug,
    description,
    contentMarkdown,
    categoryId,
    selectedTagIds,
    status,
    scheduledAt,
    allowComments,
    isFeatured,
    isPinned,
  ]);

  // Track initial render to ignore setting unsaved on mount
  const isFirstRender = useRef(true);

  // Set unsaved state when any field changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus("UNSAVED");
    hasChangesRef.current = true;
  }, [title, slug, description, contentMarkdown, categoryId, selectedTagIds, status, scheduledAt, allowComments, isFeatured, isPinned]);

  // Debounced Markdown compilation preview
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const html = await renderMarkdown(contentMarkdown);
        setHtmlPreview(html);
      } catch (err) {
        console.error("Preview render failed:", err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [contentMarkdown]);

  // Actual Save Invocation Action
  const triggerSave = async (isManual = false) => {
    if (!hasChangesRef.current && !isManual) return;
    setSaveStatus("SAVING");
    setErrorMsg(null);

    const data = formStateRef.current;
    const currentSeq = ++saveSequenceRef.current;

    try {
      // Check offline capability
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        setSaveStatus("OFFLINE");
        return;
      }

      const res = await updatePost(post.id, {
        title: data.title,
        slug: data.slug,
        description: data.description,
        contentMarkdown: data.contentMarkdown,
        categoryId: data.categoryId || undefined,
        tagIds: data.selectedTagIds,
        status: data.status,
        allowComments: data.allowComments,
        isFeatured: data.isFeatured,
        isPinned: data.isPinned,
        scheduledAt: data.status === "scheduled" ? data.scheduledAt : undefined,
        clientRevision: revision,
        isManualSave: isManual,
      });

      // Ignore outdated saves
      if (currentSeq !== saveSequenceRef.current) {
        return;
      }

      if (res.success && res.post) {
        setRevision(res.post.revision);
        setSaveStatus("SAVED");
        const now = new Date();
        setLastSavedTime(
          now.toLocaleTimeString("en-US", { hour12: false })
        );
        hasChangesRef.current = false;
        router.refresh();
      } else if (res.errorCode === "EDIT_CONFLICT") {
        setSaveStatus("CONFLICT");
      } else {
        setSaveStatus("SAVE_FAILED");
        setErrorMsg("Failed to save changes.");
      }
    } catch (err: any) {
      console.error(err);
      if (currentSeq === saveSequenceRef.current) {
        setSaveStatus("SAVE_FAILED");
        setErrorMsg(err.message || "Auto-save failed.");
      }
    }
  };

  // Auto-save timer: 2 seconds of inactivity
  useEffect(() => {
    if (saveStatus !== "UNSAVED") return;

    const saveTimer = setTimeout(() => {
      triggerSave(false);
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [saveStatus]);

  // Auto-save on visibility change (Page Hide / Blur)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && hasChangesRef.current) {
        triggerSave(false);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        triggerSave(false);
        e.preventDefault();
        e.returnValue = "";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [revision]);

  // Restore past version handler
  const handleRestoreVersion = (version: VersionItem) => {
    if (!confirm(`Restore note to Version ${version.versionNumber}? Unsaved changes will be lost.`)) return;

    setTitle(version.title || "");
    setDescription(version.description || "");
    setContentMarkdown(version.contentMarkdown);

    // Set changes trigger
    hasChangesRef.current = true;
    setSaveStatus("UNSAVED");

    // Save immediately
    setTimeout(() => triggerSave(false), 100);
  };

  return (
    <div className="space-y-6">
      {/* Editor Status Header */}
      <div className="flex justify-between items-center border-b border-border-base pb-4">
        <div>
          <h2 className="text-lg font-serif font-light uppercase">
            EDIT {post.type}: {title || "Untitled"}
          </h2>
          <div className="text-[10px] font-mono tracking-widest text-text-muted mt-1 uppercase flex items-center space-x-3">
            <span>ID: {post.id}</span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <span
                className={`inline-block w-1.5 h-1.5 ${
                  saveStatus === "SAVED"
                    ? "bg-text-primary"
                    : saveStatus === "SAVING"
                    ? "bg-accent-amber animate-pulse"
                    : "bg-accent-amber"
                }`}
              />
              <span>
                {saveStatus} {lastSavedTime && `AT ${lastSavedTime}`}
              </span>
            </span>
          </div>
        </div>
        <div className="flex space-x-4 items-center">
          <button
            onClick={() => triggerSave(true)}
            className="text-xs font-mono tracking-wider uppercase transition-strict text-text-primary hover:text-accent-amber hairline-border px-3 py-1 bg-bg-void"
          >
            [SAVE VERSION]
          </button>
          <button
            onClick={() => router.push("/studio/notes")}
            className="text-xs font-mono tracking-wider uppercase transition-strict text-text-muted hover:text-text-primary border-0 p-0"
          >
            [Exit]
          </button>
        </div>
      </div>

      {saveStatus === "CONFLICT" && (
        <div className="hairline-border p-4 bg-bg-surface text-xs font-mono text-text-primary uppercase border-l-2 border-l-accent-amber space-y-3">
          <p className="font-bold text-accent-amber">EDIT_CONFLICT: THE REMOTELY STORED DOCUMENT HAS BEEN MODIFIED BY ANOTHER EDITOR.</p>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                if (confirm("Discard all your unsaved edits and reload the latest remote content?")) {
                  window.location.reload();
                }
              }}
              className="px-3 py-1 hairline-border bg-bg-void hover:text-accent-amber transition-strict"
            >
              [RELOAD REMOTE]
            </button>
            <button
              onClick={async () => {
                if (confirm("WARNING: Overwriting remote changes will discard edits made by others. Are you absolutely sure?")) {
                  try {
                    const latestRev = await getPostRevision(post.id);
                    setRevision(latestRev);
                    setTimeout(() => triggerSave(true), 100);
                  } catch (err: any) {
                    alert(err.message || "Failed to fetch remote revision");
                  }
                }
              }}
              className="px-3 py-1 hairline-border bg-bg-void hover:text-accent-amber transition-strict text-accent-amber"
            >
              [OVERWRITE REMOTE]
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="hairline-border p-3 bg-bg-surface text-xs font-mono text-text-primary uppercase border-l-2 border-l-accent-amber">
          SAVE ERROR: {errorMsg}
        </div>
      )}

      {/* Editor Work Surface grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">

        {/* Left Side: Editor Pane */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1">
                Post Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title..."
                className="text-sm font-sans"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1">
                Post Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="slug-path..."
                className="text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1">
              Short Description / Summary
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a brief excerpt..."
              className="text-sm font-sans resize-none"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-2">
              Markdown Body
            </label>
            <CodeMirrorEditor
              value={contentMarkdown}
              onChange={setContentMarkdown}
              onSave={triggerSave}
            />
          </div>
        </div>

        {/* Right Side: Options & Live Preview & Revisions */}
        <div className="space-y-8">

          {/* Metadata Controls */}
          <div className="hairline-border p-4 bg-bg-surface/20 space-y-4">
            <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase border-b border-border-base pb-2">
              SETTINGS & PUBLISHING
            </div>

            <div className="flex flex-col text-xs font-mono">
              <label className="text-[10px] text-text-muted tracking-wider mb-1">CATEGORY</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="bg-bg-void border-b border-border-base py-1 text-xs focus:outline-none"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-2 text-xs font-mono">
              <legend className="text-[10px] text-text-muted tracking-wider mb-1">TAGS</legend>
              {tags.length === 0 ? (
                <p className="text-[10px] text-text-muted">
                  Create tags in Studio → Tags.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={(event) => {
                          setSelectedTagIds((current) =>
                            event.target.checked
                              ? [...current, tag.id]
                              : current.filter((id) => id !== tag.id),
                          );
                        }}
                      />
                      <span>{tag.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="flex flex-col text-xs font-mono">
              <label className="text-[10px] text-text-muted tracking-wider mb-1">STATUS</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="bg-bg-void border-b border-border-base py-1 text-xs focus:outline-none"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {status === "scheduled" && (
              <div className="flex flex-col text-xs font-mono">
                <label className="text-[10px] text-text-muted tracking-wider mb-1">
                  SCHEDULED RELEASE DATE
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="bg-bg-void border-b border-border-base py-1 text-xs text-text-primary"
                />
              </div>
            )}

            <div className="space-y-2 text-xs font-mono">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="rounded-none border-border-base text-accent-amber focus:ring-0"
                />
                <span>Allow comments</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded-none border-border-base text-accent-amber focus:ring-0"
                />
                <span>Featured post</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded-none border-border-base text-accent-amber focus:ring-0"
                />
                <span>Pin to top</span>
              </label>
            </div>
          </div>

          {/* Revisions History Logs */}
          <div className="hairline-border p-4 bg-bg-surface/20">
            <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase border-b border-border-base pb-2 mb-3">
              REVISION HISTORY ({versions.length})
            </div>
            {versions.length === 0 ? (
              <p className="text-[10px] font-mono text-text-muted">No revisions recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-[150px] overflow-y-auto text-[10px] font-mono tracking-wide pr-1">
                {versions.map((ver) => {
                  const verTime = new Date(ver.createdAt).toLocaleDateString("en-US", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div key={ver.id} className="flex justify-between items-center py-1 border-b border-border-base/30">
                      <div>
                        <span className="text-text-primary font-bold">V{ver.versionNumber}</span>
                        <span className="text-text-muted ml-2">{verTime}</span>
                      </div>
                      <button
                        onClick={() => handleRestoreVersion(ver)}
                        className="text-accent-amber hover:underline border-0 p-0 text-[10px] uppercase font-bold"
                      >
                        [Restore]
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Split Screen Live Preview */}
          <div className="hairline-border p-4 bg-bg-surface/10 space-y-4">
            <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase border-b border-border-base pb-2">
              LIVE PREVIEW PARITY
            </div>
            <div
              className="prose prose-invert max-w-none text-xs leading-relaxed font-sans max-h-[300px] overflow-y-auto prose-headings:font-serif prose-h2:text-sm prose-h3:text-xs prose-p:mb-3 prose-blockquote:border-l-accent-amber"
              dangerouslySetInnerHTML={{ __html: htmlPreview || "<em>Type in the editor to see preview.</em>" }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}

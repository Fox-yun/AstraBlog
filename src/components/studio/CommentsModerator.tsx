"use client";

import { useTransition, useState } from "react";
import { moderateComment } from "@/actions/comments";
import { banUser, unbanUser } from "@/actions/users";
import { useRouter } from "next/navigation";

interface CommentItem {
  id: string;
  isGuestbook: boolean;
  contentMarkdown: string;
  status: "pending" | "visible" | "hidden" | "deleted" | "spam";
  createdAt: Date;
  author: {
    id: string;
    name: string;
    email: string;
    banned: boolean;
    profile: {
      username: string;
      displayName: string;
    } | null;
  };
  post: {
    title: string | null;
    slug: string;
  } | null;
  reports: Array<{
    id: string;
    reason: string;
    details: string | null;
    reporter: {
      name: string;
      email: string;
    };
  }>;
}

interface CommentsModeratorProps {
  initialComments: CommentItem[];
}

export default function CommentsModerator({ initialComments }: CommentsModeratorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleModerate = (commentId: string, status: any) => {
    if (status === "deleted" && !confirm("Are you sure you want to delete this comment?")) return;

    startTransition(async () => {
      try {
        const res = await moderateComment(commentId, status);
        if (res.success) {
          router.refresh();
        }
      } catch (err: any) {
        alert(err.message || "Failed to update comment status");
      }
    });
  };

  const handleUserBanToggle = (userId: string, isBanned: boolean) => {
    const actionText = isBanned ? "unban" : "ban";
    if (!confirm(`Are you sure you want to ${actionText} this user?`)) return;

    startTransition(async () => {
      try {
        if (isBanned) {
          await unbanUser(userId);
        } else {
          const reason = prompt("Enter ban reason:") || "Violating community standards";
          await banUser(userId, reason);
        }
        router.refresh();
      } catch (err: any) {
        alert(err.message || `Failed to ${actionText} user.`);
      }
    });
  };

  return (
    <div className="space-y-6 w-full font-mono text-xs">
      <div>
        <h2 className="text-sm font-serif font-light tracking-widest uppercase">COMMENTS MODERATION</h2>
        <p className="text-[10px] text-text-muted mt-0.5">REVIEW AND MODERATE SYSTEM COMMENTS & GUESTBOOK MESSAGES</p>
      </div>

      <div className="border border-border-base bg-bg-surface/10 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-base bg-bg-surface/20 text-[10px] text-text-muted uppercase tracking-wider">
              <th className="p-3">Comment Text</th>
              <th className="p-3">Author</th>
              <th className="p-3">Target</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base/50">
            {initialComments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-text-muted">
                  No comments have been posted yet.
                </td>
              </tr>
            ) : (
              initialComments.map((item) => {
                const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const isUserBanned = item.author.banned;
                const reportsCount = item.reports?.length || 0;

                return (
                  <tr key={item.id} className="hover:bg-bg-surface/10 transition-strict align-top">
                    <td className="p-3 font-sans max-w-xs">
                      <div className="text-text-primary break-words whitespace-pre-wrap">{item.contentMarkdown}</div>
                      {reportsCount > 0 && (
                        <div className="mt-2 p-2 border border-accent-amber/30 bg-accent-amber/5 font-mono text-[9px] uppercase text-accent-amber leading-normal space-y-1">
                          <p className="font-bold">⚠️ REPORTS SUBMITTED ({reportsCount}):</p>
                          {item.reports.map((r) => (
                            <div key={r.id} className="border-t border-accent-amber/20 pt-1">
                              <strong>REASON:</strong> {r.reason} {r.details && `(${r.details})`} — <em>BY: {r.reporter.name}</em>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-sans font-medium text-text-primary">
                        {item.author.profile?.displayName || item.author.name}
                        {isUserBanned && (
                          <span className="ml-2 px-1 text-[8px] bg-accent-amber/10 border border-accent-amber/30 text-accent-amber font-mono tracking-wider">
                            BANNED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-text-muted">@{item.author.profile?.username || "unknown"}</div>
                      <div className="text-[9px] text-text-muted font-sans mt-1">
                        <button
                          onClick={() => handleUserBanToggle(item.author.id, isUserBanned)}
                          disabled={isPending}
                          className="hover:text-accent-amber underline p-0 border-0 bg-transparent text-[9px] uppercase cursor-pointer"
                        >
                          [{isUserBanned ? "Unban Account" : "Ban Account"}]
                        </button>
                      </div>
                    </td>
                    <td className="p-3 uppercase">
                      {item.isGuestbook ? (
                        <span className="text-text-muted">Guestbook</span>
                      ) : (
                        <span className="max-w-[120px] block truncate font-sans text-text-primary">
                          {item.post?.title || "Post"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 uppercase">
                      <span
                        className={
                          item.status === "visible"
                            ? "text-text-primary underline decoration-accent-amber decoration-1"
                            : item.status === "pending"
                            ? "text-accent-amber font-semibold"
                            : item.status === "spam"
                            ? "opacity-50 text-text-muted line-through"
                            : "opacity-40 text-text-muted"
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-text-muted">{dateStr}</td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      {item.status !== "visible" && (
                        <button
                          onClick={() => handleModerate(item.id, "visible")}
                          disabled={isPending}
                          className="hover:text-accent-amber transition-strict border-0 p-0 text-[10px]"
                        >
                          [APPROVE]
                        </button>
                      )}
                      {item.status !== "hidden" && item.status !== "deleted" && (
                        <button
                          onClick={() => handleModerate(item.id, "hidden")}
                          disabled={isPending}
                          className="hover:text-accent-amber transition-strict border-0 p-0 text-[10px]"
                        >
                          [HIDE]
                        </button>
                      )}
                      {item.status !== "spam" && (
                        <button
                          onClick={() => handleModerate(item.id, "spam")}
                          disabled={isPending}
                          className="hover:text-accent-amber transition-strict border-0 p-0 text-[10px]"
                        >
                          [SPAM]
                        </button>
                      )}
                      {item.status !== "deleted" && (
                        <button
                          onClick={() => handleModerate(item.id, "deleted")}
                          disabled={isPending}
                          className="hover:text-accent-amber transition-strict border-0 p-0 text-[10px]"
                        >
                          [DELETE]
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

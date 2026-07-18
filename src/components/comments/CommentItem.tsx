"use client";

import { useState, useTransition } from "react";
import { deleteComment } from "@/actions/comments";
import { authClient } from "@/lib/auth-client";
import CommentForm from "./CommentForm";

interface CommentItemProps {
  comment: {
    id: string;
    postId: string | null;
    contentHtml: string;
    status: "pending" | "visible" | "hidden" | "deleted" | "spam";
    createdAt: Date;
    author: {
      id: string;
      name: string;
      image: string | null;
      profile: {
        username: string;
        displayName: string;
        avatarKey: string | null;
      } | null;
    };
  };
  replies?: React.ReactNode;
  postId?: string;
  isGuestbook?: boolean;
}

export default function CommentItem({ comment, replies, postId, isGuestbook }: CommentItemProps) {
  const { data: session } = authClient.useSession();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const isAuthor = session?.user?.id === comment.author.id;
  const isAdminOrOwner = session?.user?.role === "admin" || session?.user?.role === "owner";
  const canDelete = (isAuthor || isAdminOrOwner) && comment.status === "visible";

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    startDeleteTransition(async () => {
      try {
        await deleteComment(comment.id);
      } catch (err: any) {
        alert(err.message || "Failed to delete comment");
      }
    });
  };

  const formattedDate = new Date(comment.createdAt).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4">
      {/* Author and Date metadata */}
      <div className="flex justify-between items-start text-xs font-mono text-text-muted">
        <div className="flex items-center space-x-2">
          <span className="text-text-primary font-sans font-medium">
            {comment.author.profile?.displayName || comment.author.name}
          </span>
          <span>@{comment.author.profile?.username || "unknown"}</span>
        </div>
        <div className="flex items-center space-x-3">
          <span>{formattedDate}</span>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-text-primary hover:text-accent-amber transition-strict border-0 p-0 text-[10px] uppercase tracking-wider"
            >
              [Delete]
            </button>
          )}
        </div>
      </div>

      {/* Body content */}
      <div className="text-sm font-sans tracking-wide text-text-primary pl-1">
        {comment.status === "deleted" ? (
          <em className="text-text-muted">该留言已由作者删除。</em>
        ) : (
          <div
            className="prose prose-invert max-w-none prose-sm"
            dangerouslySetInnerHTML={{ __html: comment.contentHtml }}
          />
        )}
      </div>

      {/* Reply toggler and sub-form */}
      {session?.user && comment.status === "visible" && (
        <div className="pl-1">
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="text-[10px] font-mono text-text-muted uppercase tracking-wider hover:text-accent-amber border-0 p-0"
          >
            {showReplyForm ? "[Cancel]" : "[Reply]"}
          </button>
        </div>
      )}

      {showReplyForm && (
        <div className="pl-4 border-l border-border-base mt-2">
          <CommentForm
            postId={postId}
            isGuestbook={isGuestbook}
            parentId={comment.id}
            onSuccess={() => setShowReplyForm(false)}
          />
        </div>
      )}

      {/* Sub-replies container */}
      {replies && <div className="pl-6 border-l border-border-base/50 space-y-6 mt-4">{replies}</div>}
    </div>
  );
}

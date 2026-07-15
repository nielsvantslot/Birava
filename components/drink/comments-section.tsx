"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createComment, deleteComment } from "@/lib/controllers/socialController";
import { showToast } from "@/components/ui/toast-pill";
import { timeAgo } from "@/lib/dates";
import type { CommentDTO } from "@/lib/dtos";

/** The session detail page's comment thread: list + composer. */
export function CommentsSection({
  sessionId,
  tz,
  currentUserId,
  initial,
}: {
  sessionId: string;
  tz: string;
  currentUserId: string;
  initial: CommentDTO[];
}) {
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const sectionRef = useRef<HTMLDivElement>(null);

  // Next's client-side <Link> navigation doesn't reliably scroll to a
  // hash on a route change (only a hard navigation does it natively) —
  // scroll explicitly once this section has mounted.
  useEffect(() => {
    if (window.location.hash !== "#comments") return;
    const id = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await createComment({ sessionId, body: trimmed });
      if (result.error || !result.comment) {
        showToast(result.error ?? "Failed to comment");
        return;
      }
      setComments((c) => [...c, result.comment!]);
      setBody("");
    });
  };

  const handleDelete = (commentId: string) => {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== commentId));
    startTransition(async () => {
      const result = await deleteComment({ commentId });
      if (result.error) {
        setComments(prev);
        showToast(result.error);
      }
    });
  };

  return (
    <div id="comments" className="comments" ref={sectionRef}>
      <div className="h-row" style={{ padding: "12px 16px 2px", marginBottom: 0 }}>
        <h3>Comments</h3>
        <span
          style={{
            fontSize: 13,
            color: "var(--ink-dim)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {comments.length}
        </span>
      </div>

      {comments.length > 0 && (
        <div className="comment-list">
          {comments.map((c) => (
            <div className="comment-row" key={c.id}>
              <Link className="avatar" href={`/profile/${c.username}`}>
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt={c.username} />
                ) : (
                  c.username.slice(0, 2).toUpperCase()
                )}
              </Link>
              <div className="grow">
                <div className="comment-meta">
                  <Link href={`/profile/${c.username}`}>
                    <b>{c.username}</b>
                  </Link>
                  <span>{timeAgo(new Date(c.createdAt), tz)}</span>
                </div>
                <p className="comment-body">{c.body}</p>
              </div>
              {c.userId === currentUserId && (
                <button
                  className="comment-delete"
                  onClick={() => handleDelete(c.id)}
                  aria-label="Delete comment"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment"
          maxLength={500}
          aria-label="Add a comment"
        />
        <button type="submit" disabled={isPending || !body.trim()}>
          Post
        </button>
      </form>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Loader2, Send, Trash2, X } from "lucide-react";
import { useAuthStore } from "../../context/authStore";
import { useNavigate } from "react-router-dom";
import {
  commentReel,
  deleteOwnReelComment,
  listReelComments,
} from "../../services/reelService";

function formatTime(value) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ReelCommentDrawer({ reel, open, onClose, onCountChange }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!open || !reel?._id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await listReelComments(reel._id, { page: 1, limit: 20 });
        if (!cancelled) {
          setComments(data.comments || []);
          setPage(1);
          setHasMore((data.pagination?.pages || 1) > 1);
        }
      } catch {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, reel?._id]);

  async function loadMore() {
    if (!reel?._id || !hasMore) return;
    const nextPage = page + 1;
    const data = await listReelComments(reel._id, { page: nextPage, limit: 20 });
    setComments((current) => [...current, ...(data.comments || [])]);
    setPage(nextPage);
    setHasMore(nextPage < (data.pagination?.pages || 1));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!text.trim() || !reel?._id) return;
    setSubmitting(true);
    try {
      await commentReel(reel._id, {
        comment: text.trim(),
        parentCommentId: replyTo?._id || null,
      });
      const data = await listReelComments(reel._id, { page: 1, limit: 20 });
      setComments(data.comments || []);
      setText("");
      setReplyTo(null);
      onCountChange?.((reel.commentsCount || 0) + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId) {
    if (!reel?._id) return;
    await deleteOwnReelComment(reel._id, commentId);
    setComments((current) =>
      current
        .map((item) =>
          item._id === commentId
            ? null
            : {
                ...item,
                replies: (item.replies || []).filter((reply) => reply._id !== commentId),
              }
        )
        .filter(Boolean)
    );
    onCountChange?.(Math.max(0, (reel.commentsCount || 1) - 1));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <Motion.button
            type="button"
            aria-label="Close comments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          />
          <Motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[81] mx-auto flex max-h-[78dvh] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[400px] md:rounded-none md:border-l md:border-t-0"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-white">Comments</p>
                <p className="text-xs text-zinc-400">{reel?.commentsCount || 0} comments</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-300 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                </div>
              ) : null}
              {!loading && !comments.length ? (
                <p className="py-10 text-center text-sm text-zinc-500">Be the first to comment.</p>
              ) : null}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment._id} className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                        {(comment.userId?.name || "U").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{comment.userId?.name || "User"}</span>
                          <span className="text-xs text-zinc-500">{formatTime(comment.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-200">{comment.comment}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setReplyTo(comment)}
                            className="text-xs font-semibold text-zinc-400 hover:text-white"
                          >
                            Reply
                          </button>
                          {String(comment.userId?._id) === String(user?._id || user?.sub) ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(comment._id)}
                              className="inline-flex items-center gap-1 text-xs text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {(comment.replies || []).map((reply) => (
                      <div key={reply._id} className="ml-12 flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-white">
                          {(reply.userId?.name || "U").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{reply.userId?.name || "User"}</span>
                            <span className="text-[10px] text-zinc-500">{formatTime(reply.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-zinc-300">{reply.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {hasMore ? (
                <button
                  type="button"
                  onClick={loadMore}
                  className="mt-4 w-full rounded-full border border-white/10 py-2 text-sm text-zinc-300"
                >
                  Load more
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
              {replyTo ? (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400">
                  <span>Replying to {replyTo.userId?.name}</span>
                  <button type="button" onClick={() => setReplyTo(null)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </Motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

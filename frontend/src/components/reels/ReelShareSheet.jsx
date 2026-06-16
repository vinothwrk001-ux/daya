import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Copy, MessageCircle, Send, Share2, X } from "lucide-react";

const PLATFORMS = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "bg-emerald-600" },
  { id: "facebook", label: "Facebook", icon: Share2, color: "bg-blue-600" },
  { id: "telegram", label: "Telegram", icon: Send, color: "bg-sky-500" },
  { id: "twitter", label: "Twitter / X", icon: Share2, color: "bg-black" },
  { id: "copy_link", label: "Copy Link", icon: Copy, color: "bg-zinc-700" },
];

function buildShareUrl(platform, url, title) {
  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(title || "Check out this reel");
  switch (platform) {
    case "whatsapp":
      return `https://wa.me/?text=${text}%20${encoded}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
    case "telegram":
      return `https://t.me/share/url?url=${encoded}&text=${text}`;
    case "twitter":
      return `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`;
    default:
      return url;
  }
}

export function ReelShareSheet({ reel, open, onClose, onShare }) {
  if (typeof document === "undefined") return null;

  const shareUrl = `${window.location.origin}/reels?reel=${reel?._id || ""}`;

  async function handlePlatform(platform) {
    if (platform === "copy_link") {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      window.open(buildShareUrl(platform, shareUrl, reel?.title), "_blank", "noopener,noreferrer");
    }
    await onShare?.(platform);
    onClose?.();
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <Motion.button
            type="button"
            aria-label="Close share"
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
            className="fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-lg rounded-t-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-white">Share reel</p>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-300 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PLATFORMS.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handlePlatform(id)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                >
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white ${color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold text-zinc-200">{label}</span>
                </button>
              ))}
            </div>
          </Motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

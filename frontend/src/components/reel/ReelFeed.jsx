import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  MessageCircle,
  Play,
  Send,
  Share2,
  Star,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAuthStore } from "../../context/authStore";
import {
  createReelComment,
  createReelCommentReply,
  followReelCreator,
  getAdjacentReels,
  getReel,
  getReelFeed,
  listReelComments,
  recordReelProductClick,
  recordReelStoreVisit,
  recordReelView,
  shareReel,
  toggleReelCommentLike,
  toggleReelLike,
  toggleReelSave,
} from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { saveTrackingContext } from "../../utils/influencerTracking";

const FEED_TABS = [
  ["for_you", "For You"],
  ["trending", "Trending"],
  ["product", "Products"],
  ["campaign", "Campaigns"],
  ["live", "Live Clips"],
];

function compact(value = 0) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function productImage(product = {}) {
  return resolveApiAssetUrl(product.thumbnail || product.images?.find?.((item) => item?.isPrimary)?.url || product.images?.[0]?.url || product.image || "");
}

function productIdOf(product = {}) {
  return product?._id || product?.id || "";
}

function buildAffiliateProductPath(reel = {}, product = {}, tracking = {}) {
  const productId = productIdOf(product);
  if (!productId) return "";
  const params = new URLSearchParams();
  if (reel?._id) params.set("reel", reel._id);
  if (tracking?.trackingToken) params.set("trackingToken", tracking.trackingToken);
  if (tracking?.anonymousId) params.set("anonymousId", tracking.anonymousId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const trackingCode = reel?.affiliateTrackingCode || product?.affiliateTrackingCode || product?.trackingCode || "";
  return trackingCode ? `/ref/${encodeURIComponent(trackingCode)}/product/${encodeURIComponent(productId)}${suffix}` : `/product/${productId}${suffix}`;
}

function getAnonymousId() {
  if (typeof window === "undefined") return "";
  let anonymousId = window.localStorage.getItem("anonInfluencerId") || "";
  if (!anonymousId) {
    anonymousId = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem("anonInfluencerId", anonymousId);
  }
  return anonymousId;
}

function creatorName(reel = {}) {
  const safeReel = reel || {};
  return safeReel.influencerId?.displayName || safeReel.influencerId?.userId?.name || safeReel.influencerId?.storeName || "Creator";
}

function creatorAvatar(reel = {}) {
  const safeReel = reel || {};
  return resolveApiAssetUrl(safeReel.influencerId?.profilePicture || safeReel.influencerId?.profileImage || safeReel.influencerId?.avatarUrl || "");
}

function creatorSlug(reel = {}) {
  const profile = reel?.influencerId || {};
  return profile.storeSlug || "";
}

function creatorId(reel = {}) {
  const profile = reel?.influencerId || {};
  return String(profile._id || "");
}

function normalizeReel(row = {}) {
  const safeRow = row || {};
  const tagged = [...(safeRow.productIds || []), ...(safeRow.campaignId?.productIds || []), ...(safeRow.products || [])];
  const seen = new Set();
  const products = tagged.filter((product) => {
    const id = String(product?._id || product?.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return {
    ...safeRow,
    products,
    campaignBadge: safeRow.campaignBadge || safeRow.campaignId?.title || "",
    brandName: safeRow.brandName || safeRow.campaignId?.vendorId?.shopName || safeRow.campaignId?.vendorId?.companyName || "",
    vendor: safeRow.vendor || safeRow.campaignId?.vendorId || null,
    sponsored: safeRow.sponsored ?? Boolean(safeRow.campaignId),
  };
}

function CreatorPanel({ reel, followed, followBusy = false, onFollow, onProductOpen, onStoreVisit, busyProductId = "" }) {
  if (!reel) {
    return (
      <aside className="hidden w-80 shrink-0 xl:block">
        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-32 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="mt-2 h-3 w-20 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      </aside>
    );
  }
  const profile = reel?.influencerId || {};
  const metrics = reel?.metrics || {};
  const profileSlug = creatorSlug(reel);
  const profileHref = profileSlug ? `/influencer/${profileSlug}` : "/influencers";

  return (
    <aside className="hidden h-full w-80 shrink-0 xl:block">
      <section className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Link to={profileHref} onClick={() => onStoreVisit?.(reel)} className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              {creatorAvatar(reel) ? <img src={creatorAvatar(reel)} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-black text-slate-950 dark:text-white">@{profileSlug || creatorName(reel)}</h2>
                {profile.verified ? <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[9px] font-bold text-white">Verified</span> : null}
              </div>
              <p className="truncate text-xs text-slate-500">{creatorName(reel)}</p>
            </div>
          </Link>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Metric label="Followers" value={compact(profile.followers || 0)} compact />
            <Metric label="Likes" value={compact(metrics.likes || 0)} compact />
            <Metric label="Sold" value={compact(metrics.orders || 0)} compact />
          </div>
          <button onClick={onFollow} disabled={followBusy} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black ${followed ? "border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200" : "bg-slate-950 text-white dark:bg-white dark:text-slate-950"}`}>
            <UserPlus className="h-4 w-4" />
            {followBusy ? (followed ? "Unfollowing..." : "Following...") : followed ? "Following" : "Follow"}
          </button>

          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <p className="line-clamp-2 text-slate-700 dark:text-slate-200">{reel?.caption || reel?.title || "Shoppable reel"}</p>
            {reel?.brandName || reel?.campaignBadge ? <p className="mt-2 truncate text-xs font-bold text-indigo-600">{[reel.brandName, reel.campaignBadge].filter(Boolean).join(" - ")}</p> : null}
            {reel.products?.length ? (
            <div className="mt-4 space-y-2">
              {reel.products.slice(0, 3).map((product) => (
                <button
                  key={productIdOf(product)}
                  type="button"
                  disabled={busyProductId === productIdOf(product)}
                  onClick={() => onProductOpen?.(reel, product)}
                  className="flex min-h-20 w-full items-center gap-3 rounded-3xl bg-slate-50 p-3 text-left transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70 dark:bg-slate-950 dark:hover:bg-slate-800"
                >
                  <img src={productImage(product)} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-black leading-tight text-slate-950 dark:text-white">{product.name}</span>
                    <span className="mt-1 block text-base font-black text-rose-600">{formatCurrency(product.discountPrice || product.price || 0)}</span>
                  </span>
                </button>
              ))}
            </div>
            ) : null}
            <div className="mt-auto pt-3">
              {reel.vendor || reel.brandName ? <VendorDetailsCard reel={reel} /> : null}
            </div>
          </div>
      </section>
    </aside>
  );
}

function VendorDetailsCard({ reel }) {
  const vendor = reel.vendor || {};
  const vendorName = vendor.shopName || vendor.companyName || reel.brandName || "Brand";
  const vendorSlug = vendor.storeSlug || vendor.slug || "";
  const vendorHref = vendorSlug ? `/vendor/${vendorSlug}` : "/stores";
  const logoUrl = resolveApiAssetUrl(vendor.logoUrl || vendor.logo || "");
  const [following, setFollowing] = useState(false);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-950 dark:text-white">{vendorName}</p>
          <p className="truncate text-xs text-slate-500">{reel.campaignBadge || "Vendor storefront"}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setFollowing((value) => !value)} className="rounded-2xl bg-slate-950 px-3 py-2.5 text-sm font-black text-white dark:bg-white dark:text-slate-950">
          {following ? "Following" : "Follow"}
        </button>
        <Link to={vendorHref} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-center text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">
          View Profile
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, compact: compactMode = false }) {
  return <div className={`rounded-2xl bg-slate-50 dark:bg-slate-950 ${compactMode ? "p-2" : "p-3"}`}><p className="text-[10px] text-slate-500">{label}</p><p className={`${compactMode ? "text-sm" : "text-base"} mt-1 font-bold text-slate-950 dark:text-white`}>{value}</p></div>;
}

function CommentsDrawer({ open, onClose, reel, isAuthenticated, onLoginRequired, onCommentCreated }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [replyFor, setReplyFor] = useState("");
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !reel?._id) return;
    let cancelled = false;
    async function loadComments() {
      setLoading(true);
      try {
        const response = await listReelComments(reel._id, { limit: 30 });
        if (!cancelled) setComments(response?.data?.items || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadComments();
    return () => { cancelled = true; };
  }, [open, reel?._id]);

  async function submitComment() {
    if (!reel?._id || !text.trim()) return;
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    setBusy(true);
    try {
      const response = await createReelComment(reel._id, { text });
      const nextComment = response?.data?.comment;
      if (nextComment) setComments((current) => [nextComment, ...current]);
      setText("");
      onCommentCreated?.(response?.data?.engagement?.counts);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(commentId) {
    if (!reel?._id || !commentId || !replyText.trim()) return;
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    setBusy(true);
    try {
      const response = await createReelCommentReply(reel._id, commentId, { text: replyText });
      const nextReply = response?.data?.reply;
      setComments((current) => current.map((comment) => comment._id === commentId ? {
        ...comment,
        repliesCount: Number(comment.repliesCount || 0) + 1,
        replies: [...(comment.replies || []), nextReply].filter(Boolean),
      } : comment));
      setReplyText("");
      setReplyFor("");
    } finally {
      setBusy(false);
    }
  }

  async function likeComment(commentId) {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    const response = await toggleReelCommentLike(reel._id, commentId);
    const data = response?.data || {};
    setComments((current) => current.map((comment) => comment._id === commentId ? { ...comment, liked: data.liked, likesCount: data.likesCount } : comment));
  }

  function userLabel(user = {}) {
    return user?.name || user?.email?.split?.("@")?.[0] || "User";
  }

  return (
    <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-[420px] transform border-l border-slate-200 bg-white shadow-2xl transition-transform dark:border-slate-800 dark:bg-slate-950 ${open ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <div>
          <h2 className="font-bold text-slate-950 dark:text-white">Comments</h2>
          <p className="text-xs text-slate-500">{compact(reel?.metrics?.comments || comments.length)} comments</p>
        </div>
        <button onClick={onClose} className="rounded-full border border-slate-200 p-2 dark:border-slate-700"><X className="h-4 w-4" /></button>
      </div>
      <div className="h-[calc(100vh-140px)] space-y-3 overflow-y-auto p-4">
        {loading ? <div className="text-sm font-bold text-slate-500">Loading comments...</div> : null}
        {!loading && !comments.length ? <div className="text-sm font-bold text-slate-500">No comments yet.</div> : null}
        {comments.map((comment) => (
          <div key={comment._id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-slate-950 dark:text-white">@{userLabel(comment.userId)}</p>
              <button onClick={() => likeComment(comment._id)} className={`text-xs font-bold ${comment.liked ? "text-rose-600" : "text-slate-500"}`}>{compact(comment.likesCount || 0)} likes</button>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{comment.text}</p>
            <button onClick={() => setReplyFor((value) => value === comment._id ? "" : comment._id)} className="mt-2 text-xs font-bold text-indigo-600">Reply</button>
            {(comment.replies || []).slice(0, 3).map((reply) => (
              <div key={reply._id} className="mt-2 rounded-xl bg-white p-2 text-sm dark:bg-slate-950">
                <span className="font-bold text-slate-900 dark:text-white">@{userLabel(reply.userId)}</span>
                <span className="ml-2 text-slate-600 dark:text-slate-300">{reply.text}</span>
              </div>
            ))}
            {replyFor === comment._id ? (
              <div className="mt-2 flex gap-2">
                <input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Write a reply..." className="min-w-0 flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <button disabled={busy} onClick={() => submitReply(comment._id)} className="rounded-full bg-indigo-600 px-4 text-xs font-black text-white disabled:opacity-60">Post</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex gap-2">
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          <button disabled={busy || !text.trim()} onClick={submitComment} className="rounded-full bg-slate-950 p-3 text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function LoginPromptModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Login required">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Join to follow creators</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Log in or create an account to follow influencers, save content, and build your creator feed.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link to="/login" className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white dark:bg-white dark:text-slate-950">Login</Link>
          <Link to="/register" className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">Register</Link>
        </div>
      </div>
    </div>
  );
}

function ShareModal({ reel, onClose, onShare }) {
  if (!reel) return null;
  const destinations = [
    ["copy_link", "Copy"],
    ["whatsapp", "WhatsApp"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["twitter", "Twitter"],
    ["telegram", "Telegram"],
    ["email", "Email"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Share reel">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Share reel</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {destinations.map(([key, label]) => (
            <button key={key} onClick={() => onShare(key)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReelFeed({ detailId = "" }) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [tab, setTab] = useState("for_you");
  const [, setPage] = useState(1);
  const pageRef = useRef(1);
  const [reels, setReels] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [followed, setFollowed] = useState({});
  const [followBusy, setFollowBusy] = useState({});
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [adjacent, setAdjacent] = useState({ previous: null, next: null });
  const [error, setError] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const observerRef = useRef(null);
  const feedRef = useRef(null);
  const videoRefs = useRef([]);
  const preloadedReelsRef = useRef(new Map());
  const viewedReelsRef = useRef(new Set());

  const activeReel = reels[activeIndex] || null;

  const load = useCallback(async ({ reset = false } = {}) => {
    const nextPage = reset ? 1 : pageRef.current;
    setLoading(true);
    setError("");
    try {
      const response = await getReelFeed({ tab, page: nextPage, limit: detailId ? 1 : 8 });
      const payload = response?.data || {};
      const nextItems = (Array.isArray(payload) ? payload : payload.items || []).map(normalizeReel);
      setReels((current) => reset ? nextItems : [...current, ...nextItems.filter((item) => !current.some((row) => row._id === item._id))]);
      setFollowed((current) => nextItems.reduce((next, reel) => {
        const id = creatorId(reel);
        return id ? { ...next, [id]: Boolean(reel.influencerId?.isFollowing) } : next;
      }, current));
      setLiked((current) => nextItems.reduce((next, reel) => ({ ...next, [reel._id]: Boolean(reel.engagement?.viewer?.liked) }), current));
      setSaved((current) => nextItems.reduce((next, reel) => ({ ...next, [reel._id]: Boolean(reel.engagement?.viewer?.saved) }), current));
      setHasMore(Boolean(payload.hasMore));
      pageRef.current = nextPage + 1;
      setPage(nextPage + 1);
      if (reset) setActiveIndex(0);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load reels.");
    } finally {
      setLoading(false);
    }
  }, [detailId, tab]);

  useEffect(() => {
    if (detailId) return;
    pageRef.current = 1;
    setPage(1);
    load({ reset: true });
  }, [detailId, load, tab]);

  useEffect(() => {
    if (!detailId) return;
    let cancelled = false;
    async function loadDetail() {
      setLoading(true);
      try {
        const response = await getReel(detailId);
        if (!cancelled) {
          const reel = normalizeReel(response?.data || {});
          setReels([reel]);
          const id = creatorId(reel);
          if (id) setFollowed((current) => ({ ...current, [id]: Boolean(reel.influencerId?.isFollowing) }));
          setLiked((current) => ({ ...current, [reel._id]: Boolean(reel.engagement?.viewer?.liked) }));
          setSaved((current) => ({ ...current, [reel._id]: Boolean(reel.engagement?.viewer?.saved) }));
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Failed to load reel.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [detailId]);

  useEffect(() => {
    if (!detailId) {
      setAdjacent({ previous: null, next: null });
      return;
    }
    let cancelled = false;
    async function loadAdjacent() {
      try {
        const response = await getAdjacentReels(detailId);
        const nextAdjacent = response?.data || { previous: null, next: null };
        if (cancelled) return;
        setAdjacent(nextAdjacent);
        [nextAdjacent.previous?._id, nextAdjacent.next?._id].filter(Boolean).forEach((id) => {
          if (preloadedReelsRef.current.has(String(id))) return;
          getReel(id).then((reelResponse) => {
            const reel = normalizeReel(reelResponse?.data || {});
            if (reel?._id) {
              preloadedReelsRef.current.set(String(reel._id), reel);
              if (typeof document !== "undefined" && reel.videoUrl) {
                const video = document.createElement("video");
                video.preload = "metadata";
                video.src = resolveApiAssetUrl(reel.videoUrl);
              }
            }
          }).catch(() => null);
        });
      } catch {
        if (!cancelled) setAdjacent({ previous: null, next: null });
      }
    }
    loadAdjacent();
    return () => { cancelled = true; };
  }, [detailId]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      video.muted = muted;
      if (index === activeIndex) video.play().catch(() => {});
      else video.pause();
    });
  }, [activeIndex, muted, reels]);

  useEffect(() => {
    const reel = reels[activeIndex];
    if (!reel?._id || viewedReelsRef.current.has(reel._id)) return;
    viewedReelsRef.current.add(reel._id);
    recordReelView(reel._id, { anonymousId: getAnonymousId(), source: detailId ? "detail" : "feed" }).catch(() => null);
  }, [activeIndex, detailId, reels]);

  const navigateAdjacent = useCallback((direction) => {
    const targetId = adjacent?.[direction]?._id;
    if (!targetId) return;
    const cached = preloadedReelsRef.current.get(String(targetId));
    if (cached) {
      setReels([cached]);
      setActiveIndex(0);
      const id = creatorId(cached);
      if (id) setFollowed((current) => ({ ...current, [id]: Boolean(cached.influencerId?.isFollowing) }));
    }
    navigate(`/reels/${targetId}`);
  }, [adjacent, navigate]);

  useEffect(() => {
    function onKey(event) {
      if (detailId && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") navigateAdjacent("previous");
        if (event.key === "ArrowRight" || event.key === "ArrowDown") navigateAdjacent("next");
        return;
      }
      if (event.key === "ArrowDown") setActiveIndex((index) => Math.min(index + 1, reels.length - 1));
      if (event.key === "ArrowUp") setActiveIndex((index) => Math.max(index - 1, 0));
      if (event.key.toLowerCase() === "m") setMuted((value) => !value);
      if (event.code === "Space") {
        event.preventDefault();
        const video = videoRefs.current[activeIndex];
        if (video) video.paused ? video.play() : video.pause();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, detailId, navigateAdjacent, reels.length]);

  const lastCardRef = useCallback((node) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore) load();
    }, { rootMargin: "600px" });
    if (node) observerRef.current.observe(node);
  }, [hasMore, load, loading]);

  async function attributeClick(reel, product) {
    const response = await recordReelProductClick(reel._id, {
      productId: productIdOf(product),
      anonymousId: getAnonymousId(),
      source: "reel_product_card",
      attributionWindowDays: 30,
    });
    const data = response?.data || {};
    if (typeof window !== "undefined" && data.anonymousId) window.localStorage.setItem("anonInfluencerId", data.anonymousId);
    saveTrackingContext({ trackingToken: data.trackingToken, anonymousId: data.anonymousId, reelId: reel._id, productId: productIdOf(product) });
    return data;
  }

  async function handleProductOpen(reel, product) {
    const productId = productIdOf(product);
    if (!productId) return;
    setBusyProductId(productId);
    setError("");
    try {
      const tracking = await attributeClick(reel, product);
      navigate(buildAffiliateProductPath(reel, product, tracking));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not prepare affiliate link.");
    } finally {
      setBusyProductId("");
    }
  }

  async function toggleFollow(reel) {
    const id = creatorId(reel);
    if (!id || !reel?._id) return;
    if (!isAuthenticated) {
      setLoginPrompt(true);
      return;
    }
    const wasFollowing = Boolean(followed[id]);
    if (wasFollowing && !window.confirm(`Do you want to unfollow ${creatorName(reel)}?`)) return;
    setFollowBusy((current) => ({ ...current, [id]: true }));
    setFollowed((current) => ({ ...current, [id]: !wasFollowing }));
    updateReelCreatorFollowers(id, wasFollowing ? -1 : 1);
    try {
      const response = await followReelCreator(reel._id, { following: !wasFollowing, source: "reel" });
      const nextFollowing = Boolean(response?.data?.following);
      setFollowed((current) => ({ ...current, [id]: nextFollowing }));
      if (response?.data?.followers !== undefined) setReelCreatorFollowers(id, response.data.followers);
    } catch (err) {
      setFollowed((current) => ({ ...current, [id]: wasFollowing }));
      updateReelCreatorFollowers(id, wasFollowing ? 1 : -1);
      if (err?.response?.status === 401) setLoginPrompt(true);
      else setError(err?.response?.data?.message || "Could not update follow state.");
    } finally {
      setFollowBusy((current) => ({ ...current, [id]: false }));
    }
  }

  function updateReelCreatorFollowers(id, delta) {
    setReels((current) => current.map((reel) => creatorId(reel) === id ? { ...reel, influencerId: { ...reel.influencerId, followers: Math.max(0, Number(reel.influencerId?.followers || 0) + delta) } } : reel));
  }

  function setReelCreatorFollowers(id, followers) {
    setReels((current) => current.map((reel) => creatorId(reel) === id ? { ...reel, influencerId: { ...reel.influencerId, followers } } : reel));
  }

  function updateReelMetrics(reelId, counts = {}) {
    setReels((current) => current.map((reel) => reel._id === reelId ? {
      ...reel,
      metrics: {
        ...(reel.metrics || {}),
        ...(counts || {}),
        bookmarks: counts.saves ?? counts.bookmarks ?? reel.metrics?.bookmarks,
      },
      engagement: {
        ...(reel.engagement || {}),
        counts: { ...(reel.engagement?.counts || {}), ...(counts || {}) },
      },
    } : reel));
  }

  async function handleLike(reel) {
    if (!isAuthenticated) {
      setLoginPrompt(true);
      return;
    }
    const wasLiked = Boolean(liked[reel._id]);
    setLiked((state) => ({ ...state, [reel._id]: !wasLiked }));
    updateReelMetrics(reel._id, { likes: Math.max(0, Number(reel.metrics?.likes || 0) + (wasLiked ? -1 : 1)) });
    try {
      const response = await toggleReelLike(reel._id);
      setLiked((state) => ({ ...state, [reel._id]: Boolean(response?.data?.liked) }));
      updateReelMetrics(reel._id, response?.data?.counts || {});
    } catch (err) {
      setLiked((state) => ({ ...state, [reel._id]: wasLiked }));
      updateReelMetrics(reel._id, { likes: Number(reel.metrics?.likes || 0) });
      if (err?.response?.status === 401) setLoginPrompt(true);
      else setError(err?.response?.data?.message || "Could not update like.");
    }
  }

  async function handleSave(reel) {
    if (!isAuthenticated) {
      setLoginPrompt(true);
      return;
    }
    const wasSaved = Boolean(saved[reel._id]);
    setSaved((state) => ({ ...state, [reel._id]: !wasSaved }));
    updateReelMetrics(reel._id, { saves: Math.max(0, Number(reel.metrics?.saves || reel.metrics?.bookmarks || 0) + (wasSaved ? -1 : 1)) });
    try {
      const response = await toggleReelSave(reel._id);
      setSaved((state) => ({ ...state, [reel._id]: Boolean(response?.data?.saved) }));
      updateReelMetrics(reel._id, response?.data?.counts || {});
    } catch (err) {
      setSaved((state) => ({ ...state, [reel._id]: wasSaved }));
      updateReelMetrics(reel._id, { saves: Number(reel.metrics?.saves || reel.metrics?.bookmarks || 0) });
      if (err?.response?.status === 401) setLoginPrompt(true);
      else setError(err?.response?.data?.message || "Could not save reel.");
    }
  }

  async function handleShare(reel, destination = "copy_link") {
    const url = `${window.location.origin}/reels/${reel._id}`;
    if (destination === "copy_link") await navigator.clipboard?.writeText(url);
    const shareTargets = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(reel.title || "Shoppable reel")}&body=${encodeURIComponent(url)}`,
    };
    if (shareTargets[destination]) window.open(shareTargets[destination], "_blank", "noopener,noreferrer");
    try {
      const response = await shareReel(reel._id, { anonymousId: getAnonymousId(), source: "reel_feed", destination });
      updateReelMetrics(reel._id, response?.data?.counts || {});
    } catch {
      updateReelMetrics(reel._id, { shares: Number(reel.metrics?.shares || 0) + 1 });
    }
  }

  function handleStoreVisit(reel) {
    if (!reel?._id) return;
    recordReelStoreVisit(reel._id, { anonymousId: getAnonymousId(), source: "creator_panel" }).catch(() => null);
  }

  function goTo(index) {
    setActiveIndex(Math.max(0, Math.min(index, reels.length - 1)));
  }

  function handleFeedScroll() {
    const container = feedRef.current;
    if (!container) return;
    const center = container.getBoundingClientRect().top + container.clientHeight / 2;
    let closestIndex = activeIndex;
    let closestDistance = Number.POSITIVE_INFINITY;
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      const rect = video.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    if (closestIndex !== activeIndex) setActiveIndex(closestIndex);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-150px)] max-w-[1400px] flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto">
        {FEED_TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${tab === key ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>{label}</button>
        ))}
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <div className="min-h-0 flex-1">
        <section ref={feedRef} onScroll={handleFeedScroll} className="mx-auto h-[calc(100vh-150px)] w-full max-w-[1240px] snap-y snap-mandatory overflow-y-auto rounded-[2rem] p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading && !reels.length ? <div className="flex h-full items-center justify-center text-sm font-bold text-slate-500">Loading reels...</div> : null}
          {!loading && !reels.length ? <div className="flex h-full items-center justify-center text-center text-sm font-bold text-slate-500">No published reels yet.</div> : null}
          {reels.map((reel, index) => (
            <article key={reel._id} ref={index === reels.length - 1 ? lastCardRef : null} onMouseEnter={() => setActiveIndex(index)} className="mb-4 grid h-[calc(100vh-166px)] max-h-[90vh] snap-start gap-5 xl:grid-cols-[320px_minmax(0,900px)]">
              <CreatorPanel reel={reel} followed={Boolean(followed[creatorId(reel)])} followBusy={Boolean(followBusy[creatorId(reel)])} onFollow={() => toggleFollow(reel)} onProductOpen={handleProductOpen} onStoreVisit={handleStoreVisit} busyProductId={busyProductId} />
              <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-black shadow-2xl">
                <video ref={(node) => { videoRefs.current[index] = node; }} src={resolveApiAssetUrl(reel.videoUrl)} poster={resolveApiAssetUrl(reel.thumbnailUrl)} className="h-full max-h-[90vh] w-full object-cover" autoPlay={index === activeIndex} muted={muted} loop playsInline preload={Math.abs(index - activeIndex) <= 1 ? "auto" : "metadata"} onClick={(event) => event.currentTarget.paused ? event.currentTarget.play() : event.currentTarget.pause()} />
                {detailId && adjacent.previous?._id ? (
                  <button type="button" onClick={() => navigateAdjacent("previous")} aria-label="Previous reel" className="absolute left-2 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 md:left-4 md:h-12 md:w-12">
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                ) : null}
                {detailId && adjacent.next?._id ? (
                  <button type="button" onClick={() => navigateAdjacent("next")} aria-label="Next reel" className="absolute right-14 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 md:right-16 md:h-12 md:w-12">
                    <ChevronRight className="h-6 w-6" />
                  </button>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4 text-white xl:hidden">
                  <div className="flex items-center gap-2 text-xs font-bold">@{creatorName(reel)} {reel.sponsored ? <span className="rounded-full bg-amber-300 px-2 py-0.5 text-slate-950">Sponsored</span> : null}</div>
                  <p className="mt-2 line-clamp-2 text-sm">{reel.caption || reel.title || "Shoppable reel"}</p>
                  {reel.products?.length ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {reel.products.slice(0, 4).map((product) => (
                        <button key={productIdOf(product)} disabled={busyProductId === productIdOf(product)} onClick={() => handleProductOpen(reel, product)} className="flex min-w-[190px] items-center gap-2 rounded-2xl bg-white/95 p-2 text-left text-slate-950 disabled:cursor-wait disabled:opacity-70">
                          <img src={productImage(product)} alt="" className="h-10 w-10 rounded-xl object-cover" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold">{product.name}</span>
                            <span className="text-xs font-bold text-rose-600">{formatCurrency(product.discountPrice || product.price || 0)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {index === activeIndex ? (
                  <div className="absolute bottom-5 right-2 hidden w-11 flex-col items-center gap-2 lg:flex">
                    <ActionButton icon={<Heart className="h-5 w-5" />} active={liked[reel._id]} count={compact(reel.metrics?.likes || 0)} onClick={() => handleLike(reel)} overlay />
                    <ActionButton icon={<MessageCircle className="h-5 w-5" />} count={compact(reel.metrics?.comments || 0)} onClick={() => setCommentsOpen(true)} overlay />
                    <ActionButton icon={<Share2 className="h-5 w-5" />} count={compact(reel.metrics?.shares || 0)} onClick={() => setShareOpen(true)} overlay />
                    <ActionButton icon={<Star className="h-5 w-5" />} active={saved[reel._id]} count={compact(reel.metrics?.saves || reel.metrics?.bookmarks || 0)} onClick={() => handleSave(reel)} overlay />
                    <ActionButton icon={<Flag className="h-5 w-5" />} count="Report" onClick={() => setError("Report submitted for moderation review.")} overlay />
                    <button onClick={() => setMuted((value) => !value)} className="rounded-full bg-black/45 p-4 text-white shadow-lg backdrop-blur">{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>

      {!detailId ? <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 lg:hidden">
        <button onClick={() => goTo(activeIndex - 1)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">Prev</button>
        <button onClick={() => goTo(activeIndex + 1)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">Next</button>
      </div> : null}

      <CommentsDrawer open={commentsOpen} onClose={() => setCommentsOpen(false)} reel={activeReel} isAuthenticated={isAuthenticated} onLoginRequired={() => setLoginPrompt(true)} onCommentCreated={(counts) => activeReel?._id && updateReelMetrics(activeReel._id, counts || {})} />
      {shareOpen ? <ShareModal reel={activeReel} onClose={() => setShareOpen(false)} onShare={(destination) => { if (activeReel) handleShare(activeReel, destination); setShareOpen(false); }} /> : null}
      {loginPrompt ? <LoginPromptModal onClose={() => setLoginPrompt(false)} /> : null}
    </div>
  );
}

function ActionButton({ icon, count, active = false, onClick, overlay = false }) {
  return (
    <button onClick={onClick} title={String(count || "")} aria-label={String(count || "Reel action")} className={`inline-flex min-h-14 w-11 flex-col items-center justify-center gap-0.5 rounded-full transition ${overlay ? active ? "text-rose-400" : "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]" : active ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/20 backdrop-blur">{icon}</span>
      <span className="max-w-12 truncate text-[10px] font-black leading-none">{count}</span>
    </button>
  );
}

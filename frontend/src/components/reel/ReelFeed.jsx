import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
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
import { CartDrawerContext } from "../../context/CartDrawerContext";
import { useCart } from "../../hooks/useCart";
import { clickTracking, getReel, getReelFeed } from "../../services/influencerCommerceService";
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

function creatorName(reel = {}) {
  const safeReel = reel || {};
  return safeReel.influencerId?.userId?.name || safeReel.influencerId?.username || "Creator";
}

function creatorAvatar(reel = {}) {
  const safeReel = reel || {};
  return resolveApiAssetUrl(safeReel.influencerId?.profileImage || safeReel.influencerId?.avatarUrl || "");
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

function CreatorPanel({ reel, followed, onFollow, onProductOpen, busyProductId = "" }) {
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
  const profileHref = `/influencer/${profile.username || profile._id || ""}`;

  return (
    <aside className="hidden h-full w-80 shrink-0 xl:block">
      <section className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Link to={profileHref} className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              {creatorAvatar(reel) ? <img src={creatorAvatar(reel)} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-black text-slate-950 dark:text-white">@{profile.username || creatorName(reel)}</h2>
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
          <button onClick={onFollow} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black ${followed ? "border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200" : "bg-slate-950 text-white dark:bg-white dark:text-slate-950"}`}>
            <UserPlus className="h-4 w-4" />
            {followed ? "Following" : "Follow"}
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

function CommentsDrawer({ open, onClose, reel }) {
  const comments = useMemo(() => [
    { id: "1", user: "Aarav", text: "This product looks useful. Saving it.", likes: 12 },
    { id: "2", user: "Meera", text: "Can you share the size options?", likes: 4 },
  ], [reel?._id]);

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
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-slate-950 dark:text-white">@{comment.user}</p>
              <button className="text-xs font-bold text-slate-500">{comment.likes} likes</button>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{comment.text}</p>
            <button className="mt-2 text-xs font-bold text-indigo-600">Reply</button>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex gap-2">
          <input placeholder="Add a comment..." className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          <button className="rounded-full bg-slate-950 p-3 text-white dark:bg-white dark:text-slate-950"><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

export function ReelFeed({ detailId = "" }) {
  const navigate = useNavigate();
  const cartDrawer = useContext(CartDrawerContext);
  const { addItem } = useCart();
  const [tab, setTab] = useState("for_you");
  const [page, setPage] = useState(1);
  const [reels, setReels] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [followed, setFollowed] = useState({});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const observerRef = useRef(null);
  const feedRef = useRef(null);
  const videoRefs = useRef([]);

  const activeReel = reels[activeIndex] || null;

  const load = useCallback(async ({ reset = false } = {}) => {
    const nextPage = reset ? 1 : page;
    setLoading(true);
    setError("");
    try {
      const response = await getReelFeed({ tab, page: nextPage, limit: detailId ? 1 : 8 });
      const payload = response?.data || {};
      const nextItems = (Array.isArray(payload) ? payload : payload.items || []).map(normalizeReel);
      setReels((current) => reset ? nextItems : [...current, ...nextItems.filter((item) => !current.some((row) => row._id === item._id))]);
      setHasMore(Boolean(payload.hasMore));
      setPage(nextPage + 1);
      if (reset) setActiveIndex(0);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load reels.");
    } finally {
      setLoading(false);
    }
  }, [detailId, page, tab]);

  useEffect(() => {
    if (detailId) return;
    setPage(1);
    load({ reset: true });
  }, [detailId, tab]);

  useEffect(() => {
    if (!detailId) return;
    let cancelled = false;
    async function loadDetail() {
      setLoading(true);
      try {
        const response = await getReel(detailId);
        if (!cancelled) setReels([normalizeReel(response?.data || {})]);
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
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      video.muted = muted;
      if (index === activeIndex) video.play().catch(() => {});
      else video.pause();
    });
  }, [activeIndex, muted, reels]);

  useEffect(() => {
    function onKey(event) {
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
  }, [activeIndex, reels.length]);

  const lastCardRef = useCallback((node) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore) load();
    }, { rootMargin: "600px" });
    if (node) observerRef.current.observe(node);
  }, [hasMore, load, loading]);

  async function attributeClick(reel, product) {
    const response = await clickTracking({
      reelId: reel._id,
      productId: productIdOf(product),
      anonymousId: typeof window !== "undefined" ? window.localStorage.getItem("anonInfluencerId") || "" : "",
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

  async function handleAddToCart(reel, product, buyNow = false) {
    const productId = productIdOf(product);
    if (!productId) return;
    setBusyProductId(productId);
    setError("");
    try {
      await attributeClick(reel, product);
      const added = await addItem(productId, 1);
      cartDrawer?.openDrawer(added || product, added?.variant || null, 1);
      if (buyNow) navigate("/checkout");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not add product to cart.");
    } finally {
      setBusyProductId("");
    }
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
              <CreatorPanel reel={reel} followed={Boolean(followed[reel._id])} onFollow={() => setFollowed((state) => ({ ...state, [reel._id]: !state[reel._id] }))} onProductOpen={handleProductOpen} busyProductId={busyProductId} />
              <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-black shadow-2xl">
                <video ref={(node) => { videoRefs.current[index] = node; }} src={resolveApiAssetUrl(reel.videoUrl)} poster={resolveApiAssetUrl(reel.thumbnailUrl)} className="h-full max-h-[90vh] w-full object-cover" autoPlay={index === activeIndex} muted={muted} loop playsInline preload={Math.abs(index - activeIndex) <= 1 ? "auto" : "metadata"} onClick={(event) => event.currentTarget.paused ? event.currentTarget.play() : event.currentTarget.pause()} />
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
                    <ActionButton icon={<Heart className="h-5 w-5" />} active={liked[reel._id]} count={compact((reel.metrics?.likes || 0) + (liked[reel._id] ? 1 : 0))} onClick={() => setLiked((state) => ({ ...state, [reel._id]: !state[reel._id] }))} overlay />
                    <ActionButton icon={<MessageCircle className="h-5 w-5" />} count={compact(reel.metrics?.comments || 0)} onClick={() => setCommentsOpen(true)} overlay />
                    <ActionButton icon={<Share2 className="h-5 w-5" />} count={compact(reel.metrics?.shares || 0)} onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/reels/${reel._id}`)} overlay />
                    <ActionButton icon={<Star className="h-5 w-5" />} active={saved[reel._id]} count="Save" onClick={() => setSaved((state) => ({ ...state, [reel._id]: !state[reel._id] }))} overlay />
                    <ActionButton icon={<Flag className="h-5 w-5" />} count="Report" onClick={() => setError("Report submitted for moderation review.")} overlay />
                    <button onClick={() => setMuted((value) => !value)} className="rounded-full bg-black/45 p-4 text-white shadow-lg backdrop-blur">{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>

      <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 lg:hidden">
        <button onClick={() => goTo(activeIndex - 1)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">Prev</button>
        <button onClick={() => goTo(activeIndex + 1)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">Next</button>
      </div>

      <CommentsDrawer open={commentsOpen} onClose={() => setCommentsOpen(false)} reel={activeReel} />
    </div>
  );
}

function ActionButton({ icon, count, active = false, onClick, overlay = false }) {
  return (
    <button onClick={onClick} title={String(count || "")} aria-label={String(count || "Reel action")} className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition ${overlay ? active ? "text-rose-400" : "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]" : active ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>
      {icon}
    </button>
  );
}

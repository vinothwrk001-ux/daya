import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import {
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Flag,
  Grid2X2,
  Heart,
  Eye,
  LayoutGrid,
  ListFilter,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Percent,
  Play,
  Search,
  Send,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  TrendingUp,
  Truck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useAuthStore } from "../context/authStore";
import {
  clickTracking,
  followPublicInfluencer,
  getPublicInfluencerStorefront,
  subscribePublicInfluencerNewsletter,
  trackPublicInfluencerEvent,
  unfollowPublicInfluencer,
} from "../services/influencerCommerceService";
import { formatCurrency } from "../utils/formatCurrency";
import { saveTrackingContext } from "../utils/influencerTracking";
import { saveRedirectAfterLogin } from "../utils/loginRedirect";
import pendingActionManager from "../utils/pendingActionManager";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

const TABS = [
  ["storefront", "Storefront"],
  ["posts", "Posts"],
  ["reels", "Reels"],
  ["collections", "Collections"],
  ["about", "About"],
];

function compact(value = 0) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatDuration(seconds = 0) {
  const value = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(value / 60);
  const remainder = Math.floor(value % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function activeTabFromRoute(tab = "") {
  return TABS.some(([key]) => key === tab) ? tab : "storefront";
}

function mediaOf(item = {}) {
  return resolveApiAssetUrl(item.media?.coverImage || item.media?.thumbnail || item.media?.bannerImage || item.media?.[0]?.url || item.thumbnailUrl || item.videoUrl || "");
}

function productsOfCollection(collection = {}) {
  return Array.isArray(collection.productIds) ? collection.productIds.filter((product) => product && typeof product === "object") : [];
}

function productCountOf(collection = {}) {
  return collection.productsCount || productsOfCollection(collection).length || collection.productIds?.length || 0;
}

function analyticsOf(item = {}) {
  return item.analyticsSummary || item.analytics || item.metrics || {};
}

function categoryOf(product = {}) {
  if (typeof product.category === "string") return product.category;
  return product.category?.name || product.category?.title || "Creator Pick";
}

function sellerNameOf(product = {}) {
  return product.sellerId?.shopName || product.sellerId?.companyName || product.vendorName || product.brand || "Marketplace";
}

function collectionTitle(collection = {}) {
  return collection.title || collection.name || "Collection";
}

function uniqueCategories(data = {}) {
  const values = [
    ...(data.storefront?.categories || []),
    ...(data.profile?.categories || []),
    ...(data.collections || []).flatMap((collection) => productsOfCollection(collection).map(categoryOf)),
    ...(data.featuredProducts || []).map(categoryOf),
  ].map((value) => String(value || "").trim()).filter((value) => value && value.length <= 40 && !/^[a-f\d]{16,}$/i.test(value));
  return [...new Set(values)].slice(0, 10);
}

function topCategories(data = {}) {
  const counts = new Map();
  allStorefrontProducts(data).forEach((product) => {
    const category = categoryOf(product);
    if (!category || category === "Creator Pick" || /^[a-f\d]{16,}$/i.test(String(category))) return;
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  uniqueCategories(data).forEach((category) => {
    if (!counts.has(category)) counts.set(category, 0);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));
}

function allStorefrontProducts(data = {}) {
  const byId = new Map();
  [...(data.featuredProducts || []), ...(data.collections || []).flatMap(productsOfCollection)].forEach((product) => {
    const id = product?._id || product?.id;
    if (id && !byId.has(String(id))) byId.set(String(id), product);
  });
  return [...byId.values()];
}

function productForSharedCard(product = {}) {
  const existingImages = Array.isArray(product.images) ? product.images.filter((image) => image?.url) : [];
  const fallbackImage = product.thumbnail ? [{ url: product.thumbnail, isPrimary: true }] : [];
  const stock = Number(product.stock ?? product.inventory?.stock ?? product.inventory?.available ?? product.quantity ?? 1);
  return {
    ...product,
    _id: product._id || product.id,
    images: existingImages.length ? existingImages : fallbackImage,
    category: categoryOf(product),
    stock,
    variants: Array.isArray(product.variants) && product.variants.length
      ? product.variants
      : [{ variantId: "", title: "Default", stock, isActive: true }],
  };
}

function currentRelativeUrl() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function getStoredActionSet(key) {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function setStoredActionSet(key, values) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify([...values]));
}

async function shareStorefrontResource({ username, eventType = "share", surface, title, url, payload = {} }) {
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  let destination = "copy_link";

  if (navigator.share) {
    try {
      await navigator.share({ title, url: shareUrl });
      destination = "native_share";
    } catch (err) {
      if (err?.name === "AbortError") return { shared: false, destination: "cancelled" };
      throw err;
    }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(shareUrl);
  }

  await trackPublicInfluencerEvent(username, {
    eventType,
    surface,
    ...payload,
    metadata: { ...(payload.metadata || {}), destination, url: shareUrl },
  }).catch(() => null);

  return { shared: true, destination };
}

function CreatorProductCard({ product, data, surface = "storefront", collectionId = "", postId = "" }) {
  const productId = product?._id || product?.id;
  const sharedProduct = useMemo(() => productForSharedCard(product), [product]);

  const attribute = useCallback(async (eventType = "product_click") => {
    if (!productId) return null;
    await trackPublicInfluencerEvent(data.profile.username, {
      eventType,
      surface,
      productId,
      collectionId,
      postId,
    }).catch(() => null);
    const response = await clickTracking({
      productId,
      influencerId: data.profile._id,
      storefrontId: data.storefront._id,
      collectionId,
      postId,
      surface,
      anonymousId: typeof window !== "undefined" ? window.localStorage.getItem("anonInfluencerId") || "" : "",
    });
    const payload = response?.data || {};
    if (payload.anonymousId) window.localStorage.setItem("anonInfluencerId", payload.anonymousId);
    saveTrackingContext({ trackingToken: payload.trackingToken, anonymousId: payload.anonymousId, productId, influencerId: data.profile._id });
    return payload;
  }, [collectionId, data.profile._id, data.profile.username, data.storefront._id, postId, productId, surface]);

  return (
    <div className="w-[182px] shrink-0 sm:w-[190px]">
      <ProductCard
        product={sharedProduct}
        imageAspectClass="aspect-[4/5]"
        onProductClick={() => {
          attribute("product_click").catch(() => null);
        }}
      />
    </div>
  );
}

function BenefitsBar() {
  const benefits = [
    [ShoppingBag, "Curated Picks"],
    [BadgeCheck, "Authentic Products"],
    [ShieldCheck, "Secure Payments"],
    [Truck, "Fast Delivery"],
  ];
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {benefits.map(([Icon, label]) => (
        <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          {createElement(Icon, { className: "h-5 w-5 text-indigo-600" })}
          {label}
        </div>
      ))}
    </section>
  );
}

function SectionHeader({ title, to }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xl font-black text-slate-950 dark:text-white">{title}</h2>
      {to ? <Link to={to} className="text-sm font-bold text-indigo-600 hover:text-indigo-700">View all</Link> : null}
    </div>
  );
}

function CollectionsRail({ data, collections = [], selectedId = "", onSelect }) {
  const railRef = useRef(null);
  function move(direction) {
    railRef.current?.scrollBy({ left: direction * 360, behavior: "smooth" });
  }
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">Collections</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Curated picks by {data.profile.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/influencer/${data.profile.username}/collections`} className="hidden rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200 sm:inline-flex">View all</Link>
          <button type="button" onClick={() => move(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" aria-label="Previous collection"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => move(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" aria-label="Next collection"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={railRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {collections.map((collection) => (
          <button key={collection._id} type="button" onClick={() => onSelect?.(collection)} className={`group flex h-[238px] w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-950 sm:h-[252px] sm:w-[240px] ${selectedId === collection._id ? "border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-950" : "border-slate-200 dark:border-slate-800"}`}>
            <div className="relative h-[132px] shrink-0 bg-slate-100 dark:bg-slate-800 sm:h-[144px]">
              {mediaOf(collection) ? <img src={mediaOf(collection)} alt={collectionTitle(collection)} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" /> : null}
              <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] font-black text-white">{productCountOf(collection)} Products</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <h3 className="line-clamp-1 font-black text-slate-950 dark:text-white">{collectionTitle(collection)}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{collection.description || collection.type || "Creator curated collection"}</p>
              <div className="mt-auto flex flex-wrap gap-1 pt-3">
                {collection.type ? <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{collection.type}</span> : null}
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">{collection.status || "active"}</span>
              </div>
            </div>
          </button>
        ))}
        {!collections.length ? <EmptyState label="No public collections yet." /> : null}
      </div>
    </section>
  );
}

function ReelsRail({ data, reels = [] }) {
  const railRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const node = railRef.current;
    if (!node) return;
    setCanPrev(node.scrollLeft > 8);
    setCanNext(node.scrollLeft + node.clientWidth < node.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateScrollState();
    const node = railRef.current;
    if (!node) return;
    node.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    trackPublicInfluencerEvent(data.profile.username, { eventType: "carousel_view", surface: "storefront-reels-shelf" }).catch(() => null);
    return () => {
      node.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [data.profile.username, reels.length, updateScrollState]);

  function scrollByPage(direction) {
    const node = railRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(280, node.clientWidth * 0.86), behavior: "smooth" });
    trackPublicInfluencerEvent(data.profile.username, { eventType: "carousel_navigation", surface: "storefront-reels-shelf", metadata: { direction: direction > 0 ? "next" : "previous" } }).catch(() => null);
  }

  return (
    <section aria-labelledby="latest-reels-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="latest-reels-heading" className="text-xl font-black text-slate-950 dark:text-white">Latest Reels</h2>
        <div className="flex items-center gap-2">
          <Link to={`/influencer/${data.profile.username}/reels`} onClick={() => trackPublicInfluencerEvent(data.profile.username, { eventType: "reel_view", surface: "storefront-reels-view-all" }).catch(() => null)} className="rounded-full px-3 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800">View All</Link>
          <button type="button" onClick={() => scrollByPage(-1)} disabled={!canPrev} aria-label="Previous reels" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => scrollByPage(1)} disabled={!canNext} aria-label="Next reels" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={railRef} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowRight") scrollByPage(1); if (event.key === "ArrowLeft") scrollByPage(-1); }} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {reels.map((reel) => (
          <CompactReelCard key={reel._id} reel={reel} username={data.profile.username} surface="storefront-reels-shelf" className="w-[140px] sm:w-[160px] xl:w-[180px]" />
        ))}
        {!reels.length ? <EmptyState label="No reels published yet." /> : null}
      </div>
    </section>
  );
}

function CompactReelCard({ reel, username, surface = "creator-reels-grid", className = "" }) {
  const productCount = reel.products?.length || reel.productIds?.length || 0;
  return (
    <Link
      to={`/reels/${reel._id}`}
      onClick={() => trackPublicInfluencerEvent(username, { eventType: "reel_view", surface, reelId: reel._id }).catch(() => null)}
      className={`group relative shrink-0 snap-start overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="relative aspect-[9/16] bg-slate-950">
        {mediaOf(reel) ? <img src={mediaOf(reel)} alt={reel.title || reel.caption || "Creator reel"} className="h-full w-full object-cover opacity-90 transition group-hover:scale-105" loading="lazy" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
        {reel.durationSeconds ? <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-bold text-white">{formatDuration(reel.durationSeconds)}</span> : null}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-lg transition group-hover:scale-110"><Play className="h-5 w-5 fill-current" /></span>
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-1 p-2 text-[11px] font-bold text-white">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{compact(reel.metrics?.views || 0)}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{compact(reel.metrics?.likes || 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />{compact(reel.metrics?.orders || 0)}</span>
            <span>{compact(productCount)} Products</span>
          </div>
        </div>
        <div className="absolute inset-0 hidden items-center justify-center bg-slate-950/55 text-center text-white opacity-0 transition group-hover:flex group-hover:opacity-100">
          <div>
            <p className="text-sm font-black">Play Reel</p>
            <p className="mt-1 text-xs">{compact(reel.metrics?.views || 0)} views · {compact(reel.metrics?.likes || 0)} likes</p>
            <p className="mt-1 text-xs">{compact(reel.metrics?.orders || 0)} orders · {compact(productCount)} products</p>
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 min-h-9 text-xs font-bold text-slate-900 dark:text-white">{reel.title || reel.caption || "Shoppable reel"}</p>
        {reel.campaignBadge ? <p className="mt-1 truncate text-[11px] font-bold text-indigo-600">{reel.campaignBadge}</p> : null}
      </div>
    </Link>
  );
}

function PostActionButtons({ data, post, onRequireAuth }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const postId = post?._id || "";
  const [busyAction, setBusyAction] = useState("");
  const [liked, setLiked] = useState(() => getStoredActionSet("creator_post_likes").has(postId));
  const [saved, setSaved] = useState(() => getStoredActionSet("creator_post_saves").has(postId));
  const [counts, setCounts] = useState(() => ({
    likes: Number(post?.metrics?.likes || 0),
    comments: Number(post?.metrics?.comments || 0),
    shares: Number(post?.metrics?.shares || 0),
    saves: Number(post?.metrics?.saves || 0),
  }));

  const toggleStoredAction = useCallback((storageKey, nextValue) => {
    const values = getStoredActionSet(storageKey);
    if (nextValue) values.add(postId);
    else values.delete(postId);
    setStoredActionSet(storageKey, values);
  }, [postId]);

  async function handleEngagement(action) {
    if (!postId || busyAction) return;
    if ((action === "like" || action === "save") && !isAuthenticated) {
      onRequireAuth?.({ type: `post_${action}`, postId });
      return;
    }

    setBusyAction(action);
    try {
      if (action === "share") {
        const result = await shareStorefrontResource({
          username: data.profile.username,
          eventType: "share",
          surface: "post-card",
          title: post.caption || data.profile.name,
          url: `${window.location.origin}/influencer/${data.profile.username}/posts#${postId}`,
          payload: { postId, metadata: { action: "share" } },
        });
        if (result.shared) setCounts((current) => ({ ...current, shares: current.shares + 1 }));
        return;
      }

      const nextValue = action === "like" ? !liked : !saved;
      const metric = action === "like" ? "likes" : "saves";
      if (action === "like") setLiked(nextValue);
      else setSaved(nextValue);
      toggleStoredAction(action === "like" ? "creator_post_likes" : "creator_post_saves", nextValue);
      setCounts((current) => ({ ...current, [metric]: Math.max(0, current[metric] + (nextValue ? 1 : -1)) }));

      await trackPublicInfluencerEvent(data.profile.username, {
        eventType: "post_engagement",
        surface: "post-card",
        postId,
        metadata: { action: nextValue ? action : action === "like" ? "unlike" : "unsave" },
      });
    } catch {
      if (action === "like") setLiked((value) => !value);
      if (action === "save") setSaved((value) => !value);
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
        <span>{compact(counts.likes)} likes</span>
        <span>{compact(counts.comments)} comments</span>
        <span>{compact(counts.shares)} shares</span>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={() => handleEngagement("like")} disabled={busyAction === "like"} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-slate-800" aria-label={liked ? "Unlike post" : "Like post"} title={liked ? "Unlike post" : "Like post"}>
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>
        <button type="button" onClick={() => handleEngagement("share")} disabled={busyAction === "share"} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-slate-800" aria-label="Share post" title="Share post">
          <Share2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => handleEngagement("save")} disabled={busyAction === "save"} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-slate-800" aria-label={saved ? "Unsave post" : "Save post"} title={saved ? "Unsave post" : "Save post"}>
          <Bookmark className={`h-4 w-4 ${saved ? "fill-indigo-500 text-indigo-500" : ""}`} />
        </button>
      </div>
    </div>
  );
}

function PostsGrid({ data, posts = [], compactMode = false, onRequireAuth }) {
  return (
    <section>
      {!compactMode ? null : <SectionHeader title="Latest Posts" to={`/influencer/${data.profile.username}/posts`} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {posts.map((post) => (
          <article key={post._id} className="group overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="aspect-square bg-slate-100 dark:bg-slate-800">
              {mediaOf(post) ? <img src={mediaOf(post)} alt={post.caption || "Creator post"} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" /> : null}
            </div>
            <div className="space-y-2 p-3">
              <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{post.caption || "Creator post"}</p>
              <PostActionButtons data={data} post={post} onRequireAuth={onRequireAuth} />
            </div>
          </article>
        ))}
        {!posts.length ? <EmptyState label="No posts published yet." /> : null}
      </div>
    </section>
  );
}

function Sidebar({ data, following, followBusy = false, onFollow, onShare, canEdit }) {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const bio = data.profile.longBio || data.profile.bio || data.storefront.description || data.profile.shortBio || "";
  const visibleBio = expanded ? bio : bio.slice(0, 180);
  const categories = uniqueCategories(data);
  const categoryRows = topCategories(data);
  const location = [data.profile.location?.city, data.profile.location?.state, data.profile.location?.country].filter(Boolean).join(", ");

  async function subscribe(event) {
    event.preventDefault();
    setStatus("");
    try {
      await subscribePublicInfluencerNewsletter(data.profile.username, email);
      setStatus("Subscribed");
      setEmail("");
    } catch (err) {
      setStatus(err?.response?.data?.message || "Unable to subscribe");
    }
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:w-[290px] lg:shrink-0">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto h-28 w-28 overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
          {resolveApiAssetUrl(data.profile.avatarUrl) ? <img src={resolveApiAssetUrl(data.profile.avatarUrl)} alt={data.profile.name} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="mt-4 flex items-center justify-center gap-1">
          <h1 className="text-xl font-black text-slate-950 dark:text-white">{data.profile.name}</h1>
          {data.badge || data.profile.verified ? <BadgeCheck className="h-5 w-5 fill-indigo-600 text-white" aria-label="Verified creator" /> : null}
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-500">@{data.profile.username}</p>
        <p className="mt-1 text-xs font-bold text-indigo-600">{data.profile.primaryCategory || categories.slice(0, 3).join(" | ") || "Creator Store"}</p>
        {location ? <p className="mt-2 inline-flex items-center justify-center gap-1 text-xs font-semibold text-slate-500"><MapPin className="h-3.5 w-3.5" /> {location}</p> : null}

        <div className="mt-5 grid grid-cols-3 gap-2 border-y border-slate-100 py-4 dark:border-slate-800">
          <Metric label="Followers" value={compact(data.stats.followers)} />
          <Metric label="Orders" value={compact(data.stats.ordersGenerated)} />
          <Metric label="Sales" value={formatCurrency(data.stats.revenue || 0)} />
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          {canEdit ? (
            <Link to="/influencer/storefront-builder" className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-black text-white">Edit Store</Link>
          ) : (
            <button onClick={onFollow} disabled={followBusy} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-black ${following ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-indigo-600 text-white"}`}>
              {following ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {followBusy ? (following ? "Unfollowing..." : "Following...") : following ? "Following" : "Follow"}
            </button>
          )}
          <button onClick={onShare} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-indigo-600 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Share store" title="Share store">
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-left text-sm leading-6 text-slate-600 dark:text-slate-300">{visibleBio}{!expanded && bio.length > 180 ? "..." : ""}</p>
        {bio.length > 180 ? <button onClick={() => setExpanded((value) => !value)} className="mt-2 text-sm font-bold text-indigo-600">{expanded ? "Show Less" : "Show More"}</button> : null}
        <div className="mt-4 flex justify-center gap-2 text-slate-500">
          {(data.socialLinks || []).slice(0, 5).map((link) => (
            <a key={`${link.platform}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" onClick={() => trackPublicInfluencerEvent(data.profile.username, { eventType: "social_click", metadata: { platform: link.platform } })} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xs font-black uppercase hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700">
              {link.platform?.slice(0, 1) || "S"}
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-black text-slate-950 dark:text-white">Store Features</h2>
        <div className="mt-3 space-y-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
          {[
            [ShieldCheck, "100% Authentic Products"],
            [ShoppingBag, "Influencer Curated"],
            [Truck, "Fast Delivery"],
            [BadgeCheck, "Secure Payments"],
          ].map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-2"><Icon className="h-4 w-4 text-indigo-600" /> {label}</div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-black text-slate-950 dark:text-white">Top Categories</h2>
        <div className="mt-3 space-y-3">
          {(categoryRows.length ? categoryRows : ["Fashion", "Footwear", "Accessories", "Lifestyle", "Grooming"].map((name) => ({ name, count: 0 }))).map((category) => (
            <Link key={category.name} to={`/influencer/${data.profile.username}/storefront?search=${encodeURIComponent(category.name)}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-1 text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                <span className="truncate">{category.name}</span>
              </span>
              <span className="shrink-0 text-slate-500">{category.count}</span>
            </Link>
          ))}
        </div>
        <Link to={`/influencer/${data.profile.username}/storefront`} className="mt-5 inline-flex w-full items-center justify-center gap-2 text-sm font-black text-indigo-600 hover:text-indigo-700">
          View all categories <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-black text-slate-950 dark:text-white">Creator Updates</h2>
        <form onSubmit={subscribe} className="mt-3 space-y-2">
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950"><Send className="h-4 w-4" /> Subscribe</button>
          {status ? <p className="text-xs font-bold text-slate-500">{status}</p> : null}
        </form>
      </section>
    </aside>
  );
}

function ProfileHeader({ data, following, followBusy = false, onFollow, onShare, onCopy, onReport, onBlock, onMore, moreOpen, canEdit, actionStatus = "" }) {
  const location = [data.profile.location?.city, data.profile.location?.state, data.profile.location?.country].filter(Boolean).join(", ");
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="relative h-[300px] bg-slate-200 dark:bg-slate-800">
        {resolveApiAssetUrl(data.storefront.banner || data.profile.coverBanner) ? <img src={resolveApiAssetUrl(data.storefront.banner || data.profile.coverBanner)} alt="" className="h-full w-full object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg">
                {resolveApiAssetUrl(data.profile.avatarUrl) ? <img src={resolveApiAssetUrl(data.profile.avatarUrl)} alt={data.profile.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black">{data.profile.name}</h1>
                  {data.badge || data.profile.verified ? <BadgeCheck className="h-6 w-6 fill-sky-500 text-white" aria-label="Verified creator" /> : null}
                </div>
                <p className="mt-1 text-sm font-bold text-white/85">@{data.profile.username}</p>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-white/90">{data.profile.shortBio || data.storefront.tagline || data.storefront.description}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-white/85">
                  {location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {location}</span> : null}
                  {data.profile.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {data.profile.email}</span> : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Link to="/influencer/storefront-builder" className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-black text-white">Edit Profile</Link>
              ) : (
                <button onClick={onFollow} disabled={followBusy} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-black ${following ? "bg-white text-slate-950" : "bg-indigo-600 text-white"}`}>{following ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{followBusy ? (following ? "Unfollowing..." : "Following...") : following ? "Following" : "Follow"}</button>
              )}
              <button onClick={onShare} className="inline-flex items-center gap-2 rounded-md bg-white/95 px-4 py-2 text-sm font-black text-slate-950"><Share2 className="h-4 w-4" /> Share</button>
              <div className="relative">
                <button onClick={onMore} className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/95 text-slate-950" aria-label="More profile actions"><MoreHorizontal className="h-5 w-5" /></button>
                {moreOpen ? (
                  <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm font-bold text-slate-700 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    <button onClick={onReport} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><Flag className="h-4 w-4" /> Report Profile</button>
                    <button onClick={onCopy} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><Copy className="h-4 w-4" /> Copy Profile URL</button>
                    <button onClick={onBlock} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><X className="h-4 w-4" /> Block User</button>
                  </div>
                ) : null}
              </div>
            </div>
            {actionStatus ? <p className="mt-2 text-xs font-bold text-white/90">{actionStatus}</p> : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-4 dark:border-slate-800 md:grid-cols-4">
        <Metric label="Followers" value={compact(data.stats.followers)} />
        <Metric label="Following" value={compact(data.stats.following)} />
        <Metric label="Total Likes" value={compact(data.stats.totalLikes)} />
        <Metric label="Orders Generated" value={compact(data.stats.ordersGenerated)} />
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-950"><p className="text-lg font-black text-slate-950 dark:text-white">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div>;
}

function Tabs({ username, active }) {
  return (
    <nav className="overflow-x-auto rounded-lg border border-slate-200 bg-white px-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-max items-center justify-between gap-3">
        {TABS.map(([key, label]) => {
          const href = key === "storefront" ? `/influencer/${username}/storefront` : `/influencer/${username}/${key}`;
          return <Link key={key} to={href} className={`border-b-2 px-5 py-4 text-sm font-black transition ${active === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-950 dark:hover:text-white"}`}>{label}</Link>;
        })}
      </div>
    </nav>
  );
}

function ProductToolbar({ categories = [], category, setCategory, sort, setSort, view, setView, search, setSearch }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." className="w-full rounded-md border border-slate-200 bg-white px-9 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      </div>
      <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Filter category">
        <option value="">All Categories</option>
        {categories.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Sort products">
        <option value="popular">Sort by: Popular</option>
        <option value="price-low">Price: Low to High</option>
        <option value="price-high">Price: High to Low</option>
        <option value="rating">Rating</option>
      </select>
      <div className="flex rounded-md border border-slate-200 p-1 dark:border-slate-700">
        <button type="button" onClick={() => setView("grid")} className={`inline-flex h-9 w-9 items-center justify-center rounded ${view === "grid" ? "bg-indigo-600 text-white" : "text-slate-500"}`} aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></button>
        <button type="button" onClick={() => setView("list")} className={`inline-flex h-9 w-9 items-center justify-center rounded ${view === "list" ? "bg-indigo-600 text-white" : "text-slate-500"}`} aria-label="Compact view"><ListFilter className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function CollectionDetail({ data, collection, showSearch = true }) {
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("popular");
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const products = useMemo(() => {
    const text = search.trim().toLowerCase();
    let rows = productsOfCollection(collection);
    if (category) rows = rows.filter((product) => categoryOf(product) === category);
    if (text) rows = rows.filter((product) => [product.name, categoryOf(product), sellerNameOf(product), product.brand].filter(Boolean).join(" ").toLowerCase().includes(text));
    if (sort === "price-low") rows = [...rows].sort((a, b) => Number(a.discountPrice || a.price || 0) - Number(b.discountPrice || b.price || 0));
    else if (sort === "price-high") rows = [...rows].sort((a, b) => Number(b.discountPrice || b.price || 0) - Number(a.discountPrice || a.price || 0));
    else if (sort === "rating") rows = [...rows].sort((a, b) => Number(b.ratings?.averageRating || 0) - Number(a.ratings?.averageRating || 0));
    else rows = [...rows].sort((a, b) => Number(b.analytics?.views || b.analytics?.sales || 0) - Number(a.analytics?.views || a.analytics?.sales || 0));
    return rows;
  }, [category, collection, search, sort]);
  const categories = useMemo(() => [...new Set(productsOfCollection(collection).map(categoryOf).filter(Boolean))], [collection]);
  const analytics = analyticsOf(collection);

  if (!collection) return null;
  return (
    <section id={collection.slug} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
            <div className="aspect-[21/7] min-h-36">
              {mediaOf(collection) ? <img src={mediaOf(collection)} alt={collectionTitle(collection)} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-xs font-black uppercase tracking-wide text-white/80">{collection.type || "Creator Collection"}</p>
              <h2 className="mt-1 text-2xl font-black">{collectionTitle(collection)}</h2>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-white/90">{collection.description || "Creator curated products for this storefront."}</p>
            </div>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[420px]">
          <Metric label="Products" value={compact(productCountOf(collection))} />
          <Metric label="Orders" value={compact(analytics.orders || analytics.ordersGenerated || 0)} />
          <Metric label="Revenue" value={formatCurrency(analytics.revenue || analytics.revenueGenerated || 0)} />
          <Metric label="Clicks" value={compact(analytics.clicks || analytics.productClicks || 0)} />
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">{collectionTitle(collection)} Products</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{productCountOf(collection)} selected products for this collection</p>
        </div>
        <button type="button" onClick={() => shareStorefrontResource({ username: data.profile.username, eventType: "share", surface: "collection-detail", title: collectionTitle(collection), url: `${window.location.origin}/influencer/${data.profile.username}/collections#${collection.slug}`, payload: { collectionId: collection._id } })} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200"><Share2 className="h-4 w-4" /> Share Collection</button>
      </div>
      {showSearch ? <div className="mt-4"><ProductToolbar categories={categories} category={category} setCategory={setCategory} sort={sort} setSort={setSort} view={view} setView={setView} search={search} setSearch={setSearch} /></div> : null}
      <div className={`mt-5 ${view === "grid" ? "flex gap-4 overflow-x-auto pb-2" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}`}>
        {products.map((product) => <CreatorProductCard key={product._id} product={product} data={data} surface="collection" collectionId={collection._id} />)}
        {!products.length ? <EmptyState label="No products found in this collection." /> : null}
      </div>
    </section>
  );
}

function StorefrontTab({ data, initialCollectionSlug = "" }) {
  const collections = data.collections || [];
  const initialCollection = collections.find((collection) => collection.slug === initialCollectionSlug);
  const [selectedId, setSelectedId] = useState(initialCollection?._id || collections[0]?._id || "");
  useEffect(() => {
    if (initialCollection?._id && selectedId !== initialCollection._id) setSelectedId(initialCollection._id);
    else if (!selectedId && collections[0]?._id) setSelectedId(collections[0]._id);
  }, [collections, initialCollection?._id, selectedId]);
  const selectedCollection = collections.find((collection) => collection._id === selectedId) || collections[0];
  const products = data.featuredProducts?.length ? data.featuredProducts : allStorefrontProducts(data).slice(0, 12);
  return (
    <div className="space-y-5">
      <CollectionsRail data={data} collections={collections} selectedId={selectedCollection?._id} onSelect={(collection) => {
        setSelectedId(collection._id);
        trackPublicInfluencerEvent(data.profile.username, { eventType: "collection_view", surface: "storefront-collections", collectionId: collection._id }).catch(() => null);
      }} />
      {selectedCollection ? <CollectionDetail data={data} collection={selectedCollection} /> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <SectionHeader title="Featured Products" to={`/influencer/${data.profile.username}/collections`} />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {products.map((product) => <CreatorProductCard key={product._id} product={product} data={data} surface="storefront" />)}
          {!products.length ? <EmptyState label="No featured products yet." /> : null}
        </div>
      </section>
      <ReelsRail data={data} reels={data.reels || []} />
      <PostsGrid data={data} posts={data.posts || []} compactMode />
      <BenefitsBar />
    </div>
  );
}

function CollectionsTab({ data, initialCollectionSlug = "" }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("popular");
  const initialCollection = (data.collections || []).find((collection) => collection.slug === initialCollectionSlug);
  const [selectedId, setSelectedId] = useState(initialCollection?._id || data.collections?.[0]?._id || "");
  const collections = useMemo(() => {
    const text = query.trim().toLowerCase();
    let rows = [...(data.collections || [])];
    if (type) rows = rows.filter((collection) => collection.type === type);
    if (text) rows = rows.filter((collection) => [collectionTitle(collection), collection.description, collection.type, ...(collection.tags || []), ...productsOfCollection(collection).map((product) => product.name)].filter(Boolean).join(" ").toLowerCase().includes(text));
    if (sort === "newest") rows.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    else if (sort === "revenue") rows.sort((a, b) => Number(analyticsOf(b).revenue || 0) - Number(analyticsOf(a).revenue || 0));
    else if (sort === "commission") rows.sort((a, b) => Number(analyticsOf(b).commission || 0) - Number(analyticsOf(a).commission || 0));
    else rows.sort((a, b) => Number(analyticsOf(b).views || productCountOf(b)) - Number(analyticsOf(a).views || productCountOf(a)));
    return rows;
  }, [data.collections, query, sort, type]);
  useEffect(() => {
    if (initialCollection?._id && selectedId !== initialCollection._id) setSelectedId(initialCollection._id);
    else if (!collections.some((collection) => collection._id === selectedId)) setSelectedId(collections[0]?._id || "");
  }, [collections, initialCollection?._id, selectedId]);
  const selected = collections.find((collection) => collection._id === selectedId) || collections[0];
  const types = [...new Set((data.collections || []).map((collection) => collection.type).filter(Boolean))];
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">Collections</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Curated picks by {data.profile.name}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search collections..." className="w-full rounded-md border border-slate-200 bg-white px-9 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </div>
            <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Filter collections">
              <option value="">All types</option>
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Sort collections">
              <option value="popular">Popular</option>
              <option value="newest">Newest</option>
              <option value="revenue">Highest Revenue</option>
              <option value="commission">Highest Commission</option>
            </select>
          </div>
        </div>
      </section>
      <CollectionsRail data={data} collections={collections} selectedId={selected?._id} onSelect={(collection) => {
        setSelectedId(collection._id);
        if (collection.slug) navigate(`/influencer/${data.profile.username}/collections/${collection.slug}`, { replace: false });
        trackPublicInfluencerEvent(data.profile.username, { eventType: "collection_view", surface: "collections-tab", collectionId: collection._id }).catch(() => null);
      }} />
      {selected ? <CollectionDetail data={data} collection={selected} /> : <EmptyState label="No public collections found." />}
    </div>
  );
}

function ReelsTab({ data }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("newest");
  const reels = useMemo(() => {
    const text = query.trim().toLowerCase();
    let rows = [...(data.reels || [])];
    if (text) rows = rows.filter((reel) => [reel.title, reel.caption, reel.description, ...(reel.tags || [])].filter(Boolean).join(" ").toLowerCase().includes(text));
    if (filter === "campaign") rows = rows.filter((reel) => reel.campaignId || reel.campaignBadge || reel.sponsored);
    if (filter === "product") rows = rows.filter((reel) => (reel.products?.length || reel.productIds?.length || 0) > 0);
    if (filter === "views") rows.sort((a, b) => Number(b.metrics?.views || 0) - Number(a.metrics?.views || 0));
    else if (filter === "likes") rows.sort((a, b) => Number(b.metrics?.likes || 0) - Number(a.metrics?.likes || 0));
    else if (filter === "orders") rows.sort((a, b) => Number(b.metrics?.orders || 0) - Number(a.metrics?.orders || 0));
    else rows.sort((a, b) => new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0));
    return rows;
  }, [data.reels, filter, query]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reels" className="w-full rounded-md border border-slate-200 bg-white px-9 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[
              ["newest", "Newest"],
              ["views", "Most Viewed"],
              ["likes", "Most Liked"],
              ["orders", "Most Purchased"],
              ["campaign", "Campaign Reels"],
              ["product", "Product Reels"],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-black ${filter === key ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {reels.map((reel) => <CompactReelCard key={reel._id} reel={reel} username={data.profile.username} surface="creator-reels-grid" className="w-full" />)}
        {!reels.length ? <EmptyState label="No creator reels found." /> : null}
      </div>
    </div>
  );
}

function AboutTab({ data }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-2xl font-black text-slate-950 dark:text-white">About {data.profile.name}</h2>
      <p className="mt-4 whitespace-pre-line leading-7 text-slate-600 dark:text-slate-300">{data.profile.longBio || data.profile.bio || data.storefront.description || "This creator has not added a full biography yet."}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <InfoBlock title="Specializations" value={[data.profile.primaryCategory, ...(data.profile.secondaryCategories || []), ...(data.profile.contentNiche || [])].filter(Boolean).join(", ") || "Creator commerce"} />
        <InfoBlock title="Creator Journey" value={data.profile.moderation?.verifiedAt ? `Verified on ${new Date(data.profile.moderation.verifiedAt).toLocaleDateString()}` : "Active creator"} />
        <InfoBlock title="Brand Collaborations" value={data.profile.privacy?.showCampaignHistory ? "Campaign history is available to partners." : "Available on request."} />
        <InfoBlock title="Campaign History" value={`${compact(data.stats.ordersGenerated)} orders generated`} />
      </div>
    </section>
  );
}

function InfoBlock({ title, value }) {
  return <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><p className="text-xs font-black uppercase text-slate-500">{title}</p><p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p></div>;
}

function EmptyState({ label }) {
  return <div className="min-h-32 min-w-[220px] rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500 dark:border-slate-700">{label}</div>;
}

function LoginPromptModal({ onClose }) {
  const returnTo = encodeURIComponent(currentRelativeUrl());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Login required">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Join to follow creators</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Log in or create an account to follow this influencer and receive creator updates.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link to={`/login?redirect=${returnTo}`} className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white dark:bg-white dark:text-slate-950">Login</Link>
          <Link to={`/register?redirect=${returnTo}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">Register</Link>
        </div>
      </div>
    </div>
  );
}

function PublicStoreNav({ data, search, setSearch }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-black text-slate-950 dark:text-white">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">U</span>
          <span className="hidden sm:inline">UchooseMe</span>
        </Link>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, collections, influencers..." className="w-full rounded-lg border border-slate-200 bg-white px-9 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          {search ? <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
        </div>
        <nav className="hidden items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 lg:flex">
          <Link to="/categories" className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Grid2X2 className="h-4 w-4" /> Categories</Link>
          <Link to="/influencers" className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><TrendingUp className="h-4 w-4" /> Explore</Link>
          <Link to={`/influencer/${data.profile.username}/reels`} className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Play className="h-4 w-4" /> Reels</Link>
          <Link to="/offers" className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Percent className="h-4 w-4" /> Offers</Link>
        </nav>
      </div>
    </header>
  );
}

export function InfluencerPublicStorefrontPage() {
  const { username, slug, tab, collectionSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useAuthStore((state) => state.user);
  const routeUsername = username || slug;
  const active = activeTabFromRoute(tab || location.pathname.split("/").filter(Boolean)[2]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get("search") || "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    getPublicInfluencerStorefront(routeUsername, active, { search })
      .then((response) => {
        if (cancelled) return;
        setData(response?.data);
        setFollowing(Boolean(response?.data?.viewer?.isFollowing));
        if (response?.data?.seo?.title) document.title = response.data.seo.title;
      })
      .catch((err) => !cancelled && setError(err?.response?.data?.message || "Influencer storefront not found."));
    return () => { cancelled = true; };
  }, [active, routeUsername, search]);

  async function toggleFollow() {
    if (!useAuthStore.getState().isAuthenticated) {
      saveRedirectAfterLogin(currentRelativeUrl());
      pendingActionManager.setPendingAction("follow_creator", { username: routeUsername });
      setLoginPrompt(true);
      return;
    }
    const nextFollowing = !following;
    const previousFollowing = following;
    const previousFollowers = data?.stats?.followers || 0;
    if (previousFollowing && !(await confirmAction({ message: `Do you want to unfollow ${data?.profile?.name || "this creator"}?`, tone: "danger", confirmLabel: "Confirm" }))) return;
    setFollowBusy(true);
    setFollowing(nextFollowing);
    setData((current) => current ? {
      ...current,
      stats: {
        ...current.stats,
        followers: Math.max(0, Number(current.stats.followers || 0) + (nextFollowing ? 1 : -1)),
      },
      viewer: { ...current.viewer, isFollowing: nextFollowing },
    } : current);
    try {
      const response = previousFollowing ? await unfollowPublicInfluencer(routeUsername) : await followPublicInfluencer(routeUsername);
      setFollowing(Boolean(response?.data?.following));
      setActionStatus(response?.data?.following ? "You are following this creator." : "You unfollowed this creator.");
      setData((current) => current ? {
        ...current,
        stats: { ...current.stats, followers: response?.data?.followers ?? current.stats.followers },
        viewer: { ...current.viewer, isFollowing: Boolean(response?.data?.following) },
      } : current);
    } catch (err) {
      setFollowing(previousFollowing);
      setData((current) => current ? {
        ...current,
        stats: { ...current.stats, followers: previousFollowers },
        viewer: { ...current.viewer, isFollowing: previousFollowing },
      } : current);
      if (err?.response?.status === 401) setLoginPrompt(true);
      else setActionStatus("Unable to update follow status. Please try again.");
    }
    finally {
      setFollowBusy(false);
    }
  }

  const requireAuthenticatedAction = useCallback((action = {}) => {
    saveRedirectAfterLogin(currentRelativeUrl());
    pendingActionManager.setPendingAction(action.type || "storefront_action", { username: routeUsername, ...action });
    setLoginPrompt(true);
  }, [routeUsername]);

  async function handleShareProfile() {
    if (!data) return;
    const result = await shareStorefrontResource({
      username: data.profile.username,
      eventType: "share",
      surface: "profile-header",
      title: data.profile.name,
      url: window.location.href,
      payload: { metadata: { action: "share_profile" } },
    });
    if (result.shared) setActionStatus(result.destination === "copy_link" ? "Profile link copied." : "Profile shared.");
  }

  async function handleCopyProfileUrl() {
    if (!data || !navigator.clipboard) return;
    await navigator.clipboard.writeText(window.location.href);
    await trackPublicInfluencerEvent(data.profile.username, {
      eventType: "share",
      surface: "profile-menu",
      metadata: { action: "copy_profile_url", destination: "clipboard", url: window.location.href },
    }).catch(() => null);
    setMoreOpen(false);
    setActionStatus("Profile URL copied.");
  }

  async function handleReportProfile() {
    if (!data) return;
    await trackPublicInfluencerEvent(data.profile.username, {
      eventType: "profile_report",
      surface: "profile-menu",
      metadata: { action: "report_profile", url: window.location.href },
    }).catch(() => null);
    setMoreOpen(false);
    setActionStatus("Report submitted for moderation review.");
  }

  async function handleBlockProfile() {
    if (!data) return;
    const blocked = getStoredActionSet("blocked_creator_profiles");
    blocked.add(data.profile.username);
    setStoredActionSet("blocked_creator_profiles", blocked);
    await trackPublicInfluencerEvent(data.profile.username, {
      eventType: "profile_block",
      surface: "profile-menu",
      metadata: { action: "block_profile" },
    }).catch(() => null);
    setMoreOpen(false);
    setActionStatus("Creator blocked on this device.");
    navigate("/influencers", { replace: true });
  }

  function toggleFilters() {
    const nextOpen = !filtersOpen;
    setFiltersOpen(nextOpen);
    if (nextOpen && data) {
      trackPublicInfluencerEvent(data.profile.username, {
        eventType: "search",
        surface: "storefront-filters",
        metadata: { action: "open_filters", activeTab: active, search },
      }).catch(() => null);
    }
  }

  const content = useMemo(() => {
    if (!data) return null;
    if (active === "posts") return <PostsGrid data={data} posts={data.posts || []} onRequireAuth={requireAuthenticatedAction} />;
    if (active === "reels") return <ReelsTab data={data} />;
    if (active === "collections") return <CollectionsTab data={data} initialCollectionSlug={collectionSlug} />;
    if (active === "about") return <AboutTab data={data} />;
    return <StorefrontTab data={data} initialCollectionSlug={collectionSlug} />;
  }, [active, collectionSlug, data, requireAuthenticatedAction]);

  const canEdit = Boolean(
    data?.viewer?.isOwner ||
    (authUser?._id && data?.profile?.userId && String(authUser._id) === String(data.profile.userId)) ||
    (authUser?.id && data?.profile?.userId && String(authUser.id) === String(data.profile.userId))
  );

  if (error) return <main className="mx-auto max-w-5xl p-6"><div className="rounded-lg border border-rose-200 bg-rose-50 p-6 font-bold text-rose-700">{error}</div></main>;
  if (!data) return <main className="mx-auto max-w-5xl p-6"><div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading creator storefront...</div></main>;

  return (
    <>
    <PublicStoreNav data={data} search={search} setSearch={setSearch} />
    <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data.seo?.structuredData || {}) }} />
      {actionStatus ? <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">{actionStatus}</div> : null}
      <div className="flex flex-col gap-5 lg:flex-row">
        <Sidebar data={data} following={following} followBusy={followBusy} onFollow={toggleFollow} onShare={handleShareProfile} canEdit={canEdit} />
        <section className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
            <Tabs username={data.profile.username} active={active} />
            <button type="button" onClick={handleShareProfile} className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 px-4 py-2 text-sm font-black text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/40"><Share2 className="h-4 w-4" /> Share Store</button>
          </div>
          <button type="button" onClick={toggleFilters} aria-expanded={filtersOpen} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Filters <ChevronDown className="h-4 w-4" /></button>
          {filtersOpen ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap gap-2">
                {TABS.map(([key, label]) => (
                  <Link
                    key={key}
                    to={key === "storefront" ? `/influencer/${data.profile.username}/storefront` : `/influencer/${data.profile.username}/${key}`}
                    onClick={() => trackPublicInfluencerEvent(data.profile.username, { eventType: "search", surface: "storefront-filters", metadata: { action: "select_filter_tab", tab: key } }).catch(() => null)}
                    className={`rounded-full px-3 py-2 text-xs font-black ${active === key ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Search is applied across creator products, collections, reels, and posts.</p>
            </div>
          ) : null}
          {content}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        {canEdit ? (
          <Link to="/influencer/storefront-builder" className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-3 text-sm font-black text-white">Edit Profile</Link>
        ) : (
          <button onClick={toggleFollow} disabled={followBusy} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-3 text-sm font-black text-white">
            {following ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {followBusy ? (following ? "Unfollowing..." : "Following...") : following ? "Following" : "Follow Creator"}
          </button>
        )}
      </div>
      {loginPrompt ? <LoginPromptModal onClose={() => setLoginPrompt(false)} /> : null}
    </main>
    </>
  );
}

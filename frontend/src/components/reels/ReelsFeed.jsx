import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  AlertCircle,
  Bookmark,
  ChevronLeft,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Share2,
  ShoppingBag,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { useProductCardVariant } from "../../hooks/useProductCardVariant";
import { resolveSwatchColor } from "../../utils/variantDisplay";
import {
  getReelSessionId,
  setReelAttribution,
  trackReelProductClick,
  trackReelView,
} from "../../services/reelService";
import { navigateToProduct } from "../../utils/scrollPageToTop";
import { getReelLinkedProducts } from "../../utils/reelProducts";
import { ReelCommentDrawer } from "./ReelCommentDrawer";
import { ReelShareSheet } from "./ReelShareSheet";


function StarRating({ rating = 0 }) {
  const stars = Math.round(Number(rating || 0));
  return (
    <span className="text-amber-400">
      {"★".repeat(Math.min(5, stars))}
      {"☆".repeat(Math.max(0, 5 - stars))}
    </span>
  );
}

function TikTokProductCard({ product, onShop }) {
  const {
    swatchOptions,
    selectedSwatchValue,
    imageUrl,
    pricing,
    inStock,
    activeVariant,
    selectSwatchValue,
  } = useProductCardVariant(product);

  if (!product) return null;

  return (
    <div
      className="flex w-full max-w-lg flex-col gap-2 rounded-2xl border border-white/15 bg-black/55 p-3 text-left backdrop-blur-md"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onShop(product, activeVariant?.variantId)}
        className="flex w-full items-center gap-3 text-left transition hover:opacity-95"
      >
        <img
          src={imageUrl || resolveApiAssetUrl(product.images?.[0] || product.image)}
          alt={product.name}
          className="h-14 w-14 rounded-xl object-cover ring-1 ring-white/20"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{product.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-base font-black text-white">
              {formatCurrency(pricing.hasDiscount ? pricing.salePrice : pricing.price)}
            </span>
            {pricing.hasDiscount ? (
              <span className="text-xs text-zinc-400 line-through">{formatCurrency(pricing.price)}</span>
            ) : null}
            {product.rating ? (
              <span className="text-xs">
                <StarRating rating={product.rating} />
              </span>
            ) : null}
          </div>
          <p className={`mt-1 text-[11px] font-semibold ${inStock ? "text-emerald-400" : "text-red-400"}`}>
            {inStock ? "In stock" : "Out of stock"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-red-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-red-900/40">
          Shop Now
        </span>
      </button>
      {swatchOptions.length ? (
        <div className="flex items-center gap-1.5 pl-[4.25rem]" aria-label="Available colors">
          {swatchOptions.map((option) => {
            const isSelected = selectedSwatchValue === option.value;
            const swatchColor = resolveSwatchColor(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-label={option.value}
                title={option.value}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectSwatchValue(option.value);
                }}
                className={`h-3.5 w-3.5 rounded-full border border-white/30 transition ${
                  isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-black/40" : ""
                }`}
                style={{ backgroundColor: swatchColor || "#94a3b8" }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ReelSlide({
  reel,
  isActive,
  onLike,
  preloadNextUrl,
}) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const viewTrackedRef = useRef(false);
  const watchStartRef = useRef(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [productIndex, setProductIndex] = useState(0);
  const sessionId = getReelSessionId();
  const products = getReelLinkedProducts(reel);
  const activeProduct = products[productIndex] || products[0];
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!preloadNextUrl) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = resolveApiAssetUrl(preloadNextUrl);
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, [preloadNextUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      watchStartRef.current = Date.now();
      viewTrackedRef.current = false;
      video.currentTime = 0;
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  }, [isActive, reel?._id]);

  const tryTrackView = useCallback(() => {
    if (viewTrackedRef.current || !isActive || !reel?._id) return;
    const video = videoRef.current;
    if (!video) return;

    const viewDuration = video.currentTime || (Date.now() - watchStartRef.current) / 1000;
    const videoDuration = video.duration || 0;
    const qualified = viewDuration >= 3 || (videoDuration > 0 && viewDuration / videoDuration >= 0.5);

    if (!qualified) return;

    viewTrackedRef.current = true;
    trackReelView(reel?._id, {
      sessionId,
      viewDuration,
      videoDuration,
    }).catch(() => {});
  }, [isActive, reel._id, sessionId]);

  useEffect(() => {
    if (!isActive) return undefined;
    const timer = window.setInterval(tryTrackView, 1000);
    return () => window.clearInterval(timer);
  }, [isActive, tryTrackView]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  }

  async function handleShop(product, variantId = "") {
    const productId = product.productId || product._id;
    await trackReelProductClick(reel._id, {
      productId,
      sessionId,
    }).catch(() => {});
    setReelAttribution({ reelId: reel._id, productId, sessionId });
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "reel_return_context",
        JSON.stringify({ reelId: reel._id, returnUrl: `/reels?reel=${reel._id}` })
      );
    }
    const params = new URLSearchParams({ reel: reel._id });
    if (variantId) params.set("variantId", String(variantId));
    navigateToProduct(navigate, `/product/${product.slug || productId}?${params.toString()}`);
  }

  function handleDoubleTap() {
    if (!reel.liked) {
      setLikeBurst(true);
      window.setTimeout(() => setLikeBurst(false), 700);
      onLike?.();
    }
  }

  function handleVideoTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleDoubleTap();
    } else {
      togglePlay();
    }
    lastTapRef.current = now;
  }

  // Validate reel data
  if (!reel || !reel._id || !reel.videoUrl) {
    return (
      <section className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center bg-black/20 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-zinc-300">Reel data unavailable</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center">
      <div 
        className="relative flex h-[100dvh] w-full max-w-full items-stretch justify-center overflow-hidden rounded-none sm:h-[96dvh] sm:max-w-[480px] sm:rounded-[2.5rem] md:h-[90dvh] md:max-w-[420px] md:rounded-[3rem]"
        style={{
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          maskImage: 'radial-gradient(white, black)',
          transform: 'translateZ(0)',
          isolation: 'isolate'
        }}
      >
        <video
          ref={videoRef}
          src={resolveApiAssetUrl(reel.videoUrl)}
          poster={resolveApiAssetUrl(reel.thumbnailUrl)}
          className="h-full w-full object-cover"
          playsInline
          muted={muted}
          loop
          preload={isActive ? "auto" : "metadata"}
          onTimeUpdate={tryTrackView}
        />

        <button
          type="button"
          aria-label="Toggle playback"
          onClick={handleVideoTap}
          className="absolute inset-0 z-10"
        />

        <AnimatePresence>
          {likeBurst ? (
            <Motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
              <Heart className="h-28 w-28 fill-red-500 text-red-500 drop-shadow-2xl" />
            </Motion.div>
          ) : null}
        </AnimatePresence>

        {!isActive || paused ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <span className="rounded-full bg-black/40 p-4 text-white backdrop-blur-sm">
              {paused ? <Play className="h-8 w-8" /> : null}
            </span>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

        <div className="absolute left-3 top-8 z-30 sm:top-3 md:hidden">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 2) {
                navigate(-1);
              } else {
                navigate("/");
              }
            }}
            className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          className="absolute right-3 top-8 z-30 rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm sm:top-3"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <div className="absolute bottom-0 left-0 right-0 z-30 space-y-3 p-4 pb-8">
          <div className="space-y-2">
              {/* <p className="line-clamp-2 text-sm font-semibold text-white">{reel.title}</p> */}
            {reel.description ? (
              <p className="line-clamp-2 text-xs text-zinc-200">{reel.description}</p>
            ) : null}
            {reel.tags?.length ? (
              <p className="text-xs font-medium text-red-300">
                {reel.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}
              </p>
            ) : null}
            {reel.musicName ? (
              <p className="inline-flex items-center gap-1 text-xs text-zinc-300">
                <Music2 className="h-3.5 w-3.5" />
                {reel.musicName}
              </p>
            ) : null}
            {reel.location ? (
              <p className="inline-flex items-center gap-1 text-xs text-zinc-300">
                <MapPin className="h-3.5 w-3.5" />
                {reel.location}
              </p>
            ) : null}
          </div>

          {activeProduct ? (
            <div className="pointer-events-auto">
              {products.length > 1 ? (
                <div className="mb-2 flex gap-2 overflow-x-auto">
                  {products.map((product, index) => (
                    <button
                      key={product.productId || product._id}
                      type="button"
                      onClick={() => setProductIndex(index)}
                      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                        index === productIndex ? "bg-red-600 text-white" : "bg-white/10 text-zinc-300"
                      }`}
                    >
                      {product.name?.slice(0, 18)}
                    </button>
                  ))}
                </div>
              ) : null}
              <TikTokProductCard
                product={{
                  ...activeProduct,
                  _id: activeProduct.productId || activeProduct._id,
                  images: activeProduct.images || (activeProduct.image ? [activeProduct.image] : []),
                }}
                onShop={handleShop}
              />
            </div>
          ) : null}
        </div>
      </div>

    </section>
  );
}

export function ReelsFeed({ reels, loading, hasMore, onLoadMore, onReelsUpdate, onLike }) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentReel, setCommentReel] = useState(null);
  const [shareReel, setShareReel] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const slides = container.querySelectorAll("[data-reel-slide]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.getAttribute("data-index") || 0);
          setActiveIndex(index);
        });
      },
      { root: container, threshold: 0.72 }
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    if (activeIndex >= reels.length - 3 && hasMore && !loading) {
      onLoadMore?.();
    }
  }, [activeIndex, reels.length, hasMore, loading, onLoadMore]);

  function patchReel(reelId, patch) {
    onReelsUpdate?.((current) =>
      current.map((item) => (item._id === reelId ? { ...item, ...patch } : item))
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain bg-black/10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reels.map((reel, index) => (
          <div key={reel._id} data-reel-slide data-index={index}>
            <ReelSlide
              reel={reel}
              isActive={index === activeIndex}
              preloadNextUrl={reels[index + 1]?.videoUrl}
              onLike={() => onLike?.(reel)}
            />
          </div>
        ))}

        {loading ? (
          <div className="flex h-[30dvh] snap-start items-center justify-center text-sm text-zinc-400">
            Loading more reels...
          </div>
        ) : null}

        {!loading && !reels.length ? (
          <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center text-zinc-400">
            <p className="text-lg font-bold text-white">No reels yet</p>
            <p className="text-sm">Check back soon for shoppable short videos.</p>
            <Link to="/" className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white">
              Back to home
            </Link>
          </div>
        ) : null}
      </div>

      <ReelCommentDrawer
        reel={commentReel}
        open={Boolean(commentReel)}
        onClose={() => setCommentReel(null)}
        onCountChange={(count) => commentReel && patchReel(commentReel._id, { commentsCount: count })}
      />

      <ReelShareSheet
        reel={shareReel}
        open={Boolean(shareReel)}
        onClose={() => setShareReel(null)}
        onShare={async (platform) => {
          if (!shareReel) return;
          const { shareReel: shareApi, getReelSessionId } = await import("../../services/reelService");
          await shareApi(shareReel._id, { platform, sessionId: getReelSessionId() }).catch(() => {});
          patchReel(shareReel._id, { sharesCount: (shareReel.sharesCount || 0) + 1 });
        }}
      />
    </>
  );
}

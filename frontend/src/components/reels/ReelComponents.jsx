import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Share2,
  ShoppingBag,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import {
  getReelSessionId,
  setReelAttribution,
  trackReelProductClick,
  trackReelView,
} from "../../services/reelService";

function formatCount(value = 0) {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

export function ReelProductOverlay({ reel, product, onProductClick }) {
  if (!product) return null;
  const price = product.salePrice ?? product.price ?? 0;
  const original = product.salePrice ? product.price : null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-16">
      <button
        type="button"
        onClick={() => onProductClick?.(product)}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-left backdrop-blur-md transition hover:bg-white/20"
      >
        <img
          src={resolveApiAssetUrl(product.images?.[0] || product.image)}
          alt={product.name}
          className="h-14 w-14 rounded-xl object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{product.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-300">{formatCurrency(price)}</span>
            {original ? (
              <span className="text-xs text-white/60 line-through">{formatCurrency(original)}</span>
            ) : null}
            {product.rating ? (
              <span className="text-xs text-amber-300">★ {Number(product.rating).toFixed(1)}</span>
            ) : null}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-900">
          <ShoppingBag className="h-3.5 w-3.5" />
          Shop
        </span>
      </button>
    </div>
  );
}

export function ReelCard({
  reel,
  layout = "card",
  onLike,
  onSave,
  onShare,
  onComment,
  isAuthenticated,
}) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const sessionId = getReelSessionId();
  const primaryProduct = reel.products?.[0];

  useEffect(() => {
    if (!reel?._id) return;
    trackReelView(reel._id, { sessionId, viewDuration: 0 }).catch(() => {});
  }, [reel?._id, sessionId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || layout === "card") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
          setPlaying(true);
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [layout, reel?.videoUrl]);

  async function handleProductClick(product) {
    await trackReelProductClick(reel._id, {
      productId: product._id,
      sessionId,
    }).catch(() => {});
    setReelAttribution({ reelId: reel._id, productId: product._id, sessionId });
    navigate(`/product/${product._id}?reel=${reel._id}`);
  }

  const stats = [
    { icon: Heart, label: formatCount(reel.likesCount), active: reel.liked, action: onLike },
    { icon: MessageCircle, label: formatCount(reel.commentsCount), action: onComment },
    { icon: Share2, label: formatCount(reel.sharesCount), action: onShare },
    { icon: Bookmark, label: formatCount(reel.savesCount), active: reel.saved, action: onSave },
  ];

  if (layout === "feed") {
    return (
      <div className="relative mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-md snap-start snap-always flex-col overflow-hidden rounded-3xl bg-black shadow-2xl">
        <video
          ref={videoRef}
          src={resolveApiAssetUrl(reel.videoUrl)}
          poster={resolveApiAssetUrl(reel.thumbnailUrl)}
          className="h-full w-full object-cover"
          playsInline
          muted={muted}
          loop
          preload="metadata"
        />
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          className="absolute right-4 top-4 z-30 rounded-full bg-black/40 p-2 text-white"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <div className="absolute inset-y-0 right-3 z-20 flex flex-col items-center justify-end gap-4 pb-36">
          {stats.map(({ icon: Icon, label, active, action }) => (
            <button
              key={Icon.name}
              type="button"
              onClick={action}
              className="flex flex-col items-center gap-1 text-white"
            >
              <span className={`rounded-full p-2 ${active ? "bg-rose-500" : "bg-black/40"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold">{label}</span>
            </button>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 p-4 pb-6">
          <div>
            <p className="text-sm font-bold text-white">{reel.title}</p>
            <p className="text-xs text-white/70">
              {reel.createdBy?.name || "Creator"} · {formatCount(reel.viewsCount)} views
            </p>
          </div>
          {primaryProduct ? (
            <ReelProductOverlay reel={reel} product={primaryProduct} onProductClick={handleProductClick} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-lg dark:border-slate-800">
      <Link to={`/reels?reel=${reel._id}`} className="block">
        <div className="relative aspect-[9/16] bg-black">
          <video
            ref={videoRef}
            src={resolveApiAssetUrl(reel.videoUrl)}
            poster={resolveApiAssetUrl(reel.thumbnailUrl)}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
            onMouseEnter={(event) => event.currentTarget.play().catch(() => {})}
            onMouseLeave={(event) => {
              event.currentTarget.pause();
              event.currentTarget.currentTime = 0;
            }}
          />
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-3">
            <p className="line-clamp-2 text-sm font-bold text-white">{reel.title}</p>
            <p className="text-xs text-white/70">{reel.createdBy?.name || "Creator"}</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3 text-xs text-white">
            <span>{formatCount(reel.viewsCount)} views</span>
            <span>{formatCount(reel.likesCount)} likes</span>
          </div>
        </div>
      </Link>

      {primaryProduct ? (
        <div className="border-t border-white/10 bg-slate-900 p-3">
          <button
            type="button"
            onClick={() => handleProductClick(primaryProduct)}
            className="flex w-full items-center gap-3 text-left"
          >
            <img
              src={resolveApiAssetUrl(primaryProduct.images?.[0])}
              alt={primaryProduct.name}
              className="h-10 w-10 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{primaryProduct.name}</p>
              <p className="text-xs text-emerald-300">
                {formatCurrency(primaryProduct.salePrice ?? primaryProduct.price ?? 0)}
              </p>
            </div>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ReelsSection({ title, sort, limit = 8 }) {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { listReels } = await import("../../services/reelService");
        const data = await listReels({ sort, limit });
        if (!cancelled) setReels(data.reels || []);
      } catch {
        if (!cancelled) setReels([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sort, limit]);

  if (loading) {
    return (
      <section className="px-4 py-8 lg:px-8">
        <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-[9/16] animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </section>
    );
  }

  if (!reels.length) return null;

  return (
    <section className="px-4 py-8 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <Link to={`/reels?sort=${sort}`} className="text-sm font-semibold text-orange-600 hover:text-orange-500">
          View all
        </Link>
      </div>

      <div className="hidden xl:grid xl:grid-cols-4 xl:gap-4">
        {reels.map((reel) => (
          <ReelCard key={reel._id} reel={reel} layout="card" />
        ))}
      </div>

      <div className="hidden md:grid md:grid-cols-2 md:gap-4 xl:hidden">
        {reels.slice(0, 6).map((reel) => (
          <ReelCard key={reel._id} reel={reel} layout="card" />
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 md:hidden">
        {reels.map((reel) => (
          <div key={reel._id} className="min-w-[220px] max-w-[220px] shrink-0">
            <ReelCard reel={reel} layout="card" />
          </div>
        ))}
      </div>
    </section>
  );
}

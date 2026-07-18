import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Share2,
  ShoppingBag,
  Volume2,
  VolumeX,
  Eye,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import {
  getReelSessionId,
  setReelAttribution,
  trackReelProductClick,
  trackReelView,
} from "../../services/reelService";
import { navigateToProduct } from "../../utils/scrollPageToTop";
import { getReelLinkedProducts } from "../../utils/reelProducts";
import { ReelCarousel } from "./ReelCarousel";

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
    <div className="absolute bottom-[18px] left-[18px] right-[18px] z-20 h-[74px] rounded-full bg-[rgba(55,55,55,0.72)] px-[14px] py-[10px] shadow-xl backdrop-blur-[20px] transition-all duration-[400ms] ease-out group-hover:bg-[rgba(45,45,45,0.82)] group-hover:backdrop-blur-[24px]">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onProductClick?.(product);
        }}
        className="flex h-full w-full items-center gap-3 text-left"
      >
        <img
          src={resolveApiAssetUrl(product.images?.[0] || product.image)}
          alt={product.name}
          className="h-14 w-14 shrink-0 rounded-full border-2 border-white object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-white">{product.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{formatCurrency(price)}</span>
            {original ? (
              <span className="text-sm text-[#9CA3AF] line-through">{formatCurrency(original)}</span>
            ) : null}
          </div>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-lg transition-colors duration-300 hover:bg-[#ef4444] hover:text-white">
          <Eye className="h-5 w-5" />
        </div>
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
  const location = useLocation();
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const sessionId = getReelSessionId();
  const primaryProduct = getReelLinkedProducts(reel)[0];

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
    navigateToProduct(navigate, `/product/${product.slug || productId}?reel=${reel._id}`);
  }

  const stats = [
    { icon: Heart, label: formatCount(reel.likesCount), active: reel.liked, action: onLike },
    { icon: MessageCircle, label: formatCount(reel.commentsCount), action: onComment },
    { icon: Share2, label: formatCount(reel.sharesCount), action: onShare },
    { icon: Bookmark, label: formatCount(reel.savesCount), active: reel.saved, action: onSave },
  ];

  if (layout === "feed") {
    return (
      <div className="relative mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-md snap-start snap-always flex-col overflow-hidden rounded-3xl bg-black/20 shadow-2xl backdrop-blur-sm">
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
          className="absolute right-4 top-4 z-30 rounded-full bg-black/20 p-2 text-white backdrop-blur-sm"
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
              <span className={`rounded-full p-2 ${active ? "bg-rose-500" : "bg-black/20"}`}>
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
    <div className="group relative mx-auto h-[560px] w-[360px] max-w-full overflow-hidden rounded-[28px] bg-white shadow-[0_28px_70px_rgba(0,0,0,0.22)] transition-all duration-[400ms] ease-out hover:-translate-y-[10px] hover:shadow-[0_40px_80px_rgba(0,0,0,0.28)]">
      <Link to={`/reels?reel=${reel._id}`} state={{ background: location }} className="block h-full w-full">
        <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-slate-100">
          <video
            ref={videoRef}
            src={resolveApiAssetUrl(reel.videoUrl)}
            poster={resolveApiAssetUrl(reel.thumbnailUrl)}
            className="h-full w-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]"
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

          {primaryProduct ? (
            <ReelProductOverlay reel={reel} product={primaryProduct} onProductClick={handleProductClick} />
          ) : null}
        </div>
      </Link>
    </div>
  );
}

export function ReelsSection({ title, sort, limit = 3 }) {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { listReels } = await import("../../services/reelService");
        const data = await listReels({ sort, limit, showOnStorefront: true });
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

  return (
    <ReelCarousel
      items={reels}
      loading={loading}
      title={title}
      showDots={true}
      swipeEnabled={true}
      desktopItemsPerView={3}
      tabletItemsPerView={2}
    />
  );
}

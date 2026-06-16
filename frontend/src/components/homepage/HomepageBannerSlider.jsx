import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { getHomepageBanners, trackHomepageBannerEvent } from "../../services/homepageBannerService";

function getSessionId() {
  if (typeof window === "undefined") return "";
  const key = "homepage_banner_session";
  let sessionId = window.sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `hb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false
  );

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (event) => setIsMobile(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

function preloadBannerImages(banners = []) {
  banners.forEach((banner) => {
    [banner.desktopImage, banner.mobileImage].forEach((src) => {
      const url = resolveApiAssetUrl(src);
      if (!url) return;
      const img = new Image();
      img.src = url;
    });
  });
}

function BannerCategoryCard({ card, onSelect, previewMode = false, compact = false }) {
  const image = resolveApiAssetUrl(card.cardImage);

  if (compact) {
    const inner = (
      <>
        <div className="category-card-image-container relative aspect-square overflow-hidden bg-zinc-900">
          {image ? (
            <img src={image} alt={card.title} className="category-card-image block h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-black text-red-400">
              {(card.title || "C").slice(0, 1)}
            </div>
          )}
        </div>
        <div className="space-y-0.5 bg-zinc-950 px-1.5 py-2 text-center">
          <p className="truncate text-[9px] font-bold text-white sm:text-[10px]">{card.title}</p>
          {card.showProductCount !== false && card.productCount != null ? (
            <p className="text-[8px] font-semibold uppercase tracking-wide text-zinc-400 sm:text-[9px]">
              {card.productCount} Products
            </p>
          ) : null}
          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wide text-red-400 sm:text-[9px]">
            Explore <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </>
    );

    if (previewMode) {
      return (
        <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-md">{inner}</div>
      );
    }

    return (
      <Link
        to={card.ctaUrl || `/category/${card.slug}`}
        onClick={() => onSelect?.(card)}
        className="group flex flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-md transition hover:-translate-y-0.5 hover:border-red-500"
      >
        {inner}
      </Link>
    );
  }

  const content = (
    <>
      <div className="category-card-image-container relative aspect-[4/3] overflow-hidden bg-zinc-900">
        {image ? (
          <img src={image} alt={card.title} className="category-card-image block h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-black text-red-400">
            {(card.title || "C").slice(0, 1)}
          </div>
        )}
      </div>
      <div className="space-y-1 bg-zinc-950 px-3 py-3 text-center">
        <p className="truncate text-xs font-bold text-white sm:text-sm">{card.title}</p>
        {card.showProductCount !== false && card.productCount != null ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {card.productCount} Products
          </p>
        ) : null}
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-400">
          Explore <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </>
  );

  if (previewMode) {
    return (
      <div className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 shadow-lg">{content}</div>
    );
  }

  return (
    <Link
      to={card.ctaUrl || `/category/${card.slug}`}
      onClick={() => onSelect?.(card)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 shadow-lg transition hover:-translate-y-1 hover:border-red-500 hover:shadow-xl"
    >
      {content}
    </Link>
  );
}

export function HomepageBannerSlider({
  banners = [],
  settings = {},
  className = "",
  previewMode = false,
  initialIndex = 0,
  embedded = false,
  headerSlot = null,
}) {
  const [index, setIndex] = useState(initialIndex);
  const trackedRef = useRef(new Set());
  const touchStartX = useRef(null);
  const containerRef = useRef(null);
  const sessionId = useMemo(() => getSessionId(), []);
  const isMobile = useIsMobile();

  const activeBanner = banners[index] || banners[0] || null;
  const autoplay = !previewMode && settings.autoplay !== false;
  const intervalMs = Math.max(3000, Number(settings.autoplayIntervalMs || 5000));

  const goTo = useCallback(
    (nextIndex) => {
      if (!banners.length) return;
      setIndex((nextIndex + banners.length) % banners.length);
    },
    [banners.length]
  );

  useEffect(() => {
    setIndex((current) => (current >= banners.length ? 0 : current));
  }, [banners.length]);

  useEffect(() => {
    if (previewMode || !banners.length) return undefined;
    preloadBannerImages(banners);
  }, [banners, previewMode]);

  useEffect(() => {
    if (!autoplay || banners.length <= 1) return undefined;
    const timer = window.setInterval(() => goTo(index + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoplay, banners.length, goTo, index, intervalMs]);

  useEffect(() => {
    if (previewMode || !activeBanner?.id) return;
    const key = `${activeBanner.id}:view`;
    if (trackedRef.current.has(key)) return;
    trackedRef.current.add(key);
    trackHomepageBannerEvent(activeBanner.id, { eventType: "view", sessionId }).catch(() => {});
  }, [activeBanner?.id, previewMode, sessionId]);

  useEffect(() => {
    if (previewMode || banners.length <= 1) return undefined;

    function onKeyDown(event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [banners.length, goTo, index, previewMode]);

  const handleBannerCta = () => {
    if (previewMode || !activeBanner?.id) return;
    trackHomepageBannerEvent(activeBanner.id, { eventType: "click", sessionId }).catch(() => {});
  };

  const handleCategoryClick = (card) => {
    if (previewMode || !activeBanner?.id) return;
    trackHomepageBannerEvent(activeBanner.id, {
      eventType: "category_click",
      categoryId: card.categoryId,
      sessionId,
    }).catch(() => {});
  };

  const handleTouchStart = (event) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStartX.current == null || banners.length <= 1) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    goTo(delta > 0 ? index - 1 : index + 1);
  };

  if (!banners.length || !activeBanner) return null;

  const heroImage = resolveApiAssetUrl(
    isMobile && activeBanner.mobileImage ? activeBanner.mobileImage : activeBanner.desktopImage || activeBanner.mobileImage
  );
  const categories = Array.isArray(activeBanner.categories) ? activeBanner.categories.slice(0, 4) : [];

  return (
    <div className={`relative ${embedded ? "h-full w-full" : "w-full"} ${className}`} ref={containerRef}>
      <div
        className={`relative h-full w-full overflow-hidden ${embedded ? "min-h-[400px] sm:min-h-[550px] md:min-h-[700px]" : "rounded-[1.5rem] border border-zinc-200 bg-white shadow-xl sm:rounded-[2rem]"}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="region"
        aria-roledescription="carousel"
        aria-label="Homepage banners"
      >
        <div className="absolute inset-0 z-0 bg-white">
          {heroImage ? (
            <img
              src={heroImage}
              alt={activeBanner.title || activeBanner.name}
              className="h-full w-full object-contain object-center"
              loading={index === 0 ? "eager" : "lazy"}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-zinc-100 via-white to-red-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/45" />
        </div>

        <div className={`relative z-10 flex h-full w-full flex-col overflow-hidden ${embedded ? "min-h-0" : ""}`}>
          {headerSlot ? (
            <div className="relative z-30 shrink-0 px-4 pb-2 pt-4 sm:px-6 sm:pb-3 lg:px-8 lg:pt-5">
              {headerSlot}
            </div>
          ) : null}

          <div
            className={`mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center gap-4 overflow-hidden px-4 pb-6 sm:px-6 lg:flex-row lg:items-center lg:gap-8 lg:px-8 lg:pb-8 ${
              embedded ? "min-h-0" : "min-h-[420px] sm:min-h-[480px] lg:min-h-[520px]"
            }`}
          >
          <div className="flex min-w-0 flex-1 flex-col justify-center text-white lg:max-w-[42%]">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-400 sm:text-xs">
              {activeBanner.name}
            </p>
            <h2 className="mt-2 text-xl font-black uppercase leading-tight tracking-tight text-white sm:mt-3 sm:text-3xl lg:text-4xl">
              {activeBanner.title || activeBanner.name}
            </h2>
            {activeBanner.subtitle ? (
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-white/90 sm:mt-3 sm:text-sm">
                {activeBanner.subtitle}
              </p>
            ) : null}
            {activeBanner.description ? (
              <p className="mt-2 hidden text-sm leading-6 text-white/80 sm:block">{activeBanner.description}</p>
            ) : null}
            {activeBanner.ctaUrl ? (
              previewMode ? (
                <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-xs font-bold text-white sm:mt-5 sm:px-5 sm:py-3 sm:text-sm">
                  {activeBanner.ctaText || "Shop now"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              ) : (
                <Link
                  to={activeBanner.ctaUrl}
                  onClick={handleBannerCta}
                  className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 sm:mt-5 sm:px-5 sm:py-3 sm:text-sm"
                >
                  {activeBanner.ctaText || "Shop now"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center lg:max-w-[58%]">
            <div className="rounded-xl border border-white/20 bg-white/95 p-3 shadow-2xl backdrop-blur-sm sm:rounded-2xl sm:p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-red-600 sm:text-[10px]">Shop by category</p>
              <p className="mt-0.5 text-[10px] text-zinc-600 sm:text-xs">Categories for this banner</p>
              {categories.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
                  {categories.map((card) => (
                    <BannerCategoryCard
                      key={card.id || card.categoryId}
                      card={card}
                      onSelect={handleCategoryClick}
                      previewMode={previewMode}
                      compact
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500">
                  No categories assigned to this banner yet.
                </p>
              )}
            </div>
          </div>
        </div>
        </div>

        {banners.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={() => goTo(index - 1)}
              className="absolute left-3 top-1/2 z-20 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg transition hover:bg-white sm:left-4 sm:h-10 sm:w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={() => goTo(index + 1)}
              className="absolute right-3 top-1/2 z-20 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg transition hover:bg-white sm:right-4 sm:h-10 sm:w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-4">
              {banners.map((banner, bannerIndex) => (
                <button
                  key={banner.id || banner.slug || bannerIndex}
                  type="button"
                  aria-label={`Show banner ${banner.name}`}
                  aria-current={bannerIndex === index}
                  onClick={() => goTo(bannerIndex)}
                  className={`h-2 rounded-full transition-all ${
                    bannerIndex === index ? "w-7 bg-red-600" : "w-2 bg-white/70 hover:bg-white"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function useHomepageBanners() {
  const [data, setData] = useState({ settings: {}, banners: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await getHomepageBanners();
        if (!cancelled) setData(response);
      } catch {
        if (!cancelled) setData({ settings: {}, banners: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading, hasManagedBanners: data.banners.length > 0 };
}

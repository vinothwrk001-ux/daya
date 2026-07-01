import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const MotionDiv = motion.div;
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { getCategoryHref } from "../../utils/categoryLinks";
import { getHomepageBanners, trackHomepageBannerEvent } from "../../services/homepageBannerService";

const DEFAULT_SETTINGS = {
  maxCategoryCards: 6,
  autoplay: true,
  autoplayIntervalMs: 5000,
  transitionEffect: "fade",
  pauseOnHover: true,
  enableLoop: true,
  showArrows: true,
  showDots: true,
};

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

function useInView(ref, rootMargin = "200px") {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return visible;
}

function preloadBannerMedia(banners = [], startIndex = 0) {
  const targets = [startIndex, startIndex + 1].map((i) => banners[i % banners.length]).filter(Boolean);
  targets.forEach((banner) => {
    const urls = [banner.desktopMedia, banner.mobileMedia, banner.desktopImage, banner.mobileImage, banner.desktopPoster]
      .map((src) => resolveApiAssetUrl(src))
      .filter(Boolean);
    urls.forEach((url) => {
      if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return;
      const img = new Image();
      img.src = url;
    });
  });
}

function resolveBannerAsset(banner, isMobile) {
  const mediaType = banner?.mediaType || "image";
  const url = resolveApiAssetUrl(
    isMobile
      ? banner?.mobileMedia || banner?.mobileImage || banner?.desktopMedia || banner?.desktopImage
      : banner?.desktopMedia || banner?.desktopImage
  );
  const poster = resolveApiAssetUrl(
    isMobile
      ? banner?.mobilePoster || banner?.desktopPoster || banner?.mobileImage || banner?.desktopImage
      : banner?.desktopPoster || banner?.desktopImage
  );
  return { mediaType, url, poster };
}

const BannerCategoryCard = memo(function BannerCategoryCard({ card, onSelect, previewMode = false }) {
  const image = resolveApiAssetUrl(card.cardImage);

  const inner = (
    <>
      <div className="category-card-image-container relative aspect-square overflow-hidden bg-zinc-900">
        {image ? (
          <img
            src={image}
            alt={card.title}
            className="category-card-image block h-full w-full object-cover transition duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] font-black text-brand-primary sm:text-sm">
            {(card.title || "C").slice(0, 1)}
          </div>
        )}
      </div>
      <div className="space-y-0 bg-zinc-950 px-1 py-1.5 text-center sm:space-y-1 sm:px-2.5 sm:py-3 lg:px-3 lg:py-3.5">
        <p className="truncate text-[7px] font-bold leading-tight text-white sm:text-[11px] lg:text-xs">{card.title}</p>
        {card.subtitle ? (
          <p className="hidden truncate text-[10px] text-zinc-400 sm:block sm:text-[11px]">{card.subtitle}</p>
        ) : null}
        {card.showProductCount !== false && card.productCount != null ? (
          <p className="hidden text-[10px] font-semibold uppercase tracking-wide text-zinc-400 sm:block sm:text-[11px]">
            {card.productCount} Products
          </p>
        ) : null}
        <span className="inline-flex items-center gap-0.5 text-[6px] font-bold uppercase tracking-wide text-brand-primary sm:gap-1 sm:text-[10px] lg:text-[11px]">
          <span className="sm:hidden">Go</span>
          <span className="hidden sm:inline">Explore</span>
          <ArrowRight className="h-2 w-2 sm:h-3 sm:w-3" />
        </span>
      </div>
    </>
  );

  if (previewMode) {
    return <div className="banner-category-card group flex flex-col overflow-hidden rounded-md border border-zinc-700 bg-zinc-950 shadow-md sm:rounded-xl">{inner}</div>;
  }

  return (
    <Link
      to={card.ctaUrl || getCategoryHref(card)}
      onClick={() => onSelect?.(card)}
      className="banner-category-card group flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-zinc-700 bg-zinc-950 shadow-md transition hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-lg sm:rounded-xl lg:min-w-0"
    >
      {inner}
    </Link>
  );
});

function BannerMedia({ banner, isMobile, isActive, previewMode }) {
  const { mediaType, url, poster } = resolveBannerAsset(banner, isMobile);
  if (!url) {
    return <div className="h-full w-full bg-gradient-to-br from-brand-surfaceSecondary via-brand-surface to-brand-surfaceSecondary" />;
  }
  if (mediaType === "video" && !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) {
    return (
      <video
        key={url}
        src={url}
        poster={poster || undefined}
        className="h-full w-full object-cover object-center"
        autoPlay={isActive}
        muted
        loop
        playsInline
        preload={previewMode || isActive ? "auto" : "metadata"}
      />
    );
  }
  return (
    <img
      src={url}
      alt={banner.title || banner.name}
      className="h-full w-full object-cover object-center"
      loading={isActive ? "eager" : "lazy"}
    />
  );
}

function getSlideVariants(effect = "fade") {
  if (effect === "slide") {
    return {
      initial: { opacity: 0, x: 48 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -48 },
    };
  }
  if (effect === "zoom") {
    return {
      initial: { opacity: 0, scale: 1.08 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.96 },
    };
  }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
}

export function HomepageBannerSlider({
  banners = [],
  settings: settingsProp = {},
  className = "",
  previewMode = false,
  initialIndex = 0,
  embedded = false,
  headerSlot = null,
}) {
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...settingsProp }), [settingsProp]);
  const [index, setIndex] = useState(initialIndex);
  const [hovered, setHovered] = useState(false);
  const trackedRef = useRef(new Set());
  const touchStartX = useRef(null);
  const containerRef = useRef(null);
  const sessionId = useMemo(() => getSessionId(), []);
  const isMobile = useIsMobile();
  const isDesktop = !isMobile;
  const inView = useInView(containerRef);

  const activeBanner = banners[index] || banners[0] || null;
  const maxCards = Number(settings.maxCategoryCards || 6);
  const autoplay = !previewMode && settings.autoplay !== false && banners.length > 1;
  const intervalMs = Math.max(3000, Number(settings.autoplayIntervalMs || 5000));
  const pauseOnHover = settings.pauseOnHover !== false;
  const showArrows = settings.showArrows !== false && banners.length > 1 && isDesktop;
  const showDots = settings.showDots !== false && banners.length > 1;
  const transitionEffect = settings.transitionEffect || "fade";
  const slideVariants = useMemo(() => getSlideVariants(transitionEffect), [transitionEffect]);

  const goTo = useCallback(
    (nextIndex) => {
      if (!banners.length) return;
      const last = banners.length - 1;
      if (settings.enableLoop === false) {
        setIndex(Math.min(Math.max(nextIndex, 0), last));
        return;
      }
      setIndex((nextIndex + banners.length) % banners.length);
    },
    [banners.length, settings.enableLoop]
  );

  useEffect(() => {
    setIndex((current) => (current >= banners.length ? 0 : current));
  }, [banners.length]);

  useEffect(() => {
    if (previewMode || !banners.length || !inView) return undefined;
    preloadBannerMedia(banners, index);
  }, [banners, index, inView, previewMode]);

  useEffect(() => {
    if (!autoplay || pauseOnHover && hovered) return undefined;
    const timer = window.setInterval(() => goTo(index + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoplay, goTo, hovered, index, intervalMs, pauseOnHover]);

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

  const categories = Array.isArray(activeBanner.categories) ? activeBanner.categories.slice(0, maxCards) : [];
  const featuredText = activeBanner.featuredCollectionText || activeBanner.name;
  const showOverlay = Boolean(activeBanner.showOverlay) && Number(activeBanner.overlayOpacity || 0) > 0;
  const overlayOpacity = Math.min(1, Math.max(0, Number(activeBanner.overlayOpacity || 0)));
  const hoverReveal = Boolean(activeBanner.hoverModeEnabled) && isDesktop;
  const revealContent = !hoverReveal || hovered || previewMode;

  const renderBannerCta = (className) => {
    if (!activeBanner.ctaUrl) return null;
    const label = activeBanner.ctaText || "Shop now";
    if (previewMode) {
      return (
        <span className={className}>
          {label}
          <ArrowRight className="h-4 w-4" />
        </span>
      );
    }
    return (
      <Link to={activeBanner.ctaUrl} onClick={handleBannerCta} className={className}>
        {label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  };

  const textBlock = (
    <>
      <p className="text-[9px] font-black uppercase tracking-[0.28em] text-brand-primary sm:text-xs">{featuredText}</p>
      <h2 className="mt-1.5 text-base font-black uppercase leading-tight tracking-tight text-white sm:mt-3 sm:text-3xl lg:text-4xl">
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
      {renderBannerCta(
        "mt-4 hidden w-fit items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brand-primaryHover sm:mt-5 sm:px-5 sm:py-3 sm:text-sm md:inline-flex"
      )}
    </>
  );

  return (
    <div
      className={`hero-banner relative w-full ${embedded ? "h-full" : "overflow-hidden"} ${className}`.trim()}
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`hero-banner-stack relative w-full ${embedded ? "h-full" : "min-h-[28rem] rounded-[1.5rem] border border-zinc-200 bg-white shadow-xl sm:min-h-[32rem] sm:rounded-[2rem]"}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="region"
        aria-roledescription="carousel"
        aria-label="Homepage banners"
      >
        <div className="hero-banner-overlay bg-zinc-900">
          <AnimatePresence mode="wait">
            <MotionDiv
              key={activeBanner.id || index}
              className="absolute inset-0"
              initial={slideVariants.initial}
              animate={slideVariants.animate}
              exit={slideVariants.exit}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <BannerMedia banner={activeBanner} isMobile={isMobile} isActive={inView} previewMode={previewMode} />
            </MotionDiv>
          </AnimatePresence>
          {showOverlay ? (
            <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} aria-hidden="true" />
          ) : null}
        </div>

        <div className="hero-banner-foreground h-full">
          {headerSlot ? (
            <header className="hero-banner-header px-4 pt-3 sm:px-6 lg:px-8">{headerSlot}</header>
          ) : null}

          <div className="hero-banner-body">
            <div className="hero-banner-content flex flex-1 flex-col items-stretch gap-3 pl-3 pr-3 sm:gap-5 sm:pl-6 sm:pr-0 lg:flex-row lg:items-stretch lg:gap-8 lg:pl-8 lg:pr-0">
              <div className="hero-banner-text-col h-full text-white lg:max-w-[42%]">
                <AnimatePresence mode="wait">
                  {revealContent ? (
                    <MotionDiv
                      key={`text-${activeBanner.id || index}`}
                      initial={{ opacity: 0, y: hoverReveal ? 12 : 0 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: hoverReveal ? 12 : 0 }}
                      transition={{ duration: hoverReveal ? 0.3 : 0.35 }}
                    >
                      {textBlock}
                    </MotionDiv>
                  ) : (
                    <MotionDiv
                      key="text-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0 }}
                      className="min-h-[1px]"
                      aria-hidden="true"
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="hero-banner-category-col hidden h-full md:flex lg:ml-auto lg:max-w-none lg:flex-1">
                <AnimatePresence mode="wait">
                  <MotionDiv
                    key={`cats-${activeBanner.id || index}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="hero-banner-category-panel flex w-full flex-col items-stretch lg:items-end"
                  >
                    {activeBanner.categoryHeading || activeBanner.categoryDescription ? (
                      <div className="mb-2 hidden w-full max-w-[42rem] text-right sm:mb-3 sm:block lg:text-left">
                        {activeBanner.categoryHeading ? (
                          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-brand-primary sm:text-xs">
                            {activeBanner.categoryHeading}
                          </p>
                        ) : null}
                        {activeBanner.categoryDescription ? (
                          <p className="mt-2 text-xs leading-5 text-white/85 sm:text-sm">{activeBanner.categoryDescription}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {categories.length ? (
                      <div className="hero-banner-category-cards grid w-full grid-cols-4 gap-1.5 sm:ml-auto sm:max-w-[42rem] sm:grid-cols-2 sm:gap-3.5 sm:justify-items-end lg:grid-cols-3 xl:grid-cols-4">
                        {categories.map((card, cardIndex) => (
                          <MotionDiv
                            key={card.id || card.categoryId}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: cardIndex * 0.05, duration: 0.28 }}
                            className="min-w-0"
                          >
                            <BannerCategoryCard
                              card={card}
                              onSelect={handleCategoryClick}
                              previewMode={previewMode}
                            />
                          </MotionDiv>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-white/30 px-3 py-6 text-center text-xs text-white/70">
                        No categories assigned to this banner yet.
                      </p>
                    )}
                  </MotionDiv>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {renderBannerCta(
            "hero-banner-mobile-cta inline-flex w-auto items-center justify-center gap-1.5 rounded-full bg-brand-primary font-bold text-white transition hover:bg-brand-primaryHover md:hidden"
          )}
        </div>

        {showArrows ? (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={() => goTo(index - 1)}
              className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg transition hover:bg-white sm:left-4 lg:inline-flex lg:h-10 lg:w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={() => goTo(index + 1)}
              className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg transition hover:bg-white sm:right-4 lg:inline-flex lg:h-10 lg:w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        {showDots ? (
          <div
            className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-4"
            role="tablist"
            aria-label="Banner slides"
          >
            {banners.map((banner, bannerIndex) => (
              <button
                key={banner.id || banner.slug || bannerIndex}
                type="button"
                role="tab"
                aria-label={`Show banner ${banner.name}`}
                aria-selected={bannerIndex === index}
                onClick={() => goTo(bannerIndex)}
                className={`h-2 rounded-full transition-all ${
                  bannerIndex === index ? "w-7 bg-brand-primary" : "w-2 bg-white/70 hover:bg-white"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function useHomepageBanners() {
  const [data, setData] = useState({ container: null, settings: {}, banners: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await getHomepageBanners();
        if (!cancelled) setData(response);
      } catch {
        if (!cancelled) setData({ container: null, settings: {}, banners: [] });
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

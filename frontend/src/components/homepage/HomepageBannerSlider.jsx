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

const BannerCategoryCard = memo(function BannerCategoryCard({ card, onSelect, previewMode = false, compact = false }) {
  const image = resolveApiAssetUrl(card.cardImage);

  // Emoji map for categories
  const emojiMap = {
    "men's shirt": "🔥",
    "men's shirts": "🔥",
    "women's shirt": "💃",
    "women's shirts": "💃",
    "unisex t-shirt": "👕",
    "unisex t-shirts": "👕",
    "hoodie": "🧥",
    "hoodies": "🧥",
    "clothing": "👔",
    "designing": "🎨",
    "website": "🌐",
    "workshop": "🛠️",
  };

  const labelMap = {
    "men's shirt": "Men's Shirt",
    "men's shirts": "Men's Shirt",
    "women's shirt": "Women's Shirt",
    "women's shirts": "Women's Shirt",
    "unisex t-shirt": "Unisex T-Shirts",
    "unisex t-shirts": "Unisex T-Shirts",
    "hoodie": "Hoodies",
    "hoodies": "Hoodies",
  };

  const getEmojiForTitle = (title) => {
    const lowerTitle = (title || "").toLowerCase();
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (lowerTitle.includes(key)) {
        return emoji;
      }
    }
    return "";
  };

  const normalizeTitle = (title) => {
    const lowerTitle = (title || "").toLowerCase();
    return labelMap[lowerTitle] || title || "";
  };

  const normalizedTitle = normalizeTitle(card.title);
  const titleWithEmoji = `${normalizedTitle} ${getEmojiForTitle(card.title)}`.trim();
  const labelMinWidthClass = normalizedTitle === "Unisex T-Shirts"
    ? "min-w-[90px] md:min-w-[90px] lg:min-w-[90px]"
    : "min-w-[90px] md:min-w-[90px] lg:min-w-[90px]";

  const containerClasses = "banner-category-card group relative flex w-full aspect-[3/4] overflow-hidden rounded-[18px] bg-black shadow-2xl transition duration-300 hover:scale-105 hover:shadow-2xl";

  const imageWrapperClasses = "absolute inset-x-0 top-0 bottom-14 flex items-center justify-start overflow-visible bg-black" +
    " bg-[repeating-linear-gradient(45deg,#111_0,#111_2px,transparent_2px,transparent_10px)]";

  const imageClasses = "h-full w-auto max-w-full object-contain object-left";

  const cardBodyClasses = "pointer-events-none absolute inset-x-0 bottom-5 z-10 flex flex-col items-center justify-end";

  // Container for the pill badge and secondary info - ensures perfect centering
  const titleSectionClasses = "flex flex-col items-center justify-center gap-0 text-center w-full";

  const countClasses = "text-[8px] leading-tight text-zinc-400 hidden"; // Consistently hidden

  const buttonClasses = "hidden"; // Consistently hidden

  const CardLink = previewMode ? "div" : Link;
  const cardProps = previewMode
    ? { className: containerClasses }
    : { to: card.ctaUrl || getCategoryHref(card), onClick: () => onSelect?.(card), className: containerClasses };

  return (
    <CardLink {...cardProps}>
      <div
        className={imageWrapperClasses}
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,.5) 2px, rgba(0,0,0,.5) 4px)"
        }}
      >
        {image ? (
          <img src={image} alt={card.title} className={imageClasses} loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-black text-zinc-700">
            {(card.title || "C").slice(0, 1)}
          </div>
        )}
      </div>
      <div className={cardBodyClasses}>
        <div className={titleSectionClasses}>
          <div className={`inline-flex h-[31px] w-[90%] max-w-[95%] ${labelMinWidthClass} items-center justify-center rounded-full bg-white px-5 shadow-lg md:w-[88%] md:max-w-[120px] md:px-[14px] lg:w-[92%] xl:w-[96%]`}>
            <p className="whitespace-nowrap text-[11px] font-semibold text-black text-center max-md:overflow-hidden max-md:text-ellipsis md:overflow-visible">{titleWithEmoji}</p>
          </div>
          {card.showProductCount !== false && card.productCount != null ? (
            <p className={countClasses}>{card.productCount} products</p>
          ) : null}
        </div>
        <span className={buttonClasses}>
          Explore
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </CardLink>
  );
});

function BannerMedia({ banner, isMobile, isActive, previewMode, className = "h-full w-full object-cover object-center" }) {
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
        className={className}
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
      className={className}
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
    trackHomepageBannerEvent(activeBanner.id, { eventType: "view", sessionId }).catch(() => { });
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
    trackHomepageBannerEvent(activeBanner.id, { eventType: "click", sessionId }).catch(() => { });
  };

  const handleCategoryClick = (card) => {
    if (previewMode || !activeBanner?.id) return;
    trackHomepageBannerEvent(activeBanner.id, {
      eventType: "category_click",
      categoryId: card.categoryId,
      sessionId,
    }).catch(() => { });
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
      <p className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-primary sm:text-xs">
        {featuredText}
      </p>
      <h2
        className="mt-3 max-w-[65ch] w-full text-center text-2xl font-black uppercase leading-tight tracking-[-0.03em] text-white sm:mt-4 sm:text-3xl md:text-4xl lg:text-5xl"
        style={{ textWrap: "balance", WebkitTextWrap: "balance", overflowWrap: "anywhere" }}
      >
        {activeBanner.title || activeBanner.name}
      </h2>
      {activeBanner.subtitle ? (
        <p className="mt-3 text-sm font-medium uppercase tracking-[0.16em] text-white/90 sm:mt-4 sm:text-base">
          {activeBanner.subtitle}
        </p>
      ) : null}
      {!isMobile && activeBanner.description ? (
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80 sm:text-[15px]">
          {activeBanner.description}
        </p>
      ) : null}
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
        className={`hero-banner-stack relative w-full ${embedded ? "h-full" : "min-h-[44rem] rounded-[1.5rem] border border-zinc-200 bg-white shadow-xl sm:min-h-[52rem] sm:rounded-[2rem]"}`}
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

        <div className="hero-banner-foreground relative z-10 h-full">
          {headerSlot ? (
            <header className="hero-banner-header px-4 pt-3 sm:px-6 lg:px-8">{headerSlot}</header>
          ) : null}

          <div className="hero-banner-body h-full">
            <div className="hero-banner-content flex h-full flex-1 flex-col justify-center px-4 py-5 sm:px-6 sm:py-6 lg:items-end lg:px-8 lg:py-8">
              <div className="w-full max-w-[36rem] flex h-full flex-col justify-start gap-8 rounded-[1.6rem] bg-transparent p-0">
                <MotionDiv
                  key={`text-${activeBanner.id || index}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="hidden md:flex min-h-[10rem] flex-col items-center justify-center gap-4 text-center transition-opacity duration-300"
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="inline-flex items-center justify-center rounded-full border border-red-500 bg-transparent px-4 py-2">
                      <span className="text-sm font-bold uppercase tracking-wider text-red-500">Categories</span>
                    </div>
                    <p className="mx-auto max-w-[42rem] text-xl font-semibold leading-tight text-black sm:text-2xl md:text-[1.6rem]">
                      Explore a wide range of stylish apparel, designed for comfort, quality, and everyday wear.
                    </p>
                  </div>
                </MotionDiv>

                {categories.length ? (
                  <div className="mt-4 hidden md:flex flex-row gap-2 md:gap-2 lg:gap-2 xl:gap-2 justify-center items-end flex-nowrap">
                    {categories.map((card, cardIndex) => (
                      <MotionDiv
                        key={card.id || card.categoryId}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: cardIndex * 0.05, duration: 0.28 }}
                        className="flex-none w-[50px] md:w-[50px] lg:w-[50px] xl:w-[150px]"
                      >
                        <BannerCategoryCard
                          card={card}
                          onSelect={handleCategoryClick}
                          previewMode={previewMode}
                        />
                      </MotionDiv>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {isMobile && activeBanner.description ? (
            <div className="absolute inset-x-0 bottom-[3rem] z-20 mx-auto flex w-full max-w-[92%] flex-col items-center gap-3 rounded-3xl bg-transparent px-4 py-4 text-center text-white backdrop-blur-none md:hidden">
              <p className="text-sm leading-6 text-white/80">{activeBanner.description}</p>
              {renderBannerCta(
                "inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-primaryHover"
              )}
            </div>
          ) : isMobile ? (
            <div className="absolute inset-x-0 bottom-[3rem] z-20 mx-auto flex w-full max-w-[92%] items-center justify-center rounded-3xl bg-transparent px-4 py-4 text-center text-white backdrop-blur-none md:hidden">
              {renderBannerCta(
                "inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-primaryHover"
              )}
            </div>
          ) : null}
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
                className={`h-2 rounded-full transition-all ${bannerIndex === index ? "w-7 bg-brand-primary" : "w-2 bg-white/70 hover:bg-white"
                  }`}
              />
            ))}
          </div>
        ) : null}
      </div>
      {categories.length ? (
        <div className="mt-4 px-4 pb-4 md:hidden">
          <div className="mb-6 flex flex-col items-center gap-3 text-center md:hidden">
            <div className="inline-flex items-center justify-center rounded-full border border-red-500 bg-transparent px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-500 sm:text-sm">Categories</span>
            </div>
            <p className="mx-auto max-w-[42rem] text-sm font-semibold leading-6 text-zinc-900 sm:text-base">
              Explore a wide range of stylish apparel, designed for comfort, quality, and everyday wear.
            </p>
          </div>
          <div
            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide"
            role="list"
            aria-label="Homepage category cards"
          >
            {categories.map((card, cardIndex) => (
              <MotionDiv
                key={card.id || card.categoryId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cardIndex * 0.05, duration: 0.28 }}
                className="snap-start shrink-0 w-[calc((100%-1rem)/2)] min-w-[calc((100%-1rem)/2)]"
              >
                <BannerCategoryCard
                  card={card}
                  onSelect={handleCategoryClick}
                  previewMode={previewMode}
                />
              </MotionDiv>
            ))}
          </div>
        </div>
      ) : null}
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

import { useEffect, useMemo, useRef, useState } from "react";
import { motion as Motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, Flame, Store } from "lucide-react";
import { ProductCard } from "../ProductCard";
import { ProductCarousel } from "../ProductCarousel";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { trackHomepageContainerEvent } from "../../services/homepageContainerService";

export function DynamicHomepageRenderer({ containers = [], loading = false }) {
  if (loading) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, index) => (
          <SectionSkeleton key={index} />
        ))}
      </>
    );
  }

  return containers.map((container) => (
    <DynamicHomepageSection key={container._id} container={container} />
  ));
}

function DynamicHomepageSection({ container }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!container?._id || trackedRef.current) return undefined;

    const timeoutId = window.setTimeout(() => {
      trackedRef.current = true;
      trackHomepageContainerEvent(container._id, { eventType: "impression" }).catch(() => {});
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [container?._id]);

  const animationSettings = resolveSectionAnimation(container);
  const visibilityClasses = resolveContainerVisibilityClasses(container);
  const layout = resolveContainerLayout(container);
  const themeStyles = resolveContainerThemeStyles(layout.theme || container?.presentation?.containerTheme);
  const widthStyles = resolveContainerWidthStyle(layout);
  const isGridContainer = container?.containerType === "GRID";

  const style = {
    ...themeStyles,
    background: resolveContainerBackground(layout, themeStyles),
    color: container?.presentation?.textColor || themeStyles.color,
    padding: `${layout.padding}px`,
    marginTop: `${layout.marginTop}px`,
    marginBottom: `${layout.marginBottom}px`,
    marginLeft: `${layout.marginLeft}px`,
    marginRight: `${layout.marginRight}px`,
    minHeight: resolveContainerHeight(layout),
    ...widthStyles,
  };

  const wrapperStyle = {};
  const shouldShiftGridUp = container?.containerType === "GRID";

  if (layout.positionX || layout.positionY || shouldShiftGridUp) {
    const offsetTransformParts = [];
    if (layout.positionX) offsetTransformParts.push(`translateX(${layout.positionX}px)`);
    if (layout.positionY) offsetTransformParts.push(`translateY(${layout.positionY}px)`);
    if (shouldShiftGridUp) offsetTransformParts.push("translateY(-4rem)");
    if (offsetTransformParts.length) {
      wrapperStyle.transform = offsetTransformParts.join(" ");
    }
  }

  const backgroundMediaUrl = resolveContainerBackgroundMedia(layout);

  return (
    <div className={`w-full px-3 py-6 sm:px-4 lg:px-8 lg:py-8 ${visibilityClasses}`} style={wrapperStyle}>
      <Motion.section
        initial={animationSettings.initial}
        whileInView={animationSettings.whileInView}
        viewport={{ once: true, margin: "-80px" }}
        transition={animationSettings.transition}
        style={style}
        className={`relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 ${
          container?.presentation?.customCssClasses || ""
        }`}
      >
        {layout.backgroundType === "image" && backgroundMediaUrl ? (
          <img src={backgroundMediaUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        {layout.backgroundType === "video" && backgroundMediaUrl ? (
          <video src={backgroundMediaUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        {(layout.backgroundType === "image" || layout.backgroundType === "video") && backgroundMediaUrl ? (
          <div className="absolute inset-0 bg-slate-950/20" />
        ) : null}
        <div className="relative z-10">{renderContainer(container)}</div>
      </Motion.section>
    </div>
  );
}

function resolveContainerVisibilityClasses(container) {
  const desktopVisible = container?.visibility?.desktop ?? container?.desktopVisible ?? true;
  const tabletVisible = container?.visibility?.tablet ?? container?.tabletVisible ?? true;
  const mobileVisible = container?.visibility?.mobile ?? container?.mobileVisible ?? true;

  if (!desktopVisible && !tabletVisible && !mobileVisible) {
    return "hidden";
  }

  if (desktopVisible && tabletVisible && mobileVisible) {
    return "";
  }

  const classes = [];
  classes.push(mobileVisible ? "block" : "hidden");
  classes.push(tabletVisible ? "md:block" : "md:hidden");
  classes.push(desktopVisible ? "lg:block" : "lg:hidden");

  return classes.join(" ");
}

function resolveContainerThemeStyles(themeValue) {
  const theme = String(themeValue || "default").trim().toLowerCase();
  switch (theme) {
    case "light":
      return { background: "#ffffff", color: "#0f172a" };
    case "dark":
      return { background: "#0f172a", color: "#f8fafc" };
    case "premium":
      return { background: "linear-gradient(135deg, #fef3c7, #fb923c)", color: "#3f2305" };
    case "luxury":
      return { background: "linear-gradient(135deg, #111827, #4b5563)", color: "#f8fafc" };
    case "modern":
      return { background: "linear-gradient(135deg, #dbeafe, #bfdbfe)", color: "#0f172a" };
    case "festival":
      return { background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff7ed" };
    case "minimal":
      return { background: "#f8fafc", color: "#0f172a" };
    case "brand":
    case "default":
    default:
      return { background: "#ffffff", color: "#0f172a" };
  }
}

function resolveContainerWidthStyle(layout) {
  const styles = { width: "100%" };
  switch (layout.widthType) {
    case "boxed":
      styles.maxWidth = "1400px";
      break;
    case "medium":
      styles.maxWidth = "1200px";
      break;
    case "narrow":
      styles.maxWidth = "900px";
      break;
    case "custom":
      styles.maxWidth = `${layout.customWidth}px`;
      break;
    case "full":
    default:
      break;
  }

  if (layout.alignment === "left") {
    styles.marginRight = "auto";
  } else if (layout.alignment === "right") {
    styles.marginLeft = "auto";
  } else {
    styles.marginInline = "auto";
  }

  return styles;
}

function resolveSectionAnimation(container) {
  const animation = String(container?.presentation?.layout?.animation || container?.presentation?.animation || container?.animation || "fadeUp")
    .replace(/_/g, "")
    .trim()
    .toLowerCase();
  switch (animation) {
    case "none":
      return {
        initial: { opacity: 1, x: 0, y: 0 },
        whileInView: { opacity: 1, x: 0, y: 0 },
        transition: { duration: 0.3, ease: "easeOut" },
      };
    case "fadedown":
      return {
        initial: { opacity: 0, x: 0, y: -18 },
        whileInView: { opacity: 1, x: 0, y: 0 },
        transition: { duration: 0.45, ease: "easeOut" },
      };
    case "fadeleft":
      return {
        initial: { opacity: 0, x: -36, y: 0 },
        whileInView: { opacity: 1, x: 0, y: 0 },
        transition: { duration: 0.45, ease: "easeOut" },
      };
    case "faderight":
      return {
        initial: { opacity: 0, x: 36, y: 0 },
        whileInView: { opacity: 1, x: 0, y: 0 },
        transition: { duration: 0.45, ease: "easeOut" },
      };
    case "zoomin":
      return {
        initial: { opacity: 0, scale: 0.94 },
        whileInView: { opacity: 1, scale: 1 },
        transition: { duration: 0.45, ease: "easeOut" },
      };
    case "zoomout":
      return {
        initial: { opacity: 0, scale: 1.06 },
        whileInView: { opacity: 1, scale: 1 },
        transition: { duration: 0.45, ease: "easeOut" },
      };
    case "bounce":
      return {
        initial: { opacity: 0, y: 28 },
        whileInView: { opacity: 1, y: [0, -10, 0] },
        transition: { duration: 0.7, ease: "easeOut" },
      };
    case "slideup":
      return {
        initial: { opacity: 0, y: 36 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: "easeOut" },
      };
    case "fadein":
    case "fadeup":
    default:
      return {
        initial: { opacity: 0, x: 0, y: 18 },
        whileInView: { opacity: 1, x: 0, y: 0 },
        transition: { duration: 0.45, ease: "easeOut" },
      };
  }
}

function resolveContainerLayout(container) {
  const layout = container?.presentation?.layout || {};
  const rawWidth = String(container?.presentation?.containerWidth || "").toLowerCase();
  const rawHeight = String(container?.presentation?.containerHeight || "").toLowerCase();
  const theme = String(layout.theme || container?.presentation?.containerTheme || "default").toLowerCase();

  return {
    widthType: layout.widthType || (rawWidth === "full" ? "full" : rawWidth === "narrow" ? "narrow" : rawWidth === "medium" ? "medium" : rawWidth === "boxed" || rawWidth === "wide" || rawWidth === "content" ? "boxed" : "custom"),
    customWidth: Number(layout.customWidth || String(rawWidth).replace(/[^\d.-]/g, "") || 1400),
    heightType: layout.heightType || (rawHeight === "auto" || !rawHeight ? "auto" : "custom"),
    customHeight: Number(layout.customHeight || String(rawHeight).replace(/[^\d.-]/g, "") || 450),
    alignment: layout.alignment || "center",
    positionX: Number(layout.positionX || String(container?.presentation?.containerOffsetX || "0").replace(/[^\d.-]/g, "") || 0),
    positionY: Number(layout.positionY || String(container?.presentation?.containerOffsetY || "0").replace(/[^\d.-]/g, "") || 0),
    padding: Number(layout.padding || String(container?.presentation?.padding || "24").replace(/[^\d.-]/g, "") || 24),
    marginTop: Number(layout.marginTop || 16),
    marginBottom: Number(layout.marginBottom || 16),
    marginLeft: Number(layout.marginLeft || 0),
    marginRight: Number(layout.marginRight || 0),
    backgroundType: layout.backgroundType || "solid",
    backgroundColor: layout.backgroundColor || container?.presentation?.backgroundColor || "#ffffff",
    gradientColor1: layout.gradientColor1 || "#fff7ed",
    gradientColor2: layout.gradientColor2 || "#fde68a",
    gradientDirection: layout.gradientDirection || "to right",
    backgroundImage: layout.backgroundImage || "",
    backgroundVideo: layout.backgroundVideo || "",
    theme,
    animation: layout.animation || "fadeUp",
  };
}

function resolveContainerHeight(layout) {
  switch (layout.heightType) {
    case "small":
      return "250px";
    case "medium":
      return "450px";
    case "large":
      return "650px";
    case "extraLarge":
      return "850px";
    case "custom":
      return `${layout.customHeight}px`;
    default:
      return undefined;
  }
}

function resolveContainerBackground(layout, themeStyles) {
  if (layout.backgroundType === "solid") {
    return layout.backgroundColor || themeStyles.background;
  }
  if (layout.backgroundType === "gradient") {
    return `linear-gradient(${layout.gradientDirection}, ${layout.gradientColor1}, ${layout.gradientColor2})`;
  }
  return themeStyles.background;
}

function resolveContainerBackgroundMedia(layout) {
  const raw = layout.backgroundType === "video" ? layout.backgroundVideo : layout.backgroundImage;
  return raw ? resolveApiAssetUrl(raw) : "";
}

function renderContainer(container) {
  switch (container.containerType) {
    case "BANNER":
      return <BannerContainer container={container} />;
    case "SLIDER":
      return <SliderContainer container={container} />;
    case "FEATURED":
      return <FeaturedContainer container={container} />;
    case "GRID":
    case "MASONRY":
    case "LIST":
    case "DEALS_STRIP":
    case "COMBO_DEALS":
    case "VIDEO_PRODUCTS":
    case "CATEGORY_SHOWCASE":
    case "BRAND_SHOWCASE":
    case "RECENTLY_VIEWED":
    case "RECOMMENDED":
    case "TRENDING":
    case "NEW_ARRIVALS":
    case "TOP_RATED":
    case "VENDOR_SPOTLIGHT":
      return <GridFamilyContainer container={container} />;
    case "TABS":
      return <TabsContainer container={container} />;
    case "FLASH_SALE":
      return <FlashSaleContainer container={container} />;
    case "CAROUSEL":
    default:
      return <CarouselContainer container={container} />;
  }
}

function SectionHeader({ container, eyebrow, actionLabel = "View all" }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">{eyebrow || container.containerType.replace(/_/g, " ")}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white lg:text-3xl">
          {container.title}
        </h2>
        {container.description ? (
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">
            {container.description}
          </p>
        ) : null}
      </div>
      {container.slug ? (
        <Link
          to={`/collections/${container.slug}`}
          onClick={() => trackHomepageContainerEvent(container._id, { eventType: "click" }).catch(() => {})}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function CarouselContainer({ container }) {
  const config = container.config || {};
  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <ProductCarousel
        items={container.products || []}
        title={container.title}
        subtitle={container.description}
        viewAllHref={container.slug ? `/collections/${container.slug}` : undefined}
        showArrows={config.showArrows !== false}
        showDots={config.showDots !== false}
        swipeEnabled={config.swipeEnabled !== false}
        autoSlide={config.autoSlide === true}
        slideSpeed={Number(config.slideSpeed || 3500)}
        desktopItemsPerView={Number(config.productsPerView || 5)}
      />
    </div>
  );
}

function FeaturedContainer({ container }) {
  const items = container.products || [];
  const heroId = String(container?.config?.heroProduct?.[0] || "");
  const heroProduct = items.find((item) => String(item._id) === heroId) || items[0];
  const secondary = items.filter((item) => String(item._id) !== String(heroProduct?._id)).slice(0, 4);

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <SectionHeader container={container} eyebrow="Featured spotlight" />
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-br from-amber-100 via-white to-rose-100 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
          {heroProduct ? <TrackedProductCard containerId={container._id} product={heroProduct} cardStyle={container?.config?.cardStyle} featured /> : <EmptyState />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {secondary.length ? secondary.map((product) => <TrackedProductCard key={product._id} containerId={container._id} product={product} cardStyle={container?.config?.cardStyle} />) : <EmptyState compact />}
        </div>
      </div>
    </div>
  );
}

function BannerContainer({ container }) {
  const config = container.config || {};
  const mediaUrl = resolveApiAssetUrl(config.bannerImage || config.bannerVideo || "");
  const isVideo = Boolean(config.bannerVideo);

  return (
    <div className="relative min-h-[280px] overflow-hidden">
      {mediaUrl ? (
        isVideo ? (
          <video src={mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <img src={mediaUrl} alt={config.heading || container.title} className="absolute inset-0 h-full w-full object-cover" />
        )
      ) : null}
      <div
        className="absolute inset-0"
        style={{ background: `rgba(15, 23, 42, ${Number(config.overlayOpacity ?? 0.35)})` }}
      />
      <div className="relative z-10 flex min-h-[280px] items-center p-6 sm:p-8 lg:p-10">
        <div className={`max-w-2xl ${resolveTextAlign(config.textPosition)}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Marketplace campaign</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
            {config.heading || container.title}
          </h2>
          {config.subheading ? <p className="mt-4 text-sm leading-7 text-white/85 sm:text-base">{config.subheading}</p> : null}
          {config.ctaButton && config.ctaUrl ? (
            <a
              href={config.ctaUrl}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
            >
              {config.ctaButton}
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SliderContainer({ container }) {
  const slides = Array.isArray(container?.config?.slides) && container.config.slides.length
    ? container.config.slides
    : [
        {
          image: container?.config?.bannerImage || "",
          heading: container?.config?.heading || container.title,
          subheading: container?.config?.subheading || container.description,
          ctaLabel: container?.config?.ctaButton || "Shop now",
          ctaUrl: container?.config?.ctaUrl || (container.slug ? `/collections/${container.slug}` : "/shop"),
        },
      ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!container?.config?.autoplay || slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [container?.config?.autoplay, slides.length]);

  const currentSlide = slides[index] || slides[0];
  const imageUrl = resolveApiAssetUrl(currentSlide?.image || "");

  return (
    <div className="relative min-h-[340px] overflow-hidden">
      {imageUrl ? <img src={imageUrl} alt={currentSlide?.heading || container.title} className="absolute inset-0 h-full w-full object-cover" /> : null}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/35 to-transparent" />
      <div className="relative z-10 flex min-h-[340px] items-end p-6 sm:p-8 lg:p-10">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Curated story</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">{currentSlide?.heading || container.title}</h2>
          {currentSlide?.subheading ? <p className="mt-4 text-sm leading-7 text-white/85 sm:text-base">{currentSlide.subheading}</p> : null}
        </div>
      </div>
    </div>
  );
}

function GridFamilyContainer({ container }) {
  const items = container.products || [];
  const type = container.containerType;
  const gridClass = resolveGridClass(type, container.config || {});

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <SectionHeader container={container} eyebrow={resolveEyebrow(type)} />
      {type === "VIDEO_PRODUCTS" && container?.config?.videoUpload ? (
        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 dark:border-slate-800">
          <video src={resolveApiAssetUrl(container.config.videoUpload)} autoPlay={container.config.autoplay !== false} muted={container.config.mute !== false} loop playsInline className="h-[260px] w-full object-cover" />
        </div>
      ) : null}
      {type === "VENDOR_SPOTLIGHT" ? <VendorSpotlightHero container={container} /> : null}
      <div className={`mt-6 grid gap-4 ${gridClass}`}>
        {items.length ? items.map((product) => <TrackedProductCard key={product._id} containerId={container._id} product={product} cardStyle={container?.config?.cardStyle} compact={type === "DEALS_STRIP" || type === "LIST"} />) : <EmptyState />}
      </div>
    </div>
  );
}

function TabsContainer({ container }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const product of container.products || []) {
      const key = product?.category || "General";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(product);
    }
    return Array.from(map.entries());
  }, [container.products]);
  const [activeTab, setActiveTab] = useState(grouped[0]?.[0] || "");

  useEffect(() => {
    setActiveTab(grouped[0]?.[0] || "");
  }, [grouped]);

  const activeItems = grouped.find(([label]) => label === activeTab)?.[1] || grouped[0]?.[1] || [];

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <SectionHeader container={container} eyebrow="Shoppable tabs" />
      <div className="mt-6 flex flex-wrap gap-2">
        {grouped.map(([label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setActiveTab(label)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === label
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {activeItems.length ? activeItems.map((product) => <TrackedProductCard key={product._id} containerId={container._id} product={product} cardStyle={container?.config?.cardStyle} />) : <EmptyState />}
      </div>
    </div>
  );
}

function FlashSaleContainer({ container }) {
  const [now, setNow] = useState(() => new Date().getTime());
  const endsAt = new Date(container?.config?.endTime || container?.schedule?.end || now).getTime();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().getTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const diff = Math.max(0, endsAt - now);
  const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
  const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, "0");
  const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, "0");

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 rounded-[1.75rem] bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 p-6 text-white shadow-2xl shadow-orange-500/25">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              <Flame className="h-3.5 w-3.5" />
              Flash Sale
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{container.title}</h2>
            {container.description ? <p className="mt-2 max-w-2xl text-sm text-white/85">{container.description}</p> : null}
          </div>
          <div className="inline-flex items-center gap-2 rounded-[1.25rem] bg-slate-950/20 px-4 py-3 text-sm font-semibold">
            <Clock3 className="h-4 w-4" />
            Ends in {hours}:{minutes}:{seconds}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(container.products || []).map((product) => (
            <TrackedProductCard key={product._id} containerId={container._id} product={product} cardStyle={container?.config?.cardStyle} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackedProductCard({ containerId, product, cardStyle = "DEFAULT", compact = false, featured = false }) {
  return (
    <div
      onClickCapture={() => trackHomepageContainerEvent(containerId, { eventType: "product_click", productId: product._id }).catch(() => {})}
      className={featured ? "h-full" : compact ? "max-w-none" : ""}
    >
      <ProductCard product={product} cardStyle={cardStyle} />
    </div>
  );
}

function VendorSpotlightHero({ container }) {
  const vendor = container?.products?.[0]?.sellerId;
  if (!vendor) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-5 text-white dark:border-slate-800">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
          {vendor.logoUrl ? (
            <img src={resolveApiAssetUrl(vendor.logoUrl)} alt={vendor.shopName || vendor.companyName} className="h-full w-full object-cover" />
          ) : (
            <Store className="h-6 w-6" />
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Vendor spotlight</p>
          <h3 className="mt-1 text-xl font-semibold">{vendor.shopName || vendor.companyName || "Featured vendor"}</h3>
          <p className="mt-1 text-sm text-white/75">Curated picks from one of the marketplace’s strongest storefronts.</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ compact = false }) {
  return (
    <div className={`rounded-[1.5rem] border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 ${compact ? "" : "col-span-full"}`}>
      No items available in this container right now.
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="w-full px-3 py-6 sm:px-4 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75">
        <div className="h-8 w-52 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-[1.5rem] bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

function resolveEyebrow(type) {
  const map = {
    DEALS_STRIP: "Deals right now",
    RECENTLY_VIEWED: "Back in your orbit",
    RECOMMENDED: "Recommended for you",
    TRENDING: "Marketplace momentum",
    NEW_ARRIVALS: "Just landed",
    TOP_RATED: "Best reviewed",
    VIDEO_PRODUCTS: "Watch then shop",
    CATEGORY_SHOWCASE: "Category spotlight",
    BRAND_SHOWCASE: "Brand moment",
    COMBO_DEALS: "Bundle savings",
    VENDOR_SPOTLIGHT: "Seller focus",
  };
  return map[type] || type.replace(/_/g, " ");
}

function resolveGridClass(type, config) {
  if (type === "LIST") {
    return "grid-cols-1";
  }
  if (type === "MASONRY") {
    return "sm:grid-cols-2 xl:grid-cols-4";
  }
  const desktopColumns = Number(config.desktopColumns || 4);
  const columnClassMap = {
    1: "xl:grid-cols-1",
    2: "xl:grid-cols-2",
    3: "xl:grid-cols-3",
    4: "xl:grid-cols-4",
    5: "xl:grid-cols-5",
    6: "xl:grid-cols-6",
    7: "xl:grid-cols-7",
    8: "xl:grid-cols-8",
    9: "xl:grid-cols-9",
    10: "xl:grid-cols-10",
    11: "xl:grid-cols-11",
    12: "xl:grid-cols-12",
  };
  // if the requested desktopColumns is outside 1..12, fall back to 4
  return `sm:grid-cols-2 ${columnClassMap[desktopColumns] || "xl:grid-cols-4"}`;
}

function resolveTextAlign(position) {
  switch (String(position || "LEFT").toUpperCase()) {
    case "CENTER":
      return "mx-auto text-center";
    case "RIGHT":
      return "ml-auto text-right";
    case "LEFT":
    default:
      return "text-left";
  }
}

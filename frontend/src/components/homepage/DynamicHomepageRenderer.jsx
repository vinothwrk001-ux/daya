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

  const style = {
    background: container?.presentation?.backgroundColor || undefined,
    color: container?.presentation?.textColor || undefined,
    padding: container?.presentation?.padding || undefined,
    margin: container?.presentation?.margin || undefined,
    minHeight: container?.presentation?.containerHeight && container?.presentation?.containerHeight !== "auto"
      ? container.presentation.containerHeight
      : undefined,
  };

  return (
    <div className="w-full px-3 py-6 sm:px-4 lg:px-8 lg:py-8">
      <Motion.section
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={style}
        className={`overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 ${
          container?.presentation?.customCssClasses || ""
        }`}
      >
        {renderContainer(container)}
      </Motion.section>
    </div>
  );
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
          {heroProduct ? <TrackedProductCard containerId={container._id} product={heroProduct} featured /> : <EmptyState />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {secondary.length ? secondary.map((product) => <TrackedProductCard key={product._id} containerId={container._id} product={product} />) : <EmptyState compact />}
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
        {items.length ? items.map((product) => <TrackedProductCard key={product._id} containerId={container._id} product={product} compact={type === "DEALS_STRIP" || type === "LIST"} />) : <EmptyState />}
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
        {activeItems.length ? activeItems.map((product) => <TrackedProductCard key={product._id} containerId={container._id} product={product} />) : <EmptyState />}
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
            <TrackedProductCard key={product._id} containerId={container._id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackedProductCard({ containerId, product, compact = false, featured = false }) {
  return (
    <div
      onClickCapture={() => trackHomepageContainerEvent(containerId, { eventType: "product_click", productId: product._id }).catch(() => {})}
      className={featured ? "h-full" : compact ? "max-w-none" : ""}
    >
      <ProductCard product={product} />
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
  };
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

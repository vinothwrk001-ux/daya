import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgePercent, Clock3, CreditCard, Eye, Flame, Gift, Heart, Megaphone, ShoppingCart, Star, Truck, User, Wallet, Zap } from "lucide-react";
import { ProductCard } from "../ProductCard";
import { ProductCarousel } from "../ProductCarousel";
import { SearchBar } from "../SearchBar";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { trackHomepageContainerEvent } from "../../services/homepageContainerService";
import { formatCurrency } from "../../utils/formatCurrency";
import { useCartDrawer } from "../../hooks/useCartDrawer";
import { useCompare } from "../../hooks/useCompare";
import { useWishlist } from "../../hooks/useWishlist";

const DEFAULT_CANVAS_WIDTH = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
};

const DEVICE_COLUMNS = {
  desktop: 12,
  tablet: 6,
  mobile: 1,
};

const BANNER_HEIGHT_SCALE = 0.85;
const DEFAULT_BANNER_HEIGHT = 685;

export const DynamicHomepageRenderer = memo(function DynamicHomepageRenderer({
  rows = [],
  containers = [],
  loading = false,
  bareContainers = false,
  bareOuterLayout = false,
  bareCarouselShell = false,
  device = "desktop",
  canvasWidth,
  renderContext: externalRenderContext = {},
}) {
  const renderContext = useMemo(
    () => ({
      ...(externalRenderContext || {}),
      device,
      canvasWidth: resolveCanvasWidth(canvasWidth, device),
    }),
    [canvasWidth, device, externalRenderContext]
  );

  const resolvedRows = useMemo(() => {
    if (Array.isArray(rows) && rows.length) {
      return rows;
    }
    return buildRowsFromContainers(containers, renderContext.canvasWidth);
  }, [containers, rows, renderContext.canvasWidth]);

  if (loading) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, index) => (
          <SectionSkeleton key={index} />
        ))}
      </>
    );
  }

  if (Array.isArray(resolvedRows) && resolvedRows.length) {
    return (
      <div className="space-y-0">
        {resolvedRows.map((row) => (
          <DynamicHomepageRow
            key={row.id || row.order}
            row={row}
            bareContainers={bareContainers}
            bareOuterLayout={bareOuterLayout}
            bareCarouselShell={bareCarouselShell}
            renderContext={renderContext}
          />
        ))}
      </div>
    );
  }

  return containers.map((container) => (
    <DynamicHomepageSection
      key={container.instanceId || container._id}
      container={container}
      bareContainers={bareContainers}
      bareOuterLayout={bareOuterLayout}
      bareCarouselShell={bareCarouselShell}
      renderContext={renderContext}
    />
  ));
});

const DynamicHomepageRow = memo(function DynamicHomepageRow({ row, bareContainers = false, bareOuterLayout = false, bareCarouselShell = false, renderContext }) {
  const columnCount = DEVICE_COLUMNS[renderContext.device] || DEVICE_COLUMNS.desktop;
  const backdropUrl = resolveRowBackdropUrl(row);

  return (
    <div className="relative overflow-hidden">
      {backdropUrl ? (
        <>
          <img src={backdropUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-white/65 dark:bg-slate-950/55" />
        </>
      ) : null}
      <div
        className={`relative z-10 grid ${bareOuterLayout ? "gap-0" : "gap-6"}`}
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gridAutoFlow: "row dense",
        }}
      >
        {(row.columns || []).map((column, columnIndex) => {
          const columnStyle = resolveColumnStyle(column, renderContext);

          return (
            <div key={column.id || `${row.id || row.order || "row"}-column-${column.order ?? columnIndex}`} style={columnStyle} className={`min-w-0 ${bareOuterLayout ? "space-y-0" : "space-y-6"}`}>
              {(column.containers || []).map((container, containerIndex) => (
                <DynamicHomepageSection
                  key={container.instanceId || container._id || `${column.id || column.order || columnIndex}-container-${containerIndex}`}
                  container={container}
                  inline
                  bareContainers={bareContainers}
                  bareOuterLayout={bareOuterLayout}
                  bareCarouselShell={bareCarouselShell}
                  renderContext={renderContext}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const DynamicHomepageSection = memo(function DynamicHomepageSection({ container, inline = false, bareContainers = false, bareOuterLayout = false, bareCarouselShell = false, renderContext }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!container?._id || trackedRef.current) return undefined;

    const timeoutId = window.setTimeout(() => {
      trackedRef.current = true;
      trackHomepageContainerEvent(container._id, { eventType: "impression" }).catch(() => {});
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [container?._id]);

  const visibilityClasses = resolveContainerVisibilityClasses(container);
  const layout = resolveContainerLayout(container);
  const themeStyles = resolveContainerThemeStyles(layout.theme || container?.presentation?.containerTheme);
  const contentSized = isContentSizedContainer(container);
  const widthStyles = resolveContainerDimensionStyle(layout, renderContext, {
    inline,
    contentSized,
    containerType: container?.containerType,
  });
  const previewBare = container?.previewBare === true || bareContainers;
  const stripOuterLayout = bareOuterLayout && !previewBare;

  const style = {
    ...widthStyles,
    ...(previewBare || stripOuterLayout
      ? {}
      : {
          ...themeStyles,
          background: resolveContainerBackground(layout, themeStyles),
          color: container?.presentation?.textColor || themeStyles.color,
          padding: `${layout.padding}px`,
          marginTop: `${layout.marginTop}px`,
          marginBottom: `${layout.marginBottom}px`,
          marginLeft: `${layout.marginLeft}px`,
          marginRight: `${layout.marginRight}px`,
        }),
  };

  const wrapperStyle = {};

  // Apply position offsets via transform
  const offsetTransformParts = [];
  if (layout.positionX) offsetTransformParts.push(`translateX(${layout.positionX}px)`);
  if (layout.positionY) offsetTransformParts.push(`translateY(${layout.positionY}px)`);
  if (offsetTransformParts.length) {
    wrapperStyle.transform = offsetTransformParts.join(" ");
  }

  const backgroundMediaUrl = resolveContainerBackgroundMedia(layout);

  return (
    <div className={`relative ${previewBare || contentSized ? "" : "overflow-hidden"} ${visibilityClasses}`.trim()} style={wrapperStyle}>
      {!previewBare && !stripOuterLayout && layout.backgroundType === "image" && backgroundMediaUrl ? (
        <img src={backgroundMediaUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {!previewBare && !stripOuterLayout && layout.backgroundType === "video" && backgroundMediaUrl ? (
        <video src={backgroundMediaUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {!previewBare && !stripOuterLayout && (layout.backgroundType === "image" || layout.backgroundType === "video") && backgroundMediaUrl ? (
        <div className="absolute inset-0 bg-slate-950/20" />
      ) : null}
      <div className="relative z-10" style={style}>
        {renderContainer(container, { bareContainers: previewBare, bareOuterLayout: stripOuterLayout, bareCarouselShell, renderContext })}
      </div>
    </div>
  );
});

function resolveRowBackdropUrl(row) {
  const containers = (row?.columns || [])
    .flatMap((column) => column?.containers || [])
    .filter(Boolean);
  const source =
    containers.find((container) => ["BANNER", "SLIDER"].includes(container?.containerType)) ||
    containers.find((container) => resolveContainerBackgroundMedia(resolveContainerLayout(container)));

  if (!source) return "";

  const config = source.config || {};
  const firstMedia = Array.isArray(config.bannerMedia) ? config.bannerMedia.find((item) => item?.url) : null;
  const raw =
    firstMedia?.url ||
    config.bannerImage ||
    config.bannerVideo ||
    config.slides?.find?.((slide) => slide?.image || slide?.url)?.image ||
    config.slides?.find?.((slide) => slide?.image || slide?.url)?.url ||
    resolveContainerBackgroundMedia(resolveContainerLayout(source));

  return raw ? resolveApiAssetUrl(raw) : "";
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

function resolveContainerDimensionStyle(layout, renderContext, options = {}) {
  const width = resolveConfiguredWidth(layout, renderContext.canvasWidth);
  const height = resolveConfiguredHeight(layout, options);
  const exactSize = resolveResponsiveSize(width, height, renderContext);
  const styles = {};
  const applyHeight = (value) => {
    if (!value) return;
    if (options.contentSized) {
      styles.minHeight = `${value}px`;
    } else {
      styles.height = `${value}px`;
    }
  };

  if (options.inline) {
    styles.width = "100%";
    if (exactSize.height) {
      applyHeight(exactSize.height);
    } else if (!options.contentSized && height && width) {
      styles.aspectRatio = `${width} / ${height}`;
    }
  } else if (exactSize.width) {
    styles.width = `${exactSize.width}px`;
    if (exactSize.height) {
      applyHeight(exactSize.height);
    } else if (!options.contentSized && height && width) {
      styles.aspectRatio = `${width} / ${height}`;
    }
  } else {
    styles.width = "100%";
    if (exactSize.height) {
      applyHeight(exactSize.height);
    }
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

function parseLegacyMargin(value) {
  const raw = String(value || "").trim();
  if (!raw) return { top: undefined, right: undefined, bottom: undefined, left: undefined };
  const numbers = raw
    .split(/\s+/)
    .map((token) => Number(String(token).replace(/[^\d.-]/g, "")))
    .filter((value) => Number.isFinite(value));
  if (numbers.length === 0) return { top: undefined, right: undefined, bottom: undefined, left: undefined };
  if (numbers.length === 1) return { top: numbers[0], right: numbers[0], bottom: numbers[0], left: numbers[0] };
  if (numbers.length === 2) return { top: numbers[0], right: numbers[1], bottom: numbers[0], left: numbers[1] };
  if (numbers.length === 3) return { top: numbers[0], right: numbers[1], bottom: numbers[2], left: numbers[1] };
  return { top: numbers[0], right: numbers[1], bottom: numbers[2], left: numbers[3] };
}

function resolveContainerLayout(container) {
  const layout = container?.presentation?.layout || {};
  const legacyMargins = parseLegacyMargin(container?.presentation?.margin);
  const rawWidth = String(container?.presentation?.containerWidth || "").toLowerCase();
  const rawHeight = String(container?.presentation?.containerHeight || "").toLowerCase();
  const theme = String(layout.theme || container?.presentation?.containerTheme || "default").toLowerCase();

  return {
    width: pickFinite(layout.width),
    widthType: layout.widthType || (rawWidth === "full" ? "full" : rawWidth === "narrow" ? "narrow" : rawWidth === "medium" ? "medium" : rawWidth === "boxed" || rawWidth === "wide" || rawWidth === "content" ? "boxed" : "custom"),
    customWidth: Number(layout.customWidth || String(rawWidth).replace(/[^\d.-]/g, "") || 1400),
    height: pickFinite(layout.height),
    heightType: layout.heightType || (rawHeight === "auto" || !rawHeight ? "auto" : "custom"),
    customHeight: Number(layout.customHeight || String(rawHeight).replace(/[^\d.-]/g, "") || 450),
    alignment: layout.alignment || "center",
    positionX: Number(layout.positionX || String(container?.presentation?.containerOffsetX || "0").replace(/[^\d.-]/g, "") || 0),
    positionY: Number(layout.positionY || String(container?.presentation?.containerOffsetY || "0").replace(/[^\d.-]/g, "") || 0),
    padding: Number(layout.padding || String(container?.presentation?.padding || "24").replace(/[^\d.-]/g, "") || 24),
    marginTop: Number(layout.marginTop ?? legacyMargins.top ?? 16),
    marginBottom: Number(layout.marginBottom ?? legacyMargins.bottom ?? 16),
    marginLeft: Number(layout.marginLeft ?? legacyMargins.left ?? 0),
    marginRight: Number(layout.marginRight ?? legacyMargins.right ?? 0),
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

function pickFinite(value) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function resolveCanvasWidth(canvasWidth, device) {
  const next = Number(canvasWidth);
  if (Number.isFinite(next) && next > 0) {
    return next;
  }
  return DEFAULT_CANVAS_WIDTH[device] || DEFAULT_CANVAS_WIDTH.desktop;
}

function resolveConfiguredWidth(layout, canvasWidth) {
  if (pickFinite(layout.width)) {
    return pickFinite(layout.width);
  }
  if (pickFinite(layout.customWidth)) {
    return pickFinite(layout.customWidth);
  }
  switch (layout.widthType) {
    case "full":
      return canvasWidth || DEFAULT_CANVAS_WIDTH.desktop;
    case "narrow":
      return 900;
    case "medium":
      return 1200;
    case "boxed":
      return 1400;
    default:
      return null;
  }
}

function resolveConfiguredHeight(layout, options = {}) {
  const isBanner = options.containerType === "BANNER";
  const scale = isBanner ? BANNER_HEIGHT_SCALE : 1;
  const scaleHeight = (value) => (value ? Math.round(value * scale) : value);

  if (layout.heightType === "auto") {
    return isBanner ? scaleHeight(DEFAULT_BANNER_HEIGHT) : null;
  }
  if (pickFinite(layout.height)) {
    return scaleHeight(pickFinite(layout.height));
  }
  if (pickFinite(layout.customHeight)) {
    return scaleHeight(pickFinite(layout.customHeight));
  }
  switch (layout.heightType) {
    case "small":
      return scaleHeight(250);
    case "medium":
      return scaleHeight(450);
    case "large":
      return scaleHeight(650);
    case "extraLarge":
      return scaleHeight(850);
    default:
      return isBanner ? scaleHeight(DEFAULT_BANNER_HEIGHT) : null;
  }
}

function resolveResponsiveSize(width, height, renderContext) {
  if (!width) {
    return {
      width: null,
      height,
    };
  }

  if (renderContext.device === "desktop") {
    return { width, height };
  }

  const availableWidth = renderContext.canvasWidth || width;
  const nextWidth = Math.min(width, availableWidth);
  if (!height) {
    return { width: nextWidth, height: null };
  }
  return {
    width: nextWidth,
    height: Math.round((height * nextWidth) / width),
  };
}

function resolveColumnStyle(column, renderContext) {
  const maxColumns = DEVICE_COLUMNS[renderContext.device] || DEVICE_COLUMNS.desktop;
  const span = Math.min(Math.max(Number(column?.colSpan || column?.span || maxColumns), 1), maxColumns);
  return {
    gridColumn: `span ${span} / span ${span}`,
    minWidth: 0,
  };
}

function buildRowsFromContainers(containers, canvasWidth) {
  const list = Array.isArray(containers) ? containers.filter(Boolean) : [];
  if (!list.length) return [];

  const rows = [];
  let currentRow = [];
  let currentRowWidth = 0;

  list.forEach((container, index) => {
    const layout = resolveContainerLayout(container);
    const width = resolveConfiguredWidth(layout, canvasWidth) || canvasWidth;
    if (currentRow.length && currentRowWidth + width > canvasWidth) {
      rows.push({
        id: `row-${rows.length + 1}`,
        order: rows.length + 1,
        columns: currentRow,
      });
      currentRow = [];
      currentRowWidth = 0;
    }

    currentRow.push({
      id: container.instanceId || container._id || `column-${index + 1}`,
      order: currentRow.length + 1,
      widthPx: width,
      containers: [container],
    });
    currentRowWidth += width;
  });

  if (currentRow.length) {
    rows.push({
      id: `row-${rows.length + 1}`,
      order: rows.length + 1,
      columns: currentRow,
    });
  }

  return rows;
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

function renderContainer(container, options = {}) {
  switch (container.containerType) {
    case "BANNER":
      return <BannerContainer container={container} />;
    case "SLIDER":
      return <SliderContainer container={container} />;
    case "FEATURED_PRODUCTS":
      return <FeaturedProductsContainer container={container} renderContext={options.renderContext} />;
    case "MASONRY":
      return <MasonryContainer container={container} />;
    case "GRID":
    case "VIDEO_PRODUCTS":
    case "BRAND_SHOWCASE":
    case "RECENTLY_VIEWED":
    case "RECOMMENDED":
    case "TRENDING":
    case "NEW_ARRIVALS":
    case "TOP_RATED":
      return <GridFamilyContainer container={container} />;
    case "COMBO_DEALS":
      return <ComboDealsContainer container={container} />;
    case "CATEGORY_SHOWCASE":
      return <CategoryShowcaseContainer container={container} />;
    case "DEALS_STRIP":
      return <DealsStripContainer container={container} renderContext={options.renderContext} />;
    case "FLASH_SALE":
      return <FlashSaleContainer container={container} />;
    case "CAROUSEL":
    default:
      return <CarouselContainer container={container} bareContainers={options.bareContainers === true} bareOuterLayout={options.bareOuterLayout === true} bareCarouselShell={options.bareCarouselShell === true} />;
  }
}

function SectionHeader({ container, eyebrow, actionLabel = "View all" }) {
  const config = container.config || {};
  const headerEyebrow = config.headerEyebrowText || eyebrow || container.containerType.replace(/_/g, " ");
  const headerTitle = config.headerHeadingText || container.title;
  const headerAction = config.headerCtaText || actionLabel;
  const headerHref = config.headerCtaUrl || (container.slug ? `/collections/${container.slug}` : "");
  const centeredFancy = String(config.headerStyle || "").toUpperCase() === "CENTERED_FANCY";

  if (centeredFancy) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="mx-auto inline-flex rounded-full border border-red-200 px-9 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">{headerEyebrow}</p>
        <h2 className="mt-6 text-3xl font-bold leading-tight text-slate-950 dark:text-white lg:text-4xl">
          {headerTitle}
        </h2>
        {container.description ? (
          <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-300 lg:text-base">
            {container.description}
          </p>
        ) : null}
        {headerHref ? (
          <Link
            to={headerHref}
            onClick={() => trackHomepageContainerEvent(container._id, { eventType: "click" }).catch(() => {})}
            className="mt-5 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            {headerAction}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">{headerEyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white lg:text-3xl">
          {headerTitle}
        </h2>
        {container.description ? (
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">
            {container.description}
          </p>
        ) : null}
      </div>
      {headerHref ? (
        <Link
          to={headerHref}
          onClick={() => trackHomepageContainerEvent(container._id, { eventType: "click" }).catch(() => {})}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          {headerAction}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function CarouselContainer({ container, bareContainers = false, bareOuterLayout = false, bareCarouselShell = false }) {
  const config = container.config || {};
  return (
    <div className={bareContainers || bareOuterLayout || container?.previewBare === true ? "" : "p-5 sm:p-6 lg:p-8"}>
      <ProductCarousel
        items={container.products || []}
        title={config.headerHeadingText || container.title}
        subtitle={container.description}
        viewAllHref={config.headerCtaUrl || (container.slug ? `/collections/${container.slug}` : undefined)}
        eyebrowText={config.headerEyebrowText || "Trending now"}
        actionLabel={config.headerCtaText || "View all"}
        bare={container?.previewBare === true || bareContainers || bareCarouselShell}
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


function BannerContainer({ container }) {
  const config = container.config || {};
  const mediaItems = Array.isArray(config.bannerMedia) && config.bannerMedia.length
    ? config.bannerMedia
    : [
        config.bannerVideo
          ? { type: "video", url: config.bannerVideo }
          : { type: "image", url: config.bannerImage || "" },
      ].filter((item) => item.url);
  const [index, setIndex] = useState(0);
  const activeItem = mediaItems[index] || mediaItems[0] || {};
  const mediaUrl = resolveApiAssetUrl(activeItem.url || "");
  const isVideo = activeItem.type === "video" || /\.(mp4|webm|mov)$/i.test(activeItem.url || "");
  const imageFit = config.bannerFit === "contain" ? "contain" : "cover";
  const autoSlide = config.autoSlide !== false;
  const showArrows = config.showArrows !== false;
  const showDots = config.showDots !== false;

  useEffect(() => {
    if (!autoSlide || mediaItems.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % mediaItems.length);
    }, Number(config.slideSpeed || 3500));
    return () => window.clearInterval(timer);
  }, [autoSlide, config.slideSpeed, mediaItems.length]);

  function goTo(nextIndex) {
    if (!mediaItems.length) return;
    const lastIndex = mediaItems.length - 1;
    if (config.infiniteLoop === false) {
      setIndex(Math.min(Math.max(nextIndex, 0), lastIndex));
      return;
    }
    setIndex((nextIndex + mediaItems.length) % mediaItems.length);
  }

  const heading = activeItem.heading || config.heading || container.title;
  const subheading = activeItem.subheading || config.subheading;
  const ctaLabel = activeItem.ctaLabel || config.ctaButton;
  const ctaUrl = activeItem.ctaUrl || config.ctaUrl;

  return (
    <div className="hero-banner group relative h-full w-full overflow-hidden">
      {mediaUrl ? (
        isVideo ? (
          <video src={mediaUrl} autoPlay muted loop playsInline className="block h-full w-full object-cover" />
        ) : (
          <img
            src={mediaUrl}
            alt={heading}
            className={`block h-full w-full object-center ${imageFit === "contain" ? "object-contain" : "object-cover"}`}
          />
        )
      ) : null}
      {mediaUrl ? (
        <div
          className="absolute inset-0 bg-slate-950/20"
          style={{ background: `rgba(15, 23, 42, ${Number(config.overlayOpacity ?? 0.35)})` }}
        />
      ) : null}
      <div className="absolute inset-0 z-10 flex flex-col items-start pt-10 p-6 sm:p-8 lg:p-10">
        <div className="w-full flex justify-between items-center mb-8 sm:mb-12 gap-6">
          <div className="flex-1 flex justify-center pl-60">
            <div className="w-full max-w-sm">
              <SearchBar />
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0 pr-8">
            <Link to="/login" className="flex items-center gap-2 text-slate-900 hover:text-slate-700 transition">
              <User className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Login</span>
            </Link>
            <Link to="/wishlist" className="flex items-center gap-2 text-slate-900 hover:text-red-500 transition">
              <Heart className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Wishlist</span>
            </Link>
            <Link to="/cart" className="flex items-center gap-2 text-slate-900 hover:text-slate-700 transition">
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Cart</span>
            </Link>
          </div>
        </div>
        
        <nav className="w-full flex justify-center mb-8 sm:mb-12">
          <div className="flex gap-6 sm:gap-8 lg:gap-10">
            <Link to="/" className="text-sm sm:text-base font-semibold text-slate-900 hover:text-slate-700 transition">
              HOME
            </Link>
            <a href="#" className="text-sm sm:text-base font-semibold text-slate-900 hover:text-slate-700 transition">
              ABOUT US
            </a>
            <a href="#" className="text-sm sm:text-base font-semibold text-slate-900 hover:text-slate-700 transition">
              SERVICES
            </a>
            <a href="#" className="text-sm sm:text-base font-semibold text-slate-900 hover:text-slate-700 transition">
              OUR WORKS
            </a>
            <a href="#" className="text-sm sm:text-base font-semibold text-slate-900 hover:text-slate-700 transition">
              BLOG
            </a>
            <a href="#" className="text-sm sm:text-base font-semibold text-slate-900 hover:text-slate-700 transition">
              CONTACT US
            </a>
          </div>
        </nav>
        
        <div className={`max-w-2xl transition duration-300 ${resolveTextAlign(config.textPosition)} ${config.showCtaOnHover ? "opacity-0 translate-y-3 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto" : ""}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Marketplace campaign</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
            {heading}
          </h2>
          {subheading ? <p className="mt-4 text-sm leading-7 text-white/85 sm:text-base">{subheading}</p> : null}
          {ctaLabel && ctaUrl ? (
            <a
              href={ctaUrl}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>
      {showArrows && mediaItems.length > 1 ? (
        <>
          <button type="button" onClick={() => goTo(index - 1)} className="absolute left-4 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg transition hover:bg-white" aria-label="Previous banner media">
            {"<"}
          </button>
          <button type="button" onClick={() => goTo(index + 1)} className="absolute right-4 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-lg transition hover:bg-white" aria-label="Next banner media">
            {">"}
          </button>
        </>
      ) : null}
      {showDots && mediaItems.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {mediaItems.map((item, itemIndex) => (
            <button
              key={item.id || item.url || itemIndex}
              type="button"
              onClick={() => goTo(itemIndex)}
              className={`h-2.5 rounded-full transition ${itemIndex === index ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`}
              aria-label={`Show banner media ${itemIndex + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeaturedProductsContainer({ container, renderContext }) {
  const config = container.config || {};
  const items = container.products || [];
  const heroId = String(config.heroProduct?.[0] || config.heroProduct || "");
  const heroProduct = items.find((item) => String(item._id) === heroId) || items[0];
  const secondary = items.filter((item) => String(item._id) !== String(heroProduct?._id));
  const layoutStyle = String(config.featuredLayoutStyle || "LEFT_HERO").toUpperCase();
  const columnCount =
    renderContext?.device === "mobile"
      ? Number(config.productsPerRowMobile || config.responsiveMobileColumns || 1)
      : renderContext?.device === "tablet"
        ? Number(config.productsPerRowTablet || config.responsiveTabletColumns || 2)
        : Number(config.productsPerRowDesktop || config.responsiveDesktopColumns || 4);
  const gap = Number(config.gridGap ?? 20);
  const sectionStyle = {
    backgroundColor: config.featuredBackgroundColor || "transparent",
    backgroundImage: config.featuredBackgroundImage ? `url(${resolveApiAssetUrl(config.featuredBackgroundImage)})` : undefined,
    backgroundSize: config.featuredBackgroundImage ? "cover" : undefined,
    backgroundPosition: config.featuredBackgroundImage ? "center" : undefined,
    borderRadius: `${Number(config.borderRadius ?? 24)}px`,
    padding: `${Number(config.containerPadding ?? 32)}px`,
    margin: `${Number(config.containerMargin ?? 0)}px`,
    color: config.bodyTextColor || undefined,
  };
  const gridStyle = {
    display: "grid",
    gap: `${gap}px`,
    gridTemplateColumns: `repeat(${Math.max(1, Math.min(columnCount, 6))}, minmax(0, 1fr))`,
  };
  const heroFirst = !["RIGHT_HERO", "BOTTOM_HERO"].includes(layoutStyle);
  const stacked = ["TOP_HERO", "BOTTOM_HERO", "CUSTOM_GRID"].includes(layoutStyle);
  const carousel = layoutStyle === "HERO_PLUS_CAROUSEL" || config.enableCarousel === true;
  const gridLimit = carousel ? Number(config.carouselLimit || config.gridLimit || config.maxProductsToShow || 12) : Number(config.gridLimit || config.maxProductsToShow || 12);
  const buttonStyles = resolveFeaturedButtonStyles(config);

  const heroNode = heroProduct ? (
    <div key="hero" className={stacked ? "" : "min-w-0"}>
      <FeaturedProductTile product={heroProduct} config={config} hero />
    </div>
  ) : null;
  const gridNode = (
    <div key="grid" className={carousel ? "flex gap-4 overflow-x-auto pb-2" : ""} style={carousel ? undefined : gridStyle}>
      {(secondary.length ? secondary : items).slice(0, gridLimit).map((product) => (
        <div key={product._id} className={carousel ? "w-[230px] shrink-0" : ""}>
          <FeaturedProductTile product={product} config={config} />
        </div>
      ))}
    </div>
  );
  const orderedNodes = heroFirst ? [heroNode, gridNode] : [gridNode, heroNode];

  return (
    <section className="featured-products-container relative min-w-0 overflow-hidden" style={sectionStyle} aria-label={config.featuredHeading || container.title}>
      {config.featuredBackgroundImage ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: config.overlayColor || "#0f172a",
            opacity: Number(config.overlayOpacityFeatured ?? 0.08),
          }}
        />
      ) : null}
      <div className="relative z-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          {config.badgeText ? <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">{config.badgeText}</div> : null}
          <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl" style={{ color: config.headingTextColor || undefined }}>
            {config.featuredHeading || container.title}
          </h2>
          {config.featuredSubHeading ? <div className="mt-2 text-base font-medium" style={{ color: config.bodyTextColor || undefined }}>{config.featuredSubHeading}</div> : null}
          {config.featuredDescription || container.description ? <p className="mt-3 text-sm leading-7" style={{ color: config.bodyTextColor || undefined }}>{config.featuredDescription || container.description}</p> : null}
        </div>
        {config.ctaButtonText && config.ctaUrl ? (
          <a
            href={config.ctaUrl}
            target={config.ctaTarget === "BLANK" ? "_blank" : undefined}
            rel={config.ctaTarget === "BLANK" ? "noreferrer" : undefined}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
            style={buttonStyles}
          >
            {config.ctaButtonText}
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : null}
      </div>
      {stacked ? (
        <div className="space-y-5">{heroNode}{gridNode}</div>
      ) : (
        <div className={`grid gap-5 ${heroFirst ? "lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.5fr)]" : "lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.9fr)]"}`}>
          {orderedNodes}
        </div>
      )}
      </div>
    </section>
  );
}

function resolveFeaturedButtonStyles(config = {}) {
  const base = {
    backgroundColor: config.buttonColor || "#0f172a",
    color: config.buttonTextColor || "#ffffff",
    border: `1px solid ${config.buttonColor || "#0f172a"}`,
  };
  if (config.buttonStyle === "OUTLINE") {
    return { ...base, backgroundColor: "transparent", color: config.buttonColor || "#0f172a" };
  }
  if (config.buttonStyle === "GHOST") {
    return { ...base, backgroundColor: "transparent", borderColor: "transparent", color: config.buttonColor || "#0f172a" };
  }
  if (config.buttonStyle === "SECONDARY") {
    return { ...base, backgroundColor: "#f1f5f9", borderColor: "#e2e8f0", color: config.buttonColor || "#0f172a" };
  }
  return base;
}

function FeaturedProductTile({ product, config = {}, hero = false }) {
  const productId = String(product?._id || "");
  const { showToast } = useCartDrawer();
  const { addItem: addWishlistItem, removeItem: removeWishlistItem, isInWishlist } = useWishlist();
  const { addItem: addCompareItem, removeItem: removeCompareItem, isInCompare, maxItems } = useCompare();
  const [wishlistSaved, setWishlistSaved] = useState(false);
  const [compareSaved, setCompareSaved] = useState(false);
  const [actionPending, setActionPending] = useState("");
  const imageUrl = resolveApiAssetUrl(product?.images?.[0]?.url || "");
  const price = product.discountPrice || product.price || 0;
  const discount = product.discountPrice && product.price ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0;
  const brand = product?.attributes?.brand || product?.brand || "";
  const lowStock = Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 10;
  const cardStyle = {
    borderRadius: `${Number(config.cardRadius ?? 18)}px`,
    border: config.cardBorder === false ? "none" : "1px solid rgba(148, 163, 184, 0.35)",
    boxShadow: config.cardShadow === false ? "none" : "0 24px 70px -48px rgba(15, 23, 42, 0.45)",
  };

  useEffect(() => {
    let active = true;

    async function loadActionState() {
      if (!productId) return;
      const [savedToWishlist, savedToCompare] = await Promise.all([
        isInWishlist(productId).catch(() => false),
        isInCompare(productId).catch(() => false),
      ]);
      if (!active) return;
      setWishlistSaved(Boolean(savedToWishlist));
      setCompareSaved(Boolean(savedToCompare));
    }

    loadActionState();

    return () => {
      active = false;
    };
  }, [isInCompare, isInWishlist, productId]);

  const handleWishlistToggle = async () => {
    if (!productId || actionPending) return;
    setActionPending("wishlist");
    try {
      if (wishlistSaved) {
        await removeWishlistItem(productId);
        setWishlistSaved(false);
        showToast("Removed from wishlist.", "success");
      } else {
        await addWishlistItem(productId);
        setWishlistSaved(true);
        showToast("Added to wishlist.", "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || "Unable to update wishlist.");
    } finally {
      setActionPending("");
    }
  };

  const handleCompareToggle = async () => {
    if (!productId || actionPending) return;
    setActionPending("compare");
    try {
      if (compareSaved) {
        await removeCompareItem(productId);
        setCompareSaved(false);
        showToast("Removed from compare.", "success");
      } else {
        await addCompareItem(product);
        setCompareSaved(true);
        showToast(`Added to compare. You can compare up to ${maxItems} products.`, "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || `You can compare up to ${maxItems} products at a time.`);
    } finally {
      setActionPending("");
    }
  };

  return (
    <article className={`group relative flex h-full min-h-0 flex-col overflow-hidden bg-white transition ${config.cardHoverEffect === "LIFT" ? "hover:-translate-y-1" : ""}`} style={cardStyle}>
      {config.showProductImage !== false ? (
        <a href={`/product/${productId}`} className={hero ? "block aspect-[16/11] bg-slate-100" : "block aspect-[4/3] bg-slate-100"}>
          {imageUrl ? <img src={imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Image coming soon</div>}
        </a>
      ) : null}
      <div className={hero ? "flex flex-1 flex-col gap-3 p-5" : "flex flex-1 flex-col gap-2 p-4"}>
        <div className="flex flex-wrap gap-2">
          {config.showDiscountBadge !== false && discount > 0 ? <span className="rounded-full bg-orange-500 px-2.5 py-1 text-xs font-bold text-white">{discount}% OFF</span> : null}
          {config.showPopularBadge ? <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">Popular Pick</span> : null}
          {config.showNewArrivalBadge ? <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">New</span> : null}
          {config.showLimitedStockBadge !== false && lowStock ? <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">Limited</span> : null}
          {config.showDeliveryBadge ? <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">Fast Delivery</span> : null}
        </div>
        {config.showBrand !== false && brand ? <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{brand}</div> : null}
        {config.showProductName !== false ? <a href={`/product/${productId}`} className={`${hero ? "text-xl" : "text-sm"} line-clamp-2 font-semibold text-slate-950 hover:text-blue-600`}>{product.name}</a> : null}
        {config.showRating !== false && product?.ratings?.averageRating > 0 ? (
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span>{Number(product.ratings.averageRating).toFixed(1)}</span>
            {config.showReviewCount !== false ? <span>({product.ratings.totalReviews || 0})</span> : null}
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {config.showPrice !== false ? <span className="text-base font-bold text-slate-950">{formatCurrency(price)}</span> : null}
          {config.showSalePrice !== false && product.discountPrice ? <span className="text-xs text-slate-400 line-through">{formatCurrency(product.price)}</span> : null}
        </div>
        {config.showStockStatus !== false ? <div className="text-xs font-medium text-emerald-600">{Number(product.stock || 0) > 0 ? "In stock" : "Out of stock"}</div> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {config.showAddToCart !== false ? <a href={`/product/${productId}`} className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white"><ShoppingCart className="h-3.5 w-3.5" /> Add</a> : null}
          {config.showWishlist !== false ? (
            <button
              type="button"
              onClick={handleWishlistToggle}
              disabled={actionPending === "wishlist"}
              className={`rounded-full border p-2 transition disabled:cursor-wait disabled:opacity-60 ${wishlistSaved ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-600 hover:border-rose-200 hover:text-rose-600"}`}
              aria-label={wishlistSaved ? "Remove from wishlist" : "Add to wishlist"}
              title={wishlistSaved ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart className={`h-4 w-4 ${wishlistSaved ? "fill-current" : ""}`} />
            </button>
          ) : null}
          {config.showQuickView ? <a href={`/product/${productId}`} className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Quick view"><Eye className="h-4 w-4" /></a> : null}
          {config.showCompare ? (
            <button
              type="button"
              onClick={handleCompareToggle}
              disabled={actionPending === "compare"}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${compareSaved ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-700"}`}
              aria-label={compareSaved ? "Remove product from compare" : "Compare product"}
              title={compareSaved ? "Remove from compare" : "Compare product"}
            >
              {compareSaved ? "Compared" : "Compare"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
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
    <div className="relative h-full w-full overflow-hidden">
      {imageUrl ? <img src={imageUrl} alt={currentSlide?.heading || container.title} className="block h-full w-full object-cover" /> : null}
      {imageUrl ? <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/35 to-transparent" /> : null}
      <div className={`relative z-10 ${imageUrl ? "absolute inset-0" : ""} flex items-end p-6 sm:p-8 lg:p-10`}>
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Curated story</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">{currentSlide?.heading || container.title}</h2>
          {currentSlide?.subheading ? <p className="mt-4 text-sm leading-7 text-white/85 sm:text-base">{currentSlide.subheading}</p> : null}
        </div>
      </div>
    </div>
  );
}

function isContentSizedContainer(container) {
  return [
    "BRAND_SHOWCASE",
    "CAROUSEL",
    "CATEGORY_SHOWCASE",
    "COMBO_DEALS",
    "DEALS_STRIP",
    "FEATURED_PRODUCTS",
    "FLASH_SALE",
    "GRID",
    "MASONRY",
    "NEW_ARRIVALS",
    "RECENTLY_VIEWED",
    "RECOMMENDED",
    "TOP_RATED",
    "TRENDING",
    "VIDEO_PRODUCTS",
  ].includes(container?.containerType);
}

function DealsStripContainer({ container, renderContext }) {
  const config = container.config || {};
  const products = container.products || [];
  const [now, setNow] = useState(() => Date.now());
  const variant = String(config.dealLayoutVariant || "LEFT_CONTENT_RIGHT_BUTTON").toUpperCase();
  const isMarquee = variant === "SCROLLING_MARQUEE" || config.dealAnimation === "MARQUEE" || config.scrollingDeals === true;
  const countdownEnd = config.countdownEndDate || config.offerEndDate || config.endTime || container?.schedule?.end;
  const showCountdown = Boolean(countdownEnd) && (config.enableCountdown !== false || variant === "COUNTDOWN_BANNER");
  const countdown = resolveDealCountdown(countdownEnd, now);
  const expired = showCountdown && countdownEnd && countdown.total <= 0;

  useEffect(() => {
    if (!showCountdown) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [showCountdown]);

  if (expired && config.countdownAutoHide) return null;

  const device = renderContext?.device || "desktop";
  const padding = device === "mobile" ? config.dealMobilePadding : device === "tablet" ? config.dealTabletPadding : config.dealDesktopPadding;
  const fontSize = device === "mobile" ? config.dealMobileFontSize : device === "tablet" ? config.dealTabletFontSize : config.dealDesktopFontSize;
  const configuredHeight = device === "mobile" ? config.dealMobileHeight : device === "tablet" ? config.dealTabletHeight : config.dealDesktopHeight;
  const backgroundMedia = config.dealBackgroundType === "VIDEO" ? config.dealBackgroundVideo : config.dealBackgroundImage;
  const heading = config.dealPrimaryHeading || config.offerText || container.title;
  const subheading = config.dealSecondaryHeading || config.campaignName || "";
  const description = config.dealDescription || container.description || "";
  const iconNode = <DealIcon config={config} />;
  const wrapperStyle = {
    ...resolveDealBackground(config),
    borderRadius: `${Number(config.dealBorderRadius ?? 28)}px`,
    border: `1px solid ${config.dealBorderColor || "rgba(255,255,255,0.22)"}`,
    boxShadow: config.dealShadow === false ? "none" : "0 28px 90px -48px rgba(15,23,42,0.65)",
    color: config.dealTextColor || "#ffffff",
    margin: `${Number(config.dealMargin ?? 0)}px`,
    minHeight: Number(config.dealHeight || configuredHeight || 0) > 0 ? `${Number(config.dealHeight || configuredHeight)}px` : undefined,
    padding: `${Number(padding ?? config.dealPadding ?? 28)}px`,
  };
  const contentClass = resolveDealAlignment(config.dealAlignment);
  const promoItems = buildDealPromoItems(config);
  const sectionWidthClass = resolveDealWidth(config.dealWidth);
  const spacing = Number(config.dealSpacing ?? 16);
  const countdownStyle = config.timerStyle || config.countdownStyle;

  return (
    <section className={`h-full p-5 sm:p-6 lg:p-8 ${sectionWidthClass}`} aria-label={heading || "Deals promotion"}>
      <style>{`@keyframes deal-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      <div className={`relative overflow-hidden ${resolveDealAnimation(config.dealAnimation)}`} style={wrapperStyle}>
        {backgroundMedia ? (
          config.dealBackgroundType === "VIDEO" ? (
            <video src={resolveApiAssetUrl(backgroundMedia)} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <img src={resolveApiAssetUrl(backgroundMedia)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          )
        ) : null}
        {backgroundMedia ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: config.dealOverlayColor || "#0f172a", opacity: Number(config.dealOverlayOpacity ?? 0.25) }}
          />
        ) : null}

        <div className="relative z-10">
          {variant === "THREE_COLUMN_STRIP" ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-3" style={{ gap: `${spacing}px` }}>
                {promoItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
                    {item.icon}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold uppercase tracking-wide">{item.label}</div>
                      <div className="truncate text-xs opacity-80">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
              <DealActionGroup config={config} showCountdown={showCountdown} countdown={countdown} countdownStyle={countdownStyle} compact />
            </div>
          ) : isMarquee ? (
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between" style={{ gap: `${spacing}px` }}>
              <div className="min-w-0 lg:max-w-md">
                <DealBadge config={config} iconNode={iconNode} />
                <h2 className="mt-2 truncate font-black leading-tight" style={{ color: config.dealHeadingColor || "#ffffff", fontSize: `${Math.max(18, Number(fontSize || 28) * 0.65)}px` }}>
                  {heading}
                </h2>
                {description ? <p className="mt-1 line-clamp-1 text-sm opacity-85">{description}</p> : null}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap rounded-full bg-white/10 px-3 py-2 backdrop-blur" role="status" aria-live="polite">
                <div className="hidden">
                {promoItems.map((item) => item.label).join(" • ")} • {heading} • {config.couponCode ? `Use ${config.couponCode}` : "Limited time offer"} •
                </div>
                <div className="animate-[deal-marquee_22s_linear_infinite] text-sm font-bold uppercase tracking-[0.22em]">
                  {buildDealMarqueeText(promoItems, heading, config)}
                  <span aria-hidden="true"> / </span>
                  {buildDealMarqueeText(promoItems, heading, config)}
                </div>
              </div>
              <DealActionGroup config={config} showCountdown={showCountdown} countdown={countdown} countdownStyle={countdownStyle} compact />
            </div>
          ) : (
            <div className={`flex flex-col ${variant === "LEFT_CONTENT_RIGHT_BUTTON" || variant === "COUNTDOWN_BANNER" || variant === "MARKETPLACE_PROMO_STRIP" ? "lg:flex-row lg:items-center lg:justify-between" : "items-center text-center"} ${contentClass}`} style={{ gap: `${spacing}px` }}>
              <div className={`min-w-0 ${variant === "LEFT_CONTENT_RIGHT_BUTTON" ? "max-w-4xl" : "max-w-3xl"}`}>
                <DealBadge config={config} iconNode={iconNode} />
                {subheading ? <div className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] opacity-80">{subheading}</div> : null}
                <h2 className="mt-2 font-black leading-tight tracking-[-0.05em]" style={{ color: config.dealHeadingColor || "#ffffff", fontSize: `${Number(fontSize || 34)}px` }}>
                  {heading}
                </h2>
                {description ? <p className="mt-3 max-w-2xl text-sm leading-6 opacity-85">{description}</p> : null}
                {config.couponCode ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-dashed border-white/50 bg-white/12 px-4 py-2 text-sm font-bold">
                    <Gift className="h-4 w-4" />
                    {config.couponCode}
                  </div>
                ) : null}
                {config.disclaimer ? <div className="mt-3 text-xs opacity-65">{config.disclaimer}</div> : null}
              </div>

              <DealActionGroup config={config} showCountdown={showCountdown} countdown={countdown} countdownStyle={countdownStyle} prominent={variant === "COUNTDOWN_BANNER"} />
            </div>
          )}
        </div>
      </div>

      {products.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.slice(0, 8).map((product) => (
            <TrackedProductCard key={product._id} containerId={container._id} product={product} cardStyle={container?.config?.cardStyle} compact={config.compactCards !== false} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DealBadge({ config = {}, iconNode }) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]">
      {iconNode}
      <span className="truncate">{config.dealBadgeText || toDealLabel(config.promotionType || "FLASH_SALE")}</span>
    </div>
  );
}

function DealActionGroup({ config = {}, showCountdown, countdown, countdownStyle, compact = false, prominent = false }) {
  return (
    <div className={`flex shrink-0 flex-wrap items-center gap-3 ${prominent ? "justify-center" : ""}`}>
      {showCountdown ? <DealCountdown countdown={countdown} styleName={countdownStyle} compact={compact} prominent={prominent} /> : null}
      <DealCtaButton config={config} compact={compact} />
    </div>
  );
}

function DealCtaButton({ config = {}, compact = false }) {
  if (config.showDealCta === false || !config.dealCtaText) return null;

  return (
    <a
      href={config.dealCtaUrl || "/shop"}
      target={config.dealCtaTarget === "BLANK" ? "_blank" : undefined}
      rel={config.dealCtaTarget === "BLANK" ? "noreferrer" : undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-bold transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/70 ${
        compact ? "px-4 py-2" : "px-5 py-3"
      }`}
      style={resolveDealButtonStyle(config)}
    >
      {config.dealButtonIconPosition === "LEFT" ? <ArrowRight className="h-4 w-4" /> : null}
      {config.dealCtaText}
      {config.dealButtonIconPosition !== "LEFT" ? <ArrowRight className="h-4 w-4" /> : null}
    </a>
  );
}

function DealIcon({ config = {} }) {
  if (config.dealIcon === "CUSTOM" && config.dealCustomIconImage) {
    return <img src={resolveApiAssetUrl(config.dealCustomIconImage)} alt="" className="h-4 w-4 rounded-full object-cover" />;
  }
  const icons = {
    FLASH: Zap,
    GIFT: Gift,
    DISCOUNT: BadgePercent,
    COUPON: Gift,
    TRUCK: Truck,
    WALLET: Wallet,
    BANK: CreditCard,
    CREDIT_CARD: CreditCard,
    CASHBACK: Wallet,
    FESTIVAL: Gift,
    FIRE: Flame,
    LIGHTNING: Zap,
    ANNOUNCEMENT: Megaphone,
  };
  const Icon = icons[String(config.dealIcon || config.promotionType || "FLASH").toUpperCase()] || Flame;
  return <Icon className="h-4 w-4" />;
}

function DealCountdown({ countdown, styleName, compact = false, prominent = false }) {
  const units = [
    ["D", countdown.days],
    ["H", countdown.hours],
    ["M", countdown.minutes],
    ["S", countdown.seconds],
  ];
  if (styleName === "MINIMAL") {
    return <div className="rounded-full bg-slate-950/25 px-4 py-2 text-sm font-bold">Ends in {countdown.hours}:{countdown.minutes}:{countdown.seconds}</div>;
  }
  return (
    <div className={`flex items-center gap-2 rounded-2xl bg-slate-950/25 p-2 ${compact || styleName === "COMPACT" ? "text-xs" : "text-sm"} ${prominent ? "shadow-2xl shadow-slate-950/20" : ""}`} aria-label="Promotion countdown">
      {units.map(([label, value]) => (
        <div key={label} className={`${compact ? "min-w-9" : "min-w-12"} rounded-xl bg-white/15 px-2 py-1 text-center`}>
          <div className="font-black tabular-nums">{value}</div>
          <div className="text-[10px] font-semibold opacity-70">{label}</div>
        </div>
      ))}
    </div>
  );
}

function resolveDealCountdown(endDate, now) {
  const end = new Date(endDate || now).getTime();
  const total = Number.isFinite(end) ? Math.max(0, end - now) : 0;
  const days = String(Math.floor(total / 86400000)).padStart(2, "0");
  const hours = String(Math.floor((total % 86400000) / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600000) / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
  return { total, days, hours, minutes, seconds };
}

function buildDealMarqueeText(promoItems = [], heading, config = {}) {
  return [
    ...promoItems.map((item) => item.label),
    heading,
    config.couponCode ? `Use ${config.couponCode}` : "Limited time offer",
  ]
    .filter(Boolean)
    .join(" / ");
}

function resolveDealWidth(width) {
  const value = String(width || "FULL").toUpperCase();
  if (value === "NARROW") return "mx-auto max-w-4xl";
  if (value === "BOXED") return "mx-auto max-w-7xl";
  return "";
}

function resolveDealBackground(config = {}) {
  const type = String(config.dealBackgroundType || "GRADIENT").toUpperCase();
  if (type === "SOLID") return { background: config.dealBackgroundColor || "#0f172a" };
  if (type === "IMAGE" || type === "VIDEO") return { background: config.dealBackgroundColor || "#0f172a" };
  return { background: `linear-gradient(120deg, ${config.dealGradientColor1 || "#e11d48"}, ${config.dealGradientColor2 || "#f97316"})` };
}

function resolveDealButtonStyle(config = {}) {
  const color = config.dealButtonColor || "#ffffff";
  const text = config.dealButtonTextColor || "#0f172a";
  if (config.dealButtonStyle === "OUTLINE") return { border: `1px solid ${color}`, color, background: "transparent" };
  if (config.dealButtonStyle === "GHOST") return { color, background: "rgba(255,255,255,0.12)" };
  if (config.dealButtonStyle === "GRADIENT") return { color: text, background: `linear-gradient(120deg, ${color}, ${config.dealButtonHoverColor || "#f8fafc"})` };
  return { color: text, background: color };
}

function resolveDealAlignment(alignment) {
  if (alignment === "CENTER") return "mx-auto text-center";
  if (alignment === "RIGHT") return "ml-auto text-right";
  return "";
}

function resolveDealAnimation(animation) {
  const value = String(animation || "FADE").toUpperCase();
  if (value === "PULSE") return "animate-pulse";
  if (value === "GLOW") return "ring-1 ring-white/20";
  return "";
}

function buildDealPromoItems(config = {}) {
  return [
    { label: config.offerText || "Flash sale", detail: config.dealPrimaryHeading || "Limited time deals", icon: <Zap className="h-5 w-5" /> },
    { label: config.couponCode ? `Use ${config.couponCode}` : "Extra savings", detail: config.dealSecondaryHeading || "Coupons and offers", icon: <Gift className="h-5 w-5" /> },
    { label: config.campaignTag || "Fast checkout", detail: config.disclaimer || "Selected products only", icon: <CreditCard className="h-5 w-5" /> },
  ];
}

function toDealLabel(value) {
  return String(value || "").replace(/_/g, " ");
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
      <div className={`mt-6 grid gap-4 ${gridClass}`}>
        {items.length ? items.map((product) => <TrackedProductCard key={product._id} containerId={container._id} product={product} cardStyle={container?.config?.cardStyle} compact={type === "DEALS_STRIP" || type === "LIST"} />) : <EmptyState />}
      </div>
    </div>
  );
}

function MasonryContainer({ container }) {
  const config = container.config || {};
  const items = (container.products || []).slice(0, Number(config.maxProducts || config.maxProductsToShow || 24));
  const gap = Number(config.gapSize ?? 16);
  const columnsClass = resolveMasonryColumns(config);
  const imagePattern = resolveMasonryImagePattern(config.cardHeights, config.masonryImagePattern);
  const masonryImage = config.masonryImage || config.image || config.bannerImage || "";
  const masonryImageUrl = resolveApiAssetUrl(masonryImage);
  const masonryImageHeight = Number(config.masonryImageHeight || 260);

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <SectionHeader container={container} eyebrow={resolveEyebrow(container.containerType)} />
      {masonryImageUrl ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <img
            src={masonryImageUrl}
            alt={container.title || "Masonry feature"}
            className="w-full object-cover"
            style={{ height: `${Math.min(Math.max(masonryImageHeight, 120), 700)}px` }}
            loading="lazy"
          />
        </div>
      ) : null}
      {items.length ? (
        <div className={`mt-6 ${columnsClass}`} style={{ columnGap: `${gap}px` }}>
          {items.map((product, index) => (
            <div
              key={product._id}
              onClickCapture={() => trackHomepageContainerEvent(container._id, { eventType: "product_click", productId: product._id }).catch(() => {})}
              className="inline-block w-full break-inside-avoid"
              style={{ marginBottom: `${gap}px` }}
            >
              <ProductCard product={product} cardStyle={config.cardStyle} imageAspectClass={imagePattern[index % imagePattern.length]} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState />
        </div>
      )}
    </div>
  );
}

function CategoryShowcaseContainer({ container }) {
  const config = container.config || {};
  const items = resolveCategoryShowcaseItems(config);
  const layout = String(config.categoryLayout || "CARDS").toUpperCase();
  const bannerUrl = resolveApiAssetUrl(config.categoryBanner || "");
  const gap = Number(config.gapSize ?? 16);
  const gridClass = resolveCategoryShowcaseGrid(config);

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <SectionHeader container={container} eyebrow={resolveEyebrow(container.containerType)} />
      {bannerUrl ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
          <img src={bannerUrl} alt={container.title || "Category showcase"} className="h-56 w-full object-cover sm:h-72" loading="lazy" />
        </div>
      ) : null}
      {items.length ? (
        layout === "STRIP" ? (
          <div className="mt-6 flex overflow-x-auto pb-2 scrollbar-hide" style={{ gap: `${gap}px` }}>
            {items.map((category) => (
              <CategoryShowcaseCard key={category._id || category.slug || category.name} category={category} config={config} layout={layout} />
            ))}
          </div>
        ) : (
          <div className={`mt-6 grid ${gridClass}`} style={{ gap: `${gap}px` }}>
            {items.map((category, index) => (
              <CategoryShowcaseCard key={category._id || category.slug || category.name || index} category={category} config={config} layout={layout} featured={layout === "EDITORIAL" && index === 0} />
            ))}
          </div>
        )
      ) : (
        <div className="mt-6">
          <EmptyState />
        </div>
      )}
    </div>
  );
}

function CategoryShowcaseCard({ category, config = {}, layout = "CARDS", featured = false }) {
  const imageUrl = resolveApiAssetUrl(category.logo || category.image || "");
  const color = category.color || "#0f172a";
  const href = category.linkUrl || (category._id ? `/shop?categoryId=${category._id}` : category.slug ? `/shop?category=${category.slug}` : "/shop");
  const compact = layout === "COMPACT_GRID";
  const strip = layout === "STRIP";
  const ctaText = config.categoryCtaText || "Shop now";

  return (
    <Link
      to={href}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-950 ${
        strip ? "w-64 shrink-0" : featured ? "sm:col-span-2 sm:row-span-2" : ""
      }`}
    >
      <div className={`${compact ? "h-28" : featured ? "h-72" : "h-44"} relative overflow-hidden bg-slate-100 dark:bg-slate-900`}>
        {imageUrl ? (
          <img src={imageUrl} alt={category.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}, #f59e0b)` }}>
            <span className="text-4xl font-black uppercase text-white">{String(category.code || category.name || "C").slice(0, 2)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
      </div>
      <div className={compact ? "p-4" : "p-5"}>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Category</div>
        <h3 className={`${featured ? "text-2xl" : "text-lg"} mt-2 line-clamp-2 font-semibold tracking-[-0.03em] text-slate-950 dark:text-white`}>
          {category.name}
        </h3>
        {config.categoryShowProductCount !== false ? (
          <div className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            {Number(category.productCount || 0)} products
          </div>
        ) : null}
        {config.categoryShowDescription !== false && category.description ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{category.description}</p>
        ) : null}
        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition group-hover:text-amber-600 dark:text-white">
          {ctaText}
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function ComboDealsContainer({ container }) {
  const config = container.config || {};
  const products = (container.products || []).slice(0, Number(config.comboMaxProducts || 4));
  const layout = String(config.comboLayout || "HERO_BUNDLE").toUpperCase();
  const bannerUrl = resolveApiAssetUrl(config.comboBanner || "");
  const subtotal = products.reduce((sum, product) => sum + Number(product.discountPrice || product.price || 0), 0);
  const originalTotal = products.reduce((sum, product) => sum + Number(product.price || product.discountPrice || 0), 0);
  const discountPercent = Math.min(Math.max(Number(config.comboDiscount || 0), 0), 100);
  const comboTotal = Math.max(subtotal - (subtotal * discountPercent) / 100, 0);
  const savings = Math.max(originalTotal - comboTotal, 0);
  const ctaUrl = config.comboCtaUrl || (products[0]?._id ? `/product/${products[0]._id}` : "/shop");
  const title = config.comboTitle || container.title || "Combo deal";
  const subtitle = config.comboSubtitle || container.description || "";

  if (!products.length) {
    return (
      <div className="p-5 sm:p-6 lg:p-8">
        <SectionHeader container={container} eyebrow={resolveEyebrow(container.containerType)} />
        <div className="mt-6">
          <EmptyState />
        </div>
      </div>
    );
  }

  if (layout === "PRODUCT_GRID") {
    return (
      <div className="p-5 sm:p-6 lg:p-8">
        <ComboDealHeader container={container} config={config} title={title} subtitle={subtitle} bannerUrl={bannerUrl} comboTotal={comboTotal} subtotal={subtotal} savings={savings} ctaUrl={ctaUrl} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <TrackedProductCard key={product._id} containerId={container._id} product={product} cardStyle={container?.config?.cardStyle} />
          ))}
        </div>
      </div>
    );
  }

  if (layout === "COMPACT_STRIP") {
    return (
      <div className="p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-5 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/50 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">{config.comboBadgeText || "Bundle deal"}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{title}</h2>
            {subtitle ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
          </div>
          <ComboProductStack products={products} />
          <ComboPriceBlock config={config} subtotal={subtotal} comboTotal={comboTotal} savings={savings} ctaUrl={ctaUrl} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[320px] bg-slate-950 text-white">
            {bannerUrl ? <img src={bannerUrl} alt={title} className="absolute inset-0 h-full w-full object-cover opacity-70" loading="lazy" /> : null}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-950/55 to-amber-600/40" />
            <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em]">
                  <Gift className="h-4 w-4" />
                  {config.comboBadgeText || "Bundle deal"}
                </div>
                <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.05em] sm:text-4xl">{title}</h2>
                {subtitle ? <p className="mt-4 max-w-xl text-sm leading-7 text-white/80">{subtitle}</p> : null}
              </div>
              <ComboPriceBlock config={config} subtotal={subtotal} comboTotal={comboTotal} savings={savings} ctaUrl={ctaUrl} inverted />
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Included products</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{products.length} items in this combo</div>
              </div>
            </div>
            {config.comboShowProducts === false ? (
              <ComboProductStack products={products} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.map((product) => (
                  <CompactComboProduct key={product._id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComboDealHeader({ container, config, title, subtitle, bannerUrl, comboTotal, subtotal, savings, ctaUrl }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {bannerUrl ? <img src={bannerUrl} alt={title} className="h-56 w-full object-cover" loading="lazy" /> : null}
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <SectionHeader container={{ ...container, title, description: subtitle }} eyebrow={resolveEyebrow(container.containerType)} />
        <ComboPriceBlock config={config} subtotal={subtotal} comboTotal={comboTotal} savings={savings} ctaUrl={ctaUrl} />
      </div>
    </div>
  );
}

function ComboPriceBlock({ config = {}, subtotal, comboTotal, savings, ctaUrl, inverted = false }) {
  const textClass = inverted ? "text-white" : "text-slate-950 dark:text-white";
  const mutedClass = inverted ? "text-white/70" : "text-slate-500 dark:text-slate-400";
  return (
    <div className="shrink-0">
      <div className={`text-sm font-medium ${mutedClass}`}>Combo price</div>
      <div className={`mt-1 text-3xl font-black tracking-[-0.04em] ${textClass}`}>{formatCurrency(comboTotal)}</div>
      <div className={`mt-1 text-sm ${mutedClass}`}>
        <span className="line-through">{formatCurrency(subtotal)}</span>
        {config.comboShowSavings !== false ? <span className="ml-2 font-semibold text-emerald-500">Save {formatCurrency(savings)}</span> : null}
      </div>
      <Link to={ctaUrl} className={`mt-4 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${inverted ? "bg-white text-slate-950" : "bg-slate-950 text-white dark:bg-white dark:text-slate-950"}`}>
        {config.comboCtaText || "View combo"}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ComboProductStack({ products = [] }) {
  return (
    <div className="flex -space-x-3">
      {products.slice(0, 5).map((product) => {
        const imageUrl = resolveApiAssetUrl(product?.images?.[0]?.url || product?.thumbnail || "");
        return (
          <div key={product._id} className="h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-slate-100 dark:border-slate-950 dark:bg-slate-800">
            {imageUrl ? <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function CompactComboProduct({ product }) {
  const imageUrl = resolveApiAssetUrl(product?.images?.[0]?.url || product?.thumbnail || "");
  return (
    <Link to={`/product/${product._id}`} className="flex gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-800 dark:hover:bg-slate-900">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {imageUrl ? <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : null}
      </div>
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{product.name}</div>
        <div className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{formatCurrency(product.discountPrice || product.price)}</div>
      </div>
    </Link>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

function EmptyState({ compact = false, label = "No items available in this container right now." }) {
  return (
    <div className={`rounded-[1.5rem] border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 ${compact ? "" : "col-span-full"}`}>
      {label}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="w-full px-3 py-6 sm:px-4 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75">
        <div className="h-8 w-52 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
  };
  return map[type] || type.replace(/_/g, " ");
}

function resolveGridClass(type, config) {
  if (type === "LIST") {
    return "grid-cols-1";
  }
  const desktopColumns = Number(config.desktopColumns || 4);
  const columnClassMap = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
    7: "lg:grid-cols-7",
    8: "lg:grid-cols-8",
    9: "lg:grid-cols-9",
    10: "lg:grid-cols-10",
    11: "lg:grid-cols-11",
    12: "lg:grid-cols-12",
  };
  // if the requested desktopColumns is outside 1..12, fall back to 4
  return `sm:grid-cols-2 ${columnClassMap[desktopColumns] || "lg:grid-cols-4"}`;
}

function resolveMasonryColumns(config = {}) {
  const desktopColumns = Number(config.columnCount || config.desktopColumns || 4);
  const tabletColumns = Number(config.tabletColumns || 2);
  const mobileColumns = Number(config.mobileColumns || 1);
  const mobileMap = {
    1: "columns-1",
    2: "columns-2",
  };
  const tabletMap = {
    1: "sm:columns-1",
    2: "sm:columns-2",
    3: "sm:columns-3",
  };
  const desktopMap = {
    2: "lg:columns-2",
    3: "lg:columns-3",
    4: "lg:columns-4",
    5: "lg:columns-5",
    6: "lg:columns-6",
  };

  return [mobileMap[mobileColumns] || "columns-1", tabletMap[tabletColumns] || "sm:columns-2", desktopMap[desktopColumns] || "lg:columns-4"].join(" ");
}

function resolveMasonryImagePattern(cardHeights, imagePattern) {
  const pattern = String(imagePattern || cardHeights || "MIXED").toUpperCase();
  if (pattern === "AUTO" || pattern === "BALANCED") {
    return ["aspect-[4/5]", "aspect-[1/1]", "aspect-[4/5]", "aspect-[1/1]"];
  }
  if (pattern === "TALL") {
    return ["aspect-[3/4]", "aspect-[2/3]", "aspect-[4/5]", "aspect-[2/3]"];
  }
  if (pattern === "WIDE") {
    return ["aspect-[4/3]", "aspect-[1/1]", "aspect-[3/2]", "aspect-[4/5]"];
  }
  return ["aspect-[4/5]", "aspect-[1/1]", "aspect-[3/4]", "aspect-[4/3]", "aspect-[2/3]"];
}

function resolveCategoryShowcaseItems(config = {}) {
  const items = Array.isArray(config.categoryCards) && config.categoryCards.length
    ? config.categoryCards
    : Array.isArray(config.categoryItems) && config.categoryItems.length
      ? config.categoryItems
      : config.categories || [];
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (item && typeof item === "object") {
        return {
          _id: item._id || item.id || item.value || "",
          name: item.name || item.label || "",
          slug: item.slug || "",
          code: item.code || "",
          icon: item.icon || "",
          logo: item.logo || item.image || "",
          color: item.color || "",
          productCount: item.productCount || 0,
          description: item.description || "",
          linkUrl: item.linkUrl || item.url || "",
        };
      }
      return { _id: String(item), name: "", productCount: 0 };
    })
    .filter((item) => item.name);
}

function resolveCategoryShowcaseGrid(config = {}) {
  const columns = Number(config.categoryColumns || config.desktopColumns || 4);
  const columnClassMap = {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  };
  return `sm:grid-cols-2 ${columnClassMap[columns] || "lg:grid-cols-4"}`;
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

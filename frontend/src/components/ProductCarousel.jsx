import { useState, useEffect, useRef } from "react";
import { motion as Motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

const FALLBACK_SWATCHES = ["#7F1D1D", "#64748B"];

function getProductImage(product) {
  return resolveApiAssetUrl(product?.images?.[0]?.url || product?.image || "");
}

function getProductBrand(product) {
  return product?.brand || product?.vendorName || product?.sellerName || product?.category || "@daya";
}

function getProductSwatches(product) {
  const values = [
    product?.colors,
    product?.availableColors,
    product?.colorOptions,
    product?.variants?.map((variant) => variant.color || variant.colorName || variant.attributes?.color),
  ]
    .flat()
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  return [...new Set(values)].slice(0, 3).length ? [...new Set(values)].slice(0, 3) : FALLBACK_SWATCHES;
}

function resolveSwatchColor(value) {
  const normalized = String(value).trim().toLowerCase();
  const colors = {
    black: "#111111",
    red: "#E53935",
    green: "#16A34A",
    blue: "#2563EB",
    gray: "#64748B",
    grey: "#64748B",
    white: "#FFFFFF",
    maroon: "#7F1D1D",
  };

  return colors[normalized] || value || "#64748B";
}

export function ProductCarousel({
  items = [],
  loading = false,
  title,
  subtitle,
  viewAllHref,
  eyebrowText = "Trending now",
  actionLabel = "View all",
  bare = false,
  showArrows = true,
  showDots = true,
  swipeEnabled = true,
  autoSlide = false,
  slideSpeed = 3500,
  desktopItemsPerView = 4,
  tabletItemsPerView = 2,
  mobileItemsPerView = 1.1,
  getProductCardProps = () => ({}),
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(4);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);

  // Detect responsive breakpoints
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setItemsPerView(mobileItemsPerView);
      } else if (width < 1024) {
        setItemsPerView(tabletItemsPerView);
      } else {
        setItemsPerView(desktopItemsPerView);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [desktopItemsPerView, mobileItemsPerView, tabletItemsPerView]);

  // Calculate max carousel index
  const maxIndex = Math.max(0, items.length - itemsPerView);

  // Clamp current index
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(Math.max(0, maxIndex));
    }
  }, [maxIndex, currentIndex]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  // Swipe/Touch support
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!swipeEnabled) return;
    touchEndXRef.current = e.changedTouches[0].clientX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const difference = touchStartXRef.current - touchEndXRef.current;

    if (Math.abs(difference) > swipeThreshold) {
      if (difference > 0) {
        // Swiped left, show next
        handleNext();
      } else {
        // Swiped right, show previous
        handlePrevious();
      }
    }
  };

  // Calculate translateX for smooth animation
  const translateX = -currentIndex * (100 / itemsPerView);

  useEffect(() => {
    if (!autoSlide || items.length <= itemsPerView) return undefined;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, Number(slideSpeed || 3500));
    return () => window.clearInterval(timer);
  }, [autoSlide, items.length, itemsPerView, maxIndex, slideSpeed]);

  const shellClassName = bare
    ? "relative overflow-hidden bg-[#f6f6f6] px-4 py-14 sm:px-8 lg:px-16"
    : "relative overflow-hidden bg-[#f6f6f6] px-4 py-14 sm:px-8 lg:px-16";

  // Show loading skeletons
  if (loading) {
    return (
      <section className={shellClassName}>
        <div className="mx-auto max-w-3xl text-center">
            <p className="mx-auto inline-flex rounded-full border border-red-200 px-9 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">{eyebrowText}</p>
            <h2 className="mt-6 text-3xl font-bold leading-tight text-slate-950 lg:text-4xl">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500 lg:text-base">
              {subtitle}
            </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[420px] animate-pulse rounded-[18px] bg-white shadow-[0_22px_70px_-55px_rgba(15,23,42,0.55)]"
            />
          ))}
        </div>
      </section>
    );
  }

  // Show empty state
  if (items.length === 0) {
    return (
      <section className={shellClassName}>
        <div className="mx-auto max-w-3xl text-center">
            <p className="mx-auto inline-flex rounded-full border border-red-200 px-9 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">{eyebrowText}</p>
            <h2 className="mt-6 text-3xl font-bold leading-tight text-slate-950 lg:text-4xl">
              {title}
            </h2>
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No products to show yet.
        </div>
      </section>
    );
  }

  return (
    <section className={shellClassName}>
      <div className="mx-auto max-w-3xl text-center">
        <p className="mx-auto inline-flex rounded-full border border-red-200 px-9 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">{eyebrowText}</p>
        <h2 className="mt-6 text-3xl font-bold leading-tight text-slate-950 lg:text-4xl">
          {title || "Discover Our Top Picks For Every Day"}
        </h2>
        {subtitle ? (
          <p className="mt-3 text-sm leading-7 text-slate-500 lg:text-base">
            {subtitle}
          </p>
        ) : null}
        {viewAllHref ? (
          <a
            href={viewAllHref}
            className="mt-5 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-500"
          >
            {actionLabel}
          </a>
        ) : null}
      </div>

      {/* Carousel Container */}
      <div className="relative mx-auto mt-10 max-w-7xl py-2">
        {/* Left Navigation Arrow */}
        <CarouselArrow
          direction="left"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          show={showArrows && items.length > itemsPerView}
        />

        {/* Product Carousel */}
        <div
          ref={containerRef}
          className="overflow-x-hidden overflow-y-visible px-2"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Motion.div
            ref={scrollContainerRef}
            className="flex"
            animate={{ x: `${translateX}%` }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 0.8,
            }}
          >
            {items.map((product) => (
              <div
                key={product._id}
                className={`flex-shrink-0 px-2 transition-all duration-300`}
                style={{
                  width: `${100 / itemsPerView}%`,
                }}
              >
                <TopPickProductCard product={product} {...getProductCardProps(product)} />
              </div>
            ))}
          </Motion.div>
        </div>

        {/* Right Navigation Arrow */}
        <CarouselArrow
          direction="right"
          onClick={handleNext}
          disabled={currentIndex >= maxIndex}
          show={showArrows && items.length > itemsPerView}
        />

        {/* Carousel Indicators (Dots) */}
        {showDots && items.length > itemsPerView && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {Array.from({ length: Math.ceil(items.length / itemsPerView) }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index * itemsPerView)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === Math.floor(currentIndex / itemsPerView)
                    ? "w-8 bg-red-500"
                    : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to carousel page ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TopPickProductCard({ product }) {
  const imageUrl = getProductImage(product);
  const productId = product?._id || product?.id;
  const salePrice = product?.discountPrice || product?.discountedPrice || product?.salePrice || null;
  const price = salePrice || product?.price || 0;
  const originalPrice = salePrice ? product?.price : product?.compareAtPrice || product?.mrp || null;
  const discountPercent = originalPrice && price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const swatches = getProductSwatches(product);

  return (
    <a href={productId ? `/product/${productId}` : "#"} className="group block h-full">
      <article className="mx-auto flex h-full max-w-[320px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_70px_-55px_rgba(15,23,42,0.65)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-52px_rgba(15,23,42,0.78)]">
        <div className="relative aspect-[1.08/1] overflow-hidden rounded-t-[18px] bg-slate-100">
          {imageUrl ? (
            <img src={imageUrl} alt={product?.name || "Product"} className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Image coming soon</div>
          )}
          {discountPercent > 0 ? (
            <span className="absolute left-5 top-5 rounded-full bg-red-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
              {discountPercent}% OFF
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col items-center px-5 py-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{getProductBrand(product)}</p>
          <h3 className="mt-2 min-h-[42px] max-w-[220px] text-sm font-semibold leading-snug text-slate-950 line-clamp-2">
            {product?.name || "Product"}
          </h3>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm">
            <span className="font-bold text-red-500">{formatCurrency(price)}</span>
            {originalPrice ? <span className="text-slate-400 line-through">{formatCurrency(originalPrice)}</span> : null}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3" aria-label="Available colors">
            {swatches.map((swatch, index) => (
              <span
                key={`${swatch}-${index}`}
                className="h-6 w-6 rounded-full border border-black/10 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.85)] ring-1 ring-slate-200"
                style={{ backgroundColor: resolveSwatchColor(swatch) }}
                title={String(swatch)}
              />
            ))}
          </div>
        </div>
      </article>
    </a>
  );
}

function CarouselArrow({ direction, onClick, disabled, show }) {
  if (!show) return null;

  const isLeft = direction === "left";
  const Icon = isLeft ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isLeft ? "Previous products" : "Next products"}
      className={`absolute top-[42%] z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-700 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 ${
        isLeft ? "left-0 -translate-x-2 md:-translate-x-6" : "right-0 translate-x-2 md:translate-x-6"
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

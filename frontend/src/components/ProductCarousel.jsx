import { useState, useEffect, useRef } from "react";
import { motion as Motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";

function ProductCarouselHeader({ eyebrowText, title, subtitle, viewAllHref, actionLabel }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="relative">
        {viewAllHref ? (
          <a
            href={viewAllHref}
            className="absolute right-0 top-20 hidden items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#ef4444] hover:text-[#ef4444] sm:inline-flex"
          >
            {actionLabel}
          </a>
        ) : null}

        <div className="mx-auto flex max-w-3xl flex-col items-center text-center gap-5 py-4">
          <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-[#111827]">
            {title || "Discover your next favorite"}
          </h2>
          <p className="inline-flex h-[34px] items-center rounded-full border border-[#ef4444] bg-white px-6 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ef4444]">
            {eyebrowText}
          </p>
          {subtitle ? (
            <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
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
  mobileItemsPerView = 2,
  getProductCardProps = () => ({}),
  paginatedGrid = false,
  gridItemsPerPage = 8,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(4);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);

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

  const maxPageIndex = Math.max(0, Math.ceil(items.length / itemsPerView) - 1);

  useEffect(() => {
    if (currentIndex > maxPageIndex) {
      setCurrentIndex(Math.max(0, maxPageIndex));
    }
  }, [maxPageIndex, currentIndex]);

  const handlePrevious = () => {
    if (paginatedGrid) {
      setCurrentPage((p) => Math.max(0, p - 1));
      return;
    }

    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    if (paginatedGrid) {
      const totalPages = Math.max(0, Math.ceil(items.length / gridItemsPerPage));
      setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
      return;
    }

    setCurrentIndex((prev) => Math.min(maxPageIndex, prev + 1));
  };

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
        handleNext();
      } else {
        handlePrevious();
      }
    }
  };

  const translateX = -currentIndex * 100;

  const totalPages = Math.ceil(items.length / gridItemsPerPage);
  const [gridVisible, setGridVisible] = useState(true);
  useEffect(() => {
    if (!paginatedGrid) return;
    setGridVisible(false);
    const t = window.setTimeout(() => setGridVisible(true), 60);
    return () => window.clearTimeout(t);
  }, [currentPage, paginatedGrid]);

  useEffect(() => {
    if (!autoSlide || items.length <= itemsPerView) return undefined;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxPageIndex ? 0 : prev + 1));
    }, Number(slideSpeed || 3500));
    return () => window.clearInterval(timer);
  }, [autoSlide, items.length, itemsPerView, maxPageIndex, slideSpeed]);

  // Reference: pure white section background
  const shellClassName = bare
    ? "relative overflow-hidden bg-white px-4 py-2 sm:px-8 lg:px-16"
    : "relative overflow-hidden bg-white px-4 py-2 sm:px-8 lg:px-16";

  if (loading) {
    return (
      <section className={shellClassName}>
        <ProductCarouselHeader eyebrowText={eyebrowText} title={title} subtitle={subtitle} />
        <div className="mx-auto mt-12 grid max-w-7xl grid-cols-2 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[20px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
            >
              <div className="aspect-[5/6] animate-pulse bg-slate-100" />
              <div className="space-y-3 px-3 py-4">
                <div className="mx-auto h-2 w-20 animate-pulse rounded bg-slate-100" />
                <div className="mx-auto h-4 w-40 animate-pulse rounded bg-slate-100" />
                <div className="mx-auto h-4 w-24 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className={shellClassName}>
        <ProductCarouselHeader eyebrowText={eyebrowText} title={title} subtitle={subtitle} />
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No products to show yet.
        </div>
      </section>
    );
  }

  return (
    <section className={`homepage-product-carousel ${shellClassName}`}>
      <div className="relative">
        <ProductCarouselHeader
          eyebrowText={eyebrowText}
          title={title}
          subtitle={subtitle}
          viewAllHref={viewAllHref}
          actionLabel={actionLabel}
        />
      </div>

      <div className="relative mx-auto mt-12 max-w-7xl overflow-visible px-2 sm:px-4">
        <CarouselArrow
          direction="left"
          onClick={handlePrevious}
          disabled={paginatedGrid ? currentPage === 0 : currentIndex === 0}
          show={showArrows && (paginatedGrid ? items.length > gridItemsPerPage : items.length > itemsPerView)}
          ariaLabel={paginatedGrid ? `Previous ${gridItemsPerPage} products` : undefined}
        />

        {paginatedGrid ? (
          <div className={`mx-auto mt-6 grid grid-cols-2 sm:grid-cols-4 gap-6 transition-opacity duration-300 ${gridVisible ? "opacity-100" : "opacity-0"}`}>
            {items.slice(currentPage * gridItemsPerPage, currentPage * gridItemsPerPage + gridItemsPerPage).map((product) => (
              <div key={product._id} className="flex justify-center px-2.5 sm:px-3">
                <ProductCard product={product} {...getProductCardProps(product)} />
              </div>
            ))}
          </div>
        ) : (
          <div
            ref={containerRef}
            className="scrollbar-hide snap-x snap-mandatory overflow-x-auto overflow-y-visible scroll-smooth"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <Motion.div
              ref={scrollContainerRef}
              className="flex flex-nowrap"
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
                  className="product-carousel-slide flex snap-start justify-center px-2.5 sm:px-3"
                  style={{
                    flex: `0 0 ${100 / itemsPerView}%`,
                    width: `${100 / itemsPerView}%`,
                    minWidth: `${100 / itemsPerView}%`,
                    maxWidth: `${100 / itemsPerView}%`,
                  }}
                >
                  <ProductCard product={product} {...getProductCardProps(product)} />
                </div>
              ))}
            </Motion.div>
          </div>
        )}

        <CarouselArrow
          direction="right"
          onClick={handleNext}
          disabled={paginatedGrid ? currentPage >= Math.max(0, totalPages - 1) : currentIndex >= maxPageIndex}
          show={showArrows && (paginatedGrid ? items.length > gridItemsPerPage : items.length > itemsPerView)}
          ariaLabel={paginatedGrid ? `Next ${gridItemsPerPage} products` : undefined}
        />

        {showDots && (paginatedGrid ? items.length > gridItemsPerPage : items.length > itemsPerView) ? (
          <div className="mt-10 flex items-center justify-center gap-2">
            {Array.from({ length: paginatedGrid ? totalPages : Math.ceil(items.length / itemsPerView) }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (paginatedGrid) setCurrentPage(index);
                  else setCurrentIndex(index);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  (paginatedGrid ? index === currentPage : index === currentIndex)
                    ? "w-8 bg-[#ef4444]"
                    : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={paginatedGrid ? `Go to page ${index + 1} of products` : `Go to carousel page ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CarouselArrow({ direction, onClick, disabled, show, ariaLabel }) {
  if (!show) return null;

  const isLeft = direction === "left";
  const Icon = isLeft ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || (isLeft ? "Previous products" : "Next products")}
      className={`absolute top-[36%] z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[#404040] shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:scale-105 hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-12 ${
        isLeft ? "left-0 -translate-x-1 md:-translate-x-4 lg:left-0" : "right-0 translate-x-1 md:translate-x-4 lg:right-0"
      }`}
    >
      <Icon className="h-5 w-5 stroke-[1.5]" />
    </button>
  );
}

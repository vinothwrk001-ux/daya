import { useState, useEffect, useRef, useMemo } from "react";
import { motion as Motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";

export function ProductCarousel({ items = [], loading = false, title, subtitle, viewAllHref }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(4);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);

  // Detect responsive breakpoints
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }

      const width = window.innerWidth;
      if (width < 640) {
        // Mobile: 1.5 products (shows next product peeking)
        setItemsPerView(1.5);
      } else if (width < 1024) {
        // Tablet: 3 products
        setItemsPerView(3);
      } else {
        // Desktop: 6 products (full page width)
        setItemsPerView(6);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Show loading skeletons
  if (loading) {
    return (
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">Product discovery</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white lg:text-3xl">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-96 rounded-[1.75rem] border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  // Show empty state
  if (items.length === 0) {
    return (
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">Product discovery</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white lg:text-3xl">
              {title}
            </h2>
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No products to show yet.
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">Product discovery</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white lg:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">
            {subtitle}
          </p>
        </div>
        {viewAllHref && (
          <a
            href={viewAllHref}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-400/30 dark:hover:text-indigo-300"
          >
            View all
          </a>
        )}
      </div>

      {/* Carousel Container */}
      <div className="relative mt-6">
        {/* Left Navigation Arrow */}
        <CarouselArrow
          direction="left"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          show={items.length > itemsPerView}
        />

        {/* Product Carousel */}
        <div
          ref={containerRef}
          className="overflow-hidden rounded-xl"
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
                <ProductCard product={product} />
              </div>
            ))}
          </Motion.div>
        </div>

        {/* Right Navigation Arrow */}
        <CarouselArrow
          direction="right"
          onClick={handleNext}
          disabled={currentIndex >= maxIndex}
          show={items.length > itemsPerView}
        />

        {/* Carousel Indicators (Dots) */}
        {items.length > itemsPerView && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: Math.ceil(items.length / itemsPerView) }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index * itemsPerView)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === Math.floor(currentIndex / itemsPerView)
                    ? "w-8 bg-indigo-600"
                    : "w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500"
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
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/60 bg-white/80 p-2 shadow-lg backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-slate-900/80 dark:hover:bg-slate-800 ${
        isLeft ? "left-0 -translate-x-4 md:-translate-x-6" : "right-0 translate-x-4 md:translate-x-6"
      }`}
    >
      <Icon className="h-5 w-5 text-slate-700 dark:text-slate-200" />
    </button>
  );
}

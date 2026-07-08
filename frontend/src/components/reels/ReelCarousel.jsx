import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReelCard } from "./ReelComponents";

export function ReelCarousel({
  items = [],
  loading = false,
  title,
  showArrows = true,
  showDots = true,
  swipeEnabled = true,
  desktopItemsPerView = 4,
  tabletItemsPerView = 3,
  mobileItemsPerView = 2,
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(4);
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

  const pageCount = Math.max(1, Math.ceil(items.length / itemsPerView));
  const currentPageIndex = Math.min(currentPage, pageCount - 1);

  useEffect(() => {
    if (currentPage >= pageCount) {
      setCurrentPage(Math.max(0, pageCount - 1));
    }
  }, [pageCount, currentPage]);

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(pageCount - 1, prev + 1));
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

  const visibleItems = items.slice(currentPageIndex * itemsPerView, currentPageIndex * itemsPerView + itemsPerView);

  if (loading) {
    return (
      <section className="px-4 py-8 lg:px-8">
        <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="px-4 py-8 lg:px-8">
      <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">{title}</h2>

      <div className="relative mx-auto max-w-[1440px] py-2">
        <ReelCarouselArrow
          direction="left"
          onClick={handlePrevious}
          disabled={currentPageIndex === 0}
          show={showArrows && pageCount > 1}
        />

        <div
          className="overflow-hidden px-2"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex justify-center gap-4">
            {visibleItems.map((reel) => (
              <div key={reel._id} className="flex-shrink-0 w-full max-w-[320px] min-w-[220px]">
                <ReelCard reel={reel} layout="card" />
              </div>
            ))}
          </div>
        </div>

        <ReelCarouselArrow
          direction="right"
          onClick={handleNext}
          disabled={currentPageIndex >= pageCount - 1}
          show={showArrows && pageCount > 1}
        />

        {showDots && pageCount > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {Array.from({ length: pageCount }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentPage(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentPageIndex ? "w-8 bg-red-500" : "w-2 bg-slate-300 hover:bg-slate-400"
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

function ReelCarouselArrow({ direction, onClick, disabled, show }) {
  if (!show) return null;

  const isLeft = direction === "left";
  const Icon = isLeft ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isLeft ? "Previous reels" : "Next reels"}
      className={`absolute top-[42%] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-700 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-12 ${
        isLeft ? "left-0 -translate-x-1 md:-translate-x-6" : "right-0 translate-x-1 md:translate-x-6"
      }`}
    >
      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
    </button>
  );
}

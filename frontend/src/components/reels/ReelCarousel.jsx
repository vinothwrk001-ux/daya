import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReelCard } from "./ReelComponents";

const CONTAINER_CLASS = "relative z-10 mx-auto w-full max-w-[1600px] px-8";

function ReelsSectionHeader({ title }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 inline-flex h-[34px] items-center rounded-full border border-[#ef4444] bg-white px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ef4444]">
        {title || "Trending Reels"}
      </div>
      <h2 className="mx-auto text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] text-[#111827]">
        Inspired By You
      </h2>
    </div>
  );
}

function ReelsSectionShell({ children, title }) {
  return (
    <section className="relative isolate overflow-hidden bg-white pt-20 pb-0">
      {/* Dark ribbed bottom panel — matches reference split background */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[46%] min-h-[280px]"
        aria-hidden="true"
        style={{
          backgroundColor: "#1a1a1a",
          backgroundImage:
            "repeating-linear-gradient(-28deg, transparent 0, transparent 18px, rgba(255,255,255,0.045) 18px, rgba(255,255,255,0.045) 19px)",
        }}
      />

      <div className={CONTAINER_CLASS}>
        <ReelsSectionHeader title={title} />
        <div className="relative z-10 mt-14 pb-[90px]">{children}</div>
      </div>
    </section>
  );
}

export function ReelCarousel({
  items = [],
  loading = false,
  title,
  swipeEnabled = true,
  desktopItemsPerView = 4,
  tabletItemsPerView = 2,
}) {
  const [itemsPerView, setItemsPerView] = useState(4);
  const [isMobileScroll, setIsMobileScroll] = useState(false);
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setIsMobileScroll(true);
        setItemsPerView(1);
      } else if (width < 1024) {
        setIsMobileScroll(false);
        setItemsPerView(tabletItemsPerView);
      } else {
        setIsMobileScroll(false);
        setItemsPerView(desktopItemsPerView);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [desktopItemsPerView, tabletItemsPerView]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [items]);

  const scrollByOne = (direction) => {
    if (!scrollRef.current) return;
    // item width (280) + gap (24) = 304
    const scrollAmount = 304 * direction;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  if (loading) {
    return (
      <ReelsSectionShell title={title}>
        <div className="mx-auto flex max-w-[1192px] justify-center gap-6 overflow-hidden pb-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="w-[min(280px,100%)] shrink-0">
              <div className="h-[500px] animate-pulse overflow-hidden rounded-2xl bg-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.18)]" />
            </div>
          ))}
        </div>
      </ReelsSectionShell>
    );
  }

  if (!items.length) return null;

  const justifyClass = items.length <= itemsPerView ? "md:justify-center" : "md:justify-start";

  const flexClass = `scroll-smooth scrollbar-hide flex snap-x snap-mandatory justify-start gap-4 overflow-x-auto pb-2 md:gap-6 md:snap-none md:overflow-x-hidden ${justifyClass} ${
    isMobileScroll && swipeEnabled ? "touch-pan-x" : ""
  }`;

  const maxGroupWidth = !isMobileScroll ? itemsPerView * 280 + Math.max(0, itemsPerView - 1) * 24 + 128 : "100%";

  return (
    <ReelsSectionShell title={title}>
      <div 
        className="relative group mx-auto md:px-16"
        style={{ maxWidth: maxGroupWidth }}
      >
        {/* Navigation Buttons */}
        {!isMobileScroll && items.length > itemsPerView && (
          <>
            <button
              onClick={() => scrollByOne(-1)}
              disabled={!canScrollLeft}
              className="absolute left-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-800 shadow-[0_4px_14px_rgba(0,0,0,0.1)] transition-all hover:scale-105 hover:bg-gray-50 disabled:opacity-50 disabled:hover:scale-100"
              aria-label="Previous page"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => scrollByOne(1)}
              disabled={!canScrollRight}
              className="absolute right-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-800 shadow-[0_4px_14px_rgba(0,0,0,0.1)] transition-all hover:scale-105 hover:bg-gray-50 disabled:opacity-50 disabled:hover:scale-100"
              aria-label="Next page"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        <div ref={scrollRef} className={flexClass} onScroll={checkScroll}>
          {items.map((reel) => (
            <div key={reel._id} className="w-[min(280px,100%)] shrink-0 snap-center">
              <ReelCard reel={reel} layout="card" />
            </div>
          ))}
        </div>
      </div>
    </ReelsSectionShell>
  );
}

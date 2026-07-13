import { useState, useEffect } from "react";
import { ReelCard } from "./ReelComponents";

const CONTAINER_CLASS = "relative z-10 mx-auto w-full max-w-[1280px] px-8";

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
  showDots = true,
  swipeEnabled = true,
  desktopItemsPerView = 3,
  tabletItemsPerView = 2,
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(3);
  const [isMobileScroll, setIsMobileScroll] = useState(false);

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

  const pageCount = Math.max(1, Math.ceil(items.length / itemsPerView));
  const currentPageIndex = Math.min(currentPage, pageCount - 1);

  useEffect(() => {
    if (currentPage >= pageCount) {
      setCurrentPage(Math.max(0, pageCount - 1));
    }
  }, [pageCount, currentPage]);

  const visibleItems = isMobileScroll
    ? items
    : items.slice(currentPageIndex * itemsPerView, currentPageIndex * itemsPerView + itemsPerView);

  const gridClass = `scrollbar-hide flex snap-x snap-mandatory justify-start gap-9 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:justify-items-center md:overflow-visible md:snap-none lg:grid-cols-3 lg:justify-center ${
    isMobileScroll && swipeEnabled ? "touch-pan-x" : ""
  }`;

  if (loading) {
    return (
      <ReelsSectionShell title={title}>
        <div className={gridClass}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="w-[min(360px,100%)] shrink-0 snap-center md:w-[360px]">
              <div className="h-[560px] animate-pulse overflow-hidden rounded-[28px] bg-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.18)]" />
            </div>
          ))}
        </div>
      </ReelsSectionShell>
    );
  }

  if (!items.length) return null;

  return (
    <ReelsSectionShell title={title}>
      <div className={gridClass}>
        {visibleItems.map((reel) => (
          <div key={reel._id} className="w-[min(360px,100%)] shrink-0 snap-center md:w-[360px] md:justify-self-center">
            <ReelCard reel={reel} layout="card" />
          </div>
        ))}
      </div>

      {showDots && !isMobileScroll && pageCount > 1 ? (
        <div className="mt-10 flex items-center justify-center gap-2">
          {Array.from({ length: pageCount }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentPage(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentPageIndex ? "w-8 bg-[#111827]" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Go to carousel page ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </ReelsSectionShell>
  );
}

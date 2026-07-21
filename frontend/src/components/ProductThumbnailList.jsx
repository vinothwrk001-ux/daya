import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

export function ProductThumbnailList({
  media = [],
  selectedIndex = 0,
  onSelect = () => {},
  productName = "Product",
}) {
  const scrollContainerRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : false));

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 1024);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const checkScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    // No-op for grid layout
  }, []);

  useEffect(() => {
    checkScroll();
  }, [checkScroll, isDesktop, media.length, selectedIndex]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const node = scrollContainerRef.current.querySelector(`[data-thumbnail-index="${selectedIndex}"]`);
    if (!node) return;

    if (isDesktop) {
      const top = node.offsetTop;
      const bottom = top + node.offsetHeight;
      const currentTop = scrollContainerRef.current.scrollTop;
      const currentBottom = currentTop + scrollContainerRef.current.clientHeight;

      if (top < currentTop) {
        scrollContainerRef.current.scrollTop = top - 12;
      } else if (bottom > currentBottom) {
        scrollContainerRef.current.scrollTop = bottom - scrollContainerRef.current.clientHeight + 12;
      }
      return;
    }

    const left = node.offsetLeft;
    const right = left + node.offsetWidth;
    const currentLeft = scrollContainerRef.current.scrollLeft;
    const currentRight = currentLeft + scrollContainerRef.current.clientWidth;

    if (left < currentLeft) {
      scrollContainerRef.current.scrollLeft = left - 12;
    } else if (right > currentRight) {
      scrollContainerRef.current.scrollLeft = right - scrollContainerRef.current.clientWidth + 12;
    }
  }, [isDesktop, selectedIndex]);


  return (
    <div className="relative w-full">
      <div 
        ref={scrollContainerRef} 
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x md:flex-wrap md:justify-center md:overflow-visible md:pb-0"
      >
        {media.map((item, index) => (
          <button
            key={`thumbnail-${item.url}-${index}`}
            data-thumbnail-index={index}
            type="button"
            onClick={() => onSelect(index)}
            className={`group relative w-[calc(25%-9px)] shrink-0 snap-center aspect-square overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 md:h-[166px] md:w-[166px] md:aspect-auto ${
              index === selectedIndex
                ? "scale-[1.02] border-[color:var(--commerce-accent)] ring-2 ring-[color:var(--commerce-accent-soft)] shadow-md"
                : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            }`}
            title={`Image ${index + 1}`}
            aria-label={`Select image ${index + 1}`}
            aria-current={index === selectedIndex}
          >
            {item.type === "video" ? (
              <div className="flex h-full w-full items-center justify-center bg-slate-950 text-[10px] font-semibold uppercase tracking-wide text-white md:text-xs">
                Video
              </div>
            ) : (
              <img
                src={resolveApiAssetUrl(item.url)}
                alt={item.altText || `${productName} thumbnail ${index + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.04]"
                onError={(event) => {
                  event.currentTarget.src = "https://via.placeholder.com/166x166?text=Img";
                }}
              />
            )}
          </button>
        ))}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

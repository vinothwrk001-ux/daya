import { useState, useMemo, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { ProductMainImage } from "./ProductMainImage";
import { ProductThumbnailList } from "./ProductThumbnailList";
import { GalleryFullscreenModal } from "./GalleryFullscreenModal";

export function ProductImageGallery({ media = [], productName = "Product", galleryKey = "default" }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const safeMedia = useMemo(
    () =>
      (Array.isArray(media) ? media : [])
        .filter((item) => item?.url)
        .sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0)),
    [media]
  );

  const totalImages = safeMedia.length;
  const hasMultipleImages = totalImages > 1;
  const activeMedia = safeMedia[selectedIndex] || null;

  useEffect(() => {
    setSelectedIndex(0);
  }, [galleryKey]);

  useEffect(() => {
    if (selectedIndex > totalImages - 1) {
      setSelectedIndex(0);
    }
  }, [selectedIndex, totalImages]);

  useEffect(() => {
    if (!hasMultipleImages) return;

    const preloadIndexes = [
      (selectedIndex + 1) % totalImages,
      (selectedIndex - 1 + totalImages) % totalImages,
    ];

    for (const index of preloadIndexes) {
      const nextMedia = safeMedia[index];
      if (nextMedia?.type === "image" && nextMedia?.url) {
        const img = new Image();
        img.src = resolveApiAssetUrl(nextMedia.url);
      }
    }
  }, [hasMultipleImages, safeMedia, selectedIndex, totalImages]);

  const goToPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
  }, [totalImages]);

  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
  }, [totalImages]);

  useEffect(() => {
    if (isFullscreen || !hasMultipleImages) return;

    const handleKeyDown = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious, hasMultipleImages, isFullscreen]);

  if (totalImages === 0) {
    return (
      <div className="flex h-96 w-full items-center justify-center rounded-[2rem] border border-slate-200 bg-slate-50 shadow-sm">
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-500">No product images available</div>
          <div className="mt-1 text-xs text-slate-400">Images will appear here once uploaded.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="grid gap-4 max-w-[1200px] mx-auto">
        <div className="relative min-w-0 max-w-[800px] mx-auto w-full">
          <ProductMainImage
            media={activeMedia}
            productName={productName}
            imageIndex={selectedIndex}
          />

          {hasMultipleImages && (
            <>
              <button
                type="button"
                onClick={goToPrevious}
                className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-900/85 bg-slate-950/90 text-white shadow-[0_10px_28px_rgba(15,23,42,0.35)] ring-2 ring-white/80 backdrop-blur transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-slate-950/60 lg:left-4 lg:h-12 lg:w-12"
                title="Previous image"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-900/85 bg-slate-950/90 text-white shadow-[0_10px_28px_rgba(15,23,42,0.35)] ring-2 ring-white/80 backdrop-blur transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-slate-950/60 lg:right-4 lg:h-12 lg:w-12"
                title="Next image"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
            </>
          )}

          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
            {activeMedia?.type === "image" ? (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-900/85 bg-slate-950/90 text-white shadow-[0_10px_24px_rgba(15,23,42,0.35)] ring-2 ring-white/80 backdrop-blur transition hover:bg-black"
                title="View fullscreen"
                aria-label="View fullscreen"
              >
                <Maximize2 className="h-5 w-5" />
              </button>
            ) : null}

            {hasMultipleImages ? (
              <div className="rounded-full border border-slate-900/85 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.35)] ring-2 ring-white/80 backdrop-blur">
                {selectedIndex + 1} / {totalImages}
              </div>
            ) : null}
          </div>
        </div>

        {hasMultipleImages ? (
          <ProductThumbnailList
            media={safeMedia}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            productName={productName}
          />
        ) : null}
      </section>

      {isFullscreen && activeMedia ? (
        <GalleryFullscreenModal
          media={safeMedia}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onClose={() => setIsFullscreen(false)}
          productName={productName}
        />
      ) : null}
    </>
  );
}

import { useState } from "react";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

/**
 * ProductMainImage
 * 
 * Main image viewer with zoom support
 */
export function ProductMainImage({ media, productName = "Product", imageIndex = 0 }) {
  const [zoomStyle, setZoomStyle] = useState({
    transformOrigin: "center center",
    transform: "scale(1)",
  });

  function resetZoom() {
    setZoomStyle({
      transformOrigin: "center center",
      transform: "scale(1)",
    });
  }

  if (!media) {
    return (
      <div className="flex h-96 w-full items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 lg:h-[38rem]">
        <div className="text-center">
          <div className="text-sm text-slate-500">Loading image...</div>
        </div>
      </div>
    );
  }

  const fallbackPoster = "";

  return (
    <div className="relative min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] shadow-sm">
      <div className="relative flex w-full items-center justify-center overflow-hidden aspect-square sm:aspect-auto sm:h-[800px]">
        <div className="w-full max-w-[800px] h-full">
        {media.type === "video" ? (
          <video
            key={media.url}
            controls
            playsInline
            className="w-full h-full object-cover"
            poster={fallbackPoster ? resolveApiAssetUrl(fallbackPoster) : undefined}
          >
            <source src={resolveApiAssetUrl(media.url)} />
            Your browser does not support the video tag.
          </video>
        ) : (
          <img
            key={`${media.url}-${imageIndex}`}
            src={resolveApiAssetUrl(media.url)}
            alt={media.altText || `${productName} - Image ${imageIndex + 1}`}
            loading="lazy"
            className="block w-full h-full object-cover transition-transform duration-300 ease-out hover:scale-125 lg:cursor-zoom-in"
            style={zoomStyle}
            onMouseMove={(event) => {
              if (window.innerWidth < 1024) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const x = ((event.clientX - bounds.left) / bounds.width) * 100;
              const y = ((event.clientY - bounds.top) / bounds.height) * 100;
              setZoomStyle({
                transformOrigin: `${x}% ${y}%`,
                transform: "scale(1.5)",
              });
            }}
            onMouseLeave={resetZoom}
            onError={(event) => {
              event.currentTarget.src =
                "https://via.placeholder.com/900x900?text=Image+Not+Found";
            }}
          />
        )}

        </div>

        {/* Zoom hint */}
        {media.type === "image" && (
          <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-full bg-slate-950/78 px-3 py-1 text-xs font-semibold text-white lg:block">
            Hover to zoom
          </div>
        )}
      </div>
    </div>
  );
}

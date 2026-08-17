import { useState } from "react";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { Share2 } from "lucide-react";

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

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: productName,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

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
    <div className="relative min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] shadow-sm lg:h-[450px] lg:w-[360px] lg:aspect-[4/5] lg:mr-auto group">
      <div className="relative flex w-full items-center justify-center overflow-hidden aspect-square sm:aspect-auto sm:h-[550px] lg:h-full">
        
        {/* Share Button */}
        <button
          onClick={handleShare}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-md hover:bg-gray-800 transition-colors"
          title="Share Product"
          aria-label="Share Product"
        >
          <Share2 className="h-5 w-5" />
        </button>

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

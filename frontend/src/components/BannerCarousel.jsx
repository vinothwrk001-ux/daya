import { useEffect, useMemo, useRef, useState } from "react";

export function BannerCarousel({ banners = [] }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const intervalRef = useRef(null);

  const displayBanners = useMemo(() => {
    const defaultBanners = [
      {
        id: 1,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&h=400&fit=crop",
        title: "Electronics Deals",
        discount: "Up to 70% OFF",
      },
      {
        id: 2,
        image: "https://images.unsplash.com/photo-1525966222134-fcab75d4e601?w=1200&h=400&fit=crop",
        title: "Fashion Week",
        discount: "Exclusive Collection",
      },
      {
        id: 3,
        image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200&h=400&fit=crop",
        title: "Home & Garden",
        discount: "Big Savings",
      },
    ];

    const normalized = Array.isArray(banners) ? banners.filter(Boolean) : [];
    return normalized.length > 0 ? normalized : defaultBanners;
  }, [banners]);

  const slideCount = displayBanners.length;

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const update = () => setPrefersReducedMotion(Boolean(mq.matches));
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener?.(update);
    return () => mq.removeListener?.(update);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (isPaused) return;
    if (slideCount <= 1) return;

    intervalRef.current = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, 5000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isPaused, prefersReducedMotion, slideCount]);

  const activeSlide = slideCount > 0 ? currentSlide % slideCount : 0;

  const goToSlide = (index) => setCurrentSlide(index);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slideCount);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount);

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevSlide();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      nextSlide();
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-lg"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotional banners"
      tabIndex={0}
    >
      <div className="relative h-44 sm:h-64 md:h-80 lg:h-96">
        {displayBanners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === activeSlide ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={index !== activeSlide}
          >
            <img
              src={banner.image}
              alt={banner.title}
              className="h-full w-full object-contain"
              loading={index === 0 ? "eager" : "lazy"}
            />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-r from-black/70 via-black/30 to-transparent px-4 py-4 sm:justify-center sm:px-8">
              <h2
                className="max-w-[65ch] w-full leading-tight text-lg font-bold text-white sm:text-xl md:text-xl"
                style={{ textWrap: "balance", WebkitTextWrap: "balance" }}
              >
                {banner.title}
              </h2>
              <p className="mt-1 text-sm font-semibold text-yellow-300 sm:mt-2 sm:text-xl">
                {banner.discount}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={prevSlide}
        type="button"
        aria-label="Previous slide"
        className="absolute left-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800/85 dark:text-white dark:hover:bg-slate-700 sm:left-4"
        disabled={slideCount <= 1}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M12.7 15.7a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 1 1 1.4 1.4L8.41 10l4.29 4.3a1 1 0 0 1 0 1.4Z" />
        </svg>
      </button>
      <button
        onClick={nextSlide}
        type="button"
        aria-label="Next slide"
        className="absolute right-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800/85 dark:text-white dark:hover:bg-slate-700 sm:right-4"
        disabled={slideCount <= 1}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 1 1-1.4-1.4L11.59 10 7.3 5.7a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>

      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2 sm:bottom-4">
        {displayBanners.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === activeSlide ? "true" : "false"}
            className={`h-2 w-2 rounded-full transition focus:outline-none focus:ring-2 focus:ring-blue-500 sm:h-3 sm:w-3 ${
              index === activeSlide ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

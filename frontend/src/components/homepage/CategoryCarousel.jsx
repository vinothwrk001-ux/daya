import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { getCategoryHref } from "../../utils/categoryLinks";
import { getHomepageCategories, trackCategoryEvent } from "../../services/categoryService";
import { scrollPageToTop } from "../../utils/scrollPageToTop";

function getSessionId() {
  if (typeof window === "undefined") return "";
  const key = "category_session_id";
  let sessionId = window.sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

function CategoryCard({ category, onClick }) {
  if (!category) return null;

  const image = resolveApiAssetUrl(category.thumbnail_url || category.thumbnailUrl || category.logo || category.icon);
  const categoryName = category.name || "Category";
  const _productCount = typeof category.productCount === "number" ? category.productCount : 0;

  return (
    <Link
      to={getCategoryHref(category)}
      onClick={(e) => onClick?.(e, category)}
      className="group relative flex aspect-[4/4] flex-col overflow-hidden rounded-3xl border-2 border-black bg-zinc-950 shadow-lg transition duration-300 hover:-translate-y-2 hover:border-brand-primary hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0, transparent 35%), radial-gradient(circle at 80% 0%, rgba(220,38,38,0.15) 0, transparent 40%)",
        }}
      />
      <div className="category-card-image-container relative flex flex-1 items-center justify-center overflow-hidden p-6">
        {image ? (
          <img
            src={image}
            alt={categoryName}
            loading="lazy"
            className="category-card-image block h-[70%] w-[70%] object-contain transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-brand-primary/20 text-2xl font-black text-brand-primary">
            {categoryName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="relative flex flex-col border-t border-white/10 bg-black/80 px-4 py-3 text-center">
        <p className="line-clamp-2 text-sm font-black uppercase tracking-wide text-white">{categoryName}</p>
        {/* <p className="mt-1 text-[11px] font-semibold text-zinc-400">{productCount} products</p> */}
      </div>
    </Link>
  );
}

export function CategoryCarousel() {
  const [categories, setCategories] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getHomepageCategories();
        if (cancelled) return;
        setCategories(data.categories || []);
        setConfig(data.config || null);
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCategoryClick(e, category) {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      scrollPageToTop();
    }
    trackCategoryEvent(category._id, {
      eventType: "click",
      sessionId: getSessionId(),
    }).catch(() => {});
  }

  if (loading) {
    return (
      <section id="categories" className="bg-white px-4 py-10 dark:bg-zinc-950 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!config?.enabled || !categories.length) return null;

  return (
    <section id="categories" className="bg-white px-4 py-10 dark:bg-zinc-950 lg:px-8 flex justify-center">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center">
        <div className="mb-6 flex w-full max-w-3xl flex-col items-center gap-4 text-center">
          <div>
            <p className="mx-auto inline-flex rounded-full border border-brand-primary px-4 py-1.5 text-xs font-black uppercase tracking-[0.35em] text-brand-primary">{config.eyebrow}</p>
            <h2 className="mt-4 pt-2 line-clamp-2 text-2xl font-black text-zinc-950 dark:text-white md:text-3xl">{config.title}</h2>
            {config.subtitle ? (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{config.subtitle}</p>
            ) : null}
          </div>
        </div>

        <div
          ref={scrollerRef}
          onScroll={() => {
            if (!scrollerRef.current) return;
            const { scrollLeft, clientWidth } = scrollerRef.current;
            const cardWidth = scrollerRef.current.children[0]?.clientWidth || (clientWidth / 2);
            if (cardWidth > 0) {
              setCurrentIndex(Math.round(scrollLeft / cardWidth));
            }
          }}
          className="mx-auto grid justify-center grid-flow-col auto-cols-[calc(50%-0.5rem)] gap-4 overflow-x-auto pb-2 mt-8 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] sm:auto-cols-[calc(50%-0.5rem)] md:auto-cols-[calc(50%-1rem)] lg:auto-cols-[calc(25.333%-1rem)] xl:auto-cols-[calc(23%-1rem)] [&::-webkit-scrollbar]:hidden w-full"
        >
          {categories.map((category) => (
            <div key={category._id} className="snap-start w-full">
              <CategoryCard category={category} onClick={handleCategoryClick} />
            </div>
          ))}
        </div>
        
        {categories.length > 2 && (
          <div className="mt-3 flex justify-center gap-1.5 md:hidden">
            {Array.from({ length: categories.length - 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!scrollerRef.current) return;
                  const cardWidth = scrollerRef.current.children[0]?.clientWidth || (scrollerRef.current.clientWidth / 2);
                  scrollerRef.current.scrollTo({
                    left: i * cardWidth,
                    behavior: 'smooth'
                  });
                }}
                className={`h-1.5 rounded-full transition-all ${
                  (currentIndex || 0) === i ? "w-4 bg-brand-primary" : "w-1.5 bg-zinc-300"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

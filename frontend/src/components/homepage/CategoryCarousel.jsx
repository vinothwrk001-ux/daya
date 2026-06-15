import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { getHomepageCategories, trackCategoryEvent } from "../../services/categoryService";

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
  const image = resolveApiAssetUrl(category.thumbnail_url || category.thumbnailUrl || category.logo || category.icon);

  return (
    <Link
      to={`/category/${category.slug}`}
      onClick={() => onClick?.(category)}
      className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-red-500/70 hover:shadow-[0_20px_40px_rgba(220,38,38,0.18)]"
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0, transparent 35%), radial-gradient(circle at 80% 0%, rgba(220,38,38,0.15) 0, transparent 40%)",
        }}
      />
      <div className="relative flex flex-1 items-center justify-center p-6 transition duration-300 group-hover:scale-105">
        {image ? (
          <img
            src={image}
            alt={category.name}
            loading="lazy"
            className="max-h-28 max-w-full object-contain drop-shadow-2xl"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-600/20 text-2xl font-black text-red-400">
            {(category.name || "C").slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="relative border-t border-white/10 bg-black/80 px-4 py-4 text-center">
        <p className="text-sm font-black uppercase tracking-wide text-white">{category.name}</p>
        {typeof category.productCount === "number" ? (
          <p className="mt-1 text-[11px] font-semibold text-zinc-400">{category.productCount} products</p>
        ) : null}
      </div>
    </Link>
  );
}

export function CategoryCarousel() {
  const [categories, setCategories] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef(null);

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

  function scrollBy(direction) {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = node.clientWidth * 0.85;
    node.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  function handleCategoryClick(category) {
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
    <section id="categories" className="bg-white px-4 py-10 dark:bg-zinc-950 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-red-600">{config.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black text-zinc-950 dark:text-white md:text-3xl">{config.title}</h2>
            {config.subtitle ? (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{config.subtitle}</p>
            ) : null}
          </div>
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-red-500 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-red-500 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="grid grid-flow-col auto-cols-[calc(50%-0.5rem)] gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:auto-cols-[calc(33.333%-0.75rem)] xl:auto-cols-[calc(20%-0.8rem)] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => (
            <CategoryCard key={category._id} category={category} onClick={handleCategoryClick} />
          ))}
        </div>
      </div>
    </section>
  );
}

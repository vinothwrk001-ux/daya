import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { getHeroBannerCategories, trackCategoryEvent } from "../../services/categoryService";

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

function resolveHeroImage(category) {
  return resolveApiAssetUrl(
    category?.heroImage ||
      category?.banner_url ||
      category?.bannerUrl ||
      category?.featuredProduct?.image ||
      category?.thumbnail_url ||
      category?.thumbnailUrl ||
      category?.logo ||
      category?.icon
  );
}

function resolveHeroHeading(category) {
  return category?.hero_heading || category?.heroHeading || category?.name || "";
}

function resolveHeroSubheading(category) {
  return (
    category?.hero_subheading ||
    category?.heroSubheading ||
    category?.description ||
    category?.featuredProduct?.name ||
    ""
  );
}

export function useCategoryHeroBanner() {
  const [categories, setCategories] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getHeroBannerCategories();
        if (cancelled) return;
        setCategories(data.categories || []);
        setConfig(data.config || null);
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCategory = categories[activeIndex] || categories[0] || null;

  useEffect(() => {
    if (!config?.enabled || categories.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % categories.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [categories.length, config?.enabled]);

  function handleSelect(category) {
    const index = categories.findIndex((item) => item._id === category._id);
    if (index >= 0) setActiveIndex(index);
    trackCategoryEvent(category._id, {
      eventType: "click",
      sessionId: getSessionId(),
    }).catch(() => {});
  }

  const isActive = !loading && config?.enabled !== false && categories.length > 0;

  return {
    categories,
    config,
    loading,
    activeIndex,
    setActiveIndex,
    activeCategory,
    handleSelect,
    isActive,
    heroImage: resolveHeroImage(activeCategory),
    heroHeading: resolveHeroHeading(activeCategory),
    heroSubheading: resolveHeroSubheading(activeCategory),
  };
}

function HeroCategoryCard({ category, active, onSelect, compact = false }) {
  const image = resolveApiAssetUrl(category.thumbnail_url || category.thumbnailUrl || category.logo || category.icon);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onSelect(category)}
        className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition duration-300 ${
          active
            ? "border-red-500 bg-white shadow-md"
            : "border-zinc-200 bg-white/90 hover:border-red-400 dark:border-zinc-700 dark:bg-zinc-900/90"
        }`}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
          {image ? (
            <img src={image} alt={category.name} className="h-full w-full object-contain p-1.5" loading="lazy" />
          ) : (
            <span className="text-sm font-black text-red-400">{(category.name || "C").slice(0, 1)}</span>
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-zinc-900 dark:text-white sm:text-sm">{category.name}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className={`group relative flex w-[120px] shrink-0 flex-col overflow-hidden rounded-2xl border transition duration-300 sm:w-[140px] md:w-[155px] ${
        active
          ? "border-red-500 shadow-[0_0_0_2px_rgba(220,38,38,0.35)]"
          : "border-zinc-800 hover:border-red-500/70 hover:shadow-[0_16px_32px_rgba(220,38,38,0.18)]"
      }`}
    >
      <div
        className="relative aspect-square bg-zinc-950"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 10px)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center p-4 transition duration-300 group-hover:scale-105 sm:p-5">
          {image ? (
            <img src={image} alt={category.name} className="max-h-16 max-w-full object-contain drop-shadow-lg sm:max-h-20" loading="lazy" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600/20 text-lg font-black text-red-400 sm:h-16 sm:w-16 sm:text-xl">
              {(category.name || "C").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div className="bg-zinc-950 px-2 py-2 sm:px-3 sm:py-3">
        <span className="inline-flex w-full items-center justify-center rounded-full bg-white px-2 py-1.5 text-[10px] font-bold text-zinc-950 sm:px-3 sm:py-2 sm:text-xs">
          {category.name}
        </span>
      </div>
    </button>
  );
}

export function CategoryHeroLeftRail({ categories = [], config = {}, activeCategory = null, onSelect }) {
  return (
    <div className="flex h-full flex-col rounded-[1.5rem] bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:bg-zinc-950/95 sm:rounded-[2rem] sm:p-5">
      <span className="inline-flex w-fit rounded-full border border-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-red-600">
        {config.eyebrow || "CATEGORIES"}
      </span>
      <p className="mt-3 text-xs leading-6 text-zinc-600 dark:text-zinc-300">
        {config.panelDescription ||
          "Explore a wide range of stylish apparel, designed for comfort, quality, and everyday wear."}
      </p>
      <div className="mt-4 flex flex-col gap-2.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => (
          <HeroCategoryCard
            key={category._id}
            category={category}
            active={category._id === activeCategory?._id}
            onSelect={onSelect}
            compact
          />
        ))}
      </div>
    </div>
  );
}

export function CategoryHeroPreviewCompact({
  activeCategory = null,
  config = {},
  heroImage = "",
  heroHeading = "",
  heroSubheading = "",
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:bg-zinc-950/95 sm:rounded-[2rem] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-600 sm:text-xs">
            {activeCategory?.name || "Featured"}
          </p>
          <h2 className="mt-2 text-xl font-black uppercase leading-tight tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
            {heroHeading}
          </h2>
          {heroSubheading ? (
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300 sm:text-sm">
              {heroSubheading}
            </p>
          ) : null}
          {activeCategory ? (
            <Link
              to={`/category/${activeCategory.slug}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 sm:text-sm"
            >
              {config.ctaLabel || "Shop now"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
        {heroImage ? (
          <div className="mx-auto shrink-0 sm:mx-0">
            <img
              key={activeCategory?._id}
              src={heroImage}
              alt={heroHeading}
              className="max-h-[140px] w-auto rounded-2xl object-contain drop-shadow-xl sm:max-h-[180px]"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CategoryHeroBannerInBanner({ rightContent = null, fallback = null }) {
  const hero = useCategoryHeroBanner();

  if (hero.loading) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 animate-pulse gap-4 px-2 pb-6 lg:px-4">
        <div className="hidden w-[240px] rounded-[2rem] bg-white/40 md:block" />
        <div className="min-h-[280px] flex-1 rounded-[2rem] bg-white/40" />
      </div>
    );
  }

  if (!hero.isActive) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-2 pb-6 lg:px-4">
        {fallback}
        {rightContent}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-2 pb-6 lg:flex-row lg:items-stretch lg:gap-5 lg:px-4">
      <aside className="w-full shrink-0 lg:w-[240px] xl:w-[280px]">
        <CategoryHeroLeftRail
          categories={hero.categories}
          config={hero.config}
          activeCategory={hero.activeCategory}
          onSelect={hero.handleSelect}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <CategoryHeroPreviewCompact
          activeCategory={hero.activeCategory}
          config={hero.config}
          heroImage={hero.heroImage}
          heroHeading={hero.heroHeading}
          heroSubheading={hero.heroSubheading}
        />
        <div className="min-w-0 flex-1">{rightContent}</div>
      </div>
    </div>
  );
}

export function CategoryHeroBannerSplit({
  embedded = false,
  categories = [],
  config = {},
  activeCategory = null,
  activeIndex = 0,
  setActiveIndex,
  onSelect,
  heroImage = "",
  heroHeading = "",
  heroSubheading = "",
  categoriesOnLeft = true,
}) {
  const panelClass = embedded
    ? "rounded-[1.5rem] bg-white/92 p-4 shadow-lg backdrop-blur-sm dark:bg-zinc-950/90 sm:rounded-[2rem] sm:p-6"
    : "rounded-[2rem] bg-white/70 p-6 shadow-sm dark:bg-zinc-900/70 sm:p-8";

  const categoriesPanel = (
    <div className={`flex min-h-[240px] flex-col justify-center ${panelClass} sm:min-h-[280px]`}>
      <div className="mb-4 sm:mb-6">
        <span className="inline-flex rounded-full border border-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-red-600 sm:px-4 sm:text-[11px] sm:tracking-[0.28em]">
          {config.eyebrow || "CATEGORIES"}
        </span>
        <p className="mt-3 max-w-md text-xs leading-6 text-zinc-600 dark:text-zinc-300 sm:mt-4 sm:text-sm sm:leading-7">
          {config.panelDescription ||
            "Explore a wide range of stylish apparel, designed for comfort, quality, and everyday wear."}
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 sm:pb-2 [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => (
          <HeroCategoryCard
            key={category._id}
            category={category}
            active={category._id === activeCategory?._id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );

  const heroPanel = (
    <div className={`relative min-h-[280px] overflow-hidden ${panelClass} sm:min-h-[320px]`}>
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-600 sm:text-xs">
            {activeCategory?.name || "Featured"}
          </p>
          <h2 className="mt-3 max-w-xl text-2xl font-black uppercase leading-[0.95] tracking-tight text-zinc-950 transition duration-300 dark:text-white sm:mt-4 sm:text-4xl lg:text-5xl">
            {heroHeading}
          </h2>
          {heroSubheading ? (
            <p className="mt-3 max-w-lg text-xs font-medium uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-300 sm:text-sm">
              {heroSubheading}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:mt-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {activeCategory ? (
              <Link
                to={`/category/${activeCategory.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 sm:px-5 sm:py-3 sm:text-sm"
              >
                {config.ctaLabel || "Shop now"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            {categories.length > 1 ? (
              <div className="flex items-center gap-2">
                {categories.map((category, index) => (
                  <button
                    key={category._id}
                    type="button"
                    aria-label={`Show ${category.name}`}
                    onClick={() => setActiveIndex?.(index)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      index === activeIndex ? "w-8 bg-red-600" : "w-2.5 bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {heroImage ? (
            <div className="relative mx-auto flex max-w-[200px] flex-1 items-end justify-center sm:max-w-[240px] lg:mx-0 lg:max-w-[280px]">
              <img
                key={activeCategory?._id}
                src={heroImage}
                alt={heroHeading}
                className="max-h-[180px] w-auto rounded-2xl object-contain drop-shadow-2xl transition duration-300 sm:max-h-[220px] lg:max-h-[260px]"
                loading="lazy"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`grid w-full gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6 ${
        embedded ? "max-w-7xl" : ""
      }`}
    >
      {categoriesOnLeft ? (
        <>
          {categoriesPanel}
          {heroPanel}
        </>
      ) : (
        <>
          {heroPanel}
          {categoriesPanel}
        </>
      )}
    </div>
  );
}

export function CategoryHeroBannerEmbedded({ fallback = null }) {
  const hero = useCategoryHeroBanner();

  if (hero.loading) {
    return (
      <div className="mx-auto w-full max-w-7xl animate-pulse px-4 pb-6 sm:px-6 lg:px-8">
        <div className="grid min-h-[320px] gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-white/50" />
          <div className="rounded-[2rem] bg-white/50" />
        </div>
      </div>
    );
  }

  if (!hero.isActive) return fallback;

  return (
    <div className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-2 sm:px-6 sm:pb-10 lg:px-8">
      <CategoryHeroBannerSplit
        embedded
        categoriesOnLeft={false}
        categories={hero.categories}
        config={hero.config}
        activeCategory={hero.activeCategory}
        activeIndex={hero.activeIndex}
        setActiveIndex={hero.setActiveIndex}
        onSelect={hero.handleSelect}
        heroImage={hero.heroImage}
        heroHeading={hero.heroHeading}
        heroSubheading={hero.heroSubheading}
      />
    </div>
  );
}

export function CategoryHeroBanner() {
  const hero = useCategoryHeroBanner();

  if (hero.loading) {
    return (
      <section className="bg-[#f3f1ec] px-4 py-8 dark:bg-zinc-950 lg:px-8">
        <div className="mx-auto grid max-w-7xl animate-pulse gap-8 lg:grid-cols-2">
          <div className="min-h-[420px] rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="min-h-[420px] rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </section>
    );
  }

  if (!hero.isActive) return null;

  return (
    <section className="relative overflow-hidden bg-[#f3f1ec] dark:bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.04) 0, transparent 35%), radial-gradient(circle at 80% 0%, rgba(220,38,38,0.06) 0, transparent 40%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-10">
        <CategoryHeroBannerSplit
          categories={hero.categories}
          config={hero.config}
          activeCategory={hero.activeCategory}
          activeIndex={hero.activeIndex}
          setActiveIndex={hero.setActiveIndex}
          onSelect={hero.handleSelect}
          heroImage={hero.heroImage}
          heroHeading={hero.heroHeading}
          heroSubheading={hero.heroSubheading}
        />
      </div>
    </section>
  );
}

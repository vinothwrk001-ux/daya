import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { getCategoryHref } from "../../utils/categoryLinks";
import { getHeroBannerCategories, trackCategoryEvent } from "../../services/categoryService";

const DEFAULT_HERO_CONFIG = {
  enabled: true,
  eyebrow: "CATEGORIES",
  panelDescription:
    "Explore a wide range of stylish apparel, designed for comfort, quality, and everyday wear.",
  ctaLabel: "Shop now",
  autoRotate: false,
  rotationInterval: 5000,
};

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
      category?.hero_image ||
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

function resolveDefaultActiveIndex(categories = [], config = {}) {
  if (!categories.length) return 0;
  const defaultId = config?.defaultCategoryId;
  if (defaultId) {
    const matchedIndex = categories.findIndex((item) => String(item._id) === String(defaultId));
    if (matchedIndex >= 0) return matchedIndex;
  }
  return 0;
}

export function useCategoryHeroBanner() {
  const [categories, setCategories] = useState([]);
  const [config, setConfig] = useState(DEFAULT_HERO_CONFIG);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getHeroBannerCategories();
        if (cancelled) return;
        const nextCategories = data?.categories || [];
        const nextConfig = { ...DEFAULT_HERO_CONFIG, ...(data?.config || {}) };
        setCategories(nextCategories);
        setConfig(nextConfig);
        setActiveIndex(resolveDefaultActiveIndex(nextCategories, nextConfig));
      } catch {
        if (!cancelled) {
          setCategories([]);
          setConfig(DEFAULT_HERO_CONFIG);
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

  const activeCategory = categories[activeIndex] || categories[0] || null;
  const isEnabled = config?.enabled !== false;
  const isActive = !loading && isEnabled && categories.length > 0;

  useEffect(() => {
    if (!config?.autoRotate || !isEnabled || categories.length <= 1) return undefined;
    const intervalMs = Math.max(2000, Number(config.rotationInterval || 5000));
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % categories.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [categories.length, config?.autoRotate, config?.rotationInterval, isEnabled]);

  useEffect(() => {
    if (!activeCategory?._id || loading) return;
    trackCategoryEvent(activeCategory._id, {
      eventType: "view",
      sessionId: getSessionId(),
    }).catch(() => {});
  }, [activeCategory?._id, loading]);

  function handleSelect(category) {
    const index = categories.findIndex((item) => item._id === category._id);
    if (index >= 0) setActiveIndex(index);
    trackCategoryEvent(category._id, {
      eventType: "click",
      sessionId: getSessionId(),
    }).catch(() => {});
  }

  return {
    categories,
    config,
    loading,
    activeIndex,
    setActiveIndex,
    activeCategory,
    handleSelect,
    isEnabled,
    isActive,
    heroImage: resolveHeroImage(activeCategory),
    heroHeading: resolveHeroHeading(activeCategory),
    heroSubheading: resolveHeroSubheading(activeCategory),
  };
}

function HeroCategoryEmptyState({ message = "No Featured Categories Available" }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-zinc-300 bg-white px-6 py-10 text-center shadow-xl sm:min-h-[320px] sm:rounded-[2rem]">
      <p className="text-base font-semibold text-zinc-800">{message}</p>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        Enable categories in admin with &quot;Display in hero banner&quot; to show them here.
      </p>
    </div>
  );
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
            ? "border-brand-primary bg-white shadow-md"
            : "border-zinc-200 bg-white/90 hover:border-brand-primary dark:border-zinc-700 dark:bg-zinc-900/90"
        }`}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
          {image ? (
            <img src={image} alt={category.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="text-sm font-black text-brand-primary">{(category.name || "C").slice(0, 1)}</span>
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
      className={`group relative flex w-full flex-col overflow-hidden rounded-3xl border-2 border-black transition duration-300 ${
        active
          ? "border-brand-primary shadow-[0_0_0_3px_rgba(220,38,38,0.35)]"
          : "border-black hover:border-brand-primary/70 hover:shadow-[0_16px_32px_rgba(220,38,38,0.18)]"
      }`}
    >
      <div
        className="category-card-image-container relative aspect-square overflow-hidden bg-zinc-950"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 10px)",
        }}
      >
        {image ? (
          <img src={image} alt={category.name || "Category"} className="category-card-image block h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-brand-primary/20 text-lg font-black text-brand-primary sm:text-xl">
            {(category.name || "C").slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex flex-col border-t border-white/10 bg-zinc-950 px-2 py-2 sm:px-3 sm:py-3">
        <p className="line-clamp-1 text-center text-[10px] font-black uppercase tracking-wide text-white sm:text-xs">{category.name || "Category"}</p>
        <p className="line-clamp-1 text-center text-[9px] font-semibold text-zinc-400 sm:text-[10px]">{typeof category.productCount === "number" ? category.productCount : 0} products</p>
      </div>
    </button>
  );
}

export function CategoryHeroLeftRail({ categories = [], config = {}, activeCategory = null, onSelect }) {
  return (
    <div className="flex h-full flex-col rounded-[1.5rem] bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:bg-zinc-950/95 sm:rounded-[2rem] sm:p-5">
      <span className="inline-flex w-fit rounded-full border border-brand-primary px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-brand-primary">
        {config.eyebrow || "CATEGORIES"}
      </span>
      <p className="mt-3 text-xs leading-6 text-zinc-600 dark:text-zinc-300">
        {config.panelDescription || DEFAULT_HERO_CONFIG.panelDescription}
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
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-brand-primary sm:text-xs">
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
              to={getCategoryHref(activeCategory)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-primaryHover sm:text-sm"
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
  categoriesOnLeft = false,
}) {
  const panelClass = embedded
    ? "rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-xl sm:rounded-[2rem] sm:p-6"
    : "rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-lg sm:p-8";

  const categoriesPanel = (
    <div className={`flex min-h-[200px] max-h-[280px] flex-col justify-center overflow-hidden ${panelClass} sm:min-h-[220px] sm:max-h-[320px]`}>
      <div className="mb-4 space-y-4 sm:mb-6">
        <div>
          <span className="inline-flex rounded-full border border-brand-primary px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-brand-primary sm:px-4 sm:text-[11px] sm:tracking-[0.28em]">
            {config.eyebrow || "CATEGORIES"}
          </span>
          <p className="mt-3 max-w-md text-xs leading-6 text-zinc-600 sm:mt-4 sm:text-sm sm:leading-7">
            {config.panelDescription || DEFAULT_HERO_CONFIG.panelDescription}
          </p>
        </div>
        {activeCategory ? (
          <div className="rounded-[1.5rem] bg-zinc-50 p-4 shadow-sm sm:p-5">
            {heroHeading ? (
              <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950 sm:text-xl">
                {heroHeading}
              </h2>
            ) : null}
            {heroSubheading ? (
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600 sm:text-sm">
                {heroSubheading}
              </p>
            ) : null}
            <Link
              to={getCategoryHref(activeCategory)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brand-primaryHover sm:px-5 sm:py-3 sm:text-sm"
            >
              {config.ctaLabel || "Shop now"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </div>

      {categories.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-4">
          {categories.map((category) => (
            <HeroCategoryCard
              key={category._id}
              category={category}
              active={category._id === activeCategory?._id}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <HeroCategoryEmptyState />
      )}
    </div>
  );

  const heroPanel = (
    <div className={`relative min-h-[200px] max-h-[280px] overflow-hidden ${panelClass} sm:min-h-[220px] sm:max-h-[320px]`}>
      <div className="relative z-10 flex h-full items-center justify-center">
        {heroImage ? (
          <img
            key={activeCategory?._id}
            src={heroImage}
            alt={heroHeading}
            className="max-h-[220px] w-auto rounded-2xl object-contain drop-shadow-2xl transition duration-300 sm:max-h-[260px]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">No image</div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`grid w-full gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6 ${embedded ? "max-w-7xl" : ""}`}>
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

export function HeroBannerCategoryZone({ fallback = null }) {
  const hero = useCategoryHeroBanner();

  if (hero.loading) {
    return (
      <div className="grid w-full animate-pulse gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="min-h-[320px] rounded-[2rem] bg-white/80" />
        <div className="min-h-[320px] rounded-[2rem] bg-white/80" />
      </div>
    );
  }

  if (!hero.isEnabled) {
    return fallback;
  }

  if (!hero.categories.length) {
    return <HeroCategoryEmptyState />;
  }

  return (
    <CategoryHeroBannerSplit
      embedded
      categoriesOnLeft={true}
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
  );
}

export function CategoryHeroBannerInBanner({ rightContent = null, fallback = null }) {
  return (
    <div className="mx-auto w-full max-w-content flex-col gap-4">
      <HeroBannerCategoryZone fallback={fallback} />
      {rightContent ? <div className="mt-4 min-w-0">{rightContent}</div> : null}
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

  if (!hero.isActive) {
    if (!hero.isEnabled) return fallback;
    return <HeroCategoryEmptyState />;
  }

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

  if (!hero.isActive) {
    if (!hero.isEnabled) return null;
    return (
      <section className="bg-[#f3f1ec] px-4 py-8 dark:bg-zinc-950 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <HeroCategoryEmptyState />
        </div>
      </section>
    );
  }

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
    </section>
  );
}

export { HeroBannerCategoryZone as HomepageHeroCategoryCarousel };

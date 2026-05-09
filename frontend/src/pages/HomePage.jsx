import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Headphones,
  LockKeyhole,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { CategoryCarousel } from "../components/CategoryCarousel";
import { HomepageContentCMS } from "../components/HomepageContentCMS";
import { ProductCard } from "../components/ProductCard";
import { PromoBanner } from "../components/PromoBanner";
import { MotionItem, MotionStagger, AnimatedSection } from "../components/home/AnimatedSection";
import { RippleButton } from "../components/home/RippleButton";
import { ReelFeed } from "../components/reel/ReelFeed";
import { useCategories } from "../hooks/useCategories";
import * as productService from "../services/productService";
import { trackClick } from "../services/contentService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { usePresentedCategories } from "../utils/categoryPresentation.jsx";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";

const trustItems = [
  {
    icon: Truck,
    title: "Fast & secure delivery",
    detail: "Priority fulfillment, protected packaging, and reliable tracking from checkout to doorstep.",
  },
  {
    icon: Headphones,
    title: "Dedicated support",
    detail: "Human-first support for product questions, order help, and post-purchase confidence.",
  },
  {
    icon: ShieldCheck,
    title: "Verified sellers",
    detail: "Curated vendors and transparent storefront quality standards across every category.",
  },
  {
    icon: LockKeyhole,
    title: "Secure payment",
    detail: "Protected transactions and a frictionless checkout experience tuned for trust.",
  },
];

export function HomePage() {
  const { influencerCommerceEnabled, loading: commerceLoading } = usePlatformFeatures();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [homepageContent, setHomepageContent] = useState({
    hero: [],
    promo: [],
    collection: [],
  });
  const [popularPicks, setPopularPicks] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const { categories, loading: categoriesLoading } = useCategories();
  const presentedCategories = usePresentedCategories(categories);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [popularRes, trendingRes, recommendedRes] = await Promise.all([
          productService.getPublicProducts({ limit: 8, sortBy: "analytics.views", sortOrder: "desc" }),
          productService.getPublicProducts({ limit: 8, sortBy: "createdAt", sortOrder: "desc" }),
          productService.getPublicProducts({ limit: 8, sortBy: "ratings.averageRating", sortOrder: "desc" }),
        ]);

        if (cancelled) return;

        setPopularPicks(popularRes?.data?.products || []);
        setTrending(trendingRes?.data?.products || []);
        setRecommended(recommendedRes?.data?.products || []);
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.message || "Failed to load storefront");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const spotlightProducts = useMemo(
    () =>
      [...popularPicks, ...trending, ...recommended]
        .filter(Boolean)
        .filter((product, index, items) => index === items.findIndex((candidate) => candidate?._id === product?._id))
        .slice(0, 6),
    [popularPicks, trending, recommended]
  );

  return (
    <div className="space-y-8 lg:space-y-10">
      {/* DYNAMIC HOMEPAGE CONTENT CMS */}
      <HomepageContentCMS
        showPromo={false}
        showCollection={false}
        onContentLoaded={setHomepageContent}
      />

      <AnimatedSection className="relative" y={24}>
        <TrustSection />
      </AnimatedSection>

      {!commerceLoading && influencerCommerceEnabled ? (
        <AnimatedSection y={28}>
          <ReelFeed />
        </AnimatedSection>
      ) : null}

      <AnimatedSection y={30}>
        <CategoryCarousel
          title="Curated categories"
          categories={presentedCategories}
          loading={categoriesLoading}
          onSelect={(cat) => navigate(`/shop?category=${encodeURIComponent(cat.name)}`)}
        />
      </AnimatedSection>

      <AnimatedSection x={-24}>
        <ManagedPromoSection promos={homepageContent.promo} />
      </AnimatedSection>

      {error ? (
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <ProductShowcaseSection
        title="Popular picks"
        subtitle="Most viewed products with elevated merchandising, subtle depth, and quick actions."
        items={popularPicks}
        loading={loading}
        viewAllHref="/shop?sortBy=analytics.views&sortOrder=desc"
      />

      <ProductShowcaseSection
        title="Trending now"
        subtitle="Fresh arrivals and fast movers surfaced with premium visual hierarchy and motion."
        items={trending}
        loading={loading}
        viewAllHref="/shop?sortBy=createdAt&sortOrder=desc"
      />

      <ProductShowcaseSection
        title="Top rated"
        subtitle="Highly loved products presented in a responsive, high-conversion product experience."
        items={recommended}
        loading={loading}
        viewAllHref="/shop?sortBy=ratings.averageRating&sortOrder=desc"
      />

      <AnimatedSection x={20}>
        <BottomPromoSection
          featuredProducts={spotlightProducts}
          collection={homepageContent.collection || []}
          onExploreCollection={() => navigate("/shop")}
        />
      </AnimatedSection>
    </div>
  );
}

function TrustSection() {
  return (
    <MotionStagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" once>
      {trustItems.map((item) => {
        const Icon = item.icon;
        return (
          <MotionItem key={item.title}>
            <Motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              className="rounded-[1.75rem] border border-white/60 bg-white/72 p-5 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {item.detail}
                  </p>
                </div>
              </div>
            </Motion.div>
          </MotionItem>
        );
      })}
    </MotionStagger>
  );
}

function ProductShowcaseSection({ title, subtitle, items, loading, viewAllHref }) {
  return (
    <AnimatedSection y={30}>
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">Product discovery</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white lg:text-3xl">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">
              {subtitle}
            </p>
          </div>
          <Link
            to={viewAllHref}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-400/30 dark:hover:text-indigo-300"
          >
            View all
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => <ProductCardSkeleton key={index} />)
            : items?.length
              ? items.map((product) => <ProductCard key={product._id} product={product} />)
              : (
                <div className="col-span-full rounded-[1.5rem] border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No products to show yet.
                </div>
              )}
        </div>
      </section>
    </AnimatedSection>
  );
}

function ManagedPromoSection({ promos = [] }) {
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedPromoVideos, setCompletedPromoVideos] = useState([]);
  const promoGroups = useMemo(() => {
    const items = Array.isArray(promos) ? promos.filter(Boolean) : [];
    const groups = [];
    for (let index = 0; index < items.length; index += 2) {
      groups.push(items.slice(index, index + 2));
    }
    return groups;
  }, [promos]);

  const activeGroup = promoGroups[currentIndex] || [];
  const activeVideoIds = useMemo(
    () => activeGroup.filter((promo) => promo?.mediaType === "video" && promo?._id).map((promo) => promo._id),
    [activeGroup]
  );

  useEffect(() => {
    setCurrentIndex(0);
  }, [promoGroups.length]);

  useEffect(() => {
    setCompletedPromoVideos([]);
  }, [currentIndex]);

  useEffect(() => {
    if (prefersReducedMotion || promoGroups.length <= 1) {
      return undefined;
    }

    if (activeVideoIds.length > 0) {
      if (completedPromoVideos.length === activeVideoIds.length) {
        setCurrentIndex((prev) => (prev + 1) % promoGroups.length);
      }
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % promoGroups.length);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [activeVideoIds.length, completedPromoVideos.length, prefersReducedMotion, promoGroups.length]);

  if (promoGroups.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <Motion.div
          key={`promo-group-${currentIndex}`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -18 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-5 lg:grid-cols-2"
        >
          {activeGroup.map((promo, index) => (
            <PromoBanner
              key={promo._id}
              eyebrow={index === 0 ? "Admin feature" : "Vendor spotlight"}
              title={promo.title}
              description={promo.description}
              image={promo.image}
              mediaType={promo.mediaType}
              href={promo.ctaUrl || "/shop"}
              ctaText={promo.ctaText || "Explore"}
              align={index % 2 === 0 ? "left" : "right"}
              onClick={() => {
                if (!promo?.ctaUrl) return;
                trackClick(promo._id).catch(() => {});
                window.location.assign(promo.ctaUrl);
              }}
              onVideoEnded={
                promo.mediaType === "video"
                  ? () =>
                      setCompletedPromoVideos((prev) =>
                        prev.includes(promo._id) ? prev : [...prev, promo._id]
                      )
                  : undefined
              }
            />
          ))}
        </Motion.div>
      </AnimatePresence>

      {promoGroups.length > 1 ? (
        <>
          <div className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
            <SliderControls
              currentIndex={currentIndex}
              itemCount={promoGroups.length}
              onPrevious={() => setCurrentIndex((prev) => (prev - 1 + promoGroups.length) % promoGroups.length)}
              onNext={() => setCurrentIndex((prev) => (prev + 1) % promoGroups.length)}
              onSelect={setCurrentIndex}
              compact
              orientation="vertical"
            />
          </div>
          <div className="mt-4 lg:hidden">
            <SliderControls
              currentIndex={currentIndex}
              itemCount={promoGroups.length}
              onPrevious={() => setCurrentIndex((prev) => (prev - 1 + promoGroups.length) % promoGroups.length)}
              onNext={() => setCurrentIndex((prev) => (prev + 1) % promoGroups.length)}
              onSelect={setCurrentIndex}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function BottomPromoSection({ featuredProducts, collection, onExploreCollection }) {
  const prefersReducedMotion = useReducedMotion();
  const collections = Array.isArray(collection) ? collection.filter(Boolean) : collection ? [collection] : [];
  const [currentCollectionIndex, setCurrentCollectionIndex] = useState(0);
  const activeCollection = collections[currentCollectionIndex] || null;

  useEffect(() => {
    setCurrentCollectionIndex(0);
  }, [collections.length]);

  useEffect(() => {
    if (prefersReducedMotion || collections.length <= 1) {
      return undefined;
    }

    if (activeCollection?.mediaType === "video") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentCollectionIndex((prev) => (prev + 1) % collections.length);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [activeCollection?.mediaType, collections.length, prefersReducedMotion]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Motion.div
        whileHover={{ y: -6 }}
        className="group relative w-full max-w-[1100px] h-[650px] overflow-hidden rounded-[2.5rem] border border-white/60 bg-white shadow-[0_40px_140px_-60px_rgba(15,23,42,0.25)] flex"
      >
        <AnimatePresence mode="wait">
          <Motion.div
            key={activeCollection?._id || "collection-fallback"}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {activeCollection?.mediaType === "video" ? (
              <video
                src={activeCollection.image}
                autoPlay
                muted
                playsInline
                onEnded={() => {
                  if (collections.length > 1) {
                    setCurrentCollectionIndex((prev) => (prev + 1) % collections.length);
                  }
                }}
                className="h-full min-h-[22rem] w-full object-cover transition duration-700 group-hover:scale-105"
              />
            ) : (
              <img
                src={activeCollection?.image || "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1600&q=80"}
                alt={activeCollection?.title || "Promotional collection"}
                className="h-full min-h-[22rem] w-full object-cover transition duration-700 group-hover:scale-105"
                loading="lazy"
              />
            )}
          </Motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/55 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
          <h3 className="max-w-xl translate-y-6 text-3xl font-semibold tracking-[-0.04em] text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            {activeCollection?.title || "Discover elevated collections with layered storytelling and hover-revealed depth."}
          </h3>
          <p className="mt-4 max-w-lg translate-y-6 text-sm leading-7 text-white opacity-0 transition-all duration-300 delay-75 group-hover:translate-y-0 group-hover:opacity-100">
            {activeCollection?.description || "This lower banner is designed to stay compact by default and expand emotionally on hover with richer context and stronger CTA contrast."}
          </p>
          <div className="mt-6">
            <RippleButton
              onClick={() => {
                if (activeCollection?.ctaUrl) {
                  trackClick(activeCollection._id).catch(() => {});
                  window.location.assign(activeCollection.ctaUrl);
                  return;
                }
                onExploreCollection();
              }}
              className="translate-y-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 opacity-0 transition-all duration-300 delay-100 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-slate-100"
            >
              {activeCollection?.ctaText || "Explore the collection"}
            </RippleButton>
          </div>
        </div>
        {collections.length > 1 ? (
          <div className="absolute right-5 top-5 z-[2]">
            <SliderControls
              currentIndex={currentCollectionIndex}
              itemCount={collections.length}
              onPrevious={() => setCurrentCollectionIndex((prev) => (prev - 1 + collections.length) % collections.length)}
              onNext={() => setCurrentCollectionIndex((prev) => (prev + 1) % collections.length)}
              onSelect={setCurrentCollectionIndex}
              compact
            />
          </div>
        ) : null}
      </Motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        {featuredProducts.slice(0, 3).map((product) => (
          <Motion.article
            key={product._id}
            whileHover={{ y: -6 }}
            className="group overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/72 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72"
          >
            <div className="grid h-full gap-0 sm:grid-cols-[132px_minmax(0,1fr)]">
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-800">
                <img
                  src={resolveApiAssetUrl(product?.images?.[0]?.url || "")}
                  alt={product.name}
                  className="h-full min-h-[9rem] w-full object-contain p-2 transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/15 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
              </div>
              <div className="flex flex-col justify-between p-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">
                    Hover to discover
                  </p>
                  <h4 className="mt-2 line-clamp-2 text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {product.name}
                  </h4>
                  <div className="mt-3 overflow-hidden">
                    <p className="max-h-0 translate-y-3 text-sm leading-6 text-slate-600 opacity-0 transition-all duration-300 group-hover:max-h-24 group-hover:translate-y-0 group-hover:opacity-100 dark:text-slate-300">
                      {product.shortDescription || product.description || "Premium card poster treatment with supportive copy revealed below the image zone."}
                    </p>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden">
                  <Link
                    to={`/product/${product._id}`}
                    className="inline-flex translate-y-4 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-400/30 dark:hover:text-indigo-300"
                  >
                    View product
                  </Link>
                </div>
              </div>
            </div>
          </Motion.article>
        ))}
      </div>
    </div>
  );
}

function SliderControls({
  currentIndex,
  itemCount,
  onPrevious,
  onNext,
  onSelect,
  compact = false,
  orientation = "horizontal",
}) {
  const isVertical = orientation === "vertical";

  return (
    <div className={`flex gap-3 ${compact ? "rounded-[2rem] border border-white/15 bg-black/20 px-3 py-3 backdrop-blur" : ""} ${isVertical ? "flex-col items-center" : "items-center justify-between"}`}>
      <div className={`flex ${isVertical ? "flex-col items-center gap-2" : "items-center gap-2"}`}>
        <button
          type="button"
          onClick={onPrevious}
          aria-label={isVertical ? "Previous promo banners" : "Previous slide"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
        >
          {isVertical ? <ChevronUp className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label={isVertical ? "Next promo banners" : "Next slide"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 active:scale-95"
        >
          {isVertical ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      <div className={`flex ${isVertical ? "flex-col items-center gap-2" : "items-center gap-2"}`}>
        {Array.from({ length: itemCount }).map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            onClick={() => onSelect(index)}
            className={`rounded-full transition-all duration-300 ${
              isVertical
                ? index === currentIndex
                  ? "h-8 w-2.5 bg-white"
                  : "h-2.5 w-2.5 bg-white/45 hover:bg-white/70"
                : index === currentIndex
                  ? "h-2.5 w-8 bg-white"
                  : "h-2.5 w-2.5 bg-white/45 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/75 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-slate-900/75">
      <div className="aspect-[0.9] animate-pulse bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-5 w-5/6 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-11 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}


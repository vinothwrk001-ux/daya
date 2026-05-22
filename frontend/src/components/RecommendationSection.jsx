import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProductCarousel } from "./ProductCarousel";
import { ProductCard } from "./ProductCard";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { trackRecommendationEvent } from "../services/recommendationService";

const MAX_CONTAINER_ITEMS = 20;

function deriveRecommendationType(title = "", mode = "carousel") {
  const normalized = String(title).toLowerCase();
  if (mode === "bundle" || normalized.includes("bought together")) return "bundle";
  if (normalized.includes("related")) return "related";
  if (normalized.includes("similar")) return "similar";
  if (normalized.includes("upsell") || normalized.includes("better")) return "upsell";
  if (normalized.includes("add-on") || normalized.includes("add on")) return "cross_sell";
  if (normalized.includes("recently viewed")) return "recently_viewed";
  if (normalized.includes("recommended for you")) return "personalized";
  if (normalized.includes("trending")) return "trending";
  return "recommendation";
}

export function RecommendationSection({
  title,
  subtitle,
  items = [],
  mode = "carousel",
  layout = "carousel",
  bundleTotal = 0,
  recommendationType,
  surface = "storefront",
  sourceProductId = "",
  featuredHeroIntervalMs = 4500,
}) {
  const navigate = useNavigate();
  const visibleItems = useMemo(
    () => (Array.isArray(items) ? items.slice(0, MAX_CONTAINER_ITEMS) : []),
    [items]
  );
  const sectionLayout = mode === "bundle" ? "bundle" : String(layout || mode || "carousel").toLowerCase();
  const [featuredHeroIndex, setFeaturedHeroIndex] = useState(0);
  const resolvedRecommendationType = recommendationType || deriveRecommendationType(title, mode);
  const viewKey = useMemo(
    () => `${resolvedRecommendationType}:${surface}:${sourceProductId}:${visibleItems.map((item) => item?._id).filter(Boolean).join(",")}`,
    [visibleItems, resolvedRecommendationType, sourceProductId, surface]
  );
  const trackedViewKeyRef = useRef("");

  useEffect(() => {
    if (!visibleItems.length || trackedViewKeyRef.current === viewKey) return;
    trackedViewKeyRef.current = viewKey;
    visibleItems.forEach((item) => {
      if (!item?._id) return;
      trackRecommendationEvent({
        recommendationType: resolvedRecommendationType,
        surface,
        eventType: "VIEW",
        productId: sourceProductId || null,
        recommendedProductId: item._id,
      }).catch(() => {});
    });
  }, [visibleItems, resolvedRecommendationType, sourceProductId, surface, viewKey]);

  useEffect(() => {
    setFeaturedHeroIndex(0);
  }, [viewKey]);

  useEffect(() => {
    if (sectionLayout !== "featured" || visibleItems.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setFeaturedHeroIndex((current) => (current + 1) % visibleItems.length);
    }, Number(featuredHeroIntervalMs || 4500));
    return () => window.clearInterval(timer);
  }, [featuredHeroIntervalMs, sectionLayout, visibleItems.length]);

  if (!visibleItems.length) return null;

  function trackClick(product) {
    if (!product?._id) return;
    trackRecommendationEvent({
      recommendationType: resolvedRecommendationType,
      surface,
      eventType: "CLICK",
      productId: sourceProductId || null,
      recommendedProductId: product._id,
    }).catch(() => {});
  }

  if (sectionLayout === "bundle") {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
          </div>
          <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            Bundle total: {formatCurrency(bundleTotal)}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {visibleItems.map((item) => (
            <ProductCard key={item._id} product={item} cardStyle="MINIMAL" imageAspectClass="aspect-[1/1]" onProductClick={trackClick} />
          ))}
        </div>
      </section>
    );
  }

  if (sectionLayout === "grid") {
    return (
      <section className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72 sm:p-6 lg:p-8">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">Product discovery</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white lg:text-3xl">{title}</h2>
          {subtitle ? <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">{subtitle}</p> : null}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
          {visibleItems.map((item) => (
            <ProductCard key={item._id} product={item} cardStyle="MINIMAL" imageAspectClass="aspect-[1/1]" onProductClick={trackClick} />
          ))}
        </div>
      </section>
    );
  }

  if (sectionLayout === "featured") {
    const heroProduct = visibleItems[featuredHeroIndex % visibleItems.length];
    const heroImageUrl = resolveApiAssetUrl(heroProduct?.images?.[0]?.url || "");
    const heroPrice = heroProduct ? formatCurrency(heroProduct.discountPrice || heroProduct.price || 0) : "";
    const heroOriginalPrice = heroProduct?.discountPrice ? formatCurrency(heroProduct.price || 0) : "";

    function openHeroProduct() {
      if (!heroProduct?._id) return;
      trackClick(heroProduct);
      navigate(`/product/${heroProduct._id}`);
    }

    return (
      <section className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_35px_120px_-55px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72 sm:p-6 lg:p-8">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">Product discovery</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white lg:text-3xl">{title}</h2>
          {subtitle ? <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">{subtitle}</p> : null}
        </div>
        {heroProduct ? (
          <button
            type="button"
            onClick={openHeroProduct}
            className="mt-6 grid w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-800 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
          >
            <div className="relative aspect-[16/7] min-h-64 overflow-hidden bg-slate-200 lg:aspect-auto">
              {heroImageUrl ? (
                <img src={heroImageUrl} alt={heroProduct.name} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-sm font-semibold text-slate-500">
                  Image coming soon
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/25 via-transparent to-slate-950/70 lg:bg-gradient-to-r" />
            </div>
            <div className="flex min-h-64 flex-col justify-center p-6 text-white sm:p-8">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">{heroProduct.category || "Featured product"}</div>
              <h3 className="mt-3 line-clamp-3 text-2xl font-semibold tracking-tight lg:text-4xl">{heroProduct.name}</h3>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <span className="text-2xl font-black">{heroPrice}</span>
                {heroOriginalPrice ? <span className="pb-1 text-sm text-slate-300 line-through">{heroOriginalPrice}</span> : null}
              </div>
              <span className="mt-6 inline-flex w-fit rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                View product
              </span>
            </div>
          </button>
        ) : null}
        <div className="mt-4 flex items-center justify-center gap-2">
          {visibleItems.map((item, index) => (
            <button
              key={item._id}
              type="button"
              onClick={() => setFeaturedHeroIndex(index)}
              className={`h-2 rounded-full transition-all ${index === featuredHeroIndex % visibleItems.length ? "w-8 bg-indigo-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
              aria-label={`Show featured product ${index + 1}`}
            />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
          {visibleItems.map((item) => (
            <ProductCard key={item._id} product={item} cardStyle="MINIMAL" imageAspectClass="aspect-[1/1]" onProductClick={trackClick} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <ProductCarousel
      title={title}
      subtitle={subtitle}
      items={visibleItems}
      desktopItemsPerView={8}
      tabletItemsPerView={4}
      mobileItemsPerView={2}
      getProductCardProps={() => ({
        onProductClick: trackClick,
        cardStyle: "MINIMAL",
        imageAspectClass: "aspect-[1/1]",
      })}
    />
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import { ProductImageGallery } from "../components/ProductImageGallery";
import { ProductReviewsSection } from "../components/ProductReviewsSection";
import { RecommendationSection } from "../components/RecommendationSection";
import * as productService from "../services/productService";
import { getAttributes } from "../services/attributeService";
import { getProductModules } from "../services/productModuleService";
import {
  getFeaturedRecommendations,
  getFrequentlyBoughtRecommendations,
  getRelatedRecommendations,
  getTrendingRecommendations,
  trackGuestRecentlyViewed,
  trackRecentlyViewed,
} from "../services/recommendationService";
import { useAuthStore } from "../context/authStore";
import { formatCurrency } from "../utils/formatCurrency";
import { getDefaultVariant, getVariantGroups } from "../utils/productVariants";
import { saveRedirectAfterLogin } from "../utils/loginRedirect";
import { getFormattedWeight } from "../utils/weight";
import { loadTrackingContext, saveTrackingContext } from "../utils/influencerTracking";
import { useCart } from "../hooks/useCart";
import { useCartDrawer } from "../hooks/useCartDrawer";
import { useWishlist } from "../hooks/useWishlist";
import pendingActionManager from "../utils/pendingActionManager";
import { getCartErrorMessage } from "../utils/cartErrors";
import { SellerCard, SellerNameLink, StoreRatingDisplay } from "../components/seller/SellerNavigation";
import { trackAffiliateEvent } from "../services/influencerCommerceService";

const RECOMMENDATION_CONTAINER_LIMIT = 20;

function unwrapRecommendationItems(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.data?.products)) return response.data.data.products;
  if (Array.isArray(response?.data?.products)) return response.data.products;
  if (Array.isArray(response?.products)) return response.products;
  return [];
}

function withRecommendationTimeout(promise, fallback, ms = 6000) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise((resolve) => window.setTimeout(() => resolve(fallback), ms)),
  ]);
}

function buildVariantMatch(variants = [], selectedAttributes = {}) {
  return (
    variants.find((variant) =>
      Object.entries(selectedAttributes).every(([key, value]) => variant?.attributes?.[key] === value)
    ) || null
  );
}

function formatFieldValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "");
}

function flattenAttributeGroups(groups = {}) {
  return Object.values(groups).flatMap((fields) => (Array.isArray(fields) ? fields : []));
}

function sortDefinitions(defs = []) {
  return [...defs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

function buildModuleSections(groups = {}, modules = []) {
  const moduleByKey = new Map((modules || []).map((moduleDef) => [moduleDef.key, moduleDef]));
  return Object.entries(groups)
    .map(([moduleKey, fields]) => ({
      key: moduleKey,
      name: moduleByKey.get(moduleKey)?.name || fields?.[0]?.group || moduleKey,
      order: moduleByKey.get(moduleKey)?.order ?? 999,
      fields: sortDefinitions(fields || []),
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

function buildModulesData(product, moduleSections = []) {
  const explicitModulesData = product?.modulesData || product?.extraDetails;
  if (explicitModulesData && Object.keys(explicitModulesData).length) return explicitModulesData;

  const next = {};
  for (const section of moduleSections) {
    for (const field of section.fields.filter((item) => !item.isVariant)) {
      const value = product?.attributes?.[field.key];
      if (value === undefined || value === null || value === "") continue;
      next[section.key] = {
        ...(next[section.key] || {}),
        [field.key]: value,
      };
    }
  }
  return next;
}

function resolveSwatchColor(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("#")) return normalized;

  const swatchMap = {
    black: "#111827",
    white: "#f8fafc",
    red: "#dc2626",
    blue: "#2563eb",
    green: "#16a34a",
    yellow: "#facc15",
    orange: "#f97316",
    purple: "#7c3aed",
    violet: "#8b5cf6",
    pink: "#ec4899",
    gray: "#6b7280",
    grey: "#6b7280",
    silver: "#cbd5e1",
    gold: "#d4af37",
    navy: "#1e3a8a",
    brown: "#92400e",
    beige: "#d6d3d1",
    cream: "#f5f5dc",
    maroon: "#7f1d1d",
    teal: "#0f766e",
  };

  return swatchMap[normalized] || null;
}

function isVisualSwatchGroup(group, displayType) {
  const key = String(group?.key || "").toLowerCase();
  const name = String(group?.name || "").toLowerCase();
  return displayType === "swatch" || displayType === "image-swatch" || key.includes("color") || name.includes("color");
}

export function ProductDetailsPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { addItem: addCartItem } = useCart();
  const { openDrawer } = useCartDrawer();
  const {
    addItem: addWishlistItem,
    removeItem: removeWishlistItem,
    isInWishlist,
  } = useWishlist();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);
  const [adding, setAdding] = useState(false);
  const [wishlistSaved, setWishlistSaved] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [attributeDefs, setAttributeDefs] = useState([]);
  const [attributeGroups, setAttributeGroups] = useState({});
  const [productModules, setProductModules] = useState([]);
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [recommendations, setRecommendations] = useState(null);
  const [fbtBundle, setFbtBundle] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const trackedProductViewRef = useRef("");

  function trackCurrentAffiliateEvent(eventType, metadata = {}) {
    const trackingContext = loadTrackingContext();
    if (!trackingContext?.trackingToken || String(trackingContext.productId || "") !== String(productId || "")) return Promise.resolve(null);
    return trackAffiliateEvent({
      trackingToken: trackingContext.trackingToken,
      anonymousId: trackingContext.anonymousId || "",
      eventType,
      metadata: { productId, ...metadata },
    }).catch(() => null);
  }

  useEffect(() => {
    const trackingContext = loadTrackingContext();
    const reelId = searchParams.get("reel");
    const trackingToken = searchParams.get("trackingToken");
    const anonymousId = searchParams.get("anonymousId");
    if (trackingToken || trackingContext?.productId === productId || reelId) {
      saveTrackingContext({
        ...trackingContext,
        trackingToken: trackingToken || trackingContext?.trackingToken,
        anonymousId: anonymousId || trackingContext?.anonymousId,
        productId,
        reelId: reelId || trackingContext?.reelId,
      });
    }
  }, [productId, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError("");
      try {
        const response = await productService.getProductById(productId);
        const nextProduct = response?.data;

        if (!nextProduct || nextProduct.status !== "APPROVED" || nextProduct.isActive !== true) {
          throw new Error("NOT_PUBLIC");
        }

        if (!cancelled) {
          setProduct(nextProduct);
          const defaultVariant = getDefaultVariant(nextProduct);
          setSelectedAttributes(defaultVariant?.attributes || {});
          const trackingContext = loadTrackingContext();
          if (trackingContext?.trackingToken && String(trackingContext.productId || "") === String(productId) && trackedProductViewRef.current !== `${productId}:${trackingContext.trackingToken}`) {
            trackedProductViewRef.current = `${productId}:${trackingContext.trackingToken}`;
            trackAffiliateEvent({
              trackingToken: trackingContext.trackingToken,
              anonymousId: trackingContext.anonymousId || "",
              eventType: "product_view",
              metadata: { productId },
            }).catch(() => null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setProduct(null);
          setError(err?.message === "NOT_PUBLIC" ? "Product not available" : "Failed to load product");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (productId) loadProduct();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    async function loadWishlistStatus() {
      if (!productId) {
        setWishlistSaved(false);
        return;
      }
      try {
        const saved = await isInWishlist(productId);
        if (!cancelled) setWishlistSaved(Boolean(saved));
      } catch {
        if (!cancelled) setWishlistSaved(false);
      }
    }
    loadWishlistStatus();
    return () => {
      cancelled = true;
    };
  }, [productId, isInWishlist]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalogMeta() {
      if (!product?.categoryId || !product?.subCategoryId) {
        setAttributeDefs([]);
        return;
      }
      try {
        const [attributeRes, moduleRes] = await Promise.all([
          getAttributes({
            categoryId: product.categoryId?._id || product.categoryId,
            subCategoryId: product.subCategoryId?._id || product.subCategoryId,
          }),
          getProductModules(),
        ]);
        if (!cancelled) {
          const groupedDefs = attributeRes?.data && typeof attributeRes.data === "object" ? attributeRes.data : {};
          setAttributeGroups(groupedDefs);
          setAttributeDefs(flattenAttributeGroups(groupedDefs));
          setProductModules(Array.isArray(moduleRes?.data) ? moduleRes.data : []);
        }
      } catch {
        if (!cancelled) {
          setAttributeGroups({});
          setAttributeDefs([]);
          setProductModules([]);
        }
      }
    }
    loadCatalogMeta();
    return () => {
      cancelled = true;
    };
  }, [product?.categoryId, product?.subCategoryId]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecommendations() {
      if (!productId) {
        setRecommendations(null);
        setFbtBundle(null);
        setRecommendationsLoading(false);
        return;
      }
      setRecommendationsLoading(true);
      try {
        const publicFallback = productService.getPublicProducts({
          page: 1,
          limit: RECOMMENDATION_CONTAINER_LIMIT + 1,
          ...(product?.categoryId ? { categoryId: product.categoryId?._id || product.categoryId } : {}),
        });
        const [fbtResponse, featuredResponse, trendingResponse, relatedResponse, fallbackResponse] = await Promise.all([
          withRecommendationTimeout(getFrequentlyBoughtRecommendations(productId, { limit: RECOMMENDATION_CONTAINER_LIMIT }), { data: { items: [] } }),
          withRecommendationTimeout(getFeaturedRecommendations({ limit: RECOMMENDATION_CONTAINER_LIMIT }), { data: { items: [] } }),
          withRecommendationTimeout(getTrendingRecommendations({ limit: RECOMMENDATION_CONTAINER_LIMIT }), { data: { items: [] } }),
          withRecommendationTimeout(getRelatedRecommendations(productId, { limit: RECOMMENDATION_CONTAINER_LIMIT }), { data: { items: [] } }),
          withRecommendationTimeout(publicFallback, { data: { products: [] } }),
        ]);
        if (!cancelled) {
          const fallbackItems = unwrapRecommendationItems(fallbackResponse)
            .filter((item) => String(item?._id) !== String(productId))
            .slice(0, RECOMMENDATION_CONTAINER_LIMIT);
          const featured = unwrapRecommendationItems(featuredResponse);
          const trending = unwrapRecommendationItems(trendingResponse);
          const related = unwrapRecommendationItems(relatedResponse);
          const fbtItems = unwrapRecommendationItems(fbtResponse);
          setRecommendations({
            featured: featured.length ? featured : fallbackItems,
            trending: trending.length ? trending : fallbackItems,
            related: related.length ? related : fallbackItems,
          });
          setFbtBundle(fbtItems.length ? fbtItems : fallbackItems);
        }
      } catch {
        if (!cancelled) {
          setRecommendations(null);
          setFbtBundle(null);
        }
      } finally {
        if (!cancelled) setRecommendationsLoading(false);
      }
    }
    loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [product?.categoryId, productId]);

  useEffect(() => {
    if (!product?._id) return;
    if (isAuthenticated) {
      trackRecentlyViewed(product._id).catch(() => {});
      return;
    }
    trackGuestRecentlyViewed(product);
  }, [isAuthenticated, product]);

  const variants = useMemo(
    () => (Array.isArray(product?.variants) ? product.variants.filter((item) => item?.isActive !== false) : []),
    [product]
  );
  const activeVariant = useMemo(() => {
    if (!variants.length) return null;
    return buildVariantMatch(variants, selectedAttributes) || getDefaultVariant(product);
  }, [variants, selectedAttributes, product]);
  const variantGroups = useMemo(() => getVariantGroups(product), [product]);
  const variantDefsByKey = useMemo(
    () => Object.fromEntries(attributeDefs.filter((item) => item.isVariant).map((item) => [item.key, item])),
    [attributeDefs]
  );
  const moduleSections = useMemo(
    () => buildModuleSections(attributeGroups, productModules),
    [attributeGroups, productModules]
  );

  const media = useMemo(() => {
    const variantImages = Array.isArray(activeVariant?.images) ? activeVariant.images : [];
    const productImages = Array.isArray(product?.images) ? product.images : [];

    const mergedImages = [];
    const seenUrls = new Set();

    for (const image of [...variantImages, ...productImages]) {
      const url = String(image?.url || "").trim();
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);
      mergedImages.push(image);
    }

    return mergedImages
      .map((image, index) => ({
        type: "image",
        url: image?.url || "",
        altText: image?.altText || product?.name || "Product image",
        sortOrder: Number.isFinite(Number(image?.sortOrder)) ? Number(image.sortOrder) : index,
      }))
      .filter((image) => image.url);
  }, [activeVariant, product]);

  const galleryKey = useMemo(() => {
    if (activeVariant?.variantId) {
      return `${activeVariant.variantId}:${media.map((item) => item.url).join("|")}`;
    }
    return `generic:${media.map((item) => item.url).join("|")}`;
  }, [activeVariant?.variantId, media]);

  const pricing = useMemo(() => {
    const price = Number(activeVariant?.price ?? product?.price ?? 0);
    const salePrice = Number(activeVariant?.discountPrice ?? product?.discountPrice ?? price);
    const hasDiscount = salePrice > 0 && price > salePrice;
    return {
      price,
      salePrice,
      hasDiscount,
      discountPercent: hasDiscount ? Math.round(((price - salePrice) / price) * 100) : 0,
      amountSaved: hasDiscount ? price - salePrice : 0,
    };
  }, [activeVariant, product]);

  const visibleFbtBundle = useMemo(() => {
    return Array.isArray(fbtBundle) ? fbtBundle : [];
  }, [fbtBundle]);

  const stock = Number(activeVariant?.stock ?? product?.stock ?? 0);
  const productWeightLabel = useMemo(() => getFormattedWeight(product), [product]);
  const moduleTabs = useMemo(() => {
    const details = buildModulesData(product, moduleSections);
    return moduleSections
      .map((section) => ({
        key: section.key,
        label: section.name,
        fields: section.fields.filter((field) => !field.isVariant),
        values: details?.[section.key] || {},
      }))
      .filter((section) =>
        section.fields.some((field) => section.values?.[field.key] !== undefined && section.values?.[field.key] !== "")
      );
  }, [product, moduleSections]);

  const tabs = useMemo(
    () => [
      { key: "description", label: "Description" },
      ...moduleTabs.map((tab) => ({ key: tab.key, label: tab.label })),
    ],
    [moduleTabs]
  );

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("description");
    }
  }, [activeTab, tabs]);

  async function handleAddToCart(redirectTo = null) {
    if (adding) return;
    setAdding(true);
    setError("");
    try {
      const quantity = 1;
      const variantId = activeVariant?.variantId || "";

      if (!isAuthenticated && redirectTo === "/checkout") {
        const added = await addCartItem(product._id, quantity, variantId);
        if (added) {
          await trackCurrentAffiliateEvent("add_to_cart", { variantId, quantity, buyNow: true });
          pendingActionManager.initiateGuestBuyNow(product._id, quantity, variantId);
          saveRedirectAfterLogin(`${window.location.origin}/checkout`);
          navigate("/login", { state: { from: { pathname: "/checkout" } } });
        }
        return;
      }

      const added = await addCartItem(product._id, quantity, variantId);
      if (!added) {
        return;
      }
      await trackCurrentAffiliateEvent("add_to_cart", { variantId, quantity });

      if (!redirectTo) {
        openDrawer(product, activeVariant, quantity);
      } else if (redirectTo === "/checkout") {
        navigate(redirectTo);
      }
    } catch (err) {
      setError(getCartErrorMessage(err, "Failed to add to cart"));
    } finally {
      setAdding(false);
    }
  }

  async function handleWishlistToggle() {
    setWishlistLoading(true);
    setError("");
    try {
      if (wishlistSaved) {
        await removeWishlistItem(product._id);
        setWishlistSaved(false);
      } else {
        await addWishlistItem(
          product._id,
          activeVariant?.variantId || "",
          selectedAttributes
        );
        setWishlistSaved(true);
        await trackCurrentAffiliateEvent("wishlist", { variantId: activeVariant?.variantId || "" });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update wishlist");
    } finally {
      setWishlistLoading(false);
    }
  }

  function selectVariantValue(groupKey, value) {
    const nextSelection = { ...selectedAttributes, [groupKey]: value };
    const exact = buildVariantMatch(variants, nextSelection);
    if (exact) {
      setSelectedAttributes(exact.attributes || {});
      return;
    }

    const fallback = variants.find((variant) =>
      variant?.attributes?.[groupKey] === value &&
      Object.entries(nextSelection).every(([key, currentValue]) =>
        key === groupKey ? true : !currentValue || variant?.attributes?.[key] === currentValue
      )
    );
    if (fallback) {
      setSelectedAttributes(fallback.attributes || {});
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading product...</div>;
  }

  if (error && !product) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Product</h1>
          <BackButton fallbackTo="/shop" />
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        <Link to="/shop" className="inline-flex rounded-lg bg-[color:var(--commerce-accent)] px-4 py-2 text-sm font-semibold text-white">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Home / Shop / <span className="text-slate-700 dark:text-slate-200">{product.category}</span>
          </div>
          <h1 className="mt-2 max-w-4xl text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{product.name}</h1>
          <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 text-sm">
            <SellerNameLink seller={product?.sellerId} />
            <StoreRatingDisplay seller={product?.sellerId} rating={product?.sellerId?.rating || product?.ratings?.averageRating} />
          </div>
        </div>
        <BackButton fallbackTo="/shop" />
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
        <div className="space-y-8">
          <ProductImageGallery media={media} productName={product?.name} galleryKey={galleryKey} />

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {activeTab === "description" ? (
                <div className="space-y-4 text-sm leading-7 text-slate-700 dark:text-slate-200">
                  <p>{product.description}</p>
                  {product.shortDescription ? <p className="text-slate-500 dark:text-slate-400">{product.shortDescription}</p> : null}
                </div>
              ) : null}

              {moduleTabs
                .filter((tab) => tab.key === activeTab)
                .map((tab) => (
                  <div key={tab.key} className="grid gap-3">
                    {(tab.fields || [])
                      .filter((field) => tab.values[field.key] !== undefined && tab.values[field.key] !== "")
                      .map((field) => (
                        <div key={field.key} className="grid gap-1 rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800 sm:grid-cols-[180px_minmax(0,1fr)]">
                          <div className="font-semibold text-slate-950 dark:text-white">{field.name}</div>
                          <div className="text-slate-600 dark:text-slate-300">{formatFieldValue(tab.values[field.key])}</div>
                        </div>
                      ))}
                  </div>
                ))}
            </div>
          </section>

        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_rgba(14,165,233,0.14),_rgba(251,191,36,0.12))] p-6 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{product.category}</span>
                    {stock > 0 ? (
                      <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">In stock</span>
                    ) : (
                      <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">Out of stock</span>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">{formatCurrency(pricing.salePrice)}</div>
                      {pricing.hasDiscount ? <div className="pb-1 text-lg text-slate-500 line-through dark:text-slate-400">{formatCurrency(pricing.price)}</div> : null}
                    </div>
                    {pricing.hasDiscount ? <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">You save {formatCurrency(pricing.amountSaved)}</div> : null}
                  </div>
                </div>

                {pricing.hasDiscount ? (
                  <div className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-center shadow-lg shadow-orange-500/30">
                    <div className="text-lg font-black text-white">{pricing.discountPercent}%</div>
                    <div className="text-xs font-semibold text-white">OFF</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-5 p-6">
              <SellerCard seller={product?.sellerId} compact />

              {variantGroups.length ? (
                <div className="grid gap-4">
                  {variantGroups.map((group) => (
                    <div key={group.key}>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{group.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.values.map((option) => {
                          const isSelected = selectedAttributes?.[group.key] === option.value;
                          const hasMatchingVariant = variants.some((variant) => {
                            if (variant?.attributes?.[group.key] !== option.value) return false;
                            return Object.entries(selectedAttributes || {}).every(([key, value]) =>
                              key === group.key ? true : !value || variant?.attributes?.[key] === value
                            );
                          });
                          const displayType = variantDefsByKey[group.key]?.variantConfig?.displayType || "button";
                          const showSwatch = isVisualSwatchGroup(group, displayType);
                          const swatchColor = resolveSwatchColor(option.value);
                          const disabled = !hasMatchingVariant;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={disabled}
                              onClick={() => selectVariantValue(group.key, option.value)}
                              className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                                isSelected
                                  ? "border-slate-950 bg-slate-950 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                                  : "border-slate-300 text-slate-700 hover:border-slate-950 hover:shadow-sm dark:border-slate-700 dark:text-slate-200"
                              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                              title={option.inStock ? option.value : `${option.value} is out of stock`}
                            >
                              {showSwatch ? (
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`h-4 w-4 rounded-full border ${swatchColor && swatchColor.toLowerCase() === "#f8fafc" ? "border-slate-300" : "border-white/50"}`}
                                    style={{ backgroundColor: swatchColor || "#e2e8f0" }}
                                    aria-hidden="true"
                                  />
                                  {option.value}
                                </span>
                              ) : (
                                option.value
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                <div className="font-semibold text-slate-950 dark:text-white">Current selection</div>
                <div className="mt-2 grid gap-2">
                  {activeVariant?.title ? <div>{activeVariant.title}</div> : <div>Standard product configuration</div>}
                  <div>{stock > 0 ? `${stock} units ready to dispatch.` : "Currently unavailable."}</div>
                  {productWeightLabel ? <div>Weight: {productWeightLabel}</div> : null}
                  <div>SKU: {activeVariant?.sku || product.productNumber || product.SKU}</div>
                </div>
              </div>

              <div className="grid gap-3">
                <button type="button" disabled={stock === 0 || adding} onClick={() => handleAddToCart()} className="rounded-2xl bg-[color:var(--commerce-accent)] px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
                  {adding ? "Adding to cart..." : "Add to Cart"}
                </button>
                <button type="button" disabled={stock === 0 || adding} onClick={() => handleAddToCart("/checkout")} className="rounded-2xl bg-[color:var(--commerce-accent-warm)] px-5 py-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
                  Buy Now
                </button>
                <button type="button" disabled={stock === 0 || wishlistLoading} onClick={handleWishlistToggle} className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                  {stock === 0 ? "Out of Stock" : wishlistLoading ? "Updating..." : wishlistSaved ? "Saved to Wishlist" : "Save to Wishlist"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ProductReviewsSection productId={product._id} product={product} />

      <section className="relative left-1/2 w-screen max-w-none -translate-x-1/2 space-y-6">
        <div className="w-full space-y-6">
        <RecommendationSection
          title="Frequently Bought Together"
          items={visibleFbtBundle || []}
          layout="carousel"
          recommendationType="bundle"
          surface="product_page"
          sourceProductId={product._id}
          loading={recommendationsLoading}
          showEmptyState
          fullWidth
        />
        <RecommendationSection
          title="Featured Products"
          items={recommendations?.featured || recommendations?.upsell || []}
          layout="featured"
          recommendationType="featured"
          surface="product_page"
          sourceProductId={product._id}
          featuredHeroPosition="left"
          loading={recommendationsLoading}
          showEmptyState
          fullWidth
        />
        <RecommendationSection
          title="Featured Products"
          items={recommendations?.featured || recommendations?.personalized || []}
          layout="featured"
          recommendationType="featured"
          surface="product_page"
          sourceProductId={product._id}
          featuredHeroPosition="right"
          loading={recommendationsLoading}
          showEmptyState
          fullWidth
        />
        <RecommendationSection
          title="Trending Products"
          items={recommendations?.trending || []}
          layout="grid"
          recommendationType="trending"
          surface="product_page"
          sourceProductId={product._id}
          loading={recommendationsLoading}
          showEmptyState
          fullWidth
        />
        <RecommendationSection
          title="Related Products"
          items={recommendations?.related || []}
          layout="grid"
          recommendationType="related"
          surface="product_page"
          sourceProductId={product._id}
          loading={recommendationsLoading}
          showEmptyState
          fullWidth
        />
        </div>
      </section>
    </div>
  );
}

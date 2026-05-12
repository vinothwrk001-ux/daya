import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import { ProductImage } from "../components/ProductImage";
import * as cartService from "../services/cartService";
import * as productService from "../services/productService";
import * as wishlistService from "../services/wishlistService";
import { getAttributes } from "../services/attributeService";
import { getProductModules } from "../services/productModuleService";
import { useAuthStore } from "../context/authStore";
import { formatCurrency } from "../utils/formatCurrency";
import { getDefaultVariant, getVariantGroups } from "../utils/productVariants";
import { saveRedirectAfterLogin } from "../utils/loginRedirect";
import { getFormattedWeight } from "../utils/weight";
import { loadTrackingContext, saveTrackingContext } from "../utils/influencerTracking";

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

export function ProductDetailsPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
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

  useEffect(() => {
    const trackingContext = loadTrackingContext();
    const reelId = searchParams.get("reel");
    if (trackingContext?.productId === productId || reelId) {
      saveTrackingContext({
        ...trackingContext,
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
      if (!token || !productId) {
        setWishlistSaved(false);
        return;
      }
      try {
        const response = await wishlistService.getWishlistStatus(productId);
        if (!cancelled) setWishlistSaved(Boolean(response?.data?.saved));
      } catch {
        if (!cancelled) setWishlistSaved(false);
      }
    }
    loadWishlistStatus();
    return () => {
      cancelled = true;
    };
  }, [productId, token]);

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
    const sourceImages = activeVariant?.images?.length ? activeVariant.images : product?.images || [];
    return sourceImages
      .map((image) => ({
        type: "image",
        url: image?.url || "",
        altText: image?.altText || product?.name || "Product image",
      }))
      .filter((image) => image.url);
  }, [activeVariant, product]);

  const pricing = useMemo(() => {
    const price = Number(activeVariant?.price ?? product?.price ?? 0);
    const salePrice = Number(activeVariant?.discountPrice ?? product?.discountPrice ?? price);
    const hasDiscount = salePrice > 0 && price > salePrice;
    return {
      price,
      salePrice,
      hasDiscount,
      amountSaved: hasDiscount ? price - salePrice : 0,
    };
  }, [activeVariant, product]);

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

  async function handleAddToCart(redirectTo = "/cart") {
    if (!token) {
      saveRedirectAfterLogin(window.location.href);
      navigate("/login");
      return;
    }

    setAdding(true);
    setError("");
    try {
      await cartService.addToCart(product._id, 1, activeVariant?.variantId || "");
      navigate(redirectTo);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  }

  async function handleWishlistToggle() {
    if (!token) {
      saveRedirectAfterLogin(window.location.href);
      navigate("/login");
      return;
    }

    setWishlistLoading(true);
    setError("");
    try {
      if (wishlistSaved) {
        await wishlistService.removeFromWishlist(product._id);
        setWishlistSaved(false);
      } else {
        await wishlistService.addToWishlist(
          product._id,
          activeVariant?.variantId || "",
          selectedAttributes
        );
        setWishlistSaved(true);
      }
      // Dispatch event to update wishlist badge in header
      const wishlistData = await wishlistService.getWishlist();
      window.dispatchEvent(new CustomEvent("wishlist:changed", { detail: { items: wishlistData?.data || [] } }));
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
        </div>
        <BackButton fallbackTo="/shop" />
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
        <div className="space-y-8">
          <ProductImage media={media} productName={product?.name} />

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

            <div className="space-y-5 p-6">
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
                          const disabled = !hasMatchingVariant;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={disabled}
                              onClick={() => selectVariantValue(group.key, option.value)}
                              className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                                isSelected
                                  ? "border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                                  : "border-slate-300 text-slate-700 hover:border-slate-950 dark:border-slate-700 dark:text-slate-200"
                              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                              title={option.inStock ? option.value : `${option.value} is out of stock`}
                            >
                              {displayType !== "button" ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: option.value.startsWith("#") ? option.value : undefined }} />
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
                <button type="button" disabled={stock === 0 || adding} onClick={() => handleAddToCart("/cart")} className="rounded-2xl bg-[color:var(--commerce-accent)] px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
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
    </div>
  );
}

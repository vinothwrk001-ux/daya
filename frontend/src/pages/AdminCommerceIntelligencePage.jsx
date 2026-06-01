import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, BarChart3, CheckCircle2, Eye, Loader2, RefreshCw, Save, SlidersHorizontal, Trash2, ToggleLeft } from "lucide-react";
import { listProducts } from "../services/adminApi";
import { getAdminCategories } from "../services/categoryService";
import {
  clearRecommendationCache,
  clearFbtCache,
  getFbtAnalytics,
  getFbtManualRules,
  getFbtSettings,
  getRecommendationAnalytics,
  getRecommendationJob,
  getRecommendationSettings,
  previewRecommendations,
  rebuildRecommendations,
  runFbtFullRebuild,
  runFbtIncrementalRebuild,
  saveFbtManualRule,
  updateRecommendationSettings,
  updateFbtSettings,
  warmFbtCache,
} from "../services/recommendationService";
import { listAdminSubcategories } from "../services/subcategoryService";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed.";
}

function unwrapList(response, keys = []) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  for (const key of keys) {
    if (Array.isArray(response?.data?.[key])) return response.data[key];
    if (Array.isArray(response?.[key])) return response[key];
  }
  return [];
}

const TAB_META = {
  "/admin/commerce-intelligence/settings": { key: "settings", title: "Recommendation Settings" },
  "/admin/commerce-intelligence/related-products": { key: "related", title: "Related Products Engine" },
  "/admin/commerce-intelligence/frequently-bought-together": { key: "bundles", title: "Frequently Bought Together" },
  "/admin/commerce-intelligence/cross-sell": { key: "crosssell", title: "Cross Sell Rules" },
  "/admin/commerce-intelligence/upsell": { key: "upsell", title: "Upsell Rules" },
  "/admin/commerce-intelligence/analytics": { key: "analytics", title: "Recommendation Analytics" },
  "/admin/commerce-intelligence/ai-scoring": { key: "ai", title: "AI Scoring Rules" },
  "/admin/commerce-intelligence/preview": { key: "preview", title: "Recommendation Preview" },
  "/admin/commerce-intelligence/cache": { key: "cache", title: "Cache Management" },
};

const WEIGHT_FIELDS = [
  { key: "category", label: "Category match", description: "Prioritize products from the same category.", example: "Related products" },
  { key: "brand", label: "Brand match", description: "Boost items from the same brand or seller.", example: "Similar products" },
  { key: "attribute", label: "Attribute match", description: "Use shared attributes such as color, material, size, or model.", example: "Similar products" },
  { key: "price", label: "Price similarity", description: "Keep suggestions in a familiar price range.", example: "Upsell control" },
  { key: "sales", label: "Sales performance", description: "Give proven, high-selling products more visibility.", example: "Conversion" },
  { key: "rating", label: "Customer rating", description: "Prefer products with stronger review scores.", example: "Trust" },
];

const PRESETS = [
  { key: "balanced", label: "Balanced", description: "Good default for most stores.", weights: { category: 35, brand: 20, attribute: 15, price: 15, sales: 10, rating: 5 } },
  { key: "similar", label: "More Similar", description: "Focus on product fit, brand, and attributes.", weights: { category: 35, brand: 25, attribute: 25, price: 10, sales: 3, rating: 2 } },
  { key: "sales", label: "Best Sellers", description: "Push products that already sell well.", weights: { category: 25, brand: 15, attribute: 10, price: 10, sales: 30, rating: 10 } },
  { key: "quality", label: "Quality First", description: "Favor rating and product fit over sales volume.", weights: { category: 30, brand: 20, attribute: 20, price: 10, sales: 5, rating: 15 } },
];

const ENGINE_META = {
  related: { label: "Related products", description: "Shows alternatives and related items on product pages.", surface: "Product page" },
  similar: { label: "Similar products", description: "Finds products that look close to the current product.", surface: "Product page" },
  frequentlyBoughtTogether: { label: "Frequently bought together", description: "Builds bundle suggestions from paid order history.", surface: "Product page" },
  crossSell: { label: "Cross-sell", description: "Suggests add-ons based on cart contents.", surface: "Cart and checkout" },
  upsell: { label: "Upsell", description: "Suggests higher-value alternatives in a controlled price range.", surface: "Product page" },
  trending: { label: "Trending products", description: "Ranks popular products for discovery sections.", surface: "Homepage" },
  personalized: { label: "Personalized picks", description: "Uses customer views, wishlist, cart, and orders.", surface: "Homepage and cart" },
  recentlyViewed: { label: "Recently viewed", description: "Lets signed-in customers return to products they viewed.", surface: "Homepage and product page" },
};

function clampWeight(value) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  return Math.min(100, Math.max(0, next));
}

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        {createElement(Icon, { className: "h-5 w-5" })}
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </div>
  );
}

function WeightControl({ field, value, onChange }) {
  return (
    <label className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{field.label}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{field.description}</span>
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
          {value}%
        </span>
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(event) => onChange(clampWeight(event.target.value))} className="h-2 w-full accent-blue-600" />
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">Best for: {field.example}</span>
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(clampWeight(event.target.value))}
          className="h-9 w-20 rounded-xl border border-slate-300 bg-white px-2 text-right text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
        />
      </span>
    </label>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm dark:border-slate-700 dark:bg-slate-950/40">
      <div className="font-semibold text-slate-800 dark:text-slate-100">{title}</div>
      <div className="mt-1 text-slate-500 dark:text-slate-400">{description}</div>
    </div>
  );
}

function FbtAdminPanel({ categories, subcategories, setMessage, setError }) {
  const [settings, setSettings] = useState(null);
  const [manualRules, setManualRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionRunning, setActionRunning] = useState("");
  const [form, setForm] = useState({
    categoryId: "",
    subCategoryId: "",
    productId: "",
    bundleProductId: "",
    priority: "HIGH",
    overrideAutoRecommendations: false,
  });

  useEffect(() => {
    let active = true;
    async function loadFbt() {
      setLoading(true);
      try {
        const [settingsResponse, rulesResponse, analyticsResponse, productResponse] = await Promise.all([
          getFbtSettings(),
          getFbtManualRules(),
          getFbtAnalytics({ days: 30 }),
          listProducts({ page: 1, limit: 200, status: "APPROVED", sortBy: "name", sortOrder: "asc" }),
        ]);
        if (!active) return;
        setSettings(settingsResponse?.data || null);
        setManualRules(rulesResponse?.data || []);
        setAnalytics(analyticsResponse?.data || null);
        setProducts(unwrapList(productResponse, ["products"]).filter((product) => product?.isActive !== false));
      } catch (loadError) {
        if (active) setError(normalizeError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadFbt();
    return () => {
      active = false;
    };
  }, [setError]);

  const filteredSubcategories = useMemo(
    () =>
      subcategories.filter((subcategory) => {
        const categoryId = subcategory?.categoryId?._id || subcategory?.categoryId;
        return !form.categoryId || String(categoryId) === String(form.categoryId);
      }),
    [form.categoryId, subcategories]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const categoryOk = !form.categoryId || String(product.categoryId?._id || product.categoryId) === String(form.categoryId);
        const subcategoryOk = !form.subCategoryId || String(product.subCategoryId?._id || product.subCategoryId) === String(form.subCategoryId);
        return categoryOk && subcategoryOk;
      }),
    [form.categoryId, form.subCategoryId, products]
  );

  function patchSettings(patch) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function patchRule(key, value) {
    setSettings((current) => ({ ...current, rules: { ...current.rules, [key]: value } }));
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await updateFbtSettings(settings);
      setSettings(response?.data || settings);
      setMessage("Frequently Bought Together settings saved.");
    } catch (error) {
      setError(normalizeError(error));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action) {
    setActionRunning(action);
    setError("");
    setMessage("");
    try {
      if (action === "full") await runFbtFullRebuild();
      if (action === "incremental") await runFbtIncrementalRebuild();
      if (action === "clear") await clearFbtCache();
      if (action === "warm") await warmFbtCache(100);
      setMessage("FBT action queued. You can keep working while it runs.");
    } catch (error) {
      setError(normalizeError(error));
    } finally {
      setActionRunning("");
    }
  }

  async function addManualRule() {
    if (!form.productId || !form.bundleProductId || form.productId === form.bundleProductId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveFbtManualRule(form);
      const response = await getFbtManualRules();
      setManualRules(response?.data || []);
      setMessage("Manual bundle rule saved.");
    } catch (error) {
      setError(normalizeError(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading frequently bought together engine...
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Frequently Bought Together Engine</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Build Amazon-style bundles from completed order history, manual merchandising rules, and cache-backed storefront APIs.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className={`rounded-full px-3 py-1 ${settings?.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{settings?.enabled ? "Engine enabled" : "Engine disabled"}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Min frequency: {settings?.minimumOrderFrequency}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Confidence: {settings?.minimumConfidenceScore}%+</span>
              {settings?.lastFullRebuiltAt ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Last rebuild: {new Date(settings.lastFullRebuiltAt).toLocaleString()}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              ["full", "Run Full Rebuild"],
              ["incremental", "Run Incremental Rebuild"],
              ["clear", "Clear Cache"],
              ["warm", "Warm Cache"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={Boolean(actionRunning)}
                onClick={() => runAction(key)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 first:border-slate-950 first:bg-slate-950 first:text-white"
              >
                {actionRunning === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeading icon={SlidersHorizontal} title="Global Settings" description="Control eligibility, bundle size, confidence threshold, strategy, and runtime safeguards." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm">
              <span className="font-semibold">Enable engine</span>
              <input type="checkbox" checked={Boolean(settings?.enabled)} onChange={(event) => patchSettings({ enabled: event.target.checked })} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Minimum order frequency
              <input type="number" min="1" value={settings?.minimumOrderFrequency || 5} onChange={(event) => patchSettings({ minimumOrderFrequency: Number(event.target.value) })} className="rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Maximum bundle size
              <select value={settings?.maximumBundleSize || 3} onChange={(event) => patchSettings({ maximumBundleSize: Number(event.target.value) })} className="rounded-xl border border-slate-300 px-3 py-2">
                {[2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Maximum recommendations
              <input type="number" min="1" max="24" value={settings?.maximumRecommendations || 6} onChange={(event) => patchSettings({ maximumRecommendations: Number(event.target.value) })} className="rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Minimum confidence score
              <input type="number" min="0" max="100" value={settings?.minimumConfidenceScore || 60} onChange={(event) => patchSettings({ minimumConfidenceScore: Number(event.target.value) })} className="rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Bundle generation strategy
              <select value={settings?.strategy || "HYBRID_AI_MODE"} onChange={(event) => patchSettings({ strategy: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2">
                <option value="ORDER_FREQUENCY">Order Frequency</option>
                <option value="CONFIDENCE_SCORE">Confidence Score</option>
                <option value="ASSOCIATION_RULES">Association Rules</option>
                <option value="HYBRID_AI_MODE">Hybrid AI Mode</option>
              </select>
            </label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(settings?.rules || {}).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                <input type="checkbox" checked={Boolean(value)} onChange={(event) => patchRule(key, event.target.checked)} />
              </label>
            ))}
          </div>
          <button type="button" disabled={saving} onClick={saveSettings} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save FBT Settings
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeading icon={BarChart3} title="FBT Dashboard" description="Track impressions, clicks, bundle adds, conversion, and generated revenue." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Impressions", analytics?.totals?.impressions || 0],
              ["Clicks", analytics?.totals?.clicks || 0],
              ["Bundle Adds", analytics?.totals?.bundleAdds || 0],
              ["CTR", `${(((analytics?.totals?.ctr || 0) * 100) || 0).toFixed(2)}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 px-4 py-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <SectionHeading icon={Eye} title="Manual Bundle Rules" description="Pin specific product bundles and optionally override automatic recommendations." />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value, subCategoryId: "", productId: "", bundleProductId: "" }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Category</option>
            {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>
          <select value={form.subCategoryId} onChange={(event) => setForm((current) => ({ ...current, subCategoryId: event.target.value, productId: "", bundleProductId: "" }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Subcategory</option>
            {filteredSubcategories.map((subcategory) => <option key={subcategory._id} value={subcategory._id}>{subcategory.name}</option>)}
          </select>
          <select value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Product</option>
            {filteredProducts.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
          </select>
          <select value={form.bundleProductId} onChange={(event) => setForm((current) => ({ ...current, bundleProductId: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Bundle product</option>
            {filteredProducts.filter((product) => product._id !== form.productId).map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
          </select>
          <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="HIGH">High priority</option>
            <option value="MEDIUM">Medium priority</option>
            <option value="LOW">Low priority</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">
            <input type="checkbox" checked={form.overrideAutoRecommendations} onChange={(event) => setForm((current) => ({ ...current, overrideAutoRecommendations: event.target.checked }))} />
            Override auto recommendations
          </label>
        </div>
        <button type="button" disabled={saving || !form.productId || !form.bundleProductId} onClick={addManualRule} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Add Manual Bundle</button>
        <div className="mt-5 grid gap-3">
          {manualRules.slice(0, 12).map((rule) => (
            <div key={rule._id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <div className="font-semibold text-slate-950">{rule.product_id?.name || "Product"} + {rule.bundle_product_id?.name || "Bundle product"}</div>
              <div className="mt-1 text-slate-500">Priority {rule.priority} / {rule.override_auto_recommendations ? "Overrides auto" : "Blends with auto"}</div>
            </div>
          ))}
          {!manualRules.length ? <EmptyState title="No manual bundles yet" description="Create a rule above to pin bundle products for a specific product." /> : null}
        </div>
      </section>
    </div>
  );
}

export function AdminCommerceIntelligencePage() {
  const location = useLocation();
  const [settings, setSettings] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [previewProducts, setPreviewProducts] = useState([]);
  const [previewSelection, setPreviewSelection] = useState({
    categoryId: "",
    subCategoryId: "",
    productId: "",
  });
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionRunning, setActionRunning] = useState("");
  const [rebuildJob, setRebuildJob] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pollTimerRef = useRef(null);

  useEffect(() => () => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [settingsResponse, analyticsResponse, categoriesResponse, subcategoriesResponse] = await Promise.all([
          getRecommendationSettings(),
          getRecommendationAnalytics({ days: 30 }),
          getAdminCategories(),
          listAdminSubcategories(),
        ]);
        if (!active) return;
        setSettings(settingsResponse?.data || null);
        setAnalytics(analyticsResponse?.data || null);
        setCategories(unwrapList(categoriesResponse, ["categories"]).filter((item) => item?.isActive !== false));
        setSubcategories(unwrapList(subcategoriesResponse, ["subcategories"]));
      } catch (loadError) {
        if (active) setError(normalizeError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadProductsForPreview() {
      if (!previewSelection.categoryId || !previewSelection.subCategoryId) {
        setPreviewProducts([]);
        setPreviewSelection((current) => ({ ...current, productId: "" }));
        return;
      }

      setProductLoading(true);
      try {
        const response = await listProducts({
          page: 1,
          limit: 100,
          status: "APPROVED",
          categoryId: previewSelection.categoryId,
          subCategoryId: previewSelection.subCategoryId,
          sortBy: "name",
          sortOrder: "asc",
        });
        if (!active) return;
        const products = unwrapList(response, ["products"]).filter((product) => product?.isActive !== false);
        setPreviewProducts(products);
        setPreviewSelection((current) => ({
          ...current,
          productId: products.some((product) => String(product._id) === String(current.productId)) ? current.productId : "",
        }));
      } catch (loadError) {
        if (active) {
          setPreviewProducts([]);
          setError(normalizeError(loadError));
        }
      } finally {
        if (active) setProductLoading(false);
      }
    }

    loadProductsForPreview();
    return () => {
      active = false;
    };
  }, [previewSelection.categoryId, previewSelection.subCategoryId]);

  const weightTotal = useMemo(() => {
    if (!settings?.weights) return 0;
    return WEIGHT_FIELDS.reduce((sum, field) => sum + Number(settings.weights[field.key] || 0), 0);
  }, [settings]);

  const enabledCount = useMemo(() => Object.values(settings?.enabled || {}).filter(Boolean).length, [settings]);
  const filteredSubcategories = useMemo(
    () =>
      subcategories.filter((subcategory) => {
        const categoryId = subcategory?.categoryId?._id || subcategory?.categoryId;
        return !previewSelection.categoryId || String(categoryId) === String(previewSelection.categoryId);
      }),
    [previewSelection.categoryId, subcategories]
  );
  const selectedPreviewProduct = useMemo(
    () => previewProducts.find((product) => String(product._id) === String(previewSelection.productId)) || null,
    [previewProducts, previewSelection.productId]
  );
  const previewSummary = useMemo(() => {
    if (!previewData) return [];
    return [
      { label: "Related", value: previewData.related?.length || 0 },
      { label: "Bought together", value: previewData.frequentlyBoughtTogether?.length || 0 },
      { label: "Upsell", value: previewData.upsell?.length || 0 },
      { label: "Similar", value: previewData.similar?.length || 0 },
      { label: "Personalized", value: previewData.personalized?.length || 0 },
      { label: "Recently viewed", value: previewData.recentlyViewed?.length || 0 },
    ];
  }, [previewData]);

  function updateWeight(key, value) {
    setSettings((current) => ({ ...current, weights: { ...current.weights, [key]: value } }));
  }

  function applyPreset(preset) {
    setSettings((current) => ({ ...current, weights: { ...current.weights, ...preset.weights } }));
    setMessage(`${preset.label} preset applied. Click Save Settings to publish it.`);
    setError("");
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await updateRecommendationSettings(settings);
      setSettings(response?.data || settings);
      setMessage("Recommendation settings saved.");
    } catch (saveError) {
      setError(normalizeError(saveError));
    } finally {
      setSaving(false);
    }
  }

  function updatePreviewSelection(patch) {
    setPreviewData(null);
    setPreviewSelection((current) => ({ ...current, ...patch }));
  }

  async function runPreview() {
    if (!previewSelection.productId) return;
    setPreviewLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await previewRecommendations(previewSelection.productId);
      setPreviewData(response?.data || null);
      setMessage("Preview generated.");
    } catch (previewError) {
      setError(normalizeError(previewError));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runAction(action) {
    setError("");
    setMessage("");
    setActionRunning(action);
    try {
      if (action === "rebuild") {
        const response = await rebuildRecommendations();
        const job = response?.data || null;
        setRebuildJob(job);
        setMessage("Recommendation Rebuild Started");
        if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
        if (job?._id) {
          pollTimerRef.current = window.setInterval(async () => {
            try {
              const jobResponse = await getRecommendationJob(job._id);
              const nextJob = jobResponse?.data || null;
              setRebuildJob(nextJob);
              if (["completed", "failed"].includes(nextJob?.status)) {
                window.clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
                setMessage(nextJob.status === "completed" ? "Completed Successfully" : "Rebuild Failed");
                if (nextJob.status === "failed") setError(nextJob.error_message || "Rebuild Failed");
              }
            } catch (pollError) {
              setError(normalizeError(pollError));
            }
          }, 2000);
        }
      } else {
        await clearRecommendationCache();
        setMessage("Cache Cleared Successfully");
      }
    } catch (actionError) {
      setError(normalizeError(actionError));
    } finally {
      setActionRunning("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading commerce intelligence...
      </div>
    );
  }

  if (TAB_META[location.pathname]?.key === "bundles") {
    return (
      <div className="grid gap-6">
        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        {message ? (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}
        <FbtAdminPanel categories={categories} subcategories={subcategories} setMessage={setMessage} setError={setError} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{TAB_META[location.pathname]?.title || "Commerce Intelligence"}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Configure what customers see in related products, bundles, cart add-ons, upsells, and homepage recommendation sections.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{enabledCount} engines enabled</span>
              <span className={`rounded-full px-3 py-1 ${weightTotal === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>Weight total: {weightTotal}%</span>
              {settings?.lastRebuiltAt ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Last rebuild: {new Date(settings.lastRebuiltAt).toLocaleString()}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={Boolean(actionRunning)}
              onClick={() => runAction("rebuild")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950"
            >
              {actionRunning === "rebuild" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {actionRunning === "rebuild" ? "Queueing Rebuild..." : "Run Rebuild"}
            </button>
            <button
              type="button"
              disabled={Boolean(actionRunning)}
              onClick={() => runAction("cache")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
            >
              {actionRunning === "cache" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {actionRunning === "cache" ? "Clearing..." : "Clear Cache"}
            </button>
          </div>
        </div>
        {rebuildJob ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span>{rebuildJob.status === "failed" ? "Rebuild Failed" : rebuildJob.status === "completed" ? "Completed Successfully" : "Progress"}</span>
              <span>{Math.round(Number(rebuildJob.progress || 0))}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${rebuildJob.status === "failed" ? "bg-rose-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, Math.max(0, Number(rebuildJob.progress || 0)))}%` }}
              />
            </div>
            {rebuildJob.error_message ? <div className="mt-2 text-sm text-rose-700">{rebuildJob.error_message}</div> : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <SectionHeading icon={SlidersHorizontal} title="Choose a Recommendation Strategy" description="Start with a preset, then fine-tune the scoring weights. Presets are only published after saving." />
          <button
            type="button"
            disabled={saving || weightTotal !== 100}
            onClick={saveSettings}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
            >
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">{preset.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading icon={BarChart3} title="Scoring Weights" description="These controls decide why products are recommended together. The total must be exactly 100% before saving." />
            <div className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${weightTotal === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {weightTotal === 100 ? "Ready to save" : `${100 - weightTotal}% adjustment needed`}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {WEIGHT_FIELDS.map((field) => (
              <WeightControl key={field.key} field={field} value={Number(settings?.weights?.[field.key] || 0)} onChange={(value) => updateWeight(field.key, value)} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <SectionHeading icon={Eye} title="Preview Before Publishing" description="Choose a category, subcategory, and product to see recommendation output before you publish changes." />
          <button
            type="button"
            disabled={!previewSelection.productId || previewLoading}
            onClick={runPreview}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
          >
            {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {previewLoading ? "Generating..." : "Preview Recommendations"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Category</span>
            <select
              value={previewSelection.categoryId}
              onChange={(event) =>
                updatePreviewSelection({
                  categoryId: event.target.value,
                  subCategoryId: "",
                  productId: "",
                })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Subcategory</span>
            <select
              value={previewSelection.subCategoryId}
              disabled={!previewSelection.categoryId}
              onChange={(event) =>
                updatePreviewSelection({
                  subCategoryId: event.target.value,
                  productId: "",
                })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Select subcategory</option>
              {filteredSubcategories.map((subcategory) => (
                <option key={subcategory._id} value={subcategory._id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Product</span>
            <select
              value={previewSelection.productId}
              disabled={!previewSelection.subCategoryId || productLoading}
              onChange={(event) => updatePreviewSelection({ productId: event.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{productLoading ? "Loading products..." : "Select product"}</option>
              {previewProducts.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {previewSelection.subCategoryId && !productLoading && !previewProducts.length ? (
          <div className="mt-5">
            <EmptyState title="No approved products found" description="Add or approve a product in this category and subcategory to preview recommendations." />
          </div>
        ) : null}

        {selectedPreviewProduct ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="font-semibold text-slate-900 dark:text-white">{selectedPreviewProduct.name}</div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {selectedPreviewProduct.category} / {selectedPreviewProduct.subCategory || "Selected subcategory"}
            </div>
          </div>
        ) : null}

        {previewData ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {previewSummary.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeading icon={ToggleLeft} title="Recommendation Engines" description="Turn each storefront recommendation area on or off without changing the rest of the setup." />
          <div className="mt-4 grid gap-3">
            {Object.entries(settings?.enabled || {}).map(([key, value]) => {
              const meta = ENGINE_META[key] || { label: key.replace(/([A-Z])/g, " $1"), description: "Controls this recommendation engine.", surface: "Storefront" };
              return (
                <label key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <span>
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">{meta.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{meta.description}</span>
                    <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{meta.surface}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`text-xs font-semibold ${value ? "text-emerald-700" : "text-slate-500"}`}>{value ? "On" : "Off"}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => setSettings((current) => ({ ...current, enabled: { ...current.enabled, [key]: event.target.checked } }))}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeading icon={BarChart3} title="Analytics Snapshot" description="A quick read of recent recommendation views, clicks, and click-through rate." />
          <div className="mt-4 grid gap-3">
            {(analytics?.rows || []).slice(0, 8).map((row) => (
              <div key={`${row.dateKey}-${row.recommendationType}-${row.surface}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {row.recommendationType} / {row.surface}
                </div>
                <div className="mt-1 text-slate-600 dark:text-slate-300">
                  Views {row.views || 0} / Clicks {row.clicks || 0} / CTR {(((row.ctr || 0) * 100) || 0).toFixed(2)}%
                </div>
              </div>
            ))}
            {!analytics?.rows?.length ? <EmptyState title="No analytics rows yet" description="Analytics will appear after customers view or click recommendations." /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

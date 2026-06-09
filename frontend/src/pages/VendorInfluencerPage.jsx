import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Crown,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  Gem,
  HelpCircle,
  LineChart,
  Link as LinkIcon,
  Medal,
  Megaphone,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Star,
  Tag,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";
import {
  createVendorInfluencerCampaign,
  cancelVendorInfluencerSubscription,
  confirmVendorInfluencerSubscriptionChange,
  createVendorInfluencerSubscriptionChangeOrder,
  createVendorInfluencerSubscriptionOrder,
  deleteVendorInfluencerCampaign,
  discoverVendorInfluencers,
  getVendorAffiliateProducts,
  getVendorContentApprovals,
  getVendorCreatorLeaderboard,
  getVendorInfluencerAnalytics,
  getVendorInfluencerCampaigns,
  getVendorInfluencerCommerceConfiguration,
  getVendorInfluencerCommerceDashboard,
  getVendorInfluencerPerformance,
  getVendorInfluencerRelationships,
  getVendorInfluencerReports,
  getVendorInfluencerSubscriptionPlans,
  getVendorPromotionProducts,
  previewVendorInfluencerCampaign,
  previewVendorInfluencerSubscriptionChange,
  reviewVendorCampaignApplication,
  reviewVendorInfluencerContent,
  saveVendorInfluencer,
  updateVendorInfluencerCampaignStatus,
  updateVendorInfluencerRelationship,
  visitVendorInfluencer,
  verifyVendorInfluencerSubscriptionPayment,
} from "../services/influencerCommerceService";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

const TABS = [
  ["dashboard", "Dashboard", BarChart3],
  ["discover", "Discover Influencers", Search],
  ["subscription", "Subscription", CreditCard],
  ["relationships", "My Influencers", Users],
  ["campaigns", "Campaign Management", Megaphone],
  ["products", "Product Promotion", Package],
  ["affiliate", "Affiliate Products", LinkIcon],
  ["content", "Content Approvals", FileCheck2],
  ["performance", "Influencer Performance", LineChart],
  ["analytics", "Campaign Analytics", BarChart3],
  ["leaderboard", "Creator Leaderboard", Medal],
  ["reports", "Reports", Download],
];

const TAB_IDS = new Set(TABS.map(([id]) => id));
const TAB_PATHS = {
  dashboard: "/vendor/influencer-commerce",
  discover: "/vendor/influencer-commerce/discover",
  subscription: "/vendor/influencer-commerce/subscription",
  relationships: "/vendor/influencer-commerce/relationships",
  campaigns: "/vendor/influencer-commerce/campaigns",
  products: "/vendor/influencer-commerce/products",
  affiliate: "/vendor/influencer-commerce/affiliate",
  content: "/vendor/influencer-commerce/content",
  performance: "/vendor/influencer-commerce/performance",
  analytics: "/vendor/influencer-commerce/analytics",
  leaderboard: "/vendor/influencer-commerce/leaderboard",
  reports: "/vendor/influencer-commerce/reports",
};

const defaultFilters = {
  search: "",
  status: "",
  category: "",
  campaignId: "",
  productId: "",
  influencerId: "",
  startDate: "",
  endDate: "",
  serviceType: "",
  minPrice: "",
  maxPrice: "",
  language: "",
  ratingMin: "",
  scoreMin: "",
  completionMin: "",
  sort: "trending",
  page: 1,
};

function numberValue(value) {
  return Number(value || 0).toLocaleString();
}

function percentValue(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function statusText(value = "") {
  return String(value || "open").replace(/_/g, " ");
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function getId(row) {
  return row?.id || row?._id;
}

function shortText(value = "", limit = 54) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function servicePackages(service = {}) {
  const rows = Array.isArray(service.packages) && service.packages.length
    ? service.packages
    : [{
      packageName: service.serviceName || service.label || "Package",
      quantity: 1,
      price: service.price || 0,
      currency: service.currency || "INR",
      deliveryDays: service.deliveryDays || 0,
      revisionCount: service.revisionCount || 0,
      status: service.status || "active",
    }];
  return rows.filter((pkg) => String(pkg.status || "active") === "active");
}

function packagePrice(pkg = {}, service = {}) {
  return Number(pkg.price ?? service.price ?? 0);
}

function serviceStartingPrice(service = {}) {
  const packages = servicePackages(service);
  if (!packages.length) return Number(service.price || 0);
  return Math.min(...packages.map((pkg) => packagePrice(pkg, service)));
}

function packageKey(service = {}, pkg = {}) {
  const serviceId = String(service._id || service.id || service.serviceId || service.serviceTypeKey || "");
  const pkgId = String(pkg._id || pkg.id || pkg.packageId || pkg.packageName || "");
  return `${serviceId}:${pkgId}`;
}

function configKey(row = {}) {
  if (typeof row === "string") return row.trim().toLowerCase();
  return String(row.key || row.slug || row.fieldName || "").trim().toLowerCase();
}

function configLabel(row = {}) {
  if (typeof row === "string") return row;
  return row.label || row.name || row.field?.label || row.fieldName || row.key || row.slug || "";
}

function normalizePaymentConfig(row = {}) {
  const key = configKey(row);
  return { ...row, key, slug: key, label: configLabel(row), name: configLabel(row), displayOrder: Number(row.displayOrder || 0) };
}

function normalizeCampaignTypeConfig(row = {}, paymentModels = []) {
  const paymentByKey = new Map(paymentModels.map((payment) => [payment.key, payment]));
  const allowedRows = row.allowedPaymentModels || row.paymentModels || [];
  const allowedPaymentModels = allowedRows
    .map((item) => paymentByKey.get(configKey(item)) || normalizePaymentConfig(item))
    .filter((item) => item.key);
  const key = configKey(row);
  return {
    ...row,
    key,
    slug: key,
    label: configLabel(row),
    name: configLabel(row),
    allowedPaymentModels,
    paymentModels: allowedPaymentModels,
    defaultPaymentType: row.defaultPaymentType || allowedPaymentModels[0]?.key || "",
    displayOrder: Number(row.displayOrder || 0),
  };
}

function normalizeDynamicField(field = {}) {
  const configuration = field.configuration || field.field?.configuration || {};
  const fieldName = field.fieldName || field.key || field.field?.key || "";
  return {
    ...field,
    fieldName,
    key: fieldName,
    label: field.label || field.field?.label || fieldName,
    fieldType: field.fieldType || field.type || field.field?.fieldType || "text",
    required: Boolean(field.required ?? field.field?.required),
    configuration,
    options: field.options || configuration.options || field.field?.options || [],
    min: field.min ?? configuration.min ?? field.field?.min,
    max: field.max ?? configuration.max ?? field.field?.max,
    defaultValue: field.defaultValue ?? configuration.defaultValue ?? field.field?.defaultValue ?? "",
    displayOrder: Number(field.displayOrder || field.field?.displayOrder || 0),
  };
}

function campaignRuleConfig(configuration = {}) {
  const engine = configuration.campaignRuleEngine || {};
  const paymentModels = (engine.paymentModels || configuration.paymentModelOptions || configuration.paymentModels || [])
    .map(normalizePaymentConfig)
    .filter((row) => row.key)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
  const campaignTypes = (engine.campaignTypes || configuration.campaignTypes || [])
    .map((row) => normalizeCampaignTypeConfig(row, paymentModels))
    .filter((row) => row.key)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
  const fieldsByCombination = Object.fromEntries(
    Object.entries(engine.fieldsByCombination || {}).map(([key, rows]) => [
      key,
      (rows || []).map(normalizeDynamicField).sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label)),
    ])
  );
  return {
    campaignTypes,
    paymentModels,
    attributionWindows: (engine.attributionWindows || configuration.attributionWindows || []).filter((row) => !row.customAllowed),
    fieldsByCombination,
  };
}

function defaultDynamicValues(fields = []) {
  return fields.reduce((values, field) => {
    const name = field.fieldName || field.key;
    if (!name || values[name] !== undefined) return values;
    if (field.defaultValue !== "" && field.defaultValue !== null && field.defaultValue !== undefined) {
      values[name] = field.defaultValue;
    } else if (field.fieldType === "boolean") {
      values[name] = false;
    }
    return values;
  }, {});
}

function fieldNames(fields = []) {
  return new Set(fields.map((field) => field.fieldName || field.key).filter(Boolean));
}

function splitLines(value = "") {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function planIcon(plan = {}) {
  const key = String(plan.metadata?.iconKey || "").toLowerCase();
  if (key === "crown") return Crown;
  if (key === "gem") return Gem;
  if (key === "star") return Star;
  if (key === "medal") return Medal;
  if (key === "card") return CreditCard;
  const name = String(plan.planName || plan).toLowerCase();
  if (name.includes("platinum")) return Crown;
  if (name.includes("diamond")) return Gem;
  if (name.includes("gold")) return Star;
  if (name.includes("silver")) return Medal;
  return Zap;
}

function planTone(plan = {}) {
  const tones = {
    violet: { ring: "border-violet-200", icon: "bg-violet-100 text-violet-700", button: "bg-violet-600 hover:bg-violet-500 text-white", accent: "text-violet-600" },
    sky: { ring: "border-sky-200", icon: "bg-sky-100 text-sky-700", button: "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50", accent: "text-sky-600" },
    amber: { ring: "border-amber-300 shadow-amber-100", icon: "bg-amber-100 text-amber-700", button: "bg-indigo-600 hover:bg-indigo-500 text-white", accent: "text-amber-600" },
    slate: { ring: "border-slate-200", icon: "bg-slate-100 text-slate-500", button: "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50", accent: "text-slate-500" },
    emerald: { ring: "border-emerald-200", icon: "bg-emerald-100 text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-500 text-white", accent: "text-emerald-600" },
    indigo: { ring: "border-slate-200", icon: "bg-indigo-50 text-indigo-600", button: "bg-slate-100 text-indigo-700", accent: "text-indigo-600" },
  };
  const configured = tones[String(plan.metadata?.theme || "").toLowerCase()];
  if (configured) return configured;
  const name = String(plan.planName || plan).toLowerCase();
  if (name.includes("platinum")) return tones.violet;
  if (name.includes("diamond")) return tones.sky;
  if (name.includes("gold")) return tones.amber;
  if (name.includes("silver")) return tones.slate;
  return { ring: "border-slate-200", icon: "bg-indigo-50 text-indigo-600", button: "bg-slate-100 text-indigo-700", accent: "text-indigo-600" };
}

function planDescription(plan = {}) {
  if (plan.description) return plan.description;
  if (plan.metadata?.cardDescription) return plan.metadata.cardDescription;
  const name = String(plan.planName || "").toLowerCase();
  if (name.includes("platinum")) return "For large brands and agencies needing premium capabilities.";
  if (name.includes("diamond")) return "For established brands running high-volume campaigns.";
  if (name.includes("gold")) return "For scaling businesses looking to maximize influencer reach and performance.";
  if (name.includes("silver")) return "For growing businesses running consistent campaigns.";
  return "For individuals getting started with influencer marketing.";
}

function planBenefits(plan = {}) {
  if (Array.isArray(plan.metadata?.cardBenefits) && plan.metadata.cardBenefits.length) return plan.metadata.cardBenefits.filter(Boolean);
  const benefits = [
    `${plan.campaignLimit < 0 ? "Unlimited" : numberValue(plan.campaignLimit || 0)} Active Campaign${Number(plan.campaignLimit) === 1 ? "" : "s"}`,
    `${plan.influencerVisibilityLimit < 0 ? "Unlimited" : `Discover up to ${numberValue(plan.influencerVisibilityLimit || 0)}`} Influencers`,
    plan.allowAllTiers ? "Access to All Tiers" : `Access to ${plan.planName || "Configured"} Tier`,
    plan.advancedAnalytics ? "Advanced Analytics" : "Basic Analytics",
    plan.prioritySupport ? "Priority Support" : "Email Support",
    plan.featuredCampaigns ? "Featured Campaigns" : "Standard Visibility",
    plan.metadata?.campaignBoost ? "Campaign Boost" : "",
    plan.dedicatedManager ? "Dedicated Account Manager" : "",
    plan.autoRenewAllowed ? "Auto Renew Available" : "",
  ].filter(Boolean);
  return benefits;
}

function ProgressLine({ value, tone = "bg-indigo-500" }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${clampPercent(value)}%` }} />
    </div>
  );
}

function planBillingPrice(plan = {}, billingCycle = "monthly") {
  if (billingCycle === "yearly") return Number(plan.yearlyPrice ?? plan.monthlyPrice ?? 0);
  if (billingCycle === "quarterly") return Number(plan.quarterlyPrice ?? Number(plan.monthlyPrice || 0) * 3);
  if (billingCycle === "half_yearly") return Number(plan.halfYearlyPrice ?? Number(plan.monthlyPrice || 0) * 6);
  if (billingCycle === "custom") return Number(plan.metadata?.customPrice ?? plan.monthlyPrice ?? 0);
  return Number(plan.monthlyPrice || 0);
}

function billingCycleLabel(cycle = "monthly") {
  return { monthly: "month", quarterly: "quarter", half_yearly: "half year", yearly: "year", custom: "term" }[cycle] || "month";
}

function Section({ title, icon: Icon, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {createElement(Icon, { className: "h-4 w-4 text-indigo-500", "aria-hidden": "true" })}
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ value }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {statusText(value)}
    </span>
  );
}

function FieldLabel({ children }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </span>
  );
}

function Filters({ filters, setFilters, campaigns = [], products = [], configuration = {}, tab = "", includeSearch = true }) {
  const updateFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }, [setFilters]);
  const serviceTypes = configuration.serviceTypes || [];
  const languages = configuration.languageOptions || [];
  const categories = useMemo(() => {
    const values = new Set();
    (configuration.categoryOptions || []).forEach((category) => {
      if (category.label) values.add(category.label);
      if (category.key) values.add(category.key);
    });
    campaigns.forEach((campaign) => {
      if (campaign.category) values.add(campaign.category);
    });
    products.forEach((row) => {
      const product = row.product || row;
      if (product.category) values.add(product.category);
    });
    return [...values].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
  }, [campaigns, configuration.categoryOptions, products]);
  const discoverFilters = tab === "discover";

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2 xl:grid-cols-6">
      {includeSearch ? (
        <label className="block space-y-1.5 md:col-span-2">
          <FieldLabel>Search</FieldLabel>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search creators, campaigns, products"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              aria-label="Search influencer commerce"
            />
          </span>
        </label>
      ) : null}
      <label className="block space-y-1.5">
        <FieldLabel>Status</FieldLabel>
        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="approved">Approved</option>
          <option value="pending_review">Pending review</option>
          <option value="uploaded">Uploaded</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="paused">Paused</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Campaign</FieldLabel>
        <select value={filters.campaignId} onChange={(event) => updateFilter("campaignId", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Campaign filter">
          <option value="">All campaigns</option>
          {campaigns.map((campaign) => <option key={getId(campaign)} value={getId(campaign)}>{campaign.title || "Campaign"}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Product</FieldLabel>
        <select value={filters.productId} onChange={(event) => updateFilter("productId", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Product filter">
          <option value="">All products</option>
          {products.map((row) => {
            const product = row.product || row;
            return <option key={getId(product)} value={getId(product)}>{shortText(product.name, 72)}</option>;
          })}
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Category</FieldLabel>
        <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Category filter">
          <option value="">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      {discoverFilters ? (
        <>
          <label className="block space-y-1.5">
            <FieldLabel>Service</FieldLabel>
            <select value={filters.serviceType || ""} onChange={(event) => updateFilter("serviceType", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Service type filter">
              <option value="">All services</option>
              {serviceTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <FieldLabel>Min Price</FieldLabel>
            <input type="number" min="0" value={filters.minPrice || ""} onChange={(event) => updateFilter("minPrice", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Minimum package price" />
          </label>
          <label className="block space-y-1.5">
            <FieldLabel>Max Price</FieldLabel>
            <input type="number" min="0" value={filters.maxPrice || ""} onChange={(event) => updateFilter("maxPrice", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Maximum package price" />
          </label>
          <label className="block space-y-1.5">
            <FieldLabel>Language</FieldLabel>
            <select value={filters.language || ""} onChange={(event) => updateFilter("language", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Language filter">
              <option value="">Any language</option>
              {languages.map((language) => <option key={language.key || language.label} value={language.key || language.label}>{language.label || language.key}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <FieldLabel>Min Rating</FieldLabel>
            <input type="number" min="0" max="5" value={filters.ratingMin || ""} onChange={(event) => updateFilter("ratingMin", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Minimum rating" />
          </label>
          <label className="block space-y-1.5">
            <FieldLabel>Min Score</FieldLabel>
            <input type="number" min="0" max="100" value={filters.scoreMin || ""} onChange={(event) => updateFilter("scoreMin", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Minimum score" />
          </label>
          <label className="block space-y-1.5">
            <FieldLabel>Completion</FieldLabel>
            <input type="number" min="0" max="100" value={filters.completionMin || ""} onChange={(event) => updateFilter("completionMin", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Minimum completion rate" />
          </label>
        </>
      ) : null}
      <label className="block space-y-1.5">
        <FieldLabel>Start Date</FieldLabel>
        <input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Start date" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>End Date</FieldLabel>
        <input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="End date" />
      </label>
    </div>
  );
}

function SimpleBars({ rows = [], valueKey = "revenue", labelKey = "date" }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
  return (
    <div className="flex h-52 items-end gap-2 overflow-x-auto rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      {rows.map((row) => (
        <div key={row[labelKey]} className="flex min-w-8 flex-1 flex-col items-center gap-2">
          <div className="w-full rounded-t-lg bg-indigo-500" style={{ height: `${Math.max(6, (Number(row[valueKey] || 0) / max) * 170)}px` }} />
          <span className="max-w-16 truncate text-[10px] text-slate-500 dark:text-slate-400">{String(row[labelKey]).slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function DynamicCampaignField({ field, value, onChange }) {
  const name = field.fieldName || field.key;
  const label = field.label || name;
  const commonClass = "h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";
  if (field.configuration?.readOnly) {
    return (
      <label className="block space-y-1.5">
        <FieldLabel>{label}</FieldLabel>
        <span className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{String(value ?? field.defaultValue ?? "")}</span>
      </label>
    );
  }
  if (field.fieldType === "boolean") {
    return (
      <label className="block space-y-1.5">
        <FieldLabel>{label}</FieldLabel>
        <span className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(name, event.target.checked)} />
          {Boolean(value) ? "Enabled" : "Disabled"}
        </span>
      </label>
    );
  }
  if (field.fieldType === "select" || field.fieldType === "multi_select") {
    const options = field.options || field.configuration?.options || [];
    return (
      <label className="block space-y-1.5">
        <FieldLabel>{label}</FieldLabel>
        <select multiple={field.fieldType === "multi_select"} value={field.fieldType === "multi_select" ? (Array.isArray(value) ? value : []) : (value || "")} onChange={(event) => {
          if (field.fieldType === "multi_select") {
            onChange(name, Array.from(event.target.selectedOptions).map((option) => option.value));
          } else {
            onChange(name, event.target.value);
          }
        }} className={commonClass} aria-label={label}>
          {field.fieldType !== "multi_select" ? <option value="">Select</option> : null}
          {options.map((option) => {
            const optionValue = option.value ?? option.key ?? option.label ?? option;
            return <option key={String(optionValue)} value={optionValue}>{option.label || option.name || optionValue}</option>;
          })}
        </select>
      </label>
    );
  }
  if (field.fieldType === "textarea" || field.fieldType === "json") {
    return (
      <label className="block space-y-1.5 xl:col-span-2">
        <FieldLabel>{label}</FieldLabel>
        <textarea value={value || ""} onChange={(event) => onChange(name, event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label={label} />
      </label>
    );
  }
  const numeric = ["number", "currency", "percentage"].includes(field.fieldType);
  return (
    <label className="block space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input type={numeric ? "number" : field.fieldType === "date" ? "date" : "text"} min={field.min ?? field.configuration?.min} max={field.max ?? field.configuration?.max} value={value ?? ""} onChange={(event) => onChange(name, numeric ? Number(event.target.value || 0) : event.target.value)} className={commonClass} aria-label={label} />
    </label>
  );
}

function CampaignForm({ influencers, products, configuration = {}, onCreate, busy, initialInfluencerId = "", initialProductIds = [] }) {
  const initialProductKey = initialProductIds.join("|");
  const rules = useMemo(() => campaignRuleConfig(configuration), [configuration]);
  const [form, setForm] = useState({
    influencerId: initialInfluencerId || "",
    title: "",
    campaignType: "",
    productIds: initialProductIds,
    paymentType: "",
    commissionPercent: 0,
    fixedFee: 0,
    attributionDays: 0,
    expectedBudget: 0,
    productValue: 0,
    shippingCost: 0,
    selectedServices: [],
    dynamicFields: {},
    deadline: "",
    marketplace: { public: true },
  });
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    if (initialInfluencerId) {
      setForm((current) => ({ ...current, influencerId: initialInfluencerId }));
    }
  }, [initialInfluencerId]);

  useEffect(() => {
    if (initialProductKey) {
      setForm((current) => {
        if (current.productIds.join("|") === initialProductKey) return current;
        return { ...current, productIds: initialProductKey.split("|") };
      });
    }
  }, [initialProductKey]);

  const influencerOptions = useMemo(() => {
    const map = new Map();
    influencers.forEach((row) => {
      const id = String(row.influencerId || row.id || row._id || "");
      if (!id) return;
      const current = map.get(id) || {};
      map.set(id, {
        ...current,
        ...row,
        rateCard: row.rateCard?.length ? row.rateCard : current.rateCard,
        services: row.services?.length ? row.services : current.services,
        requirements: row.requirements || current.requirements,
      });
    });
    return [...map.values()];
  }, [influencers]);

  const selectedInfluencer = useMemo(() => {
    const id = String(form.influencerId || "");
    return influencerOptions.find((row) => String(row.influencerId || row.id || row._id) === id) || null;
  }, [form.influencerId, influencerOptions]);

  const selectedRateCard = selectedInfluencer?.rateCard || selectedInfluencer?.services || [];
  const selectedCampaignType = rules.campaignTypes.find((type) => type.key === form.campaignType) || rules.campaignTypes[0] || null;
  const paymentModels = selectedCampaignType?.allowedPaymentModels?.length ? selectedCampaignType.allowedPaymentModels : rules.paymentModels;
  const selectedPaymentModel = paymentModels.find((model) => model.key === form.paymentType) || paymentModels[0];
  const attributionWindows = rules.attributionWindows.length ? rules.attributionWindows : [];
  const dynamicFields = useMemo(() => (
    rules.fieldsByCombination[`${form.campaignType}:${form.paymentType}`] || []
  ), [rules.fieldsByCombination, form.campaignType, form.paymentType]);
  const dynamicNames = useMemo(() => fieldNames(dynamicFields), [dynamicFields]);
  const handledDynamicNames = new Set([
    "fixedFee",
    "fixedAmount",
    "selectedServices",
    "services",
    "commissionPercent",
    "commissionPercentage",
    "attributionDays",
    "expectedBudget",
    "maximumBudget",
    "productValue",
    "shippingCost",
    "affiliateTrackingEnabled",
  ]);
  const genericDynamicFields = dynamicFields.filter((field) => !handledDynamicNames.has(field.fieldName || field.key));

  useEffect(() => {
    setForm((current) => {
      const campaignType = rules.campaignTypes.some((type) => type.key === current.campaignType)
        ? current.campaignType
        : rules.campaignTypes[0]?.key || "";
      const typeConfig = rules.campaignTypes.find((type) => type.key === campaignType) || rules.campaignTypes[0] || null;
      const allowedPayments = typeConfig?.allowedPaymentModels?.length ? typeConfig.allowedPaymentModels : rules.paymentModels;
      const paymentType = allowedPayments.some((model) => model.key === current.paymentType)
        ? current.paymentType
        : typeConfig?.defaultPaymentType || allowedPayments[0]?.key || "";
      const fields = rules.fieldsByCombination[`${campaignType}:${paymentType}`] || [];
      const defaults = defaultDynamicValues(fields);
      const attributionDays = Number(current.attributionDays || defaults.attributionDays || rules.attributionWindows[0]?.days || 0);
      const commissionPercent = Number(current.commissionPercent || defaults.commissionPercent || defaults.commissionPercentage || 0);
      const dynamicFieldsNext = {
        ...defaults,
        ...current.dynamicFields,
        paymentType,
        attributionDays,
        commissionPercent,
        fixedFee: current.fixedFee,
        expectedBudget: current.expectedBudget,
        productValue: current.productValue,
        shippingCost: current.shippingCost,
      };
      if (
        campaignType === current.campaignType &&
        paymentType === current.paymentType &&
        attributionDays === current.attributionDays &&
        commissionPercent === current.commissionPercent
      ) {
        return { ...current, dynamicFields: dynamicFieldsNext };
      }
      return { ...current, campaignType, paymentType, attributionDays, commissionPercent, dynamicFields: dynamicFieldsNext };
    });
  }, [rules]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value, dynamicFields: { ...current.dynamicFields, [key]: value } }));
  }

  function setDynamicField(key, value) {
    setForm((current) => ({ ...current, dynamicFields: { ...current.dynamicFields, [key]: value } }));
  }

  function setCampaignType(value) {
    const typeConfig = rules.campaignTypes.find((type) => type.key === value) || null;
    const allowedPayments = typeConfig?.allowedPaymentModels?.length ? typeConfig.allowedPaymentModels : rules.paymentModels;
    const paymentType = allowedPayments.some((model) => model.key === form.paymentType)
      ? form.paymentType
      : typeConfig?.defaultPaymentType || allowedPayments[0]?.key || "";
    const fields = rules.fieldsByCombination[`${value}:${paymentType}`] || [];
    const defaults = defaultDynamicValues(fields);
    setForm((current) => ({
      ...current,
      campaignType: value,
      paymentType,
      commissionPercent: Number(defaults.commissionPercent ?? defaults.commissionPercentage ?? current.commissionPercent ?? 0),
      attributionDays: Number(defaults.attributionDays ?? current.attributionDays ?? rules.attributionWindows[0]?.days ?? 0),
      dynamicFields: { ...defaults, campaignType: value, paymentType },
    }));
  }

  function setPaymentType(value) {
    const fields = rules.fieldsByCombination[`${form.campaignType}:${value}`] || [];
    const defaults = defaultDynamicValues(fields);
    const nextNames = fieldNames(fields);
    setForm((current) => ({
      ...current,
      paymentType: value,
      commissionPercent: Number(defaults.commissionPercent ?? defaults.commissionPercentage ?? current.commissionPercent ?? 0),
      attributionDays: Number(defaults.attributionDays ?? current.attributionDays ?? rules.attributionWindows[0]?.days ?? 0),
      selectedServices: nextNames.has("selectedServices") || nextNames.has("services") ? current.selectedServices : [],
      fixedFee: nextNames.has("fixedFee") || nextNames.has("fixedAmount") ? current.fixedFee : 0,
      dynamicFields: { ...defaults, paymentType: value },
    }));
  }

  function toggleProduct(productId) {
    setForm((current) => {
      const selected = new Set(current.productIds);
      if (selected.has(productId)) selected.delete(productId);
      else selected.add(productId);
      return { ...current, productIds: [...selected] };
    });
  }

  function togglePackageSelection(service, pkg) {
    const serviceId = String(service._id || service.id || service.serviceId);
    const pkgId = String(pkg._id || pkg.id || pkg.packageId || "");
    const key = packageKey(service, pkg);
    setForm((current) => {
      const exists = current.selectedServices.some((item) => String(item.selectionKey || "") === key);
      const existing = current.selectedServices.filter((item) => String(item.selectionKey || "") !== key);
      if (exists) return { ...current, selectedServices: existing, dynamicFields: { ...current.dynamicFields, selectedServices: existing } };
      const selectedServices = [
        ...existing,
        {
          selectionKey: key,
          serviceId,
          packageId: pkgId || undefined,
          packageName: pkg.packageName || pkg.name || service.serviceName,
          serviceTypeKey: service.serviceTypeKey,
          serviceName: service.serviceName,
          quantity: 1,
          units: 1,
        },
      ];
      return {
        ...current,
        selectedServices,
        dynamicFields: { ...current.dynamicFields, selectedServices },
      };
    });
  }

  function isPackageSelected(service, pkg) {
    const key = packageKey(service, pkg);
    return form.selectedServices.some((item) => String(item.selectionKey || "") === key);
  }

  async function refreshPreview(nextForm = form) {
    if (!nextForm.productIds.length) return;
    setPreviewError("");
    try {
      const response = await previewVendorInfluencerCampaign(buildPayload(nextForm));
      setPreview(response?.data || null);
    } catch (err) {
      setPreview(null);
      setPreviewError(err?.response?.data?.message || "Unable to preview pricing.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshPreview().catch(() => {});
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.influencerId, form.productIds, form.campaignType, form.paymentType, form.commissionPercent, form.fixedFee, form.attributionDays, form.expectedBudget, form.productValue, form.shippingCost, form.selectedServices, form.dynamicFields]);

  function buildPayload(source = form) {
    const selectedServices = source.selectedServices.map(({ selectionKey, ...item }) => item);
    const dynamicFieldValues = {
      ...(source.dynamicFields || {}),
      selectedServices,
      fixedFee: Number(source.fixedFee || 0),
      commissionPercent: Number(source.commissionPercent || 0),
      attributionDays: Number(source.attributionDays || 0),
      expectedBudget: Number(source.expectedBudget || 0),
      productValue: Number(source.productValue || 0),
      shippingCost: Number(source.shippingCost || 0),
    };
    return {
      ...source,
      selectedServices,
      dynamicFields: dynamicFieldValues,
      deadline: source.deadline || null,
      commissionPercent: Number(source.commissionPercent || 0),
      fixedFee: Number(source.fixedFee || 0),
      marketplace: {
        ...source.marketplace,
        requiredDeliverables: splitLines(dynamicFieldValues.expectedDeliverables || dynamicFieldValues.deliverables || source.marketplace?.requiredDeliverables || []),
        requirements: {
          ...(source.marketplace?.requirements || {}),
          dynamicFields: dynamicFieldValues,
        },
      },
      paymentModel: {
        paymentType: source.paymentType,
        selectedServices,
        services: selectedServices,
        dynamicFields: dynamicFieldValues,
        fixedFee: Number(source.fixedFee || 0),
        commissionPercentage: Number(source.commissionPercent || 0),
        attributionDays: Number(source.attributionDays || 0),
        expectedBudget: Number(source.expectedBudget || 0),
        commissionCap: Number(dynamicFieldValues.commissionCap || 0),
        productValue: Number(source.productValue || 0),
        shippingCost: Number(source.shippingCost || 0),
        shippingDetails: dynamicFieldValues.shippingDetails || "",
        returnRequired: Boolean(dynamicFieldValues.returnRequired),
        currency: dynamicFieldValues.currency || undefined,
      },
    };
  }

  async function submit(event) {
    event.preventDefault();
    await onCreate(buildPayload());
    const campaignType = rules.campaignTypes[0]?.key || "";
    const typeConfig = rules.campaignTypes[0] || null;
    const paymentType = typeConfig?.defaultPaymentType || typeConfig?.allowedPaymentModels?.[0]?.key || rules.paymentModels[0]?.key || "";
    const fields = rules.fieldsByCombination[`${campaignType}:${paymentType}`] || [];
    const defaults = defaultDynamicValues(fields);
    setForm({
      influencerId: initialInfluencerId || "",
      title: "",
      campaignType,
      productIds: initialProductKey ? initialProductKey.split("|") : [],
      paymentType,
      commissionPercent: Number(defaults.commissionPercent ?? defaults.commissionPercentage ?? 0),
      fixedFee: 0,
      attributionDays: Number(defaults.attributionDays ?? rules.attributionWindows[0]?.days ?? 0),
      expectedBudget: 0,
      productValue: 0,
      shippingCost: 0,
      selectedServices: [],
      dynamicFields: defaults,
      deadline: "",
      marketplace: { public: true },
    });
    setPreview(null);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="block space-y-1.5 xl:col-span-2">
        <FieldLabel>Campaign Title</FieldLabel>
        <input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Campaign title" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Campaign title" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Influencer</FieldLabel>
        <select value={form.influencerId} onChange={(event) => setForm((current) => ({ ...current, influencerId: event.target.value, selectedServices: [] }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Invite influencer">
          <option value="">Public marketplace campaign</option>
          {influencerOptions.map((row) => <option key={row.influencerId || row.id || row._id} value={row.influencerId || row.id || row._id}>{row.name || row.username}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Campaign Type</FieldLabel>
        <select value={form.campaignType} onChange={(event) => setCampaignType(event.target.value)} disabled={!rules.campaignTypes.length} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white disabled:opacity-60" aria-label="Campaign type">
          {!rules.campaignTypes.length ? <option value="">No campaign rules configured</option> : null}
          {rules.campaignTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
        </select>
      </label>
      <fieldset className="block space-y-1.5 xl:col-span-2">
        <FieldLabel>Campaign Products</FieldLabel>
        <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
          {products.map((row) => {
            const product = row.product || row;
            const productId = String(getId(product));
            return (
              <label key={productId} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900">
                <input type="checkbox" checked={form.productIds.includes(productId)} onChange={() => toggleProduct(productId)} />
                <span className="min-w-0 flex-1 truncate" title={product.name}>{shortText(product.name, 82)}</span>
              </label>
            );
          })}
          {!products.length ? <p className="px-2 py-4 text-sm text-slate-500">Add approved products before creating a campaign.</p> : null}
        </div>
        <p className="text-xs text-slate-500">{form.productIds.length} selected</p>
      </fieldset>
      <label className="block space-y-1.5">
        <FieldLabel>Payment Model</FieldLabel>
        <select value={form.paymentType} onChange={(event) => setPaymentType(event.target.value)} disabled={!paymentModels.length} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white disabled:opacity-60" aria-label="Payment model">
          {!paymentModels.length ? <option value="">No valid payment models</option> : null}
          {paymentModels.map((model) => <option key={model.key} value={model.key}>{model.label}</option>)}
        </select>
      </label>
      {(dynamicNames.has("selectedServices") || dynamicNames.has("services")) ? (
        <fieldset className="block space-y-1.5 xl:col-span-3">
          <FieldLabel>Creator Services</FieldLabel>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
            {selectedRateCard.length ? selectedRateCard.map((service) => (
              <div key={service._id || service.id} className="rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{service.serviceName}</span>
                  <span className="text-xs font-semibold text-slate-500">{service.minimumNoticePeriod ? `${service.minimumNoticePeriod}d notice` : ""}</span>
                </div>
                <div className="mt-2 grid gap-2">
                  {servicePackages(service).map((pkg) => {
                    const selected = isPackageSelected(service, pkg);
                    const price = packagePrice(pkg, service);
                    return (
                      <label key={packageKey(service, pkg)} className={`grid min-h-10 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${selected ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30" : "border-slate-100 dark:border-slate-800"}`}>
                        <input type="checkbox" checked={selected} onChange={() => togglePackageSelection(service, pkg)} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{pkg.packageName || pkg.name || "Package"}</span>
                          <span className="text-xs text-slate-500">{Number(pkg.quantity || 1)} deliverable{Number(pkg.quantity || 1) === 1 ? "" : "s"} - {pkg.deliveryDays ?? service.deliveryDays ?? 0}d - {pkg.revisionCount ?? service.revisionCount ?? 0} rev</span>
                        </span>
                        <span className="text-sm font-semibold text-slate-950 dark:text-white">{price ? formatCurrency(price) : "Request"}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )) : (
              <p className="px-2 py-4 text-sm text-slate-500">Select a creator with active services or enter a fallback fixed fee.</p>
            )}
          </div>
        </fieldset>
      ) : null}
      {(dynamicNames.has("fixedFee") || dynamicNames.has("fixedAmount")) && !form.selectedServices.length ? (
        <label className="block space-y-1.5">
          <FieldLabel>{dynamicFields.find((field) => ["fixedFee", "fixedAmount"].includes(field.fieldName || field.key))?.label || "Fixed Fee"}</FieldLabel>
          <input type="number" min="0" value={form.fixedFee} onChange={(event) => setField("fixedFee", Number(event.target.value || 0))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Fixed fee" />
        </label>
      ) : null}
      {(dynamicNames.has("commissionPercent") || dynamicNames.has("commissionPercentage")) ? (
        <label className="block space-y-1.5">
          <FieldLabel>{dynamicFields.find((field) => ["commissionPercent", "commissionPercentage"].includes(field.fieldName || field.key))?.label || "Commission Percent"}</FieldLabel>
          <input type="number" min="0" max="50" value={form.commissionPercent} onChange={(event) => setField("commissionPercent", Number(event.target.value || 0))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Commission percent" />
        </label>
      ) : null}
      {dynamicNames.has("attributionDays") ? (
        <label className="block space-y-1.5">
          <FieldLabel>{dynamicFields.find((field) => (field.fieldName || field.key) === "attributionDays")?.label || "Attribution Window"}</FieldLabel>
          <select value={form.attributionDays} onChange={(event) => setField("attributionDays", Number(event.target.value || 0))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Attribution window">
            {attributionWindows.map((window) => <option key={window.key || window.days} value={window.days}>{window.label || `${window.days} days`}</option>)}
          </select>
        </label>
      ) : null}
      {(dynamicNames.has("expectedBudget") || dynamicNames.has("maximumBudget")) ? (
        <label className="block space-y-1.5">
          <FieldLabel>{dynamicFields.find((field) => ["expectedBudget", "maximumBudget"].includes(field.fieldName || field.key))?.label || "Maximum Budget"}</FieldLabel>
          <input type="number" min="0" value={form.expectedBudget} onChange={(event) => setField("expectedBudget", Number(event.target.value || 0))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Expected budget" />
        </label>
      ) : null}
      {dynamicNames.has("productValue") ? (
        <label className="block space-y-1.5">
          <FieldLabel>{dynamicFields.find((field) => (field.fieldName || field.key) === "productValue")?.label || "Product Value"}</FieldLabel>
          <input type="number" min="0" value={form.productValue} onChange={(event) => setField("productValue", Number(event.target.value || 0))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Product value" />
        </label>
      ) : null}
      {dynamicNames.has("shippingCost") ? (
        <label className="block space-y-1.5">
          <FieldLabel>{dynamicFields.find((field) => (field.fieldName || field.key) === "shippingCost")?.label || "Shipping Cost"}</FieldLabel>
          <input type="number" min="0" value={form.shippingCost} onChange={(event) => setField("shippingCost", Number(event.target.value || 0))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Shipping cost" />
        </label>
      ) : null}
      {genericDynamicFields.map((field) => (
        <DynamicCampaignField key={field.fieldName || field.key} field={field} value={form.dynamicFields?.[field.fieldName || field.key]} onChange={setDynamicField} />
      ))}
      <label className="block space-y-1.5">
        <FieldLabel>Campaign Deadline</FieldLabel>
        <input type="date" value={form.deadline} onChange={(event) => setField("deadline", event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Campaign deadline" />
      </label>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950 xl:col-span-2">
        <p className="font-semibold text-slate-950 dark:text-white">{selectedPaymentModel?.label || "Payment Model"}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span>Fixed</span><b className="text-right">{formatCurrency(preview?.pricing?.fixedCost || 0)}</b>
          <span>Reserve</span><b className="text-right">{formatCurrency(preview?.pricing?.commissionReserve || 0)}</b>
          <span>Product/Shipping</span><b className="text-right">{formatCurrency((preview?.pricing?.productCost || 0) + (preview?.pricing?.shippingCost || 0))}</b>
          <span>Total</span><b className="text-right text-slate-950 dark:text-white">{formatCurrency(preview?.pricing?.totalBudget || 0)}</b>
        </div>
        {previewError ? <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">{previewError}</p> : null}
      </div>
      <label className="block space-y-1.5">
        <FieldLabel>Visibility</FieldLabel>
        <span className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={form.marketplace.public} onChange={(event) => setForm((current) => ({ ...current, marketplace: { ...current.marketplace, public: event.target.checked } }))} />
          Marketplace
        </span>
      </label>
      <button type="submit" disabled={busy || !form.title.trim() || !form.productIds.length || !form.campaignType || !form.paymentType || Boolean(previewError)} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
        <Send className="h-4 w-4" aria-hidden="true" />
        Create
      </button>
    </form>
  );
}

export function VendorInfluencerPage() {
  const { influencerCommerceEnabled, loading: commerceLoading } = usePlatformFeatures();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = useMemo(() => {
    const suffix = location.pathname.replace(/^\/vendor\/influencer-commerce\/?/, "");
    const next = suffix.split("/")[0] || "dashboard";
    return TAB_IDS.has(next) ? next : "dashboard";
  }, [location.pathname]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState({});
  const [planChangePreview, setPlanChangePreview] = useState(null);

  const query = useMemo(() => {
    const clean = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) clean[key] = value;
    });
    return clean;
  }, [filters]);

  const campaigns = data.campaigns?.items || data.dashboard?.campaigns || [];
  const products = data.products?.items || [];
  const relationships = data.relationships?.items || [];
  const discovery = data.discover?.items || [];

  const loadFoundation = useCallback(async () => {
    const [campaignResponse, productResponse, relationshipResponse, subscriptionResponse, configurationResponse] = await Promise.all([
      getVendorInfluencerCampaigns({ limit: 100 }),
      getVendorPromotionProducts({ limit: 100 }),
      getVendorInfluencerRelationships({ limit: 100 }),
      getVendorInfluencerSubscriptionPlans(),
      getVendorInfluencerCommerceConfiguration(),
    ]);
    setData((current) => ({
      ...current,
      campaigns: campaignResponse?.data || { items: [] },
      products: productResponse?.data || { items: [] },
      relationships: relationshipResponse?.data || { items: [] },
      subscription: subscriptionResponse?.data || {},
      configuration: configurationResponse?.data || {},
    }));
  }, []);

  const loadTab = useCallback(async ({ silent = false } = {}) => {
    if (commerceLoading || !influencerCommerceEnabled) return;
    if (!silent) setLoading(true);
    setError("");
    try {
      const loaders = {
        dashboard: () => getVendorInfluencerCommerceDashboard(query),
        discover: () => discoverVendorInfluencers(query),
        subscription: () => getVendorInfluencerSubscriptionPlans(),
        relationships: () => getVendorInfluencerRelationships(query),
        campaigns: () => getVendorInfluencerCampaigns(query),
        products: () => getVendorPromotionProducts(query),
        affiliate: () => getVendorAffiliateProducts(query),
        content: () => getVendorContentApprovals({ ...query, queue: "pending" }),
        performance: () => getVendorInfluencerPerformance(query),
        analytics: () => getVendorInfluencerAnalytics(query),
        leaderboard: () => getVendorCreatorLeaderboard(query),
        reports: () => getVendorInfluencerReports(query),
      };
      const response = await loaders[tab]();
      setData((current) => ({ ...current, [tab]: response?.data || {} }));
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load influencer commerce data.");
    } finally {
      setLoading(false);
    }
  }, [commerceLoading, influencerCommerceEnabled, query, tab]);

  useEffect(() => {
    if (!commerceLoading && influencerCommerceEnabled) {
      loadFoundation().catch(() => {});
    }
  }, [commerceLoading, influencerCommerceEnabled, loadFoundation]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadTab(), filters.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadTab, filters.search]);

  useEffect(() => {
    if (commerceLoading || !influencerCommerceEnabled) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || busyId) return;
      loadTab({ silent: true }).catch(() => {});
      loadFoundation().catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [busyId, commerceLoading, influencerCommerceEnabled, loadFoundation, loadTab]);

  if (!commerceLoading && !influencerCommerceEnabled) {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  async function runAction(id, action, successText) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successText);
      await Promise.all([loadTab({ silent: true }), loadFoundation()]);
      return true;
    } catch (err) {
      setError(err?.response?.data?.message || "Action failed.");
      return false;
    } finally {
      setBusyId("");
    }
  }

  async function createCampaign(payload) {
    await runAction("create-campaign", () => createVendorInfluencerCampaign(payload), "Campaign synchronized with the influencer ecosystem.");
  }

  async function visitInfluencerProfile(row) {
    const ok = await runAction(`visit-${row.id}`, () => visitVendorInfluencer(row.id), "Influencer visit recorded.");
    if (ok && row.username) navigate(`/influencer/${encodeURIComponent(row.username)}`);
  }

  async function purchaseSubscription(plan, billingCycle = "monthly") {
    const current = data.subscription?.currentSubscription;
    const hasActiveSubscription = Boolean(current?._id && ["active", "trialing", "grace_period"].includes(String(current.status || "").toLowerCase()));
    if (hasActiveSubscription) {
      setBusyId(`preview-${plan._id}`);
      setError("");
      try {
        const response = await previewVendorInfluencerSubscriptionChange({ planId: plan._id, billingCycle });
        setPlanChangePreview(response?.data || response);
      } catch (err) {
        setError(err?.response?.data?.message || "Unable to calculate subscription change.");
      } finally {
        setBusyId("");
      }
      return;
    }
    setBusyId(`subscribe-${plan._id}`);
    setError("");
    setMessage("");
    try {
      const orderResponse = await createVendorInfluencerSubscriptionOrder({ planId: plan._id, billingCycle, autoRenew: Boolean(plan.autoRenewAllowed) });
      const order = orderResponse?.data || orderResponse;
      if (!order?.requiresPayment) {
        setMessage("Subscription activated.");
        await loadTab({ silent: true });
        return;
      }
      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) throw new Error("Razorpay checkout failed to load.");
      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: order.key,
          amount: order.amount,
          currency: order.currency,
          name: "Influencer Commerce",
          description: `${plan.planName} subscription`,
          order_id: order.razorpayOrderId,
          handler: async (response) => {
            try {
              await verifyVendorInfluencerSubscriptionPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Checkout closed before payment was completed.")),
          },
        });
        checkout.open();
      });
      setMessage("Subscription payment verified and plan activated.");
      await loadTab({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Subscription purchase failed.");
    } finally {
      setBusyId("");
    }
  }

  async function confirmSubscriptionChange() {
    if (!planChangePreview?.targetPlan?._id) return;
    const preview = planChangePreview;
    setBusyId(`change-${preview.targetPlan._id}`);
    setError("");
    setMessage("");
    try {
      const orderResponse = await createVendorInfluencerSubscriptionChangeOrder({
        planId: preview.targetPlan._id,
        billingCycle: preview.targetBillingCycle,
        autoRenew: Boolean(preview.targetPlan.autoRenewAllowed),
      });
      const order = orderResponse?.data || orderResponse;
      if (!order?.requiresPayment) {
        setPlanChangePreview(null);
        setMessage("Subscription changed.");
        await Promise.all([loadTab({ silent: true }), loadFoundation()]);
        return;
      }
      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) throw new Error("Razorpay checkout failed to load.");
      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: order.key,
          amount: order.amount,
          currency: order.currency,
          name: "Influencer Commerce",
          description: "Subscription change",
          order_id: order.razorpayOrderId || order.orderId,
          handler: async (paymentResult) => {
            try {
              await confirmVendorInfluencerSubscriptionChange({
                razorpay_order_id: paymentResult.razorpay_order_id,
                razorpay_payment_id: paymentResult.razorpay_payment_id,
                razorpay_signature: paymentResult.razorpay_signature,
              });
              resolve();
            } catch (verifyError) {
              reject(verifyError);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
          theme: { color: "#4f46e5" },
        });
        checkout.open();
      });
      setPlanChangePreview(null);
      setMessage("Subscription changed.");
      await Promise.all([loadTab({ silent: true }), loadFoundation()]);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Subscription change failed.");
    } finally {
      setBusyId("");
    }
  }

  async function refreshAll() {
    setMessage("");
    setError("");
    try {
      await Promise.all([loadFoundation(), loadTab()]);
      setMessage("Influencer commerce data refreshed.");
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to refresh influencer commerce data.");
    }
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Existing influencer commerce stack
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Influencer Commerce</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Campaign collaboration, affiliate promotion, content approvals, attribution, commissions, payouts, analytics, and reports powered by the existing campaign, content, wallet, notification, and commission systems.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refreshAll} disabled={loading || Boolean(busyId)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
            <button type="button" onClick={() => navigate("/vendor/products/create")} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Product
            </button>
            <button type="button" onClick={() => navigate(TAB_PATHS.campaigns)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              New Campaign
            </button>
          </div>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Influencer commerce sections">
        {TABS.map(([id, label, Icon]) => {
          const active = id === tab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(TAB_PATHS[id])}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <Filters filters={filters} setFilters={setFilters} campaigns={campaigns} products={products} configuration={data.configuration || {}} tab={tab} includeSearch={!["dashboard", "analytics", "reports", "subscription"].includes(tab)} />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">{error}</div> : null}
      {planChangePreview ? <SubscriptionChangeModal preview={planChangePreview} busy={Boolean(busyId)} onClose={() => setPlanChangePreview(null)} onConfirm={confirmSubscriptionChange} /> : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Loading influencer commerce...</div> : null}

      {tab === "dashboard" ? <DashboardView dashboard={data.dashboard} /> : null}
      {tab === "discover" ? (
        <DiscoverView
          rows={discovery}
          pagination={data.discover?.pagination}
          subscriptionData={data.subscription}
          busyId={busyId}
          onSubscribe={purchaseSubscription}
          onPage={(page) => setFilters((current) => ({ ...current, page }))}
          onSave={(row) => runAction(`save-${row.id}`, () => saveVendorInfluencer(row.id, !row.saved), row.saved ? "Influencer removed from saved list." : "Influencer saved.")}
          onVisit={visitInfluencerProfile}
          onInvite={(row) => runAction(
            `invite-${row.id}`,
            () => updateVendorInfluencerRelationship(row.id, { status: "invited", notes: "Invited from influencer discovery." }),
            "Influencer selected. Create a campaign to send the invite."
          ).then((success) => {
            if (!success) return;
            setFilters((current) => ({ ...current, influencerId: row.id, page: 1 }));
            navigate(TAB_PATHS.campaigns);
          })}
        />
      ) : null}
      {tab === "subscription" ? (
        <SubscriptionView
          data={data.subscription}
          busyId={busyId}
          onSubscribe={purchaseSubscription}
          onCancel={() => runAction("cancel-subscription", () => cancelVendorInfluencerSubscription(), "Subscription cancelled.")}
        />
      ) : null}
      {tab === "relationships" ? (
        <RelationshipsView
          rows={relationships}
          pagination={data.relationships?.pagination}
          busyId={busyId}
          onPage={(page) => setFilters((current) => ({ ...current, page }))}
          onInvite={(row) => runAction(
            `invite-${row.influencerId}`,
            () => updateVendorInfluencerRelationship(row.influencerId, { status: "invited", notes: "Invited from relationship management." }),
            "Influencer selected. Create a campaign to send the invite."
          ).then((success) => {
            if (!success) return;
            setFilters((current) => ({ ...current, influencerId: row.influencerId, page: 1 }));
            navigate(TAB_PATHS.campaigns);
          })}
          onStatus={(row, status) => runAction(row.influencerId, () => updateVendorInfluencerRelationship(row.influencerId, { status }), "Relationship updated.")}
        />
      ) : null}
      {tab === "campaigns" ? <CampaignsView campaigns={campaigns} pagination={data.campaigns?.pagination} products={products} influencers={[...relationships, ...discovery]} configuration={data.configuration || {}} selectedInfluencerId={filters.influencerId} selectedProductIds={filters.productId ? [filters.productId] : []} busyId={busyId} onPage={(page) => setFilters((current) => ({ ...current, page }))} onCreate={createCampaign} onReview={(campaign, application, decision) => runAction(`${campaign._id}-${application.influencerId}`, () => reviewVendorCampaignApplication(campaign._id, application.influencerId, { decision }), "Campaign application reviewed.")} onStatus={(campaign, action) => runAction(campaign._id, () => updateVendorInfluencerCampaignStatus(campaign._id, { action }), "Campaign status updated.")} onDelete={(campaign) => runAction(`delete-${campaign._id}`, () => deleteVendorInfluencerCampaign(campaign._id), "Campaign deleted.")} /> : null}
      {tab === "products" ? (
        <ProductsView
          rows={products}
          pagination={data.products?.pagination}
          title="Product Promotion"
          onPage={(page) => setFilters((current) => ({ ...current, page }))}
          onPromote={(row) => {
            setFilters((current) => ({ ...current, productId: String(row.id), page: 1 }));
            navigate(TAB_PATHS.campaigns);
          }}
          onEdit={(row) => navigate(`/vendor/products/${row.id}/edit`)}
        />
      ) : null}
      {tab === "affiliate" ? (
        <ProductsView
          rows={data.affiliate?.items || []}
          pagination={data.affiliate?.pagination}
          title="Affiliate Products"
          onPage={(page) => setFilters((current) => ({ ...current, page }))}
          onPromote={(row) => {
            setFilters((current) => ({ ...current, productId: String(row.id), page: 1 }));
            navigate(TAB_PATHS.campaigns);
          }}
          onEdit={(row) => navigate(`/vendor/products/${row.id}/edit`)}
        />
      ) : null}
      {tab === "content" ? (
        <ContentView
          rows={data.content?.items || []}
          pagination={data.content?.pagination}
          busyId={busyId}
          onPage={(page) => setFilters((current) => ({ ...current, page }))}
          onView={(row) => {
            const url = resolveApiAssetUrl(row.url);
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          }}
          onReview={(row, decision) => runAction(row.id, () => reviewVendorInfluencerContent(row.id, { decision, note: decision === "changes" ? "Please update this content and resubmit." : "" }), "Content review synchronized.")}
        />
      ) : null}
      {tab === "performance" ? (
        <PerformanceView
          rows={data.performance?.items || []}
          summary={data.performance?.summary}
          pagination={data.performance?.pagination}
          busyId={busyId}
          onPage={(page) => setFilters((current) => ({ ...current, page }))}
          onCampaign={(row) => {
            setFilters((current) => ({ ...current, influencerId: String(row.influencerId), page: 1 }));
            navigate(TAB_PATHS.campaigns);
          }}
        />
      ) : null}
      {tab === "analytics" ? <AnalyticsView analytics={data.analytics} /> : null}
      {tab === "leaderboard" ? (
        <LeaderboardView
          rows={data.leaderboard?.items || []}
          summary={data.leaderboard?.summary}
          pagination={data.leaderboard?.pagination}
          busyId={busyId}
          onPage={(page) => setFilters((current) => ({ ...current, page }))}
          onInvite={(row) => runAction(
            `invite-${row.influencerId}`,
            () => updateVendorInfluencerRelationship(row.influencerId, { status: "invited", notes: "Invited from creator leaderboard." }),
            "Creator selected. Create a campaign to send the invite."
          ).then((success) => {
            if (!success) return;
            navigate(TAB_PATHS.campaigns);
            setFilters((current) => ({ ...current, influencerId: row.influencerId, page: 1 }));
          })}
          onCampaign={(row) => {
            setFilters((current) => ({ ...current, influencerId: String(row.influencerId), page: 1 }));
            navigate(TAB_PATHS.campaigns);
          }}
        />
      ) : null}
      {tab === "reports" ? <ReportsView reports={data.reports} /> : null}
    </div>
  );
}

function DashboardView({ dashboard = {} }) {
  const widgets = dashboard.widgets || {};
  const charts = dashboard.charts || {};
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Total Influencers" value={numberValue(widgets.totalInfluencers)} />
        <Metric label="Active Influencers" value={numberValue(widgets.activeInfluencers)} />
        <Metric label="Campaign Revenue" value={formatCurrency(widgets.campaignRevenue || 0)} />
        <Metric label="Campaign Spend" value={formatCurrency(widgets.campaignSpend || 0)} />
        <Metric label="Commission Paid" value={formatCurrency(widgets.commissionPaid || 0)} />
        <Metric label="Pending Commission" value={formatCurrency(widgets.pendingCommissions || 0)} />
        <Metric label="Conversions" value={numberValue(widgets.campaignConversions)} />
        <Metric label="ROI" value={percentValue(widgets.roi)} />
        <Metric label="Content Queue" value={numberValue(widgets.pendingContentApprovals)} />
        <Metric label="Applications" value={numberValue(widgets.pendingApplications)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Campaign Revenue Trend" icon={BarChart3}><SimpleBars rows={charts.campaignRevenueTrend || []} valueKey="revenue" /></Section>
        <Section title="Commission Trend" icon={LineChart}><SimpleBars rows={charts.commissionTrend || []} valueKey="commission" /></Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <MiniTable title="Top Influencers" icon={Users} rows={dashboard.topInfluencers || []} columns={["name", "revenue", "orders"]} moneyColumns={["revenue"]} />
        <MiniTable title="Top Products" icon={Package} rows={dashboard.topProducts || []} columns={["name", "revenue", "orders"]} moneyColumns={["revenue"]} />
      </div>
    </div>
  );
}

function MiniTable({ title, icon, rows, columns, moneyColumns = [] }) {
  return (
    <Section title={title} icon={icon}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-3 py-2">{statusText(column)}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id || row.name} className="border-t border-slate-100 dark:border-slate-800">
                {columns.map((column) => <td key={column} className="px-3 py-3 text-slate-700 dark:text-slate-200">{moneyColumns.includes(column) ? formatCurrency(row[column] || 0) : row[column]}</td>)}
              </tr>
            ))}
            {!rows.length ? <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={columns.length}>No data yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function SubscriptionView({ data = {}, busyId, onSubscribe, onCancel }) {
  const payments = data.payments || [];
  const invoices = data.invoices || [];

  return (
    <div className="grid gap-5">
      <PremiumSubscriptionPlans data={data} busyId={busyId} onSubscribe={onSubscribe} onCancel={onCancel} showCancel />

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Payment History" icon={CreditCard}>
          <ResponsiveTable
            headers={["Plan", "Amount", "Status", "Payment", "Date"]}
            rows={payments}
            renderRow={(payment) => (
              <tr key={payment._id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-semibold">{payment.metadata?.planName || payment.planId?.planName || "-"}</td>
                <td className="px-3 py-3">{formatCurrency(payment.amount || 0, { currency: payment.currency })}</td>
                <td className="px-3 py-3"><StatusBadge value={payment.status} /></td>
                <td className="px-3 py-3">{payment.razorpayPaymentId || payment.razorpayOrderId || "-"}</td>
                <td className="px-3 py-3">{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "-"}</td>
              </tr>
            )}
          />
        </Section>
        <Section title="Invoices" icon={FileCheck2}>
          <ResponsiveTable
            headers={["Invoice", "Amount", "Status", "Date"]}
            rows={invoices}
            renderRow={(invoice) => (
              <tr key={invoice.invoiceId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-semibold">{invoice.invoiceId}</td>
                <td className="px-3 py-3">{formatCurrency(invoice.amount || 0, { currency: invoice.currency })}</td>
                <td className="px-3 py-3"><StatusBadge value={invoice.status} /></td>
                <td className="px-3 py-3">{invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : "-"}</td>
              </tr>
            )}
          />
        </Section>
      </div>
    </div>
  );
}

function PremiumSubscriptionPlans({ data = {}, busyId, onSubscribe, onCancel, showCancel = false }) {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const current = data.currentSubscription || {};
  const currentPlan = current.planId || {};
  const plans = data.plans || [];
  const copySourcePlan = currentPlan?._id ? currentPlan : plans.find((plan) => plan?.metadata && Object.keys(plan.metadata).length) || {};
  const usage = data.usage || {};
  const hasActiveSubscription = Boolean(current?._id && ["active", "trialing", "grace_period"].includes(String(current.status || "").toLowerCase()));
  const currentPlanId = hasActiveSubscription ? String(currentPlan._id || current.planId || "") : "";
  const currentBillingCycle = current.billingCycle || "monthly";
  const activeCampaigns = Number(usage.activeCampaigns || 0);
  const campaignLimit = hasActiveSubscription ? Number(usage.campaignLimit ?? current.campaignLimit ?? currentPlan.campaignLimit ?? 0) : 0;
  const visibilityLimit = hasActiveSubscription ? Number(usage.visibilityLimit ?? current.visibilityLimit ?? currentPlan.influencerVisibilityLimit ?? 0) : 0;
  const influencersVisible = hasActiveSubscription ? Number(usage.influencersVisible || 0) : 0;
  const campaignProgress = campaignLimit < 0 ? 42 : campaignLimit ? (activeCampaigns / campaignLimit) * 100 : 0;
  const visibleProgress = visibilityLimit < 0 ? 68 : visibilityLimit ? (influencersVisible / visibilityLimit) * 100 : 0;
  const benefitCount = hasActiveSubscription ? planBenefits(currentPlan).filter(Boolean).length : 0;
  const meta = copySourcePlan.metadata || {};
  const copy = (key, fallback) => meta[key] || fallback;
  const remainingCampaigns = Math.max(0, campaignLimit - activeCampaigns);
  const campaignRemainingLabel = remainingCampaigns === 1 ? copy("campaignRemainingSingular", "campaign remaining") : copy("campaignRemainingPlural", "campaigns remaining");
  const renewDate = current.endDate ? new Date(current.endDate).toLocaleDateString() : "";
  const startDate = current.startDate ? new Date(current.startDate).toLocaleDateString() : "";
  const daysRemaining = current.endDate ? Math.max(0, Math.ceil((new Date(current.endDate).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">{copy("summaryTitle", "Subscription Plans")}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy("summarySubtitle", "Choose a plan that fits your business needs. Upgrade anytime to unlock more features.")}</p>
        </div>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <HelpCircle className="h-4 w-4" />
          {copy("helpLabel", "How Subscriptions Work?")}
        </button>
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 xl:grid-cols-[1.05fr_1.25fr_1.25fr_1.25fr_auto]">
        <div className="border-slate-200 xl:border-r xl:pr-5 dark:border-slate-800">
          <p className="text-xs font-semibold text-indigo-600">{copy("currentPlanLabel", "Current Plan")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-semibold text-slate-950 dark:text-white">{hasActiveSubscription ? currentPlan.planName : "No Active Subscription"}</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasActiveSubscription ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{hasActiveSubscription ? copy("activeStatusLabel", "Active") : "Inactive"}</span>
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{hasActiveSubscription && renewDate ? `${copy("renewPrefix", "Your plan renews on")} ${renewDate}` : "Choose a plan to activate influencer commerce."}</p>
          {hasActiveSubscription ? <p className="mt-2 text-xs font-semibold text-slate-500">Start: {startDate || "-"} · End: {renewDate || "-"} · {daysRemaining} days remaining</p> : null}
        </div>

        <PlanUsageTile icon={CreditCard} label={copy("campaignsLabel", "Campaigns")} value={`${numberValue(activeCampaigns)} / ${campaignLimit < 0 ? "Unlimited" : numberValue(campaignLimit)}`} progress={campaignProgress} hint={campaignLimit < 0 ? copy("campaignUnlimitedHint", "Unlimited campaigns") : `${remainingCampaigns} ${campaignRemainingLabel}`} tone="bg-indigo-300" iconClass="bg-indigo-100 text-indigo-700" />
        <PlanUsageTile icon={Users} label={copy("influencersLabel", "Influencers Visible")} value={`${visibilityLimit < 0 ? numberValue(influencersVisible) : numberValue(influencersVisible)} / ${visibilityLimit < 0 ? "Unlimited" : numberValue(visibilityLimit)}`} progress={visibleProgress} hint={visibilityLimit < 0 ? copy("visibilityUnlimitedHint", "Unlimited visibility") : influencersVisible >= visibilityLimit ? copy("visibilityLimitHint", "Limit reached") : copy("visibilityAvailableHint", "Visibility available")} tone="bg-emerald-400" iconClass="bg-emerald-100 text-emerald-700" />
        <PlanUsageTile icon={Crown} label={copy("benefitsLabel", "Plan Benefits")} value={hasActiveSubscription ? `${benefitCount} / ${Math.max(benefitCount, planBenefits(currentPlan).length || 6)}` : "0"} progress={hasActiveSubscription ? (benefitCount / Math.max(benefitCount, planBenefits(currentPlan).length || 6)) * 100 : 0} hint={hasActiveSubscription ? copy("benefitsHint", "Upgrade to unlock more") : "Subscribe to unlock benefits"} tone="bg-amber-300" iconClass="bg-amber-100 text-amber-700" />

        <div className="flex items-center gap-2 xl:justify-end">
          {showCancel ? (
            <button type="button" disabled={!current?._id || busyId === "cancel-subscription"} onClick={onCancel} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Cancel</button>
          ) : null}
          <button type="button" onClick={() => document.getElementById("available-subscription-plans")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="h-11 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-500">{hasActiveSubscription ? copy("upgradeCta", "Upgrade Plan") : "Choose Plan"}</button>
        </div>
      </div>

      <div id="available-subscription-plans" className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{copy("availablePlansTitle", "Available Plans")}</h3>
        <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <button type="button" onClick={() => setBillingCycle("monthly")} className={`h-9 rounded-lg px-4 text-sm font-semibold ${billingCycle === "monthly" ? "bg-white text-indigo-700 ring-1 ring-indigo-300 dark:bg-slate-900" : "text-slate-500"}`}>{copy("monthlyLabel", "Monthly")}</button>
          <button type="button" onClick={() => setBillingCycle("quarterly")} className={`h-9 rounded-lg px-4 text-sm font-semibold ${billingCycle === "quarterly" ? "bg-white text-indigo-700 ring-1 ring-indigo-300 dark:bg-slate-900" : "text-slate-500"}`}>Quarterly</button>
          <button type="button" onClick={() => setBillingCycle("half_yearly")} className={`h-9 rounded-lg px-4 text-sm font-semibold ${billingCycle === "half_yearly" ? "bg-white text-indigo-700 ring-1 ring-indigo-300 dark:bg-slate-900" : "text-slate-500"}`}>Half Yearly</button>
          <button type="button" onClick={() => setBillingCycle("yearly")} className={`h-9 rounded-lg px-4 text-sm font-semibold ${billingCycle === "yearly" ? "bg-white text-indigo-700 ring-1 ring-indigo-300 dark:bg-slate-900" : "text-slate-500"}`}>{copy("yearlyLabel", "Yearly")}</button>
          <span className="ml-1 inline-flex items-center rounded-lg bg-emerald-100 px-3 text-xs font-semibold text-emerald-700">{copy("savingsLabel", "Save 20%")}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {plans.map((plan) => (
          <PremiumPlanCard key={plan._id} plan={plan} currentPlan={currentPlan} billingCycle={billingCycle} currentBillingCycle={currentBillingCycle} isCurrent={String(plan._id) === currentPlanId} busy={busyId === `subscribe-${plan._id}` || busyId === `preview-${plan._id}`} disabled={Boolean(busyId)} onSubscribe={onSubscribe} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:grid-cols-2 xl:grid-cols-4">
        <TrustTile icon={ShieldCheck} title="Secure Payments" text="100% secure payments powered by Razorpay" tone="bg-violet-100 text-violet-700" />
        <TrustTile icon={RefreshCw} title="Cancel Anytime" text="Change or cancel your plan anytime you want" tone="bg-emerald-100 text-emerald-700" />
        <TrustTile icon={Tag} title="No Hidden Charges" text="Transparent pricing with no hidden fees" tone="bg-sky-100 text-sky-700" />
        <TrustTile icon={CreditCard} title="24/7 Support" text="Get help whenever you need it" tone="bg-rose-100 text-rose-700" />
      </div>
    </section>
  );
}

function PlanUsageTile({ icon: Icon, label, value, progress, hint, tone, iconClass }) {
  return (
    <div className="border-slate-200 xl:border-r xl:px-5 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
        </div>
      </div>
      <div className="mt-4"><ProgressLine value={progress} tone={tone} /></div>
      <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function SubscriptionChangeModal({ preview, busy, onClose, onConfirm }) {
  const amountPayable = Number(preview.amountPayable || 0);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Subscription Change Preview</h3>
            <p className="mt-1 text-sm text-slate-500">Review the server-calculated credit before payment.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Close</button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Plan</p>
            <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{preview.currentPlan?.planName || "-"}</p>
            <p className="mt-1 text-sm capitalize text-slate-500">{String(preview.currentBillingCycle || "").replace(/_/g, " ")}</p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Remaining days: <span className="font-semibold">{preview.remainingDays}</span></p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Remaining credit: <span className="font-semibold">{formatCurrency(preview.remainingCredit || 0)}</span></p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">New Plan</p>
            <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{preview.targetPlan?.planName || "-"}</p>
            <p className="mt-1 text-sm capitalize text-slate-500">{String(preview.targetBillingCycle || "").replace(/_/g, " ")}</p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Plan price: <span className="font-semibold">{formatCurrency(preview.targetPrice || 0)}</span></p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Credit applied: <span className="font-semibold">{formatCurrency(preview.creditApplied || 0)}</span></p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final Amount Payable</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{formatCurrency(amountPayable)}</p>
              {Number(preview.creditToWallet || 0) > 0 ? <p className="mt-1 text-sm text-emerald-600">Wallet credit created: {formatCurrency(preview.creditToWallet)}</p> : null}
            </div>
            <button type="button" disabled={busy} onClick={onConfirm} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Processing..." : amountPayable > 0 ? `Pay ${formatCurrency(amountPayable)}` : "Confirm Change"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PremiumPlanCard({ plan, currentPlan = {}, billingCycle, currentBillingCycle = "monthly", isCurrent, busy, disabled, onSubscribe }) {
  const Icon = planIcon(plan);
  const tone = planTone(plan);
  const badgeText = plan.metadata?.cardBadge || (plan.metadata?.isMostPopular ? "Most Popular" : "");
  const price = planBillingPrice(plan, billingCycle);
  const customPricing = Boolean(plan.metadata?.customPricing);
  const sameCycle = isCurrent && billingCycle === currentBillingCycle;
  const currentRank = Number(currentPlan.displayOrder ?? currentPlan.monthlyPrice ?? 0);
  const targetRank = Number(plan.displayOrder ?? plan.monthlyPrice ?? 0);
  const hasCurrentPlan = Boolean(currentPlan?._id);
  const changeLabel = !hasCurrentPlan ? "Subscribe Now" : isCurrent ? "Upgrade Billing Cycle" : targetRank < currentRank || planBillingPrice(plan, billingCycle) < planBillingPrice(currentPlan, currentBillingCycle) ? "Downgrade Plan" : "Upgrade Plan";
  const ctaLabel = sameCycle ? "Current Plan" : plan.metadata?.ctaLabel || (customPricing ? "Contact Sales" : changeLabel);
  const chips = [
    plan.metadata?.isMostPopular ? "Most Popular" : "",
    customPricing ? "Custom Pricing" : "",
    plan.autoRenewAllowed ? "Auto Renew" : "",
    plan.allowAllTiers ? "All Tiers" : "",
    plan.prioritySupport ? "Priority" : "",
  ].filter(Boolean);

  return (
    <article className={`relative flex min-h-[465px] flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-slate-950 ${tone.ring}`}>
      {badgeText ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-100 px-4 py-1 text-xs font-semibold text-amber-800 shadow-sm">{badgeText}</span> : null}
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h4 className="text-lg font-semibold text-slate-950 dark:text-white">{plan.planName}</h4>
          <p className="mt-3 min-h-16 text-sm leading-6 text-slate-600 dark:text-slate-300">{planDescription(plan)}</p>
        </div>
      </div>

      {chips.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.icon}`}>{chip}</span>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {customPricing ? (
          <>
            <p className="text-2xl font-semibold text-slate-950 dark:text-white">{plan.metadata?.customPricingLabel || "Custom Pricing"}</p>
            <p className="mt-1 text-sm text-slate-500">{plan.metadata?.customPricingSubtext || "Contact for pricing"}</p>
          </>
        ) : (
          <p className="text-3xl font-semibold text-slate-950 dark:text-white">
            {formatCurrency(price)}
            <span className="text-sm font-medium text-slate-500"> / {billingCycleLabel(billingCycle)}</span>
          </p>
        )}
      </div>

      <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-200">
        {planBenefits(plan).map((benefit) => (
          <li key={benefit} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={sameCycle || disabled}
        onClick={() => !customPricing && onSubscribe(plan, billingCycle)}
        className={`mt-auto h-11 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-indigo-500 ${tone.button}`}
      >
        {sameCycle ? "Current Plan" : busy ? "Opening..." : ctaLabel}
      </button>
    </article>
  );
}

function TrustTile({ icon: Icon, title, text, tone }) {
  return (
    <div className="flex items-center gap-4 border-slate-200 xl:border-r xl:last:border-r-0 dark:border-slate-800">
      <span className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold text-slate-950 dark:text-white">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{text}</p>
      </div>
    </div>
  );
}

function DiscoverView({ rows, pagination, subscriptionData = {}, busyId, onSubscribe, onSave, onVisit, onInvite, onPage }) {
  const [expandedCards, setExpandedCards] = useState({});
  return (
    <div className="grid gap-5">
      <PremiumSubscriptionPlans data={subscriptionData} busyId={busyId} onSubscribe={onSubscribe} />

      <Section title="Influencer Discovery Marketplace" icon={Search}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const inviteBusy = busyId === `invite-${row.id}`;
          const saveBusy = busyId === `save-${row.id}`;
          const visitBusy = busyId === `visit-${row.id}`;
          const invited = row.status === "invited" || row.status === "approved" || row.status === "active";
          const rateCard = Array.isArray(row.rateCard) ? row.rateCard : Array.isArray(row.services) ? row.services : [];
          const pricedServices = rateCard.filter((service) => serviceStartingPrice(service) > 0);
          const startingRate = Number(row.startingRate || (pricedServices.length ? Math.min(...pricedServices.map((service) => serviceStartingPrice(service))) : 0));
          const cardKey = String(row.id || row._id);
          const expanded = Boolean(expandedCards[cardKey]);
          const visibleServices = expanded ? rateCard : rateCard.slice(0, 2);
          return (
            <article key={row.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {row.profilePicture ? <img src={resolveApiAssetUrl(row.profilePicture)} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-950 dark:text-white">{row.name}</h3>
                  <p className="truncate text-sm text-slate-500">@{row.username}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {row.verified ? <ShieldCheck className="h-5 w-5 text-emerald-500" aria-label="Verified" /> : null}
                  {row.status ? <StatusBadge value={row.status} /> : null}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <MetricTile label="Followers" value={numberValue(row.followers)} />
                <MetricTile label="Engage" value={percentValue(row.engagementRate)} />
                <MetricTile label="Convert" value={percentValue(row.conversionRate)} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <MetricTile label="Score" value={numberValue(row.influencerScore)} />
                <MetricTile label="Rating" value={Number(row.rating || 0).toFixed(1)} />
                <MetricTile label="Complete" value={percentValue(row.completionRate)} />
              </div>
              <p className="mt-3 min-h-10 text-sm text-slate-600 dark:text-slate-300">{row.category || "General"} - {(row.languages || []).join(", ") || "Any language"}</p>
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">Starting Rate</span>
                  <span className="font-semibold text-slate-950 dark:text-white">{startingRate ? formatCurrency(startingRate) : "Rate on request"}</span>
                </div>
                {visibleServices.length ? (
                  <div className="space-y-2">
                    {visibleServices.map((service) => (
                      <div key={service._id || service.id || service.serviceName} className="rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{service.serviceName || service.label || service.serviceTypeKey}</span>
                          <span className="text-slate-500">{service.minimumNoticePeriod ? `${service.minimumNoticePeriod}d notice` : ""}</span>
                        </div>
                        <div className="mt-1 space-y-1">
                          {servicePackages(service).slice(0, expanded ? 6 : 2).map((pkg) => (
                            <div key={packageKey(service, pkg)} className="flex items-center justify-between gap-2 text-slate-500">
                              <span className="truncate">{pkg.packageName || "Package"} · {Number(pkg.quantity || 1)}x · {pkg.deliveryDays ?? service.deliveryDays ?? 0}d</span>
                              <b className="shrink-0 text-slate-800 dark:text-slate-100">{packagePrice(pkg, service) ? formatCurrency(packagePrice(pkg, service)) : "Request"}</b>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {rateCard.length > 2 ? (
                      <button type="button" onClick={() => setExpandedCards((current) => ({ ...current, [cardKey]: !expanded }))} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                        {expanded ? "Show less" : `Show ${rateCard.length - 2} more`}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {row.requirements?.minimumAttributionDays ? <p className="text-slate-500">Minimum attribution: {row.requirements.minimumAttributionDays} days</p> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={inviteBusy} onClick={() => onInvite(row)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"><Send className="h-3.5 w-3.5" />{invited ? "Invite Again" : "Invite"}</button>
                <button type="button" disabled={visitBusy} onClick={() => onVisit(row)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"><Eye className="h-3.5 w-3.5" />{row.visited ? "Visit Again" : "View"}</button>
                <button type="button" disabled={saveBusy} onClick={() => onSave(row)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"><Star className="h-3.5 w-3.5" />{row.saved ? "Saved" : "Save"}</button>
              </div>
            </article>
          );
        })}
        {!rows.length ? <EmptyState message="No influencers match the current filters." /> : null}
        </div>
        <Pagination pagination={pagination} onPage={onPage} />
      </Section>
    </div>
  );
}

function Pagination({ pagination, onPage }) {
  if (!pagination || Number(pagination.pages || 1) <= 1) return null;
  const page = Number(pagination.page || 1);
  const pages = Number(pagination.pages || 1);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <span>{numberValue(pagination.total)} creators</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700">Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700">Next</button>
      </div>
    </div>
  );
}

function MetricTile({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950"><span className="block text-slate-500">{label}</span><b className="text-slate-950 dark:text-white">{value}</b></div>;
}

function RelationshipsView({ rows, pagination, busyId, onStatus, onInvite, onPage }) {
  return (
    <Section title="Influencer Relationship Management" icon={Users}>
      <ResponsiveTable
        headers={["Influencer", "Status", "Category", "Active Campaigns", "Revenue", "Commission", "Conversion", "Last Activity", "Actions"]}
        rows={rows}
        renderRow={(row) => {
          const isBusy = busyId === row.influencerId || busyId === `invite-${row.influencerId}`;
          const isActive = row.status === "active" || row.status === "approved";
          const isPaused = row.status === "paused";
          return (
            <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{row.name}<div className="text-xs font-normal text-slate-500">@{row.username}</div></td>
              <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
              <td className="px-3 py-3">{row.category || "-"}</td>
              <td className="px-3 py-3">{row.activeCampaigns}</td>
              <td className="px-3 py-3">{formatCurrency(row.revenueGenerated || 0)}</td>
              <td className="px-3 py-3">{formatCurrency(row.commissionPaid || 0)}</td>
              <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
              <td className="px-3 py-3">{row.lastActivity ? new Date(row.lastActivity).toLocaleDateString() : "-"}</td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <button disabled={isBusy} onClick={() => onInvite(row)} className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Invite</button>
                  <button disabled={isBusy || isActive} onClick={() => onStatus(row, "active")} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/50 dark:text-emerald-300">{isActive ? "Active" : "Activate"}</button>
                  <button disabled={isBusy || isPaused} onClick={() => onStatus(row, "paused")} className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900/50 dark:text-amber-300">{isPaused ? "Paused" : "Pause"}</button>
                </div>
              </td>
            </tr>
          );
        }}
      />
      <Pagination pagination={pagination} onPage={onPage} />
    </Section>
  );
}

function CampaignsView({ campaigns, pagination, products, influencers, configuration, selectedInfluencerId = "", selectedProductIds = [], busyId, onPage, onCreate, onReview, onStatus, onDelete }) {
  async function confirmDelete(campaign) {
    const title = campaign.title || "this campaign";
    if (await confirmAction({ message: `Delete "${title}"? This is only allowed before applications, content, or commissions exist.`, tone: "danger", confirmLabel: "Confirm" })) {
      onDelete(campaign);
    }
  }

  return (
    <div className="grid gap-5">
      <Section title="Create Campaign" icon={Megaphone}>
        <CampaignForm influencers={influencers} products={products} configuration={configuration} initialInfluencerId={selectedInfluencerId} initialProductIds={selectedProductIds} onCreate={onCreate} busy={busyId === "create-campaign"} />
      </Section>
      <Section title="Campaign Management" icon={Megaphone}>
        <ResponsiveTable
          headers={["Campaign", "Budget", "Revenue", "Orders", "Applications", "Approved Creators", "Status", "Actions"]}
          rows={campaigns}
          renderRow={(campaign) => (
            (() => {
              const canDelete = campaign.canDelete === true;
              const deleteReason = campaign.deleteDisabledReason || "Delete is enabled only before applications, content, commissions, and sales attribution exist.";
              const state = String(campaign.state || "");
              const isBusy = busyId === campaign._id;
              const isActive = state === "active";
              const isCancelled = state === "cancelled";
              const isCompleted = state === "completed";
              const isTerminal = isCancelled || isCompleted;
              const paymentModel = campaign.paymentModel || campaign.paymentModelSnapshot || {};
              const attributionRule = campaign.attributionRule || {};
              const pricing = campaign.pricing || paymentModel.pricing || {};
              const budgetValue = pricing.totalBudget || campaign.budget || campaign.fixedFee || 0;
              const paymentLabel = paymentModel.label || statusText(campaign.paymentType || paymentModel.type);
              const attributionDays = attributionRule.attributionDays || campaign.attributionWindowDays;
              return (
                <tr key={campaign._id} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                    {campaign.title || "Campaign"}
                    <div className="text-xs font-normal capitalize text-slate-500">{statusText(campaign.campaignType)} - {paymentLabel || "Payment model"}</div>
                  </td>
                  <td className="px-3 py-3">
                    {formatCurrency(budgetValue)}
                    {attributionDays ? <div className="text-xs text-slate-500">{attributionDays} day attribution</div> : null}
                  </td>
                  <td className="px-3 py-3">{formatCurrency(campaign.revenue || campaign.analytics?.revenue || 0)}</td>
                  <td className="px-3 py-3">{numberValue(campaign.orders || campaign.analytics?.orders || 0)}</td>
                  <td className="px-3 py-3">{campaign.applicationsCount || campaign.applications?.length || 0}</td>
                  <td className="px-3 py-3">{campaign.approvedCreators || 0}</td>
                  <td className="px-3 py-3"><StatusBadge value={campaign.state} /></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button disabled={isBusy || isActive || isCompleted} onClick={() => onStatus(campaign, "activate")} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/50 dark:text-emerald-300">{isActive ? "Active" : "Activate"}</button>
                      <button disabled={isBusy || isTerminal} onClick={() => onStatus(campaign, "pause")} className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900/50 dark:text-amber-300">{isCancelled ? "Cancelled" : "Pause"}</button>
                      <button disabled={isBusy || isCompleted} onClick={() => onStatus(campaign, "close")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700">{isCompleted ? "Closed" : "Close"}</button>
                      <button
                        disabled={!canDelete || busyId === `delete-${campaign._id}`}
                        title={canDelete ? "Delete campaign" : deleteReason}
                        onClick={() => confirmDelete(campaign)}
                        className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:opacity-60 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30 dark:disabled:border-slate-800 dark:disabled:text-slate-600"
                      >
                        Delete
                      </button>
                    </div>
                    {!canDelete ? <p className="mt-2 max-w-xs text-xs text-slate-500">{deleteReason}</p> : null}
                    {(campaign.applications || []).length ? (
                      <div className="mt-3 space-y-2">
                        {(campaign.applications || []).map((application) => {
                          const applicationInfluencerId = String(application.influencerId?._id || application.influencerId);
                          const applicationBusy = busyId === `${campaign._id}-${applicationInfluencerId}`;
                          const isApproved = application.status === "approved";
                          const isRejected = application.status === "rejected";
                          return (
                            <div key={applicationInfluencerId} className="flex flex-wrap items-center gap-2 text-xs">
                              <StatusBadge value={application.status} />
                              <button disabled={applicationBusy || isApproved || isTerminal} onClick={() => onReview(campaign, { ...application, influencerId: applicationInfluencerId }, "approve")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-3 w-3" />{isApproved ? "Approved" : "Approve"}</button>
                              <button disabled={applicationBusy || isRejected || isTerminal} onClick={() => onReview(campaign, { ...application, influencerId: applicationInfluencerId }, "reject")} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><XCircle className="h-3 w-3" />{isRejected ? "Rejected" : "Reject"}</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })()
          )}
        />
        <Pagination pagination={pagination} onPage={onPage} />
      </Section>
    </div>
  );
}

function ProductsView({ rows, pagination, title, onPage, onPromote, onEdit }) {
  return (
    <Section title={title} icon={Package}>
      <ResponsiveTable
        headers={["Product", "Status", "Stock", "Promoted", "Campaigns", "Influencers", "Clicks", "Orders", "Revenue", "Commission", "Conversion", "Actions"]}
        rows={rows}
        renderRow={(row) => (
          <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="max-w-sm px-3 py-3 font-semibold text-slate-950 dark:text-white">
              <span className="block truncate" title={row.name}>{shortText(row.name, 88)}</span>
              <div className="text-xs font-normal text-slate-500">{row.category || "-"} {row.price ? `- ${formatCurrency(row.price)}` : ""}</div>
            </td>
            <td className="px-3 py-3"><StatusBadge value={row.status || (row.available ? "approved" : "inactive")} /></td>
            <td className="px-3 py-3">{numberValue(row.stock)}</td>
            <td className="px-3 py-3">{row.promoted ? "Yes" : "No"}</td>
            <td className="px-3 py-3">{numberValue(row.campaignCount ?? row.activeCampaigns)}</td>
            <td className="px-3 py-3">{numberValue(row.influencers)}</td>
            <td className="px-3 py-3">{numberValue(row.clicks)}</td>
            <td className="px-3 py-3">{numberValue(row.orders)}</td>
            <td className="px-3 py-3">{formatCurrency(row.revenue || 0)}</td>
            <td className="px-3 py-3">{formatCurrency(row.commission || 0)}</td>
            <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
            <td className="px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onPromote(row)} className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white">{row.promoted ? "New Campaign" : "Promote"}</button>
                <button type="button" onClick={() => onEdit(row)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Edit</button>
              </div>
            </td>
          </tr>
        )}
      />
      <Pagination pagination={pagination} onPage={onPage} />
    </Section>
  );
}

function ContentView({ rows, pagination, busyId, onPage, onReview, onView }) {
  return (
    <Section title="Content Approvals" icon={FileCheck2}>
      <ResponsiveTable
        headers={["Creator", "Campaign", "Content", "Type", "Metrics", "Submitted", "Status", "Actions"]}
        rows={rows}
        renderRow={(row) => {
          const state = String(row.status || "").toLowerCase();
          const isBusy = busyId === row.id;
          const isApproved = ["approved", "published"].includes(state);
          const isRejected = state === "rejected";
          const isPending = ["uploaded", "pending_review"].includes(state);
          const metrics = row.metrics || {};
          const productNames = (row.products || []).map((product) => product.name).filter(Boolean);
          return (
            <tr key={row.id} className="border-t border-slate-100 align-top dark:border-slate-800">
              <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                {row.creatorName || "Creator"}
                <div className="text-xs font-normal text-slate-500">@{row.creatorUsername || row.creatorEmail || "creator"}</div>
              </td>
              <td className="px-3 py-3">{row.campaign?.title || "-"}</td>
              <td className="max-w-xs px-3 py-3 font-semibold text-slate-950 dark:text-white">
                <span className="block truncate" title={row.title}>{shortText(row.title, 60)}</span>
                <div className="mt-1 text-xs font-normal text-slate-500" title={productNames.join(", ")}>
                  {productNames.length ? shortText(productNames.join(", "), 58) : "No product tagged"}
                </div>
              </td>
              <td className="px-3 py-3 capitalize">{statusText(row.contentType)}</td>
              <td className="px-3 py-3">
                <div className="grid min-w-32 grid-cols-3 gap-1 text-xs">
                  <MetricTile label="Views" value={numberValue(metrics.views)} />
                  <MetricTile label="Clicks" value={numberValue(metrics.clicks)} />
                  <MetricTile label="Orders" value={numberValue(metrics.orders)} />
                </div>
              </td>
              <td className="px-3 py-3">{row.submittedDate ? new Date(row.submittedDate).toLocaleDateString() : "-"}</td>
              <td className="px-3 py-3"><StatusBadge value={row.status} /></td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!row.url} onClick={() => onView(row)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">View</button>
                  <button type="button" disabled={isBusy || isApproved} onClick={() => onReview(row, "approve")} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isApproved ? "Approved" : "Approve"}</button>
                  <button type="button" disabled={isBusy || !isPending} onClick={() => onReview(row, "changes")} className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900/50 dark:text-amber-300">Changes</button>
                  <button type="button" disabled={isBusy || isRejected} onClick={() => onReview(row, "reject")} className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isRejected ? "Rejected" : "Reject"}</button>
                </div>
              </td>
            </tr>
          );
        }}
      />
      <Pagination pagination={pagination} onPage={onPage} />
    </Section>
  );
}

function PerformanceView({ rows, summary = {}, pagination, busyId, onPage, onCampaign }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Creators" value={numberValue(summary.creators || rows.length)} />
        <Metric label="Revenue" value={formatCurrency(summary.revenue || 0)} />
        <Metric label="Commission" value={formatCurrency(summary.commission || 0)} />
        <Metric label="Clicks" value={numberValue(summary.clicks)} />
        <Metric label="Orders" value={numberValue(summary.orders)} />
      </div>
      <Section title="Performance Intelligence" icon={LineChart}>
        <ResponsiveTable
          headers={["Rank", "Creator", "Status", "Category", "Revenue", "Commission", "Orders", "Clicks", "Conversions", "CTR", "ROI", "Engagement", "AOV", "Actions"]}
          rows={rows}
          renderRow={(row) => {
            return (
              <tr key={row.influencerId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-semibold">#{row.rank || "-"}</td>
                <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                  {row.name}
                  <div className="text-xs font-normal text-slate-500">@{row.username}</div>
                </td>
                <td className="px-3 py-3"><StatusBadge value={row.status || "tracked"} /></td>
                <td className="px-3 py-3">{row.category || "-"}</td>
                <td className="px-3 py-3">{formatCurrency(row.revenueGenerated || 0)}</td>
                <td className="px-3 py-3">{formatCurrency(row.commissionPaid || 0)}</td>
                <td className="px-3 py-3">{numberValue(row.ordersGenerated)}</td>
                <td className="px-3 py-3">{numberValue(row.clicks)}</td>
                <td className="px-3 py-3">{numberValue(row.conversions)}</td>
                <td className="px-3 py-3">{percentValue(row.ctr)}</td>
                <td className="px-3 py-3">{percentValue(row.roi)}</td>
                <td className="px-3 py-3">{numberValue(row.engagement)}</td>
                <td className="px-3 py-3">{formatCurrency(row.averageOrderValue || 0)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onCampaign(row)} className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white">Campaign</button>
                  </div>
                </td>
              </tr>
            );
          }}
        />
        <Pagination pagination={pagination} onPage={onPage} />
      </Section>
    </div>
  );
}

function AnalyticsView({ analytics = {} }) {
  const kpis = analytics.kpis || {};
  const charts = analytics.charts || {};
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Revenue" value={formatCurrency(kpis.campaignRevenue || 0)} />
        <Metric label="Spend" value={formatCurrency(kpis.campaignSpend || 0)} />
        <Metric label="ROI" value={percentValue(kpis.roi)} />
        <Metric label="Commission Paid" value={formatCurrency(kpis.commissionPaid || 0)} />
        <Metric label="Orders" value={numberValue(kpis.orders)} />
        <Metric label="Clicks" value={numberValue(kpis.clicks)} />
        <Metric label="Conversion Rate" value={percentValue(kpis.conversionRate)} />
        <Metric label="Average Order" value={formatCurrency(kpis.averageOrderValue || 0)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title="Revenue Trend" icon={BarChart3}><SimpleBars rows={charts.revenueTrend || []} valueKey="revenue" /></Section>
        <Section title="Commission Trend" icon={LineChart}><SimpleBars rows={charts.commissionTrend || []} valueKey="commission" /></Section>
        <Section title="Click Trend" icon={BarChart3}><SimpleBars rows={charts.clickTrend || []} valueKey="clicks" /></Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Conversion Funnel" icon={BarChart3}>
          <ResponsiveTable
            headers={["Stage", "Value"]}
            rows={charts.conversionFunnel || []}
            renderRow={(row) => (
              <tr key={row.label} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{row.label}</td>
                <td className="px-3 py-3">{String(row.label || "").toLowerCase().includes("commission") ? formatCurrency(row.value || 0) : numberValue(row.value)}</td>
              </tr>
            )}
          />
        </Section>
        <MiniTable title="Traffic Sources" icon={LineChart} rows={charts.trafficSources || []} columns={["source", "clicks"]} />
      </div>
      <Section title="Campaign Comparison" icon={Megaphone}>
        <ResponsiveTable
          headers={["Campaign", "Status", "Revenue", "Commission", "Orders", "Clicks", "Conversion"]}
          rows={charts.campaignComparison || []}
          renderRow={(row) => (
            <tr key={row.id || row.title} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{row.title || "Campaign"}</td>
              <td className="px-3 py-3"><StatusBadge value={row.state || "tracked"} /></td>
              <td className="px-3 py-3">{formatCurrency(row.revenue || 0)}</td>
              <td className="px-3 py-3">{formatCurrency(row.commission || 0)}</td>
              <td className="px-3 py-3">{numberValue(row.orders)}</td>
              <td className="px-3 py-3">{numberValue(row.clicks)}</td>
              <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
            </tr>
          )}
        />
      </Section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Top Products" icon={Package}>
          <ResponsiveTable
            headers={["Product", "Revenue", "Commission", "Orders", "Clicks", "Conversion"]}
            rows={charts.productPerformance || []}
            renderRow={(row) => (
              <tr key={row.id || row.name} className="border-t border-slate-100 dark:border-slate-800">
                <td className="max-w-sm px-3 py-3 font-semibold text-slate-950 dark:text-white">
                  <span className="block truncate" title={row.name}>{shortText(row.name, 72)}</span>
                  <div className="text-xs font-normal text-slate-500">{row.category || "-"}</div>
                </td>
                <td className="px-3 py-3">{formatCurrency(row.revenue || 0)}</td>
                <td className="px-3 py-3">{formatCurrency(row.commission || 0)}</td>
                <td className="px-3 py-3">{numberValue(row.orders)}</td>
                <td className="px-3 py-3">{numberValue(row.clicks)}</td>
                <td className="px-3 py-3">{percentValue(row.conversionRate)}</td>
              </tr>
            )}
          />
        </Section>
        <Section title="Top Creators" icon={Users}>
          <ResponsiveTable
            headers={["Creator", "Revenue", "Commission", "Orders", "Clicks", "ROI"]}
            rows={charts.creatorPerformance || []}
            renderRow={(row) => (
              <tr key={row.influencerId || row.name} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                  {row.name || "Creator"}
                  <div className="text-xs font-normal text-slate-500">@{row.username || "creator"}</div>
                </td>
                <td className="px-3 py-3">{formatCurrency(row.revenueGenerated || 0)}</td>
                <td className="px-3 py-3">{formatCurrency(row.commissionPaid || 0)}</td>
                <td className="px-3 py-3">{numberValue(row.ordersGenerated)}</td>
                <td className="px-3 py-3">{numberValue(row.clicks)}</td>
                <td className="px-3 py-3">{percentValue(row.roi)}</td>
              </tr>
            )}
          />
        </Section>
      </div>
    </div>
  );
}

function LeaderboardView({ rows, summary = {}, pagination, busyId, onPage, onInvite, onCampaign }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Ranked Creators" value={numberValue(summary.creators || rows.length)} />
        <Metric label="Revenue" value={formatCurrency(summary.revenue || 0)} />
        <Metric label="Commission" value={formatCurrency(summary.commission || 0)} />
        <Metric label="Clicks" value={numberValue(summary.clicks)} />
        <Metric label="Orders" value={numberValue(summary.orders)} />
      </div>
      <Section title="Creator Leaderboard" icon={Medal}>
        <ResponsiveTable
          headers={["Rank", "Creator", "Status", "Category", "Revenue", "Commission", "Clicks", "Conversions", "Engagement", "ROI", "Score", "Actions"]}
          rows={rows}
          renderRow={(row) => {
            const inviteBusy = busyId === `invite-${row.influencerId}`;
            return (
              <tr key={row.influencerId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-semibold">#{row.rank}</td>
                <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                  {row.creator || row.name}
                  <div className="text-xs font-normal text-slate-500">@{row.username || "creator"}</div>
                </td>
                <td className="px-3 py-3"><StatusBadge value={row.status || "tracked"} /></td>
                <td className="px-3 py-3">{row.category || "-"}</td>
                <td className="px-3 py-3">{formatCurrency(row.revenueGenerated || 0)}</td>
                <td className="px-3 py-3">{formatCurrency(row.commissionPaid || 0)}</td>
                <td className="px-3 py-3">{numberValue(row.clicks)}</td>
                <td className="px-3 py-3">{numberValue(row.conversions)}</td>
                <td className="px-3 py-3">{numberValue(row.engagement)}</td>
                <td className="px-3 py-3">{percentValue(row.roi)}</td>
                <td className="px-3 py-3">{numberValue(row.score)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={inviteBusy} onClick={() => onInvite(row)} className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Invite</button>
                    <button type="button" onClick={() => onCampaign(row)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Campaign</button>
                  </div>
                </td>
              </tr>
            );
          }}
        />
        <Pagination pagination={pagination} onPage={onPage} />
      </Section>
    </div>
  );
}

function ReportsView({ reports = {} }) {
  return (
    <div className="grid gap-5">
      <Section title="Reporting Center" icon={Download}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(reports.reports || []).map((report) => (
            <article key={report.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">{report.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{numberValue(report.rows)} rows available</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(report.exportFormats || []).map((format) => <button key={format} type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase dark:border-slate-700">{format}</button>)}
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Section title="Scheduling" icon={FileCheck2}>
        <div className="grid gap-3 md:grid-cols-3">
          {(reports.schedules || []).map((schedule) => <label key={schedule.frequency} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm font-semibold capitalize dark:border-slate-800"><span>{schedule.frequency}</span><input type="checkbox" defaultChecked={schedule.enabled} /></label>)}
        </div>
      </Section>
    </div>
  );
}

function ResponsiveTable({ headers, rows, renderRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
        </thead>
        <tbody className="text-slate-700 dark:text-slate-200">
          {rows.map(renderRow)}
          {!rows.length ? <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={headers.length}>No records found.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">{message}</div>;
}

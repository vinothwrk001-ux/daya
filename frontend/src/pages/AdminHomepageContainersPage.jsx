import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  GripVertical,
  LayoutTemplate,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Tablet,
} from "lucide-react";
import { AsyncMultiSelect } from "../components/AsyncMultiSelect";
import {
  createAdminHomepageContainer,
  deleteAdminHomepageContainer,
  getHomepageContainerSchema,
  getHomepageContainerSchemas,
  listAdminHomepageContainers,
  previewAdminHomepageContainer,
  reorderAdminHomepageContainers,
  uploadHomepageContainerMedia,
  updateAdminHomepageContainer,
} from "../services/homepageContainerService";
import { listCategories, listProducts, listSellers, listSubcategories } from "../services/adminApi";
import { formatCurrency } from "../utils/formatCurrency";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

const defaultLayout = {
  widthType: "boxed",
  customWidth: 1400,
  heightType: "auto",
  customHeight: 450,
  alignment: "center",
  positionX: 0,
  positionY: 0,
  padding: 24,
  marginTop: 16,
  marginBottom: 16,
  marginLeft: 0,
  marginRight: 0,
  backgroundType: "solid",
  backgroundColor: "#ffffff",
  gradientColor1: "#fff7ed",
  gradientColor2: "#fde68a",
  gradientDirection: "to right",
  backgroundImage: "",
  backgroundVideo: "",
  theme: "default",
  animation: "fadeUp",
};

const initialForm = {
  title: "",
  slug: "",
  description: "",
  containerType: "CAROUSEL",
  priority: 0,
  status: "DRAFT",
  scheduleStart: "",
  scheduleEnd: "",
  desktopVisible: true,
  tabletVisible: true,
  mobileVisible: true,
  layout: defaultLayout,
  filters: {
    vendorIds: [],
    categoryIds: [],
    subCategoryIds: [],
    brandIds: [],
    tags: [],
    minPrice: "",
    maxPrice: "",
    minDiscountPercentage: 0,
    minimumRating: 0,
    showOnlyInStock: true,
    sortBy: "TRENDING",
    maxProductsToShow: 12,
    productSelectionMode: "AUTO",
    manualProductIds: [],
  },
  config: {},
};

const editorSteps = [
  { id: "setup", number: 1, title: "Container Setup", description: "Name, classify, and schedule the container." },
  { id: "rules", number: 2, title: "Product Rules", description: "Choose products and type-specific content rules." },
  { id: "designer", number: 3, title: "Visual Designer", description: "Tune layout, spacing, background, and visibility." },
  { id: "preview", number: 4, title: "Preview", description: "Validate the final render and publish." },
];

const deviceOptions = [
  { value: "desktop", label: "Desktop", icon: Monitor, widthClassName: "w-full" },
  { value: "tablet", label: "Tablet", icon: Tablet, widthClassName: "mx-auto w-[82%]" },
  { value: "mobile", label: "Mobile", icon: Smartphone, widthClassName: "mx-auto w-[56%] min-w-[220px]" },
];

const sectionCardClassName = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const inputClassName =
  "min-h-[52px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800/70";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function legacyWidthType(value) {
  switch (String(value || "").toLowerCase()) {
    case "boxed":
    case "wide":
    case "content":
    case "medium":
      return "boxed";
    case "narrow":
      return "narrow";
    case "full":
    case "screen":
      return "full";
    default:
      return "custom";
  }
}

function legacyHeightType(value) {
  const raw = String(value || "").toLowerCase();
  if (!raw || raw === "auto") return "auto";
  const numeric = pickNumber(String(raw).replace(/[^\d.-]/g, ""), 0);
  if (numeric <= 250) return "small";
  if (numeric <= 450) return "medium";
  if (numeric <= 650) return "large";
  return "custom";
}

function normalizeLayoutForm(layout = {}, presentation = {}) {
  const widthValue = presentation?.containerWidth || "";
  const heightValue = presentation?.containerHeight || "";
  const offsetX = presentation?.containerOffsetX || 0;
  const offsetY = presentation?.containerOffsetY || 0;
  const backgroundType =
    layout?.backgroundType ||
    (layout?.backgroundVideo ? "video" : layout?.backgroundImage ? "image" : layout?.gradientColor1 || layout?.gradientColor2 ? "gradient" : "solid");

  return {
    ...defaultLayout,
    ...layout,
    widthType: layout?.widthType || legacyWidthType(widthValue || defaultLayout.widthType),
    customWidth: pickNumber(layout?.customWidth ?? String(widthValue).replace(/[^\d.-]/g, ""), defaultLayout.customWidth),
    heightType: layout?.heightType || legacyHeightType(heightValue || defaultLayout.heightType),
    customHeight: pickNumber(layout?.customHeight ?? String(heightValue).replace(/[^\d.-]/g, ""), defaultLayout.customHeight),
    positionX: pickNumber(layout?.positionX ?? String(offsetX).replace(/[^\d.-]/g, ""), 0),
    positionY: pickNumber(layout?.positionY ?? String(offsetY).replace(/[^\d.-]/g, ""), 0),
    padding: pickNumber(layout?.padding, defaultLayout.padding),
    marginTop: pickNumber(layout?.marginTop, defaultLayout.marginTop),
    marginBottom: pickNumber(layout?.marginBottom, defaultLayout.marginBottom),
    marginLeft: pickNumber(layout?.marginLeft, defaultLayout.marginLeft),
    marginRight: pickNumber(layout?.marginRight, defaultLayout.marginRight),
    backgroundType,
    backgroundColor: layout?.backgroundColor || presentation?.backgroundColor || defaultLayout.backgroundColor,
    gradientColor1: layout?.gradientColor1 || defaultLayout.gradientColor1,
    gradientColor2: layout?.gradientColor2 || defaultLayout.gradientColor2,
    gradientDirection: layout?.gradientDirection || defaultLayout.gradientDirection,
    backgroundImage: layout?.backgroundImage || "",
    backgroundVideo: layout?.backgroundVideo || "",
    theme: layout?.theme || defaultLayout.theme,
    animation: layout?.animation || defaultLayout.animation,
  };
}

function buildPayload(form) {
  return {
    title: form.title,
    slug: form.slug || slugify(form.title),
    description: form.description,
    containerType: form.containerType,
    priority: Number(form.priority || 0),
    status: form.status,
    scheduleStart: form.scheduleStart || null,
    scheduleEnd: form.scheduleEnd || null,
    desktopVisible: Boolean(form.desktopVisible),
    tabletVisible: Boolean(form.tabletVisible),
    mobileVisible: Boolean(form.mobileVisible),
    layout: {
      ...defaultLayout,
      ...form.layout,
      customWidth: Number(form.layout.customWidth || defaultLayout.customWidth),
      customHeight: Number(form.layout.customHeight || defaultLayout.customHeight),
      positionX: Number(form.layout.positionX || 0),
      positionY: Number(form.layout.positionY || 0),
      padding: Number(form.layout.padding || 0),
      marginTop: Number(form.layout.marginTop || 0),
      marginBottom: Number(form.layout.marginBottom || 0),
      marginLeft: Number(form.layout.marginLeft || 0),
      marginRight: Number(form.layout.marginRight || 0),
    },
    filters: {
      vendorIds: form.filters.vendorIds,
      categoryIds: form.filters.categoryIds,
      subCategoryIds: form.filters.subCategoryIds,
      brandIds: form.filters.brandIds,
      tags: form.filters.tags,
      minPrice: form.filters.minPrice === "" ? null : Number(form.filters.minPrice),
      maxPrice: form.filters.maxPrice === "" ? null : Number(form.filters.maxPrice),
      minDiscountPercentage: Number(form.filters.minDiscountPercentage || 0),
      minimumRating: Number(form.filters.minimumRating || 0),
      showOnlyInStock: Boolean(form.filters.showOnlyInStock),
      sortBy: form.filters.sortBy,
      maxProductsToShow: Number(form.filters.maxProductsToShow || 12),
      productSelectionMode: form.filters.productSelectionMode,
      manualProductIds: form.filters.manualProductIds,
    },
    config: sanitizeConfigValues(form.config),
  };
}

function sanitizeConfigValues(config = {}) {
  const next = {};
  for (const [key, value] of Object.entries(config || {})) {
    if (value === "") {
      next[key] = value;
      continue;
    }
    if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
      try {
        next[key] = JSON.parse(value);
        continue;
      } catch {
        next[key] = value;
        continue;
      }
    }
    next[key] = value;
  }
  return next;
}

function containerToForm(container, schema) {
  const config = {};
  for (const field of schema?.typeFields || []) {
    const value = container?.config?.[field.name];
    if (field.type === "array") {
      config[field.name] = value ? JSON.stringify(value, null, 2) : "[]";
    } else {
      config[field.name] = value ?? field.defaultValue ?? "";
    }
  }

  return {
    title: container.title || "",
    slug: container.slug || "",
    description: container.description || "",
    containerType: container.containerType || "CAROUSEL",
    priority: container.priority ?? 0,
    status: container.status || "DRAFT",
    scheduleStart: container?.schedule?.start ? new Date(container.schedule.start).toISOString().slice(0, 16) : "",
    scheduleEnd: container?.schedule?.end ? new Date(container.schedule.end).toISOString().slice(0, 16) : "",
    desktopVisible: container?.visibility?.desktop !== false,
    tabletVisible: container?.visibility?.tablet !== false,
    mobileVisible: container?.visibility?.mobile !== false,
    layout: normalizeLayoutForm(container?.presentation?.layout, container?.presentation),
    filters: {
      vendorIds: (container?.filters?.vendorIds || []).map((item) => item?._id || item),
      categoryIds: (container?.filters?.categoryIds || []).map((item) => item?._id || item),
      subCategoryIds: (container?.filters?.subCategoryIds || []).map((item) => item?._id || item),
      brandIds: container?.filters?.brandIds || [],
      tags: container?.filters?.tags || [],
      minPrice: container?.filters?.minPrice ?? "",
      maxPrice: container?.filters?.maxPrice ?? "",
      minDiscountPercentage: container?.filters?.minDiscountPercentage ?? 0,
      minimumRating: container?.filters?.minimumRating ?? 0,
      showOnlyInStock: container?.filters?.showOnlyInStock !== false,
      sortBy: container?.filters?.sortBy || "TRENDING",
      maxProductsToShow: container?.filters?.maxProductsToShow ?? 12,
      productSelectionMode: container?.filters?.productSelectionMode || "AUTO",
      manualProductIds: (container?.filters?.manualProductIds || []).map((item) => item?._id || item),
    },
    config,
  };
}

export function AdminHomepageContainersPage() {
  const [containers, setContainers] = useState([]);
  const [containerSchemas, setContainerSchemas] = useState([]);
  const [activeSchema, setActiveSchema] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [draggedId, setDraggedId] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const [form, setForm] = useState(initialForm);

  const productCatalog = useMemo(
    () =>
      products.map((product) => ({
        value: String(product._id),
        label: product.name,
        meta: `${formatCurrency(product.discountPrice || product.price || 0)} • ${product.category || "General"}`,
      })),
    [products]
  );

  const brandCatalog = useMemo(() => {
    const brandSet = new Set();
    for (const product of products) {
      const value = product?.attributes?.brand || product?.brand;
      if (value) brandSet.add(String(value));
    }
    return Array.from(brandSet)
      .sort((a, b) => a.localeCompare(b))
      .map((item) => ({ value: item, label: item }));
  }, [products]);

  const tagCatalog = useMemo(() => {
    const tagSet = new Set();
    for (const product of products) {
      for (const tag of product?.tags || []) {
        tagSet.add(String(tag));
      }
    }
    return Array.from(tagSet)
      .sort((a, b) => a.localeCompare(b))
      .map((item) => ({ value: item, label: item }));
  }, [products]);

  const selectedCategorySet = useMemo(() => new Set(form.filters.categoryIds.map(String)), [form.filters.categoryIds]);

  const filteredSubcategories = useMemo(
    () =>
      subcategories.filter((item) => {
        if (!selectedCategorySet.size) return true;
        const categoryId = item.categoryId?._id || item.categoryId;
        return selectedCategorySet.has(String(categoryId));
      }),
    [selectedCategorySet, subcategories]
  );

  const loadSchemaForType = useCallback(async (type) => {
    const response = await getHomepageContainerSchema(type);
    setActiveSchema(response?.data || null);
    return response?.data || null;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listAdminHomepageContainers({ limit: 100 });
      setContainers(response?.data?.containers || []);
      setAnalyticsSummary(response?.data?.analyticsSummary || null);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [schemaRes, vendorsRes, categoriesRes, subcategoriesRes, productsRes] = await Promise.all([
        getHomepageContainerSchemas(),
        listSellers({ status: "approved" }),
        listCategories(),
        listSubcategories(),
        listProducts({ limit: 200, status: "APPROVED" }),
      ]);

      setContainerSchemas(schemaRes?.data || []);
      setVendors(Array.isArray(vendorsRes?.data) ? vendorsRes.data : []);
      setCategories(Array.isArray(categoriesRes?.data) ? categoriesRes.data : []);
      const subcatsData = subcategoriesRes?.data;
      setSubcategories(Array.isArray(subcatsData) ? subcatsData : subcatsData?.subcategories || []);
      setProducts(Array.isArray(productsRes?.data?.products) ? productsRes.data.products : []);
      if (!activeSchema) {
        setActiveSchema(schemaRes?.data?.[0] || null);
      }
    } catch (err) {
      setError(normalizeError(err));
    }
  }, [activeSchema]);

  useEffect(() => {
    refresh();
    loadOptions();
  }, [loadOptions, refresh]);

  useEffect(() => {
    loadSchemaForType(form.containerType).catch((err) => setError(normalizeError(err)));
  }, [form.containerType, loadSchemaForType]);

  function resetForm() {
    setEditingId("");
    setPreview(null);
    setCurrentStep(0);
    setPreviewDevice("desktop");
    setForm(initialForm);
  }

  function setLayoutField(field, value) {
    setForm((current) => ({
      ...current,
      layout: {
        ...current.layout,
        [field]: value,
      },
    }));
  }

  async function handleBackgroundImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setError("");
    try {
      const response = await uploadHomepageContainerMedia([file]);
      const uploadedUrl = response?.data?.[0]?.url || "";
      setLayoutField("backgroundType", "image");
      setLayoutField("backgroundImage", uploadedUrl);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  }

  async function startEdit(container) {
    try {
      const schema = await loadSchemaForType(container.containerType);
      setEditingId(container._id);
      setCurrentStep(0);
      setPreviewDevice("desktop");
      setForm(containerToForm(container, schema));
      setPreview(null);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload(form);
      if (editingId) {
        await updateAdminHomepageContainer(editingId, payload);
      } else {
        await createAdminHomepageContainer(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setError("");
    try {
      const response = await previewAdminHomepageContainer(buildPayload(form));
      setPreview(response?.data || null);
      setCurrentStep(3);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this homepage container?")) return;
    try {
      await deleteAdminHomepageContainer(id);
      if (editingId === id) {
        resetForm();
      }
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function handleToggleDisable(container) {
    const action = container.status === "DISABLED" ? "Enable" : "Disable";
    if (!window.confirm(`${action} this homepage container?`)) return;
    try {
      setSaving(true);
      await updateAdminHomepageContainer(container._id, {
        status: container.status === "DISABLED" ? "ACTIVE" : "DISABLED",
      });
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function commitReorder(nextContainers) {
    const payload = nextContainers.map((item, index) => ({ id: item._id, priority: index }));
    await reorderAdminHomepageContainers(payload);
    await refresh();
  }

  async function handleMove(container, direction) {
    const sorted = [...containers].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const index = sorted.findIndex((item) => item._id === container._id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;
    [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];
    try {
      await commitReorder(sorted);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function handleDrop(targetId) {
    if (!draggedId || draggedId === targetId) return;
    const sorted = [...containers].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const draggedIndex = sorted.findIndex((item) => item._id === draggedId);
    const targetIndex = sorted.findIndex((item) => item._id === targetId);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const [moved] = sorted.splice(draggedIndex, 1);
    sorted.splice(targetIndex, 0, moved);
    setDraggedId("");
    try {
      await commitReorder(sorted);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  const optionLoaders = useMemo(
    () => ({
      vendors: async (query = "") =>
        vendors
          .filter((item) => `${item.shopName || ""} ${item.companyName || ""}`.toLowerCase().includes(query.toLowerCase()))
          .map((item) => ({
            value: String(item._id),
            label: item.shopName || item.companyName || "Vendor",
            meta: item.companyName || "",
          })),
      categories: async (query = "") =>
        categories
          .filter((item) => item.name?.toLowerCase().includes(query.toLowerCase()))
          .map((item) => ({ value: String(item._id), label: item.name })),
      subcategories: async (query = "") =>
        filteredSubcategories
          .filter((item) => item.name?.toLowerCase().includes(query.toLowerCase()))
          .map((item) => ({ value: String(item._id), label: item.name })),
      products: async (query = "") => productCatalog.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
      brands: async (query = "") => brandCatalog.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
      tags: async (query = "") => tagCatalog.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    }),
    [brandCatalog, categories, filteredSubcategories, productCatalog, tagCatalog, vendors]
  );

  const currentStepMeta = editorSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === editorSteps.length - 1;
  const hasProductRules = Boolean(activeSchema?.supportsProductFilters);

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-8 px-4 pb-12 pt-2 sm:px-6 xl:px-8">
      <AnalyticsStrip summary={analyticsSummary} />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 xl:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Homepage Container Module</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              {editingId ? "Edit Homepage Container" : "Create Homepage Container"}
            </h1>
            <p className="mt-3 max-w-4xl text-base leading-7 text-slate-500 dark:text-slate-400">
              Build production-ready homepage containers with a guided workflow, wide editing canvas, and a live preview that stays visible while you work.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading}
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
            >
              {previewLoading ? "Rendering Preview..." : "Preview Container"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          <StepProgressBar steps={editorSteps} currentStep={currentStep} onSelect={setCurrentStep} />
        </div>

        <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(420px,3fr)]">
          <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Step {currentStepMeta.number} of {editorSteps.length}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">{currentStepMeta.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{currentStepMeta.description}</div>
            </div>

            <AnimatePresence mode="wait">
              <Motion.div
                key={currentStepMeta.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {currentStep === 0 ? (
                  <>
                    <EditorSection icon={LayoutTemplate} title="Basic Information" description="Give the container a clear identity and define its placement in the homepage system.">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <Field label="Container Name">
                          <input
                            value={form.title}
                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))}
                            className={inputClassName}
                            required
                          />
                        </Field>
                        <Field label="Slug">
                          <input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))} className={inputClassName} required />
                        </Field>
                        <Field label="Container Type">
                          <select value={form.containerType} onChange={(event) => setForm((current) => ({ ...current, containerType: event.target.value, config: {} }))} className={inputClassName}>
                            {containerSchemas.map((schema) => (
                              <option key={schema.type} value={schema.type}>{schema.label}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Status">
                          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={inputClassName}>
                            <option value="DRAFT">Draft</option>
                            <option value="ACTIVE">Active</option>
                            <option value="DISABLED">Disabled</option>
                          </select>
                        </Field>
                      </div>

                      <Field label="Description">
                        <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} className={`${inputClassName} min-h-[132px]`} />
                      </Field>
                    </EditorSection>

                    <EditorSection icon={Save} title="Display Rules" description="Control theme, priority, and scheduling so the container appears at the right time and in the right visual mode.">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <Field label="Priority">
                          <input type="number" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className={inputClassName} />
                        </Field>
                        <Field label="Theme">
                          <select value={form.layout.theme} onChange={(event) => setLayoutField("theme", event.target.value)} className={inputClassName}>
                            {["default", "light", "dark", "premium", "luxury", "modern", "festival", "minimal"].map((value) => (
                              <option key={value} value={value}>{toDisplayLabel(value)}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Schedule Start">
                          <input type="datetime-local" value={form.scheduleStart} onChange={(event) => setForm((current) => ({ ...current, scheduleStart: event.target.value }))} className={inputClassName} />
                        </Field>
                        <Field label="Schedule End">
                          <input type="datetime-local" value={form.scheduleEnd} onChange={(event) => setForm((current) => ({ ...current, scheduleEnd: event.target.value }))} className={inputClassName} />
                        </Field>
                      </div>
                    </EditorSection>
                  </>
                ) : null}

                {currentStep === 1 ? (
                  <>
                    {hasProductRules ? (
                      <EditorSection icon={Plus} title="Product Rules" description="Configure how products are discovered, filtered, ranked, and manually overridden.">
                        <div className="grid gap-6 lg:grid-cols-2">
                          <Field label="Vendors">
                            <AsyncMultiSelect value={form.filters.vendorIds} onChange={(next) => setNestedField(setForm, "filters", "vendorIds", next)} loadOptions={optionLoaders.vendors} placeholder="Search vendors..." />
                          </Field>
                          <Field label="Categories">
                            <AsyncMultiSelect value={form.filters.categoryIds} onChange={(next) => setNestedField(setForm, "filters", "categoryIds", next)} loadOptions={optionLoaders.categories} placeholder="Search categories..." />
                          </Field>
                          <Field label="Subcategories">
                            <AsyncMultiSelect value={form.filters.subCategoryIds} onChange={(next) => setNestedField(setForm, "filters", "subCategoryIds", next)} loadOptions={optionLoaders.subcategories} placeholder="Search subcategories..." />
                          </Field>
                          <Field label="Brands">
                            <AsyncMultiSelect value={form.filters.brandIds} onChange={(next) => setNestedField(setForm, "filters", "brandIds", next)} loadOptions={optionLoaders.brands} placeholder="Search brands..." />
                          </Field>
                          <Field label="Tags">
                            <AsyncMultiSelect value={form.filters.tags} onChange={(next) => setNestedField(setForm, "filters", "tags", next)} loadOptions={optionLoaders.tags} placeholder="Search tags..." />
                          </Field>
                          <Field label="Sort By">
                            <select value={form.filters.sortBy} onChange={(event) => setNestedField(setForm, "filters", "sortBy", event.target.value)} className={inputClassName}>
                              {["BEST_SELLING", "HIGHEST_DISCOUNT", "NEWEST", "TRENDING", "PRICE_LOW_TO_HIGH", "PRICE_HIGH_TO_LOW", "MOST_VIEWED", "TOP_RATED", "RANDOM"].map((value) => (
                                <option key={value} value={value}>{toDisplayLabel(value)}</option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
                          <Field label="Min Price">
                            <input type="number" min="0" value={form.filters.minPrice} onChange={(event) => setNestedField(setForm, "filters", "minPrice", event.target.value)} className={inputClassName} />
                          </Field>
                          <Field label="Max Price">
                            <input type="number" min="0" value={form.filters.maxPrice} onChange={(event) => setNestedField(setForm, "filters", "maxPrice", event.target.value)} className={inputClassName} />
                          </Field>
                          <Field label="Offer Percentage">
                            <input type="number" min="0" max="100" value={form.filters.minDiscountPercentage} onChange={(event) => setNestedField(setForm, "filters", "minDiscountPercentage", event.target.value)} className={inputClassName} />
                          </Field>
                          <Field label="Minimum Rating">
                            <input type="number" min="0" max="5" step="0.1" value={form.filters.minimumRating} onChange={(event) => setNestedField(setForm, "filters", "minimumRating", event.target.value)} className={inputClassName} />
                          </Field>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                          <Field label="Maximum Products">
                            <input type="number" min="1" max="100" value={form.filters.maxProductsToShow} onChange={(event) => setNestedField(setForm, "filters", "maxProductsToShow", event.target.value)} className={inputClassName} />
                          </Field>
                          <Field label="Selection Mode">
                            <select value={form.filters.productSelectionMode} onChange={(event) => setNestedField(setForm, "filters", "productSelectionMode", event.target.value)} className={inputClassName}>
                              <option value="AUTO">Auto</option>
                              <option value="MANUAL">Manual</option>
                            </select>
                          </Field>
                          <BooleanField label="Show Only In Stock" checked={form.filters.showOnlyInStock} onChange={(checked) => setNestedField(setForm, "filters", "showOnlyInStock", checked)} />
                        </div>

                        {form.filters.productSelectionMode === "MANUAL" ? (
                          <Field label="Manual Products">
                            <AsyncMultiSelect value={form.filters.manualProductIds} onChange={(next) => setNestedField(setForm, "filters", "manualProductIds", next)} loadOptions={optionLoaders.products} placeholder="Search products..." />
                          </Field>
                        ) : null}
                      </EditorSection>
                    ) : null}

                    <EditorSection icon={Save} title="Advanced Settings" description="Schema-driven fields for the selected container type appear here so admins only see the controls that matter.">
                      {(activeSchema?.typeFields || []).length ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                          {(activeSchema?.typeFields || []).map((field) => (
                            <div key={field.name} className={field.type === "textarea" || field.type === "array" ? "lg:col-span-2" : ""}>
                              <FieldRenderer
                                field={field}
                                value={form.config[field.name] ?? ""}
                                onChange={(value) => setForm((current) => ({ ...current, config: { ...current.config, [field.name]: value } }))}
                                loadOptions={optionLoaders[field.source]}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          No type-specific fields are required for this container type.
                        </div>
                      )}
                    </EditorSection>
                  </>
                ) : null}

                {currentStep === 2 ? (
                  <>
                    <EditorSection icon={LayoutTemplate} title="Visual Container Designer" description="Use the full editing canvas to shape width, height, alignment, spacing, and visual treatment.">
                      <SectionTitle title="Layout Width" description="Choose how wide the container should feel across the page." />
                      <ChoiceGrid
                        value={form.layout.widthType === "medium" ? "boxed" : form.layout.widthType}
                        onChange={(value) => setLayoutField("widthType", value)}
                        columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
                        cardHeight="h-[120px]"
                        options={[
                          { value: "full", label: "Full Width", hint: "Stretch edge to edge" },
                          { value: "boxed", label: "Boxed", hint: "Centered with max width" },
                          { value: "narrow", label: "Narrow", hint: "More editorial spacing" },
                          { value: "custom", label: "Custom", hint: "Use a custom max width" },
                        ]}
                      />
                      {form.layout.widthType === "custom" ? (
                        <SliderRow label="Custom Width" min={320} max={2000} step={10} value={form.layout.customWidth} onChange={(value) => setLayoutField("customWidth", value)} />
                      ) : null}

                      <SectionTitle title="Container Height" description="Pick a comfortable height preset and refine it only when needed." />
                      <ChoiceGrid
                        value={form.layout.heightType === "custom" ? "large" : form.layout.heightType}
                        onChange={(value) => setLayoutField("heightType", value)}
                        columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
                        cardHeight="h-[100px]"
                        options={[
                          { value: "auto", label: "Auto", hint: "Content-driven height" },
                          { value: "small", label: "Small", hint: "250px" },
                          { value: "medium", label: "Medium", hint: "450px" },
                          { value: "large", label: "Large", hint: "650px" },
                        ]}
                      />

                      <SectionTitle title="Alignment" description="Position the container along the page flow without clipping or awkward spacing." />
                      <ChoiceGrid
                        value={form.layout.alignment}
                        onChange={(value) => setLayoutField("alignment", value)}
                        columns="grid-cols-1 sm:grid-cols-3"
                        cardHeight="h-[92px]"
                        options={[
                          { value: "left", label: "Left", hint: "Anchor to the left edge" },
                          { value: "center", label: "Center", hint: "Balanced center layout" },
                          { value: "right", label: "Right", hint: "Align to the right edge" },
                        ]}
                      />
                    </EditorSection>

                    <EditorSection icon={Plus} title="Display Rules" description="Fine-tune spacing, visibility, and background presentation without any overlapping controls.">
                      <SectionTitle title="Spacing" description="Each control uses a clean row layout so labels, sliders, and values stay aligned." />
                      <div className="space-y-4">
                        <SliderRow label="Padding" min={0} max={150} value={form.layout.padding} onChange={(value) => setLayoutField("padding", value)} />
                        <SliderRow label="Margin Top" min={0} max={150} value={form.layout.marginTop} onChange={(value) => setLayoutField("marginTop", value)} />
                        <SliderRow label="Margin Bottom" min={0} max={150} value={form.layout.marginBottom} onChange={(value) => setLayoutField("marginBottom", value)} />
                        <SliderRow label="Margin Left" min={0} max={150} value={form.layout.marginLeft} onChange={(value) => setLayoutField("marginLeft", value)} />
                        <SliderRow label="Margin Right" min={0} max={150} value={form.layout.marginRight} onChange={(value) => setLayoutField("marginRight", value)} />
                      </div>

                      <SectionTitle title="Visibility" description="Show exactly which devices can render this container." />
                      <VisibilitySelector
                        desktopVisible={form.desktopVisible}
                        tabletVisible={form.tabletVisible}
                        mobileVisible={form.mobileVisible}
                        onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
                      />

                      <SectionTitle title="Background" description="Switch between solid color, gradient, image, or video without compressing the controls." />
                      <ChoiceGrid
                        value={form.layout.backgroundType}
                        onChange={(value) => setLayoutField("backgroundType", value)}
                        columns="grid-cols-2 xl:grid-cols-4"
                        cardHeight="h-[92px]"
                        options={[
                          { value: "solid", label: "Solid", hint: "Single-color background" },
                          { value: "gradient", label: "Gradient", hint: "Blend two colors" },
                          { value: "image", label: "Image", hint: "Upload or paste media" },
                          { value: "video", label: "Video", hint: "Hosted motion background" },
                        ]}
                      />

                      {form.layout.backgroundType === "solid" ? (
                        <ColorField label="Background Color" value={form.layout.backgroundColor} onChange={(value) => setLayoutField("backgroundColor", value)} />
                      ) : null}
                      {form.layout.backgroundType === "gradient" ? (
                        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                          <ColorField label="Color 1" value={form.layout.gradientColor1} onChange={(value) => setLayoutField("gradientColor1", value)} />
                          <ColorField label="Color 2" value={form.layout.gradientColor2} onChange={(value) => setLayoutField("gradientColor2", value)} />
                          <Field label="Direction">
                            <select value={form.layout.gradientDirection} onChange={(event) => setLayoutField("gradientDirection", event.target.value)} className={inputClassName}>
                              {[
                                ["to right", "Left to Right"],
                                ["to left", "Right to Left"],
                                ["to bottom", "Top to Bottom"],
                                ["135deg", "Diagonal"],
                              ].map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      ) : null}
                      {form.layout.backgroundType === "image" ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                          <Field label="Upload Image">
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBackgroundImageUpload} className={`${inputClassName} cursor-pointer`} />
                          </Field>
                          <Field label="Image URL">
                            <input value={form.layout.backgroundImage} onChange={(event) => setLayoutField("backgroundImage", event.target.value)} className={inputClassName} placeholder="/uploads/homepage.jpg" />
                          </Field>
                          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                            {imageUploading ? "Uploading image..." : form.layout.backgroundImage ? "Background image ready for preview." : "Upload an image or paste an existing media URL."}
                          </div>
                        </div>
                      ) : null}
                      {form.layout.backgroundType === "video" ? (
                        <Field label="Video URL">
                          <input value={form.layout.backgroundVideo} onChange={(event) => setLayoutField("backgroundVideo", event.target.value)} className={inputClassName} placeholder="https://..." />
                        </Field>
                      ) : null}
                    </EditorSection>

                    <EditorSection icon={Eye} title="Advanced Settings" description="Animation, custom offsets, and precision controls live here in a clean full-width layout.">
                      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="space-y-5">
                          <Field label="Animation">
                            <select value={form.layout.animation} onChange={(event) => setLayoutField("animation", event.target.value)} className={inputClassName}>
                              {["none", "fadeUp", "fadeDown", "fadeLeft", "fadeRight", "zoomIn", "zoomOut", "bounce", "slideUp"].map((value) => (
                                <option key={value} value={value}>{toDisplayLabel(value)}</option>
                              ))}
                            </select>
                          </Field>
                          <div className="space-y-4">
                            <SliderRow label="Position X" min={-500} max={500} step={5} value={form.layout.positionX} onChange={(value) => setLayoutField("positionX", value)} compact />
                            <SliderRow label="Position Y" min={-500} max={500} step={5} value={form.layout.positionY} onChange={(value) => setLayoutField("positionY", value)} compact />
                          </div>
                        </div>
                        <AnimationSwatch animation={form.layout.animation} />
                      </div>
                    </EditorSection>
                  </>
                ) : null}

                {currentStep === 3 ? (
                  <EditorSection icon={Eye} title="Preview & Publish" description="Render the container with real data, validate spacing and theme choices, then publish when everything matches the homepage.">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handlePreview}
                        disabled={previewLoading}
                        className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                      >
                        {previewLoading ? "Refreshing Preview..." : "Preview Container"}
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900"
                      >
                        {saving ? "Saving..." : editingId ? "Update Container" : "Publish Container"}
                      </button>
                    </div>
                    <PreviewPanel preview={preview} loading={previewLoading} large />
                  </EditorSection>
                ) : null}
              </Motion.div>
            </AnimatePresence>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                {isLastStep ? "Final check: render the preview, verify the catalog, then publish." : "Continue to the next step when this section looks right."}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
                  disabled={isFirstStep}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((step) => Math.min(editorSteps.length - 1, step + 1))}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900"
                  >
                    {saving ? "Saving..." : editingId ? "Update Container" : "Publish"}
                  </button>
                )}
              </div>
            </div>
          </form>

          <LivePreviewSidebar
            form={form}
            preview={preview}
            previewLoading={previewLoading}
            previewDevice={previewDevice}
            onPreviewDeviceChange={setPreviewDevice}
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 xl:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">Homepage Containers</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Drag, reorder, publish, and monitor every homepage slot from one full-width command center.</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {containers.length} total
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
            ))
          ) : containers.length ? (
            containers
              .slice()
              .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
              .map((container, index) => (
                <article
                  key={container._id}
                  draggable
                  onDragStart={() => setDraggedId(container._id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(container._id)}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="mt-1 shrink-0 text-slate-400">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">#{index + 1}</span>
                          <StatusPill>{container.status}</StatusPill>
                          <StatusPill>{container.containerType}</StatusPill>
                          <StatusPill>{container.filters?.productSelectionMode || "AUTO"}</StatusPill>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{container.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                          {container.slug} • {container.analytics?.ctr || 0}% CTR • {container.analytics?.revenue ? formatCurrency(container.analytics.revenue) : formatCurrency(0)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleMove(container, "up")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                        Move Up
                      </button>
                      <button type="button" onClick={() => handleMove(container, "down")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                        Move Down
                      </button>
                      <button type="button" onClick={() => startEdit(container)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-slate-900">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleToggleDisable(container)} className={`rounded-2xl border px-4 py-3 text-sm font-medium ${container.status === "DISABLED" ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300" : "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300"}`}>
                        {container.status === "DISABLED" ? "Enable" : "Disable"}
                      </button>
                      <button type="button" onClick={() => handleDelete(container._id)} className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:text-rose-300">
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No homepage containers yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function setNestedField(setter, section, field, value) {
  setter((current) => ({
    ...current,
    [section]: {
      ...current[section],
      [field]: value,
    },
  }));
}

function StepProgressBar({ steps, currentStep, onSelect }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="mb-4 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-slate-900 transition-all duration-300 dark:bg-white"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const complete = index < currentStep;
          const active = index === currentStep;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`min-w-0 rounded-2xl border px-4 py-4 text-left transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                  : complete
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${active ? "bg-white/15 dark:bg-slate-900" : complete ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                  {complete ? <Check className="h-4 w-4" /> : step.number}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{step.title}</div>
                  <div className={`mt-1 text-xs leading-5 ${active ? "text-white/80 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>{step.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditorSection({ icon: Icon, title, description, children }) {
  return (
    <section className={sectionCardClassName}>
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="mt-6 min-w-0 space-y-6">{children}</div>
    </section>
  );
}

function LivePreviewSidebar({ form, preview, previewLoading, previewDevice, onPreviewDeviceChange }) {
  return (
    <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
      <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <Eye className="h-4 w-4" />
            Live Preview
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">Container Preview</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Inspect the layout in desktop, tablet, and mobile views without leaving the builder.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {deviceOptions.map((device) => {
            const Icon = device.icon;
            const active = previewDevice === device.value;
            return (
              <button
                key={device.value}
                type="button"
                onClick={() => onPreviewDeviceChange(device.value)}
                className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {device.label}
              </button>
            );
          })}
        </div>

        <LiveLayoutPreview form={form} preview={preview} device={previewDevice} />

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">Preview Summary</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SummaryItem label="Container Type" value={toDisplayLabel(form.containerType)} />
            <SummaryItem label="Theme" value={toDisplayLabel(form.layout.theme)} />
            <SummaryItem label="Layout" value={toDisplayLabel(form.layout.widthType)} />
            <SummaryItem label="Spacing" value={`${form.layout.padding}px padding`} />
            <SummaryItem label="Desktop View" value={form.desktopVisible ? "Visible" : "Hidden"} />
            <SummaryItem label="Tablet View" value={form.tabletVisible ? "Visible" : "Hidden"} />
            <SummaryItem label="Mobile View" value={form.mobileVisible ? "Visible" : "Hidden"} />
            <SummaryItem label="Catalog Items" value={`${preview?.products?.length || 0} products`} />
          </div>
        </div>

        <div>
          <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">Catalog Preview</div>
          <PreviewPanel preview={preview} loading={previewLoading} />
        </div>
      </div>
    </aside>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function FieldRenderer({ field, value, onChange, loadOptions }) {
  if (field.type === "boolean") {
    return <BooleanField label={field.label} checked={Boolean(value)} onChange={onChange} />;
  }

  if (field.type === "async-multiselect") {
    return (
      <Field label={field.label}>
        <AsyncMultiSelect value={Array.isArray(value) ? value : []} onChange={onChange} loadOptions={loadOptions} placeholder={`Search ${field.label.toLowerCase()}...`} maxItems={field.maxItems} />
      </Field>
    );
  }

  if (field.type === "select") {
    return (
      <Field label={field.label}>
        <select value={value ?? field.defaultValue ?? ""} onChange={(event) => onChange(event.target.value)} className={inputClassName}>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.type === "textarea" || field.type === "array") {
    return (
      <Field label={field.label}>
        <textarea
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          rows={field.type === "array" ? 6 : 4}
          className={`${inputClassName} min-h-[160px]`}
          placeholder={field.type === "array" ? "Paste JSON array here" : ""}
        />
      </Field>
    );
  }

  if (field.type === "datetime") {
    return (
      <Field label={field.label}>
        <input type="datetime-local" value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={inputClassName} />
      </Field>
    );
  }

  return (
    <Field label={field.label}>
      <input
        type={field.type === "number" ? "number" : "text"}
        min={field.min}
        max={field.max}
        step={field.step}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </Field>
  );
}

function toDisplayLabel(value = "") {
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function resolveThemePreview(theme) {
  switch (theme) {
    case "light":
      return { color: "#0f172a", background: "#ffffff" };
    case "dark":
      return { background: "#0f172a", color: "#f8fafc" };
    case "premium":
      return { background: "linear-gradient(135deg, #fef3c7, #fb923c)", color: "#3f2305" };
    case "luxury":
      return { background: "linear-gradient(135deg, #111827, #4b5563)", color: "#f8fafc" };
    case "modern":
      return { background: "linear-gradient(135deg, #dbeafe, #bfdbfe)", color: "#0f172a" };
    case "festival":
      return { background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff7ed" };
    case "minimal":
      return { background: "#f8fafc", color: "#0f172a" };
    case "default":
    default:
      return { background: "#ffffff", color: "#0f172a" };
  }
}

function resolvePreviewBackground(layout) {
  if (layout.backgroundType === "gradient") {
    return `linear-gradient(${layout.gradientDirection}, ${layout.gradientColor1}, ${layout.gradientColor2})`;
  }
  return resolveThemePreview(layout.theme).background;
}

function resolvePreviewHeight(layout) {
  switch (layout.heightType) {
    case "small":
      return 250;
    case "medium":
      return 450;
    case "large":
      return 650;
    case "custom":
      return layout.customHeight;
    case "auto":
    default:
      return 380;
  }
}

function resolvePreviewWidth(layout) {
  switch (layout.widthType) {
    case "boxed":
      return "min(100%, 1400px)";
    case "narrow":
      return "min(100%, 900px)";
    case "custom":
      return `min(100%, ${layout.customWidth}px)`;
    case "full":
    default:
      return "100%";
  }
}

function buildPreviewContainerStyle(layout) {
  const themeStyles = resolveThemePreview(layout.theme);
  return {
    position: "relative",
    overflow: "hidden",
    width: resolvePreviewWidth(layout),
    minHeight: `${resolvePreviewHeight(layout)}px`,
    marginTop: `${layout.marginTop}px`,
    marginBottom: `${layout.marginBottom}px`,
    marginLeft: layout.alignment === "right" ? "auto" : layout.alignment === "center" ? "auto" : `${layout.marginLeft}px`,
    marginRight: layout.alignment === "left" ? "auto" : layout.alignment === "center" ? "auto" : `${layout.marginRight}px`,
    padding: `${layout.padding}px`,
    transform: `translate(${layout.positionX}px, ${layout.positionY}px)`,
    background: layout.backgroundType === "solid" ? layout.backgroundColor : resolvePreviewBackground(layout),
    color: themeStyles.color,
    borderColor: "rgba(255,255,255,0.55)",
  };
}

function resolvePreviewAnimation(animation) {
  const transition = { duration: 0.55, ease: "easeOut", repeat: Infinity, repeatDelay: 1.2, repeatType: "mirror" };
  switch (animation) {
    case "none":
      return { initial: false, animate: { opacity: 1, x: 0, y: 0, scale: 1 }, transition: { duration: 0.2 } };
    case "fadeDown":
      return { initial: { opacity: 0.55, y: -18 }, animate: { opacity: 1, y: 0 }, transition };
    case "fadeLeft":
      return { initial: { opacity: 0.55, x: -18 }, animate: { opacity: 1, x: 0 }, transition };
    case "fadeRight":
      return { initial: { opacity: 0.55, x: 18 }, animate: { opacity: 1, x: 0 }, transition };
    case "zoomIn":
      return { initial: { opacity: 0.5, scale: 0.92 }, animate: { opacity: 1, scale: 1 }, transition };
    case "zoomOut":
      return { initial: { opacity: 0.6, scale: 1.06 }, animate: { opacity: 1, scale: 1 }, transition };
    case "bounce":
      return { initial: { y: 0 }, animate: { y: [0, -14, 0] }, transition: { duration: 0.9, repeat: Infinity, repeatDelay: 0.6 } };
    case "slideUp":
      return { initial: { opacity: 0.55, y: 28 }, animate: { opacity: 1, y: 0 }, transition };
    case "fadeUp":
    default:
      return { initial: { opacity: 0.55, y: 18 }, animate: { opacity: 1, y: 0 }, transition };
  }
}

function LiveLayoutPreview({ form, preview, device }) {
  const layout = form.layout || defaultLayout;
  const previewStyle = buildPreviewContainerStyle(layout);
  const animationProps = resolvePreviewAnimation(layout.animation);
  const deviceOption = deviceOptions.find((option) => option.value === device) || deviceOptions[0];
  const products = preview?.products?.slice(0, 4) || [];

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
      <div className="rounded-[22px] bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_42%),linear-gradient(180deg,_#f8fafc,_#e2e8f0)] p-4 dark:bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_42%),linear-gradient(180deg,_#0f172a,_#020617)]">
        <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
          <span>{deviceOption.label} View</span>
          <span>{toDisplayLabel(layout.theme)}</span>
        </div>
        <div className="min-h-[560px] rounded-[22px] border border-white/70 bg-white/45 p-4 shadow-inner dark:border-white/10 dark:bg-slate-900/30">
          <div className={deviceOption.widthClassName}>
            <Motion.div {...animationProps} className="rounded-[22px] border shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]" style={previewStyle}>
              {layout.backgroundType === "video" && layout.backgroundVideo ? (
                <video src={resolveApiAssetUrl(layout.backgroundVideo)} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full rounded-[inherit] object-cover" />
              ) : null}
              {layout.backgroundType === "image" && layout.backgroundImage ? (
                <img src={resolveApiAssetUrl(layout.backgroundImage)} alt="Container preview" className="absolute inset-0 h-full w-full rounded-[inherit] object-cover" />
              ) : null}
              <div className="relative z-10 space-y-5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-70">{form.containerType}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{form.title || "Container headline"}</div>
                  <div className="mt-2 max-w-2xl text-sm leading-6 opacity-80">{form.description || "This preview updates instantly as the admin changes layout controls."}</div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(products.length ? products : Array.from({ length: 4 })).map((product, index) => (
                    <div key={product?._id || index} className="rounded-2xl border border-black/5 bg-white/70 p-3 backdrop-blur dark:border-white/10 dark:bg-white/10">
                      <div className="h-28 rounded-xl bg-black/10 dark:bg-white/10" />
                      <div className="mt-3 text-sm font-semibold">{product?.name || "Product title"}</div>
                      <div className="mt-1 text-xs opacity-70">{product?.category || "Category"}</div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold">{product ? formatCurrency(product.discountPrice || product.price || 0) : formatCurrency(999)}</span>
                        <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold dark:bg-white/10">Offer</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }) {
  return (
    <div>
      <div className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900 dark:text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</div>
    </div>
  );
}

function ChoiceGrid({ value, onChange, options, columns = "grid-cols-1 md:grid-cols-2", cardHeight = "h-[96px]" }) {
  return (
    <div className={`grid min-w-0 gap-4 ${columns}`}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-w-0 w-full rounded-3xl border px-5 py-4 text-left transition ${cardHeight} ${
              active
                ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
            }`}
          >
            <div className="flex h-full flex-col justify-between gap-3">
              <div className="text-base font-semibold">{option.label}</div>
              <div className={`text-sm leading-6 ${active ? "text-white/80 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>{option.hint}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SliderRow({ label, value, onChange, min, max, step = 1, compact = false }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40 ${compact ? "px-3 py-2" : "px-4 py-4"}`}>
      <div className={`flex ${compact ? "flex-col gap-2" : "flex-col gap-4 lg:flex-row lg:items-center"}`}>
        <div className={`shrink-0 ${compact ? "whitespace-nowrap" : ""}`}>
          <div className={`font-semibold text-slate-900 dark:text-white ${compact ? "text-xs" : "text-sm"}`}>{label}</div>
        </div>
        <div className={`flex items-center gap-2 ${compact ? "w-full" : "min-w-0 flex-1"}`}>
          <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-slate-900 dark:accent-white" />
          <div className="shrink-0">
            <div className={`inline-flex justify-center rounded-full bg-white font-semibold shadow-sm dark:bg-slate-900 dark:text-slate-200 ${compact ? "min-w-[50px] px-2 py-1 text-xs text-slate-700" : "min-w-[80px] px-3 py-2 text-sm text-slate-700"}`}>
              {value}px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-14 w-24 shrink-0 rounded-2xl border border-slate-300 bg-transparent p-2 dark:border-slate-700" />
        <input value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName} />
      </div>
    </Field>
  );
}

function AnimationSwatch({ animation }) {
  const animationProps = resolvePreviewAnimation(animation);
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Animation Preview</div>
      <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-2xl bg-white dark:bg-slate-900">
        <Motion.div key={animation} {...animationProps} className="h-20 w-20 rounded-[24px] bg-slate-900 dark:bg-white" />
      </div>
    </div>
  );
}

function PreviewPanel({ preview, loading, large = false }) {
  const products = preview?.products || [];
  const shellClassName = large ? "min-h-[500px]" : "min-h-[360px]";

  if (loading) {
    return <div className={`animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800 ${shellClassName}`} />;
  }

  if (!preview) {
    return (
      <div className={`rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 ${shellClassName}`}>
        <div className="flex h-full min-h-[300px] items-center justify-center">
          Run preview to inspect resolved products before publishing.
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40 ${shellClassName}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill>{preview?.container?.containerType}</StatusPill>
        <StatusPill>{products.length} products</StatusPill>
        <StatusPill>{toDisplayLabel(preview?.container?.presentation?.layout?.theme || "default")}</StatusPill>
      </div>
      <div className={`mt-4 grid gap-4 ${large ? "md:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2"}`}>
        {(products.length ? products : Array.from({ length: large ? 6 : 4 })).slice(0, large ? 6 : 4).map((product, index) => (
          <div key={product?._id || index} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="mt-3 line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{product?.name || "Preview product"}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{product?.category || "Category"}</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm font-medium text-emerald-600">{product ? formatCurrency(product.discountPrice || product.price || 0) : formatCurrency(999)}</div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Offer</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsStrip({ summary }) {
  const cards = [
    { label: "Total Containers", value: summary?.totalContainers ?? 0, icon: LayoutTemplate },
    { label: "Active Containers", value: summary?.activeContainers ?? 0, icon: Eye },
    { label: "Top CTR", value: summary?.topByCtr?.[0]?.analytics?.ctr ? `${summary.topByCtr[0].analytics.ctr}%` : "0%", icon: BarChart3 },
    { label: "Top Revenue", value: summary?.topByRevenue?.[0]?.analytics?.revenue ? formatCurrency(summary.topByRevenue[0].analytics.revenue) : formatCurrency(0), icon: Save },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{card.label}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{card.value}</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VisibilitySelector({ desktopVisible, tabletVisible, mobileVisible, onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <VisibilityToggle label="Desktop" checked={desktopVisible} onChange={(checked) => onChange("desktopVisible", checked)} />
      <VisibilityToggle label="Tablet" checked={tabletVisible} onChange={(checked) => onChange("tabletVisible", checked)} />
      <VisibilityToggle label="Mobile" checked={mobileVisible} onChange={(checked) => onChange("mobileVisible", checked)} />
    </div>
  );
}

function VisibilityToggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex min-h-[56px] w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold transition ${
        checked
          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
      }`}
    >
      <span>{label}</span>
      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${checked ? "bg-white/15 dark:bg-slate-900" : "bg-white dark:bg-slate-900"}`}>
        {checked ? <Check className="h-4 w-4" /> : null}
      </span>
    </button>
  );
}

function BooleanField({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex min-h-[52px] w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold transition ${
        checked
          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${checked ? "bg-white/15 dark:bg-slate-900" : "bg-slate-100 dark:bg-slate-800"}`}>
        {checked ? <Check className="h-4 w-4" /> : null}
      </span>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0 w-full">
      <span className="mb-2 block whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ children }) {
  return (
    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
      {children}
    </span>
  );
}

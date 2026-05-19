import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { BarChart3, Eye, GripVertical, LayoutTemplate, Plus, Save } from "lucide-react";
import { AsyncMultiSelect } from "../components/AsyncMultiSelect";
import {
  createAdminHomepageContainer,
  deleteAdminHomepageContainer,
  getHomepageContainerSchema,
  getHomepageContainerSchemas,
  listAdminHomepageContainers,
  previewAdminHomepageContainer,
  reorderAdminHomepageContainers,
  updateAdminHomepageContainer,
} from "../services/homepageContainerService";
import { listCategories, listProducts, listSellers, listSubcategories } from "../services/adminApi";
import { formatCurrency } from "../utils/formatCurrency";

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
  mobileVisible: true,
  backgroundColor: "",
  textColor: "",
  padding: "24px",
  margin: "0",
  animation: "FADE_UP",
  customCssClasses: "",
  containerWidth: "full",
  containerHeight: "auto",
  containerTheme: "DEFAULT",
  containerOffsetX: "",
  containerOffsetY: "",
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
    mobileVisible: Boolean(form.mobileVisible),
    backgroundColor: form.backgroundColor,
    textColor: form.textColor,
    padding: form.padding,
    margin: form.margin,
    animation: form.animation,
    customCssClasses: form.customCssClasses,
    containerWidth: form.containerWidth,
    containerHeight: form.containerHeight,
    containerOffsetX: form.containerOffsetX,
    containerOffsetY: form.containerOffsetY,
    containerTheme: form.containerTheme,
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
    mobileVisible: container?.visibility?.mobile !== false,
    backgroundColor: container?.presentation?.backgroundColor || "",
    textColor: container?.presentation?.textColor || "",
    padding: container?.presentation?.padding || "24px",
    margin: container?.presentation?.margin || "0",
    animation: container?.presentation?.animation || "FADE_UP",
    customCssClasses: container?.presentation?.customCssClasses || "",
    containerWidth: container?.presentation?.containerWidth || "full",
    containerHeight: container?.presentation?.containerHeight || "auto",
    containerOffsetX: container?.presentation?.containerOffsetX || "",
    containerOffsetY: container?.presentation?.containerOffsetY || "",
    containerTheme: container?.presentation?.containerTheme || "DEFAULT",
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
  const [preview, setPreview] = useState(null);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [draggedId, setDraggedId] = useState("");
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
    setForm(initialForm);
  }

  async function startEdit(container) {
    try {
      const schema = await loadSchemaForType(container.containerType);
      setEditingId(container._id);
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
    const makeSure = container.status === "DISABLED" ? "Enable" : "Disable";
    if (!window.confirm(`${makeSure} this homepage container?`)) return;
    try {
      setSaving(true);
      const newStatus = container.status === "DISABLED" ? "ACTIVE" : "DISABLED";
      await updateAdminHomepageContainer(container._id, { status: newStatus });
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
      products: async (query = "") =>
        productCatalog.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
      brands: async (query = "") => brandCatalog.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
      tags: async (query = "") => tagCatalog.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    }),
    [brandCatalog, categories, filteredSubcategories, productCatalog, tagCatalog, vendors]
  );

  return (
    <div className="space-y-6">
      <AnalyticsStrip summary={analyticsSummary} />

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Homepage Containers</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Drag, reorder, publish, and monitor every homepage slot from one place.</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {containers.length} total
            </div>
          </div>

          <div className="mt-5 space-y-3">
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
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-3">
                        <div className="mt-1 text-slate-400">
                          <GripVertical className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">#{index + 1}</span>
                            <StatusPill>{container.status}</StatusPill>
                            <StatusPill>{container.containerType}</StatusPill>
                            <StatusPill>{container.filters?.productSelectionMode || "AUTO"}</StatusPill>
                          </div>
                          <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{container.title}</h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {container.slug} • {container.analytics?.ctr || 0}% CTR • {container.analytics?.revenue ? formatCurrency(container.analytics.revenue) : formatCurrency(0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleMove(container, "up")} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                          Move Up
                        </button>
                        <button type="button" onClick={() => handleMove(container, "down")} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                          Move Down
                        </button>
                        <button type="button" onClick={() => startEdit(container)} className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleToggleDisable(container)} className={`rounded-2xl border px-3 py-2 text-sm font-medium ${container.status === "DISABLED" ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300" : "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300"}`}>
                          {container.status === "DISABLED" ? "Enable" : "Disable"}
                        </button>
                        <button type="button" onClick={() => handleDelete(container._id)} className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900 dark:text-rose-300">
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No homepage containers yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{editingId ? "Edit Container" : "Create Container"}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Schema-driven field groups adapt immediately when the container type changes.</p>
            </div>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Reset
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-6">
            <FieldGroup icon={LayoutTemplate} title="Common Fields" description="Every container carries these foundation settings.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Container Name">
                  <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))} className={inputClassName} required />
                </Field>
                <Field label="Slug">
                  <input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))} className={inputClassName} required />
                </Field>
              </div>

              <Field label="Description">
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className={inputClassName} />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
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

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Priority">
                  <input type="number" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className={inputClassName} />
                </Field>
                <Field label="Animation">
                  <select value={form.animation} onChange={(event) => setForm((current) => ({ ...current, animation: event.target.value }))} className={inputClassName}>
                    {["NONE", "FADE_UP", "FADE_IN", "SLIDE_LEFT", "SLIDE_RIGHT"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Schedule Start">
                  <input type="datetime-local" value={form.scheduleStart} onChange={(event) => setForm((current) => ({ ...current, scheduleStart: event.target.value }))} className={inputClassName} />
                </Field>
                <Field label="Schedule End">
                  <input type="datetime-local" value={form.scheduleEnd} onChange={(event) => setForm((current) => ({ ...current, scheduleEnd: event.target.value }))} className={inputClassName} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Background Color">
                  <input value={form.backgroundColor} onChange={(event) => setForm((current) => ({ ...current, backgroundColor: event.target.value }))} className={inputClassName} placeholder="#ffffff" />
                </Field>
                <Field label="Text Color">
                  <input value={form.textColor} onChange={(event) => setForm((current) => ({ ...current, textColor: event.target.value }))} className={inputClassName} placeholder="#0f172a" />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Padding">
                  <input value={form.padding} onChange={(event) => setForm((current) => ({ ...current, padding: event.target.value }))} className={inputClassName} />
                </Field>
                <Field label="Margin">
                  <input value={form.margin} onChange={(event) => setForm((current) => ({ ...current, margin: event.target.value }))} className={inputClassName} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Container Width">
                  <input value={form.containerWidth} onChange={(event) => setForm((current) => ({ ...current, containerWidth: event.target.value }))} className={inputClassName} />
                </Field>
                <Field label="Container Height">
                  <input value={form.containerHeight} onChange={(event) => setForm((current) => ({ ...current, containerHeight: event.target.value }))} className={inputClassName} />
                </Field>
                <Field label="Container Theme">
                  <select value={form.containerTheme} onChange={(event) => setForm((current) => ({ ...current, containerTheme: event.target.value }))} className={inputClassName}>
                    {['DEFAULT', 'LIGHT', 'DARK', 'BRAND'].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Offset X">
                  <input placeholder="e.g. 24px or -5%" value={form.containerOffsetX} onChange={(event) => setForm((current) => ({ ...current, containerOffsetX: event.target.value }))} className={inputClassName} />
                </Field>
                <Field label="Offset Y">
                  <input placeholder="e.g. 12px or -10%" value={form.containerOffsetY} onChange={(event) => setForm((current) => ({ ...current, containerOffsetY: event.target.value }))} className={inputClassName} />
                </Field>
              </div>

              <Field label="Custom CSS Classes">
                <input value={form.customCssClasses} onChange={(event) => setForm((current) => ({ ...current, customCssClasses: event.target.value }))} className={inputClassName} />
              </Field>

              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Desktop Visible" checked={form.desktopVisible} onChange={(checked) => setForm((current) => ({ ...current, desktopVisible: checked }))} />
                <Toggle label="Mobile Visible" checked={form.mobileVisible} onChange={(checked) => setForm((current) => ({ ...current, mobileVisible: checked }))} />
              </div>
            </FieldGroup>

            {activeSchema?.supportsProductFilters ? (
              <FieldGroup icon={Plus} title="Product Rules" description="These rules control automatic or manual product resolution.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Vendors">
                    <AsyncMultiSelect value={form.filters.vendorIds} onChange={(next) => setNestedField(setForm, "filters", "vendorIds", next)} loadOptions={optionLoaders.vendors} placeholder="Search vendors..." />
                  </Field>
                  <Field label="Categories">
                    <AsyncMultiSelect value={form.filters.categoryIds} onChange={(next) => setNestedField(setForm, "filters", "categoryIds", next)} loadOptions={optionLoaders.categories} placeholder="Search categories..." />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Subcategories">
                    <AsyncMultiSelect value={form.filters.subCategoryIds} onChange={(next) => setNestedField(setForm, "filters", "subCategoryIds", next)} loadOptions={optionLoaders.subcategories} placeholder="Search subcategories..." />
                  </Field>
                  <Field label="Brands">
                    <AsyncMultiSelect value={form.filters.brandIds} onChange={(next) => setNestedField(setForm, "filters", "brandIds", next)} loadOptions={optionLoaders.brands} placeholder="Search brands..." />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Tags">
                    <AsyncMultiSelect value={form.filters.tags} onChange={(next) => setNestedField(setForm, "filters", "tags", next)} loadOptions={optionLoaders.tags} placeholder="Search tags..." />
                  </Field>
                  <Field label="Sort By">
                    <select value={form.filters.sortBy} onChange={(event) => setNestedField(setForm, "filters", "sortBy", event.target.value)} className={inputClassName}>
                      {["BEST_SELLING", "HIGHEST_DISCOUNT", "NEWEST", "TRENDING", "PRICE_LOW_TO_HIGH", "PRICE_HIGH_TO_LOW", "MOST_VIEWED", "TOP_RATED", "RANDOM"].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
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

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Maximum Products">
                    <input type="number" min="1" max="100" value={form.filters.maxProductsToShow} onChange={(event) => setNestedField(setForm, "filters", "maxProductsToShow", event.target.value)} className={inputClassName} />
                  </Field>
                  <Field label="Selection Mode">
                    <select value={form.filters.productSelectionMode} onChange={(event) => setNestedField(setForm, "filters", "productSelectionMode", event.target.value)} className={inputClassName}>
                      <option value="AUTO">AUTO</option>
                      <option value="MANUAL">MANUAL</option>
                    </select>
                  </Field>
                  <Toggle label="Show Only In Stock" checked={form.filters.showOnlyInStock} onChange={(checked) => setNestedField(setForm, "filters", "showOnlyInStock", checked)} />
                </div>

                {form.filters.productSelectionMode === "MANUAL" ? (
                  <Field label="Manual Products">
                    <AsyncMultiSelect value={form.filters.manualProductIds} onChange={(next) => setNestedField(setForm, "filters", "manualProductIds", next)} loadOptions={optionLoaders.products} placeholder="Search products..." />
                  </Field>
                ) : null}
              </FieldGroup>
            ) : null}

            <FieldGroup icon={Save} title="Type-Specific Fields" description="Only fields for the selected container type are rendered here.">
              <AnimatePresence mode="wait">
                <Motion.div
                  key={activeSchema?.type || form.containerType}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {(activeSchema?.typeFields || []).map((field) => (
                    <FieldRenderer
                      key={field.name}
                      field={field}
                      value={form.config[field.name] ?? ""}
                      onChange={(value) => setForm((current) => ({ ...current, config: { ...current.config, [field.name]: value } }))}
                      loadOptions={optionLoaders[field.source]}
                    />
                  ))}
                </Motion.div>
              </AnimatePresence>
            </FieldGroup>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={handlePreview} disabled={previewLoading} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">
                {previewLoading ? "Loading Preview..." : "Preview Container"}
              </button>
              <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">
                {saving ? "Saving..." : editingId ? "Update Container" : "Create Container"}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
              <Eye className="h-4 w-4" />
              Live Preview
            </div>
            <PreviewPanel preview={preview} loading={previewLoading} />
          </div>
        </section>
      </div>
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

function FieldGroup(props) {
  const IconComponent = props.icon;
  const { title, description, children } = props;
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
          <IconComponent className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function FieldRenderer({ field, value, onChange, loadOptions }) {
  if (field.type === "boolean") {
    return <Toggle label={field.label} checked={Boolean(value)} onChange={onChange} />;
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
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
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
          rows={field.type === "array" ? 5 : 3}
          className={inputClassName}
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
        onChange={(event) => onChange(field.type === "number" ? event.target.value : event.target.value)}
        className={inputClassName}
      />
    </Field>
  );
}

function PreviewPanel({ preview, loading }) {
  if (loading) {
    return <div className="h-44 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />;
  }

  if (!preview) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Run preview to inspect resolved products before publishing.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill>{preview?.container?.containerType}</StatusPill>
        <StatusPill>{preview?.products?.length || 0} products</StatusPill>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(preview?.products || []).slice(0, 6).map((product) => (
          <div key={product._id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{product.name}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{product.category}</div>
            <div className="mt-2 text-sm font-medium text-emerald-600">{formatCurrency(product.discountPrice || product.price || 0)}</div>
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

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
      <span className="font-medium text-slate-900 dark:text-white">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">{label}</span>
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

const inputClassName =
  "w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";

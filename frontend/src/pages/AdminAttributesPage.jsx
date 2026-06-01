import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { useCategories } from "../hooks/useCategories";
import { getSubcategoriesByCategory } from "../services/subcategoryService";
import { listAdminProductModules } from "../services/productModuleService";
import {
  createAdminAttribute,
  deleteAdminAttribute,
  listAdminAttributes,
  updateAdminAttribute,
} from "../services/attributeService";

const initialForm = {
  name: "",
  key: "",
  type: "text",
  required: false,
  isVariant: false,
  useInFilters: false,
  variantDisplayType: "button",
  variantAffectsImage: false,
  options: "",
  moduleKey: "",
  order: 0,
  categoryId: "",
  subCategoryId: "",
  template: "",
  isActive: true,
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminAttributesPage() {
  const { categories } = useCategories({ includeInactive: true });
  const [subcategories, setSubcategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [modules, setModules] = useState([]);
  const [activeModuleFilter, setActiveModuleFilter] = useState("all");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(initialForm);

  const modulesByKey = useMemo(
    () => Object.fromEntries(modules.map((moduleDef) => [moduleDef.key, moduleDef])),
    [modules]
  );

  const groupedAttributes = useMemo(() => {
    const grouped = {};
    for (const item of attributes) {
      const moduleKey = item.moduleKey || "unassigned";
      if (activeModuleFilter !== "all" && moduleKey !== activeModuleFilter) continue;
      if (!grouped[moduleKey]) grouped[moduleKey] = [];
      grouped[moduleKey].push(item);
    }
    return grouped;
  }, [activeModuleFilter, attributes]);

  const visibleModuleKeys = useMemo(() => {
    const orderedKeys = modules.map((moduleDef) => moduleDef.key);
    const extraKeys = Object.keys(groupedAttributes).filter((key) => !orderedKeys.includes(key));
    return [...orderedKeys, ...extraKeys].filter((key) => groupedAttributes[key]?.length);
  }, [groupedAttributes, modules]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [attributeRes, moduleRes] = await Promise.all([listAdminAttributes(), listAdminProductModules()]);
      setAttributes(Array.isArray(attributeRes?.data) ? attributeRes.data : []);
      setModules(Array.isArray(moduleRes?.data) ? moduleRes.data : []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadSubcategories() {
      if (!form.categoryId) {
        setSubcategories([]);
        return;
      }
      try {
        const res = await getSubcategoriesByCategory(form.categoryId);
        if (!cancelled) setSubcategories(Array.isArray(res?.data) ? res.data : []);
      } catch {
        if (!cancelled) setSubcategories([]);
      }
    }
    loadSubcategories();
    return () => {
      cancelled = true;
    };
  }, [form.categoryId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        key: form.key,
        type: form.type,
        required: form.required,
        isVariant: form.isVariant,
        useInFilters: form.useInFilters,
        variantConfig: {
          displayType: form.variantDisplayType,
          affectsImage: form.variantAffectsImage,
        },
        options: form.options
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        moduleKey: form.moduleKey,
        order: Number(form.order || 0),
        template: form.template,
        isActive: form.isActive,
        appliesTo: {
          categoryId: form.categoryId,
          subCategoryId: form.subCategoryId || null,
        },
      };

      if (editingId) {
        await updateAdminAttribute(editingId, payload);
      } else {
        await createAdminAttribute(payload);
      }

      setEditingId("");
      setForm(initialForm);
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item) {
    setEditingId(item._id);
    setForm({
      name: item.name || "",
      key: item.key || "",
      type: item.type || "text",
      required: Boolean(item.required),
      isVariant: Boolean(item.isVariant),
      useInFilters: Boolean(item.useInFilters),
      variantDisplayType: item.variantConfig?.displayType || "button",
      variantAffectsImage: Boolean(item.variantConfig?.affectsImage),
      options: (item.options || []).join(", "),
      moduleKey: item.moduleKey || "",
      order: item.order || 0,
      categoryId: item.appliesTo?.categoryId?._id || item.appliesTo?.categoryId || "",
      subCategoryId: item.appliesTo?.subCategoryId?._id || item.appliesTo?.subCategoryId || "",
      template: item.template || "",
      isActive: item.isActive !== false,
    });
  }

  async function handleDelete(id) {
    if (!(await confirmAction({ message: "Delete this attribute?", tone: "danger", confirmLabel: "Confirm" }))) return;
    try {
      await deleteAdminAttribute(id);
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Module-driven fields</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create fields in the attributes tab and classify them by module using the module names at the top.
        </p>
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : null}
        {modules.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveModuleFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                activeModuleFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              All
            </button>
            {modules.map((moduleDef) => (
              <button
                type="button"
                key={moduleDef._id}
                onClick={() => setActiveModuleFilter(moduleDef.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeModuleFilter === moduleDef.key
                    ? "bg-slate-900 text-white"
                    : moduleDef.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {moduleDef.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No modules found. Create modules in `/admin/product-modules` first, then attach fields here.
          </div>
        )}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Loading...</div>
          ) : visibleModuleKeys.length ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {visibleModuleKeys.map((moduleKey) => {
                const moduleDef = modulesByKey[moduleKey];
                const items = groupedAttributes[moduleKey] || [];
                return (
                  <div key={moduleKey}>
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
                      {moduleDef?.name || items[0]?.group || moduleKey}
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {items.map((item) => (
                        <div key={item._id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                              {item.name} ({item.key})
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {item.type} • {item.isVariant ? `Variant / ${item.variantConfig?.displayType || "button"}` : "Standard field"} •{" "}
                              {item.useInFilters ? "Filter systems enabled" : "Filter systems disabled"} •{" "}
                              {item.appliesTo?.categoryId?.name || "Category"} / {item.appliesTo?.subCategoryId?.name || "All subcategories"}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => startEdit(item)} className="rounded-xl border px-3 py-1 text-xs">
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDelete(item._id)} className="rounded-xl border px-3 py-1 text-xs text-rose-700">
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-sm text-slate-500">No fields found for the selected module.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{editingId ? "Edit field" : "Create field"}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose the destination module, then define the reusable field once for the selected category and subcategory scope.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Key (e.g. ram)" value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} required />
          <select className="rounded-xl border px-3 py-2 text-sm" value={form.moduleKey} onChange={(e) => setForm((p) => ({ ...p, moduleKey: e.target.value }))} required>
            <option value="">{modules.length ? "Select module" : "Create a module first"}</option>
            {modules.map((moduleDef) => (
              <option key={moduleDef._id} value={moduleDef.key}>
                {moduleDef.name}
              </option>
            ))}
          </select>
          <select className="rounded-xl border px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            {["text", "number", "select", "multi-select", "boolean", "color"].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Options (comma separated)" value={form.options} onChange={(e) => setForm((p) => ({ ...p, options: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isVariant} onChange={(e) => setForm((p) => ({ ...p, isVariant: e.target.checked }))} />
            Use as variant type
          </label>
          <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Filter systems</div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.useInFilters} onChange={(e) => setForm((p) => ({ ...p, useInFilters: e.target.checked }))} />
              Enable this field in dynamic storefront filters
            </label>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Only attributes with this flag enabled will appear as storefront filters for the selected scope.
            </p>
          </div>
          {form.isVariant ? (
            <>
              <select className="rounded-xl border px-3 py-2 text-sm" value={form.variantDisplayType} onChange={(e) => setForm((p) => ({ ...p, variantDisplayType: e.target.value }))}>
                {["button", "swatch", "image-swatch"].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.variantAffectsImage} onChange={(e) => setForm((p) => ({ ...p, variantAffectsImage: e.target.checked }))} />
                Variant changes image gallery
              </label>
            </>
          ) : null}
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Template (optional)" value={form.template} onChange={(e) => setForm((p) => ({ ...p, template: e.target.value }))} />
          <input className="rounded-xl border px-3 py-2 text-sm" type="number" min="0" value={form.order} onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))} />
          <select className="rounded-xl border px-3 py-2 text-sm" value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value, subCategoryId: "" }))} required>
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
          <select className="rounded-xl border px-3 py-2 text-sm" value={form.subCategoryId} onChange={(e) => setForm((p) => ({ ...p, subCategoryId: e.target.value }))}>
            <option value="">All subcategories</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory._id} value={subcategory._id}>{subcategory.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.required} onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))} />
            Required
          </label>
          <button type="submit" disabled={saving || !modules.length} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : editingId ? "Update field" : "Create field"}
          </button>
        </form>
      </section>
    </div>
  );
}

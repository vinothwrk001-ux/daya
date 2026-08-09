import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { useCategories } from "../hooks/useCategories";
import { listAdminSubcategories } from "../services/subcategoryService";
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
  categoryIds: [],
  subCategoryIds: [],
  template: "",
  isActive: true,
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminAttributesPage() {
  const { categories } = useCategories({ includeInactive: true });
  const [allSubcategories, setAllSubcategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [modules, setModules] = useState([]);
  const [activeModuleFilter, setActiveModuleFilter] = useState("all");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(initialForm);

  const subcategories = useMemo(() => {
    if (!form.categoryIds || !form.categoryIds.length) return [];
    return allSubcategories.filter(s => form.categoryIds.includes(String(s.categoryId?._id || s.categoryId)));
  }, [allSubcategories, form.categoryIds]);

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
      const [attributeRes, moduleRes, subcategoryRes] = await Promise.all([
        listAdminAttributes(), 
        listAdminProductModules(),
        listAdminSubcategories()
      ]);
      setAttributes(Array.isArray(attributeRes?.data) ? attributeRes.data : []);
      setModules(Array.isArray(moduleRes?.data) ? moduleRes.data : []);
      setAllSubcategories(Array.isArray(subcategoryRes?.data) ? subcategoryRes.data : []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
          categoryIds: form.categoryIds,
          subCategoryIds: form.subCategoryIds,
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
      categoryIds: (item.appliesTo?.categoryIds || []).map(c => typeof c === 'object' ? c._id : c),
      subCategoryIds: (item.appliesTo?.subCategoryIds || []).map(s => typeof s === 'object' ? s._id : s),
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
                              {item.appliesTo?.categoryIds?.map(c => c.name).join(", ") || "Categories"} / {item.appliesTo?.subCategoryIds?.length ? item.appliesTo.subCategoryIds.map(s => s.name).join(", ") : "All subcategories"}
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
          <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Categories (Required)</div>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {categories
                .filter((category) => !category.redirectToServices && (category.isActive !== false || form.categoryIds.includes(category._id)))
                .map((category) => (
                <label key={category._id} className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={form.categoryIds.includes(category._id)}
                    onChange={(e) => {
                      const newIds = e.target.checked 
                        ? [...form.categoryIds, category._id]
                        : form.categoryIds.filter(id => id !== category._id);
                      setForm(p => ({ 
                        ...p, 
                        categoryIds: newIds, 
                        subCategoryIds: p.subCategoryIds.filter(sid => {
                          const sub = allSubcategories.find(s => s._id === sid);
                          return sub && newIds.includes(String(sub.categoryId?._id || sub.categoryId));
                        }) 
                      }));
                    }}
                  />
                  {category.name}
                </label>
              ))}
            </div>
            {form.categoryIds.length === 0 && (
              <p className="mt-2 text-xs text-rose-500">Please select at least one category.</p>
            )}
          </div>

          {form.categoryIds.length > 0 && subcategories.length > 0 && (
            <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Subcategories (Optional)</div>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {subcategories.map((subcategory) => (
                  <label key={subcategory._id} className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={form.subCategoryIds.includes(subcategory._id)}
                      onChange={(e) => {
                        const newIds = e.target.checked 
                          ? [...form.subCategoryIds, subcategory._id]
                          : form.subCategoryIds.filter(id => id !== subcategory._id);
                        setForm(p => ({ ...p, subCategoryIds: newIds }));
                      }}
                    />
                    {subcategory.name}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">If none are selected, the attribute applies to all subcategories under the selected categories.</p>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.required} onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))} />
            Required
          </label>
          <button type="submit" disabled={saving || !modules.length || form.categoryIds.length === 0} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : editingId ? "Update field" : "Create field"}
          </button>
        </form>
      </section>
    </div>
  );
}

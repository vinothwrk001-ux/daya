import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { useCategories } from "../hooks/useCategories";
import {
  createSubcategory,
  deleteSubcategory,
  listSubcategories,
  toggleSubcategoryStatus,
  updateSubcategory,
} from "../services/adminApi";

const initialForm = {
  name: "",
  code: "",
  categoryId: "",
  status: "active",
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminSubcategoriesPage() {
  const { categories, loading: categoriesLoading } = useCategories({ includeInactive: true });
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(initialForm);

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category._id, category.name])),
    [categories]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listSubcategories();
      setSubcategories(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function resetForm() {
    setEditingId("");
    setForm(initialForm);
  }

  function onNameChange(value) {
    setForm((current) => {
      const nextName = value;
      const shouldAutoFillCode = !current.code || current.code === (current.name || "").charAt(0).toUpperCase();
      return {
        ...current,
        name: nextName,
        code: shouldAutoFillCode ? nextName.charAt(0).toUpperCase() : current.code,
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.categoryId) {
      setError("Category is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        code: form.code,
        categoryId: form.categoryId,
        status: form.status,
      };
      if (editingId) {
        await updateSubcategory(editingId, payload);
      } else {
        await createSubcategory(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!(await confirmAction({ message: "Delete this subcategory?", tone: "danger", confirmLabel: "Confirm" }))) return;
    try {
      await deleteSubcategory(id);
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function handleStatusToggle(item) {
    const nextStatus = item.status === "active" ? "disabled" : "active";
    try {
      await toggleSubcategoryStatus(item._id, nextStatus);
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  function startEdit(item) {
    setEditingId(item._id);
    setForm({
      name: item.name || "",
      code: item.code || "",
      categoryId: item.categoryId?._id || item.categoryId || "",
      status: item.status || "active",
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Subcategory management</h2>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Active subcategories are available while creating products.
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : subcategories.length ? (
            <div>
              <div className="grid grid-cols-4 gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span>Name</span>
                <span>Category</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {subcategories.map((item) => (
                  <div key={item._id} className="grid grid-cols-4 gap-3 px-4 py-4 text-sm">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {item.name}
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.code}</div>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300">
                      {item.categoryId?.name || categoryMap[item.categoryId] || "Unknown"}
                    </div>
                    <div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          item.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {item.status === "active" ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(item)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {item.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item._id)}
                        className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No subcategories created yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{editingId ? "Edit subcategory" : "Create subcategory"}</h2>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Subcategory name</span>
            <input
              value={form.name}
              onChange={(event) => onNameChange(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
            <select
              value={form.categoryId}
              onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              required
              disabled={categoriesLoading}
            >
              <option value="">{categoriesLoading ? "Loading..." : "Select category"}</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Code</span>
            <input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="Auto-generated from first letter"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {saving ? "Saving..." : editingId ? "Update subcategory" : "Create subcategory"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}

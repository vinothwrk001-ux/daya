import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "../services/notificationService";
import {
  createAdminProductModule,
  deleteAdminProductModule,
  listAdminProductModules,
  updateAdminProductModule,
} from "../services/productModuleService";

const initialForm = {
  name: "",
  key: "",
  order: 0,
  isActive: true,
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminProductModulesPage() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(initialForm);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAdminProductModules();
      setModules(Array.isArray(res?.data) ? res.data : []);
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
        order: Number(form.order || 0),
        isActive: form.isActive,
        fields: [],
      };

      if (editingId) {
        await updateAdminProductModule(editingId, payload);
      } else {
        await createAdminProductModule(payload);
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
      order: item.order || 0,
      isActive: item.isActive !== false,
    });
  }

  async function handleDelete(id) {
    if (!(await confirmAction({ message: "Delete this module?", tone: "danger", confirmLabel: "Confirm" }))) return;
    try {
      await deleteAdminProductModule(id);
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Product modules</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Modules only define the group container. Add the actual fields from the attributes tab using the module dropdown.
        </p>
        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Loading...</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {modules.map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{item.name} ({item.key})</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Order {item.order ?? 0} • {item.isActive ? "Active" : "Hidden"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(item)} className="rounded-xl border px-3 py-1 text-xs">Edit</button>
                    <button type="button" onClick={() => handleDelete(item._id)} className="rounded-xl border px-3 py-1 text-xs text-rose-700">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{editingId ? "Edit product module" : "Create product module"}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create just the module shell here. Then go to `/admin/attributes` to attach reusable fields to that module.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Key" value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} required />
          <input className="rounded-xl border px-3 py-2 text-sm" type="number" min="0" placeholder="Order" value={form.order} onChange={(e) => setForm((prev) => ({ ...prev, order: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
            Active
          </label>
          <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : editingId ? "Update module" : "Create module"}
          </button>
        </form>
      </section>
    </div>
  );
}

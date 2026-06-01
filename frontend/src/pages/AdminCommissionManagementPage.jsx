import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import {
  createCommissionRule,
  deleteCommissionRule,
  getCommissionAnalytics,
  listCategories,
  listProducts,
  listCommissionRules,
  listSellers,
  toggleCommissionRuleActive,
  updateCommissionRule,
} from "../services/adminApi";
import { formatCurrency } from "../utils/formatCurrency";

const initialForm = {
  name: "",
  type: "percentage",
  value: 0,
  appliesTo: "global",
  categoryId: "",
  vendorId: "",
  productId: "",
  priority: 0,
  active: true,
  startDate: "",
  endDate: "",
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminCommissionManagementPage() {
  const [rules, setRules] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rulesRes, analyticsRes, vendorsRes, categoriesRes, productsRes] = await Promise.all([
        listCommissionRules(),
        getCommissionAnalytics({ days: 30 }),
        listSellers({ status: "approved" }),
        listCategories(),
        listProducts({ limit: 200 }),
      ]);
      setRules(rulesRes?.data?.rules || []);
      setAnalytics(analyticsRes?.data || null);
      setVendors(vendorsRes?.data || []);
      setCategories(categoriesRes?.data || []);
      setProducts(productsRes?.data?.products || productsRes?.data || []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const isEditing = Boolean(editId);
  const summary = useMemo(
    () => ({
      total: rules.length,
      active: rules.filter((rule) => rule.active).length,
      commission30d: Number(analytics?.totalPlatformCommission || 0),
      commissionOrders30d: Number(analytics?.totalCommissionOrders || 0),
    }),
    [analytics, rules]
  );

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...form,
        value: Number(form.value || 0),
        priority: Number(form.priority || 0),
        categoryId: form.appliesTo === "category" ? form.categoryId || undefined : undefined,
        vendorId: form.appliesTo === "vendor" ? form.vendorId || undefined : undefined,
        productId: form.appliesTo === "product" ? form.productId || undefined : undefined,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      };
      if (isEditing) {
        await updateCommissionRule(editId, payload);
      } else {
        await createCommissionRule(payload);
      }
      setForm(initialForm);
      setEditId("");
      setSuccess(isEditing ? "Commission rule updated." : "Commission rule created.");
      await load();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(rule) {
    setEditId(rule._id);
    setForm({
      name: rule.name || "",
      type: rule.type || "percentage",
      value: Number(rule.value || 0),
      appliesTo: rule.appliesTo || "global",
      categoryId: rule.categoryId || "",
      vendorId: rule.vendorId || "",
      productId: rule.productId || "",
      priority: Number(rule.priority || 0),
      active: Boolean(rule.active),
      startDate: rule.startDate ? String(rule.startDate).slice(0, 10) : "",
      endDate: rule.endDate ? String(rule.endDate).slice(0, 10) : "",
    });
  }

  async function handleToggleRule(rule) {
    setBusyRuleId(rule._id);
    setError("");
    setSuccess("");
    try {
      await toggleCommissionRuleActive(rule._id, !rule.active);
      setSuccess(`Commission rule ${rule.active ? "deactivated" : "activated"}.`);
      await load();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyRuleId("");
    }
  }

  async function handleDeleteRule(rule) {
    const confirmed = await confirmAction({
      title: "Delete commission rule",
      message: `Delete commission rule "${rule.name}" permanently? This will remove it from the backend database.`,
      tone: "danger",
      confirmLabel: "Delete rule",
    });
    if (!confirmed) return;

    setBusyRuleId(rule._id);
    setError("");
    setSuccess("");
    try {
      await deleteCommissionRule(rule._id);
      if (editId === rule._id) {
        setEditId("");
        setForm(initialForm);
      }
      setSuccess("Commission rule deleted permanently.");
      await load();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyRuleId("");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Commission Management</h1>
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4">Rules: <strong>{summary.total}</strong></div>
        <div className="rounded-xl border p-4">Active: <strong>{summary.active}</strong></div>
        <div className="rounded-xl border p-4">30d Commission: <strong>{formatCurrency(summary.commission30d)}</strong></div>
        <div className="rounded-xl border p-4">30d Orders: <strong>{summary.commissionOrders30d}</strong></div>
      </div>

      <form onSubmit={submit} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Name
          <input className="rounded border px-3 py-2 font-normal" placeholder="Rule name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Type
          <select className="rounded border px-3 py-2 font-normal" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            <option value="percentage">percentage</option>
            <option value="fixed">fixed</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Value
          <input className="rounded border px-3 py-2 font-normal" type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Applies To
          <select className="rounded border px-3 py-2 font-normal" value={form.appliesTo} onChange={(e) => setForm((p) => ({ ...p, appliesTo: e.target.value }))}>
            <option value="global">global</option>
            <option value="category">category</option>
            <option value="vendor">vendor</option>
            <option value="product">product</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Priority
          <input className="rounded border px-3 py-2 font-normal" type="number" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} placeholder="Priority" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
          Active
        </label>
        {form.appliesTo === "category" ? (
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Category ID
            <select
              className="rounded border px-3 py-2 font-normal"
              value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category._id} - {category.name || "Category"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {form.appliesTo === "vendor" ? (
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Vendor ID
            <select
              className="rounded border px-3 py-2 font-normal"
              value={form.vendorId}
              onChange={(e) => setForm((p) => ({ ...p, vendorId: e.target.value }))}
              required
            >
              <option value="">Select vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor._id} value={vendor._id}>
                  {(vendor.vendorCode || vendor._id)} - {vendor.shopName || vendor.companyName || vendor.userId?.name || "Vendor"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {form.appliesTo === "product" ? (
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Product ID
            <select
              className="rounded border px-3 py-2 font-normal"
              value={form.productId}
              onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
              required
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product._id} - {product.name || "Product"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Start Date
          <input className="rounded border px-3 py-2 font-normal" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          End Date
          <input className="rounded border px-3 py-2 font-normal" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
        </label>
        <button disabled={saving} className="rounded bg-slate-900 px-3 py-2 text-white" type="submit">{saving ? "Saving..." : isEditing ? "Update rule" : "Create rule"}</button>
      </form>

      <div className="overflow-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Scope</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="px-3 py-3" colSpan={7}>Loading...</td></tr> : null}
            {!loading && !rules.length ? <tr><td className="px-3 py-3" colSpan={7}>No commission rules.</td></tr> : null}
            {rules.map((rule) => (
              <tr key={rule._id} className="border-t">
                <td className="px-3 py-2">{rule.name}</td>
                <td className="px-3 py-2">{rule.appliesTo}</td>
                <td className="px-3 py-2">{rule.type}</td>
                <td className="px-3 py-2">{rule.type === "percentage" ? `${rule.value}%` : formatCurrency(rule.value)}</td>
                <td className="px-3 py-2">{rule.priority}</td>
                <td className="px-3 py-2">{rule.active ? "Active" : "Inactive"}</td>
                <td className="px-3 py-2 space-x-2">
                  <button
                    type="button"
                    disabled={busyRuleId === rule._id}
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    onClick={() => startEdit(rule)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyRuleId === rule._id}
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    onClick={() => handleToggleRule(rule)}
                  >
                    {rule.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={busyRuleId === rule._id}
                    className="rounded border border-rose-300 px-2 py-1 text-rose-700 disabled:opacity-50"
                    onClick={() => handleDeleteRule(rule)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


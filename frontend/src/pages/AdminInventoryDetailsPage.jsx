import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adjustAdminInventory,
  getAdminInventoryLedger,
  getAdminInventoryProduct,
  updateAdminInventoryThreshold,
} from "../services/adminApi";
import { formatCurrency } from "../utils/formatCurrency";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Failed to load admin inventory";
}

export function AdminInventoryDetailsPage() {
  const { productId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inventory, setInventory] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [variantSearch, setVariantSearch] = useState("");
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [thresholdValue, setThresholdValue] = useState(0);
  const [adjustmentForm, setAdjustmentForm] = useState({ quantityChange: 0, reason: "", notes: "" });

  useEffect(() => {
    loadInventory();
  }, [productId]);

  useEffect(() => {
    if (!selectedVariant?.variantId) return;
    loadLedger(selectedVariant.variantId);
  }, [productId, selectedVariant?.variantId]);

  async function loadInventory() {
    setLoading(true);
    setError("");
    try {
      const response = await getAdminInventoryProduct(productId);
      const nextInventory = response.data;
      setInventory(nextInventory);
      setSelectedVariant((current) => {
        if (!nextInventory?.variants?.length) return null;
        if (!current) return nextInventory.variants[0];
        return nextInventory.variants.find((variant) => variant.variantId === current.variantId) || nextInventory.variants[0];
      });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger(variantId) {
    setLedgerLoading(true);
    try {
      const response = await getAdminInventoryLedger(productId, variantId, { limit: 20, offset: 0 });
      setLedger(response.data?.ledger || []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLedgerLoading(false);
    }
  }

  async function handleAdjustStock() {
    if (!selectedVariant || !adjustmentForm.reason.trim()) {
      setError("Please select a variant and provide a reason");
      return;
    }
    try {
      await adjustAdminInventory(productId, selectedVariant.variantId, adjustmentForm);
      setAdjustmentForm({ quantityChange: 0, reason: "", notes: "" });
      await loadInventory();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function handleUpdateThreshold() {
    if (!selectedVariant) return;
    try {
      await updateAdminInventoryThreshold(productId, selectedVariant.variantId, thresholdValue);
      await loadInventory();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  const filteredVariants = useMemo(() => {
    const variants = inventory?.variants || [];
    const query = variantSearch.trim().toLowerCase();
    if (!query) return variants;
    return variants.filter(
      (variant) =>
        String(variant.variantTitle || "").toLowerCase().includes(query) ||
        String(variant.sku || "").toLowerCase().includes(query)
    );
  }, [inventory?.variants, variantSearch]);

  if (loading) {
    return <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>;
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/inventory" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:text-slate-200">
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{inventory?.productName}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Platform inventory details for admin-created product variants.</p>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-xs text-slate-500">Total Stock</div><div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{inventory?.totalStock || 0}</div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-xs text-slate-500">Reserved</div><div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{inventory?.totalReservedStock || 0}</div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-xs text-slate-500">Available</div><div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{inventory?.totalAvailableStock || 0}</div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-xs text-slate-500">Alert</div><div className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{inventory?.alertStatus || "OK"}</div></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <input
              value={variantSearch}
              onChange={(event) => setVariantSearch(event.target.value)}
              placeholder="Search variants by name or SKU"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Variant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Reserved</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Available</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Threshold</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredVariants.map((variant) => (
                  <tr
                    key={variant.variantId}
                    onClick={() => {
                      setSelectedVariant(variant);
                      setThresholdValue(variant.threshold);
                    }}
                    className={`cursor-pointer ${selectedVariant?.variantId === variant.variantId ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                  >
                    <td className="px-4 py-4 font-semibold text-slate-950 dark:text-white">{variant.variantTitle}</td>
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{variant.sku}</td>
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{formatCurrency(variant.price)}</td>
                    <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-200">{variant.stock}</td>
                    <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-200">{variant.reserved}</td>
                    <td className="px-4 py-4 text-right text-sm font-semibold text-slate-950 dark:text-white">{variant.available}</td>
                    <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-200">{variant.threshold}</td>
                    <td className="px-4 py-4 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${variant.isLowStock ? "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>{variant.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Admin Control Drawer</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Adjust stock and inspect warehouse ledger for the selected platform variant.</p>
          </div>

          {selectedVariant ? (
            <>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="text-base font-semibold text-slate-950 dark:text-white">{selectedVariant.variantTitle}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{selectedVariant.sku}</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-slate-400">Price</div><div className="font-semibold text-slate-950 dark:text-white">{formatCurrency(selectedVariant.price)}</div></div>
                  <div><div className="text-xs text-slate-400">Available</div><div className="font-semibold text-slate-950 dark:text-white">{selectedVariant.available}</div></div>
                  <div><div className="text-xs text-slate-400">Stock</div><div className="font-semibold text-slate-950 dark:text-white">{selectedVariant.stock}</div></div>
                  <div><div className="text-xs text-slate-400">Reserved</div><div className="font-semibold text-slate-950 dark:text-white">{selectedVariant.reserved}</div></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">Adjust Stock</div>
                <div className="mt-3 grid gap-3">
                  <input
                    type="number"
                    value={adjustmentForm.quantityChange}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, quantityChange: Number(event.target.value || 0) }))}
                    placeholder="Quantity change"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <input
                    value={adjustmentForm.reason}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Reason"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <textarea
                    value={adjustmentForm.notes}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Notes"
                    rows={3}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button onClick={handleAdjustStock} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-950">
                    Apply Adjustment
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">Low Stock Threshold</div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={thresholdValue}
                    onChange={(event) => setThresholdValue(Number(event.target.value || 0))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button onClick={handleUpdateThreshold} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700 dark:text-slate-200">
                    Update
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 dark:border-slate-800 dark:text-white">Recent Ledger</div>
                <div className="max-h-[320px] overflow-auto">
                  {ledgerLoading ? (
                    <div className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading ledger...</div>
                  ) : ledger.length ? (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {ledger.map((entry) => (
                        <div key={entry._id} className="p-4 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-slate-950 dark:text-white">{entry.transactionType}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{entry.reason || "Inventory update"}</div>
                            </div>
                            <div className={`font-semibold ${Number(entry.quantityChange) < 0 ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                              {Number(entry.quantityChange) > 0 ? "+" : ""}{entry.quantityChange}
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div>Stock: {entry.stockBefore} to {entry.stockAfter}</div>
                            <div>Reserved: {entry.reservedBefore} to {entry.reservedAfter}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-slate-500 dark:text-slate-400">No ledger entries yet.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Select a variant to manage platform inventory.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

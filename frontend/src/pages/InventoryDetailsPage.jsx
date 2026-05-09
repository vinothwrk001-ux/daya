import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as inventoryService from "../services/inventoryService";
import { formatCurrency } from "../utils/formatCurrency";

export function InventoryDetailsPage() {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inventory, setInventory] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [variantSearch, setVariantSearch] = useState("");
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    quantityChange: 0,
    reason: "",
    notes: "",
  });
  const [thresholdValue, setThresholdValue] = useState(0);

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
      const response = await inventoryService.getProductInventory(productId);
      const nextInventory = response.data;
      setInventory(nextInventory);
      setSelectedVariant((current) => {
        if (!nextInventory?.variants?.length) return null;
        if (!current) return nextInventory.variants[0];
        return nextInventory.variants.find((variant) => variant.variantId === current.variantId) || nextInventory.variants[0];
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger(variantId) {
    setLedgerLoading(true);
    try {
      const response = await inventoryService.getVariantLedger(productId, variantId, 20, 0);
      setLedger(response.data?.ledger || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load variant ledger");
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
      await inventoryService.adjustStock(
        productId,
        selectedVariant.variantId,
        adjustmentForm.quantityChange,
        adjustmentForm.reason,
        adjustmentForm.notes
      );
      setShowAdjustmentModal(false);
      setAdjustmentForm({ quantityChange: 0, reason: "", notes: "" });
      await loadInventory();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to adjust stock");
    }
  }

  async function handleUpdateThreshold() {
    if (!selectedVariant) return;

    try {
      await inventoryService.updateThreshold(productId, selectedVariant.variantId, thresholdValue);
      setShowThresholdModal(false);
      await loadInventory();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update threshold");
    }
  }

  async function handleExportCSV() {
    try {
      await inventoryService.exportInventoryCSV(productId);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export inventory");
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
    return (
      <div className="space-y-4 p-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/vendor/inventory")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Back
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">{inventory?.productName}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Warehouse view for {inventory?.variantCount} variant{inventory?.variantCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline hover:no-underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {inventory ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Stock</div>
            <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{inventory.totalStock.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Reserved Stock</div>
            <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{inventory.totalReservedStock.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Available Stock</div>
            <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{inventory.totalAvailableStock.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Alert Status</div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">
              <span className={`h-1.5 w-1.5 rounded-full ${inventory.alertStatus === "ALERT" ? "bg-red-500" : "bg-green-500"}`} />
              {inventory.alertStatus}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            setAdjustmentForm({ quantityChange: 0, reason: "", notes: "" });
            setShowAdjustmentModal(true);
          }}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-950"
        >
          Adjust Stock
        </button>
        <button
          onClick={() => {
            if (!selectedVariant) return;
            setThresholdValue(selectedVariant.threshold);
            setShowThresholdModal(true);
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Update Threshold
        </button>
        <button
          onClick={handleExportCSV}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={variantSearch}
          onChange={(event) => setVariantSearch(event.target.value)}
          placeholder="Search variants by name or SKU..."
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:max-w-md"
        />
        {selectedVariant ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Active variant: <span>{selectedVariant.variantTitle}</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Variant Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Reserved</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Available</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Threshold</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredVariants.map((variant) => (
                  <tr
                    key={variant.variantId}
                    onClick={() => setSelectedVariant(variant)}
                    className={`cursor-pointer border-b border-slate-200 ${
                      selectedVariant?.variantId === variant.variantId
                        ? "bg-blue-50 dark:bg-blue-950/20"
                        : "hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-950 dark:text-white">{variant.variantTitle}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{variant.sku}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(variant.price)}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-950 dark:text-white">{variant.stock}</td>
                    <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400">{variant.reserved}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-950 dark:text-white">{variant.available}</td>
                    <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400">{variant.threshold}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          variant.isLowStock
                            ? "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                            : "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-200"
                        }`}
                      >
                        {variant.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Detail Drawer</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Stock pressure, reserve state, and transaction history for the selected variant.
            </p>
          </div>

          {selectedVariant ? (
            <>
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-950 dark:text-white">{selectedVariant.variantTitle}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{selectedVariant.sku}</div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      selectedVariant.isLowStock
                        ? "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                    }`}
                  >
                    {selectedVariant.status}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Price</div>
                    <div className="font-semibold text-slate-950 dark:text-white">{formatCurrency(selectedVariant.price)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Threshold</div>
                    <div className="font-semibold text-slate-950 dark:text-white">{selectedVariant.threshold}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Stock</div>
                    <div className="font-semibold text-slate-950 dark:text-white">{selectedVariant.stock}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Reserved</div>
                    <div className="font-semibold text-slate-950 dark:text-white">{selectedVariant.reserved}</div>
                  </div>
                  <div className="col-span-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Available</div>
                    <div className="font-semibold text-slate-950 dark:text-white">{selectedVariant.available}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">Recent Ledger</div>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  {ledgerLoading ? (
                    <div className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading ledger...</div>
                  ) : ledger.length ? (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {ledger.map((entry) => (
                        <div key={entry._id} className="p-4 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-950 dark:text-white">{entry.transactionType}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{entry.reason || "Inventory update"}</div>
                            </div>
                            <div className="text-right">
                              <div className={`font-semibold ${Number(entry.quantityChange) < 0 ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                                {Number(entry.quantityChange) > 0 ? "+" : ""}
                                {entry.quantityChange}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(entry.createdAt).toLocaleString()}
                              </div>
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
                    <div className="p-4 text-sm text-slate-500 dark:text-slate-400">No ledger entries yet for this variant.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Select a variant to inspect stock and ledger details.
            </div>
          )}
        </div>
      </div>

      {showAdjustmentModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-slate-900">
            <h2 className="mb-4 text-xl font-bold text-slate-950 dark:text-white">Adjust Stock</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Variant</label>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {selectedVariant?.variantTitle} ({selectedVariant?.sku})
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Quantity Change</label>
                <input
                  type="number"
                  value={adjustmentForm.quantityChange}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      quantityChange: Number(event.target.value || 0),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="e.g., 10 or -5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Reason *</label>
                <select
                  value={adjustmentForm.reason}
                  onChange={(event) => setAdjustmentForm((current) => ({ ...current, reason: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="">Select a reason</option>
                  <option value="Restock">Restock</option>
                  <option value="Damage">Damage</option>
                  <option value="Theft">Theft/Loss</option>
                  <option value="Recount">Recount/Correction</option>
                  <option value="Sample">Sample/Demo</option>
                  <option value="Return">Return Processing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
                <textarea
                  value={adjustmentForm.notes}
                  onChange={(event) => setAdjustmentForm((current) => ({ ...current, notes: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="Additional details..."
                  rows="3"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowAdjustmentModal(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustStock}
                className="flex-1 rounded-lg bg-slate-950 py-2 font-medium text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-950"
              >
                Adjust
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showThresholdModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-slate-900">
            <h2 className="mb-4 text-xl font-bold text-slate-950 dark:text-white">Update Threshold</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Variant</label>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {selectedVariant?.variantTitle} ({selectedVariant?.sku})
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Low Stock Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={thresholdValue}
                  onChange={(event) => setThresholdValue(Number(event.target.value || 0))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="e.g., 10"
                />
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Alert when available stock falls to or below this value.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowThresholdModal(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateThreshold}
                className="flex-1 rounded-lg bg-slate-950 py-2 font-medium text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-950"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from "react";
import { BackButton } from "../components/BackButton";
import { PricingRulesManager } from "../components/admin/PricingRulesManager";
import * as pricingService from "../services/pricingService";
import { formatCurrency } from "../utils/formatCurrency";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

export function AdminPricingPage() {
  const [tab, setTab] = useState("rules"); // "rules" or "config"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({});

  const paymentMethodGuide = [
    {
      key: "ALL",
      title: "Base pricing rules",
      description: "Use for shipping, tax, packaging, or fees that should apply to every checkout.",
      examples: "Examples: shipping fee, platform fee, packaging fee",
      className: "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white",
    },
    {
      key: "ONLINE",
      title: "Online payment pricing",
      description: "Use for gateway-side costs that only exist when the shopper pays online.",
      examples: "Examples: Razorpay fee, payment gateway GST",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100",
    },
    {
      key: "COD",
      title: "Cash on delivery pricing",
      description: "Use for operational and risk-based charges that only apply to COD orders.",
      examples: "Examples: COD handling fee, RTO risk fee",
      className: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100",
    },
  ];

  // Load pricing config
  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setLoading(true);
      setError("");
      try {
        const res = await pricingService.getAdminPricingConfig();
        if (!cancelled) {
          const data = res?.data;
          setConfig(data);
          setFormData({
            deliveryFee: data?.deliveryFee || 50,
            deliveryFreeAbove: data?.deliveryFreeAbove || 500,
            platformFeePercentage: data?.platformFeePercentage || 5,
            platformFeeCapped: data?.platformFeeCapped || 0,
            taxPercentage: data?.taxPercentage || 18,
            taxableBasis: data?.taxableBasis || "subtotal",
            handlingFee: data?.handlingFee || 0,
            bulkDiscountThreshold: data?.bulkDiscountThreshold || 3,
            bulkDiscountPercentage: data?.bulkDiscountPercentage || 5,
            maxDiscountPercentage: data?.maxDiscountPercentage || 50,
            returnWindow: data?.returnWindow || 7,
            refundProcessingDays: data?.refundProcessingDays || 3,
            notes: data?.notes || "",
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(normalizeError(e));
          setConfig(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle form input changes
  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSuccess("");
  };

  // Save pricing config
  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let res;

      if (!config?._id) {
        const initRes = await pricingService.initializePricingConfig();
        const initializedConfig = initRes?.data;
        setConfig(initializedConfig);
        res = await pricingService.updatePricingConfig(initializedConfig?._id, formData);
      } else {
        res = await pricingService.updatePricingConfig(config._id, formData);
      }

      const updatedConfig = res?.data;
      setConfig(updatedConfig);
      setSuccess("Pricing configuration updated successfully!");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setSaving(false);
    }
  };

  // Reset form to current config
  const handleReset = () => {
    if (config) {
      setFormData({
        deliveryFee: config.deliveryFee || 50,
        deliveryFreeAbove: config.deliveryFreeAbove || 500,
        platformFeePercentage: config.platformFeePercentage || 5,
        platformFeeCapped: config.platformFeeCapped || 0,
        taxPercentage: config.taxPercentage || 18,
        taxableBasis: config.taxableBasis || "subtotal",
        handlingFee: config.handlingFee || 0,
        bulkDiscountThreshold: config.bulkDiscountThreshold || 3,
        bulkDiscountPercentage: config.bulkDiscountPercentage || 5,
        maxDiscountPercentage: config.maxDiscountPercentage || 50,
        returnWindow: config.returnWindow || 7,
        refundProcessingDays: config.refundProcessingDays || 3,
        notes: config.notes || "",
      });
      setError("");
      setSuccess("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Pricing Management</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Manage pricing rules and fees</p>
        </div>
        <BackButton fallbackTo="/admin/dashboard" />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-8">
          <button
            onClick={() => setTab("rules")}
            className={`py-3 px-1 font-medium text-sm border-b-2 transition ${
              tab === "rules"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Pricing Rules
          </button>
          <button
            onClick={() => setTab("config")}
            className={`py-3 px-1 font-medium text-sm border-b-2 transition ${
              tab === "config"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Legacy Configuration
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {paymentMethodGuide.map((item) => (
          <section key={item.key} className={`rounded-3xl border p-5 shadow-sm ${item.className}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{item.key}</div>
            <h2 className="mt-2 text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm opacity-80">{item.description}</p>
            <p className="mt-3 text-xs font-medium opacity-70">{item.examples}</p>
          </section>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "rules" && (
        <div className="grid gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Dynamic payment-based pricing</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Configure marketplace checkout charges by payment mode. Each pricing rule can now target all checkouts, online-only payments, or COD-only payments. Checkout totals are always recalculated on the backend when the buyer switches payment method.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Recommended setup</div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Keep universal charges like shipping under <strong>ALL</strong>. Add separate rules for <strong>ONLINE</strong> and <strong>COD</strong> so checkout stays transparent and finance reporting stays consistent.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Snapshot safety</div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Orders keep their own pricing snapshot after placement, so changing rules here only affects future checkouts.
                </p>
              </div>
            </div>
          </section>
          <PricingRulesManager />
        </div>
      )}

      {tab === "config" && (
        <>
          {/* Alerts */}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              {success}
            </div>
          )}

          {/* Main Form Grid */}
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            {/* Delivery Configuration */}
            <div className="grid gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Delivery Fees</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Configure delivery charges</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Fixed Delivery Fee {formatCurrency(Number(formData.deliveryFee) || 0)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.deliveryFee || 0}
                    onChange={(e) => handleChange("deliveryFee", parseFloat(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Charge for delivery per order</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Free Delivery Above {formatCurrency(Number(formData.deliveryFreeAbove) || 0)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.deliveryFreeAbove || 0}
                    onChange={(e) => handleChange("deliveryFreeAbove", parseFloat(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Order amount threshold for free delivery</p>
                </div>
              </div>
            </div>

            {/* Platform Fee Configuration */}
            <div className="grid gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Platform Fees</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Platform fee applied to product prices</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Platform Fee {Number(formData.platformFeePercentage || 0).toFixed(1)}%
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.platformFeePercentage || 0}
                    onChange={(e) => handleChange("platformFeePercentage", parseFloat(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Percentage of product price</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Maximum Fee Cap {formatCurrency(Number(formData.platformFeeCapped) || 0)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.platformFeeCapped || 0}
                    onChange={(e) => handleChange("platformFeeCapped", parseFloat(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">0 = no limit</p>
                </div>
              </div>
            </div>

            {/* Tax Configuration */}
            <div className="grid gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Tax Configuration</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">GST and tax settings</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tax Rate {Number(formData.taxPercentage || 0).toFixed(1)}%
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.taxPercentage || 0}
                    onChange={(e) => handleChange("taxPercentage", parseFloat(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">GST or tax percentage</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Taxable Basis
                  </label>
                  <select
                    value={formData.taxableBasis || "subtotal"}
                    onChange={(e) => handleChange("taxableBasis", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="subtotal">Subtotal</option>
                    <option value="subtotalWithoutDiscount">Subtotal Without Discount</option>
                    <option value="subtotalWithFees">Subtotal With Fees</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">What to calculate tax on</p>
                </div>
              </div>
            </div>

            {/* Handling Fee */}
            <div className="grid gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Handling Charges</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Additional packaging and handling fees</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Handling Fee {formatCurrency(Number(formData.handlingFee) || 0)}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.handlingFee || 0}
                  onChange={(e) => handleChange("handlingFee", parseFloat(e.target.value) || 0)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Per order handling/packaging charge</p>
              </div>
            </div>

            {/* Bulk Discount */}
            <div className="grid gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Bulk Discount</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Automatic discount for bulk quantities</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Bulk Threshold (Quantity)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.bulkDiscountThreshold || 3}
                    onChange={(e) => handleChange("bulkDiscountThreshold", parseInt(e.target.value) || 1)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Minimum quantity for bulk discount</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Bulk Discount {Number(formData.bulkDiscountPercentage || 0).toFixed(1)}%
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.bulkDiscountPercentage || 0}
                    onChange={(e) => handleChange("bulkDiscountPercentage", parseFloat(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Discount percentage when threshold met</p>
                </div>
              </div>
            </div>

            {/* Return & Refund Policy */}
            <div className="grid gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Return & Refund Policy</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Return window and processing times</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Return Window (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.returnWindow || 7}
                    onChange={(e) => handleChange("returnWindow", parseInt(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Days allowed for product returns</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Refund Processing (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.refundProcessingDays || 3}
                    onChange={(e) => handleChange("refundProcessingDays", parseInt(e.target.value) || 0)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Days to process refund after return</p>
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Notes (Internal)
              </label>
              <textarea
                value={formData.notes || ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Internal notes about pricing changes..."
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Not visible to customers</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-6 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}


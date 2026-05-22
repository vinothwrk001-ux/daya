import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  clearRecommendationCache,
  getRecommendationAnalytics,
  getRecommendationSettings,
  previewRecommendations,
  rebuildRecommendations,
  updateRecommendationSettings,
} from "../services/recommendationService";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed.";
}

const TAB_META = {
  "/admin/commerce-intelligence/settings": { key: "settings", title: "Recommendation Settings" },
  "/admin/commerce-intelligence/related-products": { key: "related", title: "Related Products Engine" },
  "/admin/commerce-intelligence/frequently-bought-together": { key: "bundles", title: "Frequently Bought Together" },
  "/admin/commerce-intelligence/cross-sell": { key: "crosssell", title: "Cross Sell Rules" },
  "/admin/commerce-intelligence/upsell": { key: "upsell", title: "Upsell Rules" },
  "/admin/commerce-intelligence/analytics": { key: "analytics", title: "Recommendation Analytics" },
  "/admin/commerce-intelligence/ai-scoring": { key: "ai", title: "AI Scoring Rules" },
  "/admin/commerce-intelligence/preview": { key: "preview", title: "Recommendation Preview" },
  "/admin/commerce-intelligence/cache": { key: "cache", title: "Cache Management" },
};

function NumberField({ label, value, onChange, min = 0, max = 100 }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

export function AdminCommerceIntelligencePage() {
  const location = useLocation();
  const activeTab = TAB_META[location.pathname]?.key || "settings";
  const [settings, setSettings] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [previewProductId, setPreviewProductId] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [settingsResponse, analyticsResponse] = await Promise.all([
          getRecommendationSettings(),
          getRecommendationAnalytics({ days: 30 }),
        ]);
        if (!active) return;
        setSettings(settingsResponse?.data || null);
        setAnalytics(analyticsResponse?.data || null);
      } catch (loadError) {
        if (!active) return;
        setError(normalizeError(loadError));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const weightTotal = useMemo(() => {
    if (!settings?.weights) return 0;
    return Object.values(settings.weights).reduce((sum, value) => sum + Number(value || 0), 0);
  }, [settings]);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await updateRecommendationSettings(settings);
      setSettings(response?.data || settings);
      setMessage("Commerce Intelligence settings saved.");
    } catch (saveError) {
      setError(normalizeError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    if (!previewProductId.trim()) return;
    setError("");
    setMessage("");
    try {
      const response = await previewRecommendations(previewProductId.trim());
      setPreviewData(response?.data || null);
      setMessage("Preview generated.");
    } catch (previewError) {
      setError(normalizeError(previewError));
    }
  }

  async function runAction(action) {
    setError("");
    setMessage("");
    try {
      if (action === "rebuild") {
        await rebuildRecommendations();
        setMessage("Recommendation rebuild queued successfully.");
      } else {
        await clearRecommendationCache();
        setMessage("Recommendation cache cleared.");
      }
    } catch (actionError) {
      setError(normalizeError(actionError));
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading commerce intelligence...</div>;
  }

  return (
    <div className="grid gap-6">
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{TAB_META[location.pathname]?.title || "Commerce Intelligence"}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Independent recommendation controls with cached, precomputed outputs and audit-friendly admin actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => runAction("rebuild")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950">
              Run Recommendation Rebuild
            </button>
            <button type="button" onClick={() => runAction("cache")} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Clear Cache
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">Scoring Weights</h3>
            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${weightTotal === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              Total: {weightTotal}%
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <NumberField label="Category Weight" value={settings?.weights?.category || 0} onChange={(value) => setSettings((current) => ({ ...current, weights: { ...current.weights, category: value } }))} />
            <NumberField label="Brand Weight" value={settings?.weights?.brand || 0} onChange={(value) => setSettings((current) => ({ ...current, weights: { ...current.weights, brand: value } }))} />
            <NumberField label="Attribute Weight" value={settings?.weights?.attribute || 0} onChange={(value) => setSettings((current) => ({ ...current, weights: { ...current.weights, attribute: value } }))} />
            <NumberField label="Price Weight" value={settings?.weights?.price || 0} onChange={(value) => setSettings((current) => ({ ...current, weights: { ...current.weights, price: value } }))} />
            <NumberField label="Sales Weight" value={settings?.weights?.sales || 0} onChange={(value) => setSettings((current) => ({ ...current, weights: { ...current.weights, sales: value } }))} />
            <NumberField label="Rating Weight" value={settings?.weights?.rating || 0} onChange={(value) => setSettings((current) => ({ ...current, weights: { ...current.weights, rating: value } }))} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={saving || weightTotal !== 100} onClick={saveSettings} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              Save Settings
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Recommendation Preview</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Enter any product ID to preview related items, bundles, upsells, and score breakdowns instantly.
          </p>
          <div className="mt-4 grid gap-3">
            <input
              value={previewProductId}
              onChange={(event) => setPreviewProductId(event.target.value)}
              placeholder="Product ID"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <button type="button" onClick={runPreview} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Preview Recommendations
            </button>
          </div>
          {previewData ? (
            <div className="mt-5 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <div>Related: {previewData.related?.length || 0}</div>
              <div>Bundles: {previewData.frequentlyBoughtTogether?.length || 0}</div>
              <div>Upsell: {previewData.upsell?.length || 0}</div>
              <div>Similar: {previewData.similar?.length || 0}</div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Engine Controls</h3>
          <div className="mt-4 grid gap-3">
            {Object.entries(settings?.enabled || {}).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <span className="font-medium text-slate-700 capitalize dark:text-slate-200">{key.replace(/([A-Z])/g, " $1")}</span>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      enabled: { ...current.enabled, [key]: event.target.checked },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Analytics Snapshot</h3>
          <div className="mt-4 grid gap-3">
            {(analytics?.rows || []).slice(0, 8).map((row) => (
              <div key={`${row.dateKey}-${row.recommendationType}-${row.surface}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {row.recommendationType} · {row.surface}
                </div>
                <div className="mt-1 text-slate-600 dark:text-slate-300">
                  Views {row.views || 0} · Clicks {row.clicks || 0} · CTR {(((row.ctr || 0) * 100) || 0).toFixed(2)}%
                </div>
              </div>
            ))}
            {!analytics?.rows?.length ? <div className="text-sm text-slate-500">No analytics rows yet.</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

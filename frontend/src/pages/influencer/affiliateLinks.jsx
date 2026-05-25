import { useState } from "react";
import { generateInfluencerAffiliateLink } from "../../services/influencerCommerceService";

export default function InfluencerAffiliateLinksPage() {
  const [targetPath, setTargetPath] = useState("/product/example-product");
  const [targetType, setTargetType] = useState("product");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    try {
      const response = await generateInfluencerAffiliateLink({ targetType, targetPath });
      setResult(response?.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not generate affiliate link.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-black text-slate-950 dark:text-white">Affiliate Links</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Generate tracking URLs for products, collections, campaigns, and storefront links.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <label className="text-sm font-bold">Type<select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700 dark:bg-slate-950"><option value="product">Product</option><option value="collection">Collection</option><option value="campaign">Campaign</option><option value="storefront">Storefront</option><option value="custom">Custom</option></select></label>
        <label className="text-sm font-bold">Target Path<input value={targetPath} onChange={(event) => setTargetPath(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" /></label>
        <button type="button" onClick={generate} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">Generate</button>
      </div>
      {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
      {result ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold dark:bg-slate-950">{result.trackingUrl}</div> : null}
    </div>
  );
}

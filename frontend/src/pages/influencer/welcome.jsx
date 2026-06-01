import { createElement, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, BarChart3, Boxes, Link2, Store, Wallet } from "lucide-react";
import { getInfluencerActivationWelcome } from "../../services/influencerCommerceService";

const CAPABILITIES = [
  ["badgeActivated", "Influencer Badge Activated", BadgeCheck],
  ["storefrontCreated", "Storefront Created", Store],
  ["affiliateLinksEnabled", "Affiliate Links Enabled", Link2],
  ["productCollectionsEnabled", "Product Collections Enabled", Boxes],
  ["commissionWalletActivated", "Commission Wallet Activated", Wallet],
  ["analyticsDashboardEnabled", "Analytics Dashboard Enabled", BarChart3],
];

export default function InfluencerWelcomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getInfluencerActivationWelcome()
      .then((response) => setData(response?.data))
      .catch((err) => setError(err?.response?.data?.message || "Could not load activation status."));
  }, []);

  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">Congratulations!</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">You Are Now An Approved Influencer</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Your creator tools, storefront, affiliate tracking, wallet, and analytics dashboard are active.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(([key, label, Icon]) => (
            <div key={key} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              {createElement(Icon, { className: "mb-3 h-5 w-5" })}
              {data?.capabilities?.[key] === false ? label.replace("Activated", "Pending").replace("Created", "Pending") : label}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/influencer/dashboard" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">Go To Dashboard</Link>
          <Link to={`/influencer/${data?.storefront?.slug || data?.profile?.storeSlug || ""}`} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700">View Storefront</Link>
          <Link to="/influencer/collections" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700">Create First Collection</Link>
          <Link to="/influencer/affiliate-links" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700">Generate Affiliate Link</Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">First Time Setup</h2>
          <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 dark:bg-blue-950 dark:text-blue-200">{data?.completionPercentage || 0}%</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["bannerUploaded", "Upload Store Banner"],
            ["profilePhotoUploaded", "Upload Profile Photo"],
            ["bioCompleted", "Complete Bio"],
            ["firstCollectionCreated", "Create First Collection"],
            ["firstAffiliateLinkGenerated", "Generate First Affiliate Link"],
            ["storefrontShared", "Share Storefront"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold dark:bg-slate-950">
              <span className={`h-3 w-3 rounded-full ${data?.checklist?.[key] ? "bg-emerald-500" : "bg-slate-300"}`} />
              {label}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

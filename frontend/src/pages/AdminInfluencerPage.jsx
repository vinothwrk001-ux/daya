import { useEffect, useState } from "react";
import { getAdminCampaigns, getCommissionOverview, listAdminInfluencers, moderateInfluencer } from "../services/influencerCommerceService";
import { formatCurrency } from "../utils/formatCurrency";

export function AdminInfluencerPage() {
  const [influencers, setInfluencers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [overview, setOverview] = useState({ records: [] });
  const [feedback, setFeedback] = useState("");
  const [submittingId, setSubmittingId] = useState("");

  async function load() {
    const [influencerResponse, campaignResponse, overviewResponse] = await Promise.all([
      listAdminInfluencers(),
      getAdminCampaigns(),
      getCommissionOverview(),
    ]);
    setInfluencers(influencerResponse?.data || []);
    setCampaigns(campaignResponse?.data || []);
    setOverview(overviewResponse?.data || { records: [] });
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function approve(id) {
    const influencer = influencers.find((item) => item._id === id);
    if (!influencer) return;
    if (influencer.state === "active") {
      setFeedback("This influencer is already active.");
      return;
    }

    setSubmittingId(id);
    setFeedback("");
    try {
      await moderateInfluencer(id, { state: "active", notes: "Approved from admin workspace" });
      setFeedback("Influencer approved successfully.");
      await load();
    } catch (error) {
      setFeedback(error?.response?.data?.message || "Failed to approve influencer.");
    } finally {
      setSubmittingId("");
    }
  }

  const summary = {
    pendingProfiles: influencers.filter((influencer) => ["submitted", "verified"].includes(influencer.state)).length,
    activeCampaigns: campaigns.filter((campaign) => campaign.state === "active").length,
    holdValue: (overview.records || [])
      .filter((record) => record.state === "HOLD")
      .reduce((sum, record) => sum + Number(record.influencerShare || 0), 0),
  };

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Profiles awaiting action", value: summary.pendingProfiles },
          { label: "Active campaigns", value: summary.activeCampaigns },
          { label: "Commission on hold", value: formatCurrency(summary.holdValue) },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Influencer operations</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Verification, moderation, and commission oversight live here so attribution and money movement stay auditable.</p>
        {feedback ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            {feedback}
          </div>
        ) : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {influencers.map((influencer) => (
            <article key={influencer._id} className="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950 dark:text-white">{influencer.userId?.name}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{influencer.followers || 0} followers</div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase dark:bg-slate-800">{influencer.state}</span>
              </div>
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{(influencer.categories || []).join(", ") || "No categories"}</div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950">
                  <div className="text-slate-400">Views</div>
                  <div className="mt-1 font-semibold text-slate-950 dark:text-white">{influencer.stats?.views || 0}</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950">
                  <div className="text-slate-400">Clicks</div>
                  <div className="mt-1 font-semibold text-slate-950 dark:text-white">{influencer.stats?.clicks || 0}</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950">
                  <div className="text-slate-400">Sales</div>
                  <div className="mt-1 font-semibold text-slate-950 dark:text-white">{influencer.stats?.sales || 0}</div>
                </div>
              </div>
              {["submitted", "verified", "draft"].includes(influencer.state) ? (
                <button
                  type="button"
                  onClick={() => approve(influencer._id)}
                  disabled={submittingId === influencer._id}
                  className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950"
                >
                  {submittingId === influencer._id ? "Approving..." : "Approve"}
                </button>
              ) : (
                <div className="mt-4 inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Already active
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Campaign monitoring</h2>
        <div className="mt-4 grid gap-3">
          {campaigns.map((campaign) => (
            <div key={campaign._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <div>{campaign.vendorId?.shopName || "Vendor"} to {campaign.influencerId?.userId?.name || "Influencer"}</div>
              <div className="font-semibold text-slate-700 dark:text-slate-200">{campaign.state}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Commission overview</h2>
        <div className="mt-4 grid gap-3">
          {(overview.records || []).map((record) => (
            <div key={record._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <div>{record.metadata?.orderNumber || record.orderId}</div>
              <div>{record.state}</div>
              <div className="font-semibold text-emerald-600">{formatCurrency(record.influencerShare || 0)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

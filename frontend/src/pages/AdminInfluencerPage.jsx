import { useEffect, useState } from "react";
import { confirmAction } from "../services/notificationService";
import {
  getAdminCampaigns,
  getCommissionOverview,
  getInfluencerApplicationReview,
  listAdminInfluencers,
  listInfluencerApplications,
  moderateInfluencer,
  reviewInfluencerApplication,
} from "../services/influencerCommerceService";
import { formatCurrency } from "../utils/formatCurrency";

export function AdminInfluencerPage() {
  const [influencers, setInfluencers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [applications, setApplications] = useState([]);
  const [overview, setOverview] = useState({ records: [] });
  const [feedback, setFeedback] = useState("");
  const [submittingId, setSubmittingId] = useState("");
  const [viewingId, setViewingId] = useState("");
  const [applicationDetail, setApplicationDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    const [influencerResponse, campaignResponse, overviewResponse, applicationResponse] = await Promise.all([
      listAdminInfluencers(),
      getAdminCampaigns(),
      getCommissionOverview(),
      listInfluencerApplications({ limit: 12 }),
    ]);
    setInfluencers(influencerResponse?.data || []);
    setCampaigns(campaignResponse?.data || []);
    setOverview(overviewResponse?.data || { records: [] });
    setApplications(applicationResponse?.data || []);
  }

  async function review(applicationId, decision) {
    if (["reject", "suspend"].includes(decision) && !(await confirmAction({ message: "Rejecting this application will revoke influencer access if it is already approved. Continue?", tone: "danger", confirmLabel: "Confirm" }))) return;
    setSubmittingId(applicationId);
    setFeedback("");
    try {
      await reviewInfluencerApplication(applicationId, { decision, comments: `${decision.replace("_", " ")} from admin workspace` });
      setFeedback("Application review action saved.");
      await load();
    } catch (error) {
      const details = error?.response?.data?.details;
      const fieldErrors = details?.fields ? ` (${Object.values(details.fields).join(", ")})` : "";
      setFeedback(`${error?.response?.data?.message || "Failed to review application."}${fieldErrors}`);
    } finally {
      setSubmittingId("");
    }
  }

  async function openApplication(applicationId) {
    setViewingId(applicationId);
    setApplicationDetail(null);
    setDetailLoading(true);
    try {
      const response = await getInfluencerApplicationReview(applicationId);
      setApplicationDetail(response?.data || null);
    } catch (error) {
      setFeedback(error?.response?.data?.message || "Failed to load application details.");
      setViewingId("");
    } finally {
      setDetailLoading(false);
    }
  }

  async function reviewStep(applicationId, stepKey, stepDecision = "approved") {
    setSubmittingId(`${applicationId}:${stepKey}`);
    setFeedback("");
    try {
      await reviewInfluencerApplication(applicationId, {
        decision: "note",
        stepKey,
        stepDecision,
        comments: `${stepKey.replace(/_/g, " ")} ${stepDecision} from admin workspace`,
      });
      const response = await getInfluencerApplicationReview(applicationId);
      setApplicationDetail(response?.data || null);
      await load();
      setFeedback("Step review saved.");
    } catch (error) {
      setFeedback(error?.response?.data?.message || "Failed to save step review.");
    } finally {
      setSubmittingId("");
    }
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
    pendingProfiles: applications.filter((application) => ["submitted", "under_review", "pending_documents", "requires_changes"].includes(application.status)).length,
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
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Influencer Applications</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Review submitted applications, creator scores, verification stage, and approval actions.</p>
        <div className="mt-4 grid gap-3">
          {applications.map((application) => (
            <article key={application.applicationId} className="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-semibold text-slate-950 dark:text-white">{application.applicationNumber || application.applicationId}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{application.firstName} {application.lastName} - {application.email}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 uppercase dark:bg-slate-800">{application.status}</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-200">Score {application.creatorScore || 0}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{application.reviewStage || "draft"}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => openApplication(application.applicationId)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">View</button>
                {application.status === "approved" ? (
                  <span className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Approved and activated
                  </span>
                ) : (
                  <>
                  <button type="button" onClick={() => review(application.applicationId, "approve")} disabled={submittingId === application.applicationId} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Approve</button>
                  <button type="button" onClick={() => review(application.applicationId, "request_changes")} disabled={submittingId === application.applicationId} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-60">Request Changes</button>
                  <button type="button" onClick={() => review(application.applicationId, "request_documents")} disabled={submittingId === application.applicationId} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-60 dark:border-slate-700">Request Documents</button>
                  </>
                )}
                <button type="button" onClick={() => review(application.applicationId, "reject")} disabled={submittingId === application.applicationId} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60">Reject</button>
              </div>
            </article>
          ))}
          {!applications.length ? <div className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800">No applications in the review queue.</div> : null}
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

      {viewingId ? (
        <ApplicationReviewModal
          applicationId={viewingId}
          detail={applicationDetail}
          loading={detailLoading}
          submittingId={submittingId}
          onClose={() => {
            setViewingId("");
            setApplicationDetail(null);
          }}
          onApproveStep={reviewStep}
          onReview={review}
        />
      ) : null}
    </div>
  );
}

function ApplicationReviewModal({ applicationId, detail, loading, submittingId, onClose, onApproveStep, onReview }) {
  const application = detail?.application || {};
  const profile = application.profileDraft || {};
  const business = detail?.business || {};
  const payment = detail?.payment || {};
  const steps = detail?.stepTimeline || [];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-6">
      <section className="w-full max-w-6xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">Application Review</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{application.applicationNumber || applicationId}</h2>
            <p className="mt-1 text-sm text-slate-500">{application.firstName} {application.lastName} - {application.email}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Close</button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading full application...</div>
        ) : (
          <div className="mt-5 grid gap-5">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCard title="Status" value={String(detail?.status || application.status || "").replace(/_/g, " ")} />
              <InfoCard title="Current Stage" value={String(detail?.reviewStage || application.reviewStage || "").replace(/_/g, " ")} />
              <InfoCard title="Creator Score" value={`${detail?.creatorScore || application.creatorScore || 0} / 100`} />
            </div>

            <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">Step Review Timeline</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {steps.map((step) => (
                  <div key={step.key} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{step.label}</div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${step.status === "approved" || step.status === "completed" ? "bg-emerald-100 text-emerald-700" : step.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>{step.status}</span>
                    </div>
                    {step.comments ? <p className="mt-2 text-xs text-slate-500">{step.comments}</p> : null}
                    <button
                      type="button"
                      onClick={() => onApproveStep(applicationId, step.key)}
                      disabled={submittingId === `${applicationId}:${step.key}`}
                      className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {submittingId === `${applicationId}:${step.key}` ? "Saving..." : "Approve Step"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <StepSection title="Step 1 - Account Information" rows={[
                ["Name", `${application.firstName || ""} ${application.lastName || ""}`.trim()],
                ["Email", application.email],
                ["Mobile", application.mobile],
                ["Username", application.username],
                ["Referral Code", application.referralCode || "Not provided"],
              ]} />
              <StepSection title="Step 2 - Social Verification" rows={(detail?.socialAccounts || []).map((account) => [account.platformLabel || account.platform, `${account.profileUrl || ""} | ${account.followersCount || 0} followers | ${account.verificationStatus}`])} />
              <StepSection title="Step 3 - Profile Information" rows={[
                ["Display Name", profile.displayName],
                ["Store Slug", profile.storeSlug],
                ["Short Bio", profile.shortBio],
                ["Primary Category", profile.primaryCategory || profile.customCategory],
                ["Secondary Categories", (profile.secondaryCategories || []).join(", ")],
                ["Languages", (profile.languages || []).join(", ")],
                ["Profile Picture", profile.profilePicture],
                ["Cover Banner", profile.coverBanner],
              ]} />
              <StepSection title="Step 4 - Business Information" rows={[
                ["Legal Name", business.legalName],
                ["Business Name", business.businessName],
                ["Location", [business.city, business.state, business.country].filter(Boolean).join(", ")],
                ["Status", business.status],
              ]} />
              <StepSection title="Step 5 - Payment Information" rows={[
                ["Payout Method", payment.payoutMethod],
                ["Account Holder", payment.accountHolderName],
                ["Account", payment.accountNumberMask],
                ["Status", payment.status],
              ]} />
              <StepSection title="Step 6 - Content Review" rows={[
                ["Portfolio URL", detail?.contentReview?.portfolioUrl],
                ["Portfolio Description", detail?.contentReview?.portfolioDescription],
                ["Detected Niche", detail?.contentReview?.detectedNiche],
                ["Manual Niche", detail?.contentReview?.manualNiche],
              ]} />
            </div>

            <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">Uploaded Photos & Documents</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {(detail?.documents || []).map((document) => (
                  <a key={document._id} href={document.filePath} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950">
                    <span className="font-semibold">{document.documentType?.replace(/_/g, " ")}</span>
                    <span className="ml-2 text-slate-500">{document.originalName || document.filePath}</span>
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs uppercase dark:bg-slate-800">{document.status}</span>
                  </a>
                ))}
                {!detail?.documents?.length ? <div className="text-sm text-slate-500">No uploaded documents found.</div> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-semibold text-slate-950 dark:text-white">Review Notes</h3>
              <div className="mt-3 grid gap-2">
                {(detail?.reviews || []).map((review) => (
                  <div key={review._id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">
                    <strong>{review.metadata?.stepKey ? `${review.metadata.stepKey.replace(/_/g, " ")}: ${review.metadata.stepDecision}` : review.decision}</strong>
                    <p className="mt-1 text-slate-500">{review.comments || "No comments"}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              {detail?.status !== "approved" ? <button type="button" onClick={() => onReview(applicationId, "approve")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Approve Application</button> : null}
              <button type="button" onClick={() => onReview(applicationId, "reject")} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">Reject / Revoke</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoCard({ title, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="mt-2 font-semibold text-slate-950 dark:text-white">{value || "Not provided"}</div>
    </div>
  );
}

function StepSection({ title, rows }) {
  const safeRows = rows?.length ? rows : [["Details", "Not provided"]];
  return (
    <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
      <dl className="mt-3 grid gap-2 text-sm">
        {safeRows.map(([label, value]) => (
          <div key={`${title}-${label}`} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</dt>
            <dd className="mt-1 break-words text-slate-700 dark:text-slate-200">{value || "Not provided"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

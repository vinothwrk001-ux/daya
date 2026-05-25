import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Save, Upload, X } from "lucide-react";
import {
  getInfluencerApplicationStatus,
  saveInfluencerContentReview,
  submitInfluencerApplication,
} from "../services/influencerRegistrationService";
import { influencerWizardSteps, loadInfluencerStepOneDraft } from "../utils/influencerRegistrationStep1";
import { loadSocialVerificationDraft } from "../utils/influencerSocialVerification";
import { loadInfluencerProfileDraft } from "../utils/influencerProfileInformation";
import { loadInfluencerBusinessDraft, loadInfluencerPaymentDraft } from "../utils/influencerBusinessPayment";
import {
  contentNiches,
  initialInfluencerContentReviewForm,
  loadInfluencerContentReviewDraft,
  saveInfluencerContentReviewDraftLocal,
  validateContentReview,
} from "../utils/influencerContentReview";

function apiError(error, fallback = "Something went wrong. Please try again.") {
  return error?.response?.data?.message || error?.message || fallback;
}

function WizardProgress() {
  return (
    <aside className="sticky top-20 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Step 6 of 6</div>
      <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">Content Review</div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-full rounded-full bg-blue-600" /></div>
      <ol className="mt-5 grid gap-2" aria-label="Influencer registration progress">
        {influencerWizardSteps.map((step, index) => {
          const labels = ["Account Information", "Social Verification", "Profile Information", "Business Information", "Payment Details", "Content Review"];
          const completed = index < 5;
          const current = index === 5;
          return (
            <li key={step} aria-current={current ? "step" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold ${current ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${current ? "bg-white text-slate-950 dark:bg-slate-950 dark:text-white" : "bg-emerald-600 text-white"}`}>{completed ? <Check className="h-3.5 w-3.5" /> : "->"}</span>
              {labels[index]}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function DropZone({ title, description, accept, multiple = true, files, onChange, error }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">
          <Upload className="h-4 w-4" /> Upload
          <input type="file" multiple={multiple} accept={accept} className="sr-only" onChange={(event) => onChange([...files, ...Array.from(event.target.files || [])])} />
        </label>
      </div>
      <div className="mt-4 grid gap-3">
        {files.length ? files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
            <span className="inline-flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{file.name}</span></span>
            <button type="button" onClick={() => onChange(files.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Remove ${file.name}`}><X className="h-4 w-4" /></button>
          </div>
        )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950">Drag & drop support ready. Use upload to add files.</div>}
      </div>
      {error ? <div className="mt-2 text-xs font-semibold text-rose-600" role="alert">{error}</div> : null}
    </section>
  );
}

function StatusPanel({ status }) {
  const score = status?.creatorScore || 0;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-black">Guidelines & Status</h2>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">Upload at least 3 samples that represent your real creator work.</div>
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">Identity documents are used for verification and admin review.</div>
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">AI review hooks are queued for future spam, quality, and fraud analysis.</div>
      </div>
      <div className="mt-5 rounded-3xl bg-blue-50 p-5 dark:bg-blue-950">
        <div className="text-sm font-bold text-blue-700 dark:text-blue-200">Overall Creator Score</div>
        <div className="mt-2 text-4xl font-black text-blue-700 dark:text-blue-100">{score} / 100</div>
        <div className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-200">{status?.qualityScores?.level || "Calculated after upload"}</div>
      </div>
    </section>
  );
}

export function InfluencerContentReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredRef = useRef(false);
  const [form, setForm] = useState(initialInfluencerContentReviewForm);
  const [files, setFiles] = useState({ sampleContentFiles: [], brandProofFiles: [], identityDocumentFiles: [] });
  const [status, setStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stepOne = loadInfluencerStepOneDraft();
    const stepTwo = loadSocialVerificationDraft();
    const stepThree = loadInfluencerProfileDraft();
    const stepFour = loadInfluencerBusinessDraft();
    const stepFive = loadInfluencerPaymentDraft();
    const local = loadInfluencerContentReviewDraft();
    const applicationId = location.state?.applicationId || local?.values?.applicationId || stepFive?.values?.applicationId || stepFour?.values?.applicationId || stepThree?.values?.applicationId || stepTwo?.values?.applicationId || stepOne?.values?.applicationId || "";
    setForm((current) => ({ ...current, ...(local?.values || {}), applicationId }));
    setLastSavedAt(local?.savedAt || "");
  }, [location.state?.applicationId]);

  useEffect(() => {
    if (!form.applicationId) return;
    getInfluencerApplicationStatus(form.applicationId).then((response) => setStatus(response?.data)).catch(() => {});
  }, [form.applicationId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const saved = saveInfluencerContentReviewDraftLocal(form);
      setLastSavedAt(saved.savedAt);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [form]);

  async function persist(submit = false) {
    const validation = submit ? validateContentReview(form, files, status?.documents || []) : {};
    setErrors(validation);
    setPageError("");
    if (Object.keys(validation).length) return false;
    setSaving(true);
    try {
      const payload = { ...form, ...files };
      const response = submit ? await submitInfluencerApplication(payload) : await saveInfluencerContentReview(payload);
      const saved = saveInfluencerContentReviewDraftLocal(form);
      setLastSavedAt(saved.savedAt);
      setStatus(response?.data || null);
      return response?.data;
    } catch (error) {
      setPageError(apiError(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    const response = await persist(true);
    if (response) navigate(`/influencer/application-under-review/${form.applicationId}`, { state: { applicationId: form.applicationId } });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <button type="button" onClick={() => navigate("/influencer/register/payment-commission", { state: { applicationId: form.applicationId } })} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Payment Details</button>
        <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr]">
          <WizardProgress />
          <section className="space-y-6">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">Influencer Registration</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Content Review & Verification</h1>
              <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">Help us evaluate your content quality and creator profile before joining our Influencer Program.</p>
            </header>
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <DropZone title="Upload Sample Content" description="Short videos, reels, photos, reviews, blog screenshots, tutorials, or livestream clips. Minimum 3 required." accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,application/pdf" files={files.sampleContentFiles} error={errors.sampleContent} onChange={(next) => setFiles((current) => ({ ...current, sampleContentFiles: next }))} />
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-xl font-black">Portfolio</h2>
                  <div className="mt-5 grid gap-4">
                    <label className="block"><span className="text-sm font-bold">Portfolio URL</span><input value={form.portfolioUrl} onChange={(event) => setForm((current) => ({ ...current, portfolioUrl: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950" placeholder="https://linktr.ee/creator" /></label>
                    {errors.portfolioUrl ? <div className="text-xs font-semibold text-rose-600">{errors.portfolioUrl}</div> : null}
                    <label className="block"><span className="text-sm font-bold">Portfolio Description</span><textarea value={form.portfolioDescription} onChange={(event) => setForm((current) => ({ ...current, portfolioDescription: event.target.value }))} rows={4} maxLength={1000} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950" /></label>
                  </div>
                </section>
                <DropZone title="Brand Collaboration Proof" description="Optional campaign screenshots, brand emails, agreements, performance reports, or creator dashboards." accept="image/png,image/jpeg,image/webp,application/pdf" files={files.brandProofFiles} onChange={(next) => setFiles((current) => ({ ...current, brandProofFiles: next }))} />
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black">Brand Collaborations</h2>
                    <button type="button" onClick={() => setForm((current) => ({ ...current, brandCollaborations: [...current.brandCollaborations, { brandName: "", campaignName: "", campaignType: "", campaignDate: "", campaignResults: "" }] }))} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700">Add Entry</button>
                  </div>
                  <div className="mt-4 grid gap-4">
                    {(form.brandCollaborations || []).map((item, index) => (
                      <div key={index} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            ["brandName", "Brand Name"],
                            ["campaignName", "Campaign Name"],
                            ["campaignType", "Campaign Type"],
                            ["campaignDate", "Campaign Date"],
                          ].map(([field, label]) => (
                            <label key={field} className="block text-sm font-bold">{label}<input type={field === "campaignDate" ? "date" : "text"} value={item[field] || ""} onChange={(event) => setForm((current) => ({ ...current, brandCollaborations: current.brandCollaborations.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: event.target.value } : entry) }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" /></label>
                          ))}
                        </div>
                        <label className="mt-3 block text-sm font-bold">Campaign Results<textarea value={item.campaignResults || ""} onChange={(event) => setForm((current) => ({ ...current, brandCollaborations: current.brandCollaborations.map((entry, entryIndex) => entryIndex === index ? { ...entry, campaignResults: event.target.value } : entry) }))} rows={2} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" /></label>
                      </div>
                    ))}
                    {!form.brandCollaborations?.length ? <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-950">No brand collaborations added.</div> : null}
                  </div>
                </section>
                <DropZone title="Identity Documents" description="Passport, National ID, Driving License, PAN Card, Aadhaar, Residence Permit, or Government ID. Required." accept="image/png,image/jpeg,image/webp,application/pdf" files={files.identityDocumentFiles} error={errors.identityDocuments} onChange={(next) => setFiles((current) => ({ ...current, identityDocumentFiles: next }))} />
              </div>
              <div className="space-y-6">
                <StatusPanel status={status} />
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-xl font-black">Content Niche Analysis</h2>
                  <p className="mt-1 text-sm text-slate-500">Auto detected: <strong>{status?.contentReview?.detectedNiche || "Pending"}</strong></p>
                  <select value={form.manualNiche} onChange={(event) => setForm((current) => ({ ...current, manualNiche: event.target.value }))} className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
                    <option value="">Use auto-detected niche</option>
                    {contentNiches.map((niche) => <option key={niche} value={niche.toLowerCase()}>{niche}</option>)}
                  </select>
                </section>
              </div>
            </div>
            {pageError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" role="alert">{pageError}</div> : null}
            <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lastSavedAt ? `Draft Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Draft not saved yet"}</div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => navigate("/influencer/register/payment-commission", { state: { applicationId: form.applicationId } })} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"><ArrowLeft className="h-4 w-4" /> Back</button>
                <button type="button" onClick={() => persist(false)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft</button>
                <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Submit For Review</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

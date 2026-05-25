import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileImage,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  calculateCreatorScore,
  canContinueSocialVerification,
  createSocialAccount,
  defaultSocialAccounts,
  generateOwnershipCode,
  loadSocialVerificationDraft,
  saveSocialVerificationDraft,
  socialPlatforms,
  validateSocialVerification,
} from "../utils/influencerSocialVerification";
import { influencerWizardSteps, loadInfluencerStepOneDraft } from "../utils/influencerRegistrationStep1";
import {
  fetchInfluencerSocialMetrics,
  getInfluencerSocialStatus,
  saveInfluencerSocialDraft,
  verifyInfluencerSocialAccount,
} from "../services/influencerRegistrationService";

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  verified: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  under_review: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  manual_review_required: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const statusLabels = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
  under_review: "Under Review",
  manual_review_required: "Manual Review Required",
  draft: "Draft",
};

function apiError(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.message || err?.message || fallback;
}

function serializeSocialAccount(account = {}) {
  const { proofFile, proofFileName, clientId, ...payload } = account;
  const numericFields = [
    "followersCount",
    "subscribers",
    "engagementRate",
    "averageLikes",
    "averageComments",
    "averageViews",
    "contentCount",
    "accountAgeDays",
  ];
  const next = { ...payload };
  numericFields.forEach((field) => {
    next[field] = next[field] === "" || next[field] === undefined || next[field] === null ? 0 : Number(next[field]);
  });
  return next;
}

function ProgressIndicator() {
  return (
    <aside className="sticky top-20 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Step 2 of 6</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">33% complete</div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">Social Media Verification</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-[33%] rounded-full bg-blue-600" />
      </div>
      <ol className="mt-5 grid gap-2" aria-label="Influencer registration progress">
        {influencerWizardSteps.map((step, index) => {
          const completed = index === 0;
          const current = index === 1;
          return (
            <li key={step} aria-current={current ? "step" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold ${current ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : completed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-500"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${current ? "bg-white text-slate-950 dark:bg-slate-950 dark:text-white" : completed ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800"}`}>
                {completed ? <Check className="h-3.5 w-3.5" /> : current ? "→" : index + 1}
              </span>
              {step === "Social Profiles" ? "Social Media Verification" : step === "Payment Details" ? "Payment Information" : step === "Verification" ? "Identity Verification" : step}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function CreatorScoreCard({ accounts }) {
  const score = useMemo(() => calculateCreatorScore(accounts), [accounts]);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Creator Score</div>
          <div className="mt-1 text-4xl font-black text-slate-950 dark:text-white">{score.score}/100</div>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">{score.level}</span>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-600 dark:text-slate-300">
        <div>Followers Score: {score.followersScore}</div>
        <div>Engagement Score: {score.engagementScore}</div>
        <div>Content Consistency Score: {score.consistencyScore}</div>
        <div>Platform Diversity Score: {score.diversityScore}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = status || "pending";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${statusStyles[normalized] || statusStyles.pending}`}>
      {normalized === "verified" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      {statusLabels[normalized] || "Pending"}
    </span>
  );
}

function MetricInput({ label, value, onChange, placeholder = "Auto Detected" }) {
  return (
    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
      {label}
      <input
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal"
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function PlatformCard({ account, errors = {}, metricState, onChange, onRemove, onVerify, onFetchMetrics, busy }) {
  const definition = socialPlatforms.find((item) => item.key === account.platform) || socialPlatforms.at(-1);
  const isOther = account.platform === "other";
  const proofInputId = `proof-${account.clientId}`;

  function update(field, value) {
    onChange({ ...account, [field]: value });
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">{account.platformLabel || definition.label}</h3>
            <StatusBadge status={account.verificationStatus} />
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Validate ownership with a code or upload proof for manual review.</p>
        </div>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold text-slate-900 dark:text-white">
          Platform
          <select value={account.platform} onChange={(event) => {
            const next = socialPlatforms.find((item) => item.key === event.target.value) || socialPlatforms.at(-1);
            onChange({ ...account, platform: next.key, platformLabel: next.label });
          }} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
            {socialPlatforms.map((platform) => <option key={platform.key} value={platform.key}>{platform.label}</option>)}
          </select>
          {errors.platform ? <span className="mt-2 block text-xs text-rose-600" role="alert">{errors.platform}</span> : null}
        </label>
        {isOther ? (
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            Platform Name
            <input value={account.platformLabel} onChange={(event) => update("platformLabel", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" />
          </label>
        ) : null}
        <label className="block text-sm font-bold text-slate-900 dark:text-white md:col-span-2">
          {definition.urlLabel} {definition.required ? <span className="text-rose-500">*</span> : null}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input value={account.profileUrl} onChange={(event) => update("profileUrl", event.target.value)} placeholder="https://..." aria-invalid={Boolean(errors.profileUrl)} className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950" />
            <button type="button" onClick={() => onFetchMetrics(account)} disabled={metricState?.loading || !account.profileUrl} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              {metricState?.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Auto Fetch
            </button>
          </div>
          {errors.profileUrl ? <span className="mt-2 block text-xs text-rose-600" role="alert">{errors.profileUrl}</span> : null}
          {metricState?.message ? (
            <span className={`mt-2 block text-xs font-semibold ${metricState.type === "success" ? "text-emerald-600 dark:text-emerald-300" : metricState.type === "error" ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`} role={metricState.type === "error" ? "alert" : "status"}>
              {metricState.message}
            </span>
          ) : null}
        </label>
        <label className="block text-sm font-bold text-slate-900 dark:text-white">
          {account.platform === "youtube" ? "Channel Name" : "Username"}
          <input value={account.platform === "youtube" ? account.channelName : account.username} onChange={(event) => update(account.platform === "youtube" ? "channelName" : "username", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" />
        </label>
        {account.platform === "instagram" ? (
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            Account Type
            <select value={account.accountType} onChange={(event) => update("accountType", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
              <option value="creator">Creator</option>
              <option value="business">Business</option>
              <option value="personal">Personal</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricInput label={account.platform === "youtube" ? "Subscribers" : "Followers"} value={account.platform === "youtube" ? account.subscribers : account.followersCount} onChange={(value) => update(account.platform === "youtube" ? "subscribers" : "followersCount", value)} />
        <MetricInput label="Engagement Rate %" value={account.engagementRate} onChange={(value) => update("engagementRate", value)} />
        <MetricInput label={account.platform === "youtube" || account.platform === "tiktok" ? "Average Views" : "Average Likes"} value={account.platform === "youtube" || account.platform === "tiktok" ? account.averageViews : account.averageLikes} onChange={(value) => update(account.platform === "youtube" || account.platform === "tiktok" ? "averageViews" : "averageLikes", value)} />
        <MetricInput label="Average Comments" value={account.averageComments} onChange={(value) => update("averageComments", value)} />
      </div>

      {isOther ? (
        <label className="mt-5 block text-sm font-bold text-slate-900 dark:text-white">
          Description
          <textarea value={account.description} onChange={(event) => update("description", event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        </label>
      ) : null}

      <div className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="text-sm font-black text-slate-950 dark:text-white">Ownership Verification</div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Place this code in your profile bio or channel description, then click Verify. If API validation is unavailable, upload proof for admin review.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={account.verificationCode} readOnly className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black tracking-wide dark:border-slate-700 dark:bg-slate-900" placeholder="Generate Unique Code" />
            <button type="button" onClick={() => update("verificationCode", generateOwnershipCode())} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900">Generate Code</button>
          </div>
          {errors.verification ? <div className="mt-2 text-xs font-semibold text-rose-600" role="alert">{errors.verification}</div> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={proofInputId} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            <Upload className="h-4 w-4" /> Upload Proof
            <input id={proofInputId} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) {
                update("proofFileName", "File is larger than 10MB");
                return;
              }
              onChange({
                ...account,
                proofFile: file,
                proofFileName: file.name,
                manualProofSubmitted: true,
                verificationStatus: "under_review",
              });
            }} />
          </label>
          <button type="button" onClick={() => onVerify(account)} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Verify
          </button>
        </div>
        {account.proofFileName ? <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500"><FileImage className="h-4 w-4" /> {account.proofFileName}</div> : null}
      </div>
    </article>
  );
}

export function InfluencerSocialVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredRef = useRef(false);
  const fetchedMetricUrlsRef = useRef(new Set());
  const [applicationId, setApplicationId] = useState(location.state?.applicationId || "");
  const [accounts, setAccounts] = useState(defaultSocialAccounts);
  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [metricStates, setMetricStates] = useState({});
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stepOne = loadInfluencerStepOneDraft();
    const stepTwo = loadSocialVerificationDraft();
    const nextApplicationId = location.state?.applicationId || stepTwo?.values?.applicationId || stepOne?.values?.applicationId || "";
    setApplicationId(nextApplicationId);
    if (stepTwo?.values?.accounts?.length) {
      setAccounts(stepTwo.values.accounts);
      setLastSavedAt(stepTwo.savedAt || "");
    }
    setLoading(false);
  }, [location.state?.applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    async function loadStatus() {
      try {
        const response = await getInfluencerSocialStatus(applicationId);
        if (cancelled) return;
        const savedAccounts = response?.data?.accounts || [];
        if (savedAccounts.length) {
          setAccounts(savedAccounts.map((account) => ({ ...createSocialAccount(account.platform), ...account, clientId: account.id || `${account.platform}-${Date.now()}` })));
        }
      } catch {
        // Local draft remains the fallback until the API has a server draft.
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const saved = saveSocialVerificationDraft({ applicationId, accounts });
      setLastSavedAt(saved.savedAt);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [applicationId, accounts]);

  useEffect(() => {
    const candidates = accounts.filter((account) => {
      if (account.platform !== "instagram") return false;
      if (!account.profileUrl || account.followersCount) return false;
      try {
        new URL(account.profileUrl);
        return !fetchedMetricUrlsRef.current.has(`${account.clientId}:${account.profileUrl}`);
      } catch {
        return false;
      }
    });
    if (!candidates.length) return undefined;
    const timer = window.setTimeout(() => {
      candidates.forEach((account) => {
        fetchedMetricUrlsRef.current.add(`${account.clientId}:${account.profileUrl}`);
        void fetchMetrics(account);
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [accounts]);

  function updateAccount(clientId, nextAccount) {
    setAccounts((current) => current.map((account) => account.clientId === clientId ? nextAccount : account));
    setErrors((current) => ({ ...current, [clientId]: undefined }));
    setPageError("");
  }

  async function fetchMetrics(account) {
    if (!account.profileUrl) return;
    setMetricStates((current) => ({ ...current, [account.clientId]: { loading: true, message: "Fetching profile metrics..." } }));
    try {
      const response = await fetchInfluencerSocialMetrics(account.platform, account.profileUrl);
      const metrics = response?.data || {};
      if (metrics.available) {
        updateAccount(account.clientId, {
          ...account,
          username: metrics.username || account.username,
          channelName: metrics.channelName || account.channelName,
          followersCount: metrics.followersCount ?? account.followersCount,
          subscribers: metrics.platform === "youtube" ? metrics.followersCount ?? account.subscribers : account.subscribers,
          contentCount: metrics.contentCount ?? account.contentCount,
          engagementRate: metrics.engagementRate ?? account.engagementRate,
        });
        setMetricStates((current) => ({ ...current, [account.clientId]: { type: "success", message: metrics.message || "Metrics fetched." } }));
      } else {
        updateAccount(account.clientId, { ...account, username: metrics.username || account.username });
        setMetricStates((current) => ({ ...current, [account.clientId]: { type: "info", message: metrics.message || "Auto fetch unavailable. Enter metrics manually." } }));
      }
    } catch (err) {
      setMetricStates((current) => ({ ...current, [account.clientId]: { type: "error", message: apiError(err, "Could not fetch metrics.") } }));
    }
  }

  function addAccount(platform = "other") {
    setAccounts((current) => [...current, createSocialAccount(platform)]);
  }

  function removeAccount(clientId) {
    setAccounts((current) => current.filter((account) => account.clientId !== clientId));
  }

  function validateCurrent() {
    const nextErrors = validateSocialVerification({ accounts });
    setErrors(nextErrors);
    return nextErrors;
  }

  async function saveDraft({ quiet = false } = {}) {
    const saved = saveSocialVerificationDraft({ applicationId, accounts });
    setLastSavedAt(saved.savedAt);
    if (!applicationId) {
      if (!quiet) setPageError("Complete Step 1 first so we can attach social profiles to your application.");
      return false;
    }
    const nextErrors = validateSocialVerification({ accounts }, { requireVerification: false });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return false;
    setSaving(true);
    try {
      const payloadAccounts = accounts.map(serializeSocialAccount);
      await saveInfluencerSocialDraft({ applicationId, accounts: payloadAccounts });
      return true;
    } catch (err) {
      if (!quiet) setPageError(apiError(err, "Draft saved locally. Server draft will retry later."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function verifyAccount(account) {
    setVerifyingKey(account.clientId);
    setPageError("");
    try {
      if (!applicationId) {
        setPageError("Complete Step 1 first so this social profile can be attached to your application.");
        return;
      }
      if (!account.verificationCode && !account.proofFile) {
        updateAccount(account.clientId, { ...account, verificationCode: generateOwnershipCode() });
        setPageError("A verification code was generated. Add it to your profile and click Verify again, or upload proof.");
        return;
      }
      const singleAccountErrors = validateSocialVerification({ accounts: [account] }, { requireVerification: false });
      if (Object.keys(singleAccountErrors).length) {
        setErrors((current) => ({ ...current, [account.clientId]: singleAccountErrors[account.clientId] || singleAccountErrors[0] }));
        setPageError("Please fix this social profile before verification.");
        return;
      }
      const payloadAccount = serializeSocialAccount(account);
      await saveInfluencerSocialDraft({
        applicationId,
        accounts: [
          {
            ...payloadAccount,
            manualProofSubmitted: Boolean(account.proofFile),
            verificationStatus: account.proofFile ? "under_review" : payloadAccount.verificationStatus,
          },
        ],
      });
      const method = account.proofFile ? "screenshot" : "verification_code";
      const response = await verifyInfluencerSocialAccount({
        applicationId,
        platform: account.platform,
        verificationMethod: method,
        verificationCode: account.verificationCode,
      }, account.proofFile);
      const updated = response?.data?.account;
      updateAccount(account.clientId, {
        ...account,
        ...(updated || {}),
        verificationStatus: updated?.verificationStatus || (account.proofFile ? "under_review" : "pending"),
        manualProofSubmitted: Boolean(account.proofFile),
      });
    } catch (err) {
      setPageError(apiError(err));
    } finally {
      setVerifyingKey("");
    }
  }

  async function handleContinue() {
    const nextErrors = validateCurrent();
    if (Object.keys(nextErrors).length) {
      setPageError("Please fix the highlighted social profiles before continuing.");
      return;
    }
    if (!canContinueSocialVerification(accounts)) {
      setPageError("Continue is available after at least one verified platform or submitted manual proof.");
      return;
    }
    const ok = await saveDraft();
    if (ok) {
      navigate("/influencer/register/profile-information", { state: { applicationId, currentStep: 3 } });
    }
  }

  const draftText = lastSavedAt ? `Draft Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Draft not saved yet";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to="/register/influencer" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Account Information</Link>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Social Media Verification</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-600 dark:text-slate-300">
              Connect your social media profiles to verify your creator presence and eligibility for the Influencer Program.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300" role="status">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {saving ? "Saving..." : draftText}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-5">
            <ProgressIndicator />
            <CreatorScoreCard accounts={accounts} />
          </div>

          <main className="grid gap-5">
            {!applicationId && !loading ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
                <AlertCircle className="mr-2 inline h-4 w-4" /> Complete Step 1 first. Step 2 needs an application id to save server drafts.
              </div>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">Social Profiles</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add unlimited profiles. Admins can review proof and approve, reject, or request more information.</p>
                </div>
                <button type="button" onClick={() => addAccount("other")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
                  <Plus className="h-4 w-4" /> Add Platform
                </button>
              </div>
            </section>

            {accounts.map((account) => (
              <PlatformCard
                key={account.clientId}
                account={account}
                errors={errors[account.clientId]}
                busy={verifyingKey === account.clientId}
                metricState={metricStates[account.clientId]}
                onChange={(nextAccount) => updateAccount(account.clientId, nextAccount)}
                onRemove={() => removeAccount(account.clientId)}
                onFetchMetrics={fetchMetrics}
                onVerify={verifyAccount}
              />
            ))}

            {pageError || errors.form ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
                {pageError || errors.form}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => navigate("/register/influencer")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => saveDraft()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Draft
                </button>
                <button type="button" onClick={() => Promise.all(accounts.map((account) => verifyAccount(account)))} disabled={Boolean(verifyingKey)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
                  <ShieldCheck className="h-4 w-4" /> Verify Accounts
                </button>
                <button type="button" onClick={handleContinue} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

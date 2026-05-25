import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  XCircle,
} from "lucide-react";
import { PasswordField } from "../components/PasswordField";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";
import {
  getPasswordStrength,
  influencerWizardSteps,
  initialInfluencerStepOneForm,
  loadInfluencerStepOneDraft,
  normalizePhone,
  normalizeUsername,
  saveInfluencerStepOneDraft,
  sanitizeInfluencerStepOneDraft,
  validateInfluencerStepOne,
} from "../utils/influencerRegistrationStep1";
import {
  checkInfluencerEmail,
  checkInfluencerUsername,
  saveInfluencerRegistrationDraft,
  submitInfluencerRegistrationStepOne,
} from "../services/influencerRegistrationService";

const benefits = [
  "Earn commissions on every sale",
  "Create your own storefront",
  "Access creator analytics",
  "Promote products through reels and videos",
  "Get exclusive campaign opportunities",
];

const stats = [
  ["10,000+", "Influencers"],
  ["1M+", "Products"],
  ["100K+", "Monthly Customers"],
];

function getApiMessage(err, fallback = "Network error. Please try again.") {
  return err?.response?.data?.message || err?.message || fallback;
}

function FieldMessage({ state }) {
  if (!state?.message) return null;
  const positive = state.available === true || state.type === "success";
  const negative = state.available === false || state.type === "error";
  return (
    <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${positive ? "text-emerald-600 dark:text-emerald-300" : negative ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`} role={negative ? "alert" : "status"}>
      {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : positive ? <CheckCircle2 className="h-3.5 w-3.5" /> : negative ? <XCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {state.message}
    </div>
  );
}

function TextInput({ id, label, required, error, hint, children, className = "", ...props }) {
  const describedBy = `${id}-message`;
  return (
    <label htmlFor={id} className={`block text-sm font-semibold text-slate-900 dark:text-white ${className}`}>
      {label} {required ? <span className="text-rose-500">*</span> : null}
      {children || (
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          {...props}
        />
      )}
      <span id={describedBy} className={`mt-2 block min-h-4 text-xs ${error ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`} role={error ? "alert" : undefined}>
        {error || hint || ""}
      </span>
    </label>
  );
}

function ProgressIndicator() {
  return (
    <div className="relative w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Step 1 of 6</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">16% complete</div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">Account Information</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
        <div className="h-full w-[16%] rounded-full bg-blue-600" />
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Influencer registration steps">
        {influencerWizardSteps.map((step, index) => {
          const active = index === 0;
          return (
            <li key={step} aria-current={active ? "step" : undefined} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold ${active ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-500"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${active ? "bg-white text-slate-950 dark:bg-slate-950 dark:text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800"}`}>{index + 1}</span>
              <span className="truncate">{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BenefitsPanel() {
  return (
    <aside className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-xl dark:border-slate-800">
      <div className="p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
          <Sparkles className="h-3.5 w-3.5" /> Creator Commerce
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight">Turn your content into a marketplace business.</h2>
        <div className="mt-6 grid gap-3">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3 text-sm text-slate-100">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-200">
                <Check className="h-4 w-4" />
              </span>
              {benefit}
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-2xl bg-white/10 p-3">
              <div className="text-lg font-black">{value}</div>
              <div className="mt-1 text-[11px] font-semibold text-slate-300">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.35),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))] p-6 sm:p-8">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4">
            <div className="flex h-18 w-18 items-center justify-center rounded-3xl bg-white text-slate-950">
              <Megaphone className="h-9 w-9" />
            </div>
            <div>
              <div className="text-sm font-bold">Influencer marketing image</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[Store, BarChart3, Users].map((Icon, index) => (
                  <span key={index} className="flex h-10 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-5 w-5 text-blue-100" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function InfluencerRegistrationStepOnePage() {
  const navigate = useNavigate();
  const { influencerCommerceEnabled, loading: featureLoading } = usePlatformFeatures();
  const [form, setForm] = useState(initialInfluencerStepOneForm);
  const [errors, setErrors] = useState({});
  const [emailState, setEmailState] = useState({ message: "" });
  const [usernameState, setUsernameState] = useState({ message: "" });
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const restoredRef = useRef(false);

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = loadInfluencerStepOneDraft();
    if (draft?.values) {
      setForm((current) => ({ ...current, ...draft.values }));
      setLastSavedAt(draft.savedAt);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const saved = saveInfluencerStepOneDraft(form);
      setLastSavedAt(saved.savedAt);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [form]);

  useEffect(() => {
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailState({ message: "" });
      return;
    }
    setEmailState({ loading: true, message: "Checking email..." });
    const timer = window.setTimeout(async () => {
      try {
        const response = await checkInfluencerEmail(email);
        const available = Boolean(response?.data?.available);
        setEmailState({ available, message: available ? "Available" : "Already registered" });
      } catch (err) {
        setEmailState({ type: "error", message: getApiMessage(err, "Could not check email.") });
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form.email]);

  useEffect(() => {
    const username = form.username.trim();
    if (!username || !/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      setUsernameState({ message: "" });
      return;
    }
    setUsernameState({ loading: true, message: "Checking username..." });
    const timer = window.setTimeout(async () => {
      try {
        const response = await checkInfluencerUsername(username);
        const available = Boolean(response?.data?.available);
        setUsernameState({ available, message: available ? "Available" : "Already registered" });
      } catch (err) {
        setUsernameState({ type: "error", message: getApiMessage(err, "Could not check username.") });
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form.username]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setPageError("");
  }

  function validateCurrentForm() {
    const nextErrors = validateInfluencerStepOne(form, {
      email: emailState.available,
      username: usernameState.available,
    });
    setErrors(nextErrors);
    return nextErrors;
  }

  async function handleSaveDraft() {
    setSaving(true);
    setPageError("");
    const saved = saveInfluencerStepOneDraft(form);
    setLastSavedAt(saved.savedAt);
    const nextErrors = validateCurrentForm();
    if (!Object.keys(nextErrors).length) {
      try {
        const response = await saveInfluencerRegistrationDraft(form);
        const application = response?.data?.application;
        if (application?.applicationId) {
          updateField("applicationId", application.applicationId);
          saveInfluencerStepOneDraft({ ...form, applicationId: application.applicationId });
        }
      } catch (err) {
        setPageError(getApiMessage(err, "Draft saved locally. Server draft will retry later."));
      }
    }
    setSaving(false);
  }

  async function handleContinue(event) {
    event.preventDefault();
    setPageError("");
    const nextErrors = validateCurrentForm();
    if (Object.keys(nextErrors).length) {
      setPageError("Please fix the highlighted fields before continuing.");
      return;
    }
    setContinuing(true);
    try {
      const response = await submitInfluencerRegistrationStepOne(form);
      const application = response?.data?.application;
      const nextPath = response?.data?.nextPath || "/influencer/register/social-profiles";
      saveInfluencerStepOneDraft({
        ...sanitizeInfluencerStepOneDraft(form),
        applicationId: application?.applicationId || form.applicationId,
      });
      navigate(nextPath, { state: { applicationId: application?.applicationId, currentStep: 2 } });
    } catch (err) {
      setPageError(getApiMessage(err));
    } finally {
      setContinuing(false);
    }
  }

  const draftLabel = lastSavedAt ? `Draft Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Draft not saved yet";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <Link to="/role" className="text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">Back to roles</Link>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Become an Influencer Partner</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">
            Join our creator community and earn commissions by promoting products from our marketplace.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          <BenefitsPanel />

          <main className="grid gap-5">
            <ProgressIndicator />

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7" aria-labelledby="account-information-title">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 id="account-information-title" className="text-2xl font-bold">Account Information</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Let's create your influencer account.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-300" role="status">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {saving ? "Saving..." : draftLabel}
                </div>
              </div>

              {featureLoading ? (
                <div className="mt-6 grid gap-4" aria-label="Loading influencer registration">
                  {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
                </div>
              ) : !influencerCommerceEnabled ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                  Influencer registrations are paused by the platform administrator.
                </div>
              ) : (
                <form onSubmit={handleContinue} className="mt-6 grid gap-5" noValidate>
                  <div className="grid gap-5 md:grid-cols-2">
                    <TextInput id="firstName" label="First Name" required value={form.firstName} maxLength={50} error={errors.firstName} onChange={(event) => updateField("firstName", event.target.value)} autoComplete="given-name" />
                    <TextInput id="lastName" label="Last Name" required value={form.lastName} maxLength={50} error={errors.lastName} onChange={(event) => updateField("lastName", event.target.value)} autoComplete="family-name" />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <TextInput id="email" label="Email Address" required type="email" value={form.email} error={errors.email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email">
                      <input id="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} aria-invalid={Boolean(errors.email)} className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="creator@example.com" autoComplete="email" />
                      {errors.email ? <span className="mt-2 block text-xs text-rose-600 dark:text-rose-300" role="alert">{errors.email}</span> : <FieldMessage state={emailState} />}
                    </TextInput>
                    <TextInput id="mobile" label="Mobile Number" required value={form.mobile} error={errors.mobile} onChange={(event) => updateField("mobile", normalizePhone(event.target.value))} inputMode="tel" autoComplete="tel" placeholder="+91 9876543210" />
                  </div>

                  <TextInput id="username" label="Username" required value={form.username} error={errors.username} onChange={(event) => updateField("username", normalizeUsername(event.target.value))} hint="Letters, numbers, and underscores only." autoComplete="username">
                    <input id="username" value={form.username} onChange={(event) => updateField("username", normalizeUsername(event.target.value))} aria-invalid={Boolean(errors.username)} className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="techguru2026" autoComplete="username" />
                    {errors.username ? <span className="mt-2 block text-xs text-rose-600 dark:text-rose-300" role="alert">{errors.username}</span> : <FieldMessage state={usernameState} />}
                  </TextInput>

                  <div className="grid gap-5 md:grid-cols-2">
                    <TextInput id="password" label="Password" required error={errors.password}>
                      <PasswordField
                        id="password"
                        value={form.password}
                        onChange={(event) => updateField("password", event.target.value)}
                        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.password)}
                      />
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                        <div className={`h-full rounded-full ${passwordStrength.tone}`} style={{ width: `${passwordStrength.percent}%` }} />
                      </div>
                      <div className={`mt-2 text-xs font-semibold ${errors.password ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`} role={errors.password ? "alert" : "status"}>
                        {errors.password || `Strength: ${passwordStrength.label}`}
                      </div>
                    </TextInput>
                    <TextInput id="confirmPassword" label="Confirm Password" required error={errors.confirmPassword}>
                      <PasswordField
                        id="confirmPassword"
                        value={form.confirmPassword}
                        onChange={(event) => updateField("confirmPassword", event.target.value)}
                        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.confirmPassword)}
                      />
                      <span className={`mt-2 block min-h-4 text-xs ${errors.confirmPassword ? "text-rose-600 dark:text-rose-300" : form.confirmPassword && form.confirmPassword === form.password ? "text-emerald-600 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`} role={errors.confirmPassword ? "alert" : "status"}>
                        {errors.confirmPassword || (form.confirmPassword && form.confirmPassword === form.password ? "Passwords match." : "")}
                      </span>
                    </TextInput>
                  </div>

                  <TextInput id="referralCode" label="Referral Code" value={form.referralCode} error={errors.referralCode} onChange={(event) => updateField("referralCode", event.target.value.toUpperCase())} hint="Optional. We will validate this with the referral system when available." />

                  <fieldset className="grid gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-950">
                    <legend className="sr-only">Terms and communication preferences</legend>
                    {[
                      ["termsAccepted", "I agree to the Influencer Program Terms and Conditions.", true],
                      ["privacyAccepted", "I agree to the Privacy Policy.", true],
                      ["notificationsAccepted", "I agree to receive platform updates and campaign notifications.", false],
                    ].map(([name, label, required]) => (
                      <label key={name} className="flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <input type="checkbox" checked={Boolean(form[name])} onChange={(event) => updateField(name, event.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span>{label} {required ? <span className="text-rose-500">*</span> : null}</span>
                      </label>
                    ))}
                    {(errors.termsAccepted || errors.privacyAccepted) ? (
                      <div className="text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">
                        {errors.termsAccepted || errors.privacyAccepted}
                      </div>
                    ) : null}
                  </fieldset>

                  {pageError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100" role="alert">{pageError}</div> : null}

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" disabled className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-400 disabled:cursor-not-allowed dark:border-slate-800">Back</button>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button type="button" onClick={handleSaveDraft} disabled={saving || continuing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Draft
                      </button>
                      <button type="submit" disabled={continuing || featureLoading || !influencerCommerceEnabled} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950">
                        {continuing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

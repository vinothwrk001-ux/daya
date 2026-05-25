import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calculator, Check, Loader2, Save, ShieldCheck } from "lucide-react";
import {
  getInfluencerBusiness,
  getInfluencerCommissionSettings,
  getInfluencerPayment,
  saveInfluencerPaymentDraft,
  submitInfluencerPayment,
} from "../services/influencerRegistrationService";
import { influencerWizardSteps, loadInfluencerStepOneDraft } from "../utils/influencerRegistrationStep1";
import { loadSocialVerificationDraft } from "../utils/influencerSocialVerification";
import { loadInfluencerProfileDraft } from "../utils/influencerProfileInformation";
import {
  calculateCommissionPreview,
  initialInfluencerPaymentForm,
  loadInfluencerBusinessDraft,
  loadInfluencerPaymentDraft,
  payoutMethods,
  saveInfluencerPaymentDraftLocal,
  validatePaymentInformation,
} from "../utils/influencerBusinessPayment";

function apiError(error, fallback = "Something went wrong. Please try again.") {
  return error?.response?.data?.message || error?.message || fallback;
}

function Field({ label, error, required, children }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900 dark:text-white">{label} {required ? <span className="text-rose-500">*</span> : null}</span>
      <div className="mt-2">{children}</div>
      {error ? <span className="mt-2 block text-xs font-semibold text-rose-600" role="alert">{error}</span> : null}
    </label>
  );
}

function inputClass(error) {
  return `w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:ring-4 dark:bg-slate-950 dark:text-white ${
    error ? "border-rose-300 focus:ring-rose-100 dark:border-rose-500/70" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100 dark:border-slate-700 dark:focus:ring-blue-950"
  }`;
}

function WizardProgress() {
  return (
    <aside className="sticky top-20 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Step 5 of 6</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">83% complete</div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">Payment Details</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-5/6 rounded-full bg-blue-600" />
      </div>
      <ol className="mt-5 grid gap-2" aria-label="Influencer registration progress">
        {influencerWizardSteps.map((step, index) => {
          const label = index === 1 ? "Social Verification" : index === 2 ? "Profile Information" : index === 3 ? "Business Information" : index === 4 ? "Payment Details" : step;
          const completed = index < 4;
          const current = index === 4;
          return (
            <li key={step} aria-current={current ? "step" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold ${current ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : completed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-500"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${current ? "bg-white text-slate-950 dark:bg-slate-950 dark:text-white" : completed ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800"}`}>
                {completed ? <Check className="h-3.5 w-3.5" /> : current ? "->" : index + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function Agreement({ checked, label, error, onChange }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
      <span>{label}</span>
    </label>
  );
}

function formatMoney(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function InfluencerPaymentCommissionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredRef = useRef(false);
  const [form, setForm] = useState(initialInfluencerPaymentForm);
  const [commission, setCommission] = useState({ commissionPercentage: 10, commissionModel: "Per Sale", minimumPayoutThreshold: 500, payoutSchedule: "Monthly", currency: "INR" });
  const [previewPrice, setPreviewPrice] = useState(1000);
  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");

  const earnings = useMemo(() => calculateCommissionPreview(previewPrice, commission.commissionPercentage), [previewPrice, commission.commissionPercentage]);

  useEffect(() => {
    let cancelled = false;
    async function loadCommission() {
      try {
        const response = await getInfluencerCommissionSettings();
        if (!cancelled) setCommission((current) => ({ ...current, ...(response?.data || response?.settings || {}) }));
      } catch {
        // Defaults keep the calculator usable.
      }
    }
    loadCommission();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stepOne = loadInfluencerStepOneDraft();
    const stepTwo = loadSocialVerificationDraft();
    const stepThree = loadInfluencerProfileDraft();
    const stepFour = loadInfluencerBusinessDraft();
    const local = loadInfluencerPaymentDraft();
    const applicationId = location.state?.applicationId || local?.values?.applicationId || stepFour?.values?.applicationId || stepThree?.values?.applicationId || stepTwo?.values?.applicationId || stepOne?.values?.applicationId || "";
    const country = location.state?.country || local?.values?.country || stepFour?.values?.country || "IN";
    setForm((current) => ({ ...current, ...(local?.values || {}), applicationId, country }));
    setLastSavedAt(local?.savedAt || "");
  }, [location.state?.applicationId, location.state?.country]);

  useEffect(() => {
    if (!form.applicationId) return;
    let cancelled = false;
    async function loadPayment() {
      try {
        const [paymentResponse, businessResponse] = await Promise.all([
          getInfluencerPayment(form.applicationId),
          getInfluencerBusiness(form.applicationId),
        ]);
        if (cancelled) return;
        const payment = paymentResponse?.data?.payment;
        const business = businessResponse?.data?.business;
        if (payment) setForm((current) => ({ ...current, payoutMethod: payment.payoutMethod || current.payoutMethod, accountHolderName: payment.accountHolderName || current.accountHolderName, bankName: payment.bankName || current.bankName, branchName: payment.branchName || current.branchName, accountNumberMask: payment.accountNumberMask || current.accountNumberMask, ifscCode: payment.ifscCode || current.ifscCode, swiftCode: payment.swiftCode || current.swiftCode, routingNumber: payment.routingNumber || current.routingNumber, agreements: payment.agreements || current.agreements, applicationId: current.applicationId }));
        if (business?.country) setForm((current) => ({ ...current, country: business.country }));
        if (paymentResponse?.data?.commission) setCommission((current) => ({ ...current, ...paymentResponse.data.commission }));
      } catch {
        // Local draft remains available.
      }
    }
    loadPayment();
    return () => {
      cancelled = true;
    };
  }, [form.applicationId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const saved = saveInfluencerPaymentDraftLocal(form);
      setLastSavedAt(saved.savedAt);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [form]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAgreement(field, value) {
    setForm((current) => ({ ...current, agreements: { ...current.agreements, [field]: value } }));
  }

  async function persist(submit = false) {
    const validation = submit ? validatePaymentInformation(form) : {};
    setErrors(validation);
    setPageError("");
    if (Object.keys(validation).length) return false;
    setSaving(true);
    try {
      const response = submit ? await submitInfluencerPayment(form) : await saveInfluencerPaymentDraft(form);
      const saved = saveInfluencerPaymentDraftLocal(form);
      setLastSavedAt(saved.savedAt);
      if (response?.data?.commission) setCommission((current) => ({ ...current, ...response.data.commission }));
      return true;
    } catch (error) {
      setPageError(apiError(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function continueNext() {
    const ok = await persist(true);
    if (ok) navigate("/influencer/register/content-review", { state: { applicationId: form.applicationId } });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <button type="button" onClick={() => navigate("/influencer/register/business-information", { state: { applicationId: form.applicationId } })} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Business Information
        </button>
        <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr]">
          <WizardProgress />
          <section className="space-y-6">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">Influencer Registration</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Payment & Commission Details</h1>
              <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">Provide payout information to receive influencer commissions securely.</p>
            </header>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Payout Method</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {payoutMethods.map((method) => (
                    <button key={method.value} type="button" onClick={() => update("payoutMethod", method.value)} className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${form.payoutMethod === method.value ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"}`}>
                      {method.label}
                    </button>
                  ))}
                </div>
                {errors.payoutMethod ? <div className="mt-2 text-xs font-semibold text-rose-600">{errors.payoutMethod}</div> : null}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Commission Settings</h2>
                <div className="mt-5 grid gap-3 text-sm">
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"><span>Commission Percentage</span><strong>{commission.commissionPercentage}%</strong></div>
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"><span>Commission Model</span><strong>{commission.commissionModel}</strong></div>
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"><span>Minimum Payout</span><strong>{formatMoney(commission.minimumPayoutThreshold, commission.currency)}</strong></div>
                  <div className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"><span>Payout Schedule</span><strong>{commission.payoutSchedule}</strong></div>
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-black">Payment Details</h2>
              {form.payoutMethod === "bank_transfer" ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Account Holder Name" required error={errors.accountHolderName}><input value={form.accountHolderName} onChange={(event) => update("accountHolderName", event.target.value)} className={inputClass(errors.accountHolderName)} autoComplete="name" /></Field>
                  <Field label="Bank Name" required error={errors.bankName}><input value={form.bankName} onChange={(event) => update("bankName", event.target.value)} className={inputClass(errors.bankName)} /></Field>
                  <Field label="Branch Name" error={errors.branchName}><input value={form.branchName} onChange={(event) => update("branchName", event.target.value)} className={inputClass(errors.branchName)} /></Field>
                  <Field label={form.accountNumberMask ? `Account Number (${form.accountNumberMask} saved)` : "Account Number"} required error={errors.accountNumber}><input type="password" value={form.accountNumber} onChange={(event) => update("accountNumber", event.target.value.replace(/[\s-]/g, ""))} className={inputClass(errors.accountNumber)} autoComplete="off" placeholder={form.accountNumberMask ? "Leave blank to keep saved account" : ""} /></Field>
                  <Field label="Confirm Account Number" required error={errors.confirmAccountNumber}><input type="password" value={form.confirmAccountNumber} onChange={(event) => update("confirmAccountNumber", event.target.value.replace(/[\s-]/g, ""))} className={inputClass(errors.confirmAccountNumber)} autoComplete="off" placeholder={form.accountNumberMask ? "Leave blank to keep saved account" : ""} /></Field>
                  {form.country === "IN" ? <Field label="IFSC Code" required error={errors.ifscCode}><input value={form.ifscCode} onChange={(event) => update("ifscCode", event.target.value.toUpperCase())} className={inputClass(errors.ifscCode)} placeholder="HDFC0001234" /></Field> : <Field label="SWIFT Code" required error={errors.swiftCode}><input value={form.swiftCode} onChange={(event) => update("swiftCode", event.target.value.toUpperCase())} className={inputClass(errors.swiftCode)} /></Field>}
                  <Field label="Routing Number" error={errors.routingNumber}><input value={form.routingNumber} onChange={(event) => update("routingNumber", event.target.value)} className={inputClass(errors.routingNumber)} /></Field>
                </div>
              ) : null}

              {form.payoutMethod === "upi" ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="UPI ID" required error={errors.upiId}><input value={form.upiId} onChange={(event) => update("upiId", event.target.value)} className={inputClass(errors.upiId)} placeholder="creator@okaxis" /></Field>
                  <button type="button" className="inline-flex h-[46px] items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-bold dark:border-slate-700"><ShieldCheck className="h-4 w-4" /> Verify UPI</button>
                </div>
              ) : null}

              {form.payoutMethod === "paypal" ? <div className="mt-5"><Field label="PayPal Email" required error={errors.paypalEmail}><input type="email" value={form.paypalEmail} onChange={(event) => update("paypalEmail", event.target.value)} className={inputClass(errors.paypalEmail)} /></Field></div> : null}
              {form.payoutMethod === "payoneer" ? <div className="mt-5"><Field label="Payoneer Registered Email" required error={errors.payoneerEmail}><input type="email" value={form.payoneerEmail} onChange={(event) => update("payoneerEmail", event.target.value)} className={inputClass(errors.payoneerEmail)} /></Field></div> : null}
              {["stripe_connect", "wise"].includes(form.payoutMethod) ? <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">This payout method will connect to the provider during final verification. Save your selection to continue.</div> : null}
            </section>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="inline-flex items-center gap-2 text-xl font-black"><Calculator className="h-5 w-5" /> Commission Preview</h2>
                <div className="mt-5">
                  <Field label="Product Price"><input type="number" min="0" value={previewPrice} onChange={(event) => setPreviewPrice(event.target.value)} className={inputClass()} /></Field>
                  <div className="mt-4 rounded-3xl bg-slate-50 p-5 dark:bg-slate-950">
                    <div className="text-sm text-slate-500 dark:text-slate-400">You Earn</div>
                    <div className="mt-1 text-3xl font-black text-emerald-600">{formatMoney(earnings, commission.currency)}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-500">{commission.commissionPercentage}% of {formatMoney(previewPrice, commission.currency)}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Payment Agreements</h2>
                <div className="mt-5 grid gap-3">
                  <Agreement checked={form.agreements.payoutPolicy} error={errors.payoutPolicy} onChange={(value) => updateAgreement("payoutPolicy", value)} label="I agree to the payout policy." />
                  <Agreement checked={form.agreements.commissionTerms} error={errors.commissionTerms} onChange={(value) => updateAgreement("commissionTerms", value)} label="I agree to commission terms." />
                  <Agreement checked={form.agreements.taxCompliance} error={errors.taxCompliance} onChange={(value) => updateAgreement("taxCompliance", value)} label="I agree to tax compliance requirements." />
                </div>
              </section>
            </div>

            {pageError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" role="alert">{pageError}</div> : null}

            <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lastSavedAt ? `Draft Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Draft not saved yet"}</div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => navigate("/influencer/register/business-information", { state: { applicationId: form.applicationId } })} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"><ArrowLeft className="h-4 w-4" /> Back</button>
                <button type="button" onClick={() => persist(false)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft</button>
                <button type="button" onClick={continueNext} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Continue</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

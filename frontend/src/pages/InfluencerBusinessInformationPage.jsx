import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Save, Upload } from "lucide-react";
import {
  getInfluencerBusiness,
  getInfluencerCountries,
  saveInfluencerBusinessDraft,
  submitInfluencerBusiness,
} from "../services/influencerRegistrationService";
import { influencerWizardSteps, loadInfluencerStepOneDraft } from "../utils/influencerRegistrationStep1";
import { loadSocialVerificationDraft } from "../utils/influencerSocialVerification";
import { loadInfluencerProfileDraft } from "../utils/influencerProfileInformation";
import {
  businessTypes,
  initialInfluencerBusinessForm,
  loadInfluencerBusinessDraft,
  saveInfluencerBusinessDraftLocal,
  validateBusinessInformation,
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
          <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Step 4 of 6</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">66% complete</div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">Business Information</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-2/3 rounded-full bg-blue-600" />
      </div>
      <ol className="mt-5 grid gap-2" aria-label="Influencer registration progress">
        {influencerWizardSteps.map((step, index) => {
          const label = index === 1 ? "Social Verification" : index === 2 ? "Profile Information" : index === 3 ? "Business Information" : index === 4 ? "Payment Details" : step;
          const completed = index < 3;
          const current = index === 3;
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

function DocumentUpload({ label, file, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
      <span className="inline-flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{file?.name || label}</span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"><Upload className="h-3.5 w-3.5" /> Upload</span>
      <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] || null)} />
    </label>
  );
}

export function InfluencerBusinessInformationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredRef = useRef(false);
  const [form, setForm] = useState(initialInfluencerBusinessForm);
  const [countries, setCountries] = useState([]);
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");

  const selectedCountry = useMemo(() => countries.find((country) => country.code === form.country || country.name === form.country), [countries, form.country]);
  const states = selectedCountry?.states || [];
  const selectedState = states.find((state) => state.name === form.state);
  const cities = selectedState?.cities || [];
  const taxLabel = form.country === "US" ? "EIN / TIN" : form.country === "AE" ? "TRN / VAT" : form.country === "GB" ? "UTR / VAT" : "Tax ID";

  useEffect(() => {
    let cancelled = false;
    async function loadCountries() {
      try {
        const response = await getInfluencerCountries();
        if (!cancelled) setCountries(response?.data || response?.countries || []);
      } catch {
        if (!cancelled) setCountries([]);
      }
    }
    loadCountries();
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
    const local = loadInfluencerBusinessDraft();
    const applicationId = location.state?.applicationId || local?.values?.applicationId || stepThree?.values?.applicationId || stepTwo?.values?.applicationId || stepOne?.values?.applicationId || "";
    setForm((current) => ({ ...current, ...(local?.values || {}), applicationId }));
    setLastSavedAt(local?.savedAt || "");
  }, [location.state?.applicationId]);

  useEffect(() => {
    if (!form.applicationId) return;
    let cancelled = false;
    async function loadBusiness() {
      try {
        const response = await getInfluencerBusiness(form.applicationId);
        if (!cancelled && response?.data?.business) setForm((current) => ({ ...current, ...response.data.business, applicationId: form.applicationId }));
      } catch {
        // Local draft keeps the page usable offline.
      }
    }
    loadBusiness();
    return () => {
      cancelled = true;
    };
  }, [form.applicationId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const saved = saveInfluencerBusinessDraftLocal(form);
      setLastSavedAt(saved.savedAt);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [form]);

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "country") return { ...next, state: "", city: "", nationality: value === "IN" ? "Indian" : current.nationality };
      if (field === "state") return { ...next, city: "" };
      return next;
    });
  }

  async function persist(submit = false) {
    const validation = submit ? validateBusinessInformation(form) : {};
    setErrors(validation);
    setPageError("");
    if (Object.keys(validation).length) return false;
    setSaving(true);
    try {
      const payload = { ...form, ...files };
      const response = submit ? await submitInfluencerBusiness(payload) : await saveInfluencerBusinessDraft(payload);
      const saved = saveInfluencerBusinessDraftLocal(form);
      setLastSavedAt(saved.savedAt);
      if (response?.data?.business) setForm((current) => ({ ...current, ...response.data.business, applicationId: current.applicationId }));
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
    if (ok) navigate("/influencer/register/payment-commission", { state: { applicationId: form.applicationId, country: form.country } });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <button type="button" onClick={() => navigate("/influencer/register/profile-information", { state: { applicationId: form.applicationId } })} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Profile Information
        </button>
        <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr]">
          <WizardProgress />
          <section className="space-y-6">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">Influencer Registration</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Business Information</h1>
              <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">Provide your business and tax information for payouts and compliance purposes.</p>
            </header>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Location Details</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Country" required error={errors.country}>
                    <select value={form.country} onChange={(event) => update("country", event.target.value)} className={inputClass(errors.country)}>
                      <option value="">Select country</option>
                      {countries.map((country) => <option key={country.code || country.name} value={country.code || country.name}>{country.name}</option>)}
                    </select>
                  </Field>
                  <Field label="State" required error={errors.state}>
                    <select value={form.state} onChange={(event) => update("state", event.target.value)} className={inputClass(errors.state)}>
                      <option value="">Select state</option>
                      {states.map((state) => <option key={state.name} value={state.name}>{state.name}</option>)}
                    </select>
                  </Field>
                  <Field label="City" required error={errors.city}>
                    <select value={form.city} onChange={(event) => update("city", event.target.value)} className={inputClass(errors.city)}>
                      <option value="">Select city</option>
                      {cities.map((city) => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </Field>
                  <Field label="Postal Code" required error={errors.postalCode}><input value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} className={inputClass(errors.postalCode)} /></Field>
                  <Field label="Address Line 1" required error={errors.address1}><input value={form.address1} onChange={(event) => update("address1", event.target.value)} maxLength={255} className={inputClass(errors.address1)} /></Field>
                  <Field label="Address Line 2" error={errors.address2}><input value={form.address2} onChange={(event) => update("address2", event.target.value)} maxLength={255} className={inputClass(errors.address2)} /></Field>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Business Type</h2>
                <div className="mt-5 grid gap-4">
                  <Field label="Business Type" required error={errors.businessType}>
                    <select value={form.businessType} onChange={(event) => update("businessType", event.target.value)} className={inputClass(errors.businessType)}>
                      {businessTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </Field>
                  {form.businessType === "other" ? <Field label="Custom Business Type" required error={errors.customBusinessType}><input value={form.customBusinessType} onChange={(event) => update("customBusinessType", event.target.value)} maxLength={100} className={inputClass(errors.customBusinessType)} /></Field> : null}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Tax Information</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="GST Number" error={errors.gstNumber}><input value={form.gstNumber} onChange={(event) => update("gstNumber", event.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" className={inputClass(errors.gstNumber)} /></Field>
                  {form.country === "IN" ? <Field label="PAN Number" required error={errors.panNumber}><input value={form.panNumber} onChange={(event) => update("panNumber", event.target.value.toUpperCase())} placeholder="ABCDE1234F" className={inputClass(errors.panNumber)} /></Field> : <Field label={taxLabel} required error={errors.taxId}><input value={form.taxId} onChange={(event) => update("taxId", event.target.value)} className={inputClass(errors.taxId)} /></Field>}
                  <Field label="Business Registration Number" error={errors.businessRegistrationNumber}><input value={form.businessRegistrationNumber} onChange={(event) => update("businessRegistrationNumber", event.target.value)} className={inputClass(errors.businessRegistrationNumber)} /></Field>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Legal Information</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Legal Name" required error={errors.legalName}><input value={form.legalName} onChange={(event) => update("legalName", event.target.value)} className={inputClass(errors.legalName)} /></Field>
                  <Field label="Business Name" error={errors.businessName}><input value={form.businessName} onChange={(event) => update("businessName", event.target.value)} className={inputClass(errors.businessName)} /></Field>
                  <Field label="Date Of Birth" required error={errors.dateOfBirth}><input type="date" value={form.dateOfBirth ? String(form.dateOfBirth).slice(0, 10) : ""} onChange={(event) => update("dateOfBirth", event.target.value)} className={inputClass(errors.dateOfBirth)} /></Field>
                  <Field label="Nationality" required error={errors.nationality}><input value={form.nationality} onChange={(event) => update("nationality", event.target.value)} className={inputClass(errors.nationality)} /></Field>
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-black">Document Uploads</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Optional. PDF, PNG, JPG, or WEBP up to 10 MB.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DocumentUpload label="GST Certificate" file={files.gstCertificateFile} onChange={(file) => setFiles((current) => ({ ...current, gstCertificateFile: file }))} />
                <DocumentUpload label="Business Registration" file={files.businessRegistrationFile} onChange={(file) => setFiles((current) => ({ ...current, businessRegistrationFile: file }))} />
                <DocumentUpload label="Tax Registration" file={files.taxRegistrationFile} onChange={(file) => setFiles((current) => ({ ...current, taxRegistrationFile: file }))} />
                <DocumentUpload label="Address Proof" file={files.addressProofFile} onChange={(file) => setFiles((current) => ({ ...current, addressProofFile: file }))} />
              </div>
            </section>

            {pageError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" role="alert">{pageError}</div> : null}

            <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lastSavedAt ? `Draft Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Draft not saved yet"}</div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => navigate("/influencer/register/profile-information", { state: { applicationId: form.applicationId } })} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"><ArrowLeft className="h-4 w-4" /> Back</button>
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

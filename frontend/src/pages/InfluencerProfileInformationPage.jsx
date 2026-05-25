import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Check, Image as ImageIcon, Loader2, RotateCw, ShieldCheck, Upload, X } from "lucide-react";
import { getCategories } from "../services/categoryService";
import {
  checkInfluencerProfileSlug,
  getInfluencerProfileDraft,
  saveInfluencerProfileDraft as saveProfileDraftApi,
  submitInfluencerProfileInformation,
} from "../services/influencerRegistrationService";
import { influencerWizardSteps, loadInfluencerStepOneDraft } from "../utils/influencerRegistrationStep1";
import { loadSocialVerificationDraft } from "../utils/influencerSocialVerification";
import {
  defaultContentNiches,
  defaultContentStyles,
  defaultLanguages,
  initialInfluencerProfileForm,
  loadInfluencerProfileDraft,
  saveInfluencerProfileDraft,
  slugifyInfluencer,
  validateInfluencerProfile,
} from "../utils/influencerProfileInformation";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

function apiError(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.message || err?.message || fallback;
}

function filePreview(file, fallback) {
  if (file) return URL.createObjectURL(file);
  return fallback ? resolveApiAssetUrl(fallback) : "";
}

function usePreviewUrl(file, fallback) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = filePreview(file, fallback);
    setUrl(next);
    return () => {
      if (file && next) URL.revokeObjectURL(next);
    };
  }, [file, fallback]);
  return url;
}

function normalizeProfileForm(values = {}) {
  return {
    ...initialInfluencerProfileForm,
    ...values,
    secondaryCategories: Array.isArray(values.secondaryCategories) ? values.secondaryCategories : [],
    languages: Array.isArray(values.languages) && values.languages.length ? values.languages : initialInfluencerProfileForm.languages,
    contentNiche: Array.isArray(values.contentNiche) ? values.contentNiche : [],
    contentStyle: Array.isArray(values.contentStyle) ? values.contentStyle : [],
    mediaTransforms: {
      profilePicture: {
        ...initialInfluencerProfileForm.mediaTransforms.profilePicture,
        ...(values.mediaTransforms?.profilePicture || {}),
      },
      coverBanner: {
        ...initialInfluencerProfileForm.mediaTransforms.coverBanner,
        ...(values.mediaTransforms?.coverBanner || {}),
      },
    },
  };
}

function buildCategoryOptions(categories = []) {
  const seen = new Set();
  const options = [];
  categories.forEach((category, index) => {
    const label = String(category.name || category.title || category.slug || "").trim();
    if (!label) return;
    const rawValue = String(category._id || category.slug || label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `category-${index}`);
    const value = seen.has(rawValue) ? `${rawValue}-${index}` : rawValue;
    seen.add(value);
    options.push({ value, label });
  });
  options.push({ value: "other", label: "Other" });
  return options;
}

function ProgressIndicator() {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Step 3 of 6</div>
          <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">50% complete</div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">Profile Information</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-1/2 rounded-full bg-blue-600" />
      </div>
      <ol className="mt-5 grid gap-2" aria-label="Influencer registration progress">
        {influencerWizardSteps.map((step, index) => {
          const completed = index < 2;
          const current = index === 2;
          const label = step === "Social Profiles" ? "Social Verification" : step === "Creator Profile" ? "Profile Information" : step === "Payment Details" ? "Payment Information" : step === "Verification" ? "Identity Verification" : step;
          return (
            <li key={step} aria-current={current ? "step" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold ${current ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : completed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-500"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${current ? "bg-white text-slate-950 dark:bg-slate-950 dark:text-white" : completed ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800"}`}>
                {completed ? <Check className="h-3.5 w-3.5" /> : current ? "→" : index + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function MediaUpload({ label, field, value, file, transform, error, recommended, maxSize, onChange, onTransform, aspectClass }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [localError, setLocalError] = useState("");
  const maxBytes = maxSize.includes("10") ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  const safeTransform = {
    zoom: Number(transform?.zoom || 1),
    rotation: Number(transform?.rotation || 0),
  };
  useEffect(() => {
    const next = filePreview(file, value);
    setPreviewUrl(next);
    return () => {
      if (file && next) URL.revokeObjectURL(next);
    };
  }, [file, value]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">{label}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">PNG, JPG, JPEG, WEBP. Max {maxSize}. Recommended {recommended}.</p>
        </div>
        {(previewUrl || file) ? (
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        ) : null}
      </div>
      <label className={`mt-4 flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-950 ${aspectClass}`}>
        {previewUrl ? (
          <img src={previewUrl} alt={`${label} preview`} className="h-full w-full object-cover" style={{ transform: `scale(${safeTransform.zoom}) rotate(${safeTransform.rotation}deg)` }} />
        ) : (
          <span className="grid justify-items-center gap-2 text-sm font-bold"><Upload className="h-7 w-7" /> Drag & drop or browse files</span>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => {
          const selected = event.target.files?.[0] || null;
          setLocalError("");
          if (selected && selected.size > maxBytes) {
            setLocalError(`File must be ${maxSize} or smaller.`);
            return;
          }
          onChange(selected);
        }} />
      </label>
      {error || localError ? <div className="mt-2 text-xs font-semibold text-rose-600" role="alert">{error || localError}</div> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Zoom
          <input type="range" min="1" max="3" step="0.1" value={safeTransform.zoom} onChange={(event) => onTransform({ ...safeTransform, zoom: Number(event.target.value) })} className="mt-2 w-full" />
        </label>
        <button type="button" onClick={() => onTransform({ ...safeTransform, rotation: (safeTransform.rotation + 90) % 360 })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">
          <RotateCw className="h-3.5 w-3.5" /> Rotate
        </button>
      </div>
    </section>
  );
}

function MultiSelect({ label, options, values, max, onChange }) {
  const uniqueOptions = [...new Set(options.filter(Boolean))];
  return (
    <div>
      <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {uniqueOptions.map((option) => {
          const selected = values.includes(option);
          return (
            <button key={option} type="button" onClick={() => {
              if (selected) return onChange(values.filter((item) => item !== option));
              if (max && values.length >= max) return;
              onChange([...values, option]);
            }} className={`rounded-full border px-3 py-2 text-xs font-bold ${selected ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"}`}>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePreview({ form, categories }) {
  const profileImage = usePreviewUrl(form.profilePictureFile, form.profilePicture);
  const bannerImage = usePreviewUrl(form.coverBannerFile, form.coverBanner);
  const category = categories.find((item) => String(item._id || item.slug) === form.primaryCategory)?.name || form.customCategory || "Category";
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative h-44 shrink-0 bg-slate-200 dark:bg-slate-800">
        {bannerImage ? <img src={bannerImage} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><ImageIcon className="h-10 w-10" /></div>}
      </div>
      <div className="relative min-h-[292px] p-5 pt-0">
        <div className="grid min-h-20 grid-cols-[7rem_minmax(0,1fr)] items-end gap-4">
          <div className="-mt-14 flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-slate-100 text-slate-400 shadow-sm dark:border-slate-900 dark:bg-slate-800">
            {profileImage ? <img src={profileImage} alt="" className="h-full w-full object-cover" /> : <Camera className="h-8 w-8" />}
          </div>
          <span className="mb-4 inline-flex h-8 w-fit max-w-full items-center rounded-full bg-blue-600 px-3 text-xs font-black text-white">Influencer Badge</span>
        </div>
        <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{form.displayName || "Display Name"}</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600 dark:text-slate-300">{form.shortBio || "Your short bio will appear here."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{category}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Followers</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Storefront Preview</span>
        </div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Influencer URL</div>
          <div className="mt-1 truncate text-sm font-black text-blue-600">/influencer/{form.storeSlug || "your-store-slug"}</div>
        </div>
      </div>
    </section>
  );
}

export function InfluencerProfileInformationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredRef = useRef(false);
  const [form, setForm] = useState(initialInfluencerProfileForm);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [errors, setErrors] = useState({});
  const [slugState, setSlugState] = useState({ message: "" });
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await getCategories();
        if (!cancelled) setCategories(response?.data || []);
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stepOne = loadInfluencerStepOneDraft();
    const stepTwo = loadSocialVerificationDraft();
    const local = loadInfluencerProfileDraft();
    const applicationId = location.state?.applicationId || local?.values?.applicationId || stepTwo?.values?.applicationId || stepOne?.values?.applicationId || "";
    setForm((current) => normalizeProfileForm({ ...current, ...(local?.values || {}), applicationId }));
    setLastSavedAt(local?.savedAt || "");
  }, [location.state?.applicationId]);

  useEffect(() => {
    if (!form.applicationId) return;
    let cancelled = false;
    async function loadDraft() {
      try {
        const response = await getInfluencerProfileDraft(form.applicationId);
        const profile = response?.data?.profile;
        if (!cancelled && profile) setForm((current) => normalizeProfileForm({ ...current, ...profile, applicationId: form.applicationId }));
      } catch {
        // Local draft remains available.
      }
    }
    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [form.applicationId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const saved = saveInfluencerProfileDraft(form);
      setLastSavedAt(saved.savedAt);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [form]);

  useEffect(() => {
    if (!form.storeSlug) return;
    setSlugState({ loading: true, message: "Checking slug..." });
    const timer = window.setTimeout(async () => {
      try {
        const response = await checkInfluencerProfileSlug(form.storeSlug, form.applicationId);
        setSlugState({ available: response?.data?.available, message: response?.data?.message || "" });
      } catch (err) {
        setSlugState({ available: false, message: apiError(err, "Could not check slug.") });
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form.storeSlug, form.applicationId]);

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "displayName" && (!current.storeName || current.storeName === current.displayName)) {
        next.storeName = value;
      }
      if (field === "displayName" && (!current.storeSlug || current.storeSlug === slugifyInfluencer(current.displayName))) {
        next.storeSlug = slugifyInfluencer(value);
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: "" }));
    setPageError("");
  }

  function validateCurrent() {
    const nextErrors = validateInfluencerProfile(form, { slugAvailable: slugState.available !== false });
    setErrors(nextErrors);
    return nextErrors;
  }

  async function saveDraft({ quiet = false, submit = false } = {}) {
    const saved = saveInfluencerProfileDraft(form);
    setLastSavedAt(saved.savedAt);
    if (!form.applicationId) {
      if (!quiet) setPageError("Complete Step 1 before saving profile information.");
      return false;
    }
    if (submit) {
      const nextErrors = validateCurrent();
      if (Object.keys(nextErrors).length) return false;
    }
    setSaving(true);
    try {
      const response = submit ? await submitInfluencerProfileInformation(form) : await saveProfileDraftApi(form);
      const profile = response?.data?.profile;
      if (profile) setForm((current) => normalizeProfileForm({ ...current, ...profile, applicationId: form.applicationId }));
      return true;
    } catch (err) {
      if (!quiet) setPageError(apiError(err, "Draft saved locally. Server draft will retry later."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleContinue() {
    const ok = await saveDraft({ submit: true });
    if (ok) navigate("/influencer/register/business-information", { state: { applicationId: form.applicationId, currentStep: 4 } });
  }

  const draftText = lastSavedAt ? `Draft Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Draft not saved yet";
  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to="/influencer/register/social-verification" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Social Verification</Link>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Profile Information</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-600 dark:text-slate-300">Create your public influencer profile that customers will see throughout the marketplace.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300" role="status">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {saving ? "Saving..." : draftText}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            <ProgressIndicator />
            <ProfilePreview form={form} categories={categories} />
          </div>

          <main className="grid gap-5">
            <MediaUpload
              label="Profile Picture"
              field="profilePicture"
              value={form.profilePicture}
              file={form.profilePictureFile}
              transform={form.mediaTransforms.profilePicture}
              error={errors.profilePicture}
              recommended="500 x 500 px"
              maxSize="5 MB"
              aspectClass="aspect-square max-h-[360px]"
              onChange={(file) => updateField("profilePictureFile", file)}
              onTransform={(transform) => updateField("mediaTransforms", { ...form.mediaTransforms, profilePicture: transform })}
            />
            <MediaUpload
              label="Cover Banner"
              field="coverBanner"
              value={form.coverBanner}
              file={form.coverBannerFile}
              transform={form.mediaTransforms.coverBanner}
              error={errors.coverBanner}
              recommended="1920 x 500 px"
              maxSize="10 MB"
              aspectClass="aspect-[16/5] min-h-40"
              onChange={(file) => updateField("coverBannerFile", file)}
              onTransform={(transform) => updateField("mediaTransforms", { ...form.mediaTransforms, coverBanner: transform })}
            />

            <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="text-sm font-bold">Display Name *
                  <input value={form.displayName} onChange={(event) => updateField("displayName", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" placeholder="Tech Guru Reviews" />
                  {errors.displayName ? <span className="mt-2 block text-xs text-rose-600">{errors.displayName}</span> : null}
                </label>
                <label className="text-sm font-bold">Personal Website
                  <input value={form.website} onChange={(event) => updateField("website", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" placeholder="https://example.com" />
                  {errors.website ? <span className="mt-2 block text-xs text-rose-600">{errors.website}</span> : null}
                </label>
              </div>
              <label className="text-sm font-bold">Short Bio *
                <textarea value={form.shortBio} onChange={(event) => updateField("shortBio", event.target.value.slice(0, 160))} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" placeholder="Helping shoppers discover the best technology products and gadgets." />
                <span className={`mt-2 block text-xs ${errors.shortBio ? "text-rose-600" : "text-slate-500"}`}>{errors.shortBio || `${form.shortBio.length}/160 characters`}</span>
              </label>
              <label className="text-sm font-bold">Long Bio
                <textarea value={form.longBio} onChange={(event) => updateField("longBio", event.target.value.slice(0, 2000))} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" placeholder="Paragraphs, links, and lists can be added here." />
                <span className="mt-2 block text-xs text-slate-500">{form.longBio.length}/2000 characters</span>
              </label>
            </section>

            <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="text-sm font-bold">Primary Category *
                  <select value={form.primaryCategory} onChange={(event) => updateField("primaryCategory", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                    <option value="">{loadingCategories ? "Loading categories..." : "Select category"}</option>
                    {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                  {errors.primaryCategory ? <span className="mt-2 block text-xs text-rose-600">{errors.primaryCategory}</span> : null}
                </label>
                {form.primaryCategory === "other" ? (
                  <label className="text-sm font-bold">Custom Category *
                    <input value={form.customCategory} onChange={(event) => updateField("customCategory", event.target.value)} maxLength={100} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
                    {errors.customCategory ? <span className="mt-2 block text-xs text-rose-600">{errors.customCategory}</span> : null}
                  </label>
                ) : null}
              </div>
              <MultiSelect label="Secondary Categories" options={categoryOptions.filter((item) => item.value !== "other").map((item) => item.label)} values={form.secondaryCategories} max={5} onChange={(value) => updateField("secondaryCategories", value)} />
              {errors.secondaryCategories ? <span className="text-xs text-rose-600">{errors.secondaryCategories}</span> : null}
              <MultiSelect label="Languages" options={defaultLanguages} values={form.languages} onChange={(value) => updateField("languages", value)} />
              <MultiSelect label="Content Niche" options={defaultContentNiches} values={form.contentNiche} onChange={(value) => updateField("contentNiche", value)} />
              <MultiSelect label="Content Style" options={defaultContentStyles} values={form.contentStyle} onChange={(value) => updateField("contentStyle", value)} />
            </section>

            <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="grid gap-5 md:grid-cols-3">
                {["country", "state", "city"].map((field) => (
                  <label key={field} className="text-sm font-bold capitalize">{field}
                    <input value={form[field]} onChange={(event) => updateField(field, event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
                  </label>
                ))}
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="text-sm font-bold">Influencer Store Name
                  <input value={form.storeName} onChange={(event) => updateField("storeName", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label className="text-sm font-bold">Influencer URL Slug *
                  <input value={form.storeSlug} onChange={(event) => updateField("storeSlug", slugifyInfluencer(event.target.value))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
                  <span className={`mt-2 block text-xs ${errors.storeSlug || slugState.available === false ? "text-rose-600" : slugState.available ? "text-emerald-600" : "text-slate-500"}`}>{errors.storeSlug || slugState.message || "/influencer/your-slug"}</span>
                </label>
              </div>
            </section>

            <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-black">SEO Settings</h3>
              <input value={form.metaTitle} onChange={(event) => updateField("metaTitle", event.target.value.slice(0, 160))} className="h-12 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" placeholder="Meta Title" />
              <textarea value={form.metaDescription} onChange={(event) => updateField("metaDescription", event.target.value.slice(0, 300))} rows={3} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" placeholder="Meta Description" />
              <MediaUpload
                label="Social Sharing Image"
                field="socialSharingImage"
                value={form.socialSharingImage}
                file={form.socialSharingImageFile}
                transform={{ zoom: 1, rotation: 0 }}
                recommended="1200 x 630 px"
                maxSize="5 MB"
                aspectClass="aspect-[16/9] min-h-40"
                onChange={(file) => updateField("socialSharingImageFile", file)}
                onTransform={() => {}}
              />
            </section>

            {pageError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100" role="alert">{pageError}</div> : null}

            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => navigate("/influencer/register/social-verification", { state: { applicationId: form.applicationId } })} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"><ArrowLeft className="h-4 w-4" /> Back</button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => saveDraft()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Draft</button>
                <button type="button" onClick={handleContinue} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5 disabled:opacity-60 dark:bg-white dark:text-slate-950">Continue <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

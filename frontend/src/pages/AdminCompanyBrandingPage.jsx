import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "../components/BrandLogo";
import {
  createCompanyBranding,
  deleteCompanyBrandingAsset,
  getCompanyBranding,
  getCompanyBrandingVersions,
  rollbackCompanyBranding,
  updateCompanyBranding,
} from "../services/companyBrandingService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";
import { useBranding } from "../context/BrandingContext";

const ASSET_FIELDS = [
  { key: "primaryLogo", label: "Primary Logo", slot: "primary_logo", recommended: "300 x 80", formats: "PNG, SVG, WEBP" },
  { key: "darkLogo", label: "Dark Theme Logo", slot: "dark_logo", recommended: "300 x 80", formats: "PNG, SVG, WEBP" },
  { key: "mobileLogo", label: "Mobile Logo", slot: "mobile_logo", recommended: "150 x 40", formats: "PNG, SVG, WEBP" },
  { key: "favicon", label: "Favicon", slot: "favicon", recommended: "32 x 32, 48 x 48, 64 x 64", formats: "PNG, ICO" },
  { key: "emailLogo", label: "Email Header Logo", slot: "email_logo", recommended: "600 x 120", formats: "PNG, SVG, WEBP" },
  { key: "invoiceLogo", label: "Invoice Logo", slot: "invoice_logo", recommended: "400 x 100", formats: "PNG, SVG, WEBP" },
  { key: "organizationLogo", label: "Organization Logo", slot: "organization_logo", recommended: "400 x 400", formats: "PNG, SVG, WEBP" },
];

const EMPTY_FORM = {
  companyName: "",
  legalCompanyName: "",
  tagline: "",
  supportEmail: "",
  supportPhone: "",
  websiteUrl: "",
  primaryColor: "#0f172a",
  secondaryColor: "#1e293b",
  accentColor: "#f97316",
  successColor: "#16a34a",
  warningColor: "#f59e0b",
  dangerColor: "#dc2626",
  organizationName: "",
  organizationUrl: "",
  footer: {
    enabled: true,
    theme: "dark",
    backgroundColor: "#0f172a",
    textColor: "#e2e8f0",
    linkColor: "#60a5fa",
    sections: [
      {
        title: "About",
        description: "Premium marketplace experiences for modern shoppers.",
        links: [
          { label: "Our story", href: "/our-story" },
          { label: "Why UChooseMe", href: "/why-us" },
        ],
      },
      {
        title: "Customer care",
        description: "Support and policy links for every journey.",
        links: [
          { label: "Shipping policy", href: "/shipping-policy" },
          { label: "Returns", href: "/return-policy" },
        ],
      },
      {
        title: "Quick links",
        description: "Common entry points for shoppers and sellers.",
        links: [
          { label: "Shop", href: "/shop" },
          { label: "Login", href: "/login" },
        ],
      },
    ],
    socialLinks: [
      { label: "Instagram", href: "https://instagram.com" },
      { label: "LinkedIn", href: "https://linkedin.com" },
    ],
    legalLinks: [
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms & conditions", href: "/terms-and-conditions" },
    ],
    copyrightText: "© 2026 UChooseMe. All rights reserved.",
  },
};

const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Unable to save company branding.";
}

export function AdminCompanyBrandingPage() {
  const { reload } = useBranding();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [branding, setBranding] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [versions, setVersions] = useState([]);
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const inputRefs = useRef({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [brandingResponse] = await Promise.all([getCompanyBranding()]);
        setBranding(brandingResponse);
        setForm({
          companyName: brandingResponse.companyName || "",
          legalCompanyName: brandingResponse.legalCompanyName || "",
          tagline: brandingResponse.tagline || "",
          supportEmail: brandingResponse.supportEmail || "",
          supportPhone: brandingResponse.supportPhone || "",
          websiteUrl: brandingResponse.websiteUrl || "",
          primaryColor: brandingResponse.brandColors?.primaryColor || "#0f172a",
          secondaryColor: brandingResponse.brandColors?.secondaryColor || "#1e293b",
          accentColor: brandingResponse.brandColors?.accentColor || "#f97316",
          successColor: brandingResponse.brandColors?.successColor || "#16a34a",
          warningColor: brandingResponse.brandColors?.warningColor || "#f59e0b",
          dangerColor: brandingResponse.brandColors?.dangerColor || "#dc2626",
          organizationName: brandingResponse.seoBranding?.organizationName || brandingResponse.companyName || "",
          organizationUrl: brandingResponse.seoBranding?.organizationUrl || brandingResponse.websiteUrl || "",
          footer: brandingResponse.footer || EMPTY_FORM.footer,
        });
        if (brandingResponse?._id) {
          const history = await getCompanyBrandingVersions(brandingResponse._id);
          setVersions(history.versions || []);
        } else {
          setVersions([]);
        }
      } catch (loadError) {
        setError(normalizeError(loadError));
      } finally {
        setLoading(false);
      }
    }

    load().catch(() => {});
  }, []);

  useEffect(() => {
    const cleanup = [];
    Object.entries(files).forEach(([key, file]) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      cleanup.push(url);
      setPreviews((current) => ({ ...current, [key]: url }));
    });
    return () => cleanup.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const previewBrand = useMemo(
    () => ({
      companyName: form.companyName || branding?.companyName || "UChooseMe",
      tagline: form.tagline || branding?.tagline || "",
      supportEmail: form.supportEmail || branding?.supportEmail || "",
      supportPhone: form.supportPhone || branding?.supportPhone || "",
      websiteUrl: form.websiteUrl || branding?.websiteUrl || "",
      brandColors: {
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        successColor: form.successColor,
        warningColor: form.warningColor,
        dangerColor: form.dangerColor,
      },
      footer: form.footer || branding?.footer || EMPTY_FORM.footer,
    }),
    [branding, form]
  );

  function handleFileChange(key, event) {
    const file = event.target.files?.[0] || null;
    setFiles((current) => ({ ...current, [key]: file }));
    setMessage("");
  }

  function updateFooter(update) {
    setForm((current) => ({ ...current, footer: update(current.footer || EMPTY_FORM.footer) }));
    setMessage("");
  }

  function handleFooterFieldChange(field, value) {
    updateFooter((footer) => ({ ...footer, [field]: value }));
  }

  function handleFooterSectionChange(sectionIndex, field, value) {
    updateFooter((footer) => {
      const sections = [...(footer.sections || [])];
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        [field]: value,
        links: sections[sectionIndex]?.links || [],
      };
      return { ...footer, sections };
    });
  }

  function handleFooterSectionLinkChange(sectionIndex, linkIndex, field, value) {
    updateFooter((footer) => {
      const sections = [...(footer.sections || [])];
      const section = sections[sectionIndex] || { title: "", description: "", links: [] };
      const links = [...(section.links || [])];
      links[linkIndex] = { ...links[linkIndex], [field]: value };
      sections[sectionIndex] = { ...section, links };
      return { ...footer, sections };
    });
  }

  function handleAddFooterSection() {
    updateFooter((footer) => {
      const sections = [...(footer.sections || [])];
      sections.push({
        title: "",
        description: "",
        links: [{ label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }],
      });
      return { ...footer, sections };
    });
  }

  function handleFooterListLinkChange(listKey, index, field, value) {
    updateFooter((footer) => {
      const links = [...(footer[listKey] || [])];
      links[index] = { ...links[index], [field]: value };
      return { ...footer, [listKey]: links };
    });
  }

  async function handleRemove(slot) {
    if (!branding?._id) return;
    setSaving(true);
    setError("");
    try {
      const updated = await deleteCompanyBrandingAsset(branding._id, slot);
      setBranding(updated);
      const history = await getCompanyBrandingVersions(updated._id);
      setVersions(history.versions || []);
      setMessage("Branding asset removed.");
      window.dispatchEvent(new Event("branding:updated"));
      await reload();
    } catch (removeError) {
      setError(normalizeError(removeError));
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "footer") {
          body.append(key, JSON.stringify(value || {}));
        } else {
          body.append(key, value || "");
        }
      });
      ASSET_FIELDS.forEach((asset) => {
        if (files[asset.key]) {
          body.append(asset.key, files[asset.key]);
        }
      });
      const saved = branding?._id
        ? await updateCompanyBranding(branding._id, body, { isFormData: true })
        : await createCompanyBranding(body, { isFormData: true });
      setBranding(saved);
      const history = await getCompanyBrandingVersions(saved._id);
      setVersions(history.versions || []);
      setFiles({});
      setPreviews({});
      Object.values(inputRefs.current).forEach((input) => {
        if (input) input.value = "";
      });
      setMessage("Company branding saved and cache refreshed.");
      window.dispatchEvent(new Event("branding:updated"));
      await reload();
    } catch (saveError) {
      setError(normalizeError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleRollback(versionId) {
    if (!branding?._id) return;
    setSaving(true);
    setError("");
    try {
      const saved = await rollbackCompanyBranding(branding._id, versionId);
      setBranding(saved);
      const history = await getCompanyBrandingVersions(saved._id);
      setVersions(history.versions || []);
      setMessage("Branding rollback completed.");
      window.dispatchEvent(new Event("branding:updated"));
      await reload();
    } catch (rollbackError) {
      setError(normalizeError(rollbackError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <form onSubmit={onSubmit} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Company Branding</h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage company identity, logos, SEO metadata, and brand colors from one workspace-safe module.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Version</div>
              <div className="text-lg font-semibold text-slate-950">{branding?.version || 1}</div>
            </div>
          </div>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-base font-semibold text-slate-950">Company Information</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <LabeledField label="Company Name"><input className={INPUT_CLASS} value={form.companyName} onChange={(e) => setForm((c) => ({ ...c, companyName: e.target.value }))} /></LabeledField>
              <LabeledField label="Legal Company Name"><input className={INPUT_CLASS} value={form.legalCompanyName} onChange={(e) => setForm((c) => ({ ...c, legalCompanyName: e.target.value }))} /></LabeledField>
              <div className="md:col-span-2"><LabeledField label="Tagline"><input className={INPUT_CLASS} value={form.tagline} onChange={(e) => setForm((c) => ({ ...c, tagline: e.target.value }))} /></LabeledField></div>
              <LabeledField label="Support Email"><input className={INPUT_CLASS} type="email" value={form.supportEmail} onChange={(e) => setForm((c) => ({ ...c, supportEmail: e.target.value }))} /></LabeledField>
              <LabeledField label="Support Phone"><input className={INPUT_CLASS} value={form.supportPhone} onChange={(e) => setForm((c) => ({ ...c, supportPhone: e.target.value }))} /></LabeledField>
              <div className="md:col-span-2"><LabeledField label="Website URL"><input className={INPUT_CLASS} value={form.websiteUrl} onChange={(e) => setForm((c) => ({ ...c, websiteUrl: e.target.value }))} /></LabeledField></div>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-base font-semibold text-slate-950">Brand Assets</h3>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {ASSET_FIELDS.map((asset) => {
                const savedAsset =
                  asset.key === "organizationLogo"
                    ? branding?.seoBranding?.organizationLogo
                    : branding?.[asset.key];
                const preview = previews[asset.key] || savedAsset?.thumbnailUrl || savedAsset?.url || "";
                return (
                  <div key={asset.key} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{asset.label}</div>
                        <div className="mt-1 text-xs text-slate-500">{asset.formats} | Max 5 MB | Recommended {asset.recommended}</div>
                      </div>
                      {savedAsset?.url ? (
                        <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => handleRemove(asset.slot)}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-4 flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                      {preview ? (
                        <img src={resolveApiAssetUrl(preview)} alt={asset.label} className="max-h-24 w-auto object-contain" />
                      ) : (
                        <div className="text-sm text-slate-400">No asset uploaded</div>
                      )}
                    </div>
                    <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                      Replace
                      <input
                        ref={(node) => {
                          inputRefs.current[asset.key] = node;
                        }}
                        type="file"
                        accept={asset.slot === "favicon" ? ".png,.ico" : ".png,.svg,.webp"}
                        onChange={(event) => handleFileChange(asset.key, event)}
                        className="hidden"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-base font-semibold text-slate-950">Brand Colors</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["primaryColor", "Primary Color"],
                ["secondaryColor", "Secondary Color"],
                ["accentColor", "Accent Color"],
                ["successColor", "Success Color"],
                ["warningColor", "Warning Color"],
                ["dangerColor", "Danger Color"],
              ].map(([key, label]) => (
                <LabeledField key={key} label={label}>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form[key]} onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))} className="h-11 w-14 rounded-xl border border-slate-200 bg-white p-1" />
                    <input className={INPUT_CLASS} value={form[key]} onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))} />
                  </div>
                </LabeledField>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-base font-semibold text-slate-950">SEO Branding</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <LabeledField label="Organization Name"><input className={INPUT_CLASS} value={form.organizationName} onChange={(e) => setForm((c) => ({ ...c, organizationName: e.target.value }))} /></LabeledField>
              <LabeledField label="Organization URL"><input className={INPUT_CLASS} value={form.organizationUrl} onChange={(e) => setForm((c) => ({ ...c, organizationUrl: e.target.value }))} /></LabeledField>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-emerald-200">
              {JSON.stringify(branding?.schemaMarkupPreview || {}, null, 2)}
            </pre>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Footer Builder</h3>
                <p className="mt-1 text-sm text-slate-500">Manage the public footer content, link groups, social channels, and theme styling.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.footer?.enabled}
                    onChange={(e) => handleFooterFieldChange("enabled", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-700"
                  />
                  Enabled
                </label>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm text-slate-600">Theme</span>
                  <select
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    value={form.footer?.theme}
                    onChange={(e) => handleFooterFieldChange("theme", e.target.value)}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <LabeledField label="Background Color">
                <div className="flex items-center gap-3">
                  <input type="color" value={form.footer?.backgroundColor} onChange={(e) => handleFooterFieldChange("backgroundColor", e.target.value)} className="h-11 w-14 rounded-xl border border-slate-200 bg-white p-1" />
                  <input className={INPUT_CLASS} value={form.footer?.backgroundColor} onChange={(e) => handleFooterFieldChange("backgroundColor", e.target.value)} />
                </div>
              </LabeledField>
              <LabeledField label="Text Color">
                <div className="flex items-center gap-3">
                  <input type="color" value={form.footer?.textColor} onChange={(e) => handleFooterFieldChange("textColor", e.target.value)} className="h-11 w-14 rounded-xl border border-slate-200 bg-white p-1" />
                  <input className={INPUT_CLASS} value={form.footer?.textColor} onChange={(e) => handleFooterFieldChange("textColor", e.target.value)} />
                </div>
              </LabeledField>
              <LabeledField label="Link Color">
                <div className="flex items-center gap-3">
                  <input type="color" value={form.footer?.linkColor} onChange={(e) => handleFooterFieldChange("linkColor", e.target.value)} className="h-11 w-14 rounded-xl border border-slate-200 bg-white p-1" />
                  <input className={INPUT_CLASS} value={form.footer?.linkColor} onChange={(e) => handleFooterFieldChange("linkColor", e.target.value)} />
                </div>
              </LabeledField>
            </div>

            <div className="mt-6 space-y-6">
              {(form.footer?.sections || []).map((section, sectionIndex) => (
                <div key={sectionIndex} className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledField label="Section Title">
                      <input
                        className={INPUT_CLASS}
                        value={section.title}
                        onChange={(e) => handleFooterSectionChange(sectionIndex, "title", e.target.value)}
                      />
                    </LabeledField>
                    <LabeledField label="Section Description">
                      <input
                        className={INPUT_CLASS}
                        value={section.description}
                        onChange={(e) => handleFooterSectionChange(sectionIndex, "description", e.target.value)}
                      />
                    </LabeledField>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, linkIndex) => {
                      const link = section.links?.[linkIndex] || { label: "", href: "" };
                      return (
                        <div key={linkIndex}>
                          <div className="text-sm font-medium text-slate-700">Link {linkIndex + 1}</div>
                          <input
                            className={`${INPUT_CLASS} mt-2`}
                            placeholder="Label"
                            value={link.label}
                            onChange={(e) => handleFooterSectionLinkChange(sectionIndex, linkIndex, "label", e.target.value)}
                          />
                          <input
                            className={`${INPUT_CLASS} mt-2`}
                            placeholder="URL"
                            value={link.href}
                            onChange={(e) => handleFooterSectionLinkChange(sectionIndex, linkIndex, "href", e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddFooterSection}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100"
              >
                + Add footer section
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-slate-950">Social Links</h4>
                <div className="mt-4 space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => {
                    const link = form.footer?.socialLinks?.[index] || { label: "", href: "" };
                    return (
                      <div key={index} className="grid gap-3 sm:grid-cols-2">
                        <input
                          className={INPUT_CLASS}
                          placeholder="Label"
                          value={link.label}
                          onChange={(e) => handleFooterListLinkChange("socialLinks", index, "label", e.target.value)}
                        />
                        <input
                          className={INPUT_CLASS}
                          placeholder="URL"
                          value={link.href}
                          onChange={(e) => handleFooterListLinkChange("socialLinks", index, "href", e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-slate-950">Legal Links</h4>
                <div className="mt-4 space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => {
                    const link = form.footer?.legalLinks?.[index] || { label: "", href: "" };
                    return (
                      <div key={index} className="grid gap-3 sm:grid-cols-2">
                        <input
                          className={INPUT_CLASS}
                          placeholder="Label"
                          value={link.label}
                          onChange={(e) => handleFooterListLinkChange("legalLinks", index, "label", e.target.value)}
                        />
                        <input
                          className={INPUT_CLASS}
                          placeholder="URL"
                          value={link.href}
                          onChange={(e) => handleFooterListLinkChange("legalLinks", index, "href", e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <LabeledField label="Copyright text">
                <textarea
                  className={`${INPUT_CLASS} min-h-[110px]`}
                  value={form.footer?.copyrightText}
                  onChange={(e) => handleFooterFieldChange("copyrightText", e.target.value)}
                />
              </LabeledField>
            </div>
          </section>

          <button type="submit" disabled={loading || saving} className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save Branding"}
          </button>
        </form>

        <div className="grid gap-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Preview Panel</h3>
                <p className="mt-1 text-sm text-slate-500">Desktop, tablet, mobile, login, footer, email, and invoice snapshots.</p>
              </div>
              <BrandLogo showName={false} imgClassName="h-10 w-auto object-contain" />
            </div>
            <div className="mt-5 grid gap-4">
              <PreviewCard title="Header Preview" brand={previewBrand} />
              <PreviewCard title="Footer Preview" brand={previewBrand} footer />
              <PreviewCard title="Login Preview" brand={previewBrand} auth />
              <PreviewCard title="Invoice Preview" brand={previewBrand} invoice />
              <PreviewCard title="Email Preview" brand={previewBrand} email />
              <div className="grid gap-3 sm:grid-cols-3">
                <DevicePreview label="Desktop" />
                <DevicePreview label="Tablet" compact />
                <DevicePreview label="Mobile" narrow />
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Version History</h3>
            <div className="mt-4 space-y-3">
              {versions.length ? (
                versions.map((version) => (
                  <div key={version._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">Version {version.versionNumber}</div>
                        <div className="mt-1 text-xs text-slate-500">{version.changeSummary?.join(" | ") || version.changeType}</div>
                        <div className="mt-2 text-xs text-slate-500">{new Date(version.changedAt).toLocaleString()}</div>
                      </div>
                      {version.rollbackAvailable ? (
                        <button type="button" onClick={() => handleRollback(version._id)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
                          Rollback
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No saved history yet.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function LabeledField({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function PreviewCard({ title, brand, footer = false, auth = false, invoice = false, email = false }) {
  const footerContent = footer ? brand.footer || {} : null;
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{title}</div>
      <div
        className={`p-4 ${footer ? "bg-slate-950 text-white" : "bg-white text-slate-900"}`}
        style={{ borderColor: brand.brandColors.primaryColor }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{brand.companyName}</div>
            <div className={`text-xs ${footer ? "text-slate-300" : "text-slate-500"}`}>{brand.tagline}</div>
          </div>
          <div
            className="h-10 w-10 rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${brand.brandColors.primaryColor}, ${brand.brandColors.accentColor})` }}
          />
        </div>
        {auth ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">Secure access for customers, sellers, and staff.</div> : null}
        {invoice ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">Invoice header, support block, and footer logo will inherit this branding.</div> : null}
        {email ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">Email header logo, support links, and CTA color tokens preview.</div> : null}
        {footer ? (
          <div className="mt-5 space-y-4 text-sm text-slate-300">
            {footerContent.sections?.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                <div className="font-semibold text-white">{section.title || "Footer section"}</div>
                <div className="text-xs text-slate-400">{section.description}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(section.links || [])
                    .filter((link) => link.label || link.href)
                    .map((link, linkIndex) => (
                      <span key={linkIndex} className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-200">
                        {link.label || link.href}
                      </span>
                    ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              {(footerContent.socialLinks || []).filter((link) => link.label || link.href).map((link, index) => (
                <span key={index} className="rounded-full bg-white/10 px-3 py-1">{link.label || link.href}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
              {(footerContent.legalLinks || []).filter((link) => link.label || link.href).map((link, index) => (
                <span key={index}>{link.label || link.href}</span>
              ))}
            </div>
            <div className="text-[11px] text-slate-500">{footerContent.copyrightText || `${brand.companyName} | All rights reserved.`}</div>
          </div>
        ) : (
          <div className={`mt-4 text-xs ${footer ? "text-slate-300" : "text-slate-500"}`}>
            {brand.websiteUrl} | {brand.supportEmail} | {brand.supportPhone}
          </div>
        )}
      </div>
    </div>
  );
}

function DevicePreview({ label, compact = false, narrow = false }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-700">{label}</div>
      <div className={`mt-3 rounded-2xl border border-slate-200 bg-white ${narrow ? "h-40" : compact ? "h-32" : "h-24"}`} />
    </div>
  );
}

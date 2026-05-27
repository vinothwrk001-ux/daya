import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  Brush,
  Eye,
  Globe,
  GripVertical,
  Image,
  LayoutGrid,
  Link as LinkIcon,
  Megaphone,
  Monitor,
  Package,
  Palette,
  Save,
  Search,
  Settings2,
  Smartphone,
  Star,
  Tablet,
  Upload,
} from "lucide-react";
import {
  getInfluencerStorefrontBuilder,
  previewInfluencerStorefrontBuilder,
  saveInfluencerStorefrontBuilder,
} from "../../services/influencerCommerceService";
import { formatCurrency } from "../../utils/formatCurrency";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";

const TABS = [
  ["info", "Store Information", Settings2],
  ["banner", "Store Banner", Image],
  ["branding", "Profile Branding", Palette],
  ["homepage", "Homepage Builder", LayoutGrid],
  ["collections", "Featured Collections", Boxes],
  ["products", "Featured Products", Package],
  ["hero", "Hero Banner", Megaphone],
  ["categories", "Categories", Star],
  ["social", "Social Links", LinkIcon],
  ["seo", "SEO Settings", Search],
  ["preview", "Preview Storefront", Eye],
];

const SECTION_TYPES = [
  "hero",
  "featured_products",
  "featured_collections",
  "categories",
  "top_selling_products",
  "trending_products",
  "recommended_products",
  "campaign_banner",
  "videos",
  "social_proof",
  "testimonials",
  "cta_banner",
  "custom_html",
];

const THEME_PRESETS = ["modern", "minimal", "luxury", "tech", "fashion", "lifestyle", "beauty", "gaming"];

function field(value = "") {
  return value == null ? "" : String(value);
}

function Card({ title, icon: Icon = Settings2, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      >
        {children}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange, rows = 3 }) {
  return (
    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function normalizeBuilderData(data) {
  const storefront = data?.storefront || {};
  return {
    name: field(storefront.name),
    slug: field(storefront.slug),
    description: field(storefront.description),
    tagline: field(storefront.tagline),
    banner: field(storefront.banner),
    mobileBanner: field(storefront.mobileBanner),
    profileImage: field(storefront.profileImage),
    logo: field(storefront.logo),
    theme: field(storefront.theme || "creator-default"),
    status: field(storefront.status || "draft"),
    contact: {
      email: field(storefront.contact?.email),
      phone: field(storefront.contact?.phone),
      country: field(storefront.contact?.country),
      language: field(storefront.contact?.language || "en"),
      currency: field(storefront.contact?.currency || "INR"),
    },
    branding: {
      preset: field(storefront.branding?.preset || "modern"),
      primaryColor: field(storefront.branding?.primaryColor || "#4f46e5"),
      secondaryColor: field(storefront.branding?.secondaryColor || "#06b6d4"),
      accentColor: field(storefront.branding?.accentColor || "#22c55e"),
      backgroundColor: field(storefront.branding?.backgroundColor || "#f8fafc"),
      buttonStyle: field(storefront.branding?.buttonStyle || "rounded"),
      typography: field(storefront.branding?.typography || "system"),
      cardStyle: field(storefront.branding?.cardStyle || "bordered"),
      borderRadius: Number(storefront.branding?.borderRadius || 16),
    },
    hero: {
      type: field(storefront.hero?.type || "single"),
      backgroundImage: field(storefront.hero?.backgroundImage || storefront.banner),
      headline: field(storefront.hero?.headline || storefront.name),
      subheadline: field(storefront.hero?.subheadline || storefront.tagline),
      ctaText: field(storefront.hero?.ctaText || "Shop now"),
      ctaUrl: field(storefront.hero?.ctaUrl || "#collections"),
      textAlignment: field(storefront.hero?.textAlignment || "left"),
      overlayColor: field(storefront.hero?.overlayColor || "rgba(15,23,42,0.45)"),
      height: field(storefront.hero?.height || "standard"),
    },
    homepage: {
      sections: storefront.homepage?.sections?.length ? storefront.homepage.sections : [],
    },
    featuredCollectionIds: (storefront.featuredCollectionIds || []).map((item) => String(item._id || item)),
    featuredProductIds: (storefront.featuredProductIds || []).map((item) => String(item._id || item)),
    featuredCategoryKeys: storefront.featuredCategoryKeys || storefront.categories || [],
    categories: storefront.categories || [],
    socialLinks: storefront.socialLinks || {},
    seo: {
      metaTitle: field(storefront.seo?.metaTitle || storefront.name),
      metaDescription: field(storefront.seo?.metaDescription || storefront.description),
      keywords: (storefront.seo?.keywords || []).join(", "),
      canonicalUrl: field(storefront.seo?.canonicalUrl),
      openGraphTitle: field(storefront.seo?.openGraphTitle || storefront.name),
      openGraphDescription: field(storefront.seo?.openGraphDescription || storefront.description),
      openGraphImage: field(storefront.seo?.openGraphImage || storefront.banner),
    },
  };
}

function buildPayload(form) {
  return {
    ...form,
    seo: {
      ...form.seo,
      keywords: form.seo.keywords.split(",").map((item) => item.trim()).filter(Boolean),
    },
  };
}

function StorePreview({ form, collections = [], products = [], mode }) {
  const widthClass = mode === "mobile" ? "max-w-[390px]" : mode === "tablet" ? "max-w-[760px]" : "max-w-full";
  const heroImage = form.hero.backgroundImage || form.banner;
  const featuredCollections = collections.filter((item) => form.featuredCollectionIds.includes(String(item._id)));
  const featuredProducts = products.filter((item) => form.featuredProductIds.includes(String(item._id)));
  return (
    <div className={`mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${widthClass}`}>
      <div className="relative min-h-64 bg-slate-900" style={{ backgroundColor: form.branding.backgroundColor }}>
        {heroImage ? <img src={resolveApiAssetUrl(heroImage)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
        <div className="absolute inset-0" style={{ background: form.hero.overlayColor }} />
        <div className={`relative z-10 flex min-h-64 flex-col justify-center p-6 text-white ${form.hero.textAlignment === "center" ? "items-center text-center" : form.hero.textAlignment === "right" ? "items-end text-right" : "items-start text-left"}`}>
          <div className="flex items-center gap-3">
            {form.logo || form.profileImage ? <img src={resolveApiAssetUrl(form.logo || form.profileImage)} alt="" className="h-12 w-12 rounded-2xl object-cover" /> : null}
            <p className="font-semibold">{form.name}</p>
          </div>
          <h1 className="mt-5 max-w-2xl text-3xl font-black">{form.hero.headline || form.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-white/85">{form.hero.subheadline || form.tagline}</p>
          {form.hero.ctaText ? <span className="mt-5 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: form.branding.primaryColor }}>{form.hero.ctaText}</span> : null}
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm text-slate-600 dark:text-slate-300">{form.description}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {featuredCollections.slice(0, 3).map((collection) => (
            <div key={collection._id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase text-indigo-600">Collection</p>
              <p className="mt-1 font-semibold text-slate-950 dark:text-white">{collection.title}</p>
              <p className="text-xs text-slate-500">{collection.productsCount || collection.productIds?.length || 0} products</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {featuredProducts.slice(0, 4).map((product) => (
            <div key={product._id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="h-24 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {product.image || product.thumbnail ? <img src={resolveApiAssetUrl(product.image || product.thumbnail)} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-950 dark:text-white">{product.name}</p>
              <p className="text-xs text-slate-500">{formatCurrency(product.price || product.discountPrice || 0)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function InfluencerStorefrontBuilderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "info");
  const [form, setForm] = useState(null);
  const [source, setSource] = useState({ collections: [], products: [], previewUrl: "" });
  const [previewData, setPreviewData] = useState(null);
  const [mode, setMode] = useState("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await getInfluencerStorefrontBuilder();
    const data = response?.data || {};
    setForm(normalizeBuilderData(data));
    setSource({ collections: data.collections || [], products: data.products || [], previewUrl: data.previewUrl || "" });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setTab(searchParams.get("tab") || "info");
  }, [searchParams]);

  const update = useCallback((path, value) => {
    setForm((current) => {
      const next = structuredClone(current);
      const parts = path.split(".");
      let cursor = next;
      parts.slice(0, -1).forEach((part) => { cursor[part] = cursor[part] || {}; cursor = cursor[part]; });
      cursor[parts.at(-1)] = value;
      return next;
    });
  }, []);

  async function save(status = form.status) {
    setSaving(true);
    setNotice("");
    try {
      const payload = buildPayload({ ...form, status });
      const response = await saveInfluencerStorefrontBuilder(payload);
      setForm(normalizeBuilderData(response?.data || {}));
      setSource({ collections: response?.data?.collections || source.collections, products: response?.data?.products || source.products, previewUrl: response?.data?.previewUrl || source.previewUrl });
      setNotice(status === "active" ? "Storefront published." : "Storefront saved.");
    } catch (error) {
      setNotice(error?.response?.data?.message || "Storefront could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    const response = await previewInfluencerStorefrontBuilder(buildPayload(form));
    setPreviewData(response?.data || null);
    setTab("preview");
    setSearchParams({ tab: "preview" });
  }

  function toggleId(path, id) {
    const values = form[path] || [];
    update(path, values.includes(id) ? values.filter((item) => item !== id) : [...values, id]);
  }

  function moveSection(index, direction) {
    const sections = [...(form.homepage.sections || [])];
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    update("homepage.sections", sections.map((section, idx) => ({ ...section, priority: idx + 1 })));
  }

  const seoScore = useMemo(() => {
    if (!form) return 0;
    const checks = [form.seo.metaTitle, form.seo.metaDescription, form.seo.openGraphImage || form.banner, form.seo.keywords, form.slug];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  if (loading || !form) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 dark:text-white">Loading storefront builder...</div>;
  }

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="space-y-5">
        <div className="flex flex-wrap justify-end gap-2">
          <button disabled={saving} onClick={() => save("draft")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 dark:text-white"><Save className="h-4 w-4" />Save Draft</button>
          <button disabled={saving} onClick={() => save("active")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"><Upload className="h-4 w-4" />Publish</button>
        </div>

        {notice ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{notice}</div> : null}

        {tab === "info" ? (
          <Card title="Store Information" icon={Settings2}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Store Name" value={form.name} onChange={(value) => update("name", value)} />
              <Input label="Store Slug" value={form.slug} onChange={(value) => update("slug", value)} />
              <Input label="Tagline" value={form.tagline} onChange={(value) => update("tagline", value)} />
              <Select label="Store Status" value={form.status} onChange={(value) => update("status", value)}><option value="draft">Draft</option><option value="active">Published</option><option value="hidden">Hidden</option><option value="archived">Archived</option></Select>
              <Textarea label="Store Description" value={form.description} onChange={(value) => update("description", value)} />
              <div className="grid gap-4">
                <Input label="Store Email" value={form.contact.email} onChange={(value) => update("contact.email", value)} />
                <Input label="Contact Number" value={form.contact.phone} onChange={(value) => update("contact.phone", value)} />
              </div>
              <Input label="Country" value={form.contact.country} onChange={(value) => update("contact.country", value)} />
              <Input label="Currency" value={form.contact.currency} onChange={(value) => update("contact.currency", value)} />
            </div>
          </Card>
        ) : null}

        {tab === "banner" ? (
          <Card title="Store Banner" icon={Image}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Main Banner Image URL" value={form.banner} onChange={(value) => update("banner", value)} />
              <Input label="Mobile Banner URL" value={form.mobileBanner} onChange={(value) => update("mobileBanner", value)} />
              <Input label="Promotional Banner Title" value={form.hero.headline} onChange={(value) => update("hero.headline", value)} />
              <Input label="CTA URL" value={form.hero.ctaUrl} onChange={(value) => update("hero.ctaUrl", value)} />
            </div>
          </Card>
        ) : null}

        {tab === "branding" ? (
          <Card title="Profile Branding" icon={Palette}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Profile Image URL" value={form.profileImage} onChange={(value) => update("profileImage", value)} />
              <Input label="Logo URL" value={form.logo} onChange={(value) => update("logo", value)} />
              <Select label="Theme Preset" value={form.branding.preset} onChange={(value) => update("branding.preset", value)}>{THEME_PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
              <Input label="Brand Color" type="color" value={form.branding.primaryColor} onChange={(value) => update("branding.primaryColor", value)} />
              <Input label="Accent Color" type="color" value={form.branding.accentColor} onChange={(value) => update("branding.accentColor", value)} />
              <Input label="Background Color" type="color" value={form.branding.backgroundColor} onChange={(value) => update("branding.backgroundColor", value)} />
              <Select label="Button Style" value={form.branding.buttonStyle} onChange={(value) => update("branding.buttonStyle", value)}><option value="rounded">Rounded</option><option value="pill">Pill</option><option value="square">Square</option></Select>
              <Input label="Border Radius" type="number" value={form.branding.borderRadius} onChange={(value) => update("branding.borderRadius", Number(value || 0))} />
            </div>
          </Card>
        ) : null}

        {tab === "homepage" ? (
          <Card title="Homepage Builder" icon={LayoutGrid} action={<button onClick={() => update("homepage.sections", [...form.homepage.sections, { id: `section-${Date.now()}`, type: "custom_html", title: "Custom Section", visible: true, layout: "grid", priority: form.homepage.sections.length + 1, config: {} }])} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Add Section</button>}>
            <div className="space-y-3">
              {form.homepage.sections.map((section, index) => (
                <div key={section.id || index} className="grid gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[24px_1fr_180px_120px]">
                  <GripVertical className="mt-3 h-4 w-4 text-slate-400" />
                  <Input label="Section Title" value={section.title || ""} onChange={(value) => {
                    const sections = [...form.homepage.sections];
                    sections[index] = { ...section, title: value };
                    update("homepage.sections", sections);
                  }} />
                  <Select label="Type" value={section.type} onChange={(value) => {
                    const sections = [...form.homepage.sections];
                    sections[index] = { ...section, type: value };
                    update("homepage.sections", sections);
                  }}>{SECTION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
                  <div className="flex items-end gap-2">
                    <button onClick={() => moveSection(index, -1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:text-white">Up</button>
                    <button onClick={() => moveSection(index, 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:text-white">Down</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {tab === "collections" ? (
          <Card title="Featured Collections" icon={Boxes}>
            <div className="grid gap-3 md:grid-cols-2">
              {source.collections.map((collection) => {
                const id = String(collection._id);
                const active = form.featuredCollectionIds.includes(id);
                return <button key={id} onClick={() => toggleId("featuredCollectionIds", id)} className={`rounded-2xl border p-3 text-left ${active ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-slate-200 dark:border-slate-800"}`}><p className="font-semibold text-slate-950 dark:text-white">{collection.title}</p><p className="text-xs text-slate-500">{collection.productsCount || 0} products</p></button>;
              })}
            </div>
          </Card>
        ) : null}

        {tab === "products" ? (
          <Card title="Featured Products" icon={Package}>
            <div className="grid gap-3 md:grid-cols-2">
              {source.products.map((product) => {
                const id = String(product._id);
                const active = form.featuredProductIds.includes(id);
                return <button key={id} onClick={() => toggleId("featuredProductIds", id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${active ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-slate-200 dark:border-slate-800"}`}><div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">{product.image ? <img src={resolveApiAssetUrl(product.image)} alt="" className="h-full w-full object-cover" /> : null}</div><div><p className="font-semibold text-slate-950 dark:text-white">{product.name}</p><p className="text-xs text-slate-500">{formatCurrency(product.price || 0)}</p></div></button>;
              })}
            </div>
          </Card>
        ) : null}

        {tab === "hero" ? (
          <Card title="Hero Banner" icon={Megaphone}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Background Image" value={form.hero.backgroundImage} onChange={(value) => update("hero.backgroundImage", value)} />
              <Select label="Hero Type" value={form.hero.type} onChange={(value) => update("hero.type", value)}><option value="single">Single Banner</option><option value="carousel">Carousel Banner</option><option value="video">Video Banner</option></Select>
              <Input label="Headline" value={form.hero.headline} onChange={(value) => update("hero.headline", value)} />
              <Input label="Subheadline" value={form.hero.subheadline} onChange={(value) => update("hero.subheadline", value)} />
              <Input label="CTA Text" value={form.hero.ctaText} onChange={(value) => update("hero.ctaText", value)} />
              <Input label="CTA URL" value={form.hero.ctaUrl} onChange={(value) => update("hero.ctaUrl", value)} />
              <Select label="Text Alignment" value={form.hero.textAlignment} onChange={(value) => update("hero.textAlignment", value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></Select>
              <Select label="Banner Height" value={form.hero.height} onChange={(value) => update("hero.height", value)}><option value="compact">Compact</option><option value="standard">Standard</option><option value="tall">Tall</option></Select>
            </div>
          </Card>
        ) : null}

        {tab === "categories" ? (
          <Card title="Categories" icon={Star}>
            <Input label="Featured Categories" value={form.categories.join(", ")} onChange={(value) => update("categories", value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="fashion, beauty, tech" />
          </Card>
        ) : null}

        {tab === "social" ? (
          <Card title="Social Links" icon={LinkIcon}>
            <div className="grid gap-4 md:grid-cols-2">
              {["instagram", "tiktok", "youtube", "facebook", "x", "pinterest", "linkedin", "snapchat", "telegram"].map((platform) => (
                <Input key={platform} label={platform} value={form.socialLinks?.[platform]?.url || form.socialLinks?.[platform] || ""} onChange={(value) => update(`socialLinks.${platform}`, { url: value, visible: true })} />
              ))}
            </div>
          </Card>
        ) : null}

        {tab === "seo" ? (
          <Card title="SEO Settings" icon={Search}>
            <div className="mb-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">SEO Health Score: {seoScore}%</p>
              <p className="text-xs text-slate-500">Meta completeness, social image, keywords, and slug readiness.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="SEO Title" value={form.seo.metaTitle} onChange={(value) => update("seo.metaTitle", value)} />
              <Input label="Canonical URL" value={form.seo.canonicalUrl} onChange={(value) => update("seo.canonicalUrl", value)} />
              <Textarea label="SEO Description" value={form.seo.metaDescription} onChange={(value) => update("seo.metaDescription", value)} />
              <Textarea label="Keywords" value={form.seo.keywords} onChange={(value) => update("seo.keywords", value)} />
              <Input label="Open Graph Title" value={form.seo.openGraphTitle} onChange={(value) => update("seo.openGraphTitle", value)} />
              <Input label="Open Graph Image" value={form.seo.openGraphImage} onChange={(value) => update("seo.openGraphImage", value)} />
            </div>
          </Card>
        ) : null}

        {tab === "preview" ? (
          <Card title="Preview Storefront" icon={Eye} action={<button onClick={preview} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Refresh Preview</button>}>
            <StorePreview form={previewData ? normalizeBuilderData(previewData) : form} collections={source.collections} products={source.products} mode={mode} />
          </Card>
        ) : null}
      </div>

      <aside className="space-y-5">
        <Card title="Live Preview" icon={Monitor} action={<div className="flex gap-1"><button onClick={() => setMode("desktop")} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Monitor className="h-4 w-4" /></button><button onClick={() => setMode("tablet")} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Tablet className="h-4 w-4" /></button><button onClick={() => setMode("mobile")} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Smartphone className="h-4 w-4" /></button></div>}>
          <StorePreview form={form} collections={source.collections} products={source.products} mode={mode} />
          <button onClick={preview} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:text-white">Generate Preview</button>
        </Card>
        <Card title="Store Performance" icon={BarChart3}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-slate-500">SEO</p><b className="text-slate-950 dark:text-white">{seoScore}%</b></div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-slate-500">Sections</p><b className="text-slate-950 dark:text-white">{form.homepage.sections.length}</b></div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-slate-500">Products</p><b className="text-slate-950 dark:text-white">{form.featuredProductIds.length}</b></div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-slate-500">Collections</p><b className="text-slate-950 dark:text-white">{form.featuredCollectionIds.length}</b></div>
          </div>
          {source.previewUrl ? <a href={source.previewUrl} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300"><Globe className="h-4 w-4" />{source.previewUrl}</a> : null}
        </Card>
      </aside>
    </div>
  );
}

function StoreIcon(props) {
  return <Brush {...props} />;
}

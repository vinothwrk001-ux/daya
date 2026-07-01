import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCategory as createAdminCategory,
  listCategories,
  toggleCategory,
  updateCategory,
  uploadCategoryMedia,
  getCategoryCarouselConfig,
  updateCategoryCarouselConfig,
  getCategoryHeroBannerConfig,
  updateCategoryHeroBannerConfig,
  getCategoryAnalyticsSummary,
} from "../services/adminApi";
import * as categoryService from "../services/categoryService";

const initialForm = {
  name: "",
  code: "",
  slug: "",
  description: "",
  icon: "",
  logo: "",
  color: "",
  order: 0,
  status: "active",
  visibility: "public",
  showOnHomepage: true,
  showInHeroBanner: false,
  redirectToServices: false,
  heroHeading: "",
  heroSubheading: "",
  isActive: true,
  seoTitle: "",
  seoDescription: "",
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [carouselConfig, setCarouselConfig] = useState({
    enabled: true,
    eyebrow: "CATEGORYS",
    title: "Explore Categories",
    subtitle: "Shop Products By Category",
  });
  const [heroConfig, setHeroConfig] = useState({
    enabled: true,
    eyebrow: "CATEGORIES",
    panelDescription:
      "Explore a wide range of stylish apparel, designed for comfort, quality, and everyday wear.",
    ctaLabel: "Shop now",
    autoRotate: false,
    rotationInterval: 5000,
    defaultCategoryId: "",
  });
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    getCategoryCarouselConfig().then((res) => setCarouselConfig(res?.data ?? res)).catch(() => {});
    getCategoryHeroBannerConfig().then(setHeroConfig).catch(() => {});
    getCategoryAnalyticsSummary().then(setAnalytics).catch(() => {});
  }, []);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [categories]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listCategories();
      setCategories(response?.data || []);
    } catch {
      try {
        const fallback = await categoryService.getCategories();
        setCategories(fallback?.data || []);
        setError("");
      } catch (fallbackError) {
        setError(normalizeError(fallbackError));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function resetForm() {
    setEditingId("");
    setForm(initialForm);
    setThumbnailFile(null);
    setBannerFile(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let categoryId = editingId;
      if (editingId) {
        await updateCategory(editingId, form);
      } else {
        const created = await createAdminCategory(form);
        categoryId = created?.data?._id || created?.data?.id;
      }

      if (categoryId && (thumbnailFile || bannerFile)) {
        const media = new FormData();
        if (thumbnailFile) media.append("thumbnail", thumbnailFile);
        if (bannerFile) media.append("banner", bannerFile);
        await uploadCategoryMedia(categoryId, media);
      }

      resetForm();
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveCarouselConfig() {
    setSaving(true);
    try {
      await updateCategoryCarouselConfig(carouselConfig);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveHeroConfig() {
    setSaving(true);
    try {
      await updateCategoryHeroBannerConfig(heroConfig);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(category) {
    try {
      await toggleCategory(category._id, !category.isActive);
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  function startEditing(category) {
    setEditingId(category._id);
    setForm({
      name: category.name || "",
      code: category.code || "",
      slug: category.slug || "",
      description: category.description || "",
      icon: category.icon || "",
      logo: category.logo || category.thumbnailUrl || "",
      color: category.color || "",
      order: category.order || 0,
      status: category.status || "active",
      visibility: category.visibility || "public",
      showOnHomepage: category.showOnHomepage !== false,
      showInHeroBanner: category.showInHeroBanner === true,
      redirectToServices: category.redirectToServices === true,
      heroHeading: category.heroHeading || "",
      heroSubheading: category.heroSubheading || "",
      isActive: category.isActive !== false,
      seoTitle: category.seoTitle || "",
      seoDescription: category.seoDescription || "",
    });
    setThumbnailFile(null);
    setBannerFile(null);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr] bg-white dark:bg-slate-950">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Category management</h2>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Homepage and product forms use categories from the database. Disabled categories stay hidden automatically.
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : sortedCategories.length ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {sortedCategories.map((category) => (
                <div key={category._id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.2fr_.8fr_.7fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-lg dark:bg-slate-800 overflow-hidden">
                        {category.logo ? (
                          <img src={category.logo} alt={category.name} className="h-full w-full object-cover" />
                        ) : (
                          category.icon || category.name?.charAt(0) || "C"
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900 dark:text-white">{category.name}</div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {category.code || "-"} • {category.slug}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">{category.color || "Auto palette"}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Order {category.order ?? 0}</div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {category.redirectToServices ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Services
                      </span>
                    ) : null}
                    {category.showInHeroBanner ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-950 dark:text-red-300">
                        Hero
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEditing(category)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(category)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium ${
                        category.isActive
                          ? "border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {category.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No categories created yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{editingId ? "Edit category" : "Create category"}</h2>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Code</span>
            <input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="E"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Slug</span>
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="Optional"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Visibility</span>
              <select
                value={form.visibility}
                onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Icon override</span>
              <input
                value={form.icon}
                onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Optional"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Order</span>
              <input
                type="number"
                min="0"
                value={form.order}
                onChange={(event) => setForm((current) => ({ ...current, order: Number(event.target.value || 0) }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Thumbnail (Cloudinary)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Banner (Optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setBannerFile(event.target.files?.[0] || null)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gradient classes</span>
            <input
              value={form.color}
              onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="Optional, e.g. from-blue-500 to-cyan-500"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <input
              type="checkbox"
              checked={form.showOnHomepage}
              onChange={(event) => setForm((current) => ({ ...current, showOnHomepage: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Show on homepage carousel</span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <input
              type="checkbox"
              checked={form.redirectToServices}
              onChange={(event) => setForm((current) => ({ ...current, redirectToServices: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Redirect to Services page when customers click this category
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
            <input
              type="checkbox"
              checked={form.showInHeroBanner}
              onChange={(event) => setForm((current) => ({ ...current, showInHeroBanner: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Display in homepage hero banner (click to preview in banner)
            </span>
          </label>

          {form.showInHeroBanner ? (
            <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hero banner copy (optional)</p>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hero heading</span>
                <input
                  value={form.heroHeading}
                  onChange={(event) => setForm((current) => ({ ...current, heroHeading: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="e.g. STOP THINKING JUST BUY IT"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hero subheading</span>
                <input
                  value={form.heroSubheading}
                  onChange={(event) => setForm((current) => ({ ...current, heroSubheading: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="e.g. BECAUSE YOU ARE AWESOME"
                />
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hero image uses banner upload first, then thumbnail, then a featured product from this category.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SEO title</span>
              <input
                value={form.seoTitle}
                onChange={(event) => setForm((current) => ({ ...current, seoTitle: event.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Optional"
              />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SEO description</span>
              <textarea
                rows={2}
                value={form.seoDescription}
                onChange={(event) => setForm((current) => ({ ...current, seoDescription: event.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Optional"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Visible on storefront</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {saving ? "Saving..." : editingId ? "Update category" : "Create category"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Homepage carousel copy</h3>
          <div className="mt-4 grid gap-3">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <input
                type="checkbox"
                checked={carouselConfig.enabled !== false}
                onChange={(event) => setCarouselConfig((current) => ({ ...current, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Enable homepage category carousel</span>
            </label>
            <input
              value={carouselConfig.eyebrow}
              onChange={(event) => setCarouselConfig((current) => ({ ...current, eyebrow: event.target.value }))}
              placeholder="Eyebrow label"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <input
              value={carouselConfig.title}
              onChange={(event) => setCarouselConfig((current) => ({ ...current, title: event.target.value }))}
              placeholder="Section title"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <input
              value={carouselConfig.subtitle}
              onChange={(event) => setCarouselConfig((current) => ({ ...current, subtitle: event.target.value }))}
              placeholder="Section subtitle"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="button"
              onClick={saveCarouselConfig}
              disabled={saving}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              Save carousel settings
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Homepage hero banner</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Categories with &quot;Display in hero banner&quot; appear on the right. Clicking them updates the left hero panel.
          </p>
          <div className="mt-4 grid gap-3">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <input
                type="checkbox"
                checked={heroConfig.enabled !== false}
                onChange={(event) => setHeroConfig((current) => ({ ...current, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Enable homepage hero banner</span>
            </label>
            <input
              value={heroConfig.eyebrow || ""}
              onChange={(event) => setHeroConfig((current) => ({ ...current, eyebrow: event.target.value }))}
              placeholder="Eyebrow label"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <textarea
              rows={3}
              value={heroConfig.panelDescription || ""}
              onChange={(event) => setHeroConfig((current) => ({ ...current, panelDescription: event.target.value }))}
              placeholder="Right panel description"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <input
              value={heroConfig.ctaLabel || ""}
              onChange={(event) => setHeroConfig((current) => ({ ...current, ctaLabel: event.target.value }))}
              placeholder="CTA button label"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <input
                type="checkbox"
                checked={heroConfig.autoRotate === true}
                onChange={(event) => setHeroConfig((current) => ({ ...current, autoRotate: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Auto-rotate hero categories</span>
            </label>
            <input
              type="number"
              min={2}
              step={1}
              value={heroConfig.rotationInterval || 5000}
              onChange={(event) =>
                setHeroConfig((current) => ({ ...current, rotationInterval: Number(event.target.value) || 5000 }))
              }
              placeholder="Rotation interval (ms)"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <select
              value={heroConfig.defaultCategoryId || ""}
              onChange={(event) => setHeroConfig((current) => ({ ...current, defaultCategoryId: event.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">Default category (first available)</option>
              {sortedCategories
                .filter((category) => category.showInHeroBanner)
                .map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={saveHeroConfig}
              disabled={saving}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              Save hero banner settings
            </button>
          </div>
        </div>

        {analytics ? (
          <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">Category analytics</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                { title: "Most viewed", rows: analytics.topViewed || [], valueLabel: "views" },
                { title: "Most clicked", rows: analytics.topClicked || [], valueLabel: "clicks" },
                { title: "Highest revenue", rows: analytics.topRevenue || [], valueLabel: "revenue" },
              ].map((section) => (
                <div key={section.title} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{section.title}</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {section.rows.length ? (
                      section.rows.map((row) => (
                        <li key={row.category?._id || row.category?.slug} className="flex items-center justify-between gap-2">
                          <span className="truncate">{row.category?.name || "Unknown"}</span>
                          <span className="font-semibold text-red-600">
                            {section.valueLabel === "revenue" ? `$${Number(row.value || 0).toFixed(2)}` : row.value}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-400">No data yet</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

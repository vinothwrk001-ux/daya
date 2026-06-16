import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminHomepageBanner,
  deleteAdminHomepageBanner,
  getAdminHomepageBannerAnalytics,
  listAdminHomepageBanners,
  updateAdminHomepageBanner,
  uploadAdminHomepageBannerMedia,
} from "../services/homepageBannerService";
import { listCategories } from "../services/adminApi";
import { HomepageBannerSlider } from "../components/homepage/HomepageBannerSlider";
const emptyForm = {
  name: "",
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  ctaText: "Shop now",
  ctaUrl: "",
  status: "active",
  displayOrder: 0,
  showOnHomepage: true,
  desktopImage: "",
  mobileImage: "",
  categories: [],
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export function AdminHomepageBannersPage() {
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [desktopFile, setDesktopFile] = useState(null);
  const [mobileFile, setMobileFile] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bannerRows, categoryRows, analyticsData] = await Promise.all([
        listAdminHomepageBanners(),
        listCategories(),
        getAdminHomepageBannerAnalytics().catch(() => null),
      ]);
      setBanners(Array.isArray(bannerRows) ? bannerRows : []);
      setCategories(categoryRows?.data || []);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedCategoryIds = useMemo(
    () => new Set((form.categories || []).map((item) => String(item.categoryId))),
    [form.categories]
  );

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
    setDesktopFile(null);
    setMobileFile(null);
  }

  function startEdit(banner) {
    setEditingId(banner._id);
    setForm({
      name: banner.name || "",
      slug: banner.slug || "",
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      description: banner.description || "",
      ctaText: banner.ctaText || "Shop now",
      ctaUrl: banner.ctaUrl || "",
      status: banner.status || "active",
      displayOrder: banner.displayOrder || 0,
      showOnHomepage: banner.showOnHomepage !== false,
      desktopImage: banner.desktopImage || "",
      mobileImage: banner.mobileImage || "",
      categories: (banner.categories || []).map((item, index) => ({
        categoryId: item.categoryId?._id || item.categoryId,
        displayOrder: item.displayOrder ?? index,
        customTitle: item.customTitle || "",
        customSubtitle: item.customSubtitle || "",
        cardImage: item.cardImage || "",
        ctaUrl: item.ctaUrl || "",
        showProductCount: item.showProductCount !== false,
        status: item.status || "active",
      })),
    });
    setDesktopFile(null);
    setMobileFile(null);
  }

  function toggleCategory(category) {
    const id = String(category._id);
    setForm((current) => {
      const exists = current.categories.some((item) => String(item.categoryId) === id);
      if (exists) {
        return {
          ...current,
          categories: current.categories.filter((item) => String(item.categoryId) !== id),
        };
      }
      if (current.categories.length >= 6) return current;
      return {
        ...current,
        categories: [
          ...current.categories,
          {
            categoryId: category._id,
            displayOrder: current.categories.length,
            customTitle: "",
            customSubtitle: "",
            cardImage: "",
            ctaUrl: `/category/${category.slug}`,
            showProductCount: true,
            status: "active",
          },
        ],
      };
    });
  }

  function moveCategory(categoryId, direction) {
    setForm((current) => {
      const items = [...current.categories];
      const currentIndex = items.findIndex((item) => String(item.categoryId) === String(categoryId));
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return current;
      [items[currentIndex], items[targetIndex]] = [items[targetIndex], items[currentIndex]];
      return {
        ...current,
        categories: items.map((item, index) => ({ ...item, displayOrder: index })),
      };
    });
  }

  const previewBanners = useMemo(() => {
    const hasContent = form.name || form.title || form.categories.length;
    if (!hasContent) return [];

    const previewCategories = (form.categories || []).map((item, index) => {
      const category = categories.find((row) => String(row._id) === String(item.categoryId));
      return {
        id: `preview-card-${index}`,
        categoryId: item.categoryId,
        title: item.customTitle || category?.name || "Category",
        slug: category?.slug || "",
        cardImage: item.cardImage || category?.thumbnailUrl || category?.bannerUrl || "",
        ctaUrl: item.ctaUrl || (category?.slug ? `/category/${category.slug}` : "#"),
        productCount: category?.productCount ?? null,
        showProductCount: item.showProductCount !== false,
      };
    });

    return [
      {
        id: editingId || "preview-banner",
        name: form.name || "Banner preview",
        title: form.title || form.name,
        subtitle: form.subtitle,
        description: form.description,
        ctaText: form.ctaText,
        ctaUrl: form.ctaUrl,
        desktopImage: form.desktopImage,
        mobileImage: form.mobileImage,
        displayOrder: form.displayOrder,
        categories: previewCategories,
      },
    ];
  }, [categories, editingId, form]);

  const allPreviewBanners = useMemo(() => {
    if (previewBanners.length && (form.name || form.title)) {
      const otherBanners = banners
        .filter((banner) => banner._id !== editingId)
        .map((banner) => ({
          id: banner._id,
          name: banner.name,
          title: banner.title,
          subtitle: banner.subtitle,
          description: banner.description,
          ctaText: banner.ctaText,
          ctaUrl: banner.ctaUrl,
          desktopImage: banner.desktopImage,
          mobileImage: banner.mobileImage,
          categories: (banner.categories || []).map((item, index) => {
            const category = categories.find((row) => String(row._id) === String(item.categoryId?._id || item.categoryId));
            return {
              id: item._id || `saved-${index}`,
              categoryId: item.categoryId?._id || item.categoryId,
              title: item.customTitle || category?.name || "Category",
              slug: category?.slug || "",
              cardImage: item.cardImage || category?.thumbnailUrl || "",
              ctaUrl: item.ctaUrl || (category?.slug ? `/category/${category.slug}` : "#"),
              productCount: category?.productCount ?? null,
              showProductCount: item.showProductCount !== false,
            };
          }),
        }));

      return [...previewBanners, ...otherBanners].sort(
        (a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0)
      );
    }

    return banners.map((banner) => ({
      id: banner._id,
      name: banner.name,
      title: banner.title,
      subtitle: banner.subtitle,
      description: banner.description,
      ctaText: banner.ctaText,
      ctaUrl: banner.ctaUrl,
      desktopImage: banner.desktopImage,
      mobileImage: banner.mobileImage,
      displayOrder: banner.displayOrder,
      categories: (banner.categories || []).map((item, index) => {
        const category = categories.find((row) => String(row._id) === String(item.categoryId?._id || item.categoryId));
        return {
          id: item._id || `saved-${index}`,
          categoryId: item.categoryId?._id || item.categoryId,
          title: item.customTitle || category?.name || "Category",
          slug: category?.slug || "",
          cardImage: item.cardImage || category?.thumbnailUrl || "",
          ctaUrl: item.ctaUrl || (category?.slug ? `/category/${category.slug}` : "#"),
          productCount: category?.productCount ?? null,
          showProductCount: item.showProductCount !== false,
        };
      }),
    }));
  }, [banners, categories, editingId, form.name, form.title, previewBanners]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      let bannerId = editingId;
      if (editingId) {
        await updateAdminHomepageBanner(editingId, payload);
      } else {
        const created = await createAdminHomepageBanner(payload);
        bannerId = created?._id || created?.id;
      }

      if (bannerId && (desktopFile || mobileFile)) {
        const media = new FormData();
        if (desktopFile) media.append("desktop", desktopFile);
        if (mobileFile) media.append("mobile", mobileFile);
        await uploadAdminHomepageBannerMedia(bannerId, media);
      }

      resetForm();
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this banner?")) return;
    setSaving(true);
    try {
      await deleteAdminHomepageBanner(id);
      if (editingId === id) resetForm();
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Homepage Banner Management</h2>
            <p className="mt-1 text-sm text-slate-500">Each banner controls its own category cards on the homepage hero.</p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            New banner
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading banners...</div>
          ) : banners.length ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {banners.map((banner) => (
                <div key={banner._id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{banner.name}</div>
                    <div className="text-xs text-slate-500">
                      Order {banner.displayOrder ?? 0} • {(banner.categories || []).length} categories • {banner.status}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      banner.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {banner.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(banner)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(banner._id)}
                    className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">No homepage banners yet. Create your first banner.</div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          {editingId ? "Edit banner" : "Create banner"}
        </h2>

        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <input
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            placeholder="Banner name"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            required
          />
          <input
            value={form.title}
            onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
            placeholder="Banner title"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <input
            value={form.subtitle}
            onChange={(e) => setForm((c) => ({ ...c, subtitle: e.target.value }))}
            placeholder="Banner subtitle"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            placeholder="Banner description"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.ctaText}
              onChange={(e) => setForm((c) => ({ ...c, ctaText: e.target.value }))}
              placeholder="CTA text"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <input
              value={form.ctaUrl}
              onChange={(e) => setForm((c) => ({ ...c, ctaUrl: e.target.value }))}
              placeholder="CTA URL"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm((c) => ({ ...c, displayOrder: Number(e.target.value) || 0 }))}
              placeholder="Display order"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <select
              value={form.status}
              onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <input
              type="checkbox"
              checked={form.showOnHomepage !== false}
              onChange={(e) => setForm((c) => ({ ...c, showOnHomepage: e.target.checked }))}
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Show on homepage</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              Desktop banner image
              <input type="file" accept="image/*" onChange={(e) => setDesktopFile(e.target.files?.[0] || null)} />
            </label>
            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              Mobile banner image
              <input type="file" accept="image/*" onChange={(e) => setMobileFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Select category cards (max 6)</p>
            <p className="mt-1 text-xs text-slate-500">Only selected categories appear on the right side of this banner.</p>
            <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto">
              {categories.map((category) => {
                const selected = selectedCategoryIds.has(String(category._id));
                return (
                  <label
                    key={category._id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                      selected ? "border-red-500 bg-red-50" : "border-slate-200"
                    }`}
                  >
                    <input type="checkbox" checked={selected} onChange={() => toggleCategory(category)} />
                    <span className="text-sm text-slate-800 dark:text-slate-200">{category.name}</span>
                  </label>
                );
              })}
            </div>

            {form.categories.length ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected order</p>
                {form.categories.map((item, index) => {
                  const category = categories.find((row) => String(row._id) === String(item.categoryId));
                  return (
                    <div
                      key={item.categoryId}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
                    >
                      <span className="text-sm text-slate-800 dark:text-slate-200">
                        {index + 1}. {category?.name || "Category"}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveCategory(item.categoryId, -1)}
                          disabled={index === 0}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCategory(item.categoryId, 1)}
                          disabled={index === form.categories.length - 1}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Update banner" : "Create banner"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-950 dark:text-white">How it works</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Create a banner and upload desktop/mobile images.</li>
          <li>Select up to 6 categories for the right-side cards.</li>
          <li>Set display order and save.</li>
          <li>Homepage slider loads banners dynamically.</li>
          <li>When the banner changes, category cards change automatically.</li>
        </ol>

        {analytics ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-1">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">Total banners</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{analytics.totalBanners || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-xl font-bold text-emerald-600">{analytics.activeBanners || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">Inactive</p>
              <p className="text-xl font-bold text-slate-600">{analytics.inactiveBanners || 0}</p>
            </div>
          </div>
        ) : null}
      </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Homepage preview</h2>
        <p className="mt-1 text-sm text-slate-500">
          Live preview of how banners and category cards appear on the storefront hero.
        </p>
        <div className="mt-5">
          {allPreviewBanners.length ? (
            <HomepageBannerSlider banners={allPreviewBanners} previewMode initialIndex={0} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center text-sm text-slate-500">
              Create a banner or select categories to see the homepage preview.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

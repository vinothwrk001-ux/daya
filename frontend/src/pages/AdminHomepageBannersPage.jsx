import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAdminHomepageBanner,
  createAdminHomepageBannerContainer,
  deleteAdminHomepageBanner,
  deleteAdminHomepageBannerContainer,
  getAdminHomepageBannerAnalytics,
  listAdminHomepageBannerContainers,
  listAdminHomepageBanners,
  reorderAdminHomepageBanners,
  updateAdminHomepageBanner,
  updateAdminHomepageBannerContainer,
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
  featuredCollectionText: "",
  ctaText: "Shop now",
  ctaUrl: "",
  mediaType: "image",
  status: "active",
  displayOrder: 0,
  showOnHomepage: true,
  desktopImage: "",
  mobileImage: "",
  desktopMedia: "",
  mobileMedia: "",
  desktopPoster: "",
  mobilePoster: "",
  showOverlay: false,
  overlayOpacity: 0,
  hoverModeEnabled: false,
  categoryHeading: "",
  categoryDescription: "",
  categories: [],
};

const defaultSettings = {
  maxCategoryCards: 6,
  autoplay: true,
  autoplayIntervalMs: 5000,
  transitionEffect: "fade",
  pauseOnHover: true,
  enableLoop: true,
  showArrows: true,
  showDots: true,
};

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

function mapBannerForPreview(banner, categories = []) {
  return {
    id: banner._id || banner.id,
    name: banner.name,
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    featuredCollectionText: banner.featuredCollectionText,
    ctaText: banner.ctaText,
    ctaUrl: banner.ctaUrl,
    mediaType: banner.mediaType || "image",
    desktopMedia: banner.desktopMedia || banner.desktopImage,
    mobileMedia: banner.mobileMedia || banner.mobileImage,
    desktopImage: banner.desktopImage || banner.desktopMedia,
    mobileImage: banner.mobileImage || banner.mobileMedia,
    desktopPoster: banner.desktopPoster,
    mobilePoster: banner.mobilePoster,
    showOverlay: banner.showOverlay,
    overlayOpacity: banner.overlayOpacity,
    hoverModeEnabled: banner.hoverModeEnabled,
    categoryHeading: banner.categoryHeading,
    categoryDescription: banner.categoryDescription,
    displayOrder: banner.displayOrder,
    categories: (banner.categories || []).map((item, index) => {
      const category = categories.find((row) => String(row._id) === String(item.categoryId?._id || item.categoryId));
      return {
        id: item._id || `card-${index}`,
        categoryId: item.categoryId?._id || item.categoryId,
        title: item.customTitle || category?.name || "Category",
        subtitle: item.customSubtitle || "",
        slug: category?.slug || "",
        cardImage: item.cardImage || category?.thumbnailUrl || category?.bannerUrl || "",
        ctaUrl: item.ctaUrl || (category?.slug ? `/category/${category.slug}` : "#"),
        productCount: category?.productCount ?? null,
        showProductCount: item.showProductCount !== false,
      };
    }),
  };
}

export function AdminHomepageBannersPage() {
  const [containers, setContainers] = useState([]);
  const [activeContainerId, setActiveContainerId] = useState("");
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [containerMeta, setContainerMeta] = useState({ name: "", description: "", overlayOpacity: 0, textPosition: "left" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [desktopFile, setDesktopFile] = useState(null);
  const [mobileFile, setMobileFile] = useState(null);
  const [desktopPosterFile, setDesktopPosterFile] = useState(null);
  const [mobilePosterFile, setMobilePosterFile] = useState(null);

  const activeContainer = useMemo(
    () => containers.find((item) => String(item._id || item.id) === String(activeContainerId)) || null,
    [activeContainerId, containers]
  );

  const activeContainerIdRef = useRef(activeContainerId);
  activeContainerIdRef.current = activeContainerId;

  const refresh = useCallback(async (preferredContainerId) => {
    setLoading(true);
    setError("");
    try {
      const [containerRows, categoryRows, analyticsData] = await Promise.all([
        listAdminHomepageBannerContainers(),
        listCategories(),
        getAdminHomepageBannerAnalytics().catch(() => null),
      ]);
      const nextContainers = Array.isArray(containerRows) ? containerRows : [];
      setContainers(nextContainers);
      setCategories(categoryRows?.data || []);
      setAnalytics(analyticsData);

      const selectedId =
        preferredContainerId ||
        activeContainerIdRef.current ||
        nextContainers[0]?._id ||
        nextContainers[0]?.id ||
        "";
      if (selectedId) {
        setActiveContainerId(String(selectedId));
        const selected = nextContainers.find((item) => String(item._id || item.id) === String(selectedId));
        if (selected) {
          setSettings({ ...defaultSettings, ...(selected.settings || {}) });
          setContainerMeta({
            name: selected.name || "",
            description: selected.description || "",
            overlayOpacity: Number(selected.overlayOpacity || 0),
            textPosition: selected.textPosition || "left",
          });
        }
        const bannerRows = await listAdminHomepageBanners(String(selectedId));
        setBanners(Array.isArray(bannerRows) ? bannerRows : []);
      } else {
        setBanners([]);
      }
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
    setDesktopPosterFile(null);
    setMobilePosterFile(null);
  }

  function startEdit(banner) {
    setEditingId(banner._id);
    setForm({
      name: banner.name || "",
      slug: banner.slug || "",
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      description: banner.description || "",
      featuredCollectionText: banner.featuredCollectionText || "",
      ctaText: banner.ctaText || "Shop now",
      ctaUrl: banner.ctaUrl || "",
      mediaType: banner.mediaType || "image",
      status: banner.status || "active",
      displayOrder: banner.displayOrder || 0,
      showOnHomepage: banner.showOnHomepage !== false,
      desktopImage: banner.desktopImage || "",
      mobileImage: banner.mobileImage || "",
      desktopMedia: banner.desktopMedia || banner.desktopImage || "",
      mobileMedia: banner.mobileMedia || banner.mobileImage || "",
      desktopPoster: banner.desktopPoster || "",
      mobilePoster: banner.mobilePoster || "",
      showOverlay: Boolean(banner.showOverlay),
      overlayOpacity: Number(banner.overlayOpacity || 0),
      hoverModeEnabled: Boolean(banner.hoverModeEnabled),
      categoryHeading: banner.categoryHeading || "",
      categoryDescription: banner.categoryDescription || "",
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
    setDesktopPosterFile(null);
    setMobilePosterFile(null);
  }

  function toggleCategory(category) {
    const id = String(category._id);
    setForm((current) => {
      const exists = current.categories.some((item) => String(item.categoryId) === id);
      if (exists) {
        return { ...current, categories: current.categories.filter((item) => String(item.categoryId) !== id) };
      }
      if (current.categories.length >= settings.maxCategoryCards) return current;
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
      return { ...current, categories: items.map((item, index) => ({ ...item, displayOrder: index })) };
    });
  }

  async function moveBanner(bannerId, direction) {
    const sorted = [...banners].sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
    const index = sorted.findIndex((item) => String(item._id) === String(bannerId));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    const items = sorted.map((item, order) => ({ id: item._id, displayOrder: order }));
    setSaving(true);
    try {
      const rows = await reorderAdminHomepageBanners(items);
      setBanners(Array.isArray(rows) ? rows : sorted);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function selectContainer(containerId) {
    setActiveContainerId(String(containerId));
    setEditingId("");
    setForm(emptyForm);
    const selected = containers.find((item) => String(item._id || item.id) === String(containerId));
    if (selected) {
      setSettings({ ...defaultSettings, ...(selected.settings || {}) });
      setContainerMeta({
        name: selected.name || "",
        description: selected.description || "",
        overlayOpacity: Number(selected.overlayOpacity || 0),
        textPosition: selected.textPosition || "left",
      });
    }
    setLoading(true);
    try {
      const bannerRows = await listAdminHomepageBanners(String(containerId));
      setBanners(Array.isArray(bannerRows) ? bannerRows : []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateContainer() {
    const name = window.prompt("Container name", "Homepage Hero Row");
    if (!name?.trim()) return;
    setSaving(true);
    try {
      const created = await createAdminHomepageBannerContainer({ name: name.trim(), status: "active", showOnHomepage: true });
      const createdId = created?._id || created?.id;
      await refresh(createdId ? String(createdId) : undefined);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContainer() {
    if (!activeContainerId) return;
    if (containers.length <= 1) {
      setError("At least one banner container must remain.");
      return;
    }

    const bannerCount = activeContainer?.bannerCount || banners.length || 0;
    const message =
      bannerCount > 0
        ? `Delete "${activeContainer?.name || "this container"}" and all ${bannerCount} banner slide(s)? This also removes it from the Homepage Builder library.`
        : `Delete "${activeContainer?.name || "this container"}"? This also removes it from the Homepage Builder library.`;
    if (!window.confirm(message)) return;

    setSaving(true);
    setError("");
    try {
      await deleteAdminHomepageBannerContainer(activeContainerId);
      setActiveContainerId("");
      setBanners([]);
      resetForm();
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveContainerSettings(event) {
    event.preventDefault();
    if (!activeContainerId) return;
    setSaving(true);
    setError("");
    try {
      await updateAdminHomepageBannerContainer(activeContainerId, {
        name: containerMeta.name,
        description: containerMeta.description,
        overlayOpacity: containerMeta.overlayOpacity,
        textPosition: containerMeta.textPosition,
        settings,
      });
      await refresh();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(event) {
    return saveContainerSettings(event);
  }

  const previewBanners = useMemo(() => {
    const hasContent = form.name || form.title || form.categories.length;
    if (!hasContent) return [];
    return [
      {
        ...mapBannerForPreview(
          {
            _id: editingId || "preview-banner",
            ...form,
            categories: form.categories,
          },
          categories
        ),
      },
    ];
  }, [categories, editingId, form]);

  const allPreviewBanners = useMemo(() => {
    if (previewBanners.length && (form.name || form.title)) {
      const otherBanners = banners
        .filter((banner) => banner._id !== editingId)
        .map((banner) => mapBannerForPreview(banner, categories));
      return [...previewBanners, ...otherBanners].sort(
        (a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0)
      );
    }
    return banners.map((banner) => mapBannerForPreview(banner, categories));
  }, [banners, categories, editingId, form.name, form.title, previewBanners]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!activeContainerId) {
      setError("Select a banner container before creating slides.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, containerId: activeContainerId };
      let bannerId = editingId;
      if (editingId) {
        await updateAdminHomepageBanner(editingId, payload);
      } else {
        const created = await createAdminHomepageBanner(payload);
        bannerId = created?._id || created?.id;
      }

      if (bannerId && (desktopFile || mobileFile || desktopPosterFile || mobilePosterFile)) {
        const media = new FormData();
        if (desktopFile) media.append("desktop", desktopFile);
        if (mobileFile) media.append("mobile", mobileFile);
        if (desktopPosterFile) media.append("desktopPoster", desktopPosterFile);
        if (mobilePosterFile) media.append("mobilePoster", mobilePosterFile);
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

  const inputClass =
    "rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white";

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Banner Containers</h2>
            <p className="mt-1 text-sm text-slate-500">
              Group multiple banners into one homepage builder row. Containers appear in the Homepage Builder library automatically.
            </p>
          </div>
          <button type="button" onClick={handleCreateContainer} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            + New Container
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {containers.map((container) => {
            const id = container._id || container.id;
            const active = String(id) === String(activeContainerId);
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectContainer(id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active ? "bg-red-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                }`}
              >
                {container.name}
                <span className="ml-2 text-xs opacity-80">({container.bannerCount || 0})</span>
                {container.builderContainerId ? <span className="ml-2 text-[10px] uppercase">In library</span> : null}
              </button>
            );
          })}
        </div>

        {activeContainer ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{activeContainer.name}</p>
              <p className="text-xs text-slate-500">
                {activeContainer.bannerCount || 0} banners in this container •{" "}
                {activeContainer.builderContainerId
                  ? "Available in Homepage Builder container library. Add it to a layout and publish from Homepage Builder."
                  : "Will appear in Homepage Builder after you save container settings."}
              </p>
            </div>
            <button
              type="button"
              disabled={saving || containers.length <= 1}
              onClick={handleDeleteContainer}
              className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Delete Container
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Banners in Container</h2>
            <p className="mt-1 text-sm text-slate-500">Each slide belongs to the selected container and appears in the same homepage hero row.</p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            disabled={!activeContainerId}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50"
          >
            + Add Banner
          </button>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading banners...</div>
          ) : banners.length ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {[...banners]
                .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
                .map((banner, index, sorted) => (
                  <div key={banner._id} className="grid gap-3 px-4 py-4 lg:grid-cols-[auto_1fr_auto_auto_auto_auto] lg:items-center">
                    <div className="h-14 w-20 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                      {(banner.desktopMedia || banner.desktopImage) ? (
                        banner.mediaType === "video" ? (
                          <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase text-slate-500">Video</div>
                        ) : (
                          <img src={banner.desktopMedia || banner.desktopImage} alt="" className="h-full w-full object-cover" />
                        )
                      ) : null}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{banner.title || banner.name}</div>
                      <div className="text-xs text-slate-500">
                        {banner.mediaType || "image"} • Order {banner.displayOrder ?? 0} • {(banner.categories || []).length} categories • {banner.status}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" disabled={index === 0 || saving} onClick={() => moveBanner(banner._id, -1)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">↑</button>
                      <button type="button" disabled={index === sorted.length - 1 || saving} onClick={() => moveBanner(banner._id, 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">↓</button>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${banner.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>{banner.status}</span>
                    <button type="button" onClick={() => startEdit(banner)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">Edit</button>
                    <button type="button" onClick={() => handleDelete(banner._id)} className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">Delete</button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">
              {activeContainerId ? "No banners in this container yet. Click + Add Banner to create the first slide." : "Create a banner container to get started."}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Container slider settings</h2>
        <p className="mt-1 text-sm text-slate-500">These settings apply to the whole banner container, similar to homepage container advanced settings.</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveSettings}>
          <input value={containerMeta.name} onChange={(e) => setContainerMeta((c) => ({ ...c, name: e.target.value }))} placeholder="Container name" className={inputClass} />
          <input value={containerMeta.description} onChange={(e) => setContainerMeta((c) => ({ ...c, description: e.target.value }))} placeholder="Container description" className={inputClass} />
          <select value={containerMeta.textPosition} onChange={(e) => setContainerMeta((c) => ({ ...c, textPosition: e.target.value }))} className={inputClass}>
            <option value="left">Text left</option>
            <option value="center">Text center</option>
            <option value="right">Text right</option>
          </select>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
            Overlay opacity ({containerMeta.overlayOpacity})
            <input type="range" min={0} max={1} step={0.05} value={containerMeta.overlayOpacity} onChange={(e) => setContainerMeta((c) => ({ ...c, overlayOpacity: Number(e.target.value) }))} className="w-full" />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.autoplay !== false} onChange={(e) => setSettings((s) => ({ ...s, autoplay: e.target.checked }))} /> Enable auto slide</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.pauseOnHover !== false} onChange={(e) => setSettings((s) => ({ ...s, pauseOnHover: e.target.checked }))} /> Pause on hover</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enableLoop !== false} onChange={(e) => setSettings((s) => ({ ...s, enableLoop: e.target.checked }))} /> Enable loop</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.showArrows !== false} onChange={(e) => setSettings((s) => ({ ...s, showArrows: e.target.checked }))} /> Show arrows</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.showDots !== false} onChange={(e) => setSettings((s) => ({ ...s, showDots: e.target.checked }))} /> Show dots</label>
          <input type="number" min={1000} max={60000} step={500} value={settings.autoplayIntervalMs} onChange={(e) => setSettings((s) => ({ ...s, autoplayIntervalMs: Number(e.target.value) || 5000 }))} className={inputClass} placeholder="Autoplay interval (ms)" />
          <select value={settings.transitionEffect} onChange={(e) => setSettings((s) => ({ ...s, transitionEffect: e.target.value }))} className={inputClass}>
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="zoom">Zoom</option>
          </select>
          <input type="number" min={1} max={12} value={settings.maxCategoryCards} onChange={(e) => setSettings((s) => ({ ...s, maxCategoryCards: Number(e.target.value) || 6 }))} className={inputClass} placeholder="Max category cards" />
          <button type="submit" disabled={saving || !activeContainerId} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:col-span-2 lg:col-span-1">Save container settings</button>
        </form>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{editingId ? "Edit banner slide" : "Add banner slide"}</h2>
          {activeContainer ? <p className="mt-1 text-xs text-slate-500">Container: {activeContainer.name}</p> : null}
          <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
            <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Banner name" className={inputClass} required />
            <input value={form.featuredCollectionText} onChange={(e) => setForm((c) => ({ ...c, featuredCollectionText: e.target.value }))} placeholder="Featured collection text" className={inputClass} />
            <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Banner title" className={inputClass} />
            <input value={form.subtitle} onChange={(e) => setForm((c) => ({ ...c, subtitle: e.target.value }))} placeholder="Banner subtitle" className={inputClass} />
            <textarea rows={3} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Banner description" className={inputClass} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.ctaText} onChange={(e) => setForm((c) => ({ ...c, ctaText: e.target.value }))} placeholder="CTA text" className={inputClass} />
              <input value={form.ctaUrl} onChange={(e) => setForm((c) => ({ ...c, ctaUrl: e.target.value }))} placeholder="CTA URL" className={inputClass} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <select value={form.mediaType} onChange={(e) => setForm((c) => ({ ...c, mediaType: e.target.value }))} className={inputClass}>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              <input type="number" value={form.displayOrder} onChange={(e) => setForm((c) => ({ ...c, displayOrder: Number(e.target.value) || 0 }))} placeholder="Display order" className={inputClass} />
              <select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))} className={inputClass}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.showOnHomepage !== false} onChange={(e) => setForm((c) => ({ ...c, showOnHomepage: e.target.checked }))} /><span className="text-sm">Show on homepage</span></label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.hoverModeEnabled} onChange={(e) => setForm((c) => ({ ...c, hoverModeEnabled: e.target.checked }))} /><span className="text-sm">Enable hover CTA mode (desktop)</span></label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.showOverlay} onChange={(e) => setForm((c) => ({ ...c, showOverlay: e.target.checked }))} /><span className="text-sm">Show overlay</span></label>
            {form.showOverlay ? (
              <input type="range" min={0} max={1} step={0.05} value={form.overlayOpacity} onChange={(e) => setForm((c) => ({ ...c, overlayOpacity: Number(e.target.value) }))} className="w-full" />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">Desktop {form.mediaType === "video" ? "video" : "image"}<input type="file" accept={form.mediaType === "video" ? "video/mp4,video/webm" : "image/*"} onChange={(e) => setDesktopFile(e.target.files?.[0] || null)} /></label>
              <label className="grid gap-2 text-sm">Mobile {form.mediaType === "video" ? "video" : "image"}<input type="file" accept={form.mediaType === "video" ? "video/mp4,video/webm" : "image/*"} onChange={(e) => setMobileFile(e.target.files?.[0] || null)} /></label>
            </div>
            {form.mediaType === "video" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">Desktop poster<input type="file" accept="image/*" onChange={(e) => setDesktopPosterFile(e.target.files?.[0] || null)} /></label>
                <label className="grid gap-2 text-sm">Mobile poster<input type="file" accept="image/*" onChange={(e) => setMobilePosterFile(e.target.files?.[0] || null)} /></label>
              </div>
            ) : null}
            <input value={form.categoryHeading} onChange={(e) => setForm((c) => ({ ...c, categoryHeading: e.target.value }))} placeholder="Category heading (e.g. CATEGORIES)" className={inputClass} />
            <textarea rows={2} value={form.categoryDescription} onChange={(e) => setForm((c) => ({ ...c, categoryDescription: e.target.value }))} placeholder="Category description above cards" className={inputClass} />
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Category cards (max {settings.maxCategoryCards})</p>
              <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto">
                {categories.map((category) => {
                  const selected = selectedCategoryIds.has(String(category._id));
                  return (
                    <label key={category._id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${selected ? "border-red-500 bg-red-50" : "border-slate-200"}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleCategory(category)} />
                      <span className="text-sm text-slate-800 dark:text-slate-200">{category.name}</span>
                    </label>
                  );
                })}
              </div>
              {form.categories.length ? (
                <div className="mt-4 space-y-3">
                  {form.categories.map((item, index) => {
                    const category = categories.find((row) => String(row._id) === String(item.categoryId));
                    return (
                      <div key={item.categoryId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{index + 1}. {category?.name || "Category"}</span>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => moveCategory(item.categoryId, -1)} disabled={index === 0} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40">Up</button>
                            <button type="button" onClick={() => moveCategory(item.categoryId, 1)} disabled={index === form.categories.length - 1} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40">Down</button>
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input value={item.customTitle} onChange={(e) => setForm((c) => ({ ...c, categories: c.categories.map((row) => row.categoryId === item.categoryId ? { ...row, customTitle: e.target.value } : row) }))} placeholder="Custom card title" className={inputClass} />
                          <input value={item.customSubtitle} onChange={(e) => setForm((c) => ({ ...c, categories: c.categories.map((row) => row.categoryId === item.categoryId ? { ...row, customSubtitle: e.target.value } : row) }))} placeholder="Custom card subtitle" className={inputClass} />
                          <input value={item.ctaUrl} onChange={(e) => setForm((c) => ({ ...c, categories: c.categories.map((row) => row.categoryId === item.categoryId ? { ...row, ctaUrl: e.target.value } : row) }))} placeholder="Card CTA URL" className={`${inputClass} sm:col-span-2`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <button type="submit" disabled={saving || !activeContainerId} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{saving ? "Saving..." : editingId ? "Update slide" : "Add slide to container"}</button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Analytics</h3>
          {analytics ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs text-slate-500">Total banners</p><p className="text-xl font-bold">{analytics.totalBanners || 0}</p></div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs text-slate-500">Active</p><p className="text-xl font-bold text-emerald-600">{analytics.activeBanners || 0}</p></div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs text-slate-500">Inactive</p><p className="text-xl font-bold text-slate-600">{analytics.inactiveBanners || 0}</p></div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Homepage preview</h2>
        <div className="mt-5">
          {allPreviewBanners.length ? (
            <HomepageBannerSlider banners={allPreviewBanners} settings={settings} previewMode initialIndex={0} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center text-sm text-slate-500">Create a banner to see the homepage preview.</div>
          )}
        </div>
      </section>
    </div>
  );
}

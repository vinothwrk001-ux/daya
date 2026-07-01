import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LinkedProductsEditor } from "../components/admin/LinkedProductsEditor";
import { showError, showSuccess } from "../services/notificationService";
import { createAdminReel, getAdminReel, updateAdminReel } from "../services/reelService";

const defaultForm = {
  title: "",
  description: "",
  category: "",
  tags: "",
  musicName: "",
  location: "",
  status: "draft",
  visibility: "public",
  attributionWindowDays: 30,
  publishDate: "",
  linkedProducts: [],
};

export function AdminReelFormPage() {
  const { reelId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(reelId);
  const [form, setForm] = useState(defaultForm);
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    async function load() {
      setLoading(true);
      try {
        const reel = await getAdminReel(reelId);
        setForm({
          title: reel.title || "",
          description: reel.description || "",
          category: reel.category || "",
          tags: (reel.tags || []).join(", "),
          musicName: reel.musicName || "",
          location: reel.location || "",
          status: reel.status || "draft",
          visibility: reel.visibility || "public",
          attributionWindowDays: reel.attributionWindowDays || 30,
          publishDate: reel.publishDate ? reel.publishDate.slice(0, 16) : "",
          linkedProducts: (reel.linkedProducts || reel.associatedProducts || []).map((entry, index) => {
            const product = entry.product || entry;
            const productId = entry.productId || product._id;
            return {
              productId,
              sortOrder: entry.sortOrder ?? index,
              featured: Boolean(entry.featured),
              active: entry.active !== false,
              product,
            };
          }),
        });
      } catch (error) {
        showError(error?.response?.data?.message || "Failed to load reel");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isEdit, reelId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isEdit && !videoFile) {
      showError("Video upload is required");
      return;
    }

    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("title", form.title);
      payload.append("description", form.description);
      payload.append("category", form.category);
      payload.append("tags", form.tags);
      payload.append("musicName", form.musicName);
      payload.append("location", form.location);
      payload.append("status", form.status);
      payload.append("visibility", form.visibility);
      payload.append("attributionWindowDays", String(form.attributionWindowDays));
      if (form.publishDate) payload.append("publishDate", new Date(form.publishDate).toISOString());
      payload.append(
        "linkedProducts",
        JSON.stringify(
          form.linkedProducts.map((item, index) => ({
            productId: item.productId,
            sortOrder: index,
            featured: Boolean(item.featured),
            active: item.active !== false,
          }))
        )
      );
      payload.append(
        "associatedProducts",
        JSON.stringify(form.linkedProducts.map((item) => item.productId))
      );
      if (videoFile) payload.append("video", videoFile);
      if (thumbnailFile) payload.append("thumbnail", thumbnailFile);

      if (isEdit) {
        await updateAdminReel(reelId, payload);
        showSuccess("Reel updated");
      } else {
        await createAdminReel(payload);
        showSuccess("Reel created");
      }
      navigate("/admin/reels");
    } catch (error) {
      showError(error?.response?.data?.message || "Unable to save reel");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading reel...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {isEdit ? "Edit Reel" : "Create Reel"}
        </h1>
        <p className="text-sm text-slate-500">Upload video to Cloudinary and attach shoppable products.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Title</span>
          <input
            required
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Category</span>
          <input
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Music / Audio</span>
          <input
            value={form.musicName}
            onChange={(event) => setForm((current) => ({ ...current, musicName: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-semibold">Location</span>
          <input
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      <label className="block space-y-2 text-sm">
        <span className="font-semibold">Description</span>
        <textarea
          rows={4}
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Video (MP4, MOV, WEBM)</span>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Thumbnail</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Status</span>
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Visibility</span>
          <select
            value={form.visibility}
            onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Attribution Window (days)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={form.attributionWindowDays}
            onChange={(event) =>
              setForm((current) => ({ ...current, attributionWindowDays: Number(event.target.value || 30) }))
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Publish Date</span>
          <input
            type="datetime-local"
            value={form.publishDate}
            onChange={(event) => setForm((current) => ({ ...current, publishDate: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      <label className="block space-y-2 text-sm">
        <span className="font-semibold">Tags (comma separated)</span>
        <input
          value={form.tags}
          onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <LinkedProductsEditor
        value={form.linkedProducts}
        onChange={(linkedProducts) => setForm((current) => ({ ...current, linkedProducts }))}
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : isEdit ? "Update Reel" : "Create Reel"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/admin/reels")}
          className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold dark:border-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

import { useCallback, useEffect, useState } from "react";
import { getInfluencerCampaigns, uploadReel, uploadReelMultipart } from "../../services/influencerCommerceService";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";

export default function InfluencerReelUploadPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const activeCampaigns = campaigns.filter((c) => c.state === "active");

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await getInfluencerCampaigns();
      setCampaigns(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onFileChosen(f) {
    if (!f) return;
    setFile(f);
    setVideoUrl("");
    setMessage({ type: "", text: "" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    if (!campaignId) {
      setMessage({ type: "err", text: "Select an active campaign." });
      return;
    }
    if (!file && !videoUrl.trim()) {
      setMessage({ type: "err", text: "Provide a video file or a hosted video URL." });
      return;
    }

    setLoading(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append("campaignId", campaignId);
        fd.append("caption", caption);
        fd.append("video", file);
        const selected = activeCampaigns.find((c) => c._id === campaignId);
        const ids = (selected?.productIds || []).map((p) => p._id || p);
        fd.append("productIds", JSON.stringify(ids));
        await uploadReelMultipart(fd);
      } else {
        const selected = activeCampaigns.find((c) => c._id === campaignId);
        await uploadReel({
          campaignId,
          videoUrl: videoUrl.trim(),
          caption,
          productIds: (selected?.productIds || []).map((p) => p._id || p),
        });
      }
      setMessage({ type: "ok", text: "Reel submitted for review." });
      setFile(null);
      setVideoUrl("");
      setCaption("");
    } catch (err) {
      setMessage({ type: "err", text: err?.response?.data?.message || "Upload failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h1 className="text-xl font-semibold text-slate-950 dark:text-white">Upload</h1>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Campaign (active only)
          <select
            required
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">Select…</option>
            {activeCampaigns.map((c) => (
              <option key={c._id} value={c._id}>
                {c.vendorId?.shopName || c.vendorId?.companyName || c._id}
              </option>
            ))}
          </select>
        </label>
        {!activeCampaigns.length ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">Accept a campaign first — reels can only attach to active campaigns.</p>
        ) : null}

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDrag(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFileChosen(f);
          }}
          className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            drag ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-slate-300 dark:border-slate-600"
          }`}
        >
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Drag & drop video</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">MP4, WebM, or MOV · max ~100MB (server limit)</p>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            className="mt-4 block w-full text-sm"
            onChange={(e) => onFileChosen(e.target.files?.[0])}
          />
        </div>

        <div className="relative text-center text-xs uppercase tracking-widest text-slate-400 before:absolute before:left-0 before:top-1/2 before:h-px before:w-[40%] before:bg-slate-200 after:absolute after:right-0 after:top-1/2 after:h-px after:w-[40%] after:bg-slate-200 dark:before:bg-slate-700 dark:after:bg-slate-700">
          or URL
        </div>

        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Hosted video URL
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            placeholder="https://…"
            value={videoUrl}
            disabled={Boolean(file)}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              if (e.target.value) setFile(null);
            }}
          />
        </label>

        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Caption
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>

        {message.text ? (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              message.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
                : "border border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Uploading…" : "Submit for review"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200/80 bg-slate-950/5 p-5 dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Preview</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Review the clip before sending it to moderators.</p>
        <div className="mt-4 overflow-hidden rounded-xl bg-black">
          {previewUrl ? (
            <video src={previewUrl} className="aspect-video w-full object-contain" controls muted playsInline />
          ) : videoUrl.trim() ? (
            <video src={resolveApiAssetUrl(videoUrl.trim())} className="aspect-video w-full object-contain" controls muted playsInline />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-slate-400">No preview yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

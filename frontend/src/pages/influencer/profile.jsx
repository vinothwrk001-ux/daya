import { useEffect, useState } from "react";
import { getInfluencerProfile, registerInfluencer, updateInfluencerProfile } from "../../services/influencerCommerceService";

const CATEGORY_OPTIONS = [
  "baby",
  "beauty",
  "electronics",
  "fashion",
  "fitness",
  "food",
  "home",
  "lifestyle",
  "pets",
  "sports",
  "toys",
];

export default function InfluencerProfilePage() {
  const [form, setForm] = useState({
    categories: [],
    followers: 0,
    bio: "",
    socialHandles: { instagram: "", youtube: "", website: "" },
  });
  const [message, setMessage] = useState("");
  const [hasProfile, setHasProfile] = useState(false);
  const [profileState, setProfileState] = useState("draft");
  const [profileStats, setProfileStats] = useState({ views: 0, clicks: 0, sales: 0, revenue: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await getInfluencerProfile();
        if (!cancelled && response?.data) {
          const profile = response.data;
          setHasProfile(true);
          setProfileState(profile.state || "draft");
          setProfileStats(profile.stats || { views: 0, clicks: 0, sales: 0, revenue: 0 });
          setForm({
            categories: profile.categories || [],
            followers: profile.followers || 0,
            bio: profile.bio || "",
            socialHandles: profile.socialHandles || { instagram: "", youtube: "", website: "" },
          });
        }
      } catch {
        // First-time onboarding is allowed.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(submit = false) {
    const payload = { ...form, submit };
    try {
      if (!hasProfile) {
        const response = await registerInfluencer(payload);
        setHasProfile(true);
        setProfileState(response?.data?.state || (submit ? "submitted" : "draft"));
      } else {
        const response = await updateInfluencerProfile(payload);
        setProfileState(response?.data?.state || profileState);
      }
      setMessage(submit ? "Profile submitted for review." : "Profile saved.");
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to save profile.");
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Profile</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Categories, reach, bio, and social links power discovery and compliance for paid collaborations.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {profileState}
          </div>
        </div>
        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            {message}
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Followers
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.followers}
              onChange={(e) => setForm((c) => ({ ...c, followers: Number(e.target.value || 0) }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Instagram
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.socialHandles.instagram}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  socialHandles: { ...c.socialHandles, instagram: e.target.value },
                }))
              }
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            YouTube
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.socialHandles.youtube}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  socialHandles: { ...c.socialHandles, youtube: e.target.value },
                }))
              }
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Website
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={form.socialHandles.website}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  socialHandles: { ...c.socialHandles, website: e.target.value },
                }))
              }
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
            Bio
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              rows={4}
              value={form.bio}
              onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((category) => {
            const active = form.categories.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setForm((c) => ({
                    ...c,
                    categories: active ? c.categories.filter((item) => item !== category) : [...c.categories, category],
                  }))
                }
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                  active
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => save(false)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
          >
            Submit for review
          </button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Views", value: profileStats.views || 0 },
          { label: "Clicks", value: profileStats.clicks || 0 },
          { label: "Sales", value: profileStats.sales || 0 },
          { label: "Revenue", value: `₹${Number(profileStats.revenue || 0).toFixed(2)}` },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
          >
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{item.value}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

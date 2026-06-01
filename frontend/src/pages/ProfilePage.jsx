import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../context/authStore";
import { getUserProfile, updateUserProfile } from "../services/userService";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Failed to update profile.";
}

export function ProfilePage() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [profile, setProfile] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    getUserProfile()
      .then((data) => {
        if (!cancelled) {
          const profileData = data?.data ?? data;
          setProfile(profileData);
          setForm({
            name: profileData?.name || "",
            email: profileData?.email || "",
            phone: profileData?.phone || "",
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(normalizeError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const avatarPreview = useMemo(() => {
    if (avatarFile) return URL.createObjectURL(avatarFile);
    return resolveApiAssetUrl(profile?.avatarUrl);
  }, [avatarFile, profile?.avatarUrl]);

  useEffect(() => {
    return () => {
      if (avatarFile && avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarFile, avatarPreview]);

  async function saveProfile() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let response;
      if (avatarFile) {
        const payload = new FormData();
        payload.append("name", form.name);
        payload.append("email", form.email);
        payload.append("phone", form.phone);
        payload.append("avatar", avatarFile);
        response = await updateUserProfile(payload, { isFormData: true });
      } else {
        response = await updateUserProfile(form);
      }

      const profileData = response?.data ?? response;
      setProfile(profileData);
      setAuth({
        user: profileData,
      });
      setAvatarFile(null);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !profile && !error) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        Profile data is unavailable right now. Please refresh and try again.
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Profile photo</div>
        <div className="mt-5 flex flex-col items-center">
          {avatarPreview ? (
            <img src={avatarPreview} alt={form.name || "User"} className="h-28 w-28 rounded-[2rem] object-cover" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-slate-900 text-3xl font-bold text-white dark:bg-white dark:text-slate-950">
              {(form.name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <label className="mt-4 cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Upload photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
            />
          </label>
          <div className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            JPEG, PNG, or WEBP. Up to 5 MB.
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Profile management</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update your personal details used across checkout, orders, and support.</p>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {message ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        {loading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Full name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email address</span>
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Phone number</span>
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <div className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-800">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Account status</div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Role: <span className="font-semibold capitalize text-slate-900 dark:text-white">{profile?.role}</span>
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Status: <span className="font-semibold capitalize text-slate-900 dark:text-white">{profile?.status}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving || loading}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </section>
    </div>
  );
}

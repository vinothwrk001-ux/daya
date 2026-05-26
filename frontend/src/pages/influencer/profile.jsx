import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bell,
  CreditCard,
  Globe2,
  Link2,
  Lock,
  Palette,
  Shield,
  Smartphone,
  UserRound,
} from "lucide-react";
import {
  changeInfluencerPassword,
  getInfluencerProfileSettings,
  revokeInfluencerSession,
  updateInfluencerProfileSettings,
} from "../../services/influencerCommerceService";

const TABS = [
  ["personal", "Personal Information", UserRound],
  ["social", "Social Accounts", Smartphone],
  ["branding", "Store Branding", Palette],
  ["payment", "Payment Settings", CreditCard],
  ["notifications", "Notification Settings", Bell],
  ["security", "Security Settings", Lock],
  ["privacy", "Privacy Settings", Shield],
  ["connected", "Connected Accounts", Link2],
];

const SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "x", "linkedin", "pinterest", "snapchat", "telegram", "discord"];
const CONNECTED_PROVIDERS = ["google", "apple", "facebook", "instagram", "tiktok", "youtube", "stripe", "paypal", "meta_business", "google_analytics"];

function Field({ label, children }) {
  return (
    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const textareaClass = "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function StatusBadge({ value }) {
  const text = String(value || "pending").replace(/_/g, " ");
  const tone = text.includes("verified") || text.includes("connected") || text.includes("active")
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
    : text.includes("rejected") || text.includes("expired")
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200"
      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>{text}</span>;
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <span className={`h-6 w-11 rounded-full p-1 transition ${checked ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export default function InfluencerProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "personal";
  const [settings, setSettings] = useState(null);
  const [forms, setForms] = useState({});
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await getInfluencerProfileSettings();
      const data = res?.data || {};
      setSettings(data);
      setForms({
        personal: data.personalInformation || {},
        branding: data.storeBranding || {},
        payment: data.paymentSettings?.payoutPreferences || {},
        notifications: data.notificationSettings || {},
        privacy: data.privacySettings || {},
        preferences: data.accountPreferences || {},
        social: { accounts: data.socialAccounts || [] },
        connected: { accounts: data.connectedAccounts || [] },
      });
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to load profile settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeLabel = useMemo(() => TABS.find(([id]) => id === tab)?.[1] || "Personal Information", [tab]);

  function setForm(section, key, value) {
    setForms((current) => ({ ...current, [section]: { ...(current[section] || {}), [key]: value } }));
  }

  async function save(section, payload = forms[section]) {
    setBusy(true);
    setMessage("");
    try {
      const res = await updateInfluencerProfileSettings(section, payload || {});
      setSettings(res?.data || settings);
      setMessage("Settings saved.");
      await load();
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    setBusy(true);
    setMessage("");
    try {
      await changeInfluencerPassword(password);
      setPassword({ currentPassword: "", newPassword: "" });
      setMessage("Password changed.");
    } catch (err) {
      setMessage(err?.response?.data?.message || "Password update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(id) {
    setBusy(true);
    try {
      await revokeInfluencerSession(id);
      await load();
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to revoke session.");
    } finally {
      setBusy(false);
    }
  }

  function updateSocial(index, key, value) {
    const accounts = [...(forms.social?.accounts || [])];
    accounts[index] = { ...(accounts[index] || {}), [key]: value };
    setForm("social", "accounts", accounts);
  }

  function addSocial() {
    setForm("social", "accounts", [...(forms.social?.accounts || []), { platform: "instagram", handle: "", profileUrl: "", followers: 0 }]);
  }

  function connectProvider(provider) {
    save("connected", { provider, accountName: provider.replace(/_/g, " "), scopes: ["profile"], action: "connect" });
  }

  function disconnectProvider(provider) {
    save("connected", { provider, action: "disconnect" });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
          <UserRound className="h-3.5 w-3.5" />
          Profile Settings
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{activeLabel}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Manage profile identity, branding, social connections, payouts, notifications, security, and privacy using existing platform services.
        </p>
      </section>

      {message ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{message}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Completion</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{settings?.personalInformation?.profileCompletionScore || 0}%</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Verification</p>
          <div className="mt-2"><StatusBadge value={settings?.personalInformation?.verificationStatus} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Profile Views</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{settings?.analytics?.profileViews || 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Engagement</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{settings?.analytics?.engagementRate || 0}%</p>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setSearchParams(id === "personal" ? {} : { tab: id })} className={`inline-flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === id ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"}`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /> : null}

      {!loading && tab === "personal" ? (
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
          {[
            ["fullName", "Full Name"],
            ["displayName", "Display Name"],
            ["email", "Email Address"],
            ["phone", "Phone Number"],
            ["country", "Country"],
            ["state", "State"],
            ["city", "City"],
            ["language", "Language"],
            ["timezone", "Timezone"],
            ["websiteUrl", "Website URL"],
            ["profilePhoto", "Profile Photo URL"],
            ["headline", "Headline"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <input className={inputClass} value={forms.personal?.[key] || ""} onChange={(event) => setForm("personal", key, event.target.value)} />
            </Field>
          ))}
          <Field label="Biography">
            <textarea className={textareaClass} value={forms.personal?.biography || ""} onChange={(event) => setForm("personal", "biography", event.target.value)} />
          </Field>
          <Field label="Expertise Categories">
            <input className={inputClass} value={(forms.personal?.expertiseCategories || []).join(", ")} onChange={(event) => setForm("personal", "expertiseCategories", event.target.value.split(",").map((v) => v.trim()).filter(Boolean))} />
          </Field>
          <button disabled={busy} onClick={() => save("personal")} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 md:col-span-2">Save Changes</button>
        </section>
      ) : null}

      {!loading && tab === "social" ? (
        <section className="space-y-4">
          {(forms.social?.accounts || []).map((account, index) => (
            <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-5">
              <select className={inputClass} value={account.platform || "instagram"} onChange={(event) => updateSocial(index, "platform", event.target.value)}>
                {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
              <input className={inputClass} value={account.handle || ""} onChange={(event) => updateSocial(index, "handle", event.target.value)} placeholder="Handle" />
              <input className={inputClass} value={account.profileUrl || ""} onChange={(event) => updateSocial(index, "profileUrl", event.target.value)} placeholder="Profile URL" />
              <input className={inputClass} value={account.followers || 0} onChange={(event) => updateSocial(index, "followers", Number(event.target.value || 0))} placeholder="Followers" />
              <StatusBadge value={account.verificationStatus || account.connectedStatus} />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={addSocial} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Connect Account</button>
            <button disabled={busy} onClick={() => save("social", forms.social)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Social Accounts</button>
          </div>
        </section>
      ) : null}

      {!loading && tab === "branding" ? (
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
          {[
            ["storeName", "Store Name"],
            ["storeLogo", "Store Logo"],
            ["storeBanner", "Store Banner"],
            ["tagline", "Tagline"],
            ["primaryColor", "Primary Color"],
            ["secondaryColor", "Secondary Color"],
            ["accentColor", "Accent Color"],
            ["themeSelection", "Theme Selection"],
            ["headingFont", "Heading Font"],
            ["bodyFont", "Body Font"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <input type={key.includes("Color") ? "color" : "text"} className={inputClass} value={forms.branding?.[key] || ""} onChange={(event) => setForm("branding", key, event.target.value)} />
            </Field>
          ))}
          <Field label="Brand Description">
            <textarea className={textareaClass} value={forms.branding?.brandDescription || ""} onChange={(event) => setForm("branding", "brandDescription", event.target.value)} />
          </Field>
          <button disabled={busy} onClick={() => save("branding")} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 md:col-span-2">Update Branding</button>
        </section>
      ) : null}

      {!loading && tab === "payment" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Default payout</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Method: <span className="font-semibold text-slate-950 dark:text-white">{settings?.paymentSettings?.defaultPaymentMethod || "-"}</span></p>
              <p>Account: <span className="font-semibold text-slate-950 dark:text-white">{settings?.paymentSettings?.defaultBankAccount || "-"}</span></p>
              <p>Status: <StatusBadge value={settings?.paymentSettings?.payoutAccountStatus} /></p>
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Toggle label="Auto Withdraw" checked={Boolean(forms.payment?.autoWithdraw)} onChange={(value) => setForm("payment", "autoWithdraw", value)} />
            <Field label="Minimum Payout Threshold">
              <input className={inputClass} type="number" value={forms.payment?.minimumPayoutThreshold || 500} onChange={(event) => setForm("payment", "minimumPayoutThreshold", Number(event.target.value || 0))} />
            </Field>
            <Field label="Currency Preference">
              <input className={inputClass} value={forms.payment?.currencyPreference || "INR"} onChange={(event) => setForm("payment", "currencyPreference", event.target.value)} />
            </Field>
            <button disabled={busy} onClick={() => save("payment")} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50">Save Payment Preferences</button>
          </div>
        </section>
      ) : null}

      {!loading && tab === "notifications" ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {["orders", "commissions", "campaigns", "payments", "followers", "storefront", "products", "systemAlerts", "securityAlerts"].map((key) => (
            <Toggle key={key} label={key.replace(/([A-Z])/g, " $1")} checked={forms.notifications?.[key] !== false} onChange={(value) => setForm("notifications", key, value)} />
          ))}
          {["email", "sms", "push", "inApp"].map((channel) => (
            <Toggle key={channel} label={`${channel} channel`} checked={forms.notifications?.channels?.[channel] !== false} onChange={(value) => setForm("notifications", "channels", { ...(forms.notifications?.channels || {}), [channel]: value })} />
          ))}
          <Field label="Digest Frequency">
            <select className={inputClass} value={forms.notifications?.digestFrequency || "instant"} onChange={(event) => setForm("notifications", "digestFrequency", event.target.value)}>
              <option value="instant">Instant</option>
              <option value="hourly">Hourly Digest</option>
              <option value="daily">Daily Digest</option>
              <option value="weekly">Weekly Digest</option>
            </select>
          </Field>
          <button disabled={busy} onClick={() => save("notifications")} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2 xl:col-span-3">Save Notification Settings</button>
        </section>
      ) : null}

      {!loading && tab === "security" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Change password</h3>
            <div className="mt-4 grid gap-3">
              <input type="password" className={inputClass} value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} placeholder="Current password" />
              <input type="password" className={inputClass} value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} placeholder="New password" />
              <button disabled={busy} onClick={savePassword} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50">Update Password</button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Active sessions</h3>
            <div className="mt-4 space-y-3">
              {(settings?.securitySettings?.activeSessions || []).map((session) => (
                <div key={session._id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium text-slate-950 dark:text-white">{session.userAgent || "Unknown device"}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">IP {session.ipAddress || "Unknown"} · Last used {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : "-"}</p>
                  <button disabled={busy} onClick={() => revokeSession(session._id)} className="mt-2 text-xs font-semibold text-rose-600 disabled:opacity-50">Logout device</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {!loading && tab === "privacy" ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Profile Visibility">
            <select className={inputClass} value={forms.privacy?.profileVisibility || "public"} onChange={(event) => setForm("privacy", "profileVisibility", event.target.value)}>
              <option value="public">Public Profile</option>
              <option value="followers_only">Followers Only</option>
              <option value="private">Private Profile</option>
            </select>
          </Field>
          {["showBio", "showFollowersCount", "showStorefront", "showCollections", "showProducts", "showCampaignHistory", "profileIndexing", "searchVisibility", "analyticsSharing", "marketingPreferences"].map((key) => (
            <Toggle key={key} label={key.replace(/([A-Z])/g, " $1")} checked={forms.privacy?.[key] !== false} onChange={(value) => setForm("privacy", key, value)} />
          ))}
          <button disabled={busy} onClick={() => save("privacy")} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2 xl:col-span-3">Update Privacy Rules</button>
        </section>
      ) : null}

      {!loading && tab === "connected" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CONNECTED_PROVIDERS.map((provider) => {
            const connected = (settings?.connectedAccounts || []).find((account) => account.provider === provider);
            return (
              <div key={provider} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold capitalize text-slate-950 dark:text-white">{provider.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{connected?.accountName || "Not connected"}</p>
                  </div>
                  <StatusBadge value={connected?.status || "disconnected"} />
                </div>
                <button onClick={() => connected ? disconnectProvider(provider) : connectProvider(provider)} disabled={busy} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
                  {connected ? "Disconnect" : "Connect"}
                </button>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

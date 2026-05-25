import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../context/authStore";
import { PasswordField } from "../components/PasswordField";
import * as authService from "../services/authService";
import { validateAuthForm } from "../utils/authValidation";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";
import { BrandLogo } from "../components/BrandLogo";
import { continueAfterPrimaryAuth } from "../utils/postAuthContinuation";
import pendingActionManager from "../utils/pendingActionManager";
import pendingCheckoutManager from "../utils/pendingCheckoutManager";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Something went wrong";
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const role = useMemo(() => params.get("role") || "user", [params]);
  const { influencerCommerceEnabled, loading: commerceLoading } = usePlatformFeatures();
  const nav = useNavigate();
  const location = useLocation();
  const from = useMemo(() => location.state?.from?.pathname, [location.state]);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (role === "influencer" && !commerceLoading && !influencerCommerceEnabled) {
      setError("Influencer registrations are paused by the administrator.");
      return;
    }
    const nextErrors = validateAuthForm({
      email,
      phone,
      password,
      requireEmail: role === "vendor" || role === "influencer",
    });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setLoading(true);
    try {
      const res = await authService.register({ name, email, phone, password, role });
      setAuth(res.data);
      if (pendingCheckoutManager.has() || pendingActionManager.hasPendingAction() || from) {
        return continueAfterPrimaryAuth({ result: res, attemptedFrom: from, nav });
      }
      if (role === "vendor") return nav("/vendor/onboarding", { replace: true });
      if (role === "influencer") return nav("/influencer/profile", { replace: true });
      return nav("/user/dashboard", { replace: true });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <BrandLogo showName={false} className="mb-5 text-slate-950" imgClassName="h-12 w-auto object-contain" />
      <h1 className="text-2xl font-semibold tracking-tight">
        Register as {role === "vendor" ? "Vendor" : role === "influencer" ? "Influencer" : "User"}
      </h1>
      <p className="mt-2 text-slate-600">
        Create your account. Vendors and influencers continue into onboarding next.
      </p>

      {role === "influencer" && !commerceLoading && !influencerCommerceEnabled ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Influencer sign-ups are currently disabled.
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium">
          Name
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Email {role === "vendor" || role === "influencer" ? "" : <span className="text-slate-500">(optional)</span>}
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((current) => ({ ...current, email: "" }));
            }}
            type="email"
            required={role === "vendor" || role === "influencer"}
            placeholder={role === "vendor" || role === "influencer" ? "name@gmail.com" : "Optional Gmail address"}
          />
          {fieldErrors.email ? <div className="mt-1 text-xs text-rose-600">{fieldErrors.email}</div> : null}
        </label>

        <label className="mt-4 block text-sm font-medium">
          Phone
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setFieldErrors((current) => ({ ...current, phone: "" }));
            }}
            inputMode="numeric"
            maxLength={10}
            required
          />
          {fieldErrors.phone ? <div className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</div> : null}
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <PasswordField
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((current) => ({ ...current, password: "" }));
            }}
            minLength={6}
            required
          />
          {fieldErrors.password ? <div className="mt-1 text-xs text-rose-600">{fieldErrors.password}</div> : null}
        </label>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <button
          disabled={
            loading || (role === "influencer" && !commerceLoading && !influencerCommerceEnabled)
          }
          className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          type="submit"
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <div className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="text-indigo-600 hover:underline" to="/login" state={location.state}>
            Login
          </Link>
        </div>
      </form>
    </div>
  );
}


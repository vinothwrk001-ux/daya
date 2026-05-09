import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../context/authStore";
import { useStaffAuthStore } from "../context/staffAuthStore";
import * as authService from "../services/authService";
import * as staffAuthService from "../services/staffAuthService";
import * as vendorService from "../services/vendorService";
import { validateAuthForm } from "../utils/authValidation";
import { consumeRedirectAfterLogin } from "../utils/loginRedirect";

function normalizeError(err) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Something went wrong"
  );
}

function getPathnameFromTarget(target) {
  if (!target) return "";

  if (target.startsWith("http://") || target.startsWith("https://")) {
    try {
      return new URL(target).pathname;
    } catch {
      return "";
    }
  }

  return target;
}

function isAllowedStaffTarget(target) {
  const pathname = getPathnameFromTarget(target);
  return pathname.startsWith("/staff");
}

function isAuthPageTarget(target) {
  const pathname = getPathnameFromTarget(target);
  return ["/login", "/register", "/role", "/staff/login"].includes(pathname);
}

function isAllowedPrimaryTarget(target) {
  const pathname = getPathnameFromTarget(target);
  if (!pathname || isAuthPageTarget(pathname)) return false;

  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/user") ||
    pathname.startsWith("/vendor") ||
    pathname.startsWith("/seller") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/wishlist") ||
    pathname.startsWith("/addresses") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout")
  );
}

export function LoginPage() {
  const nav = useNavigate();
  const location = useLocation();
  const from = useMemo(() => location.state?.from?.pathname, [location.state]);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.logout);
  const setStaffAuth = useStaffAuthStore((s) => s.setAuth);
  const clearStaffAuth = useStaffAuthStore((s) => s.logout);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  async function navigateAfterPrimaryLogin(result, attemptedFrom) {
    const redirect = consumeRedirectAfterLogin();
    const role = result.data.user.role;
    if (redirect && isAllowedPrimaryTarget(redirect)) return window.location.assign(redirect);
    if (attemptedFrom && isAllowedPrimaryTarget(attemptedFrom)) return nav(attemptedFrom, { replace: true });

    if (["admin", "super_admin", "support_admin", "finance_admin"].includes(role)) {
      return nav("/dashboard/admin", { replace: true });
    }
    if (role === "user") return nav("/", { replace: true });
    if (role === "influencer") return nav("/influencer/dashboard", { replace: true });

    try {
      const vendorResponse = await vendorService.getVendorMe();
      const status = vendorResponse.data.status;
      if (status === "approved") return nav("/dashboard/vendor", { replace: true });
      if (status === "pending") return nav("/vendor/status", { replace: true });
      return nav("/vendor/onboarding", { replace: true });
    } catch {
      return nav("/vendor/onboarding", { replace: true });
    }
  }

  async function navigateAfterStaffLogin(attemptedFrom) {
    const redirect = consumeRedirectAfterLogin();
    if (redirect && isAllowedStaffTarget(redirect) && !isAuthPageTarget(redirect)) {
      return window.location.assign(redirect);
    }
    if (attemptedFrom && isAllowedStaffTarget(attemptedFrom) && !isAuthPageTarget(attemptedFrom)) {
      return nav(attemptedFrom, { replace: true });
    }
    return nav("/staff/dashboard", { replace: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const nextErrors = validateAuthForm({ identifier, password });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setLoading(true);
    const normalizedIdentifier = identifier.trim();
    const normalizedPassword = password.trim();

    try {
      const primaryResponse = await authService.login({
        identifier: normalizedIdentifier,
        password: normalizedPassword,
      });
      clearStaffAuth();
      setAuth(primaryResponse.data);
      return navigateAfterPrimaryLogin(primaryResponse, from);
    } catch (primaryError) {
      const isEmailLogin = normalizedIdentifier.includes("@");
      const primaryStatus = primaryError?.response?.status;
      const shouldSkipStaffFallback = primaryStatus === 429 || primaryStatus >= 500;

      if (!isEmailLogin || shouldSkipStaffFallback) {
        setError(normalizeError(primaryError));
        setLoading(false);
        return;
      }

      try {
        const staffResponse = await staffAuthService.login({
          email: normalizedIdentifier,
          password: normalizedPassword,
        });
        clearAuth();
        setStaffAuth(staffResponse.data);
        return navigateAfterStaffLogin(from);
      } catch (staffError) {
        setError(normalizeError(staffError?.response ? staffError : primaryError));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
      <p className="mt-2 text-slate-600">
        Users can login with <span className="font-medium">phone</span>; vendors, admin, and staff can use email.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium">
          Email or phone
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setFieldErrors((current) => ({ ...current, identifier: "" }));
            }}
            type="text"
            autoComplete="username"
            placeholder="10-digit phone or Gmail"
            required
          />
          {fieldErrors.identifier ? <div className="mt-1 text-xs text-rose-600">{fieldErrors.identifier}</div> : null}
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((current) => ({ ...current, password: "" }));
            }}
            type="password"
            autoComplete="current-password"
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
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          type="submit"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="mt-4 text-center text-sm text-slate-600">
          No account?{" "}
          <Link className="text-indigo-600 hover:underline" to="/role">
            Register
          </Link>
        </div>
      </form>
    </div>
  );
}

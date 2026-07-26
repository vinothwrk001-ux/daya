import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../context/authStore";
import { useStaffAuthStore } from "../context/staffAuthStore";
import { PasswordField } from "../components/PasswordField";
import * as authService from "../services/authService";
import * as staffAuthService from "../services/staffAuthService";
import { validateAuthForm } from "../utils/authValidation";
import { consumeRedirectAfterLogin } from "../utils/loginRedirect";
import { continueAfterPrimaryAuth } from "../utils/postAuthContinuation";
import { BrandLogo } from "../components/BrandLogo";
import { useBranding } from "../context/BrandingContext";
import { ShieldCheck, Zap, Package, Mail, Lock, ArrowLeft } from "lucide-react";

import { GoogleLogin } from "@react-oauth/google";

function normalizeError(err) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Something went wrong"
  );
}

function isAllowedStaffTarget(target) {
  const pathname = target?.startsWith("http://") || target?.startsWith("https://")
    ? new URL(target).pathname
    : target || "";
  return pathname.startsWith("/staff");
}
function isAuthPageTarget(target) {
  const pathname = target?.startsWith("http://") || target?.startsWith("https://")
    ? new URL(target).pathname
    : target || "";
  return ["/login", "/register", "/staff/login"].includes(pathname);
}

export function LoginPage() {
  const { branding } = useBranding();
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
  const passwordResetSuccess = location.state?.passwordReset === true;

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");
      const primaryResponse = await authService.googleLogin(credentialResponse.credential);
      clearStaffAuth();
      setAuth(primaryResponse.data);
      return navigateAfterPrimaryLogin(primaryResponse, from);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google Login was unsuccessful. Try again later.");
  };

  async function navigateAfterPrimaryLogin(result, attemptedFrom) {
    return continueAfterPrimaryAuth({ result, attemptedFrom, nav });
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
    const normalizedPassword = password;

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
    <div className="flex min-h-screen w-full flex-col bg-white md:flex-row">
      {/* Left Side */}
      <div className="relative hidden md:flex flex-1 flex-col justify-center overflow-hidden bg-black p-10 text-white md:min-h-full">
        <Link 
          to="/" 
          className="absolute left-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 xl:left-10 xl:top-10"
          title="Back to Home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-red-950 via-black to-black opacity-60"></div>
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "url('https://www.transparenttextures.com/patterns/black-paper.png')",
          }}
        ></div>

        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-md xl:max-w-lg">
          <BrandLogo showName={false} className="mb-8" imgClassName="h-16 w-auto object-contain" />
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white xl:text-5xl whitespace-nowrap">Designed to stand out.</h1>
          <div className="mb-6 h-1 w-12 bg-red-600"></div>
          <p className="mb-12 text-lg text-slate-300 xl:text-xl">
            Premium streetwear, custom design and creative services—all in one place.
          </p>

          <div className="grid grid-cols-3 gap-4 text-sm text-slate-300 xl:gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/50">
                <ShieldCheck className="h-5 w-5 text-red-500" />
              </div>
              <span>Secure sign in</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/50">
                <Zap className="h-5 w-5 text-red-500" />
              </div>
              <span>Fast checkout</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/50">
                <Package className="h-5 w-5 text-red-500" />
              </div>
              <span>Order tracking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to your DKA Creatives account</p>
          </div>

          {passwordResetSuccess ? (
            <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Password reset successful. Please log in with your new password.
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-900">Email or phone</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setFieldErrors((current) => ({ ...current, identifier: "" }));
                  }}
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your email or phone number"
                  required
                />
              </div>
              {fieldErrors.identifier ? <div className="mt-1 text-xs text-red-600">{fieldErrors.identifier}</div> : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-900">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 z-10 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <PasswordField
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  wrapperClassName="w-full"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((current) => ({ ...current, password: "" }));
                  }}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
              </div>
              {fieldErrors.password ? <div className="mt-1 text-xs text-red-600">{fieldErrors.password}</div> : null}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-red-600 focus:ring-red-500" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm font-medium text-red-600 hover:underline">
                Forgot password?
              </Link>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <button
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-black py-3 text-sm font-semibold text-white shadow-[0_4px_0_rgb(220,38,38)] transition-all hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(220,38,38)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_rgb(220,38,38)]"
              type="submit"
            >
              <Lock className="h-4 w-4 text-white/80 transition-colors group-hover:text-white" />
              {loading ? "Signing in..." : "Sign in securely"}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Your information is protected
            </div>

            <div className="mt-8 flex items-center justify-between">
              <span className="flex-1 border-b border-slate-200"></span>
              <span className="px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">OR</span>
              <span className="flex-1 border-b border-slate-200"></span>
            </div>

            <div className="flex justify-center flex-col items-center w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap
                shape="rectangular"
                theme="outline"
                size="large"
                text="continue_with"
                width="100%"
              />
            </div>

            {/* <div className="mt-6 text-center text-sm text-slate-600">
              New to DKA Creatives?{" "}
              <Link className="font-medium text-red-600 hover:underline" to="/register" state={location.state}>
                Create an account
              </Link>
            </div> */}
          </form>
        </div>
      </div>
    </div>
  );
}

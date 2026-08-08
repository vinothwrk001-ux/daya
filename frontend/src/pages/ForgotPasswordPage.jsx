import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "../components/PasswordField";
import { BrandLogo } from "../components/BrandLogo";
import {
  forgotPasswordRequest,
  forgotPasswordResendOtp,
  forgotPasswordReset,
  forgotPasswordVerifyOtp,
} from "../services/authService";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Something went wrong";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/;

const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "upper", label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "num", label: "A number", test: (v) => /\d/.test(v) },
  { id: "special", label: "A special character", test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v) },
];

export function ForgotPasswordPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [identifier, setIdentifier] = useState("");
  const [resetOtpId, setResetOtpId] = useState("");
  const [channel, setChannel] = useState("");
  const [recipient, setRecipient] = useState("");

  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const cooldownTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    };
  }, []);

  function startCooldown(seconds = 60) {
    setCooldown(seconds);
    if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    cooldownTimer.current = window.setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(cooldownTimer.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  const identifierType = useMemo(() => {
    if (identifier.includes("@")) return "email";
    return "phone";
  }, [identifier]);

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(newPassword) })),
    [newPassword]
  );
  const passwordValid = passwordChecks.every((rule) => rule.ok);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  async function onRequest(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    const value = identifier.trim();
    if (!value) {
      setError("Enter your email.");
      return;
    }
    if (value.includes("@") ? !EMAIL_RE.test(value) : !PHONE_RE.test(value)) {
      setError(value.includes("@") ? "Enter a valid email address." : "Phone number must be exactly 10 digits.");
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPasswordRequest({
        identifier: value,
        otpType: value.includes("@") ? "email" : "phone",
      });
      const data = res?.data ?? res;
      setResetOtpId(data.resetOtpId);
      setChannel(data.channel);
      setRecipient(data.recipient || "");
      setStep(2);
      startCooldown(data.resendCooldown || 60);
      if (data.devOtp) setInfo(`Dev OTP: ${data.devOtp}`);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      await forgotPasswordVerifyOtp({ resetOtpId, otp: otp.trim() });
      setStep(3);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (cooldown > 0) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await forgotPasswordResendOtp({ resetOtpId });
      const data = res?.data ?? res;
      startCooldown(data.resendCooldown || 60);
      setInfo(data.devOtp ? `New OTP sent. Dev OTP: ${data.devOtp}` : "A new OTP has been sent.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onReset(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!passwordValid) {
      setError("Password does not meet the requirements.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await forgotPasswordReset({ resetOtpId, newPassword, confirmPassword });
      nav("/login", {
        replace: true,
        state: { passwordReset: true },
      });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <BrandLogo showName={false} className="mb-5 text-slate-950" imgClassName="h-12 w-auto object-contain" />
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-slate-600">
        {step === 1 && "Enter your email to receive a one-time code."}
        {step === 2 && `Enter the 6-digit code sent to your ${channel === "email" ? "email" : "phone"}${recipient ? ` (${recipient})` : ""}.`}
        {step === 3 && "Create a new password for your account."}
      </p>

      <div className="mt-4 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-indigo-600" : "bg-slate-200"}`}
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        {error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {info}
          </div>
        ) : null}

        {step === 1 ? (
          <form onSubmit={onRequest}>
            <label className="block text-sm font-medium">
              Email
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                type="text"
                autoComplete="username"
                placeholder="Enter your email"
                required
              />
              <span className="mt-1 block text-xs text-slate-500">
                We will send a code via {identifierType === "email" ? "email" : "SMS"}.
              </span>
            </label>
            <button
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              type="submit"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </form>
        ) : null}

        {step === 2 ? (
          <form onSubmit={onVerify}>
            <label className="block text-sm font-medium">
              6-digit OTP
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 tracking-[0.5em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
              />
            </label>

            <div className="mt-3 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={onResend}
                disabled={cooldown > 0 || loading}
                className="text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setError("");
                  setInfo("");
                }}
                className="text-slate-500 hover:underline"
              >
                Change details
              </button>
            </div>

            <button
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              type="submit"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        ) : null}

        {step === 3 ? (
          <form onSubmit={onReset}>
            <label className="block text-sm font-medium">
              New password
              <PasswordField
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <ul className="mt-3 space-y-1">
              {passwordChecks.map((rule) => (
                <li key={rule.id} className={`text-xs ${rule.ok ? "text-emerald-600" : "text-slate-500"}`}>
                  {rule.ok ? "✓" : "•"} {rule.label}
                </li>
              ))}
            </ul>

            <label className="mt-4 block text-sm font-medium">
              Confirm password
              <PasswordField
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <span className="mt-1 block text-xs text-rose-600">Passwords do not match.</span>
              ) : null}
            </label>

            <button
              disabled={loading || !passwordValid || !passwordsMatch}
              className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              type="submit"
            >
              {loading ? "Updating..." : "Reset password"}
            </button>
          </form>
        ) : null}

        <div className="mt-4 text-center text-sm text-slate-600">
          Remembered it?{" "}
          <Link className="text-indigo-600 hover:underline" to="/login">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

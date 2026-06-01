const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const SecurityAuditLog = require("../models/SecurityAuditLog");

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getSecret() {
  return process.env.CSRF_SECRET || process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "development-csrf-secret";
}

function signToken(rawToken) {
  return crypto.createHmac("sha256", getSecret()).update(rawToken).digest("hex");
}

function createCsrfToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  return `${raw}.${signToken(raw)}`;
}

function isValidCsrfToken(token) {
  const [raw, signature] = String(token || "").split(".");
  if (!raw || !signature) return false;
  const expected = signToken(raw);
  if (Buffer.byteLength(expected) !== Buffer.byteLength(signature)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: false,
    secure,
    sameSite: process.env.AUTH_COOKIE_SAMESITE || (secure ? "none" : "lax"),
    path: "/",
    maxAge: Number(process.env.CSRF_COOKIE_MAX_AGE_MS || 2 * 60 * 60 * 1000),
  };
}

function issueCsrfToken(req, res) {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  const token = isValidCsrfToken(existing) ? existing : createCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions());
  return token;
}

async function logCsrfFailure(req, reason) {
  await SecurityAuditLog.create({
    actorId: req.user?.sub || req.staff?._id || "",
    actorRole: req.user?.role || req.staff?.authType || "",
    action: "CSRF_FAILURE",
    module: "auth",
    route: req.originalUrl,
    status: "BLOCKED",
    reason,
    environment: process.env.NODE_ENV || "development",
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || "",
    metadata: { method: req.method },
  }).catch(() => {});
}

function csrfProtection(req, res, next) {
  if (req.path.startsWith("/api/webhooks/") || req.path === "/api/shipping/webhooks/shiprocket") {
    return next();
  }

  if (req.path === "/api/config/initialize-defaults") {
    return next();
  }

  if (SAFE_METHODS.has(req.method)) {
    issueCsrfToken(req, res);
    return next();
  }

  if (req.path === "/api/auth/csrf" || req.path === "/api/staff/auth/csrf") {
    issueCsrfToken(req, res);
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    logCsrfFailure(req, "Missing CSRF token");
    return next(new AppError("CSRF token is required", 403, "CSRF_REQUIRED"));
  }

  if (cookieToken !== headerToken || !isValidCsrfToken(cookieToken)) {
    logCsrfFailure(req, "Invalid CSRF token");
    return next(new AppError("Invalid CSRF token", 403, "CSRF_INVALID"));
  }

  issueCsrfToken(req, res);
  return next();
}

module.exports = {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  createCsrfToken,
  isValidCsrfToken,
  issueCsrfToken,
  csrfProtection,
};

const crypto = require("crypto");
const path = require("path");
const { AppError } = require("./AppError");
const { PRIVATE_UPLOAD_DIR } = require("./upload");

const DEFAULT_TTL_SECONDS = 5 * 60;

function getSigningSecret() {
  const secret = process.env.PRIVATE_FILE_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new AppError("Private file signing is not configured", 500, "PRIVATE_FILE_SIGNING_NOT_CONFIGURED");
  return secret;
}

function normalizePrivateFilename(filename = "") {
  const safeName = path.basename(String(filename || ""));
  if (!safeName || safeName !== String(filename || "")) {
    throw new AppError("Invalid private file path", 400, "INVALID_PRIVATE_FILE_PATH");
  }
  return safeName;
}

function signPrivateFile(filename, { actorId = "", ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const safeName = normalizePrivateFilename(filename);
  const expiresAt = Math.floor(Date.now() / 1000) + Math.min(Math.max(Number(ttlSeconds) || DEFAULT_TTL_SECONDS, 30), 15 * 60);
  const payload = `${safeName}.${actorId}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  return { filename: safeName, token: Buffer.from(`${payload}.${signature}`).toString("base64url"), expiresAt };
}

function verifyPrivateFileToken(token = "") {
  let decoded = "";
  try {
    decoded = Buffer.from(String(token || ""), "base64url").toString("utf8");
  } catch {
    throw new AppError("Invalid private file token", 403, "INVALID_PRIVATE_FILE_TOKEN");
  }
  const parts = decoded.split(".");
  if (parts.length < 4) throw new AppError("Invalid private file token", 403, "INVALID_PRIVATE_FILE_TOKEN");
  const signature = parts.pop();
  const expiresAt = Number(parts.pop());
  const actorId = parts.pop();
  const filename = parts.join(".");
  const safeName = normalizePrivateFilename(filename);
  if (!expiresAt || expiresAt < Math.floor(Date.now() / 1000)) {
    throw new AppError("Private file link expired", 403, "PRIVATE_FILE_LINK_EXPIRED");
  }
  const payload = `${safeName}.${actorId}.${expiresAt}`;
  const expected = crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AppError("Invalid private file token", 403, "INVALID_PRIVATE_FILE_TOKEN");
  }
  return { filename: safeName, actorId, expiresAt, absolutePath: path.join(PRIVATE_UPLOAD_DIR, safeName) };
}

module.exports = { signPrivateFile, verifyPrivateFileToken, normalizePrivateFilename };

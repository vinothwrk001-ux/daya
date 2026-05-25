const { AppError } = require("../AppError");

const ALLOWED_EXTENSIONS = new Set([".png", ".svg", ".webp", ".ico"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getExtension(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

function validateBrandingFiles(files = {}) {
  const allFiles = Object.values(files).flat().filter(Boolean);
  for (const file of allFiles) {
    const extension = getExtension(file.originalname);
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new AppError(
        "Unsupported branding file. Please upload PNG, SVG, WEBP, or ICO under 5 MB.",
        400,
        "FILE_TYPE"
      );
    }
    if (Number(file.size || 0) > MAX_FILE_SIZE) {
      throw new AppError("Branding assets must be 5 MB or smaller.", 400, "FILE_SIZE");
    }
  }
}

module.exports = {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  validateBrandingFiles,
};

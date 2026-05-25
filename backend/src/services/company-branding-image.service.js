const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let sharpInstance = null;
let sharpLoadAttempted = false;

function getSharp() {
  if (sharpLoadAttempted) return sharpInstance;
  sharpLoadAttempted = true;
  try {
    // Optional dependency for production deployments that want full image derivation.
    // The module remains functional without it.
    sharpInstance = require("sharp");
  } catch (_error) {
    sharpInstance = null;
  }
  return sharpInstance;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeSegment(value, fallback) {
  return String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function detectExtension(file = {}) {
  const ext = String(path.extname(file.originalname || "") || "").toLowerCase();
  if (ext) return ext;
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  if (file.mimetype === "image/svg+xml") return ".svg";
  if (file.mimetype === "image/x-icon" || file.mimetype === "image/vnd.microsoft.icon") return ".ico";
  return ".bin";
}

function buildFileName(slot, suffix, ext) {
  const nonce = crypto.randomBytes(6).toString("hex");
  return `${safeSegment(slot, "asset")}-${suffix}-${Date.now()}-${nonce}${ext}`;
}

async function writeFile(filePath, buffer) {
  await fs.promises.writeFile(filePath, buffer);
  const stats = await fs.promises.stat(filePath);
  return stats.size;
}

async function createDerivedImages(file, originalFilePath, outputDir, slot) {
  const sharp = getSharp();
  const isConvertibleImage = /^image\/(png|webp|jpeg|jpg|gif|avif|svg\+xml)$/i.test(String(file.mimetype || ""));
  if (!sharp || !isConvertibleImage) {
    return {
      width: 0,
      height: 0,
      webp: null,
      thumbnail: null,
      optimized: false,
    };
  }

  try {
    const original = sharp(file.buffer, { density: 240, animated: false });
    const metadata = await original.metadata();
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);

    const webpFilename = buildFileName(slot, "webp", ".webp");
    const webpPath = path.join(outputDir, webpFilename);
    await original.clone().webp({ quality: 88 }).toFile(webpPath);
    const webpStats = await fs.promises.stat(webpPath);

    const thumbFilename = buildFileName(slot, "thumb", ".webp");
    const thumbPath = path.join(outputDir, thumbFilename);
    await original
      .clone()
      .resize(160, 160, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(thumbPath);
    const thumbStats = await fs.promises.stat(thumbPath);

    return {
      width,
      height,
      optimized: true,
      webp: {
        path: webpPath,
        filename: webpFilename,
        size: webpStats.size,
      },
      thumbnail: {
        path: thumbPath,
        filename: thumbFilename,
        size: thumbStats.size,
      },
    };
  } catch (_error) {
    return {
      width: 0,
      height: 0,
      optimized: false,
      webp: null,
      thumbnail: null,
    };
  }
}

async function persistBrandingAsset(file, { slot, tenantType, tenantKey }) {
  const uploadsRoot = path.join(process.cwd(), "uploads", "branding", safeSegment(tenantType, "platform"), safeSegment(tenantKey, "default"));
  ensureDir(uploadsRoot);

  const ext = detectExtension(file);
  const originalFilename = buildFileName(slot, "original", ext);
  const originalPath = path.join(uploadsRoot, originalFilename);
  const originalSize = await writeFile(originalPath, file.buffer);
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const derived = await createDerivedImages(file, originalPath, uploadsRoot, slot);

  return {
    url: `/uploads/branding/${safeSegment(tenantType, "platform")}/${safeSegment(tenantKey, "default")}/${originalFilename}`,
    webpUrl: derived.webp
      ? `/uploads/branding/${safeSegment(tenantType, "platform")}/${safeSegment(tenantKey, "default")}/${derived.webp.filename}`
      : "",
    thumbnailUrl: derived.thumbnail
      ? `/uploads/branding/${safeSegment(tenantType, "platform")}/${safeSegment(tenantKey, "default")}/${derived.thumbnail.filename}`
      : "",
    originalName: file.originalname || "",
    mimeType: file.mimetype || "",
    size: originalSize,
    width: derived.width || 0,
    height: derived.height || 0,
    checksum,
    storageProvider: "local",
    variants: {
      original: {
        url: `/uploads/branding/${safeSegment(tenantType, "platform")}/${safeSegment(tenantKey, "default")}/${originalFilename}`,
        width: derived.width || 0,
        height: derived.height || 0,
        size: originalSize,
      },
      webp: derived.webp
        ? {
            url: `/uploads/branding/${safeSegment(tenantType, "platform")}/${safeSegment(tenantKey, "default")}/${derived.webp.filename}`,
            width: derived.width || 0,
            height: derived.height || 0,
            size: derived.webp.size,
          }
        : {},
      thumbnail: derived.thumbnail
        ? {
            url: `/uploads/branding/${safeSegment(tenantType, "platform")}/${safeSegment(tenantKey, "default")}/${derived.thumbnail.filename}`,
            width: 0,
            height: 0,
            size: derived.thumbnail.size,
          }
        : {},
    },
    updatedAt: new Date(),
  };
}

module.exports = {
  getSharp,
  persistBrandingAsset,
};

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { configureCloudinary } = require("../config/cloudinary");
const { AppError } = require("./AppError");

const PUBLIC_UPLOAD_DIR = path.join(process.cwd(), "uploads", "public");
const PRIVATE_UPLOAD_DIR = path.join(process.cwd(), "uploads", "private");
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES || 5 * 1024 * 1024); // 5MB
const MAX_VIDEO_FILE_SIZE = Number(process.env.MAX_VIDEO_FILE_SIZE_BYTES || 50 * 1024 * 1024); // 50MB

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
]);

function ensureUploadDir(uploadDir) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function isPrivateFolder(folder = "") {
  return /(^|[-_/])(kyc|identity|bank|tax|verification|withdrawal|finance|document|documents)([-_/]|$)/i.test(String(folder || ""));
}

function validateFiles(files) {
  for (const f of files) {
    if (!ALLOWED_MIME.has(f.mimetype)) {
      throw new AppError(`Unsupported file type: ${f.mimetype}`, 400, "FILE_TYPE");
    }
    const maxSize = f.mimetype.startsWith("video/") ? MAX_VIDEO_FILE_SIZE : MAX_FILE_SIZE;
    if (f.size > maxSize) {
      throw new AppError("File too large", 400, "FILE_SIZE");
    }
  }
}

function randomName(originalName) {
  const ext = path.extname(originalName || "");
  const id = crypto.randomBytes(16).toString("hex");
  return `${Date.now()}-${id}${ext}`;
}

async function uploadToCloudinary(files, folder) {
  const { enabled, cloudinary } = configureCloudinary();
  if (!enabled) return null;

  const results = [];
  for (const file of files) {
    // cloudinary upload_stream for buffer
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
            resource_type: file.mimetype === "application/pdf" ? "raw" : file.mimetype.startsWith("video/") ? "video" : "image",
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });

    results.push({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  return results;
}

async function uploadToLocal(files, { folder = "uploads", visibility = "public" } = {}) {
  const privateAsset = visibility === "private" || isPrivateFolder(folder);
  const uploadDir = privateAsset ? PRIVATE_UPLOAD_DIR : PUBLIC_UPLOAD_DIR;
  ensureUploadDir(uploadDir);
  const results = [];
  for (const file of files) {
    const filename = randomName(file.originalname);
    const fullPath = path.join(uploadDir, filename);
    await fs.promises.writeFile(fullPath, file.buffer);

    results.push({
      url: privateAsset ? "" : `/uploads/${filename}`,
      storage: privateAsset ? "private" : "public",
      storageKey: privateAsset ? filename : `public/${filename}`,
      localPath: fullPath,
      publicId: null,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }
  return results;
}

async function uploadMany(files, { folder } = {}) {
  if (!files || !files.length) return [];

  validateFiles(files);

  const cloud = await uploadToCloudinary(files, folder || "uploads");
  if (cloud) return cloud;

  return await uploadToLocal(files, { folder, visibility: isPrivateFolder(folder) ? "private" : "public" });
}

module.exports = { uploadMany, validateFiles, ALLOWED_MIME, MAX_FILE_SIZE, MAX_VIDEO_FILE_SIZE, PUBLIC_UPLOAD_DIR, PRIVATE_UPLOAD_DIR, isPrivateFolder };


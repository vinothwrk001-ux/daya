const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const REEL_MAX_BYTES = Number(process.env.REEL_MAX_UPLOAD_BYTES || 100 * 1024 * 1024);
const REEL_UPLOAD_DIR = path.join(process.cwd(), "uploads", "reels");

const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(REEL_UPLOAD_DIR, { recursive: true });
    cb(null, REEL_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".mp4";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

const reelVideoUpload = multer({
  storage,
  limits: { fileSize: REEL_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_VIDEO.has(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_VIDEO_TYPE"));
    }
    cb(null, true);
  },
});

function optionalReelVideoUpload(req, res, next) {
  const ct = String(req.headers["content-type"] || "");
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return next();
  }
  return reelVideoUpload.single("video")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "Video file is too large" });
    }
    if (String(err.message) === "UNSUPPORTED_VIDEO_TYPE") {
      return res.status(400).json({ success: false, message: "Unsupported video format. Use MP4, WebM, or MOV." });
    }
    return next(err);
  });
}

module.exports = { optionalReelVideoUpload, REEL_UPLOAD_DIR };

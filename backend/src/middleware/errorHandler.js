const { AppError } = require("../utils/AppError");
const { logger } = require("../utils/logger");

function errorHandler(err, req, res, next) {
  // Multer / upload errors normalization
  if (err && err.code === "LIMIT_FILE_SIZE") {
    err = new AppError("File too large", 400, "FILE_SIZE");
  }
  if (err && err.message === "UNSUPPORTED_FILE_TYPE") {
    err = new AppError("Unsupported file type", 400, "FILE_TYPE");
  }
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    err = new AppError("Uploaded media is too large", 413, "PAYLOAD_TOO_LARGE");
  }
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "record";
    err = new AppError(`${field} already exists`, 409, "DUPLICATE_RECORD", { field });
  }
  if (err && err.name === "ValidationError") {
    err = new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      fields: Object.fromEntries(Object.entries(err.errors || {}).map(([field, issue]) => [field, issue.message])),
    });
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;

  const message =
    statusCode === 500
      ? "Something went wrong"
      : err.message || "Request failed";

  const payload = {
    success: false,
    message,
    code: err.code || (isAppError ? err.code : "INTERNAL_ERROR"),
  };

  if (isAppError && err.details) payload.details = err.details;
  if (process.env.NODE_ENV !== "production" && !isAppError) {
    payload.debug = {
      message: err.message,
    };
  }

  logger.error("Request error", {
    path: req.path,
    method: req.method,
    statusCode,
    message: err.message,
    stack: err.stack,
  });

  res.status(statusCode).json(payload);
}

module.exports = { errorHandler };


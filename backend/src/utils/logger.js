const winston = require("winston");

const SENSITIVE_KEY_PATTERN = /(token|secret|password|otp|authorization|cookie|session|signature|permissions|roleMap|accessMatrix|bank|ifsc|account|tax|kyc)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?\d[\s-]?){8,15}\b/g;

function redactString(value) {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]");
}

function redact(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return "[redacted-depth]";
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message || ""),
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
      code: value.code,
      status: value.status || value.statusCode,
    };
  }
  if (Array.isArray(value)) {
    return value.length > 20 ? `[redacted-array:${value.length}]` : value.map((item) => redact(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redact(entry, depth + 1),
      ])
    );
  }
  return String(value);
}

const redactFormat = winston.format((info) => redact(info));

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactFormat(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

logger.audit = (message, meta = {}) => logger.info(message, { channel: "audit", ...meta });
logger.security = (message, meta = {}) => logger.warn(message, { channel: "security", ...meta });
logger.payment = (message, meta = {}) => logger.info(message, { channel: "payment", ...meta });
logger.commission = (message, meta = {}) => logger.info(message, { channel: "commission", ...meta });
logger.webhook = (message, meta = {}) => logger.info(message, { channel: "webhook", ...meta });

const requestLoggerStream = {
  write: (message) => logger.info(message.trim(), { source: "morgan" }),
};

module.exports = { logger, requestLoggerStream, redact };


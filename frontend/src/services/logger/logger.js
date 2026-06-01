const SENSITIVE_KEY_PATTERN = /(token|secret|password|otp|authorization|cookie|session|signature|permissions|roleMap|accessMatrix|bank|ifsc|account|tax|kyc)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?\d[\s-]?){8,15}\b/g;

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const environment = import.meta.env.MODE || "development";
const isProduction = import.meta.env.PROD;
const isStaging = environment === "staging";
const minLevel = isProduction ? LEVELS.error : isStaging ? LEVELS.warn : LEVELS.debug;

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
      status: value.response?.status,
      code: value.code,
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

function emit(level, event, context = {}) {
  if (LEVELS[level] < minLevel) return;

  const payload = {
    level,
    event,
    environment,
    timestamp: new Date().toISOString(),
    ...redact(context),
  };

  if (level === "error") {
    console.error(event, payload);
  } else if (level === "warn") {
    console.warn(event, payload);
  } else if (level === "info") {
    console.info(event, payload);
  } else {
    console.debug(event, payload);
  }
}

export const logger = {
  debug: (event, context) => emit("debug", event, context),
  info: (event, context) => emit("info", event, context),
  warn: (event, context) => emit("warn", event, context),
  error: (event, context) => emit("error", event, context),
  performance: (event, context) => emit("info", event, { type: "performance", ...context }),
  security: (event, context) => emit("warn", event, { type: "security", ...context }),
};

export { redact };

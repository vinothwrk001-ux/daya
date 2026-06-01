import axios from "axios";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-TOKEN";
const SAFE_METHODS = new Set(["get", "head", "options"]);

function apiBaseUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:5000";
}

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) || ""
  );
}

let csrfPromise = null;

export function isUnsafeMethod(method = "get") {
  return !SAFE_METHODS.has(String(method || "get").toLowerCase());
}

export async function ensureCsrfToken() {
  const existing = readCookie(CSRF_COOKIE_NAME);
  if (existing) return decodeURIComponent(existing);

  csrfPromise =
    csrfPromise ||
    axios
      .get(`${apiBaseUrl()}/api/auth/csrf`, { withCredentials: true })
      .then((response) => response.data?.data?.csrfToken || readCookie(CSRF_COOKIE_NAME))
      .finally(() => {
        csrfPromise = null;
      });

  return csrfPromise;
}

export async function attachCsrfHeader(config) {
  if (!isUnsafeMethod(config.method)) return config;
  const token = await ensureCsrfToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers[CSRF_HEADER_NAME] = token;
  }
  return config;
}

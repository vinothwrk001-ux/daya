const CHECKOUT_JS_URL = "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_ALLOWED_SCRIPT_HOSTS = new Set(["checkout.razorpay.com", "cdn.razorpay.com"]);
const REPORT_NAME = "checkout-diagnostic-report.json";

function getEnv() {
  return {
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    prod: import.meta.env.PROD,
    apiUrl: import.meta.env.VITE_API_URL || "",
    appVersion: import.meta.env.VITE_APP_VERSION || "development",
    razorpayInspector: import.meta.env.VITE_RAZORPAY_CHECKOUT_INSPECTOR || "",
  };
}

export function isRazorpayInspectorEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("rzp_inspect") === "1") return true;
  if (window.localStorage.getItem("rzpCheckoutInspector") === "true") return true;
  if (window.localStorage.getItem("rzpCheckoutInspector") === "false") return false;
  return import.meta.env.DEV || import.meta.env.VITE_RAZORPAY_CHECKOUT_INSPECTOR === "true";
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function detectEmptyValues(payload, prefix = "") {
  const issues = [];
  Object.entries(payload || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isEmpty(value)) {
      issues.push(path);
      return;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      issues.push(...detectEmptyValues(value, path));
    }
  });
  return issues;
}

function getCheckoutScriptState() {
  if (typeof document === "undefined") {
    return { loaded: false, validSource: false, scripts: [] };
  }
  const scripts = Array.from(document.querySelectorAll('script[src*="razorpay"], script[data-razorpay-sdk="true"]'))
    .map((script) => ({
      src: script.src || "",
      dataRazorpaySdk: script.dataset.razorpaySdk || "",
    }));
  const invalidScripts = scripts.filter((script) => {
    try {
      const url = new URL(script.src);
      return !RAZORPAY_ALLOWED_SCRIPT_HOSTS.has(url.hostname);
    } catch {
      return true;
    }
  });
  return {
    loaded: scripts.some((script) => script.src === CHECKOUT_JS_URL),
    validSource: scripts.length > 0 && scripts.some((script) => script.src === CHECKOUT_JS_URL) && invalidScripts.length === 0,
    expectedSource: CHECKOUT_JS_URL,
    allowedHosts: Array.from(RAZORPAY_ALLOWED_SCRIPT_HOSTS),
    invalidScripts,
    scripts,
  };
}

function removeMatchingStorageKeys(storage, matcher) {
  if (!storage) return [];
  const removed = [];
  Object.keys(storage).forEach((key) => {
    if (matcher(key)) {
      removed.push(key);
      storage.removeItem(key);
    }
  });
  return removed;
}

export function clearStaleRazorpayCheckoutState() {
  if (typeof window === "undefined") return { localStorage: [], sessionStorage: [] };
  const matcher = (key) =>
    /^rzp_/i.test(key) ||
    /^razorpay[_-]?checkout[_-]?(id|session|token|anon)/i.test(key) ||
    /^checkout_razorpay/i.test(key);
  const result = {
    localStorage: removeMatchingStorageKeys(window.localStorage, matcher),
    sessionStorage: removeMatchingStorageKeys(window.sessionStorage, matcher),
    clearedAt: new Date().toISOString(),
  };
  if (result.localStorage.length || result.sessionStorage.length) {
    window.__razorpayClearedCheckoutState = result;
    console.info("[Razorpay Checkout Inspector] Cleared stale Razorpay checkout state", result);
  }
  return result;
}

async function getBrowserCacheState() {
  if (typeof window === "undefined") return {};
  const serviceWorkers =
    navigator.serviceWorker?.getRegistrations
      ? await navigator.serviceWorker.getRegistrations().then((registrations) =>
          registrations.map((registration) => ({
            scope: registration.scope,
            active: Boolean(registration.active),
            installing: Boolean(registration.installing),
            waiting: Boolean(registration.waiting),
          }))
        ).catch(() => [])
      : [];
  const cacheKeys = window.caches?.keys ? await window.caches.keys().catch(() => []) : [];
  const storageKeys = Object.keys(window.localStorage || {}).filter((key) =>
    /razorpay|payment|checkout|vite|env|config/i.test(key)
  );
  const storagePreview = storageKeys.reduce((acc, key) => {
    const value = window.localStorage.getItem(key) || "";
    acc[key] = value.length > 160 ? `${value.slice(0, 160)}...` : value;
    return acc;
  }, {});
  return {
    serviceWorkers,
    cacheKeys,
    localStoragePaymentConfiguration: storagePreview,
  };
}

function compareValues(frontend, backend) {
  const checks = {
    backendConfiguration: "PASS",
    frontendConfiguration: "PASS",
    runtimeCheckoutPayload: "PASS",
    razorpaySdk: "PASS",
    environmentConsistency: "PASS",
    browserCacheConsistency: "PASS",
  };
  const mismatches = [];

  const pairs = [
    ["Backend Order ID", frontend.order_id, backend?.order?.razorpay_order_id, "ORDER_MISMATCH"],
    ["Backend Key", frontend.key, backend?.backendConfiguration?.key, "KEY_MISMATCH"],
    ["Backend Amount", Number(frontend.amount), Number(backend?.order?.amount), "AMOUNT_MISMATCH"],
    ["Backend Currency", frontend.currency, backend?.order?.currency, "CURRENCY_MISMATCH"],
  ];

  pairs.forEach(([label, frontendValue, backendValue, code]) => {
    if (String(frontendValue) !== String(backendValue)) {
      mismatches.push({ code, label, frontendValue, backendValue });
    }
  });

  if (mismatches.some((item) => item.code.includes("ORDER") || item.code.includes("AMOUNT") || item.code.includes("CURRENCY"))) {
    checks.runtimeCheckoutPayload = "FAIL";
  }
  if (mismatches.some((item) => item.code === "KEY_MISMATCH")) checks.environmentConsistency = "FAIL";

  return { checks, mismatches };
}

function downloadReport(report) {
  if (typeof document === "undefined") return;
  const shouldDownload =
    import.meta.env.DEV ||
    window.localStorage.getItem("rzpCheckoutInspectorDownload") === "true" ||
    new URLSearchParams(window.location.search).get("rzp_download_report") === "1";
  if (!shouldDownload) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = REPORT_NAME;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

function persistReport(report) {
  console.groupCollapsed("[Razorpay Checkout Inspector]");
  console.log(report);
  console.groupEnd();
  window.localStorage.setItem("razorpayCheckoutDiagnosticReport", JSON.stringify(report));
  window.__razorpayCheckoutDiagnosticReport = report;
  downloadReport(report);
}

export async function inspectRazorpayCheckout({ options, backendOrder, fetchBackendOrder, failureResponse = null }) {
  if (!isRazorpayInspectorEnabled()) return null;

  const checkoutPayload = {
    key: options?.key,
    order_id: options?.order_id,
    amount: options?.amount,
    currency: options?.currency,
    name: options?.name,
    description: options?.description,
    prefill: options?.prefill || {},
    notes: options?.notes || {},
  };

  const [latestBackendOrder, browserCache] = await Promise.all([
    fetchBackendOrder ? fetchBackendOrder().catch((error) => ({ inspectorError: error?.message || "Backend fetch failed" })) : backendOrder,
    getBrowserCacheState(),
  ]);

  const scriptState = getCheckoutScriptState();
  const emptyValues = detectEmptyValues(checkoutPayload);
  const comparison = compareValues(checkoutPayload, latestBackendOrder);
  const checks = { ...comparison.checks };

  if (emptyValues.length) checks.runtimeCheckoutPayload = "FAIL";
  if (!scriptState.validSource || !scriptState.loaded) checks.razorpaySdk = "FAIL";
  if (browserCache.serviceWorkers?.length || browserCache.cacheKeys?.length) checks.browserCacheConsistency = "WARNING";
  if (latestBackendOrder?.inspectorError) checks.backendConfiguration = "FAIL";

  const failures = Object.values(checks).filter((value) => value === "FAIL").length;
  const warnings = Object.values(checks).filter((value) => value === "WARNING").length;

  const report = {
    reportName: REPORT_NAME,
    diagnosticId: `checkout_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    generatedAt: new Date().toISOString(),
    overallStatus: failures ? "FAIL" : warnings ? "WARNING" : "PASS",
    checks,
    mismatches: comparison.mismatches,
    emptyValues,
    frontendCheckoutPayload: checkoutPayload,
    backendOrder: latestBackendOrder,
    razorpayFailure: failureResponse
      ? {
          code: failureResponse?.error?.code || "",
          description: failureResponse?.error?.description || "",
          source: failureResponse?.error?.source || "",
          step: failureResponse?.error?.step || "",
          reason: failureResponse?.error?.reason || "",
          metadata: failureResponse?.error?.metadata || {},
        }
      : null,
    browserEnvironment: {
      url: window.location.href,
      hostname: window.location.hostname,
      origin: window.location.origin,
      userAgent: navigator.userAgent,
      buildVersion: getEnv().appVersion,
      environment: getEnv(),
      cachedConfiguration: browserCache,
    },
    razorpaySdk: scriptState,
    staleFrontendSignals: {
      serviceWorkerCachingDetected: Boolean(browserCache.serviceWorkers?.length),
      cacheStorageDetected: Boolean(browserCache.cacheKeys?.length),
      localStoragePaymentConfigurationDetected: Boolean(
        Object.keys(browserCache.localStoragePaymentConfiguration || {}).length
      ),
    },
  };

  persistReport(report);
  return report;
}

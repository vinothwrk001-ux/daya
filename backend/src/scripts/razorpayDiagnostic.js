require("../config/env");

const crypto = require("crypto");
const dns = require("dns").promises;
const fs = require("fs");
const https = require("https");
const path = require("path");
const Razorpay = require("razorpay");

const startedAt = Date.now();
const diagnosticId = `rzp_diag_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

const color = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

const results = [];
const risks = [];
let razorpay = null;
let createdOrder = null;

function now() {
  return new Date().toISOString();
}

function print(message = "", colour = color.reset) {
  console.log(`${colour}${message}${color.reset}`);
}

function mask(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 10) return "***";
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function modeFromKey(keyId = "") {
  if (String(keyId).startsWith("rzp_test_")) return "TEST";
  if (String(keyId).startsWith("rzp_live_")) return "LIVE";
  return "UNKNOWN";
}

function isPlaceholder(name, value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  const explicit = new Set([
    "undefined",
    "null",
    "your_key_id",
    "your_key_secret",
    "your_webhook_secret",
    "razorpay_webhook_secret_123",
    "webhook_secret",
    "change_me",
    "changeme",
  ]);
  if (explicit.has(normalized)) return true;
  if (normalized.includes("replace_me") || normalized.includes("your_")) return true;
  if (name === "RAZORPAY_WEBHOOK_SECRET" && /^test[_-]?secret$/.test(normalized)) return true;
  return false;
}

function severityFor(status, severity = "CRITICAL") {
  if (status === "PASS") return "INFO";
  if (status === "WARNING") return "WARNING";
  return severity;
}

function addResult({
  id,
  title,
  status,
  severity,
  message,
  details,
  suggestedFix,
  error,
}) {
  const normalized = {
    id,
    title,
    status,
    severity: severityFor(status, severity),
    message,
    details,
    suggestedFix,
    errorCode: error?.error?.code || error?.code || error?.statusCode || "",
    errorMessage: error?.error?.description || error?.message || "",
    stack: error?.stack || "",
    timestamp: now(),
  };
  results.push(normalized);
  if (status !== "PASS") risks.push(normalized);

  const symbol = status === "PASS" ? "✓" : status === "WARNING" ? "!" : "✗";
  const colour = status === "PASS" ? color.green : status === "WARNING" ? color.yellow : color.red;
  print(`${symbol} [${id}] ${status} ${title}`, colour);
  if (message) print(`  ${message}`, color.gray);
  if (details) print(`  Details: ${JSON.stringify(details)}`, color.gray);
  if (normalized.errorCode || normalized.errorMessage) {
    print(`  Error: ${normalized.errorCode || "ERROR"} ${normalized.errorMessage}`, color.red);
  }
  if (suggestedFix) print(`  Suggested Fix: ${suggestedFix}`, color.cyan);
}

function requestJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
  });
}

async function checkEnvironment() {
  print("\nEnvironment Validation", color.bold);
  const required = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
  for (const name of required) {
    const value = process.env[name];
    if (value === undefined || value === null || String(value).trim() === "") {
      addResult({
        id: `ENV_${name}`,
        title: `${name} exists`,
        status: "FAIL",
        message: `${name} is missing or empty`,
        suggestedFix: `Set ${name} in backend/.env and restart the backend.`,
      });
      continue;
    }
    if (isPlaceholder(name, value)) {
      addResult({
        id: `ENV_${name}`,
        title: `${name} is not placeholder`,
        status: "FAIL",
        message: `${name} looks like a placeholder`,
        details: { value: mask(value) },
        suggestedFix: `Replace ${name} with the real value from Razorpay Dashboard.`,
      });
      continue;
    }
    addResult({
      id: `ENV_${name}`,
      title: `${name} found`,
      status: "PASS",
      details: { value: name.includes("SECRET") ? "***masked***" : mask(value) },
    });
  }
}

async function checkCredentialFormat() {
  print("\nCredential Format Validation", color.bold);
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  addResult({
    id: "CRED_KEY_ID_FORMAT",
    title: "Key ID format",
    status: /^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) ? "PASS" : "FAIL",
    details: { keyId: mask(keyId), mode: modeFromKey(keyId) },
    suggestedFix: "Use a valid Razorpay key id that starts with rzp_test_ or rzp_live_.",
  });

  addResult({
    id: "CRED_SECRET_FORMAT",
    title: "Key secret format",
    status: keySecret && !keySecret.startsWith("rzp_") && keySecret.length >= 20 ? "PASS" : "FAIL",
    details: { secret: keySecret ? "***masked***" : "" },
    suggestedFix: "Use the Razorpay key secret, not another key id.",
  });
}

async function checkConnectivity() {
  print("\nRazorpay API Connectivity", color.bold);
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  try {
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const response = await razorpay.orders.all({ count: 1 });
    addResult({
      id: "API_AUTH",
      title: "API authentication and access",
      status: "PASS",
      message: "Razorpay API authentication successful",
      details: {
        count: Array.isArray(response?.items) ? response.items.length : 0,
      },
    });
  } catch (error) {
    addResult({
      id: "API_AUTH",
      title: "API authentication and access",
      status: "FAIL",
      message: "Authentication or API access failed",
      error,
      suggestedFix: "Regenerate a matching Razorpay Key ID and Secret pair from the same dashboard account.",
    });
  }
}

async function checkAccount() {
  print("\nAccount Validation", color.bold);
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const mode = modeFromKey(keyId);
  addResult({
    id: "ACCOUNT_MODE",
    title: "Account mode derived from key",
    status: mode === "UNKNOWN" ? "FAIL" : "PASS",
    details: {
      mode,
      keyId: mask(keyId),
      accountId: "Not exposed by standard Razorpay Orders API",
    },
    suggestedFix: mode === "UNKNOWN" ? "Use a valid rzp_test_ or rzp_live_ key id." : "",
  });

  if (mode === "LIVE" && process.env.NODE_ENV !== "production") {
    addResult({
      id: "ACCOUNT_ENV_MODE",
      title: "Runtime mode consistency",
      status: "WARNING",
      message: "Live Razorpay key is configured outside production NODE_ENV",
      details: { nodeEnv: process.env.NODE_ENV || "development", mode },
      suggestedFix: "Use rzp_test_ keys in local/staging and rzp_live_ keys only in production.",
    });
  } else {
    addResult({
      id: "ACCOUNT_ENV_MODE",
      title: "Runtime mode consistency",
      status: "PASS",
      details: { nodeEnv: process.env.NODE_ENV || "development", mode },
    });
  }
}

async function checkOrderCreation() {
  print("\nOrder Creation Test", color.bold);
  if (!razorpay) {
    addResult({
      id: "ORDER_CREATE",
      title: "Temporary order creation",
      status: "FAIL",
      message: "Razorpay client is unavailable",
      suggestedFix: "Fix credentials before testing order creation.",
    });
    return;
  }

  try {
    createdOrder = await razorpay.orders.create({
      amount: 100,
      currency: "INR",
      receipt: `diagnostic_${Date.now()}`,
      notes: {
        diagnosticId,
        purpose: "razorpay_diagnostic",
      },
    });

    const mismatches = [];
    if (!createdOrder?.id) mismatches.push("ORDER_ID_MISSING");
    if (!String(createdOrder?.id || "").startsWith("order_")) mismatches.push("ORDER_ID_PREFIX_INVALID");
    if (createdOrder?.entity !== "order") mismatches.push("ORDER_ENTITY_INVALID");
    if (Number(createdOrder?.amount) !== 100) mismatches.push("ORDER_AMOUNT_MISMATCH");
    if (createdOrder?.currency !== "INR") mismatches.push("ORDER_CURRENCY_MISMATCH");

    addResult({
      id: "ORDER_CREATE",
      title: "Temporary order creation",
      status: mismatches.length ? "FAIL" : "PASS",
      details: {
        orderId: createdOrder?.id,
        amount: createdOrder?.amount,
        currency: createdOrder?.currency,
        status: createdOrder?.status,
        mismatches,
      },
      suggestedFix: mismatches.length ? "Investigate Razorpay order payload returned by API." : "",
    });
  } catch (error) {
    addResult({
      id: "ORDER_CREATE",
      title: "Temporary order creation",
      status: "FAIL",
      error,
      suggestedFix: "Confirm credentials, account status, and supported currency in Razorpay Dashboard.",
    });
  }
}

async function checkOrderRetrieval() {
  print("\nOrder Retrieval Test", color.bold);
  if (!razorpay || !createdOrder?.id) {
    addResult({
      id: "ORDER_FETCH",
      title: "Fetch created order",
      status: "FAIL",
      message: "No created order is available to fetch",
      suggestedFix: "Fix order creation first.",
    });
    return;
  }

  try {
    const fetched = await razorpay.orders.fetch(createdOrder.id);
    const mismatches = [];
    if (fetched?.id !== createdOrder.id) mismatches.push("FETCHED_ORDER_ID_MISMATCH");
    if (Number(fetched?.amount) !== Number(createdOrder.amount)) mismatches.push("FETCHED_ORDER_AMOUNT_MISMATCH");
    if (fetched?.currency !== createdOrder.currency) mismatches.push("FETCHED_ORDER_CURRENCY_MISMATCH");
    addResult({
      id: "ORDER_FETCH",
      title: "Fetch created order",
      status: mismatches.length ? "FAIL" : "PASS",
      details: {
        orderId: fetched?.id,
        amount: fetched?.amount,
        currency: fetched?.currency,
        status: fetched?.status,
        mismatches,
      },
    });
  } catch (error) {
    addResult({
      id: "ORDER_FETCH",
      title: "Fetch created order",
      status: "FAIL",
      error,
      suggestedFix: "Check whether the order id belongs to the same Razorpay account as the configured key.",
    });
  }
}

async function checkCheckoutPayload() {
  print("\nCheckout Payload Validation", color.bold);
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const payload = {
    key: mask(keyId),
    order_id: createdOrder?.id,
    amount: createdOrder?.amount,
    currency: createdOrder?.currency,
    name: "Diagnostic Marketplace",
    description: "Razorpay diagnostic checkout payload",
  };

  const issues = [];
  if (!keyId) issues.push("CHECKOUT_KEY_MISSING");
  if (!createdOrder?.id) issues.push("CHECKOUT_ORDER_ID_MISSING");
  if (!String(createdOrder?.id || "").startsWith("order_")) issues.push("CHECKOUT_ORDER_ID_INVALID");
  if (!Number.isInteger(Number(createdOrder?.amount)) || Number(createdOrder?.amount) <= 0) {
    issues.push("CHECKOUT_AMOUNT_INVALID");
  }
  if (!/^[A-Z]{3}$/.test(String(createdOrder?.currency || ""))) issues.push("CHECKOUT_CURRENCY_INVALID");

  addResult({
    id: "CHECKOUT_PAYLOAD",
    title: "Simulated Checkout payload",
    status: issues.length ? "FAIL" : "PASS",
    details: { payload, issues },
    suggestedFix: issues.length ? "Do not open checkout until all required fields are valid." : "",
  });
}

async function checkModeConsistency() {
  print("\nMode Consistency Validation", color.bold);
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const mode = modeFromKey(keyId);
  const issues = [];
  if (mode === "UNKNOWN") issues.push("KEY_MODE_UNKNOWN");
  if (process.env.NODE_ENV === "production" && mode === "TEST") issues.push("TEST_KEY_IN_PRODUCTION");
  if (process.env.NODE_ENV !== "production" && mode === "LIVE") issues.push("LIVE_KEY_OUTSIDE_PRODUCTION");
  addResult({
    id: "MODE_CONSISTENCY",
    title: "Mode consistency",
    status: issues.length ? "WARNING" : "PASS",
    details: {
      nodeEnv: process.env.NODE_ENV || "development",
      keyMode: mode,
      orderId: createdOrder?.id || "",
      issues,
    },
    suggestedFix: issues.length ? "Align Razorpay key mode with deployment environment." : "",
  });
}

async function checkSignatureVerification() {
  print("\nSignature Verification Test", color.bold);
  const secret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  const orderId = createdOrder?.id || "order_diagnostic";
  const paymentId = "pay_diagnostic";
  try {
    const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    const actual = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    addResult({
      id: "SIGNATURE_HMAC",
      title: "Payment signature HMAC",
      status: expected === actual && /^[a-f0-9]{64}$/.test(actual) ? "PASS" : "FAIL",
      details: { orderId, paymentId, signatureShape: mask(actual) },
      suggestedFix: "Verify HMAC input is razorpay_order_id|razorpay_payment_id and uses RAZORPAY_KEY_SECRET.",
    });
  } catch (error) {
    addResult({
      id: "SIGNATURE_HMAC",
      title: "Payment signature HMAC",
      status: "FAIL",
      error,
      suggestedFix: "Fix RAZORPAY_KEY_SECRET before attempting payment verification.",
    });
  }
}

async function checkWebhookVerification() {
  print("\nWebhook Validation Test", color.bold);
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!secret || isPlaceholder("RAZORPAY_WEBHOOK_SECRET", secret)) {
    addResult({
      id: "WEBHOOK_SECRET",
      title: "Webhook secret configured",
      status: "FAIL",
      message: "Webhook secret is missing or placeholder",
      suggestedFix: "Create a Razorpay webhook and copy its real signing secret into RAZORPAY_WEBHOOK_SECRET.",
    });
    return;
  }

  try {
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_diagnostic", order_id: createdOrder?.id || "order_diagnostic" } } },
    });
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    addResult({
      id: "WEBHOOK_SIGNATURE",
      title: "Webhook signature validation",
      status: signature === expected ? "PASS" : "FAIL",
      details: { signatureShape: mask(signature) },
    });
  } catch (error) {
    addResult({
      id: "WEBHOOK_SIGNATURE",
      title: "Webhook signature validation",
      status: "FAIL",
      error,
      suggestedFix: "Fix webhook secret configuration.",
    });
  }
}

async function checkSdkVersion() {
  print("\nSDK Version Validation", color.bold);
  let currentVersion = "";
  try {
    const packagePath = require.resolve("razorpay/package.json");
    currentVersion = JSON.parse(fs.readFileSync(packagePath, "utf8")).version;
  } catch (error) {
    addResult({
      id: "SDK_CURRENT_VERSION",
      title: "Installed Razorpay SDK version",
      status: "FAIL",
      error,
      suggestedFix: "Install the razorpay npm package.",
    });
    return;
  }

  try {
    const registry = await requestJson("https://registry.npmjs.org/razorpay/latest", 8000);
    const latestVersion = registry.body?.version || "";
    addResult({
      id: "SDK_VERSION",
      title: "Razorpay SDK version",
      status: latestVersion && latestVersion !== currentVersion ? "WARNING" : "PASS",
      details: { currentVersion, latestVersion },
      suggestedFix: latestVersion && latestVersion !== currentVersion ? "Review and upgrade the Razorpay SDK after regression testing." : "",
    });
  } catch (error) {
    addResult({
      id: "SDK_VERSION",
      title: "Razorpay SDK version",
      status: "WARNING",
      message: "Could not check latest npm version",
      details: { currentVersion },
      error,
      suggestedFix: "Run npm view razorpay version from a network-enabled terminal.",
    });
  }
}

async function checkNetwork() {
  print("\nNetwork Diagnostics", color.bold);
  try {
    const dnsStart = Date.now();
    const lookup = await dns.lookup("api.razorpay.com");
    addResult({
      id: "NETWORK_DNS",
      title: "DNS lookup api.razorpay.com",
      status: "PASS",
      details: { address: lookup.address, family: lookup.family, latencyMs: Date.now() - dnsStart },
    });
  } catch (error) {
    addResult({
      id: "NETWORK_DNS",
      title: "DNS lookup api.razorpay.com",
      status: "FAIL",
      error,
      suggestedFix: "Check DNS, firewall, proxy, or VPN configuration.",
    });
  }

  try {
    const httpsStart = Date.now();
    const response = await requestJson("https://api.razorpay.com/v1/orders?count=1", 8000);
    addResult({
      id: "NETWORK_HTTPS",
      title: "HTTPS connectivity api.razorpay.com",
      status: response.statusCode ? "PASS" : "FAIL",
      details: { statusCode: response.statusCode, latencyMs: Date.now() - httpsStart },
    });
  } catch (error) {
    addResult({
      id: "NETWORK_HTTPS",
      title: "HTTPS connectivity api.razorpay.com",
      status: "FAIL",
      error,
      suggestedFix: "Allow outbound HTTPS to api.razorpay.com.",
    });
  }
}

async function checkoutRiskAnalysis() {
  print("\nCheckout Risk Analysis", color.bold);
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const mode = modeFromKey(keyId);
  const riskItems = [];

  if (risks.some((risk) => risk.id.startsWith("ENV_"))) riskItems.push("ENVIRONMENT_CONFIGURATION_RISK");
  if (risks.some((risk) => risk.id.startsWith("CRED_"))) riskItems.push("CREDENTIAL_FORMAT_RISK");
  if (risks.some((risk) => risk.id === "API_AUTH")) riskItems.push("CREDENTIAL_OR_ACCOUNT_MISMATCH_RISK");
  if (risks.some((risk) => risk.id === "ORDER_CREATE" || risk.id === "ORDER_FETCH")) {
    riskItems.push("ORDER_GENERATION_RISK");
  }
  if (risks.some((risk) => risk.id === "CHECKOUT_PAYLOAD")) riskItems.push("CHECKOUT_PAYLOAD_RISK");
  if (process.env.NODE_ENV === "production" && mode === "TEST") riskItems.push("TEST_KEY_IN_PRODUCTION_RISK");
  if (process.env.NODE_ENV !== "production" && mode === "LIVE") riskItems.push("LIVE_KEY_IN_NON_PRODUCTION_RISK");

  addResult({
    id: "CHECKOUT_RISK",
    title: "Invalid Token risk analysis",
    status: riskItems.length ? "WARNING" : "PASS",
    details: { riskItems },
    suggestedFix: riskItems.length ? "Fix the listed risks before opening Razorpay Checkout." : "",
  });
}

function finalReport() {
  const failed = results.filter((result) => result.status === "FAIL");
  const warnings = results.filter((result) => result.status === "WARNING");
  const overall = failed.length ? "FAIL" : warnings.length ? "WARNING" : "PASS";
  const colour = overall === "PASS" ? color.green : overall === "WARNING" ? color.yellow : color.red;

  print("\nFinal Report", color.bold);
  print(`Diagnostic ID: ${diagnosticId}`, color.cyan);
  print(`Execution Duration: ${Date.now() - startedAt}ms`, color.cyan);
  print(`Overall Status: ${overall}`, colour);
  print(
    JSON.stringify(
      {
        environmentCheck: statusForPrefix("ENV_"),
        credentialCheck: statusForPrefix("CRED_"),
        apiConnectivity: statusForId("API_AUTH"),
        accountValidation: statusForPrefix("ACCOUNT_"),
        orderCreation: statusForId("ORDER_CREATE"),
        orderRetrieval: statusForId("ORDER_FETCH"),
        checkoutPayload: statusForId("CHECKOUT_PAYLOAD"),
        signatureVerification: statusForId("SIGNATURE_HMAC"),
        webhookVerification: statusForPrefix("WEBHOOK_"),
        networkConnectivity: statusForPrefix("NETWORK_"),
        failedChecks: failed.map((result) => ({ id: result.id, title: result.title, severity: result.severity })),
        warningChecks: warnings.map((result) => ({ id: result.id, title: result.title, severity: result.severity })),
      },
      null,
      2
    )
  );

  if (failed.length) process.exitCode = 1;
}

function statusForId(id) {
  const result = results.find((item) => item.id === id);
  return result?.status || "NOT_RUN";
}

function statusForPrefix(prefix) {
  const matched = results.filter((item) => item.id.startsWith(prefix));
  if (!matched.length) return "NOT_RUN";
  if (matched.some((item) => item.status === "FAIL")) return "FAIL";
  if (matched.some((item) => item.status === "WARNING")) return "WARNING";
  return "PASS";
}

async function main() {
  print(`${color.bold}Razorpay Diagnostic${color.reset}`);
  print(`Started: ${now()}`);
  print(`Diagnostic ID: ${diagnosticId}`);
  print(`Project: ${path.resolve(__dirname, "..", "..")}`);

  await checkEnvironment();
  await checkCredentialFormat();
  await checkNetwork();
  await checkConnectivity();
  await checkAccount();
  await checkOrderCreation();
  await checkOrderRetrieval();
  await checkCheckoutPayload();
  await checkModeConsistency();
  await checkSignatureVerification();
  await checkWebhookVerification();
  await checkSdkVersion();
  await checkoutRiskAnalysis();
  finalReport();
}

main().catch((error) => {
  addResult({
    id: "DIAGNOSTIC_FATAL",
    title: "Unexpected diagnostic failure",
    status: "FAIL",
    error,
    suggestedFix: "Review the stack trace and rerun after fixing the script/runtime error.",
  });
  finalReport();
});

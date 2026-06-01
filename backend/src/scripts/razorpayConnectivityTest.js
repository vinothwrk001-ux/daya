const { logger } = require("../utils/logger");
require("../config/env");

const Razorpay = require("razorpay");

function mask(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 10) return "***";
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function modeFromKey(keyId = "") {
  if (String(keyId).startsWith("rzp_test_")) return "test";
  if (String(keyId).startsWith("rzp_live_")) return "live";
  return "unknown";
}

function validateEnv() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  const currency = String(process.env.RAZORPAY_TEST_CURRENCY || "INR").trim().toUpperCase();
  const amount = Number(process.env.RAZORPAY_TEST_AMOUNT || 100);

  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    throw new Error("RAZORPAY_KEY_ID is missing or malformed");
  }
  if (!keySecret || keySecret.startsWith("rzp_") || keySecret.length < 20) {
    throw new Error("RAZORPAY_KEY_SECRET is missing or malformed");
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("RAZORPAY_TEST_CURRENCY must be a 3-letter currency code");
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("RAZORPAY_TEST_AMOUNT must be a positive integer in paise");
  }

  return { keyId, keySecret, currency, amount, mode: modeFromKey(keyId) };
}

async function main() {
  const startedAt = Date.now();
  const config = validateEnv();
  const razorpay = new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });

  const diagnostics = {
    environment: process.env.NODE_ENV || "development",
    accountMode: config.mode,
    keyId: mask(config.keyId),
    checkoutKey: mask(config.keyId),
    currency: config.currency,
    amount: config.amount,
    checkoutJsUrl: "https://checkout.razorpay.com/v1/checkout.js",
    credentialsAuthenticated: false,
    orderCreated: false,
    orderId: "",
    checkoutOrderId: "",
    mismatches: [],
  };

  const order = await razorpay.orders.create({
    amount: config.amount,
    currency: config.currency,
    receipt: `audit_${Date.now()}`,
    notes: {
      purpose: "razorpay_connectivity_audit",
      environment: diagnostics.environment,
    },
  });

  diagnostics.credentialsAuthenticated = true;
  diagnostics.orderCreated = Boolean(order?.id);
  diagnostics.orderId = order?.id || "";
  diagnostics.checkoutOrderId = order?.id || "";
  diagnostics.orderEntity = order?.entity || "";
  diagnostics.orderStatus = order?.status || "";
  diagnostics.orderAmount = order?.amount;
  diagnostics.orderCurrency = order?.currency;
  diagnostics.latencyMs = Date.now() - startedAt;

  if (!String(order?.id || "").startsWith("order_")) diagnostics.mismatches.push("ORDER_ID_PREFIX_INVALID");
  if (order?.entity !== "order") diagnostics.mismatches.push("ORDER_ENTITY_INVALID");
  if (Number(order?.amount) !== config.amount) diagnostics.mismatches.push("ORDER_AMOUNT_MISMATCH");
  if (String(order?.currency || "").toUpperCase() !== config.currency) {
    diagnostics.mismatches.push("ORDER_CURRENCY_MISMATCH");
  }
  if (String(order?.status || "").toLowerCase() !== "created") diagnostics.mismatches.push("ORDER_STATUS_NOT_CREATED");

  diagnostics.checkoutPayload = {
    key: diagnostics.checkoutKey,
    order_id: diagnostics.checkoutOrderId,
    amount: diagnostics.orderAmount,
    currency: diagnostics.orderCurrency,
  };

  diagnostics.verificationResult = diagnostics.mismatches.length ? "FAILED" : "PASSED";

  logger.info("script_output", { value: JSON.stringify(diagnostics, null, 2) });

  if (diagnostics.mismatches.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  logger.error("Razorpay connectivity test failed", {
    source: "razorpayConnectivityTest",
    verificationResult: "FAILED",
    message: error?.error?.description || error.message,
    code: error?.error?.code || error.code || "RAZORPAY_CONNECTIVITY_TEST_FAILED",
    reason: error?.error?.reason,
    field: error?.error?.field,
  });
  process.exit(1);
});

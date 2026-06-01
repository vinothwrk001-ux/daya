const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const logisticsService = require("../logistics.service");
const { WebhookEvent } = require("../../models/WebhookEvent");

test("webhook event schema tracks idempotency and payload integrity fields", () => {
  assert.ok(WebhookEvent.schema.path("eventId"));
  assert.ok(WebhookEvent.schema.path("providerEventId"));
  assert.ok(WebhookEvent.schema.path("payloadHash"));
  assert.ok(WebhookEvent.schema.path("processedAt"));
});

test("shiprocket webhook signature uses hmac verification", () => {
  const previousSecret = process.env.SHIPROCKET_WEBHOOK_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.SHIPROCKET_WEBHOOK_SECRET = "shiprocket_test_secret";
  process.env.NODE_ENV = "production";
  const body = JSON.stringify({ awb: "AWB1", current_status: "Delivered" });
  const signature = crypto.createHmac("sha256", process.env.SHIPROCKET_WEBHOOK_SECRET).update(body).digest("hex");
  assert.equal(logisticsService.verifyWebhookSignature(body, signature), true);
  assert.throws(() => logisticsService.verifyWebhookSignature(body, "bad"), /Invalid logistics webhook signature/);
  if (previousSecret === undefined) delete process.env.SHIPROCKET_WEBHOOK_SECRET;
  else process.env.SHIPROCKET_WEBHOOK_SECRET = previousSecret;
  process.env.NODE_ENV = previousNodeEnv;
});

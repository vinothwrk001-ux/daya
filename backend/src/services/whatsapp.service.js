const twilio = require("twilio");
const { logger } = require("../utils/logger");

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").trim();
}

function formatWhatsAppRecipient(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";

  const countryCode = getDefaultCountryCode();

  if (normalized.length === 10) {
    return `whatsapp:+${countryCode}${normalized}`;
  }

  if (normalized.startsWith(countryCode) && normalized.length === countryCode.length + 10) {
    return `whatsapp:+${normalized}`;
  }

  return `whatsapp:+${normalized}`;
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured");
  }

  return twilio(accountSid, authToken);
}

function getWhatsAppFromNumber() {
  const raw = String(process.env.TWILIO_WHATSAPP_NUMBER || "").trim();
  if (!raw) {
    throw new Error("TWILIO_WHATSAPP_NUMBER is not configured");
  }
  if (raw.startsWith("whatsapp:")) {
    return raw;
  }
  if (raw.startsWith("+")) {
    return `whatsapp:${raw}`;
  }
  return `whatsapp:+${raw}`;
}

function getDefaultCountryCode() {
  const raw = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91").replace(/\D/g, "");
  return raw || "91";
}

function shouldUsePlainWhatsAppBody() {
  return (
    process.env.TWILIO_WHATSAPP_SANDBOX === "true" ||
    process.env.WHATSAPP_USE_PLAIN_BODY === "true"
  );
}

function getStoreName() {
  return String(process.env.WHATSAPP_STORE_NAME || process.env.APP_NAME || "our store").trim();
}

function formatDeliveryDate(value) {
  if (!value) return "To be confirmed";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildShipmentMessageBody({
  customerName,
  orderNumber,
  courierName,
  trackingNumber,
  trackingUrl,
  expectedDeliveryDate,
} = {}) {
  const storeName = getStoreName();
  return [
    `Hello ${customerName || "Customer"}`,
    "",
    "Good news.",
    "",
    "Your order has been shipped.",
    "",
    "Order Number:",
    orderNumber || "-",
    "",
    "Courier:",
    courierName || "-",
    "",
    "Tracking Number:",
    trackingNumber || "-",
    "",
    "Track Shipment:",
    trackingUrl || "-",
    "",
    "Expected Delivery:",
    formatDeliveryDate(expectedDeliveryDate),
    "",
    `Thank you for shopping with us.`,
    storeName !== "our store" ? storeName : "",
  ]
    .filter((line, index, arr) => !(line === "" && arr[index + 1] === ""))
    .join("\n")
    .trim();
}

function buildDeliveredMessageBody({ customerName, orderNumber } = {}) {
  const storeName = getStoreName();
  return [
    `Hello ${customerName || "Customer"}`,
    "",
    "Your order has been delivered.",
    "",
    "Order Number:",
    orderNumber || "-",
    "",
    `Thank you for shopping with ${storeName}.`,
  ].join("\n");
}

function buildOrderConfirmationMessageBody({ customerName, orderNumber, totalAmount, currency = "INR" } = {}) {
  const storeName = getStoreName();
  const amountLabel =
    totalAmount != null ? `${currency} ${Number(totalAmount).toFixed(2)}` : "See order details";
  return [
    `Hello ${customerName || "Customer"}`,
    "",
    "Thank you for your order.",
    "",
    "Order Number:",
    orderNumber || "-",
    "",
    "Order Total:",
    amountLabel,
    "",
    `We will notify you when your order ships.`,
    "",
    `Thank you for shopping with ${storeName}.`,
  ].join("\n");
}

async function sendWhatsAppMessage(phone, message) {
  if (!phone) return null;

  const from = getWhatsAppFromNumber();
  const to = formatWhatsAppRecipient(phone);
  if (!to) {
    throw new Error("Recipient phone number is invalid");
  }

  const client = getTwilioClient();
  logger.info("Sending WhatsApp message", { from, to });
  return await client.messages.create({
    from,
    to,
    body: String(message || "").trim(),
  });
}

async function sendWhatsAppTemplateMessage(phone, { contentSid, contentVariables = {} } = {}) {
  if (!phone) return null;

  const from = getWhatsAppFromNumber();
  if (!contentSid) {
    throw new Error("Twilio contentSid is required for template WhatsApp messages");
  }

  const to = formatWhatsAppRecipient(phone);
  if (!to) {
    throw new Error("Recipient phone number is invalid");
  }

  const client = getTwilioClient();
  return await client.messages.create({
    from,
    to,
    contentSid,
    contentVariables: JSON.stringify(contentVariables),
  });
}

async function sendWithTemplateFallback(phone, { contentSid, contentVariables, fallbackBody }) {
  const effectiveContentSid = shouldUsePlainWhatsAppBody() ? "" : contentSid;

  if (effectiveContentSid) {
    try {
      return await sendWhatsAppTemplateMessage(phone, { contentSid: effectiveContentSid, contentVariables });
    } catch (error) {
      if (fallbackBody) {
        logger.warn("Twilio template send failed, falling back to plain WhatsApp body", {
          error: error.message,
          code: error.code,
          contentSid: effectiveContentSid,
          to: formatWhatsAppRecipient(phone),
        });
        return await sendWhatsAppMessage(phone, fallbackBody);
      }
      throw error;
    }
  }

  return await sendWhatsAppMessage(phone, fallbackBody);
}

async function sendShipmentNotification(phone, payload = {}) {
  const fallbackBody =
    payload.fallbackBody ||
    buildShipmentMessageBody({
      customerName: payload.customerName,
      orderNumber: payload.orderNumber,
      courierName: payload.courierName,
      trackingNumber: payload.trackingNumber,
      trackingUrl: payload.trackingUrl,
      expectedDeliveryDate: payload.expectedDeliveryDate,
    });

  const contentSid = payload.contentSid || process.env.TWILIO_ORDER_SHIPPED_CONTENT_SID;
  const contentVariables =
    payload.contentVariables ||
    (contentSid
      ? {
          1: payload.orderNumber || "",
          2: payload.trackingNumber || "",
          3: payload.trackingUrl || "",
          4: payload.courierName || "",
          5: formatDeliveryDate(payload.expectedDeliveryDate),
        }
      : {});

  return await sendWithTemplateFallback(phone, {
    contentSid,
    contentVariables,
    fallbackBody,
  });
}

async function sendDeliveredNotification(phone, payload = {}) {
  const fallbackBody =
    payload.fallbackBody ||
    buildDeliveredMessageBody({
      customerName: payload.customerName,
      orderNumber: payload.orderNumber,
    });

  const contentSid = payload.contentSid || process.env.TWILIO_ORDER_DELIVERED_CONTENT_SID;
  const contentVariables =
    payload.contentVariables ||
    (contentSid
      ? {
          1: payload.orderNumber || "",
        }
      : {});

  return await sendWithTemplateFallback(phone, {
    contentSid,
    contentVariables,
    fallbackBody,
  });
}

async function sendOrderConfirmation(phone, payload = {}) {
  const fallbackBody =
    payload.fallbackBody ||
    buildOrderConfirmationMessageBody({
      customerName: payload.customerName,
      orderNumber: payload.orderNumber,
      totalAmount: payload.totalAmount,
      currency: payload.currency,
    });

  const contentSid = payload.contentSid || process.env.TWILIO_ORDER_CONFIRMATION_CONTENT_SID;
  const contentVariables =
    payload.contentVariables ||
    (contentSid
      ? {
          1: payload.orderNumber || "",
          2: payload.totalAmount != null ? String(payload.totalAmount) : "",
        }
      : {});

  return await sendWithTemplateFallback(phone, {
    contentSid,
    contentVariables,
    fallbackBody,
  });
}

function verifyTwilioWebhookSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("TWILIO_AUTH_TOKEN is not configured");
  }

  const signature = req.get("X-Twilio-Signature");
  if (!signature) {
    return false;
  }

  const protocol = req.get("X-Forwarded-Proto") || req.protocol || "https";
  const host = req.get("X-Forwarded-Host") || req.get("host");
  const url = `${protocol}://${host}${req.originalUrl}`;

  return twilio.validateRequest(authToken, signature, url, req.body || {});
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppTemplateMessage,
  sendShipmentNotification,
  sendDeliveredNotification,
  sendOrderConfirmation,
  buildShipmentMessageBody,
  buildDeliveredMessageBody,
  buildOrderConfirmationMessageBody,
  formatWhatsAppRecipient,
  verifyTwilioWebhookSignature,
  getStoreName,
  getWhatsAppFromNumber,
  shouldUsePlainWhatsAppBody,
};

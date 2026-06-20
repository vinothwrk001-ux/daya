const axios = require("axios");
const { AppError } = require("../utils/AppError");
const crypto = require("crypto");

class LogisticsService {
  constructor() {
    this.cachedToken = null;
    this.cachedTokenExpiresAt = 0;
  }

  get providerName() {
    return (process.env.LOGISTICS_PROVIDER || "SHIPROCKET").trim().toUpperCase();
  }

  isConfigured() {
    if (this.providerName !== "SHIPROCKET") return false;
    return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
  }

  async getShiprocketToken() {
    if (!this.isConfigured()) {
      throw new AppError(
        "Platform shipping is not configured. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in backend/.env.",
        503,
        "LOGISTICS_NOT_CONFIGURED"
      );
    }

    const now = Date.now();
    if (this.cachedToken && this.cachedTokenExpiresAt > now + 60_000) {
      return this.cachedToken;
    }

    const response = await axios.post("https://apiv2.shiprocket.in/v1/external/auth/login", {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });

    const token = response?.data?.token;
    if (!token) {
      throw new AppError("Failed to authenticate logistics provider", 502, "LOGISTICS_AUTH_FAILED");
    }

    this.cachedToken = token;
    this.cachedTokenExpiresAt = now + 8 * 60 * 60 * 1000;
    return token;
  }

  verifyWebhookSignature(rawBody, signature) {
    const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        throw new AppError("Logistics webhook secret is not configured", 500, "WEBHOOK_NOT_CONFIGURED");
      }
      return true;
    }
    if (!signature) {
      throw new AppError("Missing logistics webhook signature", 400, "INVALID_SIGNATURE");
    }

    const expected = crypto.createHmac("sha256", secret).update(String(rawBody || "")).digest("hex");
    const left = Buffer.from(String(expected));
    const right = Buffer.from(String(signature));
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw new AppError("Invalid logistics webhook signature", 400, "INVALID_SIGNATURE");
    }

    return true;
  }

  async createPlatformShipment(requestPayload) {
    if (this.providerName !== "SHIPROCKET") {
      throw new AppError("Unsupported logistics provider", 503, "LOGISTICS_PROVIDER_UNSUPPORTED");
    }

    const token = await this.getShiprocketToken();
    const headers = { Authorization: `Bearer ${token}` };
    const providerPayload = requestPayload?.providerPayload || requestPayload || {};

    const createOrderResponse = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
      providerPayload,
      { headers }
    );

    const orderData = createOrderResponse?.data || {};
    const shipmentId = orderData?.shipment_id || orderData?.shipment_details?.shipment_id || null;
    if (!shipmentId) {
      throw new AppError("Logistics provider did not return a shipment id", 502, "SHIPMENT_CREATE_FAILED");
    }

    return {
      provider: "SHIPROCKET",
      shipmentId: String(shipmentId),
      trackingId: orderData?.awb_code || orderData?.awb || "",
      courierName: orderData?.courier_name || "",
      trackingUrl: orderData?.tracking_url || "",
      raw: {
        request: requestPayload,
        createOrder: orderData,
      },
    };
  }
}

module.exports = new LogisticsService();

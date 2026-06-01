const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const paymentRepo = require("../repositories/payment.repository");
const refundRepo = require("../repositories/refund.repository");
const webhookEventRepo = require("../repositories/webhook-event.repository");
const orderRepo = require("../repositories/order.repository");
const paymentService = require("./payment.service");
const payoutService = require("./payout.service");
const { applyShippingLifecycle } = require("./shipping.service");
const logisticsService = require("./logistics.service");
const { logger } = require("../utils/logger");
const { PaymentSession } = require("../models/PaymentSession");

function buildEventId(provider, eventType, rawBody) {
  return `${provider}:${eventType}:${crypto.createHash("sha1").update(String(rawBody || "")).digest("hex")}`;
}

function payloadHash(rawBody) {
  return crypto.createHash("sha256").update(String(rawBody || "")).digest("hex");
}

function assertFreshRazorpayEvent(event) {
  const maxAgeSeconds = Number(process.env.RAZORPAY_WEBHOOK_MAX_AGE_SECONDS || 10 * 60);
  const createdAt = Number(event?.created_at || event?.payload?.payment?.entity?.created_at || 0);
  if (!createdAt) return;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - createdAt);
  if (ageSeconds > maxAgeSeconds) {
    throw new AppError("Stale Razorpay webhook event", 400, "STALE_WEBHOOK_EVENT");
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function recordInvalidWebhook(rawBody, signature, message) {
  const eventId = buildEventId("RAZORPAY", "signature.invalid", rawBody);
  try {
    const existing = await webhookEventRepo.findByEventId(eventId);
    if (existing) return;
    await webhookEventRepo.create({
      provider: "RAZORPAY",
      eventType: "signature.invalid",
      eventId,
      signatureVerified: false,
      status: "FAILED",
      payload: {
        hasSignature: Boolean(signature),
        rawBodySha256: payloadHash(rawBody),
      },
      errorMessage: message,
    });
  } catch (error) {
    logger.warn("Unable to record invalid Razorpay webhook", { message: error.message });
  }
}

class WebhookService {
  async handleRazorpayWebhook(rawBody, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new AppError("Razorpay webhook secret is not configured", 500, "WEBHOOK_NOT_CONFIGURED");
    }
    if (!rawBody || !signature) {
      await recordInvalidWebhook(rawBody, signature, "Missing Razorpay webhook signature or body");
      throw new AppError("Missing Razorpay webhook signature", 400, "INVALID_SIGNATURE");
    }
    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    if (!safeEqual(expectedSignature, signature)) {
      await recordInvalidWebhook(rawBody, signature, "Invalid Razorpay webhook signature");
      throw new AppError("Invalid signature", 400, "INVALID_SIGNATURE");
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      throw new AppError("Invalid Razorpay webhook payload", 400, "INVALID_WEBHOOK_PAYLOAD");
    }
    const eventType = event.event;
    assertFreshRazorpayEvent(event);
    const eventId = event.id ? `RAZORPAY:${event.id}` : buildEventId("RAZORPAY", eventType, rawBody);
    const hash = payloadHash(rawBody);
    const existing = await webhookEventRepo.findByEventId(eventId);
    if (existing) {
      return { status: "duplicate_ignored", eventId };
    }

    const webhookRecord = await webhookEventRepo.create({
      provider: "RAZORPAY",
      eventType,
      eventId,
      providerEventId: event.id || "",
      payloadHash: hash,
      receivedAt: new Date(),
      signatureVerified: true,
      status: "RECEIVED",
      payload: event,
    });

    try {
      if (eventType === "payment.captured") {
        const paymentEntity = event.payload?.payment?.entity;
        const payment = await paymentRepo.findByRazorpayOrderId(paymentEntity?.order_id);
        if (payment) {
          const session = payment.paymentSessionId?._id
            ? payment.paymentSessionId
            : payment.paymentSessionId
              ? await PaymentSession.findById(payment.paymentSessionId)
              : await PaymentSession.findOne({ razorpayOrderId: paymentEntity?.order_id });
          const expectedAmount = Math.round(Number(session?.amount || payment.amount || 0) * 100);
          if (String(paymentEntity?.status || "").toLowerCase() !== "captured") {
            throw new AppError("Webhook payment is not captured", 409, "PAYMENT_NOT_CAPTURED");
          }
          if (Number(paymentEntity?.amount) !== expectedAmount) {
            await paymentRepo.updateById(payment._id, {
              $inc: { "fraudChecks.duplicateAttemptCount": 1 },
              $addToSet: { "fraudChecks.flaggedReasons": "WEBHOOK_AMOUNT_MISMATCH" },
            });
            throw new AppError("Webhook payment amount mismatch", 409, "PAYMENT_AMOUNT_MISMATCH");
          }
          if (String(paymentEntity?.currency || "").toUpperCase() !== String(session?.currency || payment.currency || "INR").toUpperCase()) {
            await paymentRepo.updateById(payment._id, {
              $inc: { "fraudChecks.duplicateAttemptCount": 1 },
              $addToSet: { "fraudChecks.flaggedReasons": "WEBHOOK_CURRENCY_MISMATCH" },
            });
            throw new AppError("Webhook payment currency mismatch", 409, "PAYMENT_CURRENCY_MISMATCH");
          }
          await paymentRepo.updateById(payment._id, {
            $set: {
              status: "AUTHORIZED",
              razorpayPaymentId: paymentEntity.id,
              paidAt: new Date(),
              lastWebhookAt: new Date(),
              gatewayResponse: {
                ...(payment.gatewayResponse || {}),
                capturedWebhook: paymentEntity,
              },
            },
            $addToSet: { webhookEvents: eventId },
          });

          if (Array.isArray(payment.orderIds) && payment.orderIds.length) {
            for (const orderRef of payment.orderIds) {
              await orderRepo.updateById(orderRef._id || orderRef, {
                paymentStatus: "Paid",
                razorpayPaymentId: paymentEntity.id,
                paymentCapturedAt: new Date(),
              });
            }
          } else {
            await paymentService.fulfillPaidPayment({
              paymentId: payment._id,
              paymentSessionId: session?._id || payment.paymentSessionId?._id || payment.paymentSessionId || null,
              userId: payment.userId?._id || payment.userId,
              razorpayOrderId: paymentEntity.order_id,
              razorpayPaymentId: paymentEntity.id,
            });
          }
        }
      }

      if (eventType === "payment.failed") {
        const paymentEntity = event.payload?.payment?.entity;
        const payment = await paymentRepo.findByRazorpayOrderId(paymentEntity?.order_id);
        if (payment) {
          await paymentRepo.updateById(payment._id, {
            $set: {
              status: "FAILED",
              failedAt: new Date(),
              gatewayResponse: { ...payment.gatewayResponse, failedWebhook: paymentEntity },
              lastWebhookAt: new Date(),
            },
            $addToSet: { webhookEvents: eventId },
          });
          if (payment.paymentSessionId) {
            await PaymentSession.updateOne(
              { _id: payment.paymentSessionId?._id || payment.paymentSessionId },
              {
                $set: {
                  status: "FAILED",
                  failedAt: new Date(),
                },
              }
            );
          }
        }
      }

      if (eventType === "refund.processed") {
        const refundEntity = event.payload?.refund?.entity;
        const refund = await refundRepo.findByRefundId(refundEntity?.id);
        if (refund) {
          await refundRepo.updateById(refund._id, {
            $set: {
              status: "PROCESSED",
              processedAt: new Date(),
              gatewayResponse: refundEntity,
            },
          });
          const paymentId = refund.paymentId?._id || refund.paymentId;
          const orderId = refund.orderId?._id || refund.orderId;
          const payment = paymentId ? await paymentRepo.findById(paymentId) : null;
          const order = orderId ? await orderRepo.findById(orderId) : null;
          if (payment) {
            const nextRefundedAmount = Number(payment.refundedAmount || 0);
            const isFullRefund = nextRefundedAmount >= Number(payment.amount || 0);
            await paymentRepo.updateById(payment._id, {
              $set: {
                status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
                refundStatus: isFullRefund ? "FULL" : "PARTIAL",
                lastWebhookAt: new Date(),
              },
            });
          }
          if (order) {
            await orderRepo.updateById(order._id, {
              paymentStatus:
                payment && Number(payment.refundedAmount || 0) >= Number(payment.amount || 0)
                  ? "Refunded"
                  : "Partially Refunded",
              "refundSummary.status": "REFUNDED",
              "refundSummary.processedAt": new Date(),
              "refundSummary.failureReason": "",
              refundId: refund._id,
            });
          }
        }
      }

      await webhookEventRepo.updateById(webhookRecord._id, {
        $set: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

      return { status: "ok", eventId };
    } catch (error) {
      await webhookEventRepo.updateById(webhookRecord._id, {
        $set: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  async handleShiprocketWebhook(data, { rawBody, signature } = {}) {
    logisticsService.verifyWebhookSignature(rawBody, signature);
    const eventId = buildEventId("SHIPROCKET", String(data?.current_status || "status"), JSON.stringify(data || {}));
    const hash = payloadHash(rawBody || JSON.stringify(data || {}));
    const existing = await webhookEventRepo.findByEventId(eventId);
    if (existing) {
      return { status: "duplicate_ignored", eventId };
    }

    const webhookRecord = await webhookEventRepo.create({
      provider: "SHIPROCKET",
      eventType: String(data?.current_status || "unknown"),
      eventId,
      providerEventId: String(data?.shipment_id || data?.awb || data?.awb_code || ""),
      payloadHash: hash,
      receivedAt: new Date(),
      signatureVerified: true,
      status: "RECEIVED",
      payload: data,
    });

    try {
      const awb = data?.awb || data?.awb_code || data?.tracking_number || "";
      const shipmentId = data?.shipment_id ? String(data.shipment_id) : "";
      const currentStatus = String(data?.current_status || data?.status || "").trim();
      const order = shipmentId ? await orderRepo.findByShipmentId(shipmentId) : await orderRepo.findByTrackingId(awb);
      if (order) {
        let nextShippingStatus = order.shippingStatus;
        let nextPickupStatus = order.pickupStatus;

        if (currentStatus === "AWB assigned") {
          nextShippingStatus = "READY_FOR_PICKUP";
          nextPickupStatus = order.pickupStatus || "NOT_REQUESTED";
        } else if (["Pickup scheduled", "Pickup generated"].includes(currentStatus)) {
          nextShippingStatus = "PICKUP_SCHEDULED";
          nextPickupStatus = "SCHEDULED";
        } else if (["Pickup complete", "Picked Up"].includes(currentStatus)) {
          nextShippingStatus = "IN_TRANSIT";
          nextPickupStatus = "COMPLETED";
        } else if (["Shipped", "In Transit"].includes(currentStatus)) {
          nextShippingStatus = "IN_TRANSIT";
        } else if (currentStatus === "Out for Delivery") {
          nextShippingStatus = "OUT_FOR_DELIVERY";
        } else if (["Pickup Exception", "Pickup Failed", "Undelivered", "RTO Initiated"].includes(currentStatus)) {
          nextShippingStatus = "FAILED";
          nextPickupStatus = order.pickupStatus === "REQUESTED" ? "FAILED" : order.pickupStatus;
        } else if (currentStatus === "Delivered") {
          nextShippingStatus = "DELIVERED";
          nextPickupStatus = order.pickupStatus === "NOT_REQUESTED" ? "COMPLETED" : order.pickupStatus;
        }

        const lifecycle = applyShippingLifecycle({
          orderStatus: order.status,
          shippingMode: order.shippingMode || "PLATFORM",
          shippingStatus: nextShippingStatus,
          pickupStatus: nextPickupStatus,
        });

        const updatedOrder = await orderRepo.updateById(order._id, {
          status: lifecycle.status,
          shippingMode: lifecycle.shippingMode,
          shippingStatus: lifecycle.shippingStatus,
          pickupStatus: lifecycle.pickupStatus,
          trackingId: awb || order.trackingId,
          shipmentId: shipmentId || order.shipmentId,
          courierName: data?.courier_name || order.courierName,
          deliveryPartner: "SHIPROCKET",
          deliveryStatus:
            lifecycle.shippingStatus === "DELIVERED"
              ? "DELIVERED"
              : ["IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(lifecycle.shippingStatus)
                ? "SHIPPED"
                : order.deliveryStatus,
          pickupScheduled: ["SCHEDULED", "COMPLETED"].includes(lifecycle.pickupStatus),
          ...(lifecycle.pickupStatus === "SCHEDULED" ? { pickupScheduledAt: new Date() } : {}),
          ...(lifecycle.pickupStatus === "COMPLETED" ? { pickupCompletedAt: new Date() } : {}),
        });

        if (updatedOrder?.status === "Delivered") {
          await payoutService.markOrderDelivered(updatedOrder._id);
        }
      }

      await webhookEventRepo.updateById(webhookRecord._id, {
        $set: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
      return { status: "ok", eventId };
    } catch (error) {
      await webhookEventRepo.updateById(webhookRecord._id, {
        $set: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }
}

module.exports = new WebhookService();

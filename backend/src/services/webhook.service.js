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

function buildEventId(provider, eventType, rawBody) {
  return `${provider}:${eventType}:${crypto.createHash("sha1").update(String(rawBody || "")).digest("hex")}`;
}

class WebhookService {
  async handleRazorpayWebhook(rawBody, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new AppError("Razorpay webhook secret is not configured", 500, "WEBHOOK_NOT_CONFIGURED");
    }
    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    if (expectedSignature !== signature) {
      throw new AppError("Invalid signature", 400, "INVALID_SIGNATURE");
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const eventId = buildEventId("RAZORPAY", eventType, rawBody);
    const existing = await webhookEventRepo.findByEventId(eventId);
    if (existing) {
      return { status: "duplicate_ignored", eventId };
    }

    const webhookRecord = await webhookEventRepo.create({
      provider: "RAZORPAY",
      eventType,
      eventId,
      signatureVerified: true,
      status: "RECEIVED",
      payload: event,
    });

    try {
      if (eventType === "payment.captured") {
        const paymentEntity = event.payload?.payment?.entity;
        const payment = await paymentRepo.findByRazorpayOrderId(paymentEntity?.order_id);
        if (payment) {
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
              paymentSessionId: payment.paymentSessionId?._id || payment.paymentSessionId || null,
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
            const { PaymentSession } = require("../models/PaymentSession");
            await PaymentSession.updateOne(
              { _id: payment.paymentSessionId },
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
          if (order && payment) {
            await paymentService.applyRefundWalletReversal(order, refund.amount, refund.refundId);
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
    const existing = await webhookEventRepo.findByEventId(eventId);
    if (existing) {
      return { status: "duplicate_ignored", eventId };
    }

    const webhookRecord = await webhookEventRepo.create({
      provider: "SHIPROCKET",
      eventType: String(data?.current_status || "unknown"),
      eventId,
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

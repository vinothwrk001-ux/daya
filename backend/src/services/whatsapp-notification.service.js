const orderRepo = require("../repositories/order.repository");
const whatsappLogRepo = require("../repositories/whatsapp-message-log.repository");
const auditService = require("./audit.service");
const notificationService = require("./notification.service");
const {
  sendShipmentNotification,
  sendDeliveredNotification,
  sendOrderConfirmation,
  buildShipmentMessageBody,
  formatWhatsAppRecipient,
} = require("./whatsapp.service");
const { logger } = require("../utils/logger");

function parseRetryDelaysMs() {
  const raw = String(process.env.WHATSAPP_RETRY_DELAYS_MS || "60000,300000,900000,3600000");
  const values = raw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? values : [60000, 300000, 900000, 3600000];
}

function getMaxRetryAttempts() {
  const value = Number(process.env.WHATSAPP_MAX_RETRY_ATTEMPTS || 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

async function safeAudit(payload) {
  try {
    const actor = payload?.actor;
    if (!actor?.sub && !actor?._id) {
      return null;
    }
    await auditService.log(payload);
  } catch (error) {
    logger.warn("WhatsApp audit log skipped", {
      action: payload?.action,
      error: error?.message,
    });
  }
  return null;
}

function resolveOrderPhone(order) {
  return String(order?.shippingAddress?.phone || "").trim();
}

function resolveCustomerName(order) {
  return (
    order?.shippingAddress?.fullName ||
    order?.userId?.name ||
    "Customer"
  );
}

function buildShipmentPayload(order) {
  const customerName = resolveCustomerName(order);
  const orderNumber = order?.orderNumber || String(order?._id || "");
  const trackingNumber = order?.trackingId || "";
  const trackingUrl = order?.trackingUrl || "";
  const courierName = order?.courierName || order?.deliveryPartner || "";
  const expectedDeliveryDate = order?.expectedDeliveryDate || null;

  const fallbackBody = buildShipmentMessageBody({
    customerName,
    orderNumber,
    courierName,
    trackingNumber,
    trackingUrl,
    expectedDeliveryDate,
  });

  return {
    customerName,
    orderNumber,
    courierName,
    trackingNumber,
    trackingUrl,
    expectedDeliveryDate,
    fallbackBody,
  };
}

async function createQueuedLog(order, { messageType = "shipment", messageBody = "" } = {}) {
  return await whatsappLogRepo.create({
    orderId: order._id,
    customerId: order.userId?._id || order.userId,
    phone: resolveOrderPhone(order),
    messageType,
    status: "Queued",
    messageBody,
    maxRetries: getMaxRetryAttempts(),
  });
}

async function dispatchLog(logId, context = {}) {
  const log = await whatsappLogRepo.findById(logId);
  if (!log) return null;

  const order = await orderRepo.findById(log.orderId);
  if (!order) {
    await whatsappLogRepo.updateById(logId, {
      $set: {
        status: "Failed",
        lastError: "Order not found",
        failedAt: new Date(),
      },
    });
    return null;
  }

  const phone = resolveOrderPhone(order);
  if (!phone) {
    await whatsappLogRepo.updateById(logId, {
      $set: {
        status: "Failed",
        lastError: "Shipping address phone is missing",
        failedAt: new Date(),
      },
    });
    await safeAudit({
      actor: context.actor,
      action: "order.whatsapp.failed",
      entityType: "Order",
      entityId: order._id,
      metadata: { reason: "missing_phone", logId: String(logId) },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return null;
  }

  try {
    let result;
    const payload = buildShipmentPayload(order);

    if (log.messageType === "delivered") {
      result = await sendDeliveredNotification(phone, {
        customerName: payload.customerName,
        orderNumber: payload.orderNumber,
      });
    } else if (log.messageType === "order_confirmation") {
      result = await sendOrderConfirmation(phone, {
        customerName: payload.customerName,
        orderNumber: payload.orderNumber,
        totalAmount: order.totalAmount,
        currency: order.currency,
      });
    } else {
      result = await sendShipmentNotification(phone, payload);
    }

    const updatedLog = await whatsappLogRepo.updateById(logId, {
      $set: {
        status: "Sent",
        twilioSid: result?.sid || "",
        response: {
          sid: result?.sid,
          status: result?.status,
          to: result?.to,
          dateCreated: result?.dateCreated,
        },
        sentAt: new Date(),
        lastError: "",
      },
    });

    if (log.messageType === "shipment" && !order.whatsappSent) {
      await orderRepo.markWhatsAppSent(order._id, { twilioSid: result?.sid });
    }

    await safeAudit({
      actor: context.actor,
      action: "order.whatsapp.sent",
      entityType: "Order",
      entityId: order._id,
      metadata: {
        logId: String(logId),
        twilioSid: result?.sid,
        messageType: log.messageType,
        phone,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return updatedLog;
  } catch (error) {
    return await handleSendFailure(log, order, error, context);
  }
}

async function handleSendFailure(log, order, error, context = {}) {
  const retryDelays = parseRetryDelaysMs();
  const maxRetries = log.maxRetries || getMaxRetryAttempts();
  const nextRetryCount = Number(log.retryCount || 0) + 1;
  const canRetry = nextRetryCount < maxRetries;
  const delayMs = retryDelays[Math.min(nextRetryCount - 1, retryDelays.length - 1)];

  const update = {
    $set: {
      retryCount: nextRetryCount,
      lastError: error?.message || "WhatsApp send failed",
      response: {
        error: error?.message,
        code: error?.code,
        status: error?.status,
      },
    },
  };

  if (canRetry) {
    update.$set.status = "Retrying";
    update.$set.nextRetryAt = new Date(Date.now() + delayMs);
  } else {
    update.$set.status = "Failed";
    update.$set.failedAt = new Date();
    update.$set.nextRetryAt = null;
  }

  const updatedLog = await whatsappLogRepo.updateById(log._id, update);

  await safeAudit({
    actor: context.actor,
    action: canRetry ? "order.whatsapp.retried" : "order.whatsapp.failed",
    entityType: "Order",
    entityId: order._id,
    metadata: {
      logId: String(log._id),
      retryCount: nextRetryCount,
      error: error?.message,
      nextRetryAt: canRetry ? update.$set.nextRetryAt : null,
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  if (!canRetry) {
    await notificationService.notifyOperations(
      {
        type: "ORDER_STATUS_CHANGED",
        subModule: "DELIVERY",
        title: "WhatsApp shipment notification failed",
        message: `Order ${order.orderNumber || order._id} WhatsApp notification failed after ${nextRetryCount} attempts.`,
        metadata: {
          orderId: String(order._id),
          logId: String(log._id),
          phone: log.phone,
        },
      },
      "orders.read"
    );
  }

  logger.error("WhatsApp notification failed", {
    orderId: String(order._id),
    logId: String(log._id),
    phone: log.phone,
    formattedTo: formatWhatsAppRecipient(log.phone),
    retryCount: nextRetryCount,
    canRetry,
    error: error?.message,
    code: error?.code,
  });

  return updatedLog;
}

function queueWhatsAppDispatch(logId, context = {}) {
  setImmediate(async () => {
    try {
      await dispatchLog(logId, context);
    } catch (error) {
      logger.error("WhatsApp dispatch worker failed", {
        logId: String(logId),
        error: error?.message,
      });
    }
  });
}

async function queueShipmentNotification(order, context = {}) {
  if (!order || order.whatsappSent) {
    return null;
  }

  const existingLogs = await whatsappLogRepo.findByOrderId(order._id, { limit: 5 });
  const alreadyQueued = existingLogs.some(
    (log) => log.messageType === "shipment" && ["Queued", "Sent", "Delivered", "Read", "Retrying"].includes(log.status)
  );
  if (alreadyQueued) {
    logger.info("Skipping duplicate shipment WhatsApp notification", {
      orderId: String(order._id),
    });
    return null;
  }

  const payload = buildShipmentPayload(order);
  const log = await createQueuedLog(order, {
    messageType: "shipment",
    messageBody: payload.fallbackBody,
  });

  queueWhatsAppDispatch(log._id, context);
  return log;
}

async function processDueRetries(context = {}) {
  const dueLogs = await whatsappLogRepo.findPendingRetries();
  for (const log of dueLogs) {
    await dispatchLog(log._id, context);
  }
  return dueLogs.length;
}

async function applyTwilioStatusUpdate({ twilioSid, messageStatus, rawPayload = {} } = {}) {
  if (!twilioSid) return null;

  const log = await whatsappLogRepo.findByTwilioSid(twilioSid);
  if (!log) return null;

  const normalized = String(messageStatus || "").toLowerCase();
  const update = { $set: { response: { ...(log.response || {}), webhook: rawPayload } } };

  if (normalized === "sent" || normalized === "accepted") {
    update.$set.status = "Sent";
    update.$set.sentAt = log.sentAt || new Date();
  } else if (normalized === "delivered") {
    update.$set.status = "Delivered";
    update.$set.deliveredAt = new Date();
  } else if (normalized === "read") {
    update.$set.status = "Read";
    update.$set.readAt = new Date();
  } else if (["failed", "undelivered"].includes(normalized)) {
    update.$set.status = "Failed";
    update.$set.failedAt = new Date();
    update.$set.lastError = rawPayload?.ErrorMessage || rawPayload?.ErrorCode || "Twilio delivery failed";
  }

  return await whatsappLogRepo.updateById(log._id, update);
}

async function listWhatsAppLogs(filters = {}) {
  return await whatsappLogRepo.list(filters);
}

async function getWhatsAppLogsForOrder(orderId) {
  return await whatsappLogRepo.findByOrderId(orderId);
}

async function retryWhatsAppLog(logId, context = {}) {
  const log = await whatsappLogRepo.findById(logId);
  if (!log) return null;

  await whatsappLogRepo.updateById(logId, {
    $set: {
      status: "Queued",
      nextRetryAt: new Date(),
      lastError: "",
    },
  });

  return await dispatchLog(logId, context);
}

module.exports = {
  queueShipmentNotification,
  queueWhatsAppDispatch,
  dispatchLog,
  retryWhatsAppLog,
  processDueRetries,
  applyTwilioStatusUpdate,
  listWhatsAppLogs,
  getWhatsAppLogsForOrder,
  resolveOrderPhone,
  buildShipmentPayload,
};

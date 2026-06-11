const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { Order } = require("../models/Order");
const { PickupBatch } = require("../models/PickupBatch");
const logisticsService = require("./logistics.service");
const { logger } = require("../utils/logger");

const READY_FOR_PICKUP_STATUS = "READY_FOR_PICKUP";
const PICKUP_SCHEDULED_STATUS = "PICKUP_SCHEDULED";

function normalizeShipmentIds(shipmentIds = []) {
  return [...new Set((Array.isArray(shipmentIds) ? shipmentIds : []).map((id) => String(id || "").trim()).filter(Boolean))];
}

function buildIdempotencyKey(shipmentIds = []) {
  const hash = crypto
    .createHash("sha1")
    .update([...shipmentIds].sort().join(","))
    .digest("hex");
  return `pickup:${hash}`;
}

function attachSession(query, session) {
  if (session) {
    query.session(session);
  }
  return query;
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

async function executeWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set") ||
      message.includes("standalone")
    ) {
      logger.warn("Mongo transaction unavailable, falling back to non-transactional pickup scheduling flow", {
        source: "pickup.service",
      });
      return await work(null);
    }
    throw error;
  } finally {
    await session.endSession().catch(() => {});
  }
}

async function generateBatchId(date = new Date(), session = null) {
  const datePart = new Date(date).toISOString().slice(0, 10);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const baseCount = await attachSession(PickupBatch.countDocuments({
    scheduledAt: { $gte: dayStart, $lte: dayEnd },
  }), session);

  for (let offset = 1; offset <= 50; offset += 1) {
    const sequence = String(baseCount + offset).padStart(3, "0");
    const batchId = `PICKUP-${datePart}-${sequence}`;
    const existing = await attachSession(PickupBatch.exists({ batchId }), session);
    if (!existing) {
      return batchId;
    }
  }

  throw new AppError("Unable to generate a unique pickup batch id", 500, "PICKUP_BATCH_ID_GENERATION_FAILED");
}

function validateReadyShipment(order) {
  if (!order.shipmentId) {
    throw new AppError(`Shipment not created yet for order ${order.orderNumber}`, 400, "SHIPMENT_NOT_CREATED");
  }
  if (order.shippingMode !== "PLATFORM") {
    throw new AppError(`Shipment ${order.shipmentId} is not a platform shipment`, 400, "INVALID_SHIPPING_MODE");
  }
  if (order.shippingStatus !== READY_FOR_PICKUP_STATUS) {
    throw new AppError(`Shipment ${order.shipmentId} is not ready for pickup`, 400, "SHIPMENT_NOT_READY");
  }
  if (order.pickupScheduled === true) {
    throw new AppError(`Shipment ${order.shipmentId} is already scheduled for pickup`, 409, "PICKUP_ALREADY_SCHEDULED");
  }
}

class PickupService {
  async listAdminBatches(query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.batchId) filter.batchId = { $regex: String(query.batchId).trim(), $options: "i" };
    if (query.status) filter.status = query.status;

    const [batches, total] = await Promise.all([
      PickupBatch.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PickupBatch.countDocuments(filter),
    ]);

    return {
      batches,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async scheduleAdminPickup(payload = {}, actor = {}) {
    const normalizedShipmentIds = normalizeShipmentIds(payload.shipmentIds);
    if (!normalizedShipmentIds.length) {
      throw new AppError("shipmentIds must contain at least one shipment id", 400, "SHIPMENT_IDS_REQUIRED");
    }

    const existingOrders = await Order.find({ shipmentId: { $in: normalizedShipmentIds }, isActive: true })
      .select("_id orderNumber shipmentId shippingMode shippingStatus pickupScheduled pickupBatchId pickupStatus courierName")
      .lean();

    if (existingOrders.length !== normalizedShipmentIds.length) {
      throw new AppError("One or more shipment ids are invalid", 404, "SHIPMENTS_NOT_FOUND");
    }

    existingOrders.forEach(validateReadyShipment);

    const idempotencyKey = buildIdempotencyKey(normalizedShipmentIds);
    const existingBatch = await PickupBatch.findOne({ idempotencyKey }).lean();
    if (existingBatch) {
      return {
        batch: existingBatch,
        idempotentReplay: true,
      };
    }

    const pickupResponse = await logisticsService.schedulePickup({
      shipmentIds: normalizedShipmentIds,
      idempotencyKey,
    });

    const now = new Date();
    const scheduledPickupDate = pickupResponse.pickupDate ? new Date(pickupResponse.pickupDate) : now;

    return await executeWithOptionalTransaction(async (session) => {
      const orders = await attachSession(Order.find({
        shipmentId: { $in: normalizedShipmentIds },
        isActive: true,
      }), session).exec();

      if (orders.length !== normalizedShipmentIds.length) {
        throw new AppError("One or more shipment ids are no longer available", 409, "SHIPMENTS_CHANGED");
      }

      orders.forEach(validateReadyShipment);

      const replayBatch = await attachSession(PickupBatch.findOne({ idempotencyKey }), session).lean();
      if (replayBatch) {
        return {
          batch: replayBatch,
          idempotentReplay: true,
        };
      }

      const batchId = await generateBatchId(now, session);
      const batchPayload = {
        batchId,
        shipmentIds: normalizedShipmentIds,
        totalShipments: normalizedShipmentIds.length,
        status: "SCHEDULED",
        scheduledAt: now,
        pickupDate: scheduledPickupDate,
        courier: pickupResponse.courierName || orders[0]?.courierName || "",
        idempotencyKey,
        logisticsMetadata: pickupResponse.raw,
        scheduledByRole: "ADMIN",
        scheduledById: actor?.sub || actor?._id || undefined,
      };

      const [createdBatch] = await PickupBatch.create([batchPayload], { session: session || undefined });

      await Order.updateMany(
        { _id: { $in: orders.map((order) => order._id) } },
        {
          $set: {
            pickupScheduled: true,
            pickupBatchId: batchId,
            shippingStatus: PICKUP_SCHEDULED_STATUS,
            pickupStatus: "SCHEDULED",
            pickupScheduledAt: now,
          },
          $push: {
            timeline: {
              status: "Packed",
              note: `Pickup batch ${batchId} scheduled for shipment ${normalizedShipmentIds.length === 1 ? normalizedShipmentIds[0] : "multiple shipments"}.`,
              changedAt: now,
            },
          },
        },
        { session: session || undefined }
      );

      logger.info("Pickup batch scheduled", {
        source: "pickup.service",
        batchId,
        totalShipments: normalizedShipmentIds.length,
        actorId: actor?.sub || actor?._id || "",
      });

      return {
        batch: createdBatch.toObject(),
        idempotentReplay: false,
      };
    });
  }
}

module.exports = new PickupService();

const mongoose = require("mongoose");
const { Order } = require("../models/Order");
const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");
const { normalizeShiftValue, buildShiftQueryRange } = require("../utils/shiftTime");

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeOrderItem(item = {}) {
  const productRef = item?.productId && typeof item.productId === "object" && !Array.isArray(item.productId) ? item.productId : null;
  const resolvedProductId = productRef?._id || item?.productId || null;
  const productName = item?.productName || item?.name || productRef?.name || "";
  const productNumber = item?.productNumber || productRef?.productNumber || productRef?.SKU || "";
  const sku = item?.sku || productRef?.SKU || "";
  const quantity = Number(item?.quantity || 0);
  const price = Number(item?.price || 0);

  return {
    ...item,
    productId: resolvedProductId || null,
    productName,
    productNumber,
    sku,
    name: item?.name || productName || "",
    quantity,
    price,
    subtotal: price * quantity,
  };
}

function normalizeOrderResponse(order) {
  if (!order) return order;
  const orderObject = typeof order?.toObject === "function" ? order.toObject() : order;
  return {
    ...orderObject,
    items: (orderObject?.items || []).map(normalizeOrderItem),
  };
}

class OrderRepository {
  async createOne(payload) {
    const order = new Order(payload);
    return await order.save();
  }

  async createMany(orderPayloads = []) {
    if (!Array.isArray(orderPayloads) || orderPayloads.length === 0) return [];
    return await Order.insertMany(orderPayloads, { ordered: true });
  }

  async findByTrackingId(trackingId) {
    return await Order.findOne({ trackingId });
  }

  async findByShipmentId(shipmentId) {
    return await Order.findOne({ shipmentId });
  }

  async list({
    page = 1,
    limit = 20,
    status,
    paymentStatus,
    shippingMode,
    shippingStatus,
    pickupStatus,
    search,
    isActive,
    includeInactive = false,
    sortBy = "createdAt",
    sortOrder = -1,
    startDate,
    endDate,
    shift,
  } = {}) {
    const query = {};

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (shippingMode) query.shippingMode = shippingMode;
    if (shippingStatus) query.shippingStatus = shippingStatus;
    if (pickupStatus) query.pickupStatus = pickupStatus;
    if (typeof isActive === "boolean") {
      query.isActive = isActive;
    } else if (!includeInactive) {
      query.isActive = true;
    }
    if (search) {
      const searchValue = String(search).trim();
      if (searchValue) {
        const escapedSearch = escapeRegex(searchValue);
        const searchConditions = [
          { orderNumber: { $regex: escapedSearch, $options: "i" } },
          { invoiceNumber: { $regex: escapedSearch, $options: "i" } },
          { "shippingAddress.fullName": { $regex: escapedSearch, $options: "i" } },
          { "shippingAddress.phone": { $regex: escapedSearch, $options: "i" } },
          { "items.productName": { $regex: escapedSearch, $options: "i" } },
          { "items.productNumber": { $regex: escapedSearch, $options: "i" } },
          { "items.sku": { $regex: escapedSearch, $options: "i" } },
        ];

        if (mongoose.isValidObjectId(searchValue)) {
          searchConditions.unshift({ _id: new mongoose.Types.ObjectId(searchValue) });
          searchConditions.push({ "items.productId": new mongoose.Types.ObjectId(searchValue) });
        }

        query.$or = searchConditions;
      }
    }

    const normalizedShift = normalizeShiftValue(shift);
    const baseRange = normalizeDateRange({ startDate, endDate });
    const rangeForQuery = buildShiftQueryRange({ startDate, endDate, shift: normalizedShift }, baseRange);
    if (rangeForQuery) {
      applyDateRange(query, rangeForQuery);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "name email phone")
        .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
        .populate("items.productId", "name slug productNumber SKU images")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      Order.countDocuments(query),
    ]);

    return {
      orders: orders.map(normalizeOrderResponse),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async countDocuments(query = {}) {
    return await Order.countDocuments(query);
  }

  async sumRevenue(query = {}) {
    const [result] = await Order.aggregate([
      { $match: { ...query, status: { $in: ["Shipped", "Delivered"] } } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
    ]);

    return result?.totalRevenue || 0;
  }

  async findById(id) {
    const order = await Order.findById(id)
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .exec();
    return normalizeOrderResponse(order);
  }

  async findByIdForUser(id, userId) {
    const order = await Order.findOne({ _id: id, userId, isActive: true })
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .exec();
    return normalizeOrderResponse(order);
  }

  async findByGroupId(orderGroupId) {
    const orders = await Order.find({ orderGroupId })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .sort({ createdAt: -1 })
      .exec();
    return orders.map(normalizeOrderResponse);
  }

  async listByUserId({
    userId,
    page = 1,
    limit = 20,
    status,
    shippingMode,
    shippingStatus,
    pickupStatus,
    sortBy = "createdAt",
    sortOrder = -1,
    startDate,
    endDate,
  } = {}) {
    const query = { userId, isActive: true };
    if (status) query.status = status;
    if (shippingMode) query.shippingMode = shippingMode;
    if (shippingStatus) query.shippingStatus = shippingStatus;
    if (pickupStatus) query.pickupStatus = pickupStatus;
    applyDateRange(query, normalizeDateRange({ startDate, endDate }));

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
        .populate("items.productId", "name slug productNumber SKU images")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      Order.countDocuments(query),
    ]);

    return {
      orders: orders.map(normalizeOrderResponse),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updatePaymentStatus(id, paymentStatus) {
    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          paymentStatus,
          ...(paymentStatus === "Paid" ? { paymentCapturedAt: new Date() } : {}),
        },
        $push: {
          timeline: {
            status: paymentStatus === "Paid" ? "Placed" : "Pending",
            note: `Payment ${paymentStatus}`,
            timestamp: new Date(),
          },
        },
      },
      { returnDocument: "after" }
    )
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .exec();
    return normalizeOrderResponse(updated);
  }

  async updateStatus(id, status) {
    const update = {
      $set: {
        status,
        ...(status === "Delivered" ? { deliveredAt: new Date() } : {}),
      },
      $push: {
        timeline: {
          status,
          timestamp: new Date(),
        },
      },
    };

    const updated = await Order.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .exec();
    return normalizeOrderResponse(updated);
  }

  async getMonthlyRevenue(limit = 6, match = {}) {
    return await Order.aggregate([
      { $match: { ...match, status: { $in: ["Shipped", "Delivered"] } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          label: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: [
                  { $lt: ["$_id.month", 10] },
                  { $concat: ["0", { $toString: "$_id.month" }] },
                  { $toString: "$_id.month" },
                ],
              },
            ],
          },
          revenue: 1,
          orders: 1,
        },
      },
      { $sort: { label: 1 } },
    ]);
  }

  async findWithDateRange(startDate, endDate) {
    return await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateById(id, updateData = {}) {
    const { status, ...rest } = updateData || {};
    const update = { $set: { ...rest } };

    if (status) {
      update.$set.status = status;
      if (status === "Delivered") {
        update.$set.deliveredAt = new Date();
      }
      update.$push = {
        timeline: {
          status,
          timestamp: new Date(),
        },
      };
    }

    const updated = await Order.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .exec();
    return normalizeOrderResponse(updated);
  }

  async markWhatsAppSent(id, { twilioSid } = {}) {
    const update = {
      $set: {
        whatsappSent: true,
        whatsappSentAt: new Date(),
      },
      $push: {
        timeline: {
          status: "WhatsApp Sent",
          note: twilioSid ? `Shipment notification sent via WhatsApp (${twilioSid})` : "Shipment notification sent via WhatsApp",
          timestamp: new Date(),
        },
      },
    };

    const updated = await Order.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .exec();
    return normalizeOrderResponse(updated);
  }

  async shipOrderById(id, updateData = {}) {
    const { status = "Shipped", timelineNote, ...rest } = updateData;
    const update = {
      $set: {
        status,
        ...rest,
      },
      $push: {
        timeline: {
          status,
          note: timelineNote || "Order marked as shipped",
          timestamp: new Date(),
        },
      },
    };

    const updated = await Order.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .exec();
    return normalizeOrderResponse(updated);
  }

  async softDeleteById(id, { note } = {}) {
    const update = {
      $set: { isActive: false },
      ...(note
        ? {
            $push: {
              timeline: {
                status: "Cancelled",
                note,
                timestamp: new Date(),
              },
            },
          }
        : {}),
    };
    const updated = await Order.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug productNumber SKU images")
      .exec();
    return normalizeOrderResponse(updated);
  }
}

module.exports = new OrderRepository();

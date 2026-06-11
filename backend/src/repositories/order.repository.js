const mongoose = require("mongoose");
const { Order } = require("../models/Order");
const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
        ];

        if (mongoose.isValidObjectId(searchValue)) {
          searchConditions.unshift({ _id: new mongoose.Types.ObjectId(searchValue) });
        }

        query.$or = searchConditions;
      }
    }

    applyDateRange(query, normalizeDateRange({ startDate, endDate }));

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "name email phone")
        .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
        .populate("items.productId", "name slug")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      Order.countDocuments(query),
    ]);

    return {
      orders,
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
    return await Order.findById(id)
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug")
      .exec();
  }

  async findByIdForUser(id, userId) {
    return await Order.findOne({ _id: id, userId, isActive: true })
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug images")
      .exec();
  }

  async findByGroupId(orderGroupId) {
    return await Order.find({ orderGroupId })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug images")
      .sort({ createdAt: -1 })
      .exec();
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
        .populate("items.productId", "name slug images")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      Order.countDocuments(query),
    ]);

    return {
      orders,
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
    ).exec();
    return updated;
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
      .populate("items.productId", "name slug")
      .exec();
    return updated;
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

    return await Order.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug")
      .exec();
  }

  async markWhatsAppSent(id) {
    return await Order.findByIdAndUpdate(
      id,
      { $set: { whatsappSent: true } },
      { returnDocument: "after" }
    )
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug")
      .exec();
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
    return await Order.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("userId", "name email phone")
      .populate("paymentRecordId", "status method amount razorpayOrderId razorpayPaymentId refundedAmount refundStatus")
      .populate("items.productId", "name slug")
      .exec();
  }
}

module.exports = new OrderRepository();

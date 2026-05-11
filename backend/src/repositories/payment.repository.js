const { Payment } = require("../models/Payment");

function asUpdateDocument(updateData = {}) {
  const keys = Object.keys(updateData || {});
  if (keys.some((key) => key.startsWith("$"))) return updateData;
  return { $set: updateData };
}

class PaymentRepository {
  async create(data) {
    const payment = new Payment(data);
    return await payment.save();
  }

  async findById(id) {
    return await Payment.findById(id)
      .populate("userId", "name email phone")
      .populate("paymentSessionId")
      .populate("orderIds", "orderNumber totalAmount paymentStatus paymentMethod status createdAt")
      .exec();
  }

  async findByRazorpayPaymentId(paymentId) {
    return await Payment.findOne({ razorpayPaymentId: paymentId })
      .populate("userId", "name email phone")
      .populate("paymentSessionId")
      .populate("orderIds", "orderNumber totalAmount paymentStatus paymentMethod status createdAt")
      .exec();
  }

  async findByRazorpayOrderId(orderId) {
    return await Payment.findOne({ razorpayOrderId: orderId })
      .populate("userId", "name email phone")
      .populate("paymentSessionId")
      .populate("orderIds", "orderNumber totalAmount paymentStatus paymentMethod status createdAt")
      .exec();
  }

  async list({
    page = 1,
    limit = 20,
    status,
    method,
    startDate,
    endDate,
    search,
  } = {}) {
    const query = {};
    if (status) query.status = status;
    if (method) query.method = method;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { razorpayOrderId: { $regex: String(search).trim(), $options: "i" } },
        { razorpayPaymentId: { $regex: String(search).trim(), $options: "i" } },
        { receipt: { $regex: String(search).trim(), $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("userId", "name email phone")
        .populate("paymentSessionId")
        .populate("orderIds", "orderNumber totalAmount paymentStatus paymentMethod status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Payment.countDocuments(query),
    ]);

    return {
      payments,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(orderId, status, paymentId = null, extra = {}) {
    const update = { status, ...extra };
    if (paymentId) update.razorpayPaymentId = paymentId;
    return await Payment.findOneAndUpdate({ razorpayOrderId: orderId }, asUpdateDocument(update), { new: true })
      .populate("userId", "name email phone")
      .populate("paymentSessionId")
      .populate("orderIds", "orderNumber totalAmount paymentStatus paymentMethod status createdAt")
      .exec();
  }

  async updateById(id, updateData = {}) {
    return await Payment.findByIdAndUpdate(id, asUpdateDocument(updateData), { new: true })
      .populate("userId", "name email phone")
      .populate("paymentSessionId")
      .populate("orderIds", "orderNumber totalAmount paymentStatus paymentMethod status createdAt")
      .exec();
  }
}

module.exports = new PaymentRepository();

const { Refund } = require("../models/Refund");

function asUpdateDocument(updateData = {}) {
  const keys = Object.keys(updateData || {});
  if (keys.some((key) => key.startsWith("$"))) return updateData;
  return { $set: updateData };
}

class RefundRepository {
  async create(data) {
    const refund = new Refund(data);
    return await refund.save();
  }

  async findById(id) {
    return await Refund.findById(id)
      .populate({
        path: "orderId",
        select: "orderNumber totalAmount paymentStatus paymentMethod status createdAt userId sellerId items cancellation refundSummary shippingAddress billingAddress",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "sellerId", select: "companyName shopName supportPhone" },
        ],
      })
      .populate("paymentId", "amount status method razorpayPaymentId refundedAmount refundStatus")
      .exec();
  }

  async findByRefundId(refundId) {
    return await Refund.findOne({ refundId })
      .populate({
        path: "orderId",
        select: "orderNumber totalAmount paymentStatus paymentMethod status createdAt userId sellerId items cancellation refundSummary shippingAddress billingAddress",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "sellerId", select: "companyName shopName supportPhone" },
        ],
      })
      .populate("paymentId", "amount status method razorpayPaymentId refundedAmount refundStatus")
      .exec();
  }

  async list({ status, startDate, endDate, limit = 100 } = {}) {
    const query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    return await Refund.find(query)
      .populate({
        path: "orderId",
        select: "orderNumber totalAmount paymentStatus paymentMethod status createdAt userId sellerId items cancellation refundSummary shippingAddress billingAddress",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "sellerId", select: "companyName shopName supportPhone" },
        ],
      })
      .populate("paymentId", "amount status method razorpayPaymentId refundedAmount refundStatus")
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async updateById(id, updateData = {}) {
    return await Refund.findByIdAndUpdate(id, asUpdateDocument(updateData), { returnDocument: "after" })
      .populate({
        path: "orderId",
        select: "orderNumber totalAmount paymentStatus paymentMethod status createdAt userId sellerId items cancellation refundSummary shippingAddress billingAddress",
        populate: [
          { path: "userId", select: "name email phone" },
          { path: "sellerId", select: "companyName shopName supportPhone" },
        ],
      })
      .populate("paymentId", "amount status method razorpayPaymentId refundedAmount refundStatus")
      .exec();
  }
}

module.exports = new RefundRepository();

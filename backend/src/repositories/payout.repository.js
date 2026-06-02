const { Payout } = require("../models/Payout");

function asUpdateDocument(updateData = {}) {
  const keys = Object.keys(updateData || {});
  if (keys.some((key) => key.startsWith("$"))) return updateData;
  return { $set: updateData };
}

class PayoutRepository {
  async create(data) {
    const payout = new Payout(data);
    return await payout.save();
  }

  async findById(id) {
    return await Payout.findById(id)
      .populate("sellerId", "companyName supportEmail supportPhone")
      .populate("orderId", "orderNumber totalAmount paymentMethod paymentStatus status createdAt deliveredAt")
      .exec();
  }

  async findByOrderId(orderId) {
    return await Payout.find({ orderId })
      .populate("sellerId", "companyName supportEmail supportPhone")
      .populate("orderId", "orderNumber totalAmount paymentMethod paymentStatus status createdAt deliveredAt")
      .exec();
  }

  async updateStatus(orderId, status, transferId = null, extra = {}) {
    const update = { status, ...extra };
    if (transferId) update.transferId = transferId;
    return await Payout.findOneAndUpdate({ orderId }, asUpdateDocument(update), { returnDocument: "after" })
      .populate("sellerId", "companyName supportEmail supportPhone")
      .populate("orderId", "orderNumber totalAmount paymentMethod paymentStatus status createdAt deliveredAt")
      .exec();
  }

  async findPendingBySeller(sellerId) {
    return await Payout.find({ sellerId, status: { $in: ["PENDING", "QUEUED", "ON_HOLD"] } })
      .populate("orderId", "orderNumber totalAmount paymentMethod paymentStatus status createdAt deliveredAt")
      .exec();
  }

  async findEligibleForQueue(now = new Date()) {
    return await Payout.find({
      status: { $in: ["PENDING", "ON_HOLD"] },
      scheduledFor: { $lte: now },
    })
      .populate("sellerId", "companyName supportEmail supportPhone")
      .populate("orderId", "orderNumber totalAmount paymentMethod paymentStatus status createdAt deliveredAt")
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

    return await Payout.find(query)
      .populate("sellerId", "companyName supportEmail supportPhone")
      .populate("orderId", "orderNumber totalAmount paymentMethod paymentStatus status createdAt deliveredAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async updateById(id, updateData = {}) {
    return await Payout.findByIdAndUpdate(id, asUpdateDocument(updateData), { returnDocument: "after" })
      .populate("sellerId", "companyName supportEmail supportPhone")
      .populate("orderId", "orderNumber totalAmount paymentMethod paymentStatus status createdAt deliveredAt")
      .exec();
  }
}

module.exports = new PayoutRepository();

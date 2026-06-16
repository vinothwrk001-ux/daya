const { WhatsAppMessageLog } = require("../models/WhatsAppMessageLog");

class WhatsAppMessageLogRepository {
  async create(payload) {
    const log = new WhatsAppMessageLog(payload);
    return await log.save();
  }

  async findById(id) {
    return await WhatsAppMessageLog.findById(id).exec();
  }

  async findByTwilioSid(twilioSid) {
    if (!twilioSid) return null;
    return await WhatsAppMessageLog.findOne({ twilioSid }).exec();
  }

  async findByOrderId(orderId, { limit = 20 } = {}) {
    return await WhatsAppMessageLog.find({ orderId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findPendingRetries(now = new Date(), limit = 25) {
    return await WhatsAppMessageLog.find({
      status: "Retrying",
      nextRetryAt: { $lte: now },
      $expr: { $lt: ["$retryCount", "$maxRetries"] },
    })
      .sort({ nextRetryAt: 1 })
      .limit(limit)
      .exec();
  }

  async updateById(id, update = {}) {
    return await WhatsAppMessageLog.findByIdAndUpdate(id, update, { returnDocument: "after" }).exec();
  }

  async list({
    page = 1,
    limit = 20,
    status,
    messageType,
    search,
    orderId,
    sortBy = "createdAt",
    sortOrder = -1,
  } = {}) {
    const query = {};
    if (status) query.status = status;
    if (messageType) query.messageType = messageType;
    if (orderId) query.orderId = orderId;
    if (search) {
      const value = String(search).trim();
      if (value) {
        query.$or = [
          { phone: { $regex: value, $options: "i" } },
          { twilioSid: { $regex: value, $options: "i" } },
          { lastError: { $regex: value, $options: "i" } },
        ];
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder };

    const [logs, total] = await Promise.all([
      WhatsAppMessageLog.find(query)
        .populate("orderId", "orderNumber status")
        .populate("customerId", "name email phone")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      WhatsAppMessageLog.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

module.exports = new WhatsAppMessageLogRepository();

const { WebhookEvent } = require("../models/WebhookEvent");

function asUpdateDocument(updateData = {}) {
  const keys = Object.keys(updateData || {});
  if (keys.some((key) => key.startsWith("$"))) return updateData;
  return { $set: updateData };
}

class WebhookEventRepository {
  async create(data) {
    const event = new WebhookEvent(data);
    return await event.save();
  }

  async findByEventId(eventId) {
    return await WebhookEvent.findOne({ eventId }).exec();
  }

  async list({ provider, eventType, limit = 50 } = {}) {
    const query = {};
    if (provider) query.provider = provider;
    if (eventType) query.eventType = eventType;
    return await WebhookEvent.find(query).sort({ createdAt: -1 }).limit(limit).exec();
  }

  async updateById(id, updateData = {}) {
    return await WebhookEvent.findByIdAndUpdate(id, asUpdateDocument(updateData), { returnDocument: "after" }).exec();
  }
}

module.exports = new WebhookEventRepository();

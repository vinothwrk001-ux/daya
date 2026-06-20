const { AuditLog } = require("../models/AuditLog");
const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");
const { normalizeAuditActor } = require("../utils/auditActor");

class AuditService {
  async log({
    actor,
    guestSessionId = null,
    action,
    entityType,
    entityId,
    status = "SUCCESS",
    metadata,
    ipAddress,
    userAgent,
  }) {
    const normalizedActor = normalizeAuditActor(actor, { guestSessionId });

    return await AuditLog.create({
      actorType: normalizedActor.actorType,
      actorId: normalizedActor.actorId,
      actorRole: normalizedActor.actorRole,
      guestSessionId: normalizedActor.guestSessionId,
      action,
      entityType,
      entityId,
      status,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  async list({ page = 1, limit = 20, action, actorRole, entityType, status, startDate, endDate } = {}) {
    const query = {};
    if (action) query.action = action;
    if (actorRole) query.actorRole = actorRole;
    if (entityType) query.entityType = entityType;
    if (status) query.status = status;
    applyDateRange(query, normalizeDateRange({ startDate, endDate }));

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("actorId", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = new AuditService();

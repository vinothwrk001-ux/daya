const mongoose = require("mongoose");
const { Notification } = require("../models/Notification");
const { User } = require("../models/User");
const { Staff } = require("../modules/staff/models/Staff");
const { ADMIN_ROLES, hasPermission: hasAdminPermission, normalizeRole } = require("../utils/adminPermissions");
const { hasStaffPermission } = require("../modules/staff/permissions");

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(value);
}

function normalizeActor(actor = {}) {
  return {
    userId: toObjectId(actor.userId || actor.sub),
    role: String(actor.role || "").toUpperCase(),
  };
}

async function getAdminRecipientIds(permissionKey) {
  const admins = await User.find({
    role: { $in: ADMIN_ROLES },
    status: "active",
  }).select("_id role").lean();

  return admins
    .filter((admin) => !permissionKey || hasAdminPermission(admin.role, permissionKey))
    .map((admin) => admin._id);
}

async function getStaffRecipientIds(permissionKey) {
  const staffMembers = await Staff.find({ status: "active" })
    .populate("roleId", "permissions")
    .select("_id roleId")
    .lean();

  return staffMembers
    .filter((staff) => !permissionKey || hasStaffPermission(staff.roleId?.permissions || {}, permissionKey))
    .map((staff) => staff._id);
}

class NotificationService {
  resolveRoleFromAuthUser(user = {}) {
    const normalizedRole = normalizeRole(user.role);
    if (normalizedRole === "staff") return "STAFF";
    if (ADMIN_ROLES.includes(normalizedRole)) return "ADMIN";
    return null;
  }

  async createNotification(payload) {
    const doc = {
      userId: toObjectId(payload.userId),
      role: String(payload.role || "").toUpperCase(),
      module: String(payload.module || "").toUpperCase(),
      subModule: String(payload.subModule || "").toUpperCase(),
      type: String(payload.type || "").toUpperCase(),
      title: payload.title,
      message: payload.message,
      referenceId: payload.referenceId || null,
      meta: payload.meta,
    };

    return await Notification.create(doc);
  }

  async createNotifications(payloads = []) {
    const docs = payloads
      .filter((payload) => payload?.userId)
      .map((payload) => ({
        userId: toObjectId(payload.userId),
        role: String(payload.role || "").toUpperCase(),
        module: String(payload.module || "").toUpperCase(),
        subModule: String(payload.subModule || "").toUpperCase(),
        type: String(payload.type || "").toUpperCase(),
        title: payload.title,
        message: payload.message,
        referenceId: payload.referenceId || null,
        meta: payload.meta,
      }));

    if (!docs.length) return [];
    return await Notification.insertMany(docs, { ordered: false });
  }

  async notifyAdmins(payload, permissionKey = null) {
    const userIds = await getAdminRecipientIds(permissionKey);
    return await this.createNotifications(
      userIds.map((userId) => ({
        ...payload,
        userId,
        role: "ADMIN",
      }))
    );
  }

  async notifyStaff(payload, permissionKey = null) {
    const userIds = await getStaffRecipientIds(permissionKey);
    return await this.createNotifications(
      userIds.map((userId) => ({
        ...payload,
        userId,
        role: "STAFF",
      }))
    );
  }

  async notifyOperations(payload, permissionKey = null) {
    await Promise.all([
      this.notifyAdmins(payload, permissionKey),
      this.notifyStaff(payload, permissionKey),
    ]);
  }

  buildActorFilter(actor) {
    const normalized = normalizeActor(actor);
    return {
      userId: normalized.userId,
      role: normalized.role,
    };
  }

  async getSummary(actor) {
    const baseMatch = {
      ...this.buildActorFilter(actor),
      isRead: false,
    };

    const [total, modules, subModules] = await Promise.all([
      Notification.countDocuments(baseMatch),
      Notification.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$module", count: { $sum: 1 } } },
      ]),
      Notification.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$subModule", count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total,
      unreadCount: total,
      modules: Object.fromEntries(modules.map((item) => [item._id, item.count])),
      subModules: Object.fromEntries(subModules.map((item) => [item._id, item.count])),
    };
  }

  async listNotifications(actor, query = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = this.buildActorFilter(actor);

    if (query.module) filter.module = String(query.module).toUpperCase();
    if (query.subModule) filter.subModule = String(query.subModule).toUpperCase();
    if (query.isRead != null) filter.isRead = String(query.isRead) === "true";

    const [notifications, total, summary] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      this.getSummary(actor),
    ]);

    return {
      notifications,
      unreadCount: summary.total,
      totalUnread: summary.total,
      total: summary.total,
      modules: summary.modules,
      subModules: summary.subModules,
      summary,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markRead(actor, payload = {}) {
    const filter = {
      ...this.buildActorFilter(actor),
      isRead: false,
    };

    if (Array.isArray(payload.notificationIds) && payload.notificationIds.length > 0) {
      filter._id = {
        $in: payload.notificationIds.filter(Boolean).map((id) => toObjectId(id)),
      };
    }
    if (payload.module) filter.module = String(payload.module).toUpperCase();
    if (payload.subModule) filter.subModule = String(payload.subModule).toUpperCase();

    const result = await Notification.updateMany(filter, {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0,
      summary: await this.getSummary(actor),
    };
  }
}

module.exports = new NotificationService();

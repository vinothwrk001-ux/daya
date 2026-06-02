const { Session } = require("../models/Session");

async function create(data) {
  return await Session.create(data);
}

async function findById(id) {
  return await Session.findById(id).exec();
}

async function updateById(id, update) {
  return await Session.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after" }).exec();
}

async function revokeById(id) {
  return await Session.findByIdAndUpdate(id, { $set: { revokedAt: new Date() } }, { returnDocument: "after" }).exec();
}

async function revokeAllForUser(userId) {
  return await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  ).exec();
}

async function listActiveForUser(userId) {
  return await Session.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastUsedAt: -1, createdAt: -1 })
    .exec();
}

module.exports = {
  create,
  findById,
  updateById,
  revokeById,
  revokeAllForUser,
  listActiveForUser,
};

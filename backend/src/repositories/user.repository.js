const { User } = require("../models/User");
const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");

async function createUser(data) {
  const user = await User.create(data);
  return user;
}

async function findByEmail(email, { includePassword = false } = {}) {
  if (!email) return null;
  const q = User.findOne({ email: email.toLowerCase() });
  if (includePassword) q.select("+password");
  return await q.exec();
}

async function findByName(name, { includePassword = false } = {}) {
  if (!name) return null;
  const q = User.findOne({ name: name.trim() });
  if (includePassword) q.select("+password");
  return await q.exec();
}

async function findByPhone(phone, { includePassword = false } = {}) {
  if (!phone) return null;
  const q = User.findOne({ phone: phone.trim() });
  if (includePassword) q.select("+password");
  return await q.exec();
}

async function findById(id, { includePassword = false } = {}) {
  const q = User.findById(id);
  if (includePassword) q.select("+password");
  return await q.exec();
}

async function updateById(id, update) {
  return await User.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after" }).exec();
}

async function deleteById(id) {
  return await User.findByIdAndDelete(id).exec();
}

async function listUsers({ role, startDate, endDate } = {}) {
  const query = {};
  if (role) query.role = role;
  applyDateRange(query, normalizeDateRange({ startDate, endDate }));
  return await User.find(query).sort({ createdAt: -1 }).exec();
}

async function countUsers(query = {}) {
  return await User.countDocuments(query);
}

module.exports = {
  createUser,
  findByEmail,
  findByPhone,
  findByName,
  findById,
  updateById,
  deleteById,
  listUsers,
  countUsers,
};

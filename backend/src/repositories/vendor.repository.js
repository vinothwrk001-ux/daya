const { Vendor } = require("../models/Vendor");
require("../models/User");
const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");

function buildVendorCodeFromId(id) {
  const raw = String(id || "").replace(/[^a-fA-F0-9]/g, "");
  const suffix = raw.slice(-8).toUpperCase().padStart(8, "0");
  return `VND-${suffix}`;
}

async function ensureVendorCodes(vendors = []) {
  const missing = vendors.filter((vendor) => !vendor.vendorCode && vendor._id);
  if (!missing.length) return vendors;
  await Promise.all(
    missing.map((vendor) =>
      Vendor.updateOne(
        { _id: vendor._id, $or: [{ vendorCode: { $exists: false } }, { vendorCode: null }, { vendorCode: "" }] },
        { $set: { vendorCode: buildVendorCodeFromId(vendor._id) } }
      ).exec()
    )
  );
  return vendors.map((vendor) => ({
    ...vendor,
    vendorCode: vendor.vendorCode || buildVendorCodeFromId(vendor._id),
  }));
}

async function ensureVendorCodeDocument(vendor) {
  if (!vendor) return vendor;
  if (vendor.vendorCode || !vendor._id) return vendor;
  const vendorCode = buildVendorCodeFromId(vendor._id);
  await Vendor.updateOne(
    { _id: vendor._id, $or: [{ vendorCode: { $exists: false } }, { vendorCode: null }, { vendorCode: "" }] },
    { $set: { vendorCode } }
  ).exec();
  vendor.vendorCode = vendorCode;
  return vendor;
}

async function findByUserId(userId) {
  const vendor = await Vendor.findOne({ userId }).exec();
  return await ensureVendorCodeDocument(vendor);
}

async function upsertByUserId(userId, update) {
  const vendor = await Vendor.findOneAndUpdate(
    { userId },
    { $set: update, $setOnInsert: { userId } },
    { returnDocument: "after", upsert: true }
  ).exec();
  return await ensureVendorCodeDocument(vendor);
}

async function listVendors({ status, startDate, endDate } = {}) {
  const query = {};
  if (status) query.status = status;
  applyDateRange(query, normalizeDateRange({ startDate, endDate }));
  const vendors = await Vendor.find(query)
    .populate("userId", "name email phone role status createdAt")
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  return await ensureVendorCodes(vendors);
}

async function findById(id) {
  const vendor = await Vendor.findById(id)
    .populate("userId", "name email phone role status createdAt")
    .lean()
    .exec();
  if (!vendor) return null;
  const [resolved] = await ensureVendorCodes([vendor]);
  return resolved;
}

async function updateById(id, update) {
  const vendor = await Vendor.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after" })
    .populate("userId", "name email phone role status createdAt")
    .exec();
  return await ensureVendorCodeDocument(vendor);
}

async function deleteById(id) {
  return await Vendor.findByIdAndDelete(id).exec();
}

async function countVendors(query = {}) {
  return await Vendor.countDocuments(query);
}

async function listAll() {
  const vendors = await Vendor.find().exec();
  return await Promise.all(vendors.map((vendor) => ensureVendorCodeDocument(vendor)));
}

module.exports = {
  findByUserId,
  upsertByUserId,
  listVendors,
  findById,
  updateById,
  deleteById,
  countVendors,
  listAll,
};

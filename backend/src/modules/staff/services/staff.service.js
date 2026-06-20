const bcrypt = require("bcryptjs");
const { AppError } = require("../../../utils/AppError");
const { Staff } = require("../models/Staff");

function normalizeStaff(staffDoc) {
  const staff = staffDoc.toObject ? staffDoc.toObject() : staffDoc;
  return {
    _id: staff._id,
    name: staff.name,
    email: staff.email,
    phone: staff.phone,
    status: staff.status,
    lastLogin: staff.lastLogin,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
    role: staff.roleId && typeof staff.roleId === "object"
      ? {
          _id: staff.roleId._id,
          name: staff.roleId.name,
          description: staff.roleId.description,
          permissions: staff.roleId.permissions,
        }
      : staff.roleId,
  };
}

async function getStaffById(staffId) {
  const staff = await Staff.findById(staffId).populate("roleId").select("+password");
  if (!staff) throw new AppError("Staff account not found", 404, "NOT_FOUND");
  return staff;
}

module.exports = {
  normalizeStaff,
  getStaffById,
};

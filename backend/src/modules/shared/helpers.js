const mongoose = require("mongoose");
const { AppError } = require("../../utils/AppError");

function asObjectId(id, fieldName = "id") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  }
  return new mongoose.Types.ObjectId(id);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function nowPlusHours(hours) {
  return new Date(Date.now() + Number(hours || 0) * 60 * 60 * 1000);
}

module.exports = {
  asObjectId,
  roundMoney,
  nowPlusHours,
};

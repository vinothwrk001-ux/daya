const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    views: {
      type: Number,
      default: 0,
    },
    salesCount: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

module.exports = analyticsSchema;

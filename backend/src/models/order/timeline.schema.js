const mongoose = require("mongoose");

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

module.exports = timelineSchema;

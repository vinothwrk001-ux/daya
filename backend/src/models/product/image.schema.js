const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    altText: String,
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

module.exports = imageSchema;

require('dotenv').config();
const mongoose = require('mongoose');
const CustomTShirtColor = require('./src/models/CustomTShirtColor');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecomm";

const seedColors = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const colors = [
      { name: "BLACK", hex: "#1a1a1a", availableInGsm: ["180", "220"], displayOrder: 1 },
      { name: "WHITE", hex: "#f8f8f8", border: true, availableInGsm: ["180", "220"], displayOrder: 2 },
      { name: "NAVY BLUE", hex: "#1f2937", availableInGsm: ["180", "220"], displayOrder: 3 },
      { name: "MAROON", hex: "#7f1d1d", availableInGsm: ["180", "220"], displayOrder: 4 },
      { name: "RED", hex: "#dc2626", availableInGsm: ["180", "220"], displayOrder: 5 },
      { name: "OLIVE GREEN", hex: "#4d7c0f", availableInGsm: ["180", "220"], displayOrder: 6 },
      { name: "BEIGE", hex: "#d6d3d1", availableInGsm: ["180", "220"], displayOrder: 7 },
      { name: "CHARCOAL", hex: "#3f3f46", availableInGsm: ["180", "220"], displayOrder: 8 },
    ];

    await CustomTShirtColor.deleteMany({});
    console.log("Cleared existing colors");

    await CustomTShirtColor.insertMany(colors);
    console.log("Seeded colors successfully!");

    process.exit(0);
  } catch (err) {
    console.error("Failed to seed colors", err);
    process.exit(1);
  }
};

seedColors();

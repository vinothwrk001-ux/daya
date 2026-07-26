const mongoose = require("mongoose");
const { User } = require("./src/models/User");
require("dotenv").config();

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    
    try {
      await User.collection.dropIndex("phone_1");
      console.log("Dropped phone_1 index");
    } catch (e) {
      console.log("phone_1 index might not exist or already dropped", e.message);
    }
    
    await User.syncIndexes();
    console.log("Indexes synced");
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fixIndexes();

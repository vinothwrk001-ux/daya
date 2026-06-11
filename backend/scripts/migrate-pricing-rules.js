/**
 * Migration Script: Seed Pricing Rules from Legacy PricingConfig
 * 
 * This script migrates existing pricing configuration to the new
 * dynamic pricing rules system.
 * 
 * Usage:
 * node scripts/migrate-pricing-rules.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

// Import models
const PricingConfig = require("../src/models/PricingConfig");
const PricingRule = require("../src/models/PricingRule");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/uchooseme";

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✓ Connected to MongoDB");
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

async function migratePricingRules() {
  console.log("\n📦 Starting Pricing Rules Migration...\n");

  try {
    // Check if rules already exist
    const existingRules = await PricingRule.countDocuments();
    if (existingRules > 0) {
      console.log(`⚠️  ${existingRules} pricing rules already exist.`);
      const answer = await promptUser("Continue anyway? (yes/no): ");
      if (answer.toLowerCase() !== "yes") {
        console.log("Migration cancelled.");
        return;
      }
    }

    // Get legacy pricing config
    const config = await PricingConfig.findOne({ isActive: true });
    if (!config) {
      console.log("✗ No active PricingConfig found. Create one first.");
      return;
    }

    console.log("📋 Found legacy PricingConfig:", config._id);
    console.log("   - Delivery Fee: ₹" + config.deliveryFee);
    console.log("   - Platform Fee: " + config.platformFeePercentage + "%");
    console.log("   - Tax: " + config.taxPercentage + "%\n");

    const rulesToCreate = [];

    // 1. Delivery Fee Rule
    rulesToCreate.push({
      key: "delivery_fee",
      displayName: "Delivery Fee",
      description: "Standard delivery charge",
      type: "FIXED",
      value: config.deliveryFee || 50,
      appliesTo: "ORDER",
      category: "DELIVERY",
      sortOrder: 10,
      minOrderValue: 0,
      freeAboveValue: config.deliveryFreeAbove || 500,
      maxCap: 0,
      isActive: true,
      notes: "Migrated from legacy PricingConfig",
    });

    // 2. Platform Fee Rule
    rulesToCreate.push({
      key: "platform_fee",
      displayName: "Platform Fee",
      description: "Platform fee on orders",
      type: "PERCENTAGE",
      value: config.platformFeePercentage || 5,
      appliesTo: "ORDER",
      category: "PLATFORM_FEE",
      sortOrder: 20,
      minOrderValue: 0,
      freeAboveValue: 0,
      maxCap: config.platformFeeCapped || 0,
      isActive: true,
      notes: "Migrated from legacy PricingConfig",
    });

    // 3. Tax Rule
    rulesToCreate.push({
      key: "gst",
      displayName: "GST/Tax",
      description: "Goods and Services Tax",
      type: "PERCENTAGE",
      value: config.taxPercentage || 18,
      appliesTo: "ORDER",
      category: "TAX",
      sortOrder: 30,
      minOrderValue: 0,
      freeAboveValue: 0,
      maxCap: 0,
      isActive: true,
      notes: "Migrated from legacy PricingConfig",
    });

    // 4. Handling Fee Rule (if set)
    if (config.handlingFee && config.handlingFee > 0) {
      rulesToCreate.push({
        key: "handling_fee",
        displayName: "Handling/Packaging Fee",
        description: "Order handling and packaging fee",
        type: "FIXED",
        value: config.handlingFee,
        appliesTo: "ORDER",
        category: "HANDLING",
        sortOrder: 25,
        minOrderValue: 0,
        freeAboveValue: 0,
        maxCap: 0,
        isActive: true,
        notes: "Migrated from legacy PricingConfig",
      });
    }

    // Insert all rules
    console.log("🚀 Creating pricing rules...\n");
    const createdRules = await PricingRule.insertMany(rulesToCreate);
    
    console.log(`✓ Successfully created ${createdRules.length} pricing rules:\n`);
    createdRules.forEach((rule) => {
      const value = rule.type === "PERCENTAGE" ? rule.value + "%" : "₹" + rule.value;
      console.log(`  ✓ ${rule.displayName} (${rule.key}): ${value}`);
    });

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("  1. Go to Admin > Pricing Management");
    console.log("  2. Switch to 'Pricing Rules' tab");
    console.log("  3. Verify all rules are present");
    console.log("  4. Test checkout to ensure totals are calculated correctly");
  } catch (error) {
    console.error("\n✗ Migration failed:", error.message);
    console.error(error);
  }
}

async function promptUser(question) {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   Pricing Rules Migration Script       ║");
  console.log("╚════════════════════════════════════════╝");

  await connectDB();
  await migratePricingRules();

  console.log("\n");
  await mongoose.disconnect();
  console.log("✓ Disconnected from MongoDB\n");
}

// Run migration
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

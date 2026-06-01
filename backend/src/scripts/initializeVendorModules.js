const { logger } = require("../utils/logger");
/**
 * Script to initialize Vendor Modules
 * Run this script once during app setup
 * 
 * Usage: node scripts/initializeVendorModules.js
 */

require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const vendorModuleService = require("../src/services/vendorModule.service");

async function initializeModules() {
  try {
    logger.info("script_output", { value: "🔄 Connecting to database..." });
    
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI not defined in .env");
    }

    await mongoose.connect(mongoUri);
    logger.info("script_output", { value: "✅ Connected to MongoDB" });

    logger.info("script_output", { value: "🔄 Initializing vendor modules..." });
    await vendorModuleService.initializeModules();
    logger.info("script_output", { value: "✅ Vendor modules initialized successfully" });

    const modules = await vendorModuleService.getAllModules();
    logger.info("script_output", { value: "\n📦 Initialized Modules:" });
    modules.forEach((module) => {
      logger.info("script_output", { value: `  • ${module.name} (${module.key})` });
      logger.info("script_output", { value: `    - Global: ${module.enabled ? "✅ Enabled" : "❌ Disabled"}` });
      logger.info("script_output", { value: `    - Vendors: ${module.vendorEnabled ? "✅ Enabled" : "❌ Disabled"}` });
    });

    const stats = await vendorModuleService.getModuleStats();
    logger.info("script_output", { value: "\n📊 Module Statistics:" });
    logger.info("script_output", { value: `  • Total: ${stats.total}` });
    logger.info("script_output", { value: `  • Enabled Globally: ${stats.enabledGlobally}` });
    logger.info("script_output", { value: `  • Enabled for Vendors: ${stats.enabledForVendors}` });
    logger.info("script_output", { value: `  • Disabled for Vendors: ${stats.disabledForVendors}` });

    logger.info("script_output", { value: "\n✨ Done! Vendor module system is ready." });
  } catch (error) {
    logger.error("❌ Error initializing modules:", { error: error.message });
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

initializeModules();

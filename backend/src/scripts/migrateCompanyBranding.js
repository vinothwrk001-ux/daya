const { logger } = require("../utils/logger");
require("../config/env");

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const CompanyBranding = require("../models/CompanyBranding");

async function main() {
  await connectDB();
  await CompanyBranding.syncIndexes();
  await CompanyBranding.updateOne(
    { tenantType: "platform", tenantKey: "default" },
    {
      $setOnInsert: {
        companyName: "UChooseMe",
        legalCompanyName: "GRM Commerce",
        tagline: "Premium marketplace experiences at enterprise scale.",
        supportEmail: "support@uchooseme.com",
        supportPhone: "+91 00000 00000",
        websiteUrl: "https://www.uchooseme.com",
      },
    },
    { upsert: true }
  );
  logger.info("script_output", { value: "Company branding migration complete." });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  logger.error("Company branding migration failed:", { error: error });
  await mongoose.disconnect();
  process.exitCode = 1;
});

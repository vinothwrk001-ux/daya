const { logger } = require("../utils/logger");
require("../config/env");

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const CompanyBranding = require("../models/CompanyBranding");

async function main() {
  await connectDb();
  await CompanyBranding.syncIndexes();
  await CompanyBranding.updateOne(
    { tenantType: "platform", tenantKey: "default" },
    {
      $set: {
        companyName: "DayaCreatives",
        legalCompanyName: "DayaCreatives",
        tagline: "Premium marketplace experiences at enterprise scale.",
        supportEmail: "support@dayacreatives.com",
        supportPhone: "+91 00000 00000",
        websiteUrl: "https://www.dayacreatives.com",
        "footer.copyrightText": "© 2026 DayaCreatives. All rights reserved.",
        "seoBranding.organizationName": "DayaCreatives",
        "seoBranding.organizationUrl": "https://www.dayacreatives.com",
      },
      $setOnInsert: {
        tenantType: "platform",
        tenantKey: "default",
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

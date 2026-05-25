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
  console.log("Company branding migration complete.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Company branding migration failed:", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});

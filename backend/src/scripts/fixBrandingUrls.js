require("../config/env");
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const CompanyBranding = require("../models/CompanyBranding");

async function main() {
  await connectDb();
  await CompanyBranding.updateOne(
    { tenantType: "platform", tenantKey: "default" },
    {
      $set: {
        websiteUrl: "https://www.dayacreatives.com",
        legalCompanyName: "DayaCreatives",
        "seoBranding.organizationUrl": "https://www.dayacreatives.com",
      },
    }
  );
  console.log("Branding URLs normalized");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});

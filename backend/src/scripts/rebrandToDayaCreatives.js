require("../config/env");

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const CompanyBranding = require("../models/CompanyBranding");
const { logger } = require("../utils/logger");

const REPLACEMENTS = [
  { find: /UChooseMe/gi, replace: "DayaCreatives" },
  { find: /uchooseme\.com/gi, replace: "dayacreatives.com" },
];

function replaceBrandStrings(value) {
  if (typeof value !== "string" || !value) return value;
  let next = value;
  for (const { find, replace } of REPLACEMENTS) {
    next = next.replace(find, replace);
  }
  return next;
}

function rebrandObject(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => rebrandObject(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rebrandObject(entry)]));
  }
  return replaceBrandStrings(value);
}

async function main() {
  await connectDb();

  const records = await CompanyBranding.find({}).lean();
  let updated = 0;

  for (const record of records) {
    const rebranded = rebrandObject(record);
    const hasChanges = JSON.stringify(record) !== JSON.stringify(rebranded);
    if (!hasChanges) continue;

    await CompanyBranding.updateOne(
      { _id: record._id },
      {
        $set: {
          companyName: rebranded.companyName || "DayaCreatives",
          legalCompanyName: rebranded.legalCompanyName || record.legalCompanyName,
          tagline: rebranded.tagline || record.tagline,
          supportEmail: rebranded.supportEmail || "support@dayacreatives.com",
          websiteUrl: replaceBrandStrings(rebranded.websiteUrl || "https://www.dayacreatives.com").replace(
            /https:\/\/www\.DayaCreatives\.com/i,
            "https://www.dayacreatives.com"
          ),
          footer: rebranded.footer || record.footer,
          seoBranding: rebranded.seoBranding || record.seoBranding,
        },
      }
    );
    updated += 1;
  }

  await CompanyBranding.updateMany(
    { companyName: { $in: [null, ""] } },
    {
      $set: {
        companyName: "DayaCreatives",
        supportEmail: "support@dayacreatives.com",
        websiteUrl: "https://www.dayacreatives.com",
      },
    }
  );

  logger.info("rebrandToDayaCreatives complete", { scanned: records.length, updated });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  logger.error("rebrandToDayaCreatives failed", { error });
  await mongoose.disconnect();
  process.exitCode = 1;
});

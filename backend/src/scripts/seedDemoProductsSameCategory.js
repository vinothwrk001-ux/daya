const { logger } = require("../utils/logger");
require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { Category } = require("../models/Category");
const { Product } = require("../models/Product");
const { Subcategory } = require("../models/Subcategory");
const { User } = require("../models/User");
const { generateNextProductNumber } = require("../services/product-number.service");
const { generateSlug } = require("../utils/slug");

const PLATFORM_EMAIL = process.env.PLATFORM_STORE_EMAIL || "platform-store@grm.local";
const PLATFORM_PHONE = process.env.PLATFORM_STORE_PHONE || "9000000000";
const PLACEHOLDER = "https://placehold.co/800x800/png";

const demoProducts = [
  ["Essential Starter Pack", 1299, 999, 45],
  ["Premium Daily Choice", 1899, 1499, 38],
  ["Classic Value Edition", 999, 799, 60],
  ["Smart Compact Model", 2499, 2099, 28],
  ["Pro Performance Series", 3499, 2999, 22],
  ["Lite Everyday Variant", 799, 599, 75],
  ["Signature Comfort Pick", 1599, 1299, 34],
  ["Advanced Plus Model", 2799, 2399, 26],
  ["Budget Saver Combo", 699, 499, 90],
  ["Elite Finish Edition", 4299, 3799, 18],
  ["Urban Utility Pack", 1199, 899, 52],
  ["Modern Essentials Kit", 2199, 1799, 31],
  ["Quick Use Standard", 899, 699, 68],
  ["Heavy Duty Choice", 3299, 2899, 20],
  ["Compact Travel Edition", 1399, 1099, 44],
  ["Family Value Pack", 2599, 2199, 25],
  ["Professional Grade", 4999, 4499, 14],
  ["Mini Starter Variant", 599, 449, 95],
  ["Deluxe Retail Pack", 3799, 3299, 17],
  ["All Rounder Edition", 1999, 1599, 36],
];

function getArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : "";
}

function getCategoryInput() {
  return getArg("category") || getArg("categoryId") || process.env.DEMO_CATEGORY;
}

function getSubcategoryInput() {
  return getArg("subcategory") || getArg("subcategoryId") || process.env.DEMO_SUBCATEGORY;
}

function usage() {
  return [
    "Usage:",
    "  npm.cmd run seed:demo-products -- --category=\"Category Name\" --subcategory=\"Subcategory Name\"",
    "  npm.cmd run seed:demo-products -- --categoryId=<categoryId> --subcategoryId=<subcategoryId>",
    "",
    "Or add DEMO_CATEGORY and DEMO_SUBCATEGORY to backend/.env, then run:",
    "  npm.cmd run seed:demo-products",
  ].join("\n");
}

function assertTargetProvided() {
  if (getCategoryInput() && getSubcategoryInput()) return;
  throw new Error(`Missing category/subcategory target.\n\n${usage()}`);
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLookup(value) {
  if (!value) return null;
  if (isObjectId(value)) return { _id: value };

  return {
    $or: [
      { slug: generateSlug(value) },
      { name: new RegExp(`^${escapeRegex(value)}$`, "i") },
    ],
  };
}

function imageFor(name) {
  return `${PLACEHOLDER}?text=${encodeURIComponent(name)}`;
}

function skuPart(value) {
  return String(value || "DEMO")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8) || "DEMO";
}

async function ensurePlatformOwner() {
  let user = await User.findOne({ email: PLATFORM_EMAIL });
  if (!user) {
    user = await User.create({
      name: "Platform Store",
      email: PLATFORM_EMAIL,
      phone: PLATFORM_PHONE,
      password: await bcrypt.hash(process.env.PLATFORM_STORE_PASSWORD || "PlatformStore123", 12),
      role: "admin",
      roles: ["admin"],
      status: "active",
    });
  }

  return user;
}

async function findCategory() {
  const categoryInput = getCategoryInput();
  const lookup = buildLookup(categoryInput);
  if (!lookup) {
    throw new Error("Pass --category=\"Category Name\" or --categoryId=<id>. You can also set DEMO_CATEGORY in .env.");
  }

  const category = await Category.findOne(lookup);
  if (!category) {
    throw new Error(`Category not found for "${categoryInput}".`);
  }

  return category;
}

async function findSubcategory(categoryId) {
  const subcategoryInput = getSubcategoryInput();
  const lookup = buildLookup(subcategoryInput);
  if (!lookup) {
    throw new Error("Pass --subcategory=\"Subcategory Name\" or --subcategoryId=<id>. You can also set DEMO_SUBCATEGORY in .env.");
  }

  const subcategory = await Subcategory.findOne({ categoryId, ...lookup });
  if (!subcategory) {
    throw new Error(`Subcategory not found for "${subcategoryInput}" inside the selected category.`);
  }

  return subcategory;
}

async function upsertProduct({ owner, category, subcategory, item, index }) {
  const [label, price, discountPrice, stock] = item;
  const number = String(index + 1).padStart(2, "0");
  const name = `${subcategory.name} ${label} ${number}`;
  const slug = generateSlug(`${category.name}-${subcategory.name}-${label}-${number}`);
  const existing = await Product.findOne({ slug });
  const productNumber = existing?.productNumber || (await generateNextProductNumber({ categoryId: category._id, subCategoryId: subcategory._id }));
  const image = imageFor(name);

  const payload = {
    name,
    slug,
    description: `${name} is a demo catalog item seeded for testing product listing, filtering, cart, and checkout flows.`,
    shortDescription: `Demo ${subcategory.name} item for testing.`,
    category: category.name,
    categoryId: category._id,
    subCategory: subcategory.name,
    subCategoryId: subcategory._id,
    tags: ["demo", generateSlug(category.name), generateSlug(subcategory.name)],
    price,
    discountPrice,
    currency: "INR",
    stock,
    SKU: existing?.SKU || `DEMO-${skuPart(category.code || category.name)}-${skuPart(subcategory.code || subcategory.name)}-${number}`,
    productNumber,
    lowStockThreshold: 5,
    images: [{ url: image, altText: name, isPrimary: true, sortOrder: 0 }],
    thumbnail: image,
    createdBy: owner._id,
    creatorType: "ADMIN",
    status: "APPROVED",
    isActive: true,
    approvedAt: existing?.approvedAt || new Date(),
    weight: { value: 0.5 + (index % 5) * 0.2, unit: "kg" },
    dimensions: { length: 20 + index, width: 14, height: 8 },
    returnPolicy: "7 days replacement for manufacturing defects.",
    attributes: {
      brand: "Demo Brand",
      condition: "New",
      warranty: "6 months",
    },
    modulesData: {
      specifications: {
        brand: "Demo Brand",
        warranty: "6 months",
        demoBatch: "same-category-subcategory-20",
      },
    },
  };

  return Product.findOneAndUpdate(
    { slug },
    { $set: payload, $setOnInsert: { ratings: { averageRating: 0, totalReviews: 0 } } },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
  );
}

async function main() {
  assertTargetProvided();
  await connectDb();

  const owner = await ensurePlatformOwner();
  const category = await findCategory();
  const subcategory = await findSubcategory(category._id);
  const count = Math.min(Number(getArg("count") || process.env.DEMO_PRODUCT_COUNT || 20), demoProducts.length);

  const seeded = [];
  for (let index = 0; index < count; index += 1) {
    seeded.push(await upsertProduct({ owner, category, subcategory, item: demoProducts[index], index }));
  }

  logger.info("script_output", {
    value: `Seeded ${seeded.length} demo products in ${category.name} > ${subcategory.name}.`,
  });
  console.log(`Seeded ${seeded.length} demo products in ${category.name} > ${subcategory.name}.`);
  seeded.forEach((product) => logger.info("script_output", { value: `- ${product.productNumber} | ${product.name}` }));
  seeded.forEach((product) => console.log(`- ${product.productNumber} | ${product.name}`));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  logger.error("script_error", { error: err });
  console.error(err.message || err);
  await mongoose.disconnect();
  process.exit(1);
});

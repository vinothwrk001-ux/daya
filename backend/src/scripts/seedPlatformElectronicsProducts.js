require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { Category } = require("../models/Category");
const { Product } = require("../models/Product");
const { Subcategory } = require("../models/Subcategory");
const { User } = require("../models/User");
const { Vendor } = require("../models/Vendor");
const { generateNextProductNumber } = require("../services/product-number.service");
const { generateSlug } = require("../utils/slug");

const PLATFORM_EMAIL = process.env.PLATFORM_STORE_EMAIL || "platform-store@grm.local";
const PLATFORM_PHONE = process.env.PLATFORM_STORE_PHONE || "9000000000";
const PLACEHOLDER = "https://placehold.co/800x800/png";

const subcategories = [
  { name: "Mobiles", code: "MO" },
  { name: "Laptops", code: "LP" },
  { name: "Audio", code: "AU" },
  { name: "Accessories", code: "AC" },
];

const products = [
  ["Samsung Galaxy M17 5G", "Mobiles", 15999, 13999, 42, "Moonlight Silver, 4GB RAM, 128GB storage, 50MP OIS triple camera."],
  ["Redmi Note 14 Pro 5G", "Mobiles", 24999, 21999, 36, "AMOLED display, 67W fast charging, pro-grade camera system."],
  ["OnePlus Nord CE5 Lite", "Mobiles", 21999, 18999, 28, "Smooth 120Hz display, long battery life, slim everyday design."],
  ["iQOO Z10 Turbo 5G", "Mobiles", 28999, 25999, 22, "Gaming-ready processor, vapor cooling, fast charging support."],
  ["HP Pavilion 15 Ryzen 5", "Laptops", 64999, 58999, 18, "15.6 inch FHD laptop with 16GB RAM and 512GB SSD."],
  ["Lenovo IdeaPad Slim 3", "Laptops", 52999, 46999, 20, "Thin and light laptop for study, office, and entertainment."],
  ["ASUS Vivobook Go 14", "Laptops", 39999, 34999, 24, "Portable 14 inch laptop with fast SSD storage and full-day mobility."],
  ["Acer Aspire 7 Creator", "Laptops", 78999, 71999, 12, "Performance laptop with dedicated graphics for creators and gamers."],
  ["Sony WH-CH720N Headphones", "Audio", 14990, 9990, 30, "Wireless noise cancelling headphones with lightweight comfort."],
  ["boAt Airdopes Supreme ANC", "Audio", 4999, 2499, 80, "True wireless earbuds with active noise cancellation and low latency mode."],
  ["JBL Flip Essential 2", "Audio", 10999, 7499, 32, "Portable Bluetooth speaker with powerful sound and splash resistance."],
  ["Realme Buds Wireless 3", "Audio", 2999, 1899, 64, "Neckband earphones with deep bass and quick charge."],
  ["Logitech MX Master 3S", "Accessories", 10995, 8995, 25, "Wireless performance mouse with quiet clicks and precise scrolling."],
  ["Portronics Toad One Keyboard", "Accessories", 2499, 1799, 55, "Compact wireless keyboard for laptop, tablet, and desktop setups."],
  ["Samsung 25W USB-C Charger", "Accessories", 1999, 1299, 100, "Compact fast charger with USB-C power delivery support."],
  ["SanDisk Ultra 128GB USB-C Drive", "Accessories", 1499, 999, 90, "High-speed dual connector storage for phone and laptop transfers."],
];

function imageFor(name) {
  return `${PLACEHOLDER}?text=${encodeURIComponent(name)}`;
}

async function ensurePlatformStore() {
  let vendor = await Vendor.findOne({
    $or: [{ shopName: /^Platform Store$/i }, { companyName: /^Platform Store$/i }, { storeSlug: "platform-store" }],
  });
  if (vendor) return vendor;

  let user = await User.findOne({ email: PLATFORM_EMAIL });
  if (!user) {
    user = await User.create({
      name: "Platform Store",
      email: PLATFORM_EMAIL,
      phone: PLATFORM_PHONE,
      password: await bcrypt.hash(process.env.PLATFORM_STORE_PASSWORD || "PlatformStore123", 12),
      role: "vendor",
      status: "active",
    });
  }

  vendor = await Vendor.create({
    userId: user._id,
    companyName: "Platform Store",
    shopName: "Platform Store",
    storeSlug: "platform-store",
    storeDescription: "Products sold directly by the platform.",
    status: "approved",
    stepCompleted: 4,
    address: "Platform fulfillment center",
    noGst: true,
  });

  return vendor;
}

async function ensureElectronicsCategory() {
  return await Category.findOneAndUpdate(
    { slug: "electronics" },
    {
      $setOnInsert: {
        name: "Electronics",
        code: "E",
        slug: "electronics",
        icon: "smartphone",
        color: "#2563eb",
        isActive: true,
        order: 10,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
}

async function ensureSubcategories(categoryId) {
  const indexes = await Subcategory.collection.indexes();
  const staleGlobalSlugIndex = indexes.find((index) => index.name === "slug_1" && index.unique);
  if (staleGlobalSlugIndex) {
    await Subcategory.collection.dropIndex("slug_1");
    console.log("Dropped stale unique subcategories.slug_1 index.");
  }

  const entries = await Promise.all(
    subcategories.map((item) =>
      Subcategory.findOneAndUpdate(
        { categoryId, slug: generateSlug(item.name) },
        {
          $set: {
            categoryId,
            name: item.name,
            code: item.code,
            slug: generateSlug(item.name),
            status: "active",
          },
        },
        { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
      )
    )
  );

  return Object.fromEntries(entries.map((entry) => [entry.name, entry]));
}

async function upsertProduct(vendor, category, subcategoryByName, item, index) {
  const [name, subcategoryName, price, discountPrice, stock, description] = item;
  const subcategory = subcategoryByName[subcategoryName];
  const slug = generateSlug(name);
  const existing = await Product.findOne({ slug });
  const productNumber = existing?.productNumber || (await generateNextProductNumber({ categoryId: category._id, subCategoryId: subcategory._id }));
  const sku = existing?.SKU || `PLAT-ELEC-${String(index + 1).padStart(2, "0")}`;
  const image = imageFor(name);

  const payload = {
    name,
    slug,
    description,
    shortDescription: description,
    category: category.name,
    categoryId: category._id,
    subCategory: subcategory.name,
    subCategoryId: subcategory._id,
    tags: ["electronics", subcategory.name.toLowerCase(), "platform-store"],
    price,
    discountPrice,
    currency: "INR",
    stock,
    SKU: sku,
    productNumber,
    lowStockThreshold: 5,
    images: [{ url: image, altText: name, isPrimary: true, sortOrder: 0 }],
    thumbnail: image,
    sellerId: vendor._id,
    createdBy: vendor.userId,
    creatorType: "SELLER",
    status: "APPROVED",
    isActive: true,
    approvedAt: new Date(),
    weight: { value: subcategoryName === "Laptops" ? 1.8 : 0.5, unit: "kg" },
    dimensions: { length: 20, width: 15, height: 8 },
    returnPolicy: "7 days replacement for manufacturing defects.",
    attributes: {
      brand: name.split(" ")[0],
      warranty: "1 year",
      condition: "New",
    },
    modulesData: {
      specifications: {
        brand: name.split(" ")[0],
        warranty: "1 year",
      },
    },
  };

  return await Product.findOneAndUpdate(
    { slug },
    { $set: payload, $setOnInsert: { ratings: { averageRating: 0, totalReviews: 0 } } },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
  );
}

async function main() {
  await connectDb();

  const vendor = await ensurePlatformStore();
  const category = await ensureElectronicsCategory();
  const subcategoryByName = await ensureSubcategories(category._id);

  const seeded = [];
  for (let index = 0; index < products.length; index += 1) {
    seeded.push(await upsertProduct(vendor, category, subcategoryByName, products[index], index));
  }

  console.log(`Seeded ${seeded.length} electronics products under ${vendor.shopName}.`);
  seeded.forEach((product) => console.log(`- ${product.productNumber} | ${product.name}`));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

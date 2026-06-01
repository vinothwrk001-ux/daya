const { logger } = require("../utils/logger");
require("dotenv").config();

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { Product } = require("../models/Product");
const { Cart } = require("../models/Cart");
const { Order } = require("../models/Order");

async function run() {
  await connectDb();

  const updates = [];

  // Backfill currency only; do not modify numeric price fields.
  updates.push(
    Product.updateMany(
      { $or: [{ currency: { $exists: false } }, { currency: "USD" }] },
      { $set: { currency: "INR" } }
    )
  );

  updates.push(
    Cart.updateMany(
      { $or: [{ currency: { $exists: false } }, { currency: "USD" }] },
      { $set: { currency: "INR" } }
    )
  );

  updates.push(
    Order.updateMany(
      { $or: [{ currency: { $exists: false } }, { currency: "USD" }] },
      { $set: { currency: "INR" } }
    )
  );

  const [productsRes, cartsRes, ordersRes] = await Promise.all(updates);

  // eslint-disable-next-line no-console
  logger.info("script_output", { value: "Currency migration complete" });
  // eslint-disable-next-line no-console
  logger.info("Currency migration products updated", {
    matchedCount: productsRes.matchedCount,
    modifiedCount: productsRes.modifiedCount,
  });
  // eslint-disable-next-line no-console
  logger.info("Currency migration carts updated", {
    matchedCount: cartsRes.matchedCount,
    modifiedCount: cartsRes.modifiedCount,
  });
  // eslint-disable-next-line no-console
  logger.info("Currency migration orders updated", {
    matchedCount: ordersRes.matchedCount,
    modifiedCount: ordersRes.modifiedCount,
  });

  await mongoose.disconnect();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  logger.error("Migration failed", { error: err });
  process.exit(1);
});


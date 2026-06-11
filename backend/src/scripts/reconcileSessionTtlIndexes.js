const { logger } = require("../utils/logger");
require("../config/env");

const { connectDb } = require("../config/db");
const { PaymentSession } = require("../models/PaymentSession");

const TARGETS = [
  {
    model: PaymentSession,
    expectedName: "payment_session_ttl",
  },
];

function isExactExpiresAtIndex(index) {
  return index && index.key && Object.keys(index.key).length === 1 && index.key.expiresAt === 1;
}

function isTtlIndex(index) {
  return isExactExpiresAtIndex(index) && index.expireAfterSeconds === 0;
}

async function reconcileModelIndexes({ model, expectedName }) {
  const collection = model.collection;
  const indexes = await collection.indexes();
  const expiresAtIndexes = indexes.filter(isExactExpiresAtIndex);
  const ttlIndexes = expiresAtIndexes.filter(isTtlIndex);

  logger.info("script_output", { value: `\n[${model.modelName}] Collection: ${collection.collectionName}` });
  logger.info(
    "script_output",
    { value: `[${model.modelName}] Matching expiresAt indexes: ${
      expiresAtIndexes.length ? expiresAtIndexes.map((index) => index.name).join(", ") : "none"
    }` }
  );

  if (!ttlIndexes.length) {
    if (expiresAtIndexes.length) {
      for (const index of expiresAtIndexes) {
        logger.info("script_output", { value: `[${model.modelName}] Replacing non-TTL expiresAt index "${index.name}" with "${expectedName}".` });
        await collection.dropIndex(index.name);
      }
    }

    logger.info("script_output", { value: `[${model.modelName}] Creating TTL index "${expectedName}".` });
    await collection.createIndex(
      { expiresAt: 1 },
      {
        expireAfterSeconds: 0,
        name: expectedName,
      }
    );
  }

  const refreshedIndexes = await collection.indexes();
  const refreshedExpiresAtIndexes = refreshedIndexes.filter(isExactExpiresAtIndex);
  const refreshedTtlIndexes = refreshedExpiresAtIndexes.filter(isTtlIndex);
  const indexToKeep =
    refreshedTtlIndexes.find((index) => index.name === expectedName) || refreshedTtlIndexes[0] || null;

  if (!indexToKeep) {
    throw new Error(`[${model.modelName}] No TTL index found after reconciliation.`);
  }

  const indexesToDrop = refreshedExpiresAtIndexes.filter((index) => index.name !== indexToKeep.name);

  if (!indexesToDrop.length) {
    logger.info("script_output", { value: `[${model.modelName}] No redundant expiresAt indexes found.` });
    return;
  }

  for (const index of indexesToDrop) {
    logger.info("script_output", { value: `[${model.modelName}] Dropping redundant index "${index.name}".` });
    await collection.dropIndex(index.name);
  }
}

async function main() {
  try {
    await connectDb();

    for (const target of TARGETS) {
      await reconcileModelIndexes(target);
    }

    logger.info("script_output", { value: "\nTTL index reconciliation completed." });
    process.exit(0);
  } catch (error) {
    logger.error("script_error", { error: "\nTTL index reconciliation failed." });
    logger.error("script_error", { error: error });
    process.exit(1);
  }
}

main();

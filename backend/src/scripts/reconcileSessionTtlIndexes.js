require("../config/env");

const { connectDb } = require("../config/db");
const { PaymentSession } = require("../models/PaymentSession");
const { TrackingSession } = require("../modules/tracking/model");

const TARGETS = [
  {
    model: PaymentSession,
    expectedName: "payment_session_ttl",
  },
  {
    model: TrackingSession,
    expectedName: "tracking_session_ttl",
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

  console.log(`\n[${model.modelName}] Collection: ${collection.collectionName}`);
  console.log(
    `[${model.modelName}] Matching expiresAt indexes: ${
      expiresAtIndexes.length ? expiresAtIndexes.map((index) => index.name).join(", ") : "none"
    }`
  );

  if (!ttlIndexes.length) {
    if (expiresAtIndexes.length) {
      for (const index of expiresAtIndexes) {
        console.log(
          `[${model.modelName}] Replacing non-TTL expiresAt index "${index.name}" with "${expectedName}".`
        );
        await collection.dropIndex(index.name);
      }
    }

    console.log(`[${model.modelName}] Creating TTL index "${expectedName}".`);
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
    console.log(`[${model.modelName}] No redundant expiresAt indexes found.`);
    return;
  }

  for (const index of indexesToDrop) {
    console.log(`[${model.modelName}] Dropping redundant index "${index.name}".`);
    await collection.dropIndex(index.name);
  }
}

async function main() {
  try {
    await connectDb();

    for (const target of TARGETS) {
      await reconcileModelIndexes(target);
    }

    console.log("\nTTL index reconciliation completed.");
    process.exit(0);
  } catch (error) {
    console.error("\nTTL index reconciliation failed.");
    console.error(error);
    process.exit(1);
  }
}

main();

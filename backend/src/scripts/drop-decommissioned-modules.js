const { connectDb, disconnectDb } = require("../config/db");

async function dropDecommissionedModules() {
  await connectDb();
  const db = require("mongoose").connection.db;

  const collections = ["pickupbatches"];
  for (const name of collections) {
    const exists = (await db.listCollections({ name }).toArray()).length > 0;
    if (exists) {
      await db.dropCollection(name);
      console.log(`Dropped collection: ${name}`);
    } else {
      console.log(`Collection not found (skipped): ${name}`);
    }
  }

  await disconnectDb();
}

dropDecommissionedModules().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

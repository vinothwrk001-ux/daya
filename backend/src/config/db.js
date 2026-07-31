const mongoose = require("mongoose");
const { logger } = require("../utils/logger");
const sitemapCachePlugin = require("../utils/sitemap.cache.plugin");

// Register global plugin to invalidate sitemap cache on changes
mongoose.plugin(sitemapCachePlugin);

let isConnected = false;

async function connectDb() {
  if (isConnected) return;

  const primaryUri = process.env.MONGODB_URI;
  const localFallbackEnabled = process.env.MONGODB_ENABLE_LOCAL_FALLBACK === "true";
  const fallbackUri = localFallbackEnabled
    ? (process.env.MONGODB_FALLBACK_URI || "mongodb://127.0.0.1:27017/amazon_like")
    : "";
  const connectOptions = {
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 5000,
  };

  mongoose.set("strictQuery", true);

  if (!primaryUri && !fallbackUri) {
    throw new Error(
      "Missing MONGODB_URI. Set a working Atlas URI, or enable local fallback with MONGODB_ENABLE_LOCAL_FALLBACK=true."
    );
  }

  const stableApiOptions = {
    serverApi: {
      version: mongoose.mongo.ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  };

  const options = { ...connectOptions, ...stableApiOptions };

  try {
    const uri = primaryUri || fallbackUri;
    await mongoose.connect(uri, options);
    isConnected = true;
    logger.info(`MongoDB connected: ${uri.startsWith("mongodb+srv://") ? "Atlas" : "local"}`);
    return;
  } catch (primaryError) {
    logger.warn("Primary MongoDB connection failed", { error: primaryError.message });
    if (!fallbackUri || !primaryUri || primaryUri === fallbackUri) {
      throw primaryError;
    }

    try {
      await mongoose.connect(fallbackUri, connectOptions);
      isConnected = true;
      logger.info("MongoDB connected to fallback local database");
    } catch (fallbackError) {
      logger.error("Fallback MongoDB connection also failed", { error: fallbackError.message });
      if (fallbackUri.includes("127.0.0.1:27017") || fallbackUri.includes("localhost:27017")) {
        fallbackError.message = `${fallbackError.message}. Local MongoDB is unavailable. Start the MongoDB service or set MONGODB_URI to a working Atlas cluster.`;
      }
      throw fallbackError;
    }
  }
}

module.exports = { connectDb };


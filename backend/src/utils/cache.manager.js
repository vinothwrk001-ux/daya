const redis = require("redis");
const { logger } = require("./logger");

class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.redisClientPromise = null;
    this.prefix = "sitemap:";
  }

  getConnectTimeoutMs() {
    return Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 2000);
  }

  async getClient() {
    if (process.env.REDIS_DISABLED === "true") return null;
    if (!this.redisClientPromise) {
      const connectTimeoutMs = this.getConnectTimeoutMs();
      const client = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: Number(process.env.REDIS_PORT || 6379),
          connectTimeout: connectTimeoutMs,
          reconnectStrategy: false,
        },
        password: process.env.REDIS_PASSWORD || undefined,
      });

      client.on("error", (err) => {
        logger.error(`Redis CacheManager Error: ${err.message}`);
      });

      const connectPromise = client
        .connect()
        .then(() => {
          logger.info("Connected to Redis for Sitemap Cache");
          return client;
        })
        .catch(() => null);

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(null), connectTimeoutMs);
      });

      this.redisClientPromise = Promise.race([connectPromise, timeoutPromise]);
    }
    return this.redisClientPromise;
  }

  async set(key, value, metadata = {}, ttlInSeconds = 86400) {
    const dataToStore = JSON.stringify({ value, metadata });
    const client = await this.getClient();

    if (client) {
      try {
        await client.setEx(this.prefix + key, ttlInSeconds, dataToStore);
        return;
      } catch (e) {
        logger.warn(`Redis set failed for ${key}, falling back to memory cache`);
      }
    }

    // Memory cache fallback
    const expiresAt = Date.now() + ttlInSeconds * 1000;
    this.memoryCache.set(this.prefix + key, { data: dataToStore, expiresAt });
  }

  async get(key) {
    const client = await this.getClient();

    if (client) {
      try {
        const data = await client.get(this.prefix + key);
        if (data) return JSON.parse(data);
        return null;
      } catch (e) {
        logger.warn(`Redis get failed for ${key}, falling back to memory cache`);
      }
    }

    // Memory cache fallback
    const entry = this.memoryCache.get(this.prefix + key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(this.prefix + key);
      return null;
    }

    return JSON.parse(entry.data);
  }

  async invalidatePrefix(prefix) {
    const fullPrefix = this.prefix + prefix;
    const client = await this.getClient();

    if (client) {
      try {
        const keys = await client.keys(fullPrefix + "*");
        if (keys.length > 0) {
          await client.del(keys);
        }
        return;
      } catch (e) {
        logger.warn(`Redis keys del failed for prefix ${prefix}, falling back to memory cache`);
      }
    }

    // Memory cache fallback
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(fullPrefix)) {
        this.memoryCache.delete(key);
      }
    }
  }

  async clear() {
    const client = await this.getClient();
    if (client) {
      try {
        const keys = await client.keys(this.prefix + "*");
        if (keys.length > 0) {
          await client.del(keys);
        }
        return;
      } catch (e) {}
    }
    this.memoryCache.clear();
  }
}

module.exports = new CacheManager();

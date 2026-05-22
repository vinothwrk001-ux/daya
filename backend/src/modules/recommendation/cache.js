const redis = require("redis");

const memoryCache = new Map();
let redisClientPromise = null;

async function getClient() {
  if (process.env.REDIS_DISABLED === "true") return null;
  if (!redisClientPromise) {
    const client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || 6379),
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });
    client.on("error", () => {});
    redisClientPromise = client.connect().then(() => client).catch(() => null);
  }
  return redisClientPromise;
}

function setMemory(key, value, ttlSeconds) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function getMemory(key) {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value;
}

async function setJson(key, value, ttlSeconds = 300) {
  const client = await getClient();
  if (client) {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return;
  }
  setMemory(key, value, ttlSeconds);
}

async function getJson(key) {
  const client = await getClient();
  if (client) {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  return getMemory(key);
}

async function del(key) {
  const client = await getClient();
  if (client) {
    await client.del(key);
    return;
  }
  memoryCache.delete(key);
}

async function clearByPrefixes(prefixes = []) {
  const client = await getClient();
  if (client) {
    for (const prefix of prefixes) {
      const keys = await client.keys(`${prefix}*`);
      if (keys.length) {
        await client.del(keys);
      }
    }
    return;
  }

  for (const key of [...memoryCache.keys()]) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      memoryCache.delete(key);
    }
  }
}

module.exports = {
  getJson,
  setJson,
  del,
  clearByPrefixes,
};

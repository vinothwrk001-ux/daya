const EventEmitter = require("events");
const Queue = require("bull");
const { logger } = require("../../utils/logger");

const emitter = new EventEmitter();
const handlers = new Map();
let queue = null;

function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

function registerHandler(eventName, handler) {
  const existing = handlers.get(eventName) || [];
  existing.push(handler);
  handlers.set(eventName, existing);
}

async function dispatch(eventName, payload) {
  const registered = handlers.get(eventName) || [];
  for (const handler of registered) {
    await handler(payload);
  }
}

function initializeEventBus() {
  if (queue) return queue;
  if (process.env.REDIS_DISABLED === "true") {
    logger.info("Domain event queue disabled; using in-process emitter", { source: "event-bus" });
    return null;
  }

  try {
    queue = new Queue("domain-events", getRedisConfig());
    queue.process(async (job) => {
      await dispatch(job.data.eventName, job.data.payload);
    });
    queue.on("failed", (job, error) => {
      logger.error("Domain event job failed", {
        source: "event-bus",
        eventName: job?.data?.eventName,
        jobId: job?.id,
        error: error?.message,
      });
    });
    logger.info("Domain event queue initialized", { source: "event-bus" });
  } catch (error) {
    logger.warn("Domain event queue unavailable, using in-process emitter", {
      source: "event-bus",
      error: error?.message,
    });
  }

  return queue;
}

async function emitDomainEvent(eventName, payload = {}, options = {}) {
  const eventPayload = {
    ...payload,
    emittedAt: new Date(),
  };

  emitter.emit(eventName, eventPayload);

  if (!queue) {
    await dispatch(eventName, eventPayload);
    return { queued: false };
  }

  const job = await queue.add(
    {
      eventName,
      payload: eventPayload,
    },
    {
      attempts: Number(options.attempts || 3),
      backoff: {
        type: "exponential",
        delay: 1500,
      },
      removeOnComplete: true,
      removeOnFail: false,
      jobId: options.jobId,
    }
  );

  return { queued: true, jobId: job.id };
}

async function shutdownEventBus() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

module.exports = {
  emitter,
  initializeEventBus,
  registerHandler,
  emitDomainEvent,
  shutdownEventBus,
};

const inflight = new Map();

/**
 * Coalesce concurrent identical async calls into one shared promise.
 */
export function dedupePromise(key, factory) {
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = Promise.resolve()
    .then(factory)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

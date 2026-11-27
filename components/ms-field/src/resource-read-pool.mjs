import { ADVENTURE_DATABASE_PATH } from "../../../systems/adventure-map/content-database.mjs";

/** Shared immutable Content read pool (8 concurrent reads per resource client). */
export const RESOURCE_READ_CONCURRENCY = 8;
// Both classic component bundles include this small module. Store the pool on
// the Window under a global symbol so ms-field and ms-avatar still share one
// client-scoped concurrency/deduplication boundary regardless of script order.
const RESOURCE_POOLS_SYMBOL = Symbol.for("adventure-island.resource-read-pools.v1");
const resourcePools = globalThis[RESOURCE_POOLS_SYMBOL] instanceof WeakMap
  ? globalThis[RESOURCE_POOLS_SYMBOL]
  : new WeakMap();
if (globalThis[RESOURCE_POOLS_SYMBOL] === undefined) {
  Object.defineProperty(globalThis, RESOURCE_POOLS_SYMBOL, {
    value: resourcePools,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function resourcePool(client) {
  let pool = resourcePools.get(client);
  if (pool !== undefined) return pool;
  pool = { active: 0, queue: [], entries: new Map() };
  resourcePools.set(client, pool);
  return pool;
}

function pumpResourcePool(pool) {
  while (pool.active < RESOURCE_READ_CONCURRENCY && pool.queue.length > 0) {
    const task = pool.queue.shift();
    pool.active += 1;
    void task().finally(() => {
      pool.active -= 1;
      pumpResourcePool(pool);
    });
  }
}

function cancelledResourceRead() {
  return Object.assign(new Error("content request cancelled"), {
    code: "CONTENT_CANCELLED",
    name: "AbortError",
  });
}

function waitForSharedResource(promise, signal) {
  if (signal?.aborted) return Promise.reject(cancelledResourceRead());
  if (signal === undefined) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelledResourceRead());
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export function readSharedResource(client, namespace, key, contentVersion, signal) {
  if (client === null || typeof client !== "object" || typeof client.resource !== "function") {
    return Promise.reject(Object.assign(new Error("missing resource client"), { code: "CONTENT_UNAVAILABLE" }));
  }
  const pool = resourcePool(client);
  const identity = `${ADVENTURE_DATABASE_PATH}\0${namespace}\0${key}\0${contentVersion}`;
  let entry = pool.entries.get(identity);
  if (entry === undefined) {
    let resolveEntry;
    let rejectEntry;
    const promise = new Promise((resolve, reject) => {
      resolveEntry = resolve;
      rejectEntry = reject;
    });
    entry = { promise };
    pool.entries.set(identity, entry);
    pool.queue.push(async () => {
      try {
        resolveEntry(await client.resource(ADVENTURE_DATABASE_PATH, namespace, key, contentVersion));
      } catch (error) {
        if (pool.entries.get(identity) === entry) pool.entries.delete(identity);
        rejectEntry(error);
      }
    });
    pumpResourcePool(pool);
  }
  return waitForSharedResource(entry.promise, signal);
}

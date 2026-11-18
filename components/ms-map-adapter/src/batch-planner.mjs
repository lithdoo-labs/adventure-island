/**
 * OrderedDrawable[] → PaintUnitPlan[]
 *
 * Independent paint units for Back and Portal visuals.
 * Tile/Obj form static batches, split at:
 * 1. non-batchable unit boundaries
 * 2. reachable avatar insertion keys (CMS079 C-099)
 * 3. pixel / placement budgets (PRODUCT-DECISION defaults)
 * 4. optional spatial region grid
 */

const DEFAULT_BUDGET = Object.freeze({
  maxPlacements: 256,
  maxPixels: 1024 * 1024,
  maxResources: 32,
  regionSize: 2048,
});

function isBatchable(drawable) {
  return drawable.updateClass === "static"
    && (drawable.sourceKind === "tile" || drawable.sourceKind === "obj");
}

function unitKind(drawable) {
  if (drawable.sourceKind === "back") return "ms-map-back";
  if (drawable.sourceKind === "portal-visual") return "ms-portal-visual";
  if (drawable.sourceKind === "obj" && drawable.updateClass === "local-animation") {
    return "ms-map-object";
  }
  if (isBatchable(drawable)) return "ms-map-batch";
  return "unknown";
}

function regionId(bounds, regionSize) {
  if (!bounds) return "unknown";
  const rx = Math.floor(bounds.x / regionSize);
  const ry = Math.floor(bounds.y / regionSize);
  return `${rx}:${ry}`;
}

function unionBounds(items) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    if (!item.bounds) continue;
    minX = Math.min(minX, item.bounds.x);
    minY = Math.min(minY, item.bounds.y);
    maxX = Math.max(maxX, item.bounds.x + item.bounds.width);
    maxY = Math.max(maxY, item.bounds.y + item.bounds.height);
  }
  if (!Number.isFinite(minX)) return null;
  return Object.freeze({
    x: minX,
    y: minY,
    w: Math.max(1, Math.ceil(maxX - minX)),
    h: Math.max(1, Math.ceil(maxY - minY)),
  });
}

function pixelsOf(bounds) {
  if (!bounds) return 0;
  return bounds.w * bounds.h;
}

function insertionBoundary(prevKey, nextKey, insertionKeys) {
  if (prevKey === nextKey) return null;
  for (const key of insertionKeys) {
    // Split both before and after an equal primary key. Equal-key static
    // placements stay together; the dynamic sibling can be placed on either
    // side of that paint unit once its comparator tie is available.
    if (prevKey <= key && key <= nextKey) return key;
  }
  return null;
}

function resourceKeysOf(items) {
  const keys = new Set();
  for (const item of items) {
    for (const frame of item.frames ?? []) {
      if (frame?.resource?.key) keys.add(`${frame.resource.namespace}:${frame.resource.key}`);
    }
  }
  return keys;
}

function collectInsertionKeys(insertionPoints) {
  const keys = new Set();
  for (const point of insertionPoints) {
    keys.add(point.flag0);
    keys.add(point.flag1);
  }
  return [...keys].sort((a, b) => a - b);
}

function flushBatch(buffer, plans, mapId, budget) {
  if (buffer.length === 0) return;
  const bounds = unionBounds(buffer);
  const pixelArea = pixelsOf(bounds);
  const resourceCount = resourceKeysOf(buffer).size;
  const exceeded = [];
  if (buffer.length > budget.maxPlacements) exceeded.push("maxPlacements");
  if (pixelArea > budget.maxPixels) exceeded.push("maxPixels");
  if (resourceCount > budget.maxResources) exceeded.push("maxResources");
  const bandIndex = plans.filter((p) => p.kind === "ms-map-batch").length;
  const first = buffer[0];
  const last = buffer[buffer.length - 1];
  const plan = Object.freeze({
    kind: "ms-map-batch",
    stableId: `batch:map${mapId}:band${bandIndex}`,
    mapId,
    sortKey: first.sortKey,
    tieKey: first.tieKey,
    depthInterval: Object.freeze({ min: first.sortKey, max: last.sortKey }),
    bounds,
    pixelArea,
    resourceCount,
    budgetCompliance: Object.freeze({
      ok: exceeded.length === 0,
      exceeded: Object.freeze(exceeded),
    }),
    placements: Object.freeze(buffer.map((item, order) => Object.freeze({
      placementId: item.stableId,
      kind: item.sourceKind,
      sourceGroup: item.sourceGroup,
      sourceOrder: item.sourceOrder,
      sortKey: item.sortKey,
      tieKey: item.tieKey,
      orderIndex: item.orderIndex,
      worldX: item.worldX,
      worldY: item.worldY,
      flip: item.flip,
      opacity: item.opacity,
      bounds: item.bounds,
      resource: item.resource,
      frames: item.frames,
      placement: item.placement,
      paintOrder: order,
    }))),
    budget: Object.freeze({ ...budget }),
  });
  plans.push(plan);
  buffer.length = 0;
}

/**
 * @param {readonly object[]} ordered
 * @param {object} scene ResolvedMapScene (for insertionPoints)
 * @param {object} [budget]
 */
export function planPaintUnits(ordered, scene, budget = {}) {
  const limits = Object.freeze({ ...DEFAULT_BUDGET, ...budget });
  for (const name of ["maxPlacements", "maxPixels", "maxResources", "regionSize"]) {
    if (!Number.isFinite(limits[name]) || limits[name] <= 0) {
      throw new RangeError(`${name} must be a positive finite number`);
    }
  }
  const insertionKeys = collectInsertionKeys(scene.insertionPoints ?? []);
  const plans = [];
  const batchBuffer = [];
  const mapId = scene.mapId;

  const wouldBreakBudget = (buffer, next) => {
    if (buffer.length + 1 > limits.maxPlacements) return true;
    const bounds = unionBounds([...buffer, next]);
    if (pixelsOf(bounds) > limits.maxPixels) return true;
    if (resourceKeysOf([...buffer, next]).size > limits.maxResources) return true;
    if (buffer.length > 0) {
      const prevRegion = regionId(buffer[0].bounds, limits.regionSize);
      const nextRegion = regionId(next.bounds, limits.regionSize);
      // Keep a batch in one region; crossing regions splits.
      if (prevRegion !== nextRegion) return true;
    }
    return false;
  };

  for (const drawable of ordered) {
    const kind = unitKind(drawable);
    if (kind !== "ms-map-batch") {
      flushBatch(batchBuffer, plans, mapId, limits);
      if (kind === "unknown") {
        throw new Error(`no paint-unit strategy for ${drawable.stableId} (${drawable.updateClass})`);
      }
      plans.push(Object.freeze({
        kind,
        stableId: drawable.stableId,
        mapId,
        sortKey: drawable.sortKey,
        tieKey: drawable.tieKey,
        sortKeySource: drawable.sortKeySource,
        bounds: drawable.bounds,
        drawable,
      }));
      continue;
    }

    if (batchBuffer.length > 0) {
      const prev = batchBuffer[batchBuffer.length - 1];
      const splitKey = insertionBoundary(prev.sortKey, drawable.sortKey, insertionKeys);
      if (splitKey !== null || wouldBreakBudget(batchBuffer, drawable)) {
        flushBatch(batchBuffer, plans, mapId, limits);
      }
    }
    batchBuffer.push(drawable);
  }
  flushBatch(batchBuffer, plans, mapId, limits);

  // Assign stack-rank in plan order (back → front).
  const ranked = plans.map((plan, index) => Object.freeze({
    ...plan,
    stackRank: index + 1,
  }));

  return Object.freeze(ranked);
}

export { DEFAULT_BUDGET };

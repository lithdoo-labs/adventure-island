/**
 * Renderer-independent portal facts derived from FSDB source-order rows (M6).
 */
import {
  DISABLED_TARGET_MAP,
  PORTAL_LOGICAL_INDEX_MAX,
  isM6EnabledPortalEdge,
} from "./portal-constants.mjs";

function portalRowEnabled(mapId, row, publishedTargetMapIds) {
  const pt = Number(row.pt);
  if (pt === 0) return false;
  const targetName = typeof row.tn === "string" ? row.tn : "";
  if (targetName.length === 0) return false;
  const targetMap = String(row.tm);
  if (targetMap === DISABLED_TARGET_MAP) return false;
  if (!publishedTargetMapIds.has(targetMap)) return false;
  return isM6EnabledPortalEdge(mapId, row.pn);
}

function freezePortalEntry(entry) {
  return Object.freeze({
    sourceOrder: entry.sourceOrder,
    name: entry.name,
    type: entry.type,
    x: entry.x,
    y: entry.y,
    targetMap: entry.targetMap,
    targetName: entry.targetName,
    enabled: entry.enabled,
  });
}

/**
 * @param {string} mapId
 * @param {ReadonlyArray<object>} portalRows adapter scene.portals or FSDB-shaped rows
 * @param {ReadonlySet<string>} publishedTargetMapIds maps with publishable FieldPlans
 */
export function buildPortalLogicalIndex(mapId, portalRows, publishedTargetMapIds) {
  if (typeof mapId !== "string" || !/^\d{6,12}$/u.test(mapId)) {
    throw new TypeError("mapId must be a canonical numeric map id");
  }
  if (!Array.isArray(portalRows)) throw new TypeError("portalRows must be an array");
  if (!(publishedTargetMapIds instanceof Set)) {
    throw new TypeError("publishedTargetMapIds must be a Set");
  }
  if (portalRows.length > PORTAL_LOGICAL_INDEX_MAX) {
    throw new TypeError(`portal logical index exceeds ${PORTAL_LOGICAL_INDEX_MAX} entries`);
  }
  const entries = [];
  let lastSourceOrder = -1;
  for (const row of portalRows) {
    const sourceOrder = Number(row.sourceOrder);
    if (!Number.isSafeInteger(sourceOrder) || sourceOrder < 0) {
      throw new TypeError("portal sourceOrder must be a non-negative safe integer");
    }
    if (sourceOrder <= lastSourceOrder) {
      throw new TypeError("portal sourceOrder must strictly increase in FSDB order");
    }
    lastSourceOrder = sourceOrder;
    const pt = row.pt;
    if (!Number.isSafeInteger(pt) || pt < 0) {
      throw new TypeError("portal pt must be a non-negative safe integer");
    }
    const x = Number(row.x);
    const y = Number(row.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError("portal x/y must be finite");
    }
    const targetMapNum = row.tm;
    if (!Number.isSafeInteger(targetMapNum) || targetMapNum < 0) {
      throw new TypeError("portal tm must be a non-negative safe integer");
    }
    const name = row.pn;
    if (typeof name !== "string" || name.length === 0) {
      throw new TypeError("portal pn must be non-empty");
    }
    if (typeof row.tn !== "string") {
      throw new TypeError("portal tn must be a string");
    }
    entries.push(freezePortalEntry(Object.freeze({
      sourceOrder,
      name,
      type: pt,
      x,
      y,
      targetMap: targetMapNum,
      targetName: row.tn,
      enabled: portalRowEnabled(mapId, row, publishedTargetMapIds),
    })));
  }
  return Object.freeze({
    formatVersion: 1,
    mapId,
    entries: Object.freeze(entries),
  });
}

export function validatePortalLogicalIndex(value, expectedMapId) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("portalLogicalIndex must be an object");
  }
  if (value.formatVersion !== 1) {
    throw new TypeError("portalLogicalIndex.formatVersion must be 1");
  }
  if (value.mapId !== expectedMapId) {
    throw new TypeError("portalLogicalIndex.mapId must match AdventureFieldPlan.mapId");
  }
  if (!Array.isArray(value.entries) || value.entries.length > PORTAL_LOGICAL_INDEX_MAX) {
    throw new TypeError("portalLogicalIndex.entries is missing or exceeds bounds");
  }
  let lastSourceOrder = -1;
  for (const entry of value.entries) {
    if (!Number.isSafeInteger(entry.sourceOrder) || entry.sourceOrder < 0) {
      throw new TypeError("portal entry sourceOrder invalid");
    }
    if (entry.sourceOrder <= lastSourceOrder) {
      throw new TypeError("portal entry sourceOrder must strictly increase");
    }
    lastSourceOrder = entry.sourceOrder;
    if (typeof entry.name !== "string" || entry.name.length === 0) {
      throw new TypeError("portal entry name invalid");
    }
    if (!Number.isSafeInteger(entry.type) || entry.type < 0) {
      throw new TypeError("portal entry type must be a non-negative safe integer");
    }
    if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)) {
      throw new TypeError("portal entry position invalid");
    }
    if (!Number.isSafeInteger(entry.targetMap) || entry.targetMap < 0) {
      throw new TypeError("portal entry targetMap must be a non-negative safe integer");
    }
    if (typeof entry.targetName !== "string") throw new TypeError("portal entry targetName invalid");
    if (typeof entry.enabled !== "boolean") throw new TypeError("portal entry enabled invalid");
    Object.freeze(entry);
  }
  Object.freeze(value.entries);
  return Object.freeze(value);
}

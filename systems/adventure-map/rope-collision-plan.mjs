/**
 * Render-independent Rope collision/index plan for AdventureFieldPlan (M7.3).
 * Layout matches CMS079 C-079 / C-069 (+0xC x, +0x10 y1 top, +0x14 y2 bottom, +8 uf).
 * Browser-safe; hash verification at bundle build time.
 */

import { SOURCE_ABSENT, SOURCE_PRESENT } from "../../components/ms-map-adapter/src/status.mjs";

export const ROPE_COLLISION_PLAN_MAX_SEGMENTS = 64;
export const ROPE_HIT_HALF_WIDTH_PX = 10;

export function finiteRopeSegment(raw) {
  for (const key of ["x", "y1", "y2", "l", "uf", "page", "id", "sourceOrder"]) {
    if (!Number.isFinite(raw[key])) throw new TypeError(`rope segment ${key} must be finite`);
  }
  for (const key of ["l", "uf", "page", "id", "sourceOrder"]) {
    if (!Number.isSafeInteger(raw[key])) throw new TypeError(`rope segment ${key} must be a safe integer`);
  }
  if (raw.y1 >= raw.y2) throw new TypeError("rope segment requires y1 < y2 (top < bottom in Y-down)");
  if (typeof raw.stableId !== "string" || raw.stableId.length === 0) {
    throw new TypeError("rope segment stableId must be a non-empty string");
  }
  return Object.freeze({
    stableId: raw.stableId,
    sourceOrder: raw.sourceOrder,
    x: raw.x,
    y1: raw.y1,
    y2: raw.y2,
    l: raw.l,
    uf: raw.uf,
    page: raw.page,
    id: raw.id,
  });
}

/**
 * @param {object} plan
 * @param {string} [expectedGroupStatus]
 */
export function validateRopeCollisionPlan(plan, expectedGroupStatus = null) {
  if (plan === null || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TypeError("ropeCollisionPlan must be an object");
  }
  if (plan.formatVersion !== 1) {
    throw new TypeError("ropeCollisionPlan.formatVersion must be 1");
  }
  if (typeof plan.hash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(plan.hash)) {
    throw new TypeError("ropeCollisionPlan.hash must be a sha256 stamp");
  }
  const status = plan.groupStatus;
  if (status !== SOURCE_PRESENT && status !== SOURCE_ABSENT) {
    throw new TypeError(`ropeCollisionPlan.groupStatus must be ${SOURCE_PRESENT} or ${SOURCE_ABSENT}`);
  }
  if (expectedGroupStatus !== null && status !== expectedGroupStatus) {
    throw new TypeError("ropeCollisionPlan.groupStatus does not match map adapter facts");
  }
  const source = plan.source;
  if (source === null || typeof source !== "object") {
    throw new TypeError("ropeCollisionPlan.source must be an object");
  }
  if (typeof source.groupFileKey !== "string" || source.groupFileKey.length === 0) {
    throw new TypeError("ropeCollisionPlan.source.groupFileKey is required");
  }
  if (status === SOURCE_ABSENT) {
    if (source.contentVersion !== null) {
      throw new TypeError("ropeCollisionPlan.source.contentVersion must be null when group is absent");
    }
    if (!Array.isArray(plan.segments) || plan.segments.length !== 0) {
      throw new TypeError("absent rope group must publish zero segments");
    }
    return Object.freeze({ ...plan, segments: Object.freeze([]) });
  }
  if (typeof source.contentVersion !== "string"
    || !/^sha256:[0-9a-f]{64}$/u.test(source.contentVersion)) {
    throw new TypeError("present ropeCollisionPlan.source.contentVersion must be a sha256 stamp");
  }
  if (!Array.isArray(plan.segments)) {
    throw new TypeError("ropeCollisionPlan.segments must be an array");
  }
  if (plan.segments.length > ROPE_COLLISION_PLAN_MAX_SEGMENTS) {
    throw new RangeError("ropeCollisionPlan.segments exceeds segment cap");
  }
  const segments = Object.freeze(plan.segments.map(finiteRopeSegment));
  return Object.freeze({ ...plan, segments });
}

/**
 * Rope hit. The caller passes the body probe. X hits when that probe meets
 * the rope's ±10 band. Y hits only when the whole probe sits inside [y1, y2].
 * @param {object[]} segments
 * @param {number} xMin
 * @param {number} xMax
 * @param {number} yMin
 * @param {number} yMax
 */
export function queryRopeSegments(segments, xMin, xMax, yMin, yMax) {
  const probeTop = Math.min(yMin, yMax);
  const probeBottom = Math.max(yMin, yMax);
  const hits = [];
  for (const segment of segments) {
    const ropeXMin = segment.x - ROPE_HIT_HALF_WIDTH_PX;
    const ropeXMax = segment.x + ROPE_HIT_HALF_WIDTH_PX;
    if (xMax < ropeXMin || xMin > ropeXMax) continue;
    if (probeTop < segment.y1 || probeBottom > segment.y2) continue;
    hits.push(segment);
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.sourceOrder - b.sourceOrder);
  return hits[0];
}

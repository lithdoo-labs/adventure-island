/**
 * Render-independent Foothold collision plan for AdventureFieldPlan (M5).
 * Browser-safe: no Node crypto. Hash verification happens at bundle build time.
 */

export const FOOTHOLD_COLLISION_PLAN_MAX_SEGMENTS = 512;

export function finiteFootholdSegment(raw) {
  for (const key of ["layer", "platform", "id", "x1", "y1", "x2", "y2"]) {
    if (!Number.isFinite(raw[key])) throw new TypeError(`foothold segment ${key} must be finite`);
  }
  for (const key of ["layer", "platform", "id"]) {
    if (!Number.isSafeInteger(raw[key])) throw new TypeError(`foothold segment ${key} must be a safe integer`);
  }
  const lenSq = (raw.x2 - raw.x1) ** 2 + (raw.y2 - raw.y1) ** 2;
  if (lenSq <= 0) throw new TypeError("foothold segment must have non-zero length");
  const segment = {
    layer: raw.layer,
    platform: raw.platform,
    id: raw.id,
    x1: raw.x1,
    y1: raw.y1,
    x2: raw.x2,
    y2: raw.y2,
    prev: linkId(raw.prev),
    next: linkId(raw.next),
  };
  const conveyor = footholdScalar(raw.force, 0);
  const friction = footholdScalar(raw.drag, 1);
  if (conveyor !== 0) segment.conveyor = conveyor;
  if (friction !== 1) segment.friction = friction;
  if (raw.forbidFallDown === 1 || raw.forbidFallDown === true) segment.forbidFallDown = true;
  return Object.freeze(segment);
}

function footholdScalar(value, fallback) {
  if (value === undefined || value === null || value === 0) return fallback;
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric)) return fallback;
  return numeric * 0.01;
}

function linkId(value) {
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value)) throw new TypeError("foothold prev/next must be a safe integer");
  return value;
}

export function validateFootholdCollisionPlan(plan) {
  if (plan === null || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TypeError("footholdCollisionPlan must be an object");
  }
  if (plan.formatVersion !== 1) {
    throw new TypeError("footholdCollisionPlan.formatVersion must be 1");
  }
  if (typeof plan.hash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(plan.hash)) {
    throw new TypeError("footholdCollisionPlan.hash must be a sha256 stamp");
  }
  if (!Array.isArray(plan.segments) || plan.segments.length === 0) {
    throw new TypeError("footholdCollisionPlan.segments must be a non-empty array");
  }
  if (plan.segments.length > FOOTHOLD_COLLISION_PLAN_MAX_SEGMENTS) {
    throw new RangeError("footholdCollisionPlan.segments exceeds segment cap");
  }
  const segments = Object.freeze(plan.segments.map(finiteFootholdSegment));
  return Object.freeze({ ...plan, segments });
}

/**
 * @param {object} segment
 * @param {number} x world x
 */
export function footholdYAtX(segment, x) {
  const minX = Math.min(segment.x1, segment.x2);
  const maxX = Math.max(segment.x1, segment.x2);
  if (x < minX || x > maxX) return null;
  const dx = segment.x2 - segment.x1;
  // A vertical Foothold is a wall/link boundary, not a walkable support
  // surface. Treating it as ground creates a one-pixel-wide false floor.
  if (Math.abs(dx) < 1e-9) return null;
  const t = (x - segment.x1) / dx;
  return segment.y1 + t * (segment.y2 - segment.y1);
}

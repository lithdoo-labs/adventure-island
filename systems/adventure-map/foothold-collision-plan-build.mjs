/**
 * Node-only: build + hash-verify footholdCollisionPlan at bundle time.
 */
import { projectionHash } from "../../components/ms-map-adapter/src/hash.mjs";
import {
  FOOTHOLD_COLLISION_PLAN_MAX_SEGMENTS,
  finiteFootholdSegment,
  validateFootholdCollisionPlan,
} from "./foothold-collision-plan.mjs";

export { FOOTHOLD_COLLISION_PLAN_MAX_SEGMENTS };

/**
 * @param {ReadonlyArray<object>} footholds from ResolvedMapScene
 */
export function buildFootholdCollisionPlan(footholds) {
  if (!Array.isArray(footholds)) throw new TypeError("footholds must be an array");
  if (footholds.length > FOOTHOLD_COLLISION_PLAN_MAX_SEGMENTS) {
    throw new RangeError(`foothold segment count ${footholds.length} exceeds cap ${FOOTHOLD_COLLISION_PLAN_MAX_SEGMENTS}`);
  }
  const segments = Object.freeze(footholds.map((row) => finiteFootholdSegment({
    layer: Number(row.layer),
    platform: Number(row.platform),
    id: Number(row.id),
    x1: Number(row.x1),
    y1: Number(row.y1),
    x2: Number(row.x2),
    y2: Number(row.y2),
    prev: integerLink(row.prev),
    next: integerLink(row.next),
  })));
  const ids = new Set(segments.map((segment) => segment.id));
  for (const segment of segments) {
    if (segment.prev !== 0 && !ids.has(segment.prev)) {
      throw new TypeError(`foothold ${segment.id} prev ${segment.prev} does not resolve`);
    }
    if (segment.next !== 0 && !ids.has(segment.next)) {
      throw new TypeError(`foothold ${segment.id} next ${segment.next} does not resolve`);
    }
  }
  const body = Object.freeze({ formatVersion: 1, segments });
  return Object.freeze({
    ...body,
    hash: projectionHash(body),
  });
}

export function assertFootholdCollisionPlanHash(plan) {
  validateFootholdCollisionPlan(plan);
  const expect = projectionHash({ formatVersion: 1, segments: plan.segments });
  if (plan.hash !== expect) throw new TypeError("footholdCollisionPlan.hash does not match segments");
}

function integerLink(value) {
  const id = Number(value ?? 0);
  if (!Number.isSafeInteger(id)) throw new TypeError("foothold prev/next must be an integer");
  return id;
}

export function buildAndAssertFootholdCollisionPlan(footholds) {
  const plan = buildFootholdCollisionPlan(footholds);
  assertFootholdCollisionPlanHash(plan);
  return plan;
}

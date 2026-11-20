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
  })));
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

export function buildAndAssertFootholdCollisionPlan(footholds) {
  const plan = buildFootholdCollisionPlan(footholds);
  assertFootholdCollisionPlanHash(plan);
  return plan;
}

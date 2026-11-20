/**
 * Node-only: build and hash-verify ropeCollisionPlan at bundle time.
 */
import { projectionHash } from "../../components/ms-map-adapter/src/hash.mjs";
import {
  SOURCE_ABSENT,
  SOURCE_EMPTY,
  SOURCE_PRESENT,
} from "../../components/ms-map-adapter/src/status.mjs";
import {
  ROPE_COLLISION_PLAN_MAX_SEGMENTS,
  finiteRopeSegment,
  validateRopeCollisionPlan,
} from "./rope-collision-plan.mjs";

export { ROPE_COLLISION_PLAN_MAX_SEGMENTS };

/**
 * @param {string} mapId
 * @param {ReadonlyArray<object>} ropes from ResolvedMapScene
 * @param {string} groupStatus adapter groupStatus.rope
 * @param {{ groupFileKey: string, contentVersion: string | null }} source
 */
export function buildRopeCollisionPlan(mapId, ropes, groupStatus, source) {
  if (groupStatus === SOURCE_EMPTY) {
    throw new TypeError(`map ${mapId} [group]map.Rope is SOURCE_EMPTY - fail-closed`);
  }
  if (groupStatus === SOURCE_ABSENT) {
    const body = Object.freeze({
      formatVersion: 1,
      groupStatus: SOURCE_ABSENT,
      source: Object.freeze({
        groupFileKey: source.groupFileKey,
        contentVersion: null,
      }),
      segments: Object.freeze([]),
    });
    const plan = Object.freeze({ ...body, hash: projectionHash(body) });
    assertRopeCollisionPlanHash(plan);
    return plan;
  }
  if (groupStatus !== SOURCE_PRESENT) {
    throw new TypeError(`map ${mapId} rope group status ${groupStatus} is not publishable`);
  }
  if (!Array.isArray(ropes)) throw new TypeError("ropes must be an array");
  if (ropes.length > ROPE_COLLISION_PLAN_MAX_SEGMENTS) {
    throw new RangeError(`rope segment count ${ropes.length} exceeds cap ${ROPE_COLLISION_PLAN_MAX_SEGMENTS}`);
  }
  const segments = Object.freeze(ropes.map((row) => finiteRopeSegment({
    stableId: row.stableId,
    sourceOrder: Number(row.sourceOrder),
    x: Number(row.x),
    y1: Number(row.y1),
    y2: Number(row.y2),
    l: Number(row.l),
    uf: Number(row.uf),
    page: Number(row.page),
    id: Number(row.id),
  })));
  const body = Object.freeze({
    formatVersion: 1,
    groupStatus: SOURCE_PRESENT,
    source: Object.freeze({
      groupFileKey: source.groupFileKey,
      contentVersion: source.contentVersion,
    }),
    segments,
  });
  const plan = Object.freeze({ ...body, hash: projectionHash(body) });
  assertRopeCollisionPlanHash(plan);
  return plan;
}

export function assertRopeCollisionPlanHash(plan) {
  validateRopeCollisionPlan(plan);
  const expect = projectionHash({
    formatVersion: 1,
    groupStatus: plan.groupStatus,
    source: plan.source,
    segments: plan.segments,
  });
  if (plan.hash !== expect) throw new TypeError("ropeCollisionPlan.hash does not match body");
}

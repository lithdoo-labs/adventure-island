import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import {
  SOURCE_ABSENT,
  SOURCE_EMPTY,
  SOURCE_PRESENT,
} from "../../../components/ms-map-adapter/src/status.mjs";
import {
  ROPE_COLLISION_PLAN_MAX_SEGMENTS,
  buildRopeCollisionPlan,
  assertRopeCollisionPlanHash,
} from "../rope-collision-plan-build.mjs";
import { queryRopeSegments, validateRopeCollisionPlan } from "../rope-collision-plan.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("map222000001 publishes audited rope segment with stable hash", async () => {
  const map = await buildMapProjection({ mapId: "222000001", gameRoot: repoRoot });
  const rope = map.scene.ropes[0];
  assert.equal(map.scene.groupStatus.rope, SOURCE_PRESENT);
  assert.equal(rope.x, -51);
  assert.equal(rope.y1, -499);
  assert.equal(rope.y2, 474);
  assert.equal(rope.l, 0);
  assert.equal(rope.uf, 0);
  const plan = buildRopeCollisionPlan(
    "222000001",
    map.scene.ropes,
    map.scene.groupStatus.rope,
    { groupFileKey: "map.222000001.jsonl", contentVersion: map.facts.groups.rope.contentVersion },
  );
  assertRopeCollisionPlanHash(plan);
  assert.equal(plan.segments.length, 1);
  assert.equal(plan.segments[0].stableId, rope.stableId);
});

test("map230030200 absent rope group publishes zero segments fail-closed body", async () => {
  const map = await buildMapProjection({ mapId: "230030200", gameRoot: repoRoot });
  assert.equal(map.scene.groupStatus.rope, SOURCE_ABSENT);
  const plan = buildRopeCollisionPlan(
    "230030200",
    map.scene.ropes,
    map.scene.groupStatus.rope,
    { groupFileKey: "map.230030200.jsonl", contentVersion: null },
  );
  assertRopeCollisionPlanHash(plan);
  validateRopeCollisionPlan(plan);
  assert.equal(plan.groupStatus, SOURCE_ABSENT);
  assert.equal(plan.segments.length, 0);
});

test("C-069 query respects x±10 and y containment", async () => {
  const built = await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" });
  const segment = built.plan.ropeCollisionPlan.segments[0];
  assert.ok(queryRopeSegments([segment], -61, -41, 470, 474));
  assert.equal(queryRopeSegments([segment], -80, -70, 470, 474), null);
});

test("rope plan rejects empty source, missing content identity, and a tampered hash", async () => {
  const map = await buildMapProjection({ mapId: "222000001", gameRoot: repoRoot });
  const source = {
    groupFileKey: "map.222000001.jsonl",
    contentVersion: map.facts.groups.rope.contentVersion,
  };
  assert.throws(
    () => buildRopeCollisionPlan("222000001", [], SOURCE_EMPTY, source),
    /SOURCE_EMPTY/u,
  );
  assert.throws(
    () => buildRopeCollisionPlan(
      "222000001",
      map.scene.ropes,
      SOURCE_PRESENT,
      { ...source, contentVersion: null },
    ),
    /contentVersion/u,
  );
  const plan = buildRopeCollisionPlan(
    "222000001",
    map.scene.ropes,
    SOURCE_PRESENT,
    source,
  );
  assert.throws(
    () => assertRopeCollisionPlanHash({ ...plan, hash: `sha256:${"0".repeat(64)}` }),
    /does not match body/u,
  );
});

test("rope plan enforces the segment budget", () => {
  const row = {
    stableId: "rope/0/1",
    sourceOrder: 0,
    x: 0,
    y1: 0,
    y2: 10,
    l: 0,
    uf: 0,
    page: 0,
    id: 1,
  };
  const rows = Array.from(
    { length: ROPE_COLLISION_PLAN_MAX_SEGMENTS + 1 },
    (_, sourceOrder) => ({ ...row, stableId: `rope/0/${sourceOrder}`, sourceOrder }),
  );
  assert.throws(
    () => buildRopeCollisionPlan(
      "budget-map",
      rows,
      SOURCE_PRESENT,
      { groupFileKey: "map.budget-map.jsonl", contentVersion: `sha256:${"1".repeat(64)}` },
    ),
    /exceeds cap/u,
  );
});

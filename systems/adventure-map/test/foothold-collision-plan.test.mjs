import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import { assertFootholdCollisionPlanHash, buildFootholdCollisionPlan } from "../foothold-collision-plan-build.mjs";
import {
  FOOTHOLD_COLLISION_PLAN_MAX_SEGMENTS,
  footholdYAtX,
  validateFootholdCollisionPlan,
} from "../foothold-collision-plan.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("canonical 222000000 foothold plan is bounded and hash-stable", async () => {
  const map = await buildMapProjection({ mapId: "222000000", gameRoot: repoRoot });
  assert.ok(map.scene.footholds.length <= FOOTHOLD_COLLISION_PLAN_MAX_SEGMENTS);
  const plan = buildFootholdCollisionPlan(map.scene.footholds);
  validateFootholdCollisionPlan(plan);
  assertFootholdCollisionPlanHash(plan);
  const again = buildFootholdCollisionPlan(map.scene.footholds);
  assert.equal(plan.hash, again.hash);
  assert.equal(footholdYAtX(plan.segments.find((s) => s.id === 163), -92), 243);
});

test("vertical footholds never become one-pixel-wide ground", () => {
  assert.equal(footholdYAtX({ x1: 10, y1: 0, x2: 10, y2: 100 }, 10), null);
});

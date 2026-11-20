import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { planCrossMapPortalCommit } from "../portal-transaction.mjs";
import {
  applyCrossMapPortalRenderReplace,
  authorityAfterCrossMapReplace,
} from "../portal-cross-map-commit.mjs";
import { createMovementState } from "../movement-sim.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const viewport = Object.freeze({ width: 800, height: 600 });

test("domain.replace runs before authority variables are read", async () => {
  const mapA = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000000" })).plan;
  const mapB = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan;
  const in00 = mapA.portalLogicalIndex.entries.find((p) => p.name === "in00");
  const st00 = mapB.portalLogicalIndex.entries.find((p) => p.name === "st00");
  const movementState = createMovementState({
    worldX: mapA.fieldState.player.worldX,
    worldY: mapA.fieldState.player.worldY,
    segments: mapA.footholdCollisionPlan.segments,
  });
  const commit = planCrossMapPortalCommit({
    sourcePlan: mapA,
    targetPlan: mapB,
    fieldState: mapA.fieldState,
    movementState,
    sourcePortal: in00,
    targetPortal: st00,
    viewport,
    travelToken: 3,
    nextSceneEpoch: 1,
  });

  let replaceCalled = false;
  let authorityMapId = null;
  const domain = {
    replace(state) {
      replaceCalled = true;
      assert.equal(state.roots[0].key, commit.renderRoot.key);
      authorityMapId = commit.activePlan.mapId;
    },
  };

  applyCrossMapPortalRenderReplace(commit, domain);
  assert.equal(replaceCalled, true);
  const auth = authorityAfterCrossMapReplace(commit);
  assert.equal(auth.activePlan.mapId, authorityMapId);
  assert.equal(auth.fieldState.mapId, "222000001");
});

test("failed replace leaves consumer snapshot unchanged", async () => {
  const mapA = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000000" })).plan;
  const mapB = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan;
  const in00 = mapA.portalLogicalIndex.entries.find((p) => p.name === "in00");
  const st00 = mapB.portalLogicalIndex.entries.find((p) => p.name === "st00");
  const movementState = createMovementState({
    worldX: mapA.fieldState.player.worldX,
    worldY: mapA.fieldState.player.worldY,
    segments: mapA.footholdCollisionPlan.segments,
  });
  const commit = planCrossMapPortalCommit({
    sourcePlan: mapA,
    targetPlan: mapB,
    fieldState: mapA.fieldState,
    movementState,
    sourcePortal: in00,
    targetPortal: st00,
    viewport,
    travelToken: 4,
    nextSceneEpoch: 1,
  });
  let consumer = { mapId: mapA.mapId, committed: false };
  assert.throws(() => {
    applyCrossMapPortalRenderReplace(commit, {
      replace() {
        throw new TypeError("Removed RenderNode key cannot be reused");
      },
    });
  }, /cannot be reused/u);
  assert.equal(consumer.mapId, "222000000");
  assert.equal(consumer.committed, false);
});
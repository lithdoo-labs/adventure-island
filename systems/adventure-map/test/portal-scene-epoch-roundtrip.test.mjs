import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { applySceneEpochToRenderRoot } from "../portal-scene-epoch.mjs";
import { planCrossMapPortalCommit } from "../portal-transaction.mjs";
import { createMovementState } from "../movement-sim.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const viewport = Object.freeze({ width: 800, height: 600 });

function staticChildKeys(root) {
  return root.children
    .filter((c) => c.key !== "player:adventure")
    .map((c) => c.key);
}

test("A→B→A uses distinct epoch suffixes and does not reuse consumed static keys", async () => {
  const mapA = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000000" })).plan;
  const mapB = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan;
  const in00 = mapA.portalLogicalIndex.entries.find((p) => p.name === "in00");
  const st00 = mapB.portalLogicalIndex.entries.find((p) => p.name === "st00");
  const out00 = mapB.portalLogicalIndex.entries.find((p) => p.name === "out00");
  const movementState = createMovementState({
    worldX: mapA.fieldState.player.worldX,
    worldY: mapA.fieldState.player.worldY,
    segments: mapA.footholdCollisionPlan.segments,
  });

  const toB = planCrossMapPortalCommit({
    sourcePlan: mapA,
    targetPlan: mapB,
    fieldState: mapA.fieldState,
    movementState,
    sourcePortal: in00,
    targetPortal: st00,
    viewport,
    travelToken: 1,
    nextSceneEpoch: 1,
  });
  const toA = planCrossMapPortalCommit({
    sourcePlan: mapB,
    targetPlan: mapA,
    fieldState: toB.fieldState,
    movementState: toB.movementState,
    sourcePortal: out00,
    targetPortal: in00,
    viewport,
    travelToken: 2,
    nextSceneEpoch: 2,
  });

  const epoch1Keys = staticChildKeys(toB.renderRoot);
  const epoch2Keys = staticChildKeys(toA.renderRoot);
  const initialKeys = staticChildKeys(mapA.root);

  assert.ok(epoch1Keys.every((k) => k.endsWith(":e1")));
  assert.ok(epoch2Keys.every((k) => k.endsWith(":e2")));
  assert.ok(initialKeys.every((k) => !k.includes(":e")));
  assert.ok(epoch1Keys.every((k) => !epoch2Keys.includes(k)));
  assert.notEqual(toB.renderRoot.key, toA.renderRoot.key);
  assert.equal(applySceneEpochToRenderRoot(mapA.root, 2).key, toA.renderRoot.key);
});
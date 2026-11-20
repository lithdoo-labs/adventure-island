import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { resolveTravelTarget } from "../portal-target-resolve.mjs";
import { planCrossMapPortalCommit } from "../portal-transaction.mjs";
import { buildArrivalMovementState } from "../portal-arrival.mjs";
import { isM7EnabledPortalEdge } from "../portal-constants.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const viewport = Object.freeze({ width: 800, height: 600 });

const plans = Object.freeze({
  "222000000": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000000" })).plan,
  "222000001": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan,
  "230030200": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "230030200" })).plan,
});

function portalByName(index, name) {
  return index.entries.find((entry) => entry.name === name);
}

test("M7.1 portal graph enables only the four approved edges", () => {
  const enabled = plans["222000000"].portalLogicalIndex.entries.filter((p) => p.enabled);
  assert.deepEqual(enabled.map((p) => p.name), ["in00"]);
  const mapB = plans["222000001"].portalLogicalIndex;
  assert.ok(portalByName(mapB, "out00").enabled);
  assert.ok(portalByName(mapB, "sea00").enabled);
  const west = portalByName(plans["230030200"].portalLogicalIndex, "west00");
  assert.equal(west?.enabled, false);
  assert.ok(portalByName(plans["230030200"].portalLogicalIndex, "east00").enabled);
  assert.equal(isM7EnabledPortalEdge("230030200", "west00"), false);
});

test("A→B→C→B→A cross-map commits preserve medium and zero arrival velocity", () => {
  const chain = [
    ["222000000", "in00", "222000001", "st00"],
    ["222000001", "sea00", "230030200", "east00"],
    ["230030200", "east00", "222000001", "sea00"],
    ["222000001", "out00", "222000000", "in00"],
  ];
  let activePlan = plans["222000000"];
  let fieldState = activePlan.fieldState;
  let movementState = buildArrivalMovementState(
    portalByName(activePlan.portalLogicalIndex, "in00"),
    activePlan.footholdCollisionPlan,
    { mapEnvironment: activePlan.mapEnvironment },
  );
  let epoch = 0;
  for (const [sourceId, sourceName, targetId, targetName] of chain) {
    const sourcePlan = plans[sourceId];
    const targetPlan = plans[targetId];
    const sourcePortal = portalByName(sourcePlan.portalLogicalIndex, sourceName);
    const targetPortal = resolveTravelTarget(sourcePortal, targetPlan.portalLogicalIndex).portal;
    assert.equal(targetPortal.name, targetName);
    epoch += 1;
    const commit = planCrossMapPortalCommit({
      sourcePlan: activePlan,
      targetPlan,
      fieldState,
      movementState,
      sourcePortal,
      targetPortal,
      viewport,
      travelToken: epoch,
      nextSceneEpoch: epoch,
    });
    activePlan = commit.activePlan;
    fieldState = commit.fieldState;
    movementState = commit.movementState;
    assert.equal(fieldState.mapId, targetId);
    assert.equal(movementState.velocityX, 0);
    assert.equal(movementState.velocityY, 0);
    if (targetId === "230030200") {
      assert.equal(movementState.medium, "water");
      assert.equal(movementState.locomotion, "swim");
    } else {
      assert.equal(movementState.medium, "land");
    }
  }
  assert.equal(fieldState.mapId, "222000000");
});

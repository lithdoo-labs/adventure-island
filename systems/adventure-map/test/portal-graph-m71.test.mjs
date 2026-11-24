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
  "230030100": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "230030100" })).plan,
});

function portalByName(index, name) {
  return index.entries.find((entry) => entry.name === name);
}

test("M7 portal graph enables the well hop and its return", () => {
  const enabled = plans["222000000"].portalLogicalIndex.entries.filter((p) => p.enabled);
  assert.deepEqual(enabled.map((p) => p.name), ["in00"]);
  const mapB = plans["222000001"].portalLogicalIndex;
  assert.ok(portalByName(mapB, "out00").enabled);
  assert.ok(portalByName(mapB, "sea00").enabled);
  const well = plans["230030200"].portalLogicalIndex;
  assert.ok(portalByName(well, "east00").enabled);
  const west = portalByName(well, "west00");
  assert.equal(west.enabled, true);
  assert.equal(String(west.targetMap), "230030100");
  assert.equal(west.targetName, "east00");
  assert.equal(isM7EnabledPortalEdge("230030200", "west00"), true);
  const link = plans["230030100"].portalLogicalIndex;
  const back = portalByName(link, "east00");
  assert.equal(back.enabled, true);
  assert.equal(String(back.targetMap), "230030200");
  assert.equal(back.targetName, "west00");
  assert.equal(portalByName(link, "west00").enabled, false);
  assert.equal(portalByName(link, "out00").enabled, false);
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

test("west00 on the well map commits onto 230030100 and the return comes back", () => {
  const source = plans["230030200"];
  const target = plans["230030100"];
  const west = portalByName(source.portalLogicalIndex, "west00");
  const arrived = resolveTravelTarget(west, target.portalLogicalIndex).portal;
  assert.equal(arrived.name, "east00");
  const commit = planCrossMapPortalCommit({
    sourcePlan: source,
    targetPlan: target,
    fieldState: source.fieldState,
    movementState: buildArrivalMovementState(
      portalByName(source.portalLogicalIndex, "east00"),
      source.footholdCollisionPlan,
      { mapEnvironment: source.mapEnvironment },
    ),
    sourcePortal: west,
    targetPortal: arrived,
    viewport,
    travelToken: 1,
    nextSceneEpoch: 1,
  });
  assert.equal(commit.fieldState.mapId, "230030100");
  assert.equal(commit.movementState.medium, "water");
  assert.equal(commit.movementState.velocityX, 0);
  assert.equal(commit.movementState.velocityY, 0);
  assert.equal(commit.movementState.worldX, arrived.x);
  const back = portalByName(target.portalLogicalIndex, "east00");
  const home = resolveTravelTarget(back, source.portalLogicalIndex).portal;
  assert.equal(home.name, "west00");
});

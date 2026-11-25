import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { resolveTravelTarget } from "../portal-target-resolve.mjs";
import { planCrossMapPortalCommit } from "../portal-transaction.mjs";
import { buildArrivalMovementState } from "../portal-arrival.mjs";
import { playerInPortalRevealBox } from "../portal-trigger.mjs";
import { evaluatePortalOnUpEdge } from "../portal-runtime-bridge.mjs";

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

test("hidden portal reveal is wider than the Up box and excludes the far edges", () => {
  const portal = { x: -2178, y: 234 };
  assert.equal(playerInPortalRevealBox({ worldX: -2178, worldY: 234 }, portal), true);
  assert.equal(playerInPortalRevealBox({ worldX: -2278, worldY: 184 }, portal), true);
  assert.equal(playerInPortalRevealBox({ worldX: -2078, worldY: 234 }, portal), false);
  assert.equal(playerInPortalRevealBox({ worldX: -2178, worldY: 284 }, portal), false);
  assert.equal(playerInPortalRevealBox({ worldX: -2178.2, worldY: 233.8 }, portal), true);
  assert.equal(playerInPortalRevealBox({ worldX: -92, worldY: 243 }, portal), false);
});

test("published hidden portals travel to the named portal on Up", () => {
  const plan = plans["222000000"];
  const ph00 = portalByName(plan.portalLogicalIndex, "ph00");
  const ph00_1 = portalByName(plan.portalLogicalIndex, "ph00_1");
  assert.equal(ph00.enabled, true);
  assert.equal(ph00_1.enabled, true);
  const decision = evaluatePortalOnUpEdge({
    activePlan: plan,
    portalIndex: plan.portalLogicalIndex,
    fieldState: {
      ...plan.fieldState,
      player: { ...plan.fieldState.player, worldX: ph00.x, worldY: ph00.y },
    },
    movementState: { facing: "right", grounded: true, contact: { id: 1 } },
    viewport,
  });
  assert.equal(decision.type, "same-map");
  assert.equal(decision.commit.fieldState.portalTravel.targetEdge, "222000000:ph00_1");
  assert.equal(decision.commit.fieldState.player.worldX, ph00_1.x);
  assert.equal(decision.commit.fieldState.player.worldY, ph00_1.y - 10);
  assert.equal(decision.commit.movementState.grounded, false);
  const away = evaluatePortalOnUpEdge({
    activePlan: plan,
    portalIndex: plan.portalLogicalIndex,
    fieldState: plan.fieldState,
    movementState: { facing: "right", grounded: true, contact: { id: 1 } },
    viewport,
  });
  assert.equal(away.type, "none");
});

test("M7 portal graph enables the well hop and its return", () => {
  const enabled = plans["222000000"].portalLogicalIndex.entries.filter((p) => p.enabled);
  assert.deepEqual(enabled.map((p) => p.name), ["in00", "ph00", "ph00_1"]);
  const mapB = plans["222000001"].portalLogicalIndex;
  assert.ok(portalByName(mapB, "out00").enabled);
  assert.ok(portalByName(mapB, "sea00").enabled);
  const well = plans["230030200"].portalLogicalIndex;
  assert.ok(portalByName(well, "east00").enabled);
  const west = portalByName(well, "west00");
  assert.equal(west.enabled, true);
  assert.equal(String(west.targetMap), "230030100");
  assert.equal(west.targetName, "east00");
  const link = plans["230030100"].portalLogicalIndex;
  const back = portalByName(link, "east00");
  assert.equal(back.enabled, true);
  assert.equal(String(back.targetMap), "230030200");
  assert.equal(back.targetName, "west00");
  assert.equal(portalByName(link, "west00").enabled, false);
  assert.equal(portalByName(link, "out00").enabled, false);
  const sameMap = link.entries.filter((entry) => entry.enabled && String(entry.targetMap) === "230030100");
  assert.deepEqual(sameMap.map((entry) => entry.name), ["h000", "h001", "h002"]);
  const h000 = portalByName(link, "h000");
  const decision = evaluatePortalOnUpEdge({
    activePlan: plans["230030100"],
    portalIndex: link,
    fieldState: {
      ...plans["230030100"].fieldState,
      player: { ...plans["230030100"].fieldState.player, worldX: h000.x, worldY: h000.y },
    },
    movementState: { facing: "right", grounded: true, contact: { id: 1 } },
    viewport,
  });
  assert.equal(decision.type, "same-map");
  assert.equal(decision.commit.fieldState.portalTravel.targetEdge, "230030100:h001");
  assert.equal(decision.commit.fieldState.player.worldX, portalByName(link, "h001").x);
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

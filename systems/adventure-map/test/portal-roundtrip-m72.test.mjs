import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { resolveTravelTarget } from "../portal-target-resolve.mjs";
import { planCrossMapPortalCommit } from "../portal-transaction.mjs";
import { buildArrivalMovementState } from "../portal-arrival.mjs";
import { playerInPortalTriggerBox } from "../portal-trigger.mjs";
import { selectPortalTriggerCandidate } from "../portal-trigger.mjs";
import { evaluatePortalOnUpEdge } from "../portal-runtime-bridge.mjs";
import { createMovementStateForMap, stepMovementForMap } from "../movement-step.mjs";
import { movementIntentFromHeld, movementIntentFromHeldForState } from "../movement-intent.mjs";
import { CLIMB_DELTA_PER_TICK } from "../movement-rope.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const viewport = Object.freeze({ width: 800, height: 600 });

const plans = Object.freeze({
  "222000000": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000000" })).plan,
  "222000001": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan,
  "230030200": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "230030200" })).plan,
});
const mapBRopes = (await readFile(path.join(
  repoRoot,
  "content",
  "[FSDB]adventure",
  "[group]map.Rope",
  "map.222000001.jsonl",
), "utf8"))
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line));

function portalByName(index, name) {
  return index.entries.find((entry) => entry.name === name);
}

function staticChildKeys(root) {
  return root.children
    .filter((c) => c.key !== "player:adventure")
    .map((c) => c.key);
}

test("east00 audited Up trigger covers sea00→east00 arrival feet on map C", () => {
  const mapB = plans["222000001"];
  const mapC = plans["230030200"];
  const sea00 = portalByName(mapB.portalLogicalIndex, "sea00");
  const east00 = portalByName(mapC.portalLogicalIndex, "east00");
  assert.equal(east00.x, 296);
  assert.equal(east00.y, -98);
  const targetPortal = resolveTravelTarget(sea00, mapC.portalLogicalIndex).portal;
  assert.equal(targetPortal.name, "east00");
  const arrival = buildArrivalMovementState(targetPortal, mapC.footholdCollisionPlan, {
    mapEnvironment: mapC.mapEnvironment,
  });
  assert.equal(arrival.worldX, 296);
  assert.equal(arrival.worldY, -98);
  assert.equal(arrival.medium, "water");
  assert.equal(arrival.locomotion, "swim");
  assert.ok(playerInPortalTriggerBox({ worldX: arrival.worldX, worldY: arrival.worldY }, east00));
  const selected = selectPortalTriggerCandidate(mapC.portalLogicalIndex, { worldX: arrival.worldX, worldY: arrival.worldY }, true);
  assert.equal(selected?.name, "east00");
});

test("C→B commit restores land stand and zeros velocity at sea00", () => {
  const mapB = plans["222000001"];
  const mapC = plans["230030200"];
  const east00 = portalByName(mapC.portalLogicalIndex, "east00");
  const sea00 = resolveTravelTarget(east00, mapB.portalLogicalIndex).portal;
  const waterField = Object.freeze({
    ...plans["230030200"].fieldState,
    mapId: "230030200",
    player: Object.freeze({
      worldX: 296,
      worldY: -98,
      facing: "right",
      locomotion: "swim",
      layer: 0,
      zM: 0,
      expression: "default",
    }),
  });
  const waterMovement = createMovementStateForMap({
    mapEnvironment: mapC.mapEnvironment,
    worldX: 296,
    worldY: -98,
    facing: "right",
    segments: mapC.footholdCollisionPlan.segments,
  });
  const commit = planCrossMapPortalCommit({
    sourcePlan: mapC,
    targetPlan: mapB,
    fieldState: waterField,
    movementState: waterMovement,
    sourcePortal: east00,
    targetPortal: sea00,
    viewport,
    travelToken: 3,
    nextSceneEpoch: 3,
  });
  assert.equal(commit.fieldState.mapId, "222000001");
  assert.equal(commit.movementState.medium, "land");
  assert.equal(commit.movementState.locomotion, "stand");
  assert.equal(commit.movementState.velocityX, 0);
  assert.equal(commit.movementState.velocityY, 0);
  assert.equal(commit.movementState.worldX, 6);
  assert.ok(commit.renderRoot.key.endsWith(":e3"));
  assert.ok(staticChildKeys(commit.renderRoot).every((k) => k.endsWith(":e3")));
});

test("A→B→C→B→C→B repeat assigns monotonic scene epochs without key reuse", () => {
  const chain = [
    ["222000000", "in00", "222000001", "st00"],
    ["222000001", "sea00", "230030200", "east00"],
    ["230030200", "east00", "222000001", "sea00"],
    ["222000001", "sea00", "230030200", "east00"],
    ["230030200", "east00", "222000001", "sea00"],
  ];
  let activePlan = plans["222000000"];
  let fieldState = activePlan.fieldState;
  let movementState = buildArrivalMovementState(
    portalByName(activePlan.portalLogicalIndex, "in00"),
    activePlan.footholdCollisionPlan,
    { mapEnvironment: activePlan.mapEnvironment },
  );
  const seenRootKeys = new Set([activePlan.root.key]);
  const seenStaticKeys = new Set(staticChildKeys(activePlan.root));
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
    assert.equal(commit.sceneEpoch, epoch);
    assert.ok(!seenRootKeys.has(commit.renderRoot.key));
    seenRootKeys.add(commit.renderRoot.key);
    for (const key of staticChildKeys(commit.renderRoot)) {
      assert.ok(!seenStaticKeys.has(key), `static key reused: ${key}`);
      seenStaticKeys.add(key);
    }
    activePlan = commit.activePlan;
    fieldState = commit.fieldState;
    movementState = commit.movementState;
    assert.equal(fieldState.mapId, targetId);
  }
});

test("B shaft rope climbs to out00 portal band without teleport", () => {
  const mapB = plans["222000001"];
  const mapA = plans["222000000"];
  const rope = mapB.ropeCollisionPlan.segments[0];
  const out00 = portalByName(mapB.portalLogicalIndex, "out00");
  let movement = createMovementStateForMap({
    mapEnvironment: mapB.mapEnvironment,
    worldX: 6,
    worldY: 514,
    facing: "right",
    segments: mapB.footholdCollisionPlan.segments,
  });
  for (let index = 0; index < 22; index += 1) {
    movement = stepMovementForMap(
      movement,
      movementIntentFromHeldForState(["left"]),
      mapB.footholdCollisionPlan,
      mapB.ropeCollisionPlan,
      mapB.movementConfig,
      mapB.mapEnvironment,
      {},
    );
  }
  movement = stepMovementForMap(
    movement,
    movementIntentFromHeldForState(["down"]),
    mapB.footholdCollisionPlan,
    mapB.ropeCollisionPlan,
    mapB.movementConfig,
    mapB.mapEnvironment,
    {},
  );
  assert.equal(movement.mode, "climb");
  const ticks = Math.ceil((rope.y2 - (out00.y + 5)) / CLIMB_DELTA_PER_TICK) + 2;
  for (let index = 0; index < ticks; index += 1) {
    movement = stepMovementForMap(
      movement,
      movementIntentFromHeld(["up"]),
      mapB.footholdCollisionPlan,
      mapB.ropeCollisionPlan,
      mapB.movementConfig,
      mapB.mapEnvironment,
      {},
    );
  }
  assert.ok(movement.worldY <= out00.y + 20);
  assert.equal(movement.worldX, rope.x);
  const atOut = selectPortalTriggerCandidate(
    mapB.portalLogicalIndex,
    { worldX: movement.worldX, worldY: movement.worldY },
    true,
  );
  assert.equal(atOut?.name, "out00");
  const targetPortal = resolveTravelTarget(atOut, mapA.portalLogicalIndex).portal;
  assert.equal(targetPortal.name, "in00");
});

test("B sea00 return feet bind Up to water sea00; rope authority is published in FieldPlan", () => {
  const mapB = plans["222000001"];
  const sea00 = portalByName(mapB.portalLogicalIndex, "sea00");
  const out00 = portalByName(mapB.portalLogicalIndex, "out00");
  const arrival = buildArrivalMovementState(sea00, mapB.footholdCollisionPlan, {
    mapEnvironment: mapB.mapEnvironment,
  });
  assert.equal(arrival.worldX, 6);
  assert.equal(out00.x, -31);
  assert.equal(out00.y, -463);
  const upAtSea = selectPortalTriggerCandidate(
    mapB.portalLogicalIndex,
    { worldX: arrival.worldX, worldY: arrival.worldY },
    true,
  );
  assert.equal(upAtSea?.name, "sea00");
  assert.ok(!playerInPortalTriggerBox({ worldX: arrival.worldX, worldY: arrival.worldY }, out00));
  const atOut = selectPortalTriggerCandidate(
    mapB.portalLogicalIndex,
    { worldX: out00.x, worldY: out00.y },
    true,
  );
  assert.equal(atOut?.name, "out00");
  assert.deepEqual(mapBRopes, [{ x: -51, y1: -499, y2: 474, l: 0, uf: 0, page: 4, id: 1 }]);
  const verticalSpan = Math.abs(sea00.y - out00.y);
  assert.ok(verticalSpan > 900);
  assert.equal(mapB.ropeCollisionPlan.segments.length, 1);
  assert.equal(mapB.ropeCollisionPlan.segments[0].x, -51);
});

test("evaluatePortalOnUpEdge on C at east00 feet schedules cross-map prepare", () => {
  const mapC = plans["230030200"];
  const fieldState = Object.freeze({
    ...mapC.fieldState,
    mapId: "230030200",
    player: Object.freeze({
      worldX: 296,
      worldY: -98,
      facing: "right",
      locomotion: "swim",
      layer: 0,
      zM: 0,
      expression: "default",
    }),
    portalTravel: Object.freeze({ phase: "idle", activeToken: 2, sceneEpoch: 2, crossMap: false }),
  });
  const movementState = createMovementStateForMap({
    mapEnvironment: mapC.mapEnvironment,
    worldX: 296,
    worldY: -98,
    segments: mapC.footholdCollisionPlan.segments,
  });
  const decision = evaluatePortalOnUpEdge({
    activePlan: mapC,
    portalIndex: mapC.portalLogicalIndex,
    fieldState,
    movementState,
    viewport,
  });
  assert.equal(decision.type, "cross-map");
  assert.equal(decision.sourcePortal.name, "east00");
  assert.equal(decision.targetMapId, "222000001");
});

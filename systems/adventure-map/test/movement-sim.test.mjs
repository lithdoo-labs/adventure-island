import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import { buildFootholdCollisionPlan } from "../foothold-collision-plan-build.mjs";
import {
  BUSINESS_TICK_MS,
  createMovementState,
  findLandingSegment,
  stepMovement,
  applyMovementToFieldState,
} from "../movement-sim.mjs";
import { movementIntentFromHeld } from "../movement-intent.mjs";
import { hashFieldState as stateHash } from "../field-state-hash.mjs";
import { createStaticFieldState } from "../../../components/ms-field/src/field-state.mjs";
import { applyCameraToFieldState } from "../camera-state.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const movementConfig = Object.freeze({
  walkSpeed: 125,
  gravityAcc: 2000,
  fallSpeed: 670,
  jumpSpeed: 555,
  swimForce: 120_000,
  swimSpeed: 140,
  swimSpeedDec: 0.9,
});

test("createMovementState snaps canonical spawn onto reachable foothold", async () => {
  const map = await buildMapProjection({ mapId: "222000000", gameRoot: repoRoot });
  const plan = buildFootholdCollisionPlan(map.scene.footholds);
  const movement = createMovementState({
    worldX: -92,
    worldY: 294,
    facing: "right",
    segments: plan.segments,
  });
  assert.equal(movement.grounded, true);
  assert.equal(movement.worldY, 243);
  assert.equal(movement.contact.footholdId, 163);
});

function replayWalkTicks(footholdCollisionPlan, effectiveBounds) {
  const intents = [
    movementIntentFromHeld(["right"]),
    movementIntentFromHeld(["right"]),
    movementIntentFromHeld([]),
  ];
  let movement = createMovementState({
    worldX: -92,
    worldY: 294,
    facing: "right",
    segments: footholdCollisionPlan.segments,
  });
  let fieldState = applyMovementToFieldState(createStaticFieldState(), movement);
  fieldState = applyCameraToFieldState(fieldState, { width: 800, height: 600 }, effectiveBounds).fieldState;
  const hashes = [];
  for (const intent of intents) {
    for (let tick = 0; tick < 5; tick += 1) {
      movement = stepMovement(movement, intent, footholdCollisionPlan, movementConfig, {});
      fieldState = applyMovementToFieldState(fieldState, movement);
      fieldState = applyCameraToFieldState(fieldState, { width: 800, height: 600 }, effectiveBounds).fieldState;
      hashes.push(stateHash(fieldState));
    }
  }
  return { hashes, movement, fieldState };
}

test("replay hash is stable for walk+release on real foothold plan", async () => {
  const map = await buildMapProjection({ mapId: "222000000", gameRoot: repoRoot });
  const footholdCollisionPlan = buildFootholdCollisionPlan(map.scene.footholds);
  const effectiveBounds = map.scene.bounds.effectiveBounds;
  const first = replayWalkTicks(footholdCollisionPlan, effectiveBounds);
  const second = replayWalkTicks(footholdCollisionPlan, effectiveBounds);
  assert.deepEqual(first.hashes, second.hashes, "identical intent/tick sequences yield identical hashes");
  assert.ok(first.movement.worldX > -92, "walk moved the player");
  assert.ok(Number.isFinite(first.fieldState.camera.cameraX));
});

test("jump and land restores grounded contact", async () => {
  const map = await buildMapProjection({ mapId: "222000000", gameRoot: repoRoot });
  const footholdCollisionPlan = buildFootholdCollisionPlan(map.scene.footholds);
  let movement = createMovementState({
    worldX: -92,
    worldY: 294,
    facing: "right",
    segments: footholdCollisionPlan.segments,
  });
  movement = stepMovement(
    movement,
    movementIntentFromHeld(["up"]),
    footholdCollisionPlan,
    movementConfig,
    { jumpPressed: true },
  );
  assert.equal(movement.grounded, false);
  assert.ok(movement.velocityY < 0);
  let landed = false;
  for (let tick = 0; tick < 80; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld([]), footholdCollisionPlan, movementConfig, {});
    if (movement.grounded) {
      landed = true;
      break;
    }
  }
  assert.equal(landed, true);
  assert.ok(movement.worldY === 243 || movement.worldY === 230, "landed on canonical foothold near spawn");
});

test("BUSINESS_TICK_MS is 20", () => {
  assert.equal(BUSINESS_TICK_MS, 20);
});

test("descending sweep lands on the first crossed platform", () => {
  const upper = { layer: 1, platform: 1, id: 1, x1: -10, y1: 20, x2: 10, y2: 20 };
  const lower = { layer: 1, platform: 2, id: 2, x1: -10, y1: 40, x2: 10, y2: 40 };
  assert.equal(findLandingSegment(0, 0, 50, [lower, upper]).footholdId, 1);
});

test("walking off an edge integrates horizontal position exactly once", () => {
  const segment = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 2, y2: 0 };
  const plan = { segments: [segment] };
  const movement = createMovementState({ worldX: 1.5, worldY: 0, segments: plan.segments });
  const next = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
  assert.equal(next.worldX, 4, "125px/s at 20ms advances 2.5px once");
  assert.equal(next.grounded, false);
  assert.equal(next.mode, "fall");
});

test("opposite directions are neutral and preserve facing", () => {
  const intent = movementIntentFromHeld(["left", "right"]);
  assert.equal(intent.left, true);
  assert.equal(intent.right, true);
  assert.equal(intent.facing, null);
});

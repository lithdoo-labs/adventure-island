import assert from "node:assert/strict";
import test from "node:test";
import { movementIntentFromHeld, movementIntentFromHeldForState } from "../movement-intent.mjs";
import { hashFieldState } from "../field-state-hash.mjs";
import { createStaticFieldState } from "../../../components/ms-field/src/field-state.mjs";
import { applyMovementToFieldState, BUSINESS_TICK_MS } from "../movement-sim.mjs";
import {
  WATER_JUMP_SPEED_MULTIPLIER,
  createWaterMovementState,
  stepSwimMapMovement,
  stepWaterMovement,
} from "../movement-water.mjs";
import { validateMovementConfig } from "../movement-config.mjs";
import { MOVEMENT_CONFIG_KEY, MOVEMENT_CONFIG_NAMESPACE } from "../movement-config.mjs";

const movementConfig = validateMovementConfig(Object.freeze({
  formatVersion: 1,
  source: Object.freeze({
    namespace: MOVEMENT_CONFIG_NAMESPACE,
    key: MOVEMENT_CONFIG_KEY,
    contentVersion: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  }),
  walkSpeed: 125,
  gravityAcc: 2000,
  fallSpeed: 670,
  jumpSpeed: 555,
  swimForce: 120_000,
  swimSpeed: 140,
  swimSpeedDec: 0.9,
  floatDrag1: 100_000,
}));

test("water jump writes -(swimSpeed * 5) and the same tick keeps integrating", () => {
  const state = createWaterMovementState({ worldX: 0, worldY: 100 });
  const next = stepWaterMovement(
    state,
    movementIntentFromHeld(["jump"]),
    movementConfig,
    { jumpPressed: true },
  );
  const impulse = -movementConfig.swimSpeed * WATER_JUMP_SPEED_MULTIPLIER;
  assert.ok(next.velocityY > impulse);
  assert.ok(next.velocityY < 0);
  assert.equal(next.jumpRepeatMs, 0);
});

test("water movement replay hash is stable", () => {
  let movement = createWaterMovementState({ worldX: 10, worldY: 200, facing: "right" });
  let fieldState = applyMovementToFieldState(
    createStaticFieldState({ mapId: "230030200" }),
    movement,
  );
  const hashes = [];
  const intents = [
    movementIntentFromHeld(["right"]),
    movementIntentFromHeld(["right", "up"]),
    movementIntentFromHeld([]),
  ];
  for (const intent of intents) {
    for (let tick = 0; tick < 8; tick += 1) {
      const jumpPressed = intent.jump && tick === 0;
      movement = stepWaterMovement(movement, intent, movementConfig, { jumpPressed });
      fieldState = applyMovementToFieldState(fieldState, movement);
      hashes.push(hashFieldState(fieldState));
    }
  }
  const again = [];
  movement = createWaterMovementState({ worldX: 10, worldY: 200, facing: "right" });
  fieldState = applyMovementToFieldState(
    createStaticFieldState({ mapId: "230030200" }),
    movement,
  );
  for (const intent of intents) {
    for (let tick = 0; tick < 8; tick += 1) {
      const jumpPressed = intent.jump && tick === 0;
      movement = stepWaterMovement(movement, intent, movementConfig, { jumpPressed });
      fieldState = applyMovementToFieldState(fieldState, movement);
      again.push(hashFieldState(fieldState));
    }
  }
  assert.deepEqual(hashes, again);
});

test("idle water rises through zero and cruises at +swimSpeed", () => {
  const initial = createWaterMovementState({ worldX: 0, worldY: 100 });
  assert.equal(initial.locomotion, "swim");
  let movement = stepWaterMovement(
    initial,
    movementIntentFromHeld([]),
    movementConfig,
    { jumpPressed: true },
  );
  assert.equal(movement.locomotion, "swim");
  assert.equal(movement.mode, "swim");
  let peakY = movement.worldY;
  let crossedZero = false;
  for (let tick = 0; tick < 80; tick += 1) {
    const previousY = movement.velocityY;
    movement = stepWaterMovement(movement, movementIntentFromHeld([]), movementConfig);
    assert.ok(movement.velocityY >= previousY);
    if (movement.worldY < peakY) peakY = movement.worldY;
    if (movement.velocityY > 0) crossedZero = true;
  }
  assert.equal(crossedZero, true);
  assert.equal(movement.velocityY, movementConfig.swimSpeed);
  assert.ok(movement.worldY > peakY);
});

test("held vertical keys approach the swim cruise targets", () => {
  const idle = createWaterMovementState({ worldX: 0, worldY: 0 });
  const upIntent = movementIntentFromHeldForState(["up"]);
  const up = stepWaterMovement(idle, upIntent, movementConfig);
  assert.ok(up.velocityY < 0);
  assert.ok(up.velocityY >= -movementConfig.swimSpeed * 0.3);
  let rising = idle;
  for (let tick = 0; tick < 8; tick += 1) {
    rising = stepWaterMovement(rising, upIntent, movementConfig);
  }
  assert.equal(rising.velocityY, -movementConfig.swimSpeed * 0.3);

  let sinking = idle;
  let roseAboveCap = false;
  for (let tick = 0; tick < 40; tick += 1) {
    sinking = stepWaterMovement(sinking, movementIntentFromHeld(["down"]), movementConfig);
    assert.ok(sinking.velocityY > 0);
    assert.ok(sinking.velocityY < movementConfig.swimSpeed * 1.5);
    if (sinking.velocityY > movementConfig.swimSpeed) roseAboveCap = true;
  }
  assert.equal(roseAboveCap, true);
});

test("horizontal swim accelerates to the cap and releases toward zero", () => {
  let movement = createWaterMovementState({ worldX: 0, worldY: 0 });
  movement = stepWaterMovement(movement, movementIntentFromHeld(["right"]), movementConfig);
  assert.ok(movement.velocityX > 0);
  assert.ok(movement.velocityX < movementConfig.swimSpeed);
  for (let tick = 0; tick < 20; tick += 1) {
    movement = stepWaterMovement(movement, movementIntentFromHeld(["right"]), movementConfig);
  }
  assert.equal(movement.velocityX, movementConfig.swimSpeed);
  const released = stepWaterMovement(movement, movementIntentFromHeld([]), movementConfig);
  assert.ok(released.velocityX < movement.velocityX);
  assert.ok(released.velocityX > 0);
});

test("holding jump does not repeat the buoyant impulse", () => {
  const intent = movementIntentFromHeld(["south"]);
  let movement = stepWaterMovement(
    createWaterMovementState({ worldX: 0, worldY: 0 }),
    intent,
    movementConfig,
    { jumpPressed: true },
  );
  const first = movement.velocityY;
  for (let tick = 0; tick < 5; tick += 1) {
    const previous = movement.velocityY;
    movement = stepWaterMovement(movement, intent, movementConfig);
    assert.ok(movement.velocityY > previous);
  }
  assert.ok(movement.velocityY > first);
  assert.equal(movement.jumpRepeatMs, 0);
});

const portalLedge = Object.freeze({
  layer: 3,
  platform: 113,
  id: 42,
  x1: 230,
  y1: -94,
  x2: 364,
  y2: -94,
});
const lowerFloor = Object.freeze({
  layer: 3,
  platform: 105,
  id: 23,
  x1: 231,
  y1: 220,
  x2: 309,
  y2: 220,
});
const swimFootholds = Object.freeze({ segments: Object.freeze([portalLedge, lowerFloor]) });

function settleOnFoothold(start) {
  let movement = start;
  for (let tick = 0; tick < 120 && movement.grounded !== true; tick += 1) {
    movement = stepSwimMapMovement(movement, movementIntentFromHeld([]), swimFootholds, movementConfig);
  }
  return movement;
}

test("arrival above the portal ledge lands and stands on it", () => {
  const landed = settleOnFoothold(createWaterMovementState({ worldX: 296, worldY: -108 }));
  assert.equal(landed.grounded, true);
  assert.equal(landed.worldY, -94);
  assert.equal(landed.worldX, 296);
  assert.equal(landed.velocityY, 0);
  assert.equal(landed.locomotion, "stand");
  assert.equal(landed.contact.footholdId, 42);
  assert.equal(landed.layer, 3);
  let heldDown = landed;
  for (let tick = 0; tick < 10; tick += 1) {
    heldDown = stepSwimMapMovement(
      heldDown,
      movementIntentFromHeld(["down"]),
      swimFootholds,
      movementConfig,
    );
  }
  assert.equal(heldDown.grounded, true);
  assert.equal(heldDown.worldY, -94);
  assert.equal(heldDown.locomotion, "stand");
});

test("walking off a swim foothold resumes sinking, and a lower line catches the body", () => {
  let movement = settleOnFoothold(createWaterMovementState({ worldX: 296, worldY: -108 }));
  const step = movementConfig.walkSpeed * movementConfig.swimSpeedDec * (BUSINESS_TICK_MS / 1000);
  movement = stepSwimMapMovement(
    movement,
    movementIntentFromHeld(["right"]),
    swimFootholds,
    movementConfig,
  );
  assert.equal(movement.grounded, true);
  assert.equal(movement.locomotion, "walk");
  assert.equal(movement.worldX, Math.round((296 + step) * 1000) / 1000);
  let leftGround = false;
  for (let tick = 0; tick < 40 && movement.grounded; tick += 1) {
    movement = stepSwimMapMovement(
      movement,
      movementIntentFromHeld(["right"]),
      swimFootholds,
      movementConfig,
    );
  }
  leftGround = movement.grounded === false;
  assert.equal(leftGround, true);
  assert.equal(movement.locomotion, "swim");
  const departedX = movement.worldX;
  for (let tick = 0; tick < 5; tick += 1) {
    movement = stepSwimMapMovement(movement, movementIntentFromHeld([]), swimFootholds, movementConfig);
  }
  assert.equal(movement.grounded, false);
  assert.ok(movement.velocityY > 0);
  assert.ok(movement.worldX >= departedX);
  const dropped = settleOnFoothold(createWaterMovementState({ worldX: 270, worldY: 0 }));
  assert.equal(dropped.contact.footholdId, 23);
  assert.equal(dropped.worldY, 220);
  assert.equal(dropped.locomotion, "stand");
});

test("a grounded swim jump uses the water impulse once", () => {
  const landed = settleOnFoothold(createWaterMovementState({ worldX: 296, worldY: -108 }));
  const intent = movementIntentFromHeld(["south"]);
  const jumped = stepSwimMapMovement(
    landed,
    intent,
    swimFootholds,
    movementConfig,
    { jumpPressed: true },
  );
  const impulse = -movementConfig.swimSpeed * WATER_JUMP_SPEED_MULTIPLIER;
  assert.equal(jumped.grounded, false);
  assert.equal(jumped.locomotion, "swim");
  assert.ok(jumped.worldY < landed.worldY);
  assert.ok(jumped.velocityY < -movementConfig.jumpSpeed);
  assert.ok(jumped.velocityY > impulse);
  const held = stepSwimMapMovement(jumped, intent, swimFootholds, movementConfig);
  assert.ok(held.velocityY > jumped.velocityY);
});

import assert from "node:assert/strict";
import test from "node:test";
import { movementIntentFromHeld, movementIntentFromHeldForState } from "../movement-intent.mjs";
import { hashFieldState } from "../field-state-hash.mjs";
import { createStaticFieldState } from "../../../components/ms-field/src/field-state.mjs";
import { applyMovementToFieldState, BUSINESS_TICK_MS } from "../movement-sim.mjs";
import {
  WATER_JUMP_REPEAT_MS,
  WATER_JUMP_SPEED_MULTIPLIER,
  createWaterMovementState,
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
  assert.equal(next.jumpRepeatMs, WATER_JUMP_REPEAT_MS);
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

test("holding jump repeats the buoyant impulse on the 300 ms cadence", () => {
  const intent = movementIntentFromHeld(["jump"]);
  let movement = stepWaterMovement(
    createWaterMovementState({ worldX: 0, worldY: 0 }),
    intent,
    movementConfig,
    { jumpPressed: true },
  );
  const first = movement.velocityY;
  let repeated = false;
  for (let tick = 0; tick < 20; tick += 1) {
    const previous = movement.velocityY;
    movement = stepWaterMovement(movement, intent, movementConfig);
    if (movement.velocityY < previous && movement.jumpRepeatMs === WATER_JUMP_REPEAT_MS) {
      repeated = true;
      assert.equal(movement.velocityY, first);
      break;
    }
  }
  assert.equal(repeated, true);
  assert.equal(movement.simulationTimeMs, BUSINESS_TICK_MS + WATER_JUMP_REPEAT_MS);
});

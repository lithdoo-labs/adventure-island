import assert from "node:assert/strict";
import test from "node:test";
import { movementIntentFromHeld } from "../movement-intent.mjs";
import { hashFieldState } from "../field-state-hash.mjs";
import { createStaticFieldState } from "../../../components/ms-field/src/field-state.mjs";
import { applyMovementToFieldState } from "../movement-sim.mjs";
import {
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
}));

test("water jump impulse uses -(swimSpeed * 5)", () => {
  const state = createWaterMovementState({ worldX: 0, worldY: 100 });
  const next = stepWaterMovement(
    state,
    movementIntentFromHeld(["up"]),
    movementConfig,
    { jumpPressed: true },
  );
  assert.equal(next.velocityY, -movementConfig.swimSpeed * WATER_JUMP_SPEED_MULTIPLIER);
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

test("water state keeps swim locomotion while idle and decays velocity without inventing gravity", () => {
  const initial = createWaterMovementState({ worldX: 0, worldY: 100 });
  assert.equal(initial.locomotion, "swim");
  const jumped = stepWaterMovement(
    initial,
    movementIntentFromHeld([]),
    movementConfig,
    { jumpPressed: true },
  );
  const settled = stepWaterMovement(jumped, movementIntentFromHeld([]), movementConfig);
  assert.equal(settled.velocityY, jumped.velocityY * movementConfig.swimSpeedDec);
  assert.equal(settled.locomotion, "swim");
  assert.equal(settled.mode, "swim");
});

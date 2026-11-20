import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { createMovementState, stepMovement } from "../movement-sim.mjs";
import {
  CLIMB_DELTA_PER_TICK,
  ROPE_BOTTOM_ENTRY_MAX_DROP_PX,
  stepClimbMovement,
  stepLandMovementWithRope,
  verticalAxisFromIntent,
} from "../movement-rope.mjs";
import { movementIntentFromHeld } from "../movement-intent.mjs";
import { hashFieldState, canonicalFieldState } from "../field-state-hash.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const SHAFT = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan;

test("vertical axis arbitration cancels simultaneous up and down (C-091)", () => {
  assert.equal(verticalAxisFromIntent({ up: true, down: true }), 0);
  assert.equal(verticalAxisFromIntent({ up: true, down: false }), -1);
  assert.equal(verticalAxisFromIntent({ up: false, down: true }), 1);
});

test("authenticated shaft rope replay: grab, climb, exit near out00", () => {
  const rope = SHAFT.ropeCollisionPlan.segments[0];
  const foothold = SHAFT.footholdCollisionPlan;
  const movementConfig = SHAFT.movementConfig;
  let movement = createMovementState({
    worldX: 6,
    worldY: 514,
    facing: "right",
    segments: foothold.segments,
    layer: 0,
    platform: 0,
  });
  for (let index = 0; index < 22; index += 1) {
    movement = stepLandMovementWithRope(
      movement,
      movementIntentFromHeld(["left"]),
      foothold,
      SHAFT.ropeCollisionPlan,
      movementConfig,
      {},
      stepMovement,
    );
  }
  const grabIntent = movementIntentFromHeld(["down"]); // C-091 +1 vertical axis
  movement = stepLandMovementWithRope(
    movement,
    grabIntent,
    foothold,
    SHAFT.ropeCollisionPlan,
    movementConfig,
    {},
    stepMovement,
  );
  assert.equal(movement.mode, "climb");
  assert.equal(movement.locomotion, "climb");
  assert.equal(movement.worldX, rope.x);
  assert.equal(movement.velocityX, 0);
  assert.equal(movement.velocityY, 0);
  assert.ok(movement.ropeContact);

  for (let index = 0; index < 5; index += 1) {
    movement = stepClimbMovement(movement, grabIntent, SHAFT.ropeCollisionPlan, foothold, {});
    assert.equal(movement.mode, "climb", "held Down must not cancel the just-established bottom contact");
    assert.equal(movement.worldY, rope.y2);
  }
  movement = stepClimbMovement(
    movement,
    movementIntentFromHeld([]),
    SHAFT.ropeCollisionPlan,
    foothold,
    {},
  );

  const climbTicks = Math.ceil((rope.y2 - (-460)) / CLIMB_DELTA_PER_TICK) + 4;
  const climbIntent = movementIntentFromHeld(["up"]);
  const snapshots = [];
  for (let index = 0; index < climbTicks; index += 1) {
    movement = stepClimbMovement(movement, climbIntent, SHAFT.ropeCollisionPlan, foothold, {});
    snapshots.push(canonicalFieldState({
      player: { worldX: movement.worldX, worldY: movement.worldY, locomotion: movement.locomotion },
      tickIndex: movement.tickIndex,
    }));
  }
  assert.ok(movement.worldY <= -460, `climbed to ${movement.worldY}, expected near out00 band`);
  assert.equal(movement.locomotion, "climb");
  assert.equal(new Set(snapshots).size, snapshots.length, "climb replay must be deterministic");
  const replay = [];
  movement = createMovementState({ worldX: 6, worldY: 514, facing: "right", segments: foothold.segments });
  for (let index = 0; index < 22; index += 1) {
    movement = stepLandMovementWithRope(
      movement,
      movementIntentFromHeld(["left"]),
      foothold,
      SHAFT.ropeCollisionPlan,
      movementConfig,
      {},
      stepMovement,
    );
  }
  movement = stepLandMovementWithRope(movement, grabIntent, foothold, SHAFT.ropeCollisionPlan, movementConfig, {}, stepMovement);
  for (let index = 0; index < 5; index += 1) {
    movement = stepClimbMovement(movement, grabIntent, SHAFT.ropeCollisionPlan, foothold, {});
  }
  movement = stepClimbMovement(
    movement,
    movementIntentFromHeld([]),
    SHAFT.ropeCollisionPlan,
    foothold,
    {},
  );
  for (let index = 0; index < climbTicks; index += 1) {
    movement = stepClimbMovement(movement, climbIntent, SHAFT.ropeCollisionPlan, foothold, {});
    replay.push(canonicalFieldState({
      player: { worldX: movement.worldX, worldY: movement.worldY, locomotion: movement.locomotion },
      tickIndex: movement.tickIndex,
    }));
  }
  assert.deepEqual(replay, snapshots);
  assert.match(hashFieldState({ player: movement }), /^sha256:/u);
});

test("bottom entry bridges only the audited sea00 gap", () => {
  const rope = SHAFT.ropeCollisionPlan.segments[0];
  const base = createMovementState({
    worldX: rope.x,
    worldY: rope.y2 + ROPE_BOTTOM_ENTRY_MAX_DROP_PX,
    facing: "right",
    segments: SHAFT.footholdCollisionPlan.segments,
  });
  const grounded = Object.freeze({
    ...base,
    worldX: rope.x,
    worldY: rope.y2 + ROPE_BOTTOM_ENTRY_MAX_DROP_PX,
    grounded: true,
    mode: "stand",
    locomotion: "stand",
  });
  const accepted = stepLandMovementWithRope(
    grounded,
    movementIntentFromHeld(["down"]),
    SHAFT.footholdCollisionPlan,
    SHAFT.ropeCollisionPlan,
    SHAFT.movementConfig,
    {},
    stepMovement,
  );
  assert.equal(accepted.mode, "climb");
  assert.equal(accepted.worldY, rope.y2);

  const tooFar = Object.freeze({
    ...grounded,
    worldY: rope.y2 + ROPE_BOTTOM_ENTRY_MAX_DROP_PX + 1,
  });
  const rejected = stepLandMovementWithRope(
    tooFar,
    movementIntentFromHeld(["down"]),
    SHAFT.footholdCollisionPlan,
    SHAFT.ropeCollisionPlan,
    SHAFT.movementConfig,
    {},
    stepMovement,
  );
  assert.notEqual(rejected.mode, "climb");
  assert.equal(rejected.ropeContact, null);
});

import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { createMovementState, stepMovement } from "../movement-sim.mjs";
import {
  CLIMB_DELTA_PER_TICK,
  stepClimbMovement,
  stepLandMovementWithRope,
  verticalAxisFromIntent,
} from "../movement-rope.mjs";
import { movementIntentFromHeld } from "../movement-intent.mjs";
import { hashFieldState, canonicalFieldState } from "../field-state-hash.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const SHAFT = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan;

const GROUND = Object.freeze({
  segments: [Object.freeze({
    id: 1,
    layer: 1,
    platform: 2,
    x1: -30,
    x2: 30,
    y1: 0,
    y2: 0,
  })],
});

function ropeSegment(overrides = {}) {
  return Object.freeze({
    stableId: "rope:test",
    sourceOrder: 0,
    x: 0,
    y1: -100,
    y2: 100,
    l: 0,
    uf: 0,
    page: 4,
    id: 9,
    ...overrides,
  });
}

function land(state, held, rope, edges = {}, foothold = GROUND) {
  return stepLandMovementWithRope(
    state,
    movementIntentFromHeld(held),
    foothold,
    { segments: [rope] },
    SHAFT.movementConfig,
    edges,
    stepMovement,
  );
}

function climbState(rope, worldY, extra = {}) {
  const base = createMovementState({
    worldX: rope.x,
    worldY: 0,
    facing: "right",
    segments: GROUND.segments,
  });
  return Object.freeze({
    ...base,
    worldX: rope.x,
    worldY,
    mode: "climb",
    grounded: false,
    contact: null,
    locomotion: "climb",
    layer: rope.page,
    platform: 0,
    ropeContact: Object.freeze({
      stableId: rope.stableId,
      ropeId: rope.id,
      x: rope.x,
      y1: rope.y1,
      y2: rope.y2,
      l: rope.l,
      uf: rope.uf,
      page: rope.page,
    }),
    ...extra,
  });
}

test("vertical axis arbitration cancels simultaneous up and down (C-091)", () => {
  assert.equal(verticalAxisFromIntent({ up: true, down: true }), 0);
  assert.equal(verticalAxisFromIntent({ up: true, down: false }), -1);
  assert.equal(verticalAxisFromIntent({ up: false, down: true }), 1);
});

test("down grab snaps to the rope top and up grab keeps the current height", () => {
  const rope = ropeSegment();
  const standing = createMovementState({
    worldX: 0,
    worldY: 0,
    facing: "right",
    segments: GROUND.segments,
  });
  const down = land(standing, ["down"], rope);
  assert.equal(down.mode, "climb");
  assert.equal(down.worldX, 0);
  assert.equal(down.worldY, rope.y1);
  assert.equal(down.velocityX, 0);
  assert.equal(down.velocityY, 0);
  assert.equal(down.layer, rope.page);
  assert.equal(down.platform, 0);

  const up = land(standing, ["up"], rope);
  assert.equal(up.mode, "climb");
  assert.equal(up.worldY, 0);
  assert.equal(up.layer, 4);
  assert.equal(up.platform, 0);

  const gapY = rope.y2 + 40;
  const gapGround = Object.freeze({
    segments: [Object.freeze({
      id: 2, layer: 1, platform: 2, x1: -30, x2: 30, y1: gapY, y2: gapY,
    })],
  });
  const gap = createMovementState({
    worldX: 0,
    worldY: gapY,
    facing: "right",
    segments: gapGround.segments,
  });
  assert.notEqual(land(gap, ["down"], rope, {}, gapGround).mode, "climb");
  assert.notEqual(land(gap, ["up"], rope, {}, gapGround).mode, "climb");

  const rising = Object.freeze({
    ...standing,
    worldY: -40,
    grounded: false,
    mode: "jump",
    contact: null,
    velocityY: -80,
    locomotion: "jump",
  });
  assert.notEqual(land(rising, ["up"], rope).mode, "climb");
  assert.notEqual(land(Object.freeze({ ...rising, velocityY: 40, mode: "fall" }), ["down"], rope).mode, "climb");

  const falling = Object.freeze({ ...rising, velocityY: 40, mode: "fall" });
  const caught = land(falling, ["up"], rope);
  assert.equal(caught.mode, "climb");
  assert.equal(caught.layer, rope.page);

  const dropping = Object.freeze({ ...falling, ignoredFootholdId: 1 });
  assert.notEqual(land(dropping, ["up"], rope).mode, "climb");

  const lip = ropeSegment({ y1: 2, y2: 100 });
  const onLip = land(standing, ["down"], lip);
  assert.equal(onLip.mode, "climb");
  assert.equal(onLip.worldY, lip.y1);
  assert.notEqual(land(standing, ["up"], lip).mode, "climb");
});

test("releasing the key stays on the rope, and the ends follow uf", () => {
  const closed = ropeSegment({ uf: 0 });
  const held = climbState(closed, 0);
  const released = stepClimbMovement(held, movementIntentFromHeld([]), { segments: [closed] }, GROUND, {});
  assert.equal(released.mode, "climb");
  assert.equal(released.worldY, 0);
  assert.equal(released.locomotion, "climb");

  const atTop = stepClimbMovement(
    climbState(closed, closed.y1),
    movementIntentFromHeld(["up"]),
    { segments: [closed] },
    GROUND,
    {},
  );
  assert.equal(atTop.mode, "climb");
  assert.equal(atTop.worldY, closed.y1);

  const open = ropeSegment({ uf: 1 });
  const leftTop = stepClimbMovement(
    climbState(open, open.y1),
    movementIntentFromHeld(["up"]),
    { segments: [open] },
    GROUND,
    {},
  );
  assert.equal(leftTop.mode, "fall");
  assert.equal(leftTop.worldY, open.y1 - 5);
  assert.equal(leftTop.ropeContact, null);
  assert.equal(leftTop.velocityY, 0);

  const leftBottom = stepClimbMovement(
    climbState(closed, closed.y2),
    movementIntentFromHeld(["down"]),
    { segments: [closed] },
    GROUND,
    {},
  );
  assert.equal(leftBottom.mode, "fall");
  assert.equal(leftBottom.worldY, closed.y2 + 1);
  assert.equal(leftBottom.grounded, false);
  assert.equal(leftBottom.velocityX, 0);
  assert.equal(leftBottom.velocityY, 0);
});

test("jump leaves a rope only with a horizontal direction", () => {
  const rope = ropeSegment();
  const state = climbState(rope, 20);
  const config = SHAFT.movementConfig;
  const stayed = stepClimbMovement(
    state,
    movementIntentFromHeld(["jump"]),
    { segments: [rope] },
    GROUND,
    { jumpPressed: true, movementConfig: config },
  );
  assert.equal(stayed.mode, "climb");
  assert.equal(stayed.worldY, 20);

  const left = stepClimbMovement(
    state,
    movementIntentFromHeld(["jump", "left"]),
    { segments: [rope] },
    GROUND,
    { jumpPressed: true, movementConfig: config },
  );
  assert.equal(left.mode, "jump");
  assert.equal(left.ropeContact, null);
  assert.ok(left.velocityX < 0);
  assert.ok(left.velocityY < 0);
  assert.ok(left.worldX < rope.x);
  assert.equal(left.layer, rope.page);
  assert.equal(left.platform, 0);
});

test("authenticated shaft rope replay: jump on, climb, hold, reach the out00 band", () => {
  const rope = SHAFT.ropeCollisionPlan.segments[0];
  const foothold = SHAFT.footholdCollisionPlan;
  const movementConfig = SHAFT.movementConfig;

  const play = () => {
    let movement = createMovementState({
      worldX: rope.x,
      worldY: 514,
      facing: "right",
      segments: foothold.segments,
    });
    const missed = stepLandMovementWithRope(
      movement,
      movementIntentFromHeld(["down"]),
      foothold,
      SHAFT.ropeCollisionPlan,
      movementConfig,
      {},
      stepMovement,
    );
    assert.notEqual(missed.mode, "climb");
    let jumped = false;
    for (let index = 0; index < 80 && movement.mode !== "climb"; index += 1) {
      movement = stepLandMovementWithRope(
        movement,
        movementIntentFromHeld(["up", "jump"]),
        foothold,
        SHAFT.ropeCollisionPlan,
        movementConfig,
        { jumpPressed: !jumped, jumpHeld: true },
        stepMovement,
      );
      jumped = true;
    }
    assert.equal(movement.mode, "climb");
    assert.equal(movement.worldX, rope.x);
    assert.equal(movement.layer, rope.page);
    assert.equal(movement.platform, 0);
    assert.ok(movement.worldY <= rope.y2);
    assert.ok(movement.worldY >= rope.y1);
    const frozen = stepClimbMovement(
      movement,
      movementIntentFromHeld([]),
      SHAFT.ropeCollisionPlan,
      foothold,
      {},
    );
    assert.equal(frozen.mode, "climb");
    assert.equal(frozen.worldY, movement.worldY);
    movement = frozen;
    const snapshots = [];
    const climbIntent = movementIntentFromHeld(["up"]);
    for (let index = 0; index < 400 && movement.worldY > -460; index += 1) {
      movement = stepClimbMovement(movement, climbIntent, SHAFT.ropeCollisionPlan, foothold, {});
      snapshots.push(canonicalFieldState({
        player: { worldX: movement.worldX, worldY: movement.worldY, locomotion: movement.locomotion },
        tickIndex: movement.tickIndex,
      }));
    }
    assert.ok(movement.worldY <= -460, `climbed to ${movement.worldY}`);
    assert.equal(movement.locomotion, "climb");
    assert.equal(movement.mode, "climb");
    return { movement, snapshots };
  };

  const first = play();
  const second = play();
  assert.deepEqual(second.snapshots, first.snapshots);
  assert.equal(new Set(first.snapshots).size, first.snapshots.length, "climb replay must be deterministic");
  assert.match(hashFieldState({ player: first.movement }), /^sha256:/u);
  assert.equal(CLIMB_DELTA_PER_TICK, 3);
});

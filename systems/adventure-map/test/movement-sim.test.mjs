import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { avatarSortKey, objSortKey } from "../../../components/ms-map-adapter/src/depth.mjs";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import { buildFootholdCollisionPlan } from "../foothold-collision-plan-build.mjs";
import { buildArrivalMovementState } from "../portal-arrival.mjs";
import {
  BUSINESS_TICK_MS,
  createMovementState,
  findLandingSegment,
  stepMovement,
  applyMovementToFieldState,
  UNCONTACTED_LAYER,
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

function replayWalkTicks(footholdCollisionPlan, bounds) {
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
  fieldState = applyCameraToFieldState(fieldState, { width: 800, height: 600 }, bounds).fieldState;
  const hashes = [];
  for (const intent of intents) {
    for (let tick = 0; tick < 5; tick += 1) {
      movement = stepMovement(movement, intent, footholdCollisionPlan, movementConfig, {});
      fieldState = applyMovementToFieldState(fieldState, movement);
      fieldState = applyCameraToFieldState(fieldState, { width: 800, height: 600 }, bounds).fieldState;
      hashes.push(stateHash(fieldState));
    }
  }
  return { hashes, movement, fieldState };
}

test("replay hash is stable for walk+release on real foothold plan", async () => {
  const map = await buildMapProjection({ mapId: "222000000", gameRoot: repoRoot });
  const footholdCollisionPlan = buildFootholdCollisionPlan(map.scene.footholds);
  const first = replayWalkTicks(footholdCollisionPlan, map.scene.bounds);
  const second = replayWalkTicks(footholdCollisionPlan, map.scene.bounds);
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

test("the first ground step accelerates instead of teleporting at walk speed", () => {
  const segment = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 40, y2: 0 };
  const plan = { segments: [segment] };
  const movement = createMovementState({ worldX: 1.5, worldY: 0, segments: plan.segments });
  const next = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
  assert.equal(next.grounded, true);
  assert.ok(next.worldX > 1.5);
  assert.ok(next.worldX < 1.5 + 2.5, "one tick is less than a full walkSpeed step");
  assert.ok(next.velocityX > 0 && next.velocityX < movementConfig.walkSpeed);
});

test("a failed drop does not become a jump", () => {
  const segment = { layer: 0, platform: 0, id: 1, x1: -20, y1: 0, x2: 20, y2: 0 };
  const plan = { segments: [segment] };
  const movement = createMovementState({ worldX: 0, worldY: 0, segments: plan.segments });
  const next = stepMovement(
    movement,
    movementIntentFromHeld(["down", "south"]),
    plan,
    movementConfig,
    { dropPressed: true, jumpHeld: true },
  );
  assert.equal(next.grounded, true);
  assert.equal(next.locomotion, "prone");
  assert.ok(next.velocityY >= 0);
});

test("down plus a direction walks instead of going prone", () => {
  const segment = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 40, y2: 0 };
  const plan = { segments: [segment] };
  const movement = createMovementState({ worldX: 10, worldY: 0, segments: plan.segments });
  const next = stepMovement(movement, movementIntentFromHeld(["down", "right"]), plan, movementConfig);
  assert.equal(next.locomotion, "walk");
  assert.ok(next.worldX > 10);
});

test("holding down without a direction goes prone and stays on the foothold", () => {
  const segment = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 40, y2: 0 };
  const plan = { segments: [segment] };
  const movement = createMovementState({ worldX: 10, worldY: 0, segments: plan.segments });
  const next = stepMovement(movement, movementIntentFromHeld(["down"]), plan, movementConfig);
  assert.equal(next.locomotion, "prone");
  assert.equal(next.grounded, true);
  assert.equal(next.worldX, 10);
  assert.equal(next.velocityX, 0);
});

test("down plus jump falls through the current foothold onto the one below", () => {
  const upper = { layer: 0, platform: 0, id: 1, x1: -20, y1: 0, x2: 20, y2: 0 };
  const lower = { layer: 0, platform: 1, id: 2, x1: -20, y1: 80, x2: 20, y2: 80 };
  const plan = { segments: [upper, lower] };
  let movement = createMovementState({ worldX: 0, worldY: 0, segments: plan.segments });
  movement = stepMovement(movement, movementIntentFromHeld(["down", "south"]), plan, movementConfig, { dropPressed: true });
  assert.equal(movement.grounded, false);
  assert.equal(movement.ignoredFootholdId, 1);
  let landedId = null;
  for (let tick = 0; tick < 40 && landedId === null; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["down"]), plan, movementConfig);
    if (movement.grounded) landedId = movement.contact.footholdId;
  }
  assert.equal(landedId, 2);
});

test("air steering does not replace horizontal speed with walk speed", () => {
  const segment = { layer: 0, platform: 0, id: 1, x1: -200, y1: 200, x2: 200, y2: 200 };
  const plan = { segments: [segment] };
  const airborne = {
    ...createMovementState({ worldX: 0, worldY: 0, segments: [] }),
    worldY: 0,
    velocityX: -125,
    velocityY: -200,
    grounded: false,
    contact: null,
    mode: "jump",
    locomotion: "jump",
  };
  const next = stepMovement(airborne, movementIntentFromHeld(["right"]), plan, movementConfig);
  assert.ok(next.velocityX < 0, "opposite input has not reversed the jump");
  assert.ok(next.velocityX > -125, "the drag still steers");
});

test("holding jump jumps again on the next grounded tick", () => {
  const segment = { layer: 0, platform: 0, id: 1, x1: -50, y1: 0, x2: 50, y2: 0 };
  const plan = { segments: [segment] };
  const intent = movementIntentFromHeld(["south"]);
  let movement = stepMovement(
    createMovementState({ worldX: 0, worldY: 0, segments: plan.segments }),
    intent,
    plan,
    movementConfig,
    { jumpHeld: true, jumpPressed: true },
  );
  assert.equal(movement.grounded, false);
  for (let tick = 0; tick < 80 && !movement.grounded; tick += 1) {
    movement = stepMovement(movement, intent, plan, movementConfig, { jumpHeld: true });
  }
  assert.equal(movement.grounded, true);
  const again = stepMovement(movement, intent, plan, movementConfig, { jumpHeld: true });
  assert.equal(again.grounded, false);
  assert.ok(again.velocityY < 0);
});

test("opposite directions are neutral and preserve facing", () => {
  const intent = movementIntentFromHeld(["left", "right"]);
  assert.equal(intent.left, true);
  assert.equal(intent.right, true);
  assert.equal(intent.facing, null);
});

test("a rightward next foothold keeps the walk across a flat seam", () => {
  const left = { layer: 2, platform: 8, id: 163, x1: -135, y1: 243, x2: -45, y2: 243, prev: 0, next: 160 };
  const right = { layer: 2, platform: 8, id: 160, x1: -45, y1: 243, x2: 45, y2: 243, prev: 163, next: 0 };
  const plan = { segments: [left, right] };
  let movement = createMovementState({ worldX: -50, worldY: 243, segments: plan.segments });
  let crossed = false;
  for (let tick = 0; tick < 40; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
    assert.equal(movement.grounded, true);
    assert.equal(movement.locomotion, "walk");
    assert.equal(movement.worldY, 243);
    if (movement.worldX > -45) crossed = true;
  }
  assert.equal(crossed, true);
  assert.equal(movement.contact.footholdId, 160);
});

test("a foothold with no next still leaves the ground at the lip", () => {
  const segment = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 10, y2: 0, prev: 0, next: 0 };
  const plan = { segments: [segment] };
  let movement = createMovementState({ worldX: 8, worldY: 0, segments: plan.segments });
  for (let tick = 0; tick < 40 && movement.grounded; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
  }
  assert.equal(movement.grounded, false);
  assert.equal(movement.locomotion, "jump");
  assert.ok(movement.worldX >= 10);
});

test("a vertical next edge stops the body instead of playing a jump", () => {
  const floor = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 10, y2: 0, prev: 0, next: 2 };
  const wall = { layer: 0, platform: 0, id: 2, x1: 10, y1: 0, x2: 10, y2: -20, prev: 1, next: 0 };
  const plan = { segments: [floor, wall] };
  let movement = createMovementState({ worldX: 8, worldY: 0, segments: plan.segments });
  for (let tick = 0; tick < 40; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
  }
  assert.equal(movement.grounded, true);
  assert.equal(movement.locomotion, "walk");
  assert.equal(movement.contact.footholdId, 1);
  assert.ok(movement.worldX <= 10);
  assert.equal(movement.velocityX, 0);
});

test("an unlinked upward step face stops the coast and blocks the floor beyond it", () => {
  const floor = { layer: 3, platform: 0, id: 18, x1: 0, y1: 0, x2: 10, y2: 0, prev: 0, next: 0 };
  const wall = { layer: 3, platform: 0, id: 10, x1: 14, y1: 20, x2: 14, y2: -20, prev: 0, next: 0 };
  const beyond = { layer: 3, platform: 0, id: 99, x1: 16, y1: 40, x2: 80, y2: 40, prev: 0, next: 0 };
  const plan = { segments: [floor, wall, beyond] };
  let movement = createMovementState({ worldX: 8, worldY: 0, segments: plan.segments });
  let crossed = false;
  for (let tick = 0; tick < 80; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
    if (movement.worldX > 14) crossed = true;
  }
  assert.equal(crossed, false);
  assert.ok(movement.worldX <= 14);
  assert.notEqual(movement.contact?.footholdId, 99);
  assert.ok(movement.velocityX === 0);
});

test("a downward face at a lip still lets the body walk off", () => {
  const floor = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 80, y2: 0, prev: 0, next: 0 };
  const wall = { layer: 0, platform: 0, id: 2, x1: 80, y1: 0, x2: 80, y2: 40, prev: 1, next: 0 };
  const lower = { layer: 0, platform: 0, id: 3, x1: 80, y1: 120, x2: 240, y2: 120, prev: 0, next: 0 };
  const plan = { segments: [floor, wall, lower] };
  let movement = createMovementState({ worldX: 50, worldY: 0, segments: plan.segments });
  let passedFace = false;
  for (let tick = 0; tick < 80 && movement.contact?.footholdId !== 3; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
    if (movement.worldX > 80.5 && movement.worldY < 40) passedFace = true;
  }
  assert.equal(passedFace, true);
  assert.equal(movement.grounded, true);
  assert.equal(movement.contact.footholdId, 3);
});

test("a jump keeps the foothold layer instead of the uncontacted layer", () => {
  const segment = { layer: 3, platform: 4, id: 1, x1: -20, y1: 0, x2: 20, y2: 0 };
  const plan = { segments: [segment] };
  let movement = createMovementState({ worldX: 0, worldY: 0, segments: plan.segments });
  assert.equal(movement.layer, 3);
  assert.equal(movement.platform, 4);
  movement = stepMovement(
    movement,
    movementIntentFromHeld(["south"]),
    plan,
    movementConfig,
    { jumpHeld: true, jumpPressed: true },
  );
  assert.equal(movement.grounded, false);
  assert.equal(movement.layer, 3);
  assert.equal(movement.platform, 4);
});

test("the well arrival stays on the uncontacted layer until the shaft floor", async () => {
  const map = await buildMapProjection({ mapId: "222000001", gameRoot: repoRoot });
  const plan = buildFootholdCollisionPlan(map.scene.footholds);
  let movement = buildArrivalMovementState({ x: 22, y: -286 }, plan);
  assert.equal(movement.grounded, false);
  assert.equal(movement.worldX, 22);
  assert.equal(movement.worldY, -296);
  assert.equal(movement.layer, UNCONTACTED_LAYER);
  assert.equal(movement.platform, 0);
  assert.ok(avatarSortKey(movement.layer, movement.platform, 0) > objSortKey(4, 9));
  let sawAir = false;
  for (let tick = 0; tick < 400 && movement.grounded !== true; tick += 1) {
    sawAir = true;
    assert.equal(movement.layer, UNCONTACTED_LAYER);
    assert.equal(movement.platform, 0);
    movement = stepMovement(movement, movementIntentFromHeld([]), plan, movementConfig);
  }
  assert.equal(sawAir, true);
  assert.equal(movement.grounded, true);
  assert.equal(movement.layer, 3);
  assert.equal(movement.platform, 0);
  assert.ok(avatarSortKey(movement.layer, movement.platform, 0) > objSortKey(3, 9));
});

test("map 222000001 stops a walk from the unlinked ledge into either shaft wall", async () => {
  const map = await buildMapProjection({ mapId: "222000001", gameRoot: repoRoot });
  const plan = buildFootholdCollisionPlan(map.scene.footholds);
  let right = createMovementState({ worldX: 40, worldY: 514, segments: plan.segments });
  assert.equal(right.contact.footholdId, 18);
  for (let tick = 0; tick < 80; tick += 1) {
    right = stepMovement(right, movementIntentFromHeld(["right"]), plan, movementConfig);
    assert.ok(right.worldX <= 83, `tick ${tick} x ${right.worldX}`);
  }
  assert.equal(right.velocityX, 0);
  let left = createMovementState({ worldX: -40, worldY: 514, segments: plan.segments });
  for (let tick = 0; tick < 80; tick += 1) {
    left = stepMovement(left, movementIntentFromHeld(["left"]), plan, movementConfig);
    assert.ok(left.worldX >= -85, `tick ${tick} x ${left.worldX}`);
  }
  assert.equal(left.velocityX, 0);
});

test("the village flat chain keeps walk from the spawn seam through the one-pixel link", async () => {
  const map = await buildMapProjection({ mapId: "222000000", gameRoot: repoRoot });
  const plan = buildFootholdCollisionPlan(map.scene.footholds);
  assert.equal(plan.segments.find((segment) => segment.id === 163).next, 160);
  let movement = createMovementState({ worldX: -92, worldY: 294, segments: plan.segments });
  let saw160 = false;
  let saw168 = false;
  for (let tick = 0; tick < 120 && !saw168; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
    assert.equal(movement.grounded, true, `tick ${tick} x ${movement.worldX}`);
    assert.equal(movement.locomotion, "walk");
    if (movement.contact.footholdId === 160) saw160 = true;
    if (movement.contact.footholdId === 168) saw168 = true;
  }
  assert.equal(saw160, true);
  assert.equal(saw168, true);
});

test("a down jump hops upward and still falls through to the lower foothold", () => {
  const upper = { layer: 0, platform: 0, id: 1, x1: -20, y1: 0, x2: 20, y2: 0 };
  const lower = { layer: 0, platform: 1, id: 2, x1: -20, y1: 80, x2: 20, y2: 80 };
  const plan = { segments: [upper, lower] };
  let movement = createMovementState({ worldX: 0, worldY: 0, segments: plan.segments });
  movement = stepMovement(
    movement,
    movementIntentFromHeld(["down", "south"]),
    plan,
    movementConfig,
    { dropPressed: true },
  );
  assert.equal(movement.grounded, false);
  assert.ok(movement.worldY < 0);
  assert.ok(movement.velocityY < 0);
  assert.ok(movement.velocityY > -movementConfig.jumpSpeed);
  let landedId = null;
  for (let tick = 0; tick < 40 && landedId === null; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["down"]), plan, movementConfig);
    if (movement.grounded) landedId = movement.contact.footholdId;
  }
  assert.equal(landedId, 2);
});

test("forbidFallDown and the field limit keep a down jump on the foothold", () => {
  const upper = { layer: 0, platform: 0, id: 1, x1: -20, y1: 0, x2: 20, y2: 0, forbidFallDown: true };
  const lower = { layer: 0, platform: 1, id: 2, x1: -20, y1: 80, x2: 20, y2: 80 };
  const plan = { segments: [upper, lower] };
  const blocked = stepMovement(
    createMovementState({ worldX: 0, worldY: 0, segments: plan.segments }),
    movementIntentFromHeld(["down", "south"]),
    plan,
    movementConfig,
    { dropPressed: true },
  );
  assert.equal(blocked.grounded, true);
  assert.equal(blocked.locomotion, "prone");

  const open = { ...upper, forbidFallDown: false };
  const limited = stepMovement(
    createMovementState({ worldX: 0, worldY: 0, segments: [open, lower] }),
    movementIntentFromHeld(["down", "south"]),
    { segments: [open, lower] },
    movementConfig,
    { dropPressed: true, fieldLimit: 0x20000 },
  );
  assert.equal(limited.grounded, true);
  assert.equal(limited.locomotion, "prone");
});

test("landing while holding the same direction keeps part of the airborne speed", () => {
  const floor = { layer: 0, platform: 0, id: 1, x1: -200, y1: 240, x2: 200, y2: 240 };
  const plan = { segments: [floor] };
  let movement = createMovementState({ worldX: 0, worldY: 240, segments: plan.segments });
  const right = movementIntentFromHeld(["right"]);
  for (let tick = 0; tick < 20; tick += 1) {
    movement = stepMovement(movement, right, plan, movementConfig);
  }
  movement = stepMovement(movement, right, plan, movementConfig, { jumpPressed: true });
  assert.equal(movement.grounded, false);
  let previous = movement;
  let landed = null;
  for (let tick = 0; tick < 80 && landed === null; tick += 1) {
    const next = stepMovement(previous, right, plan, movementConfig);
    if (next.grounded) landed = { previous, next };
    else previous = next;
  }
  assert.ok(landed);
  assert.ok(landed.next.velocityX > 0);
  assert.ok(landed.next.velocityX < landed.previous.velocityX);

  previous = movement;
  landed = null;
  const left = movementIntentFromHeld(["left"]);
  for (let tick = 0; tick < 80 && landed === null; tick += 1) {
    const next = stepMovement(previous, left, plan, movementConfig);
    if (next.grounded) landed = next;
    else previous = next;
  }
  assert.ok(landed);
  assert.ok(landed.velocityX <= 0);
});

test("a still body sits on the nearest seat and any direction leaves it", () => {
  const floor = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 80, y2: 0 };
  const plan = { segments: [floor] };
  const standing = createMovementState({ worldX: 20, worldY: 0, segments: plan.segments });
  const seats = [{ index: 4, x: 20, y: 0 }];
  const sat = stepMovement(standing, movementIntentFromHeld([]), plan, movementConfig, {
    sitPressed: true,
    seats,
  });
  assert.equal(sat.mode, "sit");
  assert.equal(sat.locomotion, "sit");
  assert.equal(sat.seat.id, 4);
  assert.equal(sat.worldX, 20);
  assert.equal(sat.worldY, 0);
  const held = stepMovement(sat, movementIntentFromHeld([]), plan, movementConfig, { seats });
  assert.equal(held.mode, "sit");
  assert.equal(held.worldX, 20);
  assert.equal(held.worldY, 0);
  const left = stepMovement(sat, movementIntentFromHeld(["left"]), plan, movementConfig, { seats });
  assert.equal(left.seat, null);
  assert.equal(left.grounded, false);
  const jumped = stepMovement(sat, movementIntentFromHeld(["south"]), plan, movementConfig, { seats });
  assert.equal(jumped.seat, null);
  assert.ok(jumped.velocityY > 0);
  const missed = stepMovement(standing, movementIntentFromHeld([]), plan, movementConfig, {
    sitPressed: true,
    seats: [{ index: 4, x: 40, y: 0 }],
  });
  assert.equal(missed.mode, "stand");
  assert.equal(missed.seat, null);
});

test("a long terminal fall records a landing and a short one does not", () => {
  const far = { layer: 0, platform: 0, id: 1, x1: -20, y1: 2000, x2: 20, y2: 2000 };
  const farPlan = { segments: [far] };
  let falling = {
    ...createMovementState({ worldX: 0, worldY: 0, segments: farPlan.segments }),
    velocityY: movementConfig.fallSpeed,
    grounded: false,
    contact: null,
    mode: "fall",
  };
  let landing = null;
  for (let tick = 0; tick < 220 && landing === null; tick += 1) {
    falling = stepMovement(falling, movementIntentFromHeld([]), farPlan, movementConfig);
    if (falling.fallLanding) landing = falling;
  }
  assert.ok(landing);
  assert.ok(landing.fallLanding.amount >= 1);
  assert.equal(landing.fallLanding.facing, landing.facing);
  assert.equal(landing.fallTerminalTicks, 0);
  const after = stepMovement(landing, movementIntentFromHeld([]), farPlan, movementConfig);
  assert.equal(after.fallLanding, null);

  const near = { layer: 0, platform: 0, id: 1, x1: -20, y1: 40, x2: 20, y2: 40 };
  const nearPlan = { segments: [near] };
  let shortFall = {
    ...createMovementState({ worldX: 0, worldY: 0, segments: nearPlan.segments }),
    velocityY: movementConfig.fallSpeed,
    grounded: false,
    contact: null,
    mode: "fall",
  };
  let shortLanding = null;
  for (let tick = 0; tick < 20; tick += 1) {
    shortFall = stepMovement(shortFall, movementIntentFromHeld([]), nearPlan, movementConfig);
    if (shortFall.fallLanding) shortLanding = shortFall.fallLanding;
  }
  assert.equal(shortFall.grounded, true);
  assert.equal(shortLanding, null);
});

test("the physical sides stop a walk and a low friction foothold coasts farther", () => {
  const wide = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 400, y2: 0 };
  const plan = { segments: [wide] };
  let movement = createMovementState({ worldX: 360, worldY: 0, segments: plan.segments });
  for (let tick = 0; tick < 40; tick += 1) {
    movement = stepMovement(movement, movementIntentFromHeld(["right"]), plan, movementConfig);
    assert.ok(movement.worldX <= 370);
    assert.equal(movement.grounded, true);
  }
  assert.equal(movement.worldX, 370);
  assert.ok(movement.velocityX === 0);

  const slippery = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 800, y2: 0, friction: 0.2 };
  const sticky = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 800, y2: 0, friction: 1 };
  let loose = createMovementState({ worldX: 100, worldY: 0, segments: [slippery] });
  let firm = createMovementState({ worldX: 100, worldY: 0, segments: [sticky] });
  for (let tick = 0; tick < 30; tick += 1) {
    loose = stepMovement(loose, movementIntentFromHeld(["right"]), { segments: [slippery] }, movementConfig);
    firm = stepMovement(firm, movementIntentFromHeld(["right"]), { segments: [sticky] }, movementConfig);
  }
  for (let tick = 0; tick < 8; tick += 1) {
    loose = stepMovement(loose, movementIntentFromHeld([]), { segments: [slippery] }, movementConfig);
    firm = stepMovement(firm, movementIntentFromHeld([]), { segments: [sticky] }, movementConfig);
  }
  assert.ok(loose.velocityX > firm.velocityX);

  const belt = { layer: 0, platform: 0, id: 1, x1: 0, y1: 0, x2: 200, y2: 0, conveyor: 1 };
  const carried = stepMovement(
    createMovementState({ worldX: 40, worldY: 0, segments: [belt] }),
    movementIntentFromHeld([]),
    { segments: [belt] },
    movementConfig,
  );
  assert.ok(carried.velocityX > 0);
  assert.equal(carried.grounded, true);
});

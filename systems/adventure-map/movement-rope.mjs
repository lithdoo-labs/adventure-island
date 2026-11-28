/**
 * Rope and ladder climb.
 *
 * Y-down. Down is +1 and looks at [feet, feet+10]; Up is -1 and looks at
 * [feet-20, feet]. Grabbing uses an overlap test, so the probe may stick out
 * of the rope. The horizontal tolerance is 10px once. Down snaps to the top.
 * Up keeps the current height, limited to the rope bottom.
 * Ground accepts either key. Air accepts only Up while falling, and never
 * while a drop-through foothold is still ignored.
 * Attaching installs (page, 0). Releasing the key stays on the rope and the
 * avatar holds its frame. A rope with uf set lets go 5px above the top;
 * uf 0 clamps to the top and stays. Past the bottom the body is handed to
 * gravity at bottom+1. Jump leaves only with a horizontal key:
 * vx = direction * walkSpeed * 1.3, vy = -jumpSpeed * 0.3, then one air step.
 */
import { BUSINESS_TICK_MS } from "./movement-sim.mjs";
import { stepAirVelocity } from "./movement-dynamics.mjs";
import { queryRopeSegments } from "./rope-collision-plan.mjs";

/** CMS079 C-056 byte-read constant at 0xB00D68. */
export const CLIMB_DELTA_PER_TICK = 3;

const GRAB_UP_REACH_PX = 20;
const GRAB_DOWN_REACH_PX = 10;
const CLIMB_JUMP_SPEED_SCALE = 0.3;
const CLIMB_JUMP_WALK_SCALE = 1.3;

function q(value) {
  return Math.round(value * 1000) / 1000;
}

export function verticalAxisFromIntent(intent) {
  const up = Boolean(intent.up);
  const down = Boolean(intent.down);
  if (up && down) return 0;
  if (up) return -1;
  if (down) return 1;
  return 0;
}

function ropeContactFromSegment(segment) {
  return Object.freeze({
    stableId: segment.stableId,
    ropeId: segment.id,
    x: segment.x,
    y1: segment.y1,
    y2: segment.y2,
    l: segment.l,
    uf: segment.uf,
    page: segment.page,
  });
}

function climbLayer(state, rope) {
  return Number.isInteger(rope?.page) ? rope.page : state.layer;
}

function horizontalDirection(intent) {
  if (intent.left && !intent.right) return -1;
  if (intent.right && !intent.left) return 1;
  return 0;
}

function canGrab(state, verticalKey) {
  if (verticalKey === 0 || state.mode === "climb") return false;
  if (state.ignoredFootholdId != null) return false;
  if (state.grounded) return true;
  return verticalKey < 0 && state.velocityY > 0;
}

function attachRope(state, segment, worldY) {
  return Object.freeze({
    ...state,
    worldX: q(segment.x),
    worldY: q(worldY),
    velocityX: 0,
    velocityY: 0,
    mode: "climb",
    grounded: false,
    contact: null,
    locomotion: "climb",
    layer: segment.page,
    platform: 0,
    ropeContact: ropeContactFromSegment(segment),
    ignoredFootholdId: null,
  });
}

function grabDown(state, segments) {
  const feet = state.worldY;
  const hit = queryRopeSegments(
    segments,
    state.worldX,
    state.worldX,
    feet,
    feet + GRAB_DOWN_REACH_PX,
    { overlap: true },
  );
  if (!hit || hit.y1 > feet + GRAB_DOWN_REACH_PX) return null;
  return attachRope(state, hit, hit.y1);
}

function grabUp(state, segments) {
  const feet = state.worldY;
  const hit = queryRopeSegments(
    segments,
    state.worldX,
    state.worldX,
    feet - GRAB_UP_REACH_PX,
    feet,
    { overlap: true },
  );
  if (!hit) return null;
  return attachRope(state, hit, Math.min(feet, hit.y2));
}

function advance(state, patch) {
  return Object.freeze({
    ...state,
    ...patch,
    tickIndex: state.tickIndex + 1,
    simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
  });
}

function leaveClimb(state, rope, facing, worldX, worldY, velocityX, velocityY) {
  return advance(state, {
    worldX: q(worldX),
    worldY: q(worldY),
    velocityX: q(velocityX),
    velocityY: q(velocityY),
    facing,
    mode: velocityY < 0 ? "jump" : "fall",
    grounded: false,
    contact: null,
    ropeContact: null,
    locomotion: "jump",
    layer: climbLayer(state, rope),
    platform: 0,
    ignoredFootholdId: null,
  });
}

/**
 * @param {object} state climb movement state
 * @param {object} intent
 * @param {object} ropeCollisionPlan
 * @param {object} footholdCollisionPlan
 * @param {{ jumpPressed?: boolean, movementConfig?: object }} [edges]
 */
export function stepClimbMovement(state, intent, ropeCollisionPlan, footholdCollisionPlan, edges = {}) {
  void ropeCollisionPlan;
  void footholdCollisionPlan;
  const rope = state.ropeContact;
  if (!rope) throw new TypeError("climb state requires ropeContact");
  const verticalKey = verticalAxisFromIntent(intent);
  let facing = state.facing;
  if (intent.facing === "left" || intent.facing === "right") facing = intent.facing;
  const layer = climbLayer(state, rope);

  if (edges.jumpPressed) {
    const direction = horizontalDirection(intent);
    const config = edges.movementConfig;
    if (direction !== 0 && config && Number.isFinite(config.walkSpeed) && Number.isFinite(config.jumpSpeed)) {
      const velocityX = direction * config.walkSpeed * CLIMB_JUMP_WALK_SCALE;
      const velocityY = -config.jumpSpeed * CLIMB_JUMP_SPEED_SCALE;
      const dt = BUSINESS_TICK_MS / 1000;
      const air = stepAirVelocity(velocityX, velocityY, direction, config, dt);
      const worldX = state.worldX + ((velocityX + air.velocityX) * dt * 0.5);
      const worldY = state.worldY + ((velocityY + air.velocityY) * dt * 0.5);
      return leaveClimb(state, rope, facing, worldX, worldY, air.velocityX, air.velocityY);
    }
  }

  let worldY = state.worldY;
  if (verticalKey !== 0) {
    worldY = q(worldY + (CLIMB_DELTA_PER_TICK * verticalKey));
    if (verticalKey > 0 && worldY > rope.y2) {
      return leaveClimb(state, rope, facing, rope.x, rope.y2 + 1, 0, 0);
    }
    if (verticalKey < 0 && worldY < rope.y1) {
      if (rope.uf) return leaveClimb(state, rope, facing, rope.x, rope.y1 - 5, 0, 0);
      worldY = q(rope.y1);
    }
  }

  return advance(state, {
    worldX: q(rope.x),
    worldY,
    velocityX: 0,
    velocityY: 0,
    facing,
    mode: "climb",
    grounded: false,
    contact: null,
    ropeContact: rope,
    locomotion: "climb",
    layer,
    platform: 0,
  });
}

/**
 * Land or air step, then a rope grab. Grabbing uses the position after the step.
 * @param {object} state
 * @param {object} intent
 * @param {object} footholdCollisionPlan
 * @param {object} ropeCollisionPlan
 * @param {object} movementConfig
 * @param {object} edges
 * @param {Function} stepMovementFn
 */
export function stepLandMovementWithRope(
  state,
  intent,
  footholdCollisionPlan,
  ropeCollisionPlan,
  movementConfig,
  edges,
  stepMovementFn,
) {
  const next = stepMovementFn(state, intent, footholdCollisionPlan, movementConfig, edges);
  const segments = ropeCollisionPlan?.segments ?? [];
  const verticalKey = verticalAxisFromIntent(intent);
  if (segments.length === 0 || !canGrab(next, verticalKey)) return next;
  const grabbed = verticalKey > 0
    ? grabDown(next, segments)
    : grabUp(next, segments);
  return grabbed ?? next;
}

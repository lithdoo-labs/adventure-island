/**
 * Deterministic whole-map swim movement.
 *
 * OPENMS-REFERENCE (reimplemented, not copied): buoyant velocity on a swim map.
 * These maps have no fs, so the drag scale is 1 and the brake step is
 * floatDrag1 / 100 per second. swimSpeedDec is not the water drag; it stays on
 * the config as the FSDB ground-speed scale and is not applied here.
 * - No vertical key: vy is pushed toward +swimSpeed by swimForce / 100.
 * - Up: approach -0.3 * swimSpeed. Down: approach +1.5 * swimSpeed.
 *   Above the target the step is swimForce / 100; below it, half of that.
 *   The ±swimSpeed brake runs first, so a down-held speed above the cap is
 *   pulled back on the next tick and does not stay at 1.5 * swimSpeed.
 * - Horizontal: brake outside ±swimSpeed, accelerate with the key while held,
 *   and drag toward 0 when released.
 * - A jump writes vy = -(swimSpeed * 5), then this same tick integrates.
 *   Holding jump repeats that impulse every 300 ms.
 * - Position uses the average of the pre- and post-integration velocities.
 * - Avatar projection maps locomotion swim → fly (Subsystem only).
 */
import { BUSINESS_TICK_MS, BUSINESS_TICK_S } from "./movement-sim.mjs";

export const WATER_JUMP_SPEED_MULTIPLIER = 5;
export const WATER_JUMP_REPEAT_MS = 300;

function q(value) {
  return Math.round(value * 1000) / 1000;
}

function horizontalDirection(intent) {
  const left = intent.left ? 1 : 0;
  const right = intent.right ? 1 : 0;
  return right - left;
}

function verticalDirection(intent) {
  const up = intent.up ? 1 : 0;
  const down = intent.down ? 1 : 0;
  return down - up;
}

function recoverPastLimit(speed, limit, step) {
  if (speed > limit) return Math.max(limit, speed - step);
  if (speed < -limit) return Math.min(-limit, speed + step);
  return speed;
}

function moveToward(speed, target, step) {
  if (speed > target) return Math.max(target, speed - step);
  return Math.min(target, speed + step);
}

function accelerateTowardLimit(speed, acceleration, limit, dt) {
  if (limit < 0) return speed;
  const delta = acceleration * dt;
  if (acceleration > 0 && speed < limit) return Math.min(limit, speed + delta);
  if (acceleration <= 0 && speed > -limit) return Math.max(-limit, speed + delta);
  return speed;
}

function integrateSwim(velocityX, velocityY, horizontal, vertical, config, dt) {
  const limit = config.swimSpeed;
  const force = config.swimForce / 100;
  const brake = (config.floatDrag1 / 100) * dt;
  let vx = recoverPastLimit(velocityX, limit, brake);
  if (horizontal === 0) vx = moveToward(vx, 0, brake);
  else vx = accelerateTowardLimit(vx, horizontal * force, limit, dt);

  let vy = recoverPastLimit(velocityY, limit, brake);
  if (vertical === 0) {
    vy = accelerateTowardLimit(vy, force, limit, dt);
    return { velocityX: vx, velocityY: vy };
  }
  const target = vertical < 0 ? -limit * 0.3 : limit * 1.5;
  const rate = force * (vy < target ? 0.5 : 1);
  vy = moveToward(vy, target, rate * dt);
  return { velocityX: vx, velocityY: vy };
}

function nextFacing(current, intent) {
  if (intent.facing === "left" || intent.facing === "right") return intent.facing;
  return current;
}

/**
 * @param {object} [params]
 */
export function createWaterMovementState({
  worldX,
  worldY,
  facing = "right",
  layer = 0,
  platform = 0,
} = {}) {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    throw new TypeError("worldX and worldY are required");
  }
  return Object.freeze({
    medium: "water",
    worldX: q(worldX),
    worldY: q(worldY),
    velocityX: 0,
    velocityY: 0,
    facing,
    mode: "swim",
    grounded: false,
    contact: null,
    tickIndex: 0,
    simulationTimeMs: 0,
    layer,
    platform,
    locomotion: "swim",
    ropeContact: null,
    jumpRepeatMs: 0,
  });
}

/**
 * @param {object} state prior movement state
 * @param {object} intent
 * @param {object} movementConfig validated FSDB physics constants
 * @param {{ jumpPressed?: boolean }} [edges]
 */
export function stepWaterMovement(state, intent, movementConfig, edges = {}) {
  const swimSpeed = movementConfig.swimSpeed;
  const swimForce = movementConfig.swimForce;
  const floatDrag1 = movementConfig.floatDrag1;
  for (const value of [swimSpeed, swimForce, floatDrag1]) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError("movementConfig swim fields are invalid");
  }
  const dt = BUSINESS_TICK_S;
  const facing = nextFacing(state.facing, intent);
  let velocityX = state.velocityX;
  let velocityY = state.velocityY;
  let jumpRepeatMs = Number.isFinite(state.jumpRepeatMs) ? state.jumpRepeatMs : 0;
  jumpRepeatMs = Math.max(0, jumpRepeatMs - BUSINESS_TICK_MS);
  if (!intent.jump) jumpRepeatMs = 0;
  const pressed = Boolean(edges.jumpPressed);
  if (pressed || intent.jump) {
    if (pressed || jumpRepeatMs <= 0) {
      velocityY = -swimSpeed * WATER_JUMP_SPEED_MULTIPLIER;
      jumpRepeatMs = WATER_JUMP_REPEAT_MS;
    }
  }
  const previousX = velocityX;
  const previousY = velocityY;
  const integrated = integrateSwim(
    velocityX,
    velocityY,
    horizontalDirection(intent),
    verticalDirection(intent),
    { swimSpeed, swimForce, floatDrag1 },
    dt,
  );
  velocityX = integrated.velocityX;
  velocityY = integrated.velocityY;

  return Object.freeze({
    medium: "water",
    worldX: q(state.worldX + (previousX + velocityX) * dt * 0.5),
    worldY: q(state.worldY + (previousY + velocityY) * dt * 0.5),
    velocityX: q(velocityX),
    velocityY: q(velocityY),
    facing,
    mode: "swim",
    grounded: false,
    contact: null,
    tickIndex: state.tickIndex + 1,
    simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
    layer: state.layer,
    platform: state.platform,
    locomotion: "swim",
    ropeContact: null,
    jumpRepeatMs,
  });
}

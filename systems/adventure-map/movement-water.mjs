/**
 * Deterministic bounded water movement on swim maps (M7.1 minimal slice).
 *
 * PRODUCT-DECISION / OPENMS-REFERENCE (bounded):
 * - Whole-map swim when mapEnvironment.swim === 1 (FSDB info.swim).
 * - Horizontal cruise at swimSpeed; release applies swimSpeedDec per tick.
 * - Vertical velocity settles toward zero using swimSpeedDec when no jump edge
 *   is present. The full CMS079 force equation is not yet evidenced; swimForce
 *   remains an identity-checked input and is deliberately not reinterpreted.
 * - Jump edge sets vy = -(swimSpeed * 5) (P3-09 default-state sub-formula).
 * - Avatar projection maps locomotion swim → fly (Subsystem only).
 */
import { BUSINESS_TICK_MS, BUSINESS_TICK_S } from "./movement-sim.mjs";

export const WATER_JUMP_SPEED_MULTIPLIER = 5;

function q(value) {
  return Math.round(value * 1000) / 1000;
}

function horizontalDirection(intent) {
  if (intent.left && !intent.right) return -1;
  if (intent.right && !intent.left) return 1;
  return 0;
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
  const swimSpeedDec = movementConfig.swimSpeedDec;
  for (const value of [swimSpeed, swimForce, swimSpeedDec]) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError("movementConfig swim fields are invalid");
  }
  if (swimSpeedDec > 1) throw new TypeError("movementConfig.swimSpeedDec must be <= 1");
  const dt = BUSINESS_TICK_S;
  let worldX = state.worldX;
  let worldY = state.worldY;
  let velocityX = state.velocityX;
  let velocityY = state.velocityY;
  const facing = nextFacing(state.facing, intent);
  const dir = horizontalDirection(intent);

  if (edges.jumpPressed) {
    velocityY = -swimSpeed * WATER_JUMP_SPEED_MULTIPLIER;
  } else {
    velocityY = q(velocityY * swimSpeedDec);
    if (Math.abs(velocityY) < 0.01) velocityY = 0;
  }

  if (dir !== 0) {
    velocityX = dir * swimSpeed;
  } else {
    velocityX = q(velocityX * swimSpeedDec);
    if (Math.abs(velocityX) < 0.01) velocityX = 0;
  }

  worldX = q(worldX + velocityX * dt);
  worldY = q(worldY + velocityY * dt);

  return Object.freeze({
    medium: "water",
    worldX,
    worldY,
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
  });
}

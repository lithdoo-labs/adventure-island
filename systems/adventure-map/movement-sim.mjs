/**
 * Pure deterministic ground/air Movement on Foothold segments (M5 minimal loop).
 *
 * EXPERIMENTAL-MODEL (not CMS079-trapezoid): constant walk speed and gravity.
 * Maple-style Y-down world coordinates; vy < 0 is upward.
 */
import { footholdYAtX } from "./foothold-collision-plan.mjs";

export const BUSINESS_TICK_MS = 20;
export const BUSINESS_TICK_S = BUSINESS_TICK_MS / 1000;

export const GROUND_EPSILON_PX = 4;

function q(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * @param {object} segment
 * @param {number} x
 */
function segmentHorizontalSpan(segment, x) {
  const y = footholdYAtX(segment, x);
  if (y === null) return null;
  return { y: q(y), minX: Math.min(segment.x1, segment.x2), maxX: Math.max(segment.x1, segment.x2) };
}

/**
 * @param {number} x
 * @param {number} feetY
 * @param {object[]} segments
 */
function pickSupportHit(hit, segment) {
  return {
    segment,
    surfaceY: hit.y,
    minX: hit.minX,
    maxX: hit.maxX,
    layer: segment.layer,
    platform: segment.platform,
    footholdId: segment.id,
  };
}

/**
 * Ground support at x: foothold surface at or above the feet (Y-down: smaller y is higher).
 * @param {number} x
 * @param {number} feetY
 * @param {object[]} segments
 * @param {{ layer: number, platform: number, footholdId: number } | null} [preferredContact]
 */
export function findSupportSegment(x, feetY, segments, preferredContact = null) {
  let best = null;
  for (const segment of segments) {
    const hit = segmentHorizontalSpan(segment, x);
    if (!hit) continue;
    const surfaceY = hit.y;
    if (Math.abs(surfaceY - feetY) > GROUND_EPSILON_PX) continue;
    const candidate = pickSupportHit(hit, segment);
    const preferred = preferredContact !== null
      && segment.layer === preferredContact.layer
      && segment.platform === preferredContact.platform
      && segment.id === preferredContact.footholdId;
    if (preferred) return candidate;
    if (best === null
      || Math.abs(surfaceY - feetY) < Math.abs(best.surfaceY - feetY)
      || (Math.abs(surfaceY - feetY) === Math.abs(best.surfaceY - feetY)
        && surfaceY > best.surfaceY)) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Nearest authored surface at or above an initial feet position. This is only
 * used to reconcile an authored spawn with a ground contact.
 * @param {number} x
 * @param {number} feetY
 * @param {object[]} segments
 */
export function findSpawnSupportSegment(x, feetY, segments) {
  let best = null;
  for (const segment of segments) {
    const hit = segmentHorizontalSpan(segment, x);
    if (!hit) continue;
    const surfaceY = hit.y;
    if (surfaceY > feetY + GROUND_EPSILON_PX) continue;
    if (best === null || surfaceY > best.surfaceY) best = pickSupportHit(hit, segment);
  }
  return best;
}

/**
 * First one-way Foothold crossed while descending. Choosing the smallest
 * crossed Y prevents a large tick from tunnelling through an upper platform.
 * @param {number} x
 * @param {number} previousFeetY
 * @param {number} nextFeetY
 * @param {object[]} segments
 */
export function findLandingSegment(x, previousFeetY, nextFeetY, segments) {
  if (nextFeetY < previousFeetY) return null;
  let best = null;
  for (const segment of segments) {
    const hit = segmentHorizontalSpan(segment, x);
    if (!hit) continue;
    const surfaceY = hit.y;
    if (surfaceY < previousFeetY - GROUND_EPSILON_PX
      || surfaceY > nextFeetY + GROUND_EPSILON_PX) continue;
    if (best === null || surfaceY < best.surfaceY) {
      best = pickSupportHit(hit, segment);
    }
  }
  return best;
}

/**
 * @param {object} params
 */
export function createMovementState({
  worldX,
  worldY,
  facing = "right",
  segments,
  layer = 0,
  platform = 0,
} = {}) {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    throw new TypeError("worldX and worldY are required");
  }
  const support = findSpawnSupportSegment(worldX, worldY, segments ?? []);
  const grounded = support !== null;
  const snapY = grounded ? support.surfaceY : worldY;
  return Object.freeze({
    worldX: q(worldX),
    worldY: q(snapY),
    velocityX: 0,
    velocityY: 0,
    facing,
    mode: grounded ? "stand" : "fall",
    grounded,
    contact: grounded ? Object.freeze({
      layer: support.layer,
      platform: support.platform,
      footholdId: support.footholdId,
    }) : null,
    tickIndex: 0,
    simulationTimeMs: 0,
    layer: grounded ? support.layer : layer,
    platform: grounded ? support.platform : platform,
    locomotion: grounded ? "stand" : "jump",
  });
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
 * Advance one BUSINESS_TICK_MS simulation step.
 *
 * @param {object} state prior movement state
 * @param {object} intent from movementIntentFromHeld
 * @param {object} footholdCollisionPlan validated plan with segments[]
 * @param {object} movementConfig FSDB-derived validated physics constants
 * @param {{ jumpPressed?: boolean }} [edges] jump edge this tick
 */
export function stepMovement(state, intent, footholdCollisionPlan, movementConfig, edges = {}) {
  const segments = footholdCollisionPlan.segments;
  const walkSpeed = movementConfig.walkSpeed;
  const gravityAcc = movementConfig.gravityAcc;
  const jumpSpeed = movementConfig.jumpSpeed;
  const fallSpeed = movementConfig.fallSpeed;
  for (const value of [walkSpeed, gravityAcc, jumpSpeed, fallSpeed]) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError("movementConfig is invalid");
  }
  const dt = BUSINESS_TICK_S;
  let worldX = state.worldX;
  let worldY = state.worldY;
  let velocityX = state.velocityX;
  let velocityY = state.velocityY;
  let mode = state.mode;
  let grounded = state.grounded;
  let contact = state.contact;
  let facing = nextFacing(state.facing, intent);
  const dir = horizontalDirection(intent);
  let horizontalIntegrated = false;

  if (grounded) {
    const support = findSupportSegment(worldX, worldY, segments, contact);
    if (!support || worldX < support.minX - 1e-6 || worldX > support.maxX + 1e-6) {
      grounded = false;
      contact = null;
      mode = "fall";
      velocityY = Math.max(velocityY, 0);
    } else {
      worldY = support.surfaceY;
      contact = Object.freeze({
        layer: support.layer,
        platform: support.platform,
        footholdId: support.footholdId,
      });
      if (edges.jumpPressed) {
        grounded = false;
        contact = null;
        mode = "jump";
        velocityY = -jumpSpeed;
        velocityX = dir * walkSpeed;
      } else if (dir !== 0) {
        mode = "walk";
        velocityX = dir * walkSpeed;
        worldX = q(worldX + velocityX * dt);
        horizontalIntegrated = true;
        const edgeSupport = findSupportSegment(worldX, worldY, segments, contact);
        if (!edgeSupport) {
          grounded = false;
          contact = null;
          mode = "fall";
          velocityY = 0;
        } else {
          worldY = edgeSupport.surfaceY;
          contact = Object.freeze({
            layer: edgeSupport.layer,
            platform: edgeSupport.platform,
            footholdId: edgeSupport.footholdId,
          });
        }
      } else {
        mode = "stand";
        velocityX = 0;
      }
    }
  }

  if (!grounded) {
    if (dir !== 0) velocityX = dir * walkSpeed;
    const previousY = worldY;
    velocityY = Math.min(velocityY + gravityAcc * dt, fallSpeed);
    if (!horizontalIntegrated) worldX = q(worldX + velocityX * dt);
    worldY = q(worldY + velocityY * dt);
    const landing = velocityY >= 0
      ? findLandingSegment(worldX, previousY, worldY, segments)
      : null;
    if (landing !== null && worldY >= landing.surfaceY - GROUND_EPSILON_PX) {
      worldY = landing.surfaceY;
      velocityY = 0;
      velocityX = dir !== 0 ? dir * walkSpeed : 0;
      grounded = true;
      contact = Object.freeze({
        layer: landing.layer,
        platform: landing.platform,
        footholdId: landing.footholdId,
      });
      mode = dir !== 0 ? "walk" : "stand";
    } else {
      mode = velocityY < 0 ? "jump" : "fall";
    }
  }

  const locomotion = mode === "walk" ? "walk" : (mode === "stand" ? "stand" : "jump");
  const tickIndex = state.tickIndex + 1;
  const simulationTimeMs = state.simulationTimeMs + BUSINESS_TICK_MS;

  return Object.freeze({
    worldX: q(worldX),
    worldY: q(worldY),
    velocityX: q(velocityX),
    velocityY: q(velocityY),
    facing,
    mode,
    grounded,
    contact,
    tickIndex,
    simulationTimeMs,
    layer: contact?.layer ?? state.layer,
    platform: contact?.platform ?? state.platform,
    locomotion,
  });
}

/**
 * Merge movement into FieldState.player + movement authority.
 * @param {object} fieldState
 * @param {object} movement movement state from stepMovement/createMovementState
 */
export function applyMovementToFieldState(fieldState, movement) {
  const player = Object.freeze({
    ...fieldState.player,
    worldX: movement.worldX,
    worldY: movement.worldY,
    facing: movement.facing,
    locomotion: movement.locomotion,
    layer: movement.layer,
    zM: movement.platform,
  });
  const nextMovement = Object.freeze({
    mode: movement.mode,
    grounded: movement.grounded,
    velocityX: movement.velocityX,
    velocityY: movement.velocityY,
    contact: movement.contact,
    tickIndex: movement.tickIndex,
    simulationTimeMs: movement.simulationTimeMs,
  });
  return Object.freeze({
    ...fieldState,
    player,
    movement: nextMovement,
  });
}

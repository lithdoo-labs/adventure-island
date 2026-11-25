/**
 * Land movement on foothold segments.
 *
 * CMS079 0x9BD757 ground step, 0x9BDF18 air step, 0x9BCFED drop.
 * Y-down world coordinates; vy < 0 is upward. The business tick stays 20ms.
 */
import { footholdYAtX } from "./foothold-collision-plan.mjs";
import {
  dropVerticalSpeed,
  integrateFoothold,
  jumpHorizontal,
  projectOntoFoothold,
  settleGroundTravel,
  stepAirVelocity,
} from "./movement-dynamics.mjs";

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
export function findLandingSegment(x, previousFeetY, nextFeetY, segments, ignoredFootholdId = null) {
  if (nextFeetY < previousFeetY) return null;
  let best = null;
  for (const segment of segments) {
    if (ignoredFootholdId !== null && segment.id === ignoredFootholdId) continue;
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
 * Foothold below the body that a down-jump can fall toward.
 * OpenMS dropTarget: nearest floor at or above y+300, otherwise the nearest
 * in y+300..y+600. The current foothold and a surface within 5px do not count.
 */
export function findDropTarget(x, y, segments, currentId) {
  let nearest = null;
  for (const segment of segments) {
    const hit = segmentHorizontalSpan(segment, x);
    if (!hit || hit.y > y + 300) continue;
    if (nearest === null || hit.y > nearest.surfaceY) nearest = pickSupportHit(hit, segment);
  }
  let chosen = nearest;
  if (!chosen || chosen.footholdId === currentId) {
    chosen = null;
    for (const segment of segments) {
      const hit = segmentHorizontalSpan(segment, x);
      if (!hit || hit.y < y + 300 || hit.y >= y + 600) continue;
      if (chosen === null || hit.y < chosen.surfaceY) chosen = pickSupportHit(hit, segment);
    }
  }
  if (!chosen || chosen.footholdId === currentId) return null;
  if (chosen.surfaceY > y - 5 && chosen.surfaceY < y + 5) return null;
  return chosen;
}

function portalBlocksDrop(entries, x, y) {
  if (!Array.isArray(entries)) return false;
  for (const entry of entries) {
    if (entry?.type !== 12 && entry?.type !== 13) continue;
    if (Math.abs(entry.x - x) <= 20 && Math.abs(entry.y - y) <= 50) return true;
  }
  return false;
}

function contactOf(support) {
  return Object.freeze({
    layer: support.layer,
    platform: support.platform,
    footholdId: support.footholdId,
  });
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
    medium: "land",
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
    ropeContact: null,
    ignoredFootholdId: null,
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
 * @param {{ jumpPressed?: boolean, jumpHeld?: boolean, dropPressed?: boolean, portalEntries?: object[] }} [edges]
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
  let grounded = state.grounded === true && state.contact !== null;
  let contact = grounded ? state.contact : null;
  let facing = nextFacing(state.facing, intent);
  let ignoredFootholdId = state.ignoredFootholdId ?? null;
  const dir = horizontalDirection(intent);
  let ranFoothold = false;

  if (grounded) {
    const support = findSupportSegment(worldX, worldY, segments, contact);
    const onSegment = support !== null
      && worldX >= support.minX - 1e-6
      && worldX <= support.maxX + 1e-6;
    if (!onSegment) {
      grounded = false;
      contact = null;
      mode = "fall";
      velocityY = Math.max(velocityY, 0);
    } else {
      worldY = support.surfaceY;
      contact = contactOf(support);
      const wantsDrop = edges.dropPressed === true;
      const wantsJump = (edges.jumpPressed === true || edges.jumpHeld === true) && !intent.down;
      const dropTarget = wantsDrop && !portalBlocksDrop(edges.portalEntries, worldX, worldY)
        ? findDropTarget(worldX, worldY, segments, contact.footholdId)
        : null;
      if (dropTarget) {
        ignoredFootholdId = contact.footholdId;
        velocityX = 0;
        velocityY = dropVerticalSpeed(jumpSpeed);
        grounded = false;
        contact = null;
        mode = "fall";
      } else if (wantsJump) {
        velocityY = -jumpSpeed;
        velocityX = jumpHorizontal(velocityX, dir, walkSpeed);
        grounded = false;
        contact = null;
        ignoredFootholdId = null;
        mode = "jump";
      } else if (intent.down && dir === 0) {
        velocityX = 0;
        velocityY = 0;
        mode = "prone";
        ranFoothold = true;
      } else {
        const moved = integrateFoothold(
          worldX,
          worldY,
          velocityX,
          velocityY,
          support.segment,
          dir,
          movementConfig,
          dt,
          false,
        );
        const settled = settleGroundTravel(moved, support.segment, segments, dt);
        worldX = settled.worldX;
        worldY = settled.worldY;
        velocityX = settled.velocityX;
        velocityY = settled.velocityY;
        ranFoothold = true;
        if (!settled.on) {
          grounded = false;
          contact = null;
          mode = "fall";
        } else {
          contact = contactOf({
            layer: settled.segment.layer,
            platform: settled.segment.platform,
            footholdId: settled.segment.id,
          });
          mode = dir !== 0 ? "walk" : "stand";
        }
      }
    }
  }

  if (!grounded && !ranFoothold) {
    const previousX = velocityX;
    const previousY = velocityY;
    const previousFeetY = worldY;
    const air = stepAirVelocity(velocityX, velocityY, dir, movementConfig, dt);
    velocityX = air.velocityX;
    velocityY = air.velocityY;
    worldX += (previousX + velocityX) * dt * 0.5;
    worldY += (previousY + velocityY) * dt * 0.5;
    const landing = velocityY >= 0
      ? findLandingSegment(worldX, previousFeetY, worldY, segments, ignoredFootholdId)
      : null;
    if (landing !== null && worldY >= landing.surfaceY - GROUND_EPSILON_PX) {
      const tangent = projectOntoFoothold(velocityX, velocityY, landing.segment);
      worldY = landing.surfaceY;
      velocityX = tangent.velocityX;
      velocityY = tangent.velocityY;
      grounded = true;
      contact = contactOf(landing);
      ignoredFootholdId = null;
      mode = dir !== 0 ? "walk" : "stand";
    } else {
      mode = velocityY < 0 ? "jump" : "fall";
    }
  }

  const locomotion = mode === "walk" ? "walk" : (mode === "stand" ? "stand" : (mode === "prone" ? "prone" : "jump"));
  const tickIndex = state.tickIndex + 1;
  const simulationTimeMs = state.simulationTimeMs + BUSINESS_TICK_MS;

  return Object.freeze({
    medium: "land",
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
    ropeContact: null,
    ignoredFootholdId,
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
    ropeContact: movement.ropeContact ?? null,
    tickIndex: movement.tickIndex,
    simulationTimeMs: movement.simulationTimeMs,
  });
  return Object.freeze({
    ...fieldState,
    player,
    movement: nextMovement,
  });
}

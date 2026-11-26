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
  physicalBoundsFromFootholds,
  settleGroundTravel,
  stepAirVelocity,
  sweepAirMotion,
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
    spacePlatform: spacePlatformOf(segments ?? []),
    fallTerminalTicks: 0,
    fallLanding: null,
    seat: null,
  });
}

export function spacePlatformOf(segments) {
  let space = null;
  for (const segment of segments) {
    if (space === null || segment.platform < space) space = segment.platform;
  }
  return space ?? 0;
}

function reachableSeat(seats, x, y) {
  if (!Array.isArray(seats)) return null;
  for (const seat of seats) {
    if (!Number.isFinite(seat?.x) || !Number.isFinite(seat?.y)) continue;
    if (seat.x >= x - 10 && seat.x < x + 10 && seat.y >= y - 30 && seat.y < y + 30) {
      const id = Number.isSafeInteger(seat.id) ? seat.id : (Number.isSafeInteger(seat.index) ? seat.index : 0);
      return { id, x: seat.x, y: seat.y };
    }
  }
  return null;
}

function takeFallLanding(ticks, fallSpeed, facing) {
  const threshold = Math.trunc(600000 / fallSpeed / BUSINESS_TICK_MS);
  if (ticks <= threshold || ticks <= 18) return { ticks, landing: null };
  return {
    ticks: 0,
    landing: {
      amount: Math.max(1, 36 - Math.trunc(336 / (ticks - 18))),
      facing,
    },
  };
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
  const bounds = physicalBoundsFromFootholds(segments);
  const spacePlatform = state.spacePlatform ?? spacePlatformOf(segments);
  let worldX = state.worldX;
  let worldY = state.worldY;
  let velocityX = state.velocityX;
  let velocityY = state.velocityY;
  let mode = state.mode;
  let grounded = state.grounded === true && state.contact !== null;
  let contact = grounded ? state.contact : null;
  let facing = nextFacing(state.facing, intent);
  let ignoredFootholdId = state.ignoredFootholdId ?? null;
  let seat = state.seat ?? null;
  let fallTerminalTicks = velocityY >= fallSpeed ? (state.fallTerminalTicks ?? 0) + 1 : 0;
  let fallLanding = null;
  const dir = horizontalDirection(intent);
  let ranFoothold = false;

  if (seat) {
    const leaving = intent.left || intent.right || intent.up || intent.down
      || intent.jump || edges.sitPressed === true;
    if (!leaving) {
      return finishMovement(state, {
        worldX: seat.x,
        worldY: seat.y,
        velocityX: 0,
        velocityY: 0,
        facing,
        mode: "sit",
        grounded: true,
        contact,
        locomotion: "sit",
        ignoredFootholdId: null,
        spacePlatform,
        fallTerminalTicks: 0,
        fallLanding: null,
        seat,
      });
    }
    seat = null;
    grounded = false;
    contact = null;
    mode = "fall";
    velocityX = 0;
    velocityY = 0;
  } else if (edges.sitPressed === true && grounded
    && Math.abs(velocityX) < 1e-6 && Math.abs(velocityY) < 1e-6) {
    const found = reachableSeat(edges.seats, worldX, worldY);
    if (found) {
      return finishMovement(state, {
        worldX: found.x,
        worldY: found.y,
        velocityX: 0,
        velocityY: 0,
        facing,
        mode: "sit",
        grounded: true,
        contact,
        locomotion: "sit",
        ignoredFootholdId: null,
        spacePlatform,
        fallTerminalTicks: 0,
        fallLanding: null,
        seat: found,
      });
    }
  }

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
      const dropBlocked = (Number(edges.fieldLimit) & 0x20000) !== 0
        || support.segment.forbidFallDown === true;
      const dropTarget = wantsDrop && !dropBlocked && !portalBlocksDrop(edges.portalEntries, worldX, worldY)
        ? findDropTarget(worldX, worldY, segments, contact.footholdId)
        : null;
      if (dropTarget) {
        ignoredFootholdId = contact.footholdId;
        worldY = Math.floor(worldY - 1);
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
        const settled = settleGroundTravel(moved, support.segment, segments, dt, bounds);
        worldX = settled.worldX;
        worldY = settled.worldY;
        velocityX = settled.velocityX;
        velocityY = settled.velocityY;
        ranFoothold = true;
        if (!settled.on) {
          const swept = sweepAirMotion({
            x0: settled.entryX,
            y0: settled.entryY,
            x1: worldX,
            y1: worldY,
            velocityX0: velocityX,
            velocityY0: velocityY,
            velocityX1: velocityX,
            velocityY1: velocityY,
            remainingMs: settled.remainingMs ?? 0,
            segments,
            contactPlatform: support.platform,
            spacePlatform,
            ignoredFootholdId,
            horizontalInput: dir,
            bounds,
            secondary: true,
          });
          ({ worldX, worldY, velocityX, velocityY, grounded, contact, mode, ignoredFootholdId, fallTerminalTicks, fallLanding } = adoptSweep(
            swept, dir, facing, fallSpeed, fallTerminalTicks, fallLanding, ignoredFootholdId,
          ));
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
    const previousFeetX = worldX;
    const previousFeetY = worldY;
    const air = stepAirVelocity(velocityX, velocityY, dir, movementConfig, dt);
    velocityX = air.velocityX;
    velocityY = air.velocityY;
    worldX += (previousX + velocityX) * dt * 0.5;
    worldY += (previousY + velocityY) * dt * 0.5;
    const swept = sweepAirMotion({
      x0: previousFeetX,
      y0: previousFeetY,
      x1: worldX,
      y1: worldY,
      velocityX0: previousX,
      velocityY0: previousY,
      velocityX1: velocityX,
      velocityY1: velocityY,
      remainingMs: BUSINESS_TICK_MS,
      segments,
      contactPlatform: state.platform,
      spacePlatform,
      ignoredFootholdId,
      horizontalInput: dir,
      bounds,
      secondary: false,
    });
    ({ worldX, worldY, velocityX, velocityY, grounded, contact, mode, ignoredFootholdId, fallTerminalTicks, fallLanding } = adoptSweep(
      swept, dir, facing, fallSpeed, fallTerminalTicks, fallLanding, ignoredFootholdId,
    ));
  }

  const locomotion = mode === "walk" ? "walk" : (mode === "stand" ? "stand" : (mode === "prone" ? "prone" : "jump"));
  return finishMovement(state, {
    worldX,
    worldY,
    velocityX,
    velocityY,
    facing,
    mode,
    grounded,
    contact,
    locomotion,
    ignoredFootholdId,
    spacePlatform,
    fallTerminalTicks,
    fallLanding,
    seat,
  });
}

function adoptSweep(swept, dir, facing, fallSpeed, fallTerminalTicks, fallLanding, ignoredFootholdId) {
  let ticks = fallTerminalTicks;
  let landing = fallLanding;
  if (swept.landed) {
    const recorded = takeFallLanding(ticks, fallSpeed, facing);
    ticks = recorded.ticks;
    landing = recorded.landing;
  }
  const keptIgnored = swept.landed ? null : ignoredFootholdId;
  if (swept.grounded && swept.segment) {
    return {
      worldX: swept.worldX,
      worldY: swept.worldY,
      velocityX: swept.velocityX,
      velocityY: swept.velocityY,
      grounded: true,
      contact: contactOf({
        layer: swept.segment.layer,
        platform: swept.segment.platform,
        footholdId: swept.segment.id,
      }),
      mode: dir !== 0 ? "walk" : "stand",
      ignoredFootholdId: keptIgnored,
      fallTerminalTicks: ticks,
      fallLanding: landing,
    };
  }
  return {
    worldX: swept.worldX,
    worldY: swept.worldY,
    velocityX: swept.velocityX,
    velocityY: swept.velocityY,
    grounded: false,
    contact: null,
    mode: swept.velocityY < 0 ? "jump" : "fall",
    ignoredFootholdId: keptIgnored,
    fallTerminalTicks: ticks,
    fallLanding: landing,
  };
}

function finishMovement(state, fields) {
  const locomotion = fields.locomotion
    ?? (fields.mode === "walk" ? "walk" : (fields.mode === "stand" ? "stand" : (fields.mode === "prone" ? "prone" : "jump")));
  return Object.freeze({
    medium: "land",
    worldX: q(fields.worldX),
    worldY: q(fields.worldY),
    velocityX: q(fields.velocityX),
    velocityY: q(fields.velocityY),
    facing: fields.facing,
    mode: fields.mode,
    grounded: fields.grounded,
    contact: fields.contact,
    tickIndex: state.tickIndex + 1,
    simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
    layer: fields.contact?.layer ?? state.layer,
    platform: fields.contact?.platform ?? state.platform,
    locomotion,
    ropeContact: null,
    ignoredFootholdId: fields.ignoredFootholdId ?? null,
    spacePlatform: fields.spacePlatform,
    fallTerminalTicks: fields.fallTerminalTicks,
    fallLanding: fields.fallLanding,
    seat: fields.seat,
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
    fallLanding: movement.fallLanding ?? null,
    seat: movement.seat ?? null,
  });
  return Object.freeze({
    ...fieldState,
    player,
    movement: nextMovement,
  });
}

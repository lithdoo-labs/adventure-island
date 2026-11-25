/**
 * CMS079 movement coefficients for the shared Physics.img record.
 * Ground: 0x9BD757. Air: 0x9BDF18. Drop: 1 / (jumpSpeed * K), K = -0.35355339.
 * Shoe mass stays 100. Coefficients come from the physics record when the plan carries them.
 */

const MASS = 100;
const SLOPE_GENTLE = 0.9;
export const DROP_K = -0.35355339;
export const HELD_BUOYANT_JUMP_MS = 300;

const PHYSICS = Object.freeze({
  walkForce: 140000,
  walkDrag: 80000,
  floatDrag2: 10000,
  floatCoefficient: 0.01,
  slipForce: 60000,
  slipSpeed: 120,
});

function coeff(config, key) {
  const value = config?.[key];
  return Number.isFinite(value) ? value : PHYSICS[key];
}

export function approach(value, target, amount) {
  if (value > target) return Math.max(target, value - amount);
  return Math.min(target, value + amount);
}

function approachRange(value, lo, hi, amount) {
  if (value > hi) return Math.max(hi, value - amount);
  if (value < lo) return Math.min(lo, value + amount);
  return value;
}

/** 0x9BDEA7. drive is the force before dividing by the shoe mass. */
export function accelerate(value, drive, limit, seconds) {
  if (limit < 0) return value;
  const step = (drive / MASS) * seconds;
  if (drive > 0 && value < limit) return Math.min(limit, value + step);
  if (drive <= 0 && value > -limit) return Math.max(-limit, value + step);
  return value;
}

/**
 * Along-foothold speed. key is world horizontal, -1, 0 or +1.
 * L = 0 on these maps, so a released key brakes and a held key accelerates.
 */
export function stepAlongSpeed(speed, key, ty, config, dt, swim) {
  const walkForce = coeff(config, "walkForce");
  const walkDrag = coeff(config, "walkDrag");
  const swimScale = swim ? config.swimSpeedDec : 1;
  const slopeSign = ty < 0 ? 1 : -1;
  const square = ty * ty;
  let step0 = key * walkForce;
  if (swim) step0 *= swimScale;
  const step1 = key * step0 > 0 ? step0 : 0;
  const slopeFactor = ty < 0 ? 1 - square : 1 + square;
  const step = slopeFactor * step1;
  const endpoint = config.walkSpeed * swimScale;
  const delta = ((1 * walkDrag) / MASS) * dt;
  let along = speed;

  if (Math.abs(ty) <= 1e-9) {
    if (endpoint >= 0) along = approachRange(along, -endpoint, endpoint, delta);
    if (key === 0) return approach(along, 0, delta);
    return accelerate(along, step, endpoint, dt);
  }

  if (Math.abs(ty) <= SLOPE_GENTLE) {
    const band = slopeSign * along > 0
      ? Math.max((1 + square) * endpoint, 0)
      : Math.max(endpoint, 0);
    along = approachRange(along, -band, band, delta);
    if (key === 0) return approach(along, 0, delta);
    const limit = slopeSign * step > 0
      ? Math.max(endpoint, 0)
      : Math.max((1 + square) * endpoint, 0);
    return accelerate(along, step, limit, dt);
  }

  const band = slopeSign * along > 0
    ? Math.max((1 + square) * endpoint, 0)
    : Math.max(endpoint, 0);
  along = approachRange(along, -band, band, delta);
  if (slopeSign * along > 0) along = approach(along, 0, delta);
  const slipForce = coeff(config, "slipForce");
  const slipSpeed = coeff(config, "slipSpeed");
  let drive;
  let limit;
  if (key * slopeSign > 0) {
    drive = -slopeSign * Math.abs(ty) * slipForce * 0.5;
    limit = Math.abs(ty) * slipSpeed * 0.5;
  } else if (key === 0) {
    drive = -slopeSign * Math.abs(ty) * slipForce;
    limit = Math.abs(ty) * slipSpeed;
  } else {
    drive = -slopeSign * Math.abs(ty) * slipForce + step;
    limit = Math.abs(ty) * slipSpeed + Math.max((1 + square) * endpoint, 0);
  }
  return accelerate(along, drive, limit, dt);
}

export function footholdTangent(segment) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const len = Math.hypot(dx, dy);
  return {
    len,
    tx: dx / len,
    ty: dy / len,
    x1: segment.x1,
    y1: segment.y1,
  };
}

/** One ground sample along the current foothold, before endpoint links. */
export function integrateFoothold(worldX, worldY, velocityX, velocityY, segment, key, config, dt, swim) {
  const tangent = footholdTangent(segment);
  const slot0 = (worldX - tangent.x1) * tangent.tx + (worldY - tangent.y1) * tangent.ty;
  const along0 = velocityX * tangent.tx + velocityY * tangent.ty;
  const along1 = stepAlongSpeed(along0, key, tangent.ty, config, dt, swim);
  const slot1 = slot0 + ((along0 + along1) * dt * 0.5);
  const placed = projectAlong(segment, slot1, along1);
  return {
    ...placed,
    on: slot1 >= 0 && slot1 <= tangent.len,
    slot0,
    slot1,
    along0,
    along1,
  };
}

/** CMS 0x9BF1FA / OpenMS 009b3fd1. A rightward prev/next stays on the ground. */
export const MAX_FOOTHOLD_TRANSITIONS = 32;

export function settleGroundTravel(moved, segment, segments, dt) {
  const byId = new Map();
  for (const item of segments) byId.set(item.id, item);
  const reentered = reenterEndpoint(segment, moved.slot0, moved.slot1, moved.along1, byId);
  if (reentered) return reentered;

  let current = segment;
  let slot0 = moved.slot0;
  let slot1 = moved.slot1;
  let along0 = moved.along0;
  let along1 = moved.along1;
  let remainingMs = Math.round(dt * 1000);
  for (let count = 0; count < MAX_FOOTHOLD_TRANSITIONS; count += 1) {
    const tangent = footholdTangent(current);
    if (Math.abs(along0) < 1e-6 && Math.abs(along1) < 1e-6) {
      return projectAlong(current, clampSlot(slot1, tangent.len), 0);
    }
    const before = slot1 < 0;
    if (!before && slot1 <= tangent.len) return projectAlong(current, slot1, along1);
    const endpoint = before ? 0 : tangent.len;
    const span = slot1 - slot0;
    const fraction = span === 0 ? 1 : (endpoint - slot0) / span;
    const consumed = Math.min(1, Math.max(0, fraction));
    remainingMs -= Math.trunc(remainingMs * consumed);
    const along = along0 + (along1 - along0) * consumed;
    const neighbor = linkedSegment(byId, before ? current.prev : current.next);
    const neighborTangent = neighbor ? footholdTangent(neighbor) : null;
    if (neighborTangent && neighborTangent.tx > 0) {
      const speed = (before && along > 0) || (!before && along < 0) ? 0 : along;
      current = neighbor;
      slot0 = before ? neighborTangent.len : 0;
      along0 = speed;
      along1 = speed;
      slot1 = slot0 + speed * remainingMs * 0.001;
      continue;
    }
    if (blocksEdge(neighborTangent, before)) return projectAlong(current, endpoint, 0);
    const released = projectAlong(current, endpoint, along);
    const seconds = remainingMs * 0.001;
    return {
      on: false,
      segment: current,
      worldX: released.worldX + released.velocityX * seconds,
      worldY: released.worldY + released.velocityY * seconds,
      velocityX: released.velocityX,
      velocityY: released.velocityY,
    };
  }
  const tangent = footholdTangent(current);
  return projectAlong(current, clampSlot(slot1, tangent.len), along1);
}

function projectAlong(segment, slot, along) {
  const tangent = footholdTangent(segment);
  return {
    on: true,
    segment,
    worldX: tangent.x1 + slot * tangent.tx,
    worldY: tangent.y1 + slot * tangent.ty,
    velocityX: along * tangent.tx,
    velocityY: along * tangent.ty,
  };
}

function clampSlot(slot, length) {
  return Math.min(length, Math.max(0, slot));
}

function linkedSegment(byId, id) {
  if (!Number.isSafeInteger(id) || id === 0) return null;
  return byId.get(id) ?? null;
}

function blocksEdge(tangent, before) {
  if (!tangent) return false;
  return before ? tangent.ty >= 0 : tangent.ty <= 0;
}

function reenterEndpoint(segment, slot0, slot1, along, byId) {
  const tangent = footholdTangent(segment);
  let alternate = null;
  let atEnd = false;
  if (slot0 <= 0 && slot1 > 0) {
    alternate = linkedSegment(byId, linkedSegment(byId, segment.prev)?.next);
    atEnd = false;
  } else if (slot0 >= tangent.len && slot1 < tangent.len) {
    alternate = linkedSegment(byId, linkedSegment(byId, segment.next)?.prev);
    atEnd = true;
  } else {
    return null;
  }
  if (!alternate || alternate.id === segment.id) return null;
  const altTangent = footholdTangent(alternate);
  if (altTangent.tx > 0) return projectAlong(alternate, atEnd ? altTangent.len : 0, along);
  return projectAlong(segment, atEnd ? tangent.len : 0, 0);
}

/** Ground jump keeps momentum and adds at most 0.8 of the walk cap. */
export function jumpHorizontal(velocityX, direction, cap) {
  let vx = velocityX;
  if (direction * vx < cap * 0.8) vx += direction * cap * 0.8;
  if (direction * vx > cap) vx = direction * cap;
  return vx;
}

export function dropVerticalSpeed(jumpSpeed) {
  return 1 / (jumpSpeed * DROP_K);
}

/** Land air branch. Steering limit is walkSpeed / walkForce * floatDrag2. */
export function stepAirVelocity(velocityX, velocityY, direction, config, dt) {
  const drag = coeff(config, "floatDrag2");
  const fall = config.fallSpeed;
  let vy = velocityY;
  if (vy > fall) vy = approach(vy, fall, (drag / MASS) * dt);
  vy = accelerate(vy, config.gravityAcc * MASS, fall, dt);
  let vx = velocityX;
  if (direction !== 0) {
    const limit = (config.walkSpeed / coeff(config, "walkForce")) * drag;
    vx = accelerate(vx, direction * drag * 2, limit, dt);
  } else {
    const coefficient = vy < fall ? coeff(config, "floatCoefficient") : 1;
    vx = approach(vx, 0, ((drag * coefficient) / MASS) * dt);
  }
  return { velocityX: vx, velocityY: vy };
}

export function projectOntoFoothold(velocityX, velocityY, segment) {
  const tangent = footholdTangent(segment);
  const along = velocityX * tangent.tx + velocityY * tangent.ty;
  return {
    velocityX: along * tangent.tx,
    velocityY: along * tangent.ty,
  };
}

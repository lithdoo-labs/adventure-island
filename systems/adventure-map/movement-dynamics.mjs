/**
 * CMS079 movement coefficients for the shared Physics.img record.
 * Ground: 0x9BD757. Air: 0x9BDF18. Drop: K * jumpSpeed, K = -0.35355339.
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
export function stepAlongSpeed(speed, key, ty, config, dt, swim, friction = 1, conveyor = 0) {
  if (key * conveyor < 0 && Math.abs(conveyor) < 1) return speed;
  const walkForce = coeff(config, "walkForce");
  const walkDrag = coeff(config, "walkDrag");
  const swimScale = swim ? config.swimSpeedDec : 1;
  const slopeSign = ty < 0 ? 1 : -1;
  const square = ty * ty;
  const slopeFactor = ty < 0 ? 1 - square : 1 + square;
  const drive = slopeFactor * conveyorDrive(conveyor, key, swimScale) * walkForce;
  const endpoint = config.walkSpeed * swimScale * conveyorScale(conveyor, key);
  const delta = ((walkDrag * frictionDragScale(friction, config)) / MASS) * dt;
  let along = speed;

  if (Math.abs(ty) <= 1e-9) {
    if (endpoint >= 0) along = approachRange(along, -endpoint, endpoint, delta);
    if (key === 0 && conveyor === 0) return approach(along, 0, delta);
    return accelerate(along, drive, endpoint, dt);
  }

  if (Math.abs(ty) <= SLOPE_GENTLE) {
    const band = slopeSign * along > 0
      ? Math.max((1 + square) * endpoint, 0)
      : Math.max(endpoint, 0);
    along = approachRange(along, -band, band, delta);
    if (key === 0 && conveyor === 0) return approach(along, 0, delta);
    const limit = slopeSign * drive > 0
      ? Math.max(endpoint, 0)
      : Math.max((1 + square) * endpoint, 0);
    return accelerate(along, drive, limit, dt);
  }

  const band = slopeSign * along > 0
    ? Math.max((1 + square) * endpoint, 0)
    : Math.max(endpoint, 0);
  along = approachRange(along, -band, band, delta);
  if (slopeSign * along > 0) along = approach(along, 0, delta);
  const slipForce = coeff(config, "slipForce");
  const slipSpeed = coeff(config, "slipSpeed");
  let slipDrive;
  let limit;
  if (key * slopeSign > 0) {
    slipDrive = -slopeSign * Math.abs(ty) * slipForce * 0.5;
    limit = Math.abs(ty) * slipSpeed * 0.5;
  } else if (key === 0 && conveyor === 0) {
    slipDrive = -slopeSign * Math.abs(ty) * slipForce;
    limit = Math.abs(ty) * slipSpeed;
  } else {
    slipDrive = -slopeSign * Math.abs(ty) * slipForce + drive;
    limit = Math.abs(ty) * slipSpeed + Math.max((1 + square) * endpoint, 0);
  }
  return accelerate(along, slipDrive, limit, dt);
}

function frictionDragScale(footholdFriction, config) {
  const mapFs = Number.isFinite(config?.fs) ? config.fs : 1;
  const minFriction = Number.isFinite(config?.minFriction) ? config.minFriction : 0.05;
  const maxFriction = Number.isFinite(config?.maxFriction) ? config.maxFriction : 2;
  const friction = Math.max(minFriction, Math.min(maxFriction, mapFs * footholdFriction));
  return friction * (friction < 1 ? 0.5 : 1);
}

function conveyorScale(conveyor, direction) {
  if (conveyor === 0) return 1;
  const magnitude = Math.abs(Math.trunc(conveyor));
  if (direction === 0) return magnitude;
  return direction * conveyor > 0 ? magnitude * 2 : 0.2 / magnitude;
}

function conveyorDrive(conveyor, direction, swimScale) {
  if (direction === 0) return conveyor;
  return direction * swimScale * conveyorScale(conveyor, direction);
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
  const along1 = stepAlongSpeed(
    along0,
    key,
    tangent.ty,
    config,
    dt,
    swim,
    segment.friction ?? 1,
    segment.conveyor ?? 0,
  );
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

export function settleGroundTravel(moved, segment, segments, dt, bounds = null) {
  const byId = new Map();
  for (const item of segments) byId.set(item.id, item);
  let slot1 = moved.slot1;
  let along1 = moved.along1;
  const clippedSlot = clipSlotToBounds(segment, slot1, bounds);
  if (clippedSlot !== null) {
    slot1 = clippedSlot;
    along1 = 0;
  }
  const reentered = reenterEndpoint(segment, moved.slot0, slot1, along1, byId);
  if (reentered) return reentered;

  let current = segment;
  let slot0 = moved.slot0;
  let along0 = moved.along0;
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
      entryX: released.worldX,
      entryY: released.worldY,
      worldX: released.worldX + released.velocityX * seconds,
      worldY: released.worldY + released.velocityY * seconds,
      velocityX: released.velocityX,
      velocityY: released.velocityY,
      remainingMs,
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
  return DROP_K * jumpSpeed;
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

function clipSlotToBounds(segment, slot, bounds) {
  if (!bounds) return null;
  const tangent = footholdTangent(segment);
  if (Math.abs(tangent.tx) < 1e-6) return null;
  const x = tangent.x1 + tangent.tx * slot;
  const clipped = Math.max(bounds.left, Math.min(bounds.right, x));
  if (clipped === x) return null;
  return (clipped - tangent.x1) / tangent.tx;
}

/**
 * One swept contact, OpenMS 009b34c8 / 009b19d0.
 * A ground detach is the second pass only: the coast already spent the tick.
 * A normal air tick may slide along the first wall and sweep once more.
 * Floors of any platform count. A wall counts for the contact platform or the
 * space platform. Integer truncation is only inside this query.
 * @param {object} move
 */
export function sweepAirMotion(move) {
  const clipped = clipAirEnd(move, move.bounds ?? null);
  let x = clipped.x1;
  let y = clipped.y1;
  let vx = clipped.vx;
  let vy = clipped.vy;
  let remainingMs = clipped.remainingMs;
  const byId = new Map();
  for (const segment of move.segments) byId.set(segment.id, segment);
  const passes = move.secondary ? [1] : [0, 1];
  for (const pass of passes) {
    const found = earliestContact(move.x0, move.y0, x, y, move, byId);
    if (!found) return airborne(x, y, vx, vy, false);
    const hitVx = move.velocityX0 + (vx - move.velocityX0) * found.fraction;
    const hitVy = move.velocityY0 + (vy - move.velocityY0) * found.fraction;
    const chosen = chooseContact(found.first, found.last, hitVx, hitVy);
    if (move.ignoredFootholdId != null && chosen.segment.id === move.ignoredFootholdId) {
      return airborne(x, y, vx, vy, false);
    }
    const located = locateContact(move.x0, move.y0, x, y, found.fraction, chosen.segment);
    remainingMs -= Math.trunc(remainingMs * found.fraction);
    const tangent = footholdTangent(chosen.segment);
    if (tangent.tx > 0) {
      const keep = move.horizontalInput * chosen.speed >= 0 ? chosen.speed * 0.5 : 0;
      const settled = continueGround(
        chosen.segment,
        located.position,
        keep,
        pass === 0 ? remainingMs : 0,
        move.segments,
        move.bounds ?? null,
      );
      return {
        grounded: settled.on === true,
        landed: true,
        segment: settled.segment,
        worldX: settled.worldX,
        worldY: settled.worldY,
        velocityX: settled.velocityX,
        velocityY: settled.velocityY,
      };
    }
    if (pass !== 0) {
      return airborne(
        located.x,
        located.y,
        chosen.speed * tangent.tx,
        chosen.speed * tangent.ty,
        false,
      );
    }
    const slid = vx * tangent.tx + vy * tangent.ty;
    vx = slid * tangent.tx;
    vy = slid * tangent.ty;
    x = located.x + (chosen.speed * tangent.tx + vx) * remainingMs * 0.0005;
    y = located.y + (chosen.speed * tangent.ty + vy) * remainingMs * 0.0005;
    if (remainingMs <= 0) return airborne(x, y, vx, vy, false);
  }
  return airborne(x, y, vx, vy, false);
}

function airborne(worldX, worldY, velocityX, velocityY, landed) {
  return {
    grounded: false,
    landed,
    segment: null,
    worldX,
    worldY,
    velocityX,
    velocityY,
  };
}

function continueGround(segment, position, speed, remainingMs, segments, bounds) {
  const seconds = Math.max(0, remainingMs) * 0.001;
  return settleGroundTravel({
    slot0: position,
    slot1: position + speed * seconds,
    along0: speed,
    along1: speed,
  }, segment, segments, seconds, bounds);
}

function clipAirEnd(move, bounds) {
  let x1 = move.x1;
  let y1 = move.y1;
  let vx = move.velocityX1;
  let vy = move.velocityY1;
  let remainingMs = move.remainingMs;
  if (!bounds) return { x1, y1, vx, vy, remainingMs };
  const x = Math.max(bounds.left, Math.min(bounds.right, x1));
  if (x !== x1) {
    remainingMs = clippedMilliseconds(move.x0, x1, x, remainingMs);
    x1 = x;
    vx = 0;
  }
  if (y1 < bounds.top) {
    remainingMs = Math.min(
      remainingMs,
      clippedMilliseconds(move.y0, y1, bounds.top, remainingMs),
    );
    y1 = bounds.top;
    vy = 0;
  }
  return { x1, y1, vx, vy, remainingMs };
}

function clippedMilliseconds(before, after, clipped, milliseconds) {
  if (before === after) return milliseconds;
  return Math.max(0, Math.min(
    milliseconds,
    Math.trunc(((clipped - before) / (after - before)) * milliseconds),
  ));
}

function earliestContact(x0, y0, x1, y1, move, byId) {
  let best = null;
  for (const segment of move.segments) {
    if (!airEligible(segment, move.contactPlatform, move.spacePlatform)) continue;
    const hit = crossingFraction(x0, y0, x1, y1, segment);
    if (!hit) continue;
    const pair = endpointPair(x0, y0, x1, y1, segment, hit, byId);
    if (!pair) continue;
    if (best === null || hit.fraction < best.fraction) {
      best = { ...pair, fraction: hit.fraction };
      continue;
    }
    if (hit.fraction > best.fraction) continue;
    if (sideOf(best.first, pair.first.x1, pair.first.y1) < 0) best.first = pair.first;
    if (sideOf(best.last, pair.last.x2, pair.last.y2) < 0) best.last = pair.last;
  }
  return best;
}

function airEligible(segment, contactPlatform, spacePlatform) {
  if (footholdTangent(segment).tx > 0) return true;
  return segment.platform === contactPlatform || segment.platform === spacePlatform;
}

function crossingFraction(x0, y0, x1, y1, segment) {
  const x = Math.trunc(x0);
  const y = Math.trunc(y0);
  const endX = Math.trunc(x1);
  const endY = Math.trunc(y1);
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const startSide = (y - segment.y1) * dx - (x - segment.x1) * dy;
  const endSide = (endY - segment.y1) * dx - (endX - segment.x1) * dy;
  if (startSide > 0 || endSide < 0 || startSide === endSide) return null;
  const fraction = startSide / (startSide - endSide);
  const hitX = x + (endX - x) * fraction;
  const hitY = y + (endY - y) * fraction;
  const tx = dx / len;
  const ty = dy / len;
  const distance = (hitX - segment.x1) * tx + (hitY - segment.y1) * ty;
  if (distance < 0 || distance > len) return null;
  return { fraction };
}

function endpointPair(x0, y0, x1, y1, segment, hit, byId) {
  const dx = Math.trunc(x1) - Math.trunc(x0);
  const dy = Math.trunc(y1) - Math.trunc(y0);
  const firstSide = (segment.y1 - Math.trunc(y0)) * dx - (segment.x1 - Math.trunc(x0)) * dy;
  const lastSide = (segment.y2 - Math.trunc(y0)) * dx - (segment.x2 - Math.trunc(x0)) * dy;
  let first = segment;
  let last = segment;
  if (firstSide === 0) {
    last = linkedSegment(byId, segment.prev);
    if (!last || !endpointCrosses(last, first, x1, y1)) return null;
  } else if (lastSide === 0) {
    first = linkedSegment(byId, segment.next);
    if (!first || !endpointCrosses(last, first, x1, y1)) return null;
  }
  return { first, last, fraction: hit.fraction };
}

function sideOf(segment, x, y) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  return dx * (y - segment.y1) - dy * (x - segment.x1);
}

function endpointCrosses(first, last, endX, endY) {
  const x = Math.trunc(endX);
  const y = Math.trunc(endY);
  const convex = sideOf(first, last.x2, last.y2) > 0;
  const firstSide = sideOf(first, x, y) > 0;
  const lastSide = sideOf(last, x, y) > 0;
  return convex ? firstSide && lastSide : firstSide || lastSide;
}

function chooseContact(first, last, vx, vy) {
  const firstTangent = footholdTangent(first);
  const lastTangent = footholdTangent(last);
  const firstSpeed = firstTangent.tx * vx + firstTangent.ty * vy;
  const lastSpeed = lastTangent.tx * vx + lastTangent.ty * vy;
  if (first === last || (firstSpeed > 0.001 && lastSpeed > 0.001)) {
    return { segment: first, speed: firstSpeed };
  }
  if (firstSpeed < -0.001 && lastSpeed < -0.001) {
    return { segment: last, speed: lastSpeed };
  }
  return { segment: firstTangent.tx > 0 ? first : last, speed: 0 };
}

function locateContact(x0, y0, x1, y1, fraction, segment) {
  const oldX = Math.trunc(x0);
  const oldY = Math.trunc(y0);
  const dx = Math.trunc(x1) - oldX;
  const dy = Math.trunc(y1) - oldY;
  const segDx = segment.x2 - segment.x1;
  const segDy = segment.y2 - segment.y1;
  let x = Math.trunc(oldX + dx * fraction);
  let y;
  if (Math.abs(segDx) < 1e-9) {
    y = oldY + dy * fraction;
    x = segment.x1;
  } else if (dx === 0) {
    y = segment.y1 + ((x - segment.x1) * segDy) / segDx;
  } else {
    y = oldY + ((x - oldX) * dy) / dx;
  }
  const tangent = footholdTangent(segment);
  let position = Math.abs(tangent.tx) > 0.5
    ? (x - segment.x1) / tangent.tx
    : (y - segment.y1) / tangent.ty;
  if (!Number.isFinite(position)) position = 0;
  position = Math.max(0, Math.min(tangent.len, position));
  return {
    x: tangent.x1 + tangent.tx * position,
    y: tangent.y1 + tangent.ty * position,
    position,
  };
}

/**
 * Foothold extrema with the original physical margins. A rectangle narrower
 * than those margins is not a wall. VRLimit is absent on these maps, so the
 * vr rectangle is not applied.
 */
export function physicalBoundsFromFootholds(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const row of segments) {
    const x1 = row?.x1;
    const x2 = row?.x2;
    const y1 = row?.y1;
    const y2 = row?.y2;
    if (![x1, x2, y1, y2].every(Number.isFinite)) return null;
    minX = Math.min(minX, x1, x2);
    maxX = Math.max(maxX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxY = Math.max(maxY, y1, y2);
  }
  const bounds = {
    left: minX + 30,
    right: maxX - 30,
    top: minY - 300,
    bottom: maxY + 10,
  };
  if (bounds.left > bounds.right || bounds.top > bounds.bottom) return null;
  return bounds;
}

export function projectOntoFoothold(velocityX, velocityY, segment) {
  const tangent = footholdTangent(segment);
  const along = velocityX * tangent.tx + velocityY * tangent.ty;
  return {
    velocityX: along * tangent.tx,
    velocityY: along * tangent.ty,
  };
}

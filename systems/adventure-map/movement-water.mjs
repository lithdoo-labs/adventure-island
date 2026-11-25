/**
 * Airborne swim velocity, plus foothold attach/detach on a swim map.
 *
 * CMS079: 0x9BCDC2 keeps the ground step while a foothold is installed.
 * 0x9BE3BA runs only after that foothold is cleared. swimSpeedDec scales the
 * ground walk; it is not the water drag.
 * OPENMS-REFERENCE (reimplemented, not copied): buoyant velocity while airborne.
 * These maps have no fs, so the drag scale is 1 and the brake step is
 * floatDrag1 / 100 per second.
 * - No vertical key: vy is pushed toward +swimSpeed by swimForce / 100.
 * - Up: approach -0.3 * swimSpeed. Down: approach +1.5 * swimSpeed.
 *   Above the target the step is swimForce / 100; below it, half of that.
 *   The ±swimSpeed brake runs first, so a down-held speed above the cap is
 *   pulled back on the next tick and does not stay at 1.5 * swimSpeed.
 * - Horizontal: brake outside ±swimSpeed, accelerate with the key while held,
 *   and drag toward 0 when released.
 * - A jump writes vy = -(swimSpeed * 5), including the press that leaves a
 *   foothold, then this same tick integrates. Holding it repeats that impulse
 *   every 300ms while airborne. Landing while it is still held jumps again.
 * - Position uses the average of the pre- and post-integration velocities.
 * - Downward crossings install the highest crossed walkable segment.
 * - Avatar projection maps locomotion swim → fly, and stand/walk while grounded.
 * - After the step, X is clamped to the physical rectangle and horizontal
 *   speed is cleared at a side. Y stops only above the top. The bottom is
 *   not a floor. Spawn and arrival clamp Y into the rectangle once.
 */
import {
  HELD_BUOYANT_JUMP_MS,
  dropVerticalSpeed,
  integrateFoothold,
  settleGroundTravel,
  jumpHorizontal,
} from "./movement-dynamics.mjs";
import {
  BUSINESS_TICK_MS,
  BUSINESS_TICK_S,
  GROUND_EPSILON_PX,
  findDropTarget,
  findLandingSegment,
  findSupportSegment,
} from "./movement-sim.mjs";

export const WATER_JUMP_SPEED_MULTIPLIER = 5;

function q(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * OpenMS prepareBounds margins, recovered from the physical rectangle
 * (left/right inset 30, top expanded 300, bottom expanded 10). No VRLimit
 * on these swim maps, so the foothold extrema are the whole wall.
 * A reversed rectangle (a fixture narrower than the margins) is not a wall.
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

function clipSwimBody(worldX, worldY, velocityX, velocityY, bounds, clampBottom) {
  if (!bounds) {
    return { worldX, worldY, velocityX, velocityY };
  }
  let x = worldX;
  let y = worldY;
  let vx = velocityX;
  let vy = velocityY;
  if (x < bounds.left) {
    x = bounds.left;
    vx = 0;
  } else if (x > bounds.right) {
    x = bounds.right;
    vx = 0;
  }
  if (y < bounds.top) {
    y = bounds.top;
    vy = 0;
  } else if (clampBottom && y > bounds.bottom) {
    y = bounds.bottom;
    vy = 0;
  }
  return {
    worldX: q(x),
    worldY: q(y),
    velocityX: q(vx),
    velocityY: q(vy),
  };
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
    ignoredFootholdId: null,
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
  let jumpRepeatMs = Math.max(0, (state.jumpRepeatMs ?? 0) - BUSINESS_TICK_MS);
  const jumpHeld = intent.jump === true;
  const repeatArmed = edges.jumpPressed === true || (state.jumpRepeatMs ?? 0) > 0;
  if (!jumpHeld) jumpRepeatMs = 0;
  else if (edges.jumpPressed === true || (repeatArmed && jumpRepeatMs === 0)) {
    velocityY = -swimSpeed * WATER_JUMP_SPEED_MULTIPLIER;
    jumpRepeatMs = HELD_BUOYANT_JUMP_MS;
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
    ignoredFootholdId: state.ignoredFootholdId ?? null,
  });
}

function contactOf(support) {
  return Object.freeze({
    layer: support.layer,
    platform: support.platform,
    footholdId: support.footholdId,
  });
}

function freezeSwimStep(state, fields) {
  return Object.freeze({
    medium: "water",
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
    locomotion: fields.locomotion,
    ropeContact: null,
    jumpRepeatMs: fields.jumpRepeatMs,
    ignoredFootholdId: fields.ignoredFootholdId ?? null,
  });
}

/**
 * Swim-map step. Ground contact uses the land walk, scaled by swimSpeedDec.
 * Leaving the segment, or jumping, continues with the airborne swim equation
 * and can land again on a lower walkable segment.
 *
 * @param {object} state
 * @param {object} intent
 * @param {object} footholdCollisionPlan
 * @param {object} movementConfig
 * @param {{ jumpPressed?: boolean }} [edges]
 */
export function stepSwimMapMovement(state, intent, footholdCollisionPlan, movementConfig, edges = {}) {
  const segments = footholdCollisionPlan?.segments;
  if (!Array.isArray(segments)) throw new TypeError("footholdCollisionPlan.segments is required");
  const walkSpeed = movementConfig.walkSpeed * movementConfig.swimSpeedDec;
  if (!Number.isFinite(walkSpeed) || walkSpeed <= 0) {
    throw new TypeError("movementConfig ground fields are invalid");
  }
  const dt = BUSINESS_TICK_S;
  const facing = nextFacing(state.facing, intent);
  const dir = horizontalDirection(intent);
  let worldX = state.worldX;
  let worldY = state.worldY;
  let velocityX = state.velocityX;
  let velocityY = state.velocityY;
  let grounded = state.grounded === true && state.contact !== null;
  let contact = grounded ? state.contact : null;
  let horizontalIntegrated = false;
  let ignoredFootholdId = state.ignoredFootholdId ?? null;
  let leaveForJump = false;

  if (grounded) {
    const support = findSupportSegment(worldX, worldY, segments, contact);
    const onSegment = support !== null
      && worldX >= support.minX - 1e-6
      && worldX <= support.maxX + 1e-6;
    if (!onSegment) {
      grounded = false;
      contact = null;
      velocityY = Math.max(velocityY, 0);
    } else {
      worldY = support.surfaceY;
      contact = contactOf(support);
      const dropTarget = edges.dropPressed === true
        ? findDropTarget(worldX, worldY, segments, contact.footholdId)
        : null;
      if (dropTarget) {
        ignoredFootholdId = contact.footholdId;
        velocityX = 0;
        velocityY = dropVerticalSpeed(movementConfig.jumpSpeed);
        grounded = false;
        contact = null;
      } else if ((edges.jumpPressed === true || edges.jumpHeld === true) && !intent.down) {
        velocityX = jumpHorizontal(velocityX, dir, walkSpeed);
        grounded = false;
        contact = null;
        ignoredFootholdId = null;
        leaveForJump = true;
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
          true,
        );
        const settled = settleGroundTravel(moved, support.segment, segments, dt);
        worldX = settled.worldX;
        worldY = settled.worldY;
        velocityX = settled.velocityX;
        velocityY = settled.velocityY;
        horizontalIntegrated = true;
        if (!settled.on) {
          grounded = false;
          contact = null;
        } else {
          contact = contactOf({
            layer: settled.segment.layer,
            platform: settled.segment.platform,
            footholdId: settled.segment.id,
          });
        }
      }
    }
  }

  const bounds = physicalBoundsFromFootholds(segments);
  if (grounded) {
    const mode = dir !== 0 ? "walk" : "stand";
    const clipped = clipSwimBody(worldX, worldY, velocityX, velocityY, bounds, false);
    return freezeSwimStep(state, {
      worldX: clipped.worldX,
      worldY: clipped.worldY,
      velocityX: clipped.velocityX,
      velocityY: clipped.velocityY,
      facing,
      mode,
      grounded: true,
      contact,
      locomotion: mode,
      jumpRepeatMs: 0,
      ignoredFootholdId: null,
    });
  }

  const steppedX = worldX;
  const previousY = worldY;
  const swam = stepWaterMovement(
    {
      ...state,
      worldX,
      worldY,
      velocityX,
      velocityY,
      facing,
      grounded: false,
      contact: null,
      mode: "swim",
      locomotion: "swim",
      jumpRepeatMs: leaveForJump ? 0 : (state.jumpRepeatMs ?? 0),
      ignoredFootholdId,
      medium: "water",
    },
    intent,
    movementConfig,
    leaveForJump ? { ...edges, jumpPressed: true } : edges,
  );
  const resolvedX = horizontalIntegrated ? steppedX : swam.worldX;
  const clippedMove = clipSwimBody(resolvedX, swam.worldY, swam.velocityX, swam.velocityY, bounds, false);
  const landing = clippedMove.velocityY >= 0
    ? findLandingSegment(clippedMove.worldX, previousY, clippedMove.worldY, segments, ignoredFootholdId)
    : null;
  if (landing !== null && clippedMove.worldY >= landing.surfaceY - GROUND_EPSILON_PX) {
    const mode = dir !== 0 ? "walk" : "stand";
    const clippedLand = clipSwimBody(
      clippedMove.worldX,
      landing.surfaceY,
      clippedMove.velocityX,
      0,
      bounds,
      false,
    );
    return freezeSwimStep(state, {
      worldX: clippedLand.worldX,
      worldY: clippedLand.worldY,
      velocityX: clippedLand.velocityX,
      velocityY: clippedLand.velocityY,
      facing: swam.facing,
      mode,
      grounded: true,
      contact: contactOf(landing),
      locomotion: mode,
      jumpRepeatMs: 0,
      ignoredFootholdId: null,
    });
  }
  if (
    clippedMove.worldX === swam.worldX
    && clippedMove.worldY === swam.worldY
    && clippedMove.velocityX === swam.velocityX
    && clippedMove.velocityY === swam.velocityY
    && !horizontalIntegrated
  ) {
    return swam;
  }
  return Object.freeze({
    ...swam,
    worldX: clippedMove.worldX,
    worldY: clippedMove.worldY,
    velocityX: clippedMove.velocityX,
    velocityY: clippedMove.velocityY,
  });
}

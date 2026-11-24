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
 * - A jump edge writes vy = -(swimSpeed * 5), including the edge that leaves
 *   a foothold, then this same tick integrates. Holding the button does not
 *   repeat that impulse.
 * - Position uses the average of the pre- and post-integration velocities.
 * - Downward crossings install the highest crossed walkable segment.
 * - Avatar projection maps locomotion swim → fly, and stand/walk while grounded.
 */
import {
  BUSINESS_TICK_MS,
  BUSINESS_TICK_S,
  GROUND_EPSILON_PX,
  findLandingSegment,
  findSupportSegment,
} from "./movement-sim.mjs";

export const WATER_JUMP_SPEED_MULTIPLIER = 5;

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
  if (edges.jumpPressed) velocityY = -swimSpeed * WATER_JUMP_SPEED_MULTIPLIER;
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
    jumpRepeatMs: 0,
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
      if (edges.jumpPressed) {
        grounded = false;
        contact = null;
        velocityX = dir * walkSpeed;
      } else if (dir !== 0) {
        velocityX = dir * walkSpeed;
        velocityY = 0;
        worldX = q(worldX + velocityX * dt);
        horizontalIntegrated = true;
        const edgeSupport = findSupportSegment(worldX, worldY, segments, contact);
        if (edgeSupport === null) {
          grounded = false;
          contact = null;
          velocityY = 0;
        } else {
          worldY = edgeSupport.surfaceY;
          contact = contactOf(edgeSupport);
        }
      } else {
        velocityX = 0;
        velocityY = 0;
      }
    }
  }

  if (grounded) {
    const mode = dir !== 0 ? "walk" : "stand";
    return freezeSwimStep(state, {
      worldX,
      worldY,
      velocityX,
      velocityY,
      facing,
      mode,
      grounded: true,
      contact,
      locomotion: mode,
      jumpRepeatMs: 0,
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
      jumpRepeatMs: 0,
      medium: "water",
    },
    intent,
    movementConfig,
    edges,
  );
  const resolvedX = horizontalIntegrated ? steppedX : swam.worldX;
  const landing = swam.velocityY >= 0
    ? findLandingSegment(resolvedX, previousY, swam.worldY, segments)
    : null;
  if (landing !== null && swam.worldY >= landing.surfaceY - GROUND_EPSILON_PX) {
    const mode = dir !== 0 ? "walk" : "stand";
    return freezeSwimStep(state, {
      worldX: resolvedX,
      worldY: landing.surfaceY,
      velocityX: dir !== 0 ? dir * walkSpeed : 0,
      velocityY: 0,
      facing: swam.facing,
      mode,
      grounded: true,
      contact: contactOf(landing),
      locomotion: mode,
      jumpRepeatMs: 0,
    });
  }
  if (!horizontalIntegrated) return swam;
  return Object.freeze({ ...swam, worldX: resolvedX });
}

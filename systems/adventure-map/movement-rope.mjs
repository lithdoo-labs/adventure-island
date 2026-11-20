/**
 * Rope grab/climb authority (M7.3) bounded by CMS079 C-056/C-069/C-071/C-072/C-091.
 *
 * PRODUCT-DECISION: exit at rope ends uses stand contact restore (C-081 family) without
 * teleport; jump edge while climbing also exits to fall/stand.
 */
import {
  BUSINESS_TICK_MS,
  findLandingSegment,
  findSupportSegment,
} from "./movement-sim.mjs";
import {
  ROPE_HIT_HALF_WIDTH_PX,
  queryRopeSegments,
} from "./rope-collision-plan.mjs";

/** CMS079 C-056 byte-read constant at 0xB00D68. */
export const CLIMB_DELTA_PER_TICK = 3;

/** CMS079 C-071 DOWN grab uses Y..Y-20; UP grab uses Y..Y+10. */
const GRAB_DOWN_Y_ABOVE = 20;
const GRAB_UP_Y_BELOW = 10;

/**
 * Product decision for map 222000001: sea00 support is 40 px below the
 * authenticated rope bottom. The entry snap may bridge that exact authored
 * gap, but must never become an unbounded vertical teleport.
 */
export const ROPE_BOTTOM_ENTRY_MAX_DROP_PX = 40;

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

function ropeContactFromSegment(segment, bottomExitArmed = true) {
  return Object.freeze({
    stableId: segment.stableId,
    ropeId: segment.id,
    x: segment.x,
    y1: segment.y1,
    y2: segment.y2,
    uf: segment.uf,
    bottomExitArmed,
  });
}

/**
 * @param {object} state
 * @param {number} worldX
 * @param {number} worldY
 * @param {object[]} segments
 */
function tryGrabDown(state, worldX, worldY, segments) {
  if (!state.grounded || state.mode === "climb") return null;
  const xMin = worldX - ROPE_HIT_HALF_WIDTH_PX;
  const xMax = worldX + ROPE_HIT_HALF_WIDTH_PX;
  const yMax = worldY;
  const yMin = worldY - GRAB_DOWN_Y_ABOVE;
  let hit = queryRopeSegments(segments, xMin, xMax, yMin, yMax);
  if (!hit) {
    // PRODUCT-DECISION (M7.3): sea00 feet are 40 px below rope.y2 while
    // horizontally aligned with the audited shaft rope.
    for (const segment of segments) {
      if (worldX < segment.x - ROPE_HIT_HALF_WIDTH_PX || worldX > segment.x + ROPE_HIT_HALF_WIDTH_PX) continue;
      if (worldY < segment.y2 - GRAB_DOWN_Y_ABOVE) continue;
      if (worldY > segment.y2 + ROPE_BOTTOM_ENTRY_MAX_DROP_PX) continue;
      hit = segment;
      break;
    }
  }
  if (!hit) return null;
  return Object.freeze({
    worldX: q(hit.x),
    worldY: q(Math.min(worldY, hit.y2)),
    velocityX: 0,
    velocityY: 0,
    mode: "climb",
    grounded: false,
    contact: null,
    ropeContact: ropeContactFromSegment(hit, false),
    locomotion: "climb",
  });
}

function tryGrabUp(state, worldX, worldY, segments) {
  if (state.mode === "climb" || state.grounded) return null;
  const xMin = worldX - ROPE_HIT_HALF_WIDTH_PX;
  const xMax = worldX + ROPE_HIT_HALF_WIDTH_PX;
  const yMin = worldY;
  const yMax = worldY + GRAB_UP_Y_BELOW;
  const hit = queryRopeSegments(segments, xMin, xMax, yMin, yMax);
  if (!hit) return null;
  if (hit.y1 > worldY + GRAB_UP_Y_BELOW) return null;
  return Object.freeze({
    worldX: q(hit.x),
    worldY: q(hit.y1),
    velocityX: 0,
    velocityY: 0,
    mode: "climb",
    grounded: false,
    contact: null,
    ropeContact: ropeContactFromSegment(hit),
    locomotion: "climb",
  });
}

function clampClimbY(y, verticalKey, rope) {
  const top = rope.y1;
  const bottom = rope.y2;
  if (y < top) {
    return rope.uf !== 0 ? top - 5 : top;
  }
  if (verticalKey > 0 && y > bottom) {
    return bottom + 1;
  }
  return y;
}

function exitClimbToFall(state, footholdSegments, worldX, worldY, facing) {
  const previousY = worldY;
  const landing = findLandingSegment(worldX, previousY, worldY, footholdSegments);
  if (landing !== null) {
    return Object.freeze({
      ...state,
      medium: "land",
      worldX: q(worldX),
      worldY: q(landing.surfaceY),
      velocityX: 0,
      velocityY: 0,
      mode: "stand",
      grounded: true,
      contact: Object.freeze({
        layer: landing.layer,
        platform: landing.platform,
        footholdId: landing.footholdId,
      }),
      ropeContact: null,
      layer: landing.layer,
      platform: landing.platform,
      locomotion: "stand",
      facing,
    });
  }
  return Object.freeze({
    ...state,
    medium: "land",
    worldX: q(worldX),
    worldY: q(worldY),
    velocityX: 0,
    velocityY: 0,
    mode: "fall",
    grounded: false,
    contact: null,
    ropeContact: null,
    locomotion: "jump",
    facing,
  });
}

/**
 * @param {object} state climb movement state
 * @param {object} intent
 * @param {object} ropeCollisionPlan
 * @param {object} footholdCollisionPlan
 * @param {{ jumpPressed?: boolean }} edges
 */
export function stepClimbMovement(state, intent, ropeCollisionPlan, footholdCollisionPlan, edges = {}) {
  const rope = state.ropeContact;
  if (!rope) throw new TypeError("climb state requires ropeContact");
  const verticalKey = verticalAxisFromIntent(intent);
  let facing = state.facing;
  if (intent.facing === "left" || intent.facing === "right") facing = intent.facing;

  if (edges.jumpPressed) {
    const exited = exitClimbToFall(
      state,
      footholdCollisionPlan.segments,
      state.worldX,
      state.worldY + 2,
      facing,
    );
    return Object.freeze({
      ...exited,
      tickIndex: state.tickIndex + 1,
      simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
    });
  }

  let worldY = state.worldY;
  const ropeContact = rope.bottomExitArmed === false && verticalKey <= 0
    ? Object.freeze({ ...rope, bottomExitArmed: true })
    : rope;
  if (verticalKey !== 0) {
    worldY = q(worldY + CLIMB_DELTA_PER_TICK * verticalKey);
    if (verticalKey > 0 && ropeContact.bottomExitArmed === false && worldY > rope.y2) {
      // A DOWN grab arrives exactly at the bottom. Keep the contact until the
      // player releases or reverses DOWN once; otherwise the next 20 ms tick
      // would immediately undo the grab before an input device can react.
      worldY = rope.y2;
    } else {
      worldY = q(clampClimbY(worldY, verticalKey, rope));
    }
  }
  const worldX = q(rope.x);

  if (verticalKey > 0 && worldY > rope.y2) {
    const exited = exitClimbToFall(state, footholdCollisionPlan.segments, worldX, worldY, facing);
    return Object.freeze({
      ...exited,
      tickIndex: state.tickIndex + 1,
      simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
    });
  }

  if (verticalKey === 0) {
    const support = findSupportSegment(worldX, worldY, footholdCollisionPlan.segments, null);
    if (support && Math.abs(support.surfaceY - worldY) <= 4) {
      return Object.freeze({
        ...state,
        medium: "land",
        worldX,
        worldY: q(support.surfaceY),
        velocityX: 0,
        velocityY: 0,
        mode: "stand",
        grounded: true,
        contact: Object.freeze({
          layer: support.layer,
          platform: support.platform,
          footholdId: support.footholdId,
        }),
        ropeContact: null,
        layer: support.layer,
        platform: support.platform,
        locomotion: "stand",
        facing,
        tickIndex: state.tickIndex + 1,
        simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
      });
    }
  }

  return Object.freeze({
    ...state,
    medium: "land",
    worldX,
    worldY,
    velocityX: 0,
    velocityY: 0,
    mode: "climb",
    grounded: false,
    contact: null,
    ropeContact,
    facing,
    locomotion: "climb",
    tickIndex: state.tickIndex + 1,
    simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
  });
}

/**
 * Land/air step with rope grab adjudication (C-071/C-091).
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
  const segments = ropeCollisionPlan?.segments ?? [];
  const verticalKey = verticalAxisFromIntent(intent);
  if (state.mode !== "climb" && segments.length > 0 && verticalKey !== 0) {
    // C-091: +1 = VK_DOWN, -1 = VK_UP; C-071 DOWN/UP grab paths track that sign.
    if (verticalKey > 0) {
      const grabbed = tryGrabDown(state, state.worldX, state.worldY, segments);
      if (grabbed) {
        return Object.freeze({
          ...state,
          ...grabbed,
          tickIndex: state.tickIndex + 1,
          simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
          layer: state.layer,
          platform: state.platform,
        });
      }
    } else if (verticalKey < 0) {
      const grabbed = tryGrabUp(state, state.worldX, state.worldY, segments);
      if (grabbed) {
        return Object.freeze({
          ...state,
          ...grabbed,
          tickIndex: state.tickIndex + 1,
          simulationTimeMs: state.simulationTimeMs + BUSINESS_TICK_MS,
          layer: state.layer,
          platform: state.platform,
        });
      }
    }
  }
  const next = stepMovementFn(state, intent, footholdCollisionPlan, movementConfig, edges);
  return Object.freeze({ ...next, ropeContact: null });
}

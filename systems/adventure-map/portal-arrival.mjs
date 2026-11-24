import { createMovementStateForMap } from "./movement-step.mjs";

/** CMS079 cross-map spawn writes the portal anchor, then adds y - 0xA. */
export const PORTAL_ARRIVAL_Y_OFFSET = 10;

/** Destination feet position from target portal anchor (Subsystem authority). */
export function arrivalPositionFromPortal(portal) {
  return Object.freeze({
    worldX: portal.x,
    worldY: portal.y - PORTAL_ARRIVAL_Y_OFFSET,
  });
}

/**
 * Cross-map / same-map arrival: zero velocity + foothold snap via M5 support query.
 * @param {object} targetPortal portalLogicalIndex entry on destination map
 * @param {object} footholdCollisionPlan validated plan
 * @param {{ facing?: string, mapEnvironment?: object }} [options]
 */
export function buildArrivalMovementState(targetPortal, footholdCollisionPlan, options = {}) {
  const pos = arrivalPositionFromPortal(targetPortal);
  return createMovementStateForMap({
    mapEnvironment: options.mapEnvironment,
    worldX: pos.worldX,
    worldY: pos.worldY,
    facing: options.facing ?? "right",
    segments: footholdCollisionPlan.segments,
  });
}

export function portalTravelFieldPatch(fieldState, movementState, portalTravelPatch) {
  const player = Object.freeze({
    ...fieldState.player,
    worldX: movementState.worldX,
    worldY: movementState.worldY,
    facing: movementState.facing,
    locomotion: movementState.locomotion,
    layer: movementState.layer,
    zM: movementState.platform,
  });
  const movement = Object.freeze({
    mode: movementState.mode,
    grounded: movementState.grounded,
    velocityX: 0,
    velocityY: 0,
    contact: movementState.contact,
    tickIndex: movementState.tickIndex,
    simulationTimeMs: movementState.simulationTimeMs,
  });
  return Object.freeze({
    ...fieldState,
    player,
    movement,
    portalTravel: Object.freeze({
      ...fieldState.portalTravel,
      ...portalTravelPatch,
    }),
  });
}
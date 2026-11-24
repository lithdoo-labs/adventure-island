import { mapEnvironmentIsSwim } from "./map-environment.mjs";
import { createMovementState, stepMovement } from "./movement-sim.mjs";
import { stepClimbMovement, stepLandMovementWithRope } from "./movement-rope.mjs";
import { createWaterMovementState, stepSwimMapMovement } from "./movement-water.mjs";

/**
 * @param {object} [params]
 */
export function createMovementStateForMap({
  mapEnvironment,
  worldX,
  worldY,
  facing,
  segments,
  layer,
  platform,
} = {}) {
  if (mapEnvironmentIsSwim(mapEnvironment)) {
    return createWaterMovementState({ worldX, worldY, facing, layer, platform });
  }
  const movement = createMovementState({
    worldX,
    worldY,
    facing,
    segments,
    layer,
    platform,
  });
  return Object.freeze({ ...movement, medium: "land", ropeContact: null });
}

export function stepMovementForMap(
  state,
  intent,
  footholdCollisionPlan,
  ropeCollisionPlan,
  movementConfig,
  mapEnvironment,
  edges = {},
) {
  if (mapEnvironmentIsSwim(mapEnvironment)) {
    return stepSwimMapMovement(state, intent, footholdCollisionPlan, movementConfig, edges);
  }
  if (state.mode === "climb" && state.ropeContact) {
    const next = stepClimbMovement(state, intent, ropeCollisionPlan, footholdCollisionPlan, edges);
    return Object.freeze({ ...next, medium: "land" });
  }
  const next = stepLandMovementWithRope(
    state,
    intent,
    footholdCollisionPlan,
    ropeCollisionPlan,
    movementConfig,
    edges,
    stepMovement,
  );
  return Object.freeze({ ...next, medium: "land" });
}

import { mapEnvironmentIsSwim } from "./map-environment.mjs";
import { createMovementState, stepMovement } from "./movement-sim.mjs";
import { createWaterMovementState, stepWaterMovement } from "./movement-water.mjs";

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
  return Object.freeze({ ...movement, medium: "land" });
}

export function stepMovementForMap(
  state,
  intent,
  footholdCollisionPlan,
  movementConfig,
  mapEnvironment,
  edges = {},
) {
  if (mapEnvironmentIsSwim(mapEnvironment)) {
    return stepWaterMovement(state, intent, movementConfig, edges);
  }
  const next = stepMovement(state, intent, footholdCollisionPlan, movementConfig, edges);
  return Object.freeze({ ...next, medium: "land" });
}
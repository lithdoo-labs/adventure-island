import { applyCameraToFieldState } from "./camera-state.mjs";
import { projectAdventureMapFieldSceneFromPlan } from "./field-scene-runtime.mjs";
import { buildArrivalMovementState, portalTravelFieldPatch } from "./portal-arrival.mjs";
import { applySceneEpochToRenderRoot } from "./portal-scene-epoch.mjs";
import { projectInitialMovementRoot } from "./movement-render-projection.mjs";

/**
 * Plan an atomic same-map commit (Player/Movement/Camera/portalTravel only).
 */
export function planSameMapPortalCommit({
  activePlan,
  fieldState,
  movementState,
  sourcePortal,
  targetPortal,
  viewport,
  travelToken,
}) {
  const arrivalMovement = buildArrivalMovementState(
    targetPortal,
    activePlan.footholdCollisionPlan,
    { facing: movementState.facing, mapEnvironment: activePlan.mapEnvironment },
  );
  const nextField = portalTravelFieldPatch(fieldState, arrivalMovement, {
    phase: "committed",
    activeToken: travelToken,
    lastEdge: `${activePlan.mapId}:${sourcePortal.name}`,
    targetEdge: `${activePlan.mapId}:${targetPortal.name}`,
    crossMap: false,
  });
  const cameraProjection = applyCameraToFieldState(
    nextField,
    viewport,
    activePlan,
  );
  return Object.freeze({
    crossMap: false,
    fieldState: cameraProjection.fieldState,
    movementState: arrivalMovement,
    camera: cameraProjection.camera,
    sceneEpoch: fieldState.portalTravel?.sceneEpoch ?? 0,
    renderReplace: false,
  });
}

/**
 * Plan cross-map commit after target FieldPlan is validated.
 */
export function planCrossMapPortalCommit({
  sourcePlan,
  targetPlan,
  fieldState,
  movementState,
  sourcePortal,
  targetPortal,
  viewport,
  travelToken,
  nextSceneEpoch,
}) {
  const arrivalMovement = buildArrivalMovementState(
    targetPortal,
    targetPlan.footholdCollisionPlan,
    { facing: movementState.facing, mapEnvironment: targetPlan.mapEnvironment },
  );
  const targetProjection = projectAdventureMapFieldSceneFromPlan(targetPlan, viewport);
  const stagedField = portalTravelFieldPatch(
    Object.freeze({
      ...targetProjection.fieldState,
      mapId: targetPlan.mapId,
    }),
    arrivalMovement,
    {
      phase: "committed",
      activeToken: travelToken,
      lastEdge: `${sourcePlan.mapId}:${sourcePortal.name}`,
      targetEdge: `${targetPlan.mapId}:${targetPortal.name}`,
      crossMap: true,
      sceneEpoch: nextSceneEpoch,
    },
  );
  const cameraProjection = applyCameraToFieldState(
    stagedField,
    viewport,
    targetPlan,
  );
  const epochRoot = applySceneEpochToRenderRoot(targetProjection.root, nextSceneEpoch);
  const renderRoot = projectInitialMovementRoot(
    epochRoot,
    cameraProjection.fieldState,
    cameraProjection.camera,
  );
  return Object.freeze({
    ok: true,
    crossMap: true,
    fieldState: cameraProjection.fieldState,
    movementState: arrivalMovement,
    camera: cameraProjection.camera,
    activePlan: targetPlan,
    projection: targetProjection,
    sceneEpoch: nextSceneEpoch,
    sceneRootKey: renderRoot.key,
    renderRoot,
    renderReplace: true,
  });
}

export function createPortalTravelIdle(sceneEpoch = 0) {
  return Object.freeze({
    phase: "idle",
    activeToken: 0,
    sceneEpoch,
    crossMap: false,
  });
}

export function nextPortalTravelToken(current) {
  return (current?.activeToken ?? 0) + 1;
}
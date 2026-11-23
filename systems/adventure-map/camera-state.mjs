import { cameraForViewport, stepCameraFollow } from "../../components/ms-field/src/camera.mjs";

/** Project deterministic authoritative CameraState from Player + viewport. */
export function applyCameraToFieldState(fieldState, viewport, bounds) {
  const follow = stepCameraFollow(
    fieldState.camera?.follow,
    fieldState.player,
    fieldState.movement?.simulationTimeMs ?? 0,
  );
  const camera = cameraForViewport(
    { worldX: follow.x, worldY: follow.y },
    viewport,
    bounds,
  );
  const nextCamera = Object.freeze({
    ...fieldState.camera,
    intent: "filtered-follow",
    cameraX: camera.cameraX,
    cameraY: camera.cameraY,
    viewportWidth: Number.isFinite(viewport?.width) ? viewport.width : null,
    viewportHeight: Number.isFinite(viewport?.height) ? viewport.height : null,
    follow,
  });
  return Object.freeze({
    camera,
    fieldState: Object.freeze({ ...fieldState, camera: nextCamera }),
  });
}

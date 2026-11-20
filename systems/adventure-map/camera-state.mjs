import { cameraForViewport } from "../../components/ms-field/src/camera.mjs";

/** Project deterministic authoritative CameraState from Player + viewport. */
export function applyCameraToFieldState(fieldState, viewport, effectiveBounds) {
  const camera = cameraForViewport(fieldState.player, viewport, { effectiveBounds });
  const nextCamera = Object.freeze({
    ...fieldState.camera,
    intent: "immediate-center-clamp",
    cameraX: camera.cameraX,
    cameraY: camera.cameraY,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });
  return Object.freeze({
    camera,
    fieldState: Object.freeze({ ...fieldState, camera: nextCamera }),
  });
}

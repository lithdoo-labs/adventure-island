import { cameraForViewport, stepCameraFollow } from "../../components/ms-field/src/camera.mjs";
import { cameraRectFromFootholds, isClientVrInset } from "../../components/ms-map-adapter/src/bounds.mjs";

/**
 * Bounds object passed to the camera clamp.
 * VR maps keep the raw VR rectangle. Every other plan uses the foothold
 * camera rectangle when the segments can form one, so a published minimap
 * rectangle stays on the plan and does not move the view.
 * @param {object | null | undefined} plan
 */
export function cameraBoundsForPlan(plan) {
  if (plan === null || typeof plan !== "object") return plan;
  const sourceBounds = plan.sourceBounds;
  const effectiveBounds = plan.effectiveBounds;
  if (isClientVrInset(sourceBounds, effectiveBounds)) {
    return { sourceBounds, effectiveBounds };
  }
  const attached = plan.cameraBounds;
  if (attached && [attached.left, attached.right, attached.top, attached.bottom].every((edge) => Number.isFinite(edge))) {
    return plan;
  }
  const rect = cameraRectFromFootholds(plan.footholdCollisionPlan?.segments);
  if (!rect) return { sourceBounds, effectiveBounds };
  return { sourceBounds, effectiveBounds, cameraBounds: rect };
}

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
    cameraBoundsForPlan(bounds),
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

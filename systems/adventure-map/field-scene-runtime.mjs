/**
 * Browser-safe static Field runtime: project camera attrs onto the published
 * bootstrap AdventureFieldPlan (no Node FSDB, no generated baseline module).
 */
import { cameraForViewport } from "../../components/ms-field/src/camera.mjs";
import { createStaticFieldState } from "../../components/ms-field/src/field-state.mjs";
import { validateFieldPlan } from "./field-plan-model.mjs";
import { applyProjectionPatches } from "./render-node-patches.mjs";
import { projectViewportRelayoutUpdates } from "./viewport-view-projection.mjs";

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function rootWithCamera(root, camera, children = root.children) {
  const attrs = Object.freeze({
    ...root.attrs,
    "camera-x": decimalAttr(camera.cameraX),
    "camera-y": decimalAttr(camera.cameraY),
    visible: "true",
  });
  return Object.freeze({
    ...root,
    attrs,
    children,
  });
}

/**
 * @param {object} planValue bootstrap AdventureFieldPlan record body
 * @param {{ width: number, height: number } | null | undefined} viewport
 */
export function projectAdventureMapFieldSceneFromPlan(planValue, viewport) {
  const plan = validateFieldPlan(planValue);
  const fieldState = plan.fieldState ?? createStaticFieldState({ mapId: plan.mapId });
  const camera = cameraForViewport(
    fieldState.player,
    viewport ?? null,
    { effectiveBounds: plan.effectiveBounds },
  );
  const relayout = viewport === null || viewport === undefined
    ? []
    : projectViewportRelayoutUpdates(plan.root.children, viewport, camera);
  const children = relayout.length === 0
    ? plan.root.children
    : applyProjectionPatches(plan.root.children, relayout);
  const root = rootWithCamera(plan.root, camera, children);
  return Object.freeze({
    fieldState,
    effectiveBounds: plan.effectiveBounds,
    root,
    hash: plan.hash,
    mapProjectionHash: plan.mapProjectionHash,
    fromContent: true,
  });
}

/** Bootstrap default scene root key (map 222000000). */
export const FIELD_SCENE_ROOT_KEY = "scene:map222000000";

/** @param {string} mapId */
export function fieldSceneRootKeyForMap(mapId) {
  return `scene:map${mapId}`;
}

/**
 * @param {object} plan bootstrap AdventureFieldPlan record body
 */
export function sceneRootKeyFromPlan(plan) {
  if (plan?.root?.key) return plan.root.key;
  if (plan?.mapId) return fieldSceneRootKeyForMap(plan.mapId);
  return FIELD_SCENE_ROOT_KEY;
}

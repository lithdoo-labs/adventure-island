/**
 * Camera-only RenderNode updates for ms-map-object flow layout hosts.
 */
import { objFlowViewAttrsForCamera } from "../../components/ms-map-adapter/src/obj-flow.mjs";

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function needsCameraRelativeFlowUpdates(layout) {
  if (!layout || typeof layout !== "object") return false;
  return layout.pinToViewportX === true || layout.pinToViewportY === true;
}

/**
 * @param {ReadonlyArray<object>} children ms-scene-view paint unit children
 * @param {{ cameraX: number, cameraY: number }} camera
 * @returns {ReadonlyArray<{key: string, attrs: { set: object }}>}
 */
export function projectObjFlowCameraUpdates(children, camera) {
  if (!Array.isArray(children)) throw new TypeError("children must be an array");
  const nodes = [];
  for (const child of children) {
    if (child?.tag !== "ms-map-object") continue;
    const layout = child.data?.layout;
    if (!needsCameraRelativeFlowUpdates(layout)) continue;
    const next = objFlowViewAttrsForCamera(layout, camera.cameraX, camera.cameraY);
    const currentX = Number(child.attrs?.["world-x"]);
    const currentY = Number(child.attrs?.["world-y"]);
    const worldAttrs = {};
    if (next.worldX !== currentX) worldAttrs["world-x"] = decimalAttr(next.worldX);
    if (next.worldY !== currentY) worldAttrs["world-y"] = decimalAttr(next.worldY);
    if (Object.keys(worldAttrs).length === 0) continue;
    nodes.push(Object.freeze({
      key: child.key,
      attrs: Object.freeze({ set: Object.freeze(worldAttrs) }),
    }));
  }
  return Object.freeze(nodes);
}
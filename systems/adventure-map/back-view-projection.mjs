/**
 * Camera-only RenderNode updates for ms-map-back hosts with layout metadata.
 */
import { backViewAttrsForCamera } from "../../components/ms-map-adapter/src/back-layout.mjs";

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function needsCameraRelativeBackUpdates(layout) {
  if (!layout || typeof layout !== "object") return false;
  return layout.pinToViewportX === true || layout.pinToViewportY === true;
}

/**
 * @param {ReadonlyArray<object>} children ms-scene-view paint unit children
 * @param {{ cameraX: number, cameraY: number }} camera
 * @returns {ReadonlyArray<{key: string, attrs: { set: object }}>}
 */
export function projectBackCameraUpdates(children, camera) {
  if (!Array.isArray(children)) throw new TypeError("children must be an array");
  const nodes = [];
  for (const child of children) {
    if (child?.tag !== "ms-map-back") continue;
    const layout = child.data?.layout;
    if (!needsCameraRelativeBackUpdates(layout)) continue;
    const next = backViewAttrsForCamera(layout, camera.cameraX, camera.cameraY);
    const currentX = Number(child.attrs?.["view-x"]);
    const currentY = Number(child.attrs?.["view-y"]);
    const viewAttrs = {};
    if (next.viewX !== currentX) viewAttrs["view-x"] = decimalAttr(next.viewX);
    if (next.viewY !== currentY) viewAttrs["view-y"] = decimalAttr(next.viewY);
    if (Object.keys(viewAttrs).length === 0) continue;
    nodes.push(Object.freeze({
      key: child.key,
      attrs: Object.freeze({ set: Object.freeze(viewAttrs) }),
    }));
  }
  return Object.freeze(nodes);
}

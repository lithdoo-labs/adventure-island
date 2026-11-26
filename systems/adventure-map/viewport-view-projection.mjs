/**
 * Viewport-bounded relayout for ms-map-back type 1-4 and ms-map-object flow=1 only.
 * Camera counter-position and local Canvas geometry change; Content identity stays put.
 */
import { layoutBackView, backViewAttrsForCamera, SUPPORTED_BACK_LAYOUT_TYPES } from "../../components/ms-map-adapter/src/back-layout.mjs";
import { layoutObjFlowView, SUPPORTED_OBJ_FLOW_VALUES } from "../../components/ms-map-adapter/src/obj-flow.mjs";
import { assertViewportRelayoutEnvelope } from "../../components/ms-map-adapter/src/viewport-envelope.mjs";

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function layoutDependsOnViewport(layout) {
  if (!layout || typeof layout !== "object") return false;
  return layout.pinToViewportX === true || layout.pinToViewportY === true;
}

function shallowLayoutChanged(before, after) {
  if (before === after) return false;
  if (!before || !after) return before !== after;
  return before.canvasWidth !== after.canvasWidth
    || before.canvasHeight !== after.canvasHeight
    || before.viewportWidth !== after.viewportWidth
    || before.viewportHeight !== after.viewportHeight
    || before.tileOriginX !== after.tileOriginX
    || before.tileOriginY !== after.tileOriginY
    || before.tileStepX !== after.tileStepX
    || before.tileStepY !== after.tileStepY;
}

/**
 * @param {ReadonlyArray<object>} children
 * @param {{ width: number, height: number }} viewport
 * @param {{ cameraX: number, cameraY: number }} camera
 * @returns {ReadonlyArray<{key: string, attrs?: { set: object }, data?: { set: object }}>}
 */
export function projectViewportRelayoutUpdates(children, viewport, camera) {
  if (!Array.isArray(children)) throw new TypeError("children must be an array");
  const hasViewportTargets = children.some((child) => (
    (child?.tag === "ms-map-back"
      && layoutDependsOnViewport(child.data?.layout)
      && SUPPORTED_BACK_LAYOUT_TYPES.has(Number(child.data?.source?.type)))
    || (child?.tag === "ms-map-object"
      && layoutDependsOnViewport(child.data?.layout)
      && SUPPORTED_OBJ_FLOW_VALUES.has(Number(child.data?.source?.flow)))
  ));
  if (!hasViewportTargets) return Object.freeze([]);
  assertViewportRelayoutEnvelope(viewport);
  const nodes = [];
  for (const child of children) {
    if (child?.tag === "ms-map-back") {
      const layout = child.data?.layout;
      if (!layoutDependsOnViewport(layout)) continue;
      const type = Number(child.data?.source?.type);
      if (!SUPPORTED_BACK_LAYOUT_TYPES.has(type)) continue;
      const source = child.data.source;
      const laidOut = layoutBackView({
        type,
        bounds: { x: layout.worldLeft, y: layout.worldTop },
        placement: source,
        frameWidth: layout.frameWidth,
        frameHeight: layout.frameHeight,
        cameraX: camera.cameraX,
        cameraY: camera.cameraY,
        viewport,
      });
      const nextView = backViewAttrsForCamera(laidOut.layout, camera.cameraX, camera.cameraY);
      const attrs = {};
      const currentX = Number(child.attrs?.["view-x"]);
      const currentY = Number(child.attrs?.["view-y"]);
      if (nextView.viewX !== currentX) attrs["view-x"] = decimalAttr(nextView.viewX);
      if (nextView.viewY !== currentY) attrs["view-y"] = decimalAttr(nextView.viewY);
      const layoutChanged = shallowLayoutChanged(layout, laidOut.layout);
      if (!layoutChanged && Object.keys(attrs).length === 0) continue;
      const patch = { key: child.key };
      if (layoutChanged) patch.data = Object.freeze({ set: Object.freeze({ layout: laidOut.layout }) });
      if (Object.keys(attrs).length > 0) {
        patch.attrs = Object.freeze({ set: Object.freeze(attrs) });
      }
      nodes.push(Object.freeze(patch));
      continue;
    }
    if (child?.tag === "ms-map-object") {
      const flow = Number(child.data?.source?.flow);
      if (!SUPPORTED_OBJ_FLOW_VALUES.has(flow)) continue;
      const layout = child.data?.layout;
      if (!layoutDependsOnViewport(layout)) continue;
      const frames = child.data?.frames;
      const first = Array.isArray(frames) ? frames[0] : null;
      const frameWidth = layout.frameWidth ?? first?.image?.pageWidth ?? 0;
      const frameHeight = layout.frameHeight ?? first?.image?.pageHeight ?? 0;
      const laidOut = layoutObjFlowView({
        bounds: { x: layout.worldLeft, y: layout.worldTop },
        placement: child.data.source,
        frameWidth,
        frameHeight,
        anchorOffsetX: layout.anchorOffsetX,
        anchorOffsetY: layout.anchorOffsetY,
        cameraX: camera.cameraX,
        cameraY: camera.cameraY,
        viewport,
      });
      const attrs = {};
      const currentX = Number(child.attrs?.["world-x"]);
      const currentY = Number(child.attrs?.["world-y"]);
      if (laidOut.worldX !== currentX) attrs["world-x"] = decimalAttr(laidOut.worldX);
      if (laidOut.worldY !== currentY) attrs["world-y"] = decimalAttr(laidOut.worldY);
      const layoutChanged = shallowLayoutChanged(layout, laidOut.layout);
      if (!layoutChanged && Object.keys(attrs).length === 0) continue;
      const patch = { key: child.key };
      if (layoutChanged) patch.data = Object.freeze({ set: Object.freeze({ layout: laidOut.layout }) });
      if (Object.keys(attrs).length > 0) {
        patch.attrs = Object.freeze({ set: Object.freeze(attrs) });
      }
      nodes.push(Object.freeze(patch));
    }
  }
  return Object.freeze(nodes);
}

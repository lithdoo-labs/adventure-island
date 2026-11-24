/**
 * Flow objects on these maps are one animated sprite at the authored anchor.
 * OpenMS does not read flow, rx, or cx when placing objects. Tiling a missing
 * cx at the sprite width stamped each fish across the whole viewport.
 * flow=2/3 stays unsupported. rx is retained on the source and is not a scroll.
 */
import { BACK_LAYOUT_LIMITS } from "./back-layout.mjs";

/** FSDB-FACT on the 13-map scope: every flow placement uses flow=1 (horizontal bit). */
export const SUPPORTED_OBJ_FLOW_VALUES = new Set([1]);

function positiveFinite(value, fallback, name) {
  const candidate = value ?? fallback;
  if (!Number.isFinite(candidate) || candidate <= 0) {
    throw new TypeError(`${name} must be finite and positive`);
  }
  return Math.ceil(candidate);
}

function assertCanvasSize(width, height) {
  if (width > BACK_LAYOUT_LIMITS.maxCanvasWidth
    || height > BACK_LAYOUT_LIMITS.maxCanvasHeight
    || width * height > BACK_LAYOUT_LIMITS.maxCanvasPixels) {
    throw new RangeError("obj flow layout exceeds field canvas budget");
  }
}

/**
 * @param {object} row Obj placement row
 * @returns {string|null} diagnostic message when flow is unsupported; null when the M7.5 slice may resolve
 */
export function objFlowUnsupportedMessage(row) {
  if (!Object.prototype.hasOwnProperty.call(row, "flow")) return null;
  const flow = Number(row.flow);
  if (!Number.isFinite(flow) || flow === 0) return null;
  if (!SUPPORTED_OBJ_FLOW_VALUES.has(flow)) {
    return `obj flow mode ${flow} is not implemented`;
  }
  if ((flow & 2) !== 0) {
    return "obj flow vertical tiling is not implemented";
  }
  const rx = row.rx === undefined ? null : Number(row.rx);
  if (rx === null || !Number.isFinite(rx) || rx === 0) {
    return "obj flow horizontal scroll requires a non-zero rx";
  }
  return null;
}

export function objFlowViewAttrsForCamera(layout, cameraX, cameraY) {
  if (!layout || typeof layout !== "object") throw new TypeError("layout is required");
  if (!Number.isFinite(cameraX) || !Number.isFinite(cameraY)) {
    throw new TypeError("camera coordinates must be finite");
  }
  return Object.freeze({
    worldX: layout.pinToViewportX ? cameraX : layout.worldLeft,
    worldY: layout.pinToViewportY ? cameraY : layout.worldTop,
  });
}

/**
 * One sprite at the placement anchor. The anchor offsets recover authored
 * (x, y) from the origin-adjusted bounds. No viewport tile and no rx scroll.
 */
export function layoutObjFlowView({
  bounds,
  placement,
  frameWidth,
  frameHeight,
  anchorOffsetX,
  anchorOffsetY,
}) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) {
    throw new TypeError("obj flow layout requires finite bounds");
  }
  const flow = Number(placement.flow);
  if (!Number.isFinite(flow)) throw new TypeError("obj flow layout requires a numeric flow");
  const sourceW = positiveFinite(frameWidth, null, "frameWidth");
  const sourceH = positiveFinite(frameHeight, null, "frameHeight");
  if (!Number.isFinite(anchorOffsetX) || !Number.isFinite(anchorOffsetY)) {
    throw new TypeError("obj flow layout requires finite anchor offsets");
  }
  assertCanvasSize(sourceW, sourceH);
  return Object.freeze({
    worldX: bounds.x + anchorOffsetX,
    worldY: bounds.y + anchorOffsetY,
    canvasWidth: sourceW,
    canvasHeight: sourceH,
    layout: null,
  });
}

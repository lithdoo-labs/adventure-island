/**
 * CMS079-PROVEN Obj flow=1 horizontal tiling shares 0x66A8D5 mode bit0 with Back type1.
 * Bounded M7.5 product slice: flow=1 only, rx scroll interval 20000/|rx|, zero cx/cy → frame size step.
 */
import {
  BACK_LAYOUT_LIMITS,
  authoredTileStep,
  scrollPixelsPerMs,
} from "./back-layout.mjs";

/** FSDB-FACT on the 13-map scope: every flow placement uses flow=1 (horizontal bit). */
export const SUPPORTED_OBJ_FLOW_VALUES = new Set([1]);

const DEFAULT_VIEWPORT = Object.freeze({ width: 800, height: 600 });

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

export function objFlowPresentation(flow) {
  const bits = Number(flow);
  if ((bits & 1) !== 0) return "flow-horizontal";
  if ((bits & 2) !== 0) return "flow-vertical";
  return "static";
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
 * Viewport-bounded horizontal flow surface with optional authored rx scroll.
 */
export function layoutObjFlowView({
  bounds,
  placement,
  frameWidth,
  frameHeight,
  anchorOffsetX,
  anchorOffsetY,
  cameraX = 0,
  cameraY = 0,
  viewport = DEFAULT_VIEWPORT,
}) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) {
    throw new TypeError("obj flow layout requires finite bounds");
  }
  const flow = Number(placement.flow);
  const horizontal = (flow & 1) !== 0;
  const vertical = (flow & 2) !== 0;
  const sourceW = positiveFinite(frameWidth, null, "frameWidth");
  const sourceH = positiveFinite(frameHeight, null, "frameHeight");
  if (!Number.isFinite(anchorOffsetX) || !Number.isFinite(anchorOffsetY)) {
    throw new TypeError("obj flow layout requires finite anchor offsets");
  }
  if (!horizontal && !vertical) {
    return Object.freeze({
      worldX: bounds.x,
      worldY: bounds.y,
      canvasWidth: sourceW,
      canvasHeight: sourceH,
      layout: null,
    });
  }
  const vpW = positiveFinite(viewport?.width, DEFAULT_VIEWPORT.width, "viewport.width");
  const vpH = positiveFinite(viewport?.height, DEFAULT_VIEWPORT.height, "viewport.height");
  const stepX = horizontal
    ? (authoredTileStep(Number(placement.cx)) || sourceW)
    : 0;
  const stepY = vertical
    ? (authoredTileStep(Number(placement.cy)) || sourceH)
    : 0;
  const repeatX = horizontal && stepX > 0;
  const repeatY = vertical && stepY > 0;
  const canvasWidth = repeatX ? vpW : sourceW;
  const canvasHeight = repeatY ? vpH : sourceH;
  assertCanvasSize(canvasWidth, canvasHeight);
  const scrollRate = placement.rx === undefined ? null : scrollPixelsPerMs(Number(placement.rx));
  const layout = Object.freeze({
    kind: objFlowPresentation(flow),
    worldLeft: bounds.x,
    worldTop: bounds.y,
    canvasWidth,
    canvasHeight,
    frameWidth: sourceW,
    frameHeight: sourceH,
    anchorOffsetX,
    anchorOffsetY,
    tileStepX: stepX,
    tileStepY: stepY,
    tileHorizontal: repeatX,
    tileVertical: repeatY,
    pinToViewportX: repeatX,
    pinToViewportY: repeatY,
    tileOriginX: repeatX ? bounds.x % stepX : 0,
    tileOriginY: repeatY ? bounds.y % stepY : 0,
    scroll: scrollRate === null ? null : Object.freeze({ pixelsPerMs: scrollRate }),
  });
  const view = objFlowViewAttrsForCamera(layout, cameraX, cameraY);
  return Object.freeze({
    worldX: view.worldX,
    worldY: view.worldY,
    canvasWidth,
    canvasHeight,
    layout,
  });
}

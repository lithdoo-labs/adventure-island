/**
 * Candidate Back type 0-4 layout algebra.
 *
 * CMS079 proves the type axes, exact cx/cy steps, and type 4 scroll interval.
 * The viewport-sized local surface and viewport pinning are explicit M7.4
 * product decisions while the client +0x98 parallax function is unavailable.
 */

/** CMS079-VERIFIED: type 4/6 horizontal scroll interval divisor. */
export const BACK_SCROLL_MS_DIVISOR = 20_000;

/** Adapter-side fail-closed caps; the renderer independently validates them. */
export const BACK_LAYOUT_LIMITS = Object.freeze({
  maxCanvasWidth: 2_048,
  maxCanvasHeight: 2_048,
  maxCanvasPixels: 4_194_304,
});

export const SUPPORTED_BACK_LAYOUT_TYPES = new Set([0, 1, 2, 3, 4]);

const DEFAULT_VIEWPORT = Object.freeze({ width: 800, height: 600 });

export function backLayoutUnsupportedMessage(type) {
  if (SUPPORTED_BACK_LAYOUT_TYPES.has(type)) return null;
  return `back type ${type} layout is not implemented`;
}

/** CMS079-VERIFIED mode axes. */
export function backTileAxes(type) {
  switch (type) {
    case 1:
    case 4:
      return Object.freeze({ horizontal: true, vertical: false });
    case 2:
      return Object.freeze({ horizontal: false, vertical: true });
    case 3:
      return Object.freeze({ horizontal: true, vertical: true });
    default:
      return Object.freeze({ horizontal: false, vertical: false });
  }
}

export function backPresentation(type) {
  if (type === 0) return "static-type0";
  if (type === 1) return "tile-horizontal";
  if (type === 2) return "tile-vertical";
  if (type === 3) return "tile-both";
  if (type === 4) return "scroll-horizontal";
  return "layout-pending";
}

/** cx/cy=0 remains zero and therefore disables repetition on that axis. */
export function authoredTileStep(authored) {
  if (!Number.isSafeInteger(authored) || authored <= 0) return 0;
  return authored;
}

export function scrollPixelsPerMs(rx) {
  if (!Number.isFinite(rx) || rx === 0) return null;
  const intervalMs = BACK_SCROLL_MS_DIVISOR / Math.abs(rx);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  return (rx > 0 ? 1 : -1) / intervalMs;
}

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
    throw new RangeError("back layout exceeds field canvas budget");
  }
}

/**
 * Repeated axes use a viewport-sized surface. The host counter-follows Camera
 * on those axes, so the scene plane still owns the one authoritative Camera
 * transform while the Back remains screen-covering without a world Canvas.
 */
export function layoutBackView({
  type,
  bounds,
  placement,
  frameWidth,
  frameHeight,
  cameraX = 0,
  cameraY = 0,
  viewport = DEFAULT_VIEWPORT,
}) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) {
    throw new TypeError("back layout requires finite bounds");
  }
  const sourceW = positiveFinite(frameWidth, null, "frameWidth");
  const sourceH = positiveFinite(frameHeight, null, "frameHeight");
  const vpW = positiveFinite(viewport?.width, DEFAULT_VIEWPORT.width, "viewport.width");
  const vpH = positiveFinite(viewport?.height, DEFAULT_VIEWPORT.height, "viewport.height");
  const axes = backTileAxes(type);
  const stepX = axes.horizontal ? authoredTileStep(Number(placement.cx)) : 0;
  const stepY = axes.vertical ? authoredTileStep(Number(placement.cy)) : 0;
  const repeatX = axes.horizontal && stepX > 0;
  const repeatY = axes.vertical && stepY > 0;
  const canvasWidth = repeatX ? vpW : sourceW;
  const canvasHeight = repeatY ? vpH : sourceH;
  assertCanvasSize(canvasWidth, canvasHeight);

  const worldLeft = bounds.x;
  const worldTop = bounds.y;
  const scroll = type === 4 && repeatX ? scrollPixelsPerMs(Number(placement.rx)) : null;
  const layout = Object.freeze({
    kind: backPresentation(type),
    worldLeft,
    worldTop,
    canvasWidth,
    canvasHeight,
    frameWidth: sourceW,
    frameHeight: sourceH,
    tileStepX: stepX,
    tileStepY: stepY,
    tileHorizontal: repeatX,
    tileVertical: repeatY,
    pinToViewportX: repeatX,
    pinToViewportY: repeatY,
    tileOriginX: repeatX ? worldLeft % stepX : 0,
    tileOriginY: repeatY ? worldTop % stepY : 0,
    scroll: scroll === null ? null : Object.freeze({ pixelsPerMs: scroll }),
  });
  const view = backViewAttrsForCamera(layout, cameraX, cameraY);
  return Object.freeze({
    viewX: view.viewX,
    viewY: view.viewY,
    canvasWidth,
    canvasHeight,
    layout,
  });
}

/** Recompute only host coordinates; Canvas data and pixels stay retained. */
export function backViewAttrsForCamera(layout, cameraX, cameraY) {
  if (!layout || typeof layout !== "object") throw new TypeError("layout is required");
  if (!Number.isFinite(cameraX) || !Number.isFinite(cameraY)) {
    throw new TypeError("camera coordinates must be finite");
  }
  return Object.freeze({
    viewX: layout.pinToViewportX ? cameraX : layout.worldLeft,
    viewY: layout.pinToViewportY ? cameraY : layout.worldTop,
  });
}

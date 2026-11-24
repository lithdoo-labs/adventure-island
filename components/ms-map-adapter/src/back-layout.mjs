/**
 * Candidate Back type 0-4 layout algebra.
 *
 * CMS079 proves the type axes, exact cx/cy steps, and type 4 scroll interval.
 * The viewport-sized local surface and horizontal pinning are explicit M7.4
 * product decisions. Vertical placement uses the OpenMS-REFERENCE camera term
 * because the CMS079 +0x98 body is not in the game image.
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

/** Positive authored cx/cy. Zero is not a step; the repeat axis resolves it separately. */
export function authoredTileStep(authored) {
  if (!Number.isSafeInteger(authored) || authored <= 0) return 0;
  return authored;
}

/**
 * CMS079 0x66A970: a zero step on a repeating axis becomes
 * slotB8 + 1 - (1<<slot58). A scale-0 canvas makes that the frame size.
 * A positive authored step is kept exactly.
 */
export function resolvedRepeatStep(authored, frameSize) {
  const step = authoredTileStep(authored);
  if (step > 0) return step;
  if (!Number.isSafeInteger(frameSize) || frameSize <= 0) return 0;
  return frameSize;
}

/**
 * OpenMS-REFERENCE camera term for a background that is not autoscrolling
 * on that axis. center is the truncated camera top plus half the viewport.
 * The returned value is the screen shift from the authored edge:
 * half + trunc(center * rate / 100). rate -100 stays on the authored edge.
 */
export function parallaxScreenOffset(rate, cameraEdge, viewportExtent) {
  if (!Number.isInteger(rate)) return 0;
  if (!Number.isFinite(cameraEdge) || !Number.isSafeInteger(viewportExtent) || viewportExtent <= 0) return 0;
  const center = Math.trunc(cameraEdge) + Math.trunc(viewportExtent / 2);
  return Math.trunc(viewportExtent / 2) + Math.trunc((center * rate) / 100);
}

/**
 * World-space Y added to the authored top. The scene subtracts the camera.
 * Non-scrolling types add the center, then the truncated rate term.
 * Horizontal autoscroll (type 4) truncates the combined center term instead.
 * rate -100 leaves the host on the authored top in both forms.
 */
export function verticalParallaxOffset(ry, cameraY, viewportHeight, combined = false) {
  if (!Number.isInteger(ry)) return 0;
  if (!Number.isFinite(cameraY) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
  const centerY = Math.trunc(cameraY) + Math.trunc(viewportHeight / 2);
  if (combined) return Math.trunc((centerY * (ry + 100)) / 100);
  return centerY + Math.trunc((centerY * ry) / 100);
}

/**
 * Screen X of a horizontally repeated copy, including type 4 world lock.
 * Type 4 keeps rx as the scroll rate, so its X is authored left minus the
 * camera. Integrated scroll keeps its existing leftward sign. Other types
 * use the camera term. The host stays pinned, so this value is a screen X.
 * Returns null when this layout does not tile horizontally.
 */
export function horizontalScreenAnchor(layout, cameraX, scrollPixels = 0) {
  if (!layout?.tileHorizontal || !Number.isFinite(cameraX)) return null;
  const scroll = Number.isFinite(scrollPixels) ? Math.trunc(scrollPixels) : 0;
  if (layout.kind === "scroll-horizontal") {
    return layout.worldLeft - Math.trunc(cameraX) - scroll;
  }
  if (!Number.isInteger(layout.parallaxRx)) return null;
  return layout.worldLeft + parallaxScreenOffset(layout.parallaxRx, cameraX, layout.viewportWidth);
}

export function scrollPixelsPerMs(rx) {
  if (!Number.isFinite(rx) || rx === 0) return null;
  const intervalMs = BACK_SCROLL_MS_DIVISOR / Math.abs(rx);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  return (rx > 0 ? 1 : -1) / intervalMs;
}

function integerParallaxRate(value) {
  const rate = Number(value ?? 0);
  if (!Number.isInteger(rate)) {
    throw new TypeError("back parallax rate must be an integer");
  }
  return rate;
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
  const stepX = axes.horizontal ? resolvedRepeatStep(Number(placement.cx), sourceW) : 0;
  const stepY = axes.vertical ? resolvedRepeatStep(Number(placement.cy), sourceH) : 0;
  const repeatX = axes.horizontal && stepX > 0;
  const repeatY = axes.vertical && stepY > 0;
  const canvasWidth = repeatX ? vpW : sourceW;
  const canvasHeight = repeatY ? vpH : sourceH;
  assertCanvasSize(canvasWidth, canvasHeight);

  const worldLeft = bounds.x;
  const worldTop = bounds.y;
  const scroll = type === 4 && repeatX ? scrollPixelsPerMs(Number(placement.rx)) : null;
  const parallaxRx = type === 4 ? null : integerParallaxRate(placement.rx);
  const parallaxRy = integerParallaxRate(placement.ry);
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
    parallaxRx,
    parallaxRy: repeatY ? null : parallaxRy,
    viewportWidth: vpW,
    viewportHeight: vpH,
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
  const parallax = !layout.pinToViewportY && Number.isInteger(layout.parallaxRy)
    ? verticalParallaxOffset(
      layout.parallaxRy,
      cameraY,
      layout.viewportHeight,
      layout.kind === "scroll-horizontal",
    )
    : 0;
  let viewX = layout.pinToViewportX ? cameraX : layout.worldLeft;
  if (!layout.pinToViewportX && Number.isInteger(layout.parallaxRx)) {
    viewX = cameraX + layout.worldLeft + parallaxScreenOffset(layout.parallaxRx, cameraX, layout.viewportWidth);
  }
  return Object.freeze({
    viewX,
    viewY: layout.pinToViewportY ? cameraY : layout.worldTop + parallax,
  });
}

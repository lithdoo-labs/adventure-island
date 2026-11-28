/**
 * Back type 0-7 layout algebra.
 *
 * CMS079 proves the type axes, the cx/cy steps, and the +0x98 arguments:
 * type 0–3 pass (rx, ry); type 4 and 6 pass (0, ry+100); type 5 and 7 pass
 * (rx+100, 0). Type 4 and 6 scroll on rx, type 5 and 7 on ry. The distance
 * is the CMS 20000 divisor and the OpenMS 100px period. The +0x98 body is
 * not in the image. A repeated axis keeps a viewport-sized surface and a
 * pinned host. Rate -100 stays on the authored edge. Rate 0 stays on the
 * screen, which is how a type 4 cloud keeps floating while the map moves.
 */

/** CMS079 0x66A56E divisor. OpenMS 0063df23 travels 100px in trunc(divisor/|rx|) ms. */
export const BACK_SCROLL_MS_DIVISOR = 20_000;
export const BACK_SCROLL_DISTANCE_PX = 100;

/** Adapter-side fail-closed caps; the renderer independently validates them. */
export const BACK_LAYOUT_LIMITS = Object.freeze({
  maxCanvasWidth: 2_048,
  maxCanvasHeight: 2_048,
  maxCanvasPixels: 4_194_304,
});

export const SUPPORTED_BACK_LAYOUT_TYPES = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

const DEFAULT_VIEWPORT = Object.freeze({ width: 800, height: 600 });

export function backLayoutUnsupportedMessage(type) {
  if (SUPPORTED_BACK_LAYOUT_TYPES.has(type)) return null;
  return `back type ${type} layout is not implemented`;
}

/** CMS079-VERIFIED mode axes. Type 6 and 7 use mode 3, both axes. */
export function backTileAxes(type) {
  switch (type) {
    case 1:
    case 4:
      return Object.freeze({ horizontal: true, vertical: false });
    case 2:
    case 5:
      return Object.freeze({ horizontal: false, vertical: true });
    case 3:
    case 6:
    case 7:
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
  if (type === 5) return "scroll-vertical";
  if (type === 6) return "scroll-horizontal-both";
  if (type === 7) return "scroll-vertical-both";
  return "layout-pending";
}

function horizontalScrollKind(kind) {
  return kind === "scroll-horizontal" || kind === "scroll-horizontal-both";
}

function verticalScrollKind(kind) {
  return kind === "scroll-vertical" || kind === "scroll-vertical-both";
}

/** trunc(center * (rate + 100) / 100). Type 4/6 pass ry+100; type 5/7 pass rx+100. */
function combinedCameraTerm(rate, cameraEdge, viewportExtent) {
  const center = Math.trunc(cameraEdge) + Math.trunc(viewportExtent / 2);
  return Math.trunc((center * (rate + 100)) / 100);
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
 * Screen X of a horizontally repeated copy.
 * Type 4 and 6 use horizontal rate 0, then subtract the integrated rx offset.
 * scrollPixelsPerMs stores the opposite of the rate, so a positive rate moves
 * the picture toward +X. Type 5 and 7 tile with the rx+100 term and do not
 * scroll this axis. Other types use rx. The host stays pinned, so this value
 * is a screen X. Returns null when this layout does not tile horizontally.
 */
export function horizontalScreenAnchor(layout, cameraX, scrollPixels = 0) {
  if (!layout?.tileHorizontal || !Number.isFinite(cameraX)) return null;
  const scroll = Number.isFinite(scrollPixels) ? Math.trunc(scrollPixels) : 0;
  if (horizontalScrollKind(layout.kind)) {
    return layout.worldLeft + parallaxScreenOffset(0, cameraX, layout.viewportWidth) - scroll;
  }
  if (verticalScrollKind(layout.kind)) {
    if (!Number.isInteger(layout.parallaxRx)) return null;
    return layout.worldLeft
      + combinedCameraTerm(layout.parallaxRx, cameraX, layout.viewportWidth)
      - Math.trunc(cameraX);
  }
  if (!Number.isInteger(layout.parallaxRx)) return null;
  return layout.worldLeft + parallaxScreenOffset(layout.parallaxRx, cameraX, layout.viewportWidth);
}

/**
 * Screen Y of a vertically repeated copy. The host stays pinned, so this
 * value is a screen Y inside that surface. Rate -100 is worldTop - cameraY.
 * Type 5 and 7 use vertical rate 0 and subtract the integrated ry offset.
 * Type 6 uses the ry+100 term. Returns null when this layout does not tile
 * vertically.
 */
export function verticalScreenAnchor(layout, cameraY, scrollPixels = 0) {
  if (!layout?.tileVertical || !Number.isFinite(cameraY)) return null;
  if (!Number.isSafeInteger(layout.viewportHeight) || layout.viewportHeight <= 0) return null;
  const scroll = Number.isFinite(scrollPixels) ? Math.trunc(scrollPixels) : 0;
  if (verticalScrollKind(layout.kind)) {
    return layout.worldTop + parallaxScreenOffset(0, cameraY, layout.viewportHeight) - scroll;
  }
  if (horizontalScrollKind(layout.kind)) {
    if (!Number.isInteger(layout.parallaxRy)) return null;
    return layout.worldTop
      + combinedCameraTerm(layout.parallaxRy, cameraY, layout.viewportHeight)
      - Math.trunc(cameraY);
  }
  if (!Number.isInteger(layout.parallaxRy)) return null;
  return layout.worldTop + parallaxScreenOffset(layout.parallaxRy, cameraY, layout.viewportHeight);
}

export function scrollPixelsPerMs(rx) {
  if (!Number.isFinite(rx) || rx === 0) return null;
  const durationMs = Math.trunc(BACK_SCROLL_MS_DIVISOR / Math.abs(rx));
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) return null;
  const distance = rx > 0 ? -BACK_SCROLL_DISTANCE_PX : BACK_SCROLL_DISTANCE_PX;
  return distance / durationMs;
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
  const horizontalScroll = type === 4 || type === 6;
  const verticalScroll = type === 5 || type === 7;
  const scroll = horizontalScroll && repeatX
    ? scrollPixelsPerMs(Number(placement.rx))
    : verticalScroll && repeatY
      ? scrollPixelsPerMs(Number(placement.ry))
      : null;
  const parallaxRx = horizontalScroll ? null : integerParallaxRate(placement.rx);
  const parallaxRy = verticalScroll ? 0 : integerParallaxRate(placement.ry);
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
    parallaxRy,
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
      horizontalScrollKind(layout.kind),
    )
    : 0;
  let viewX = layout.pinToViewportX ? cameraX : layout.worldLeft;
  if (!layout.pinToViewportX && verticalScrollKind(layout.kind) && Number.isInteger(layout.parallaxRx)) {
    viewX = layout.worldLeft + combinedCameraTerm(layout.parallaxRx, cameraX, layout.viewportWidth);
  } else if (!layout.pinToViewportX && Number.isInteger(layout.parallaxRx)) {
    viewX = cameraX + layout.worldLeft + parallaxScreenOffset(layout.parallaxRx, cameraX, layout.viewportWidth);
  }
  return Object.freeze({
    viewX,
    viewY: layout.pinToViewportY ? cameraY : layout.worldTop + parallax,
  });
}

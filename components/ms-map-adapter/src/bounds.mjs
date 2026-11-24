/**
 * effectiveBounds projection (legacy MapScenePlanV1 VR inset rules).
 * FSDB does not store effectiveBounds; Adapter computes them.
 */
import { diagnose } from "./status.mjs";

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Camera rectangle for a map with no VR.
 * Extrema are inset 10px on x. Y is the foothold span lifted 360 and extended 110.
 * A reversed result is unusable and returns null.
 * @param {ReadonlyArray<{ x1: number, y1: number, x2: number, y2: number }> | null | undefined} footholds
 */
export function cameraRectFromFootholds(footholds) {
  if (!Array.isArray(footholds) || footholds.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const row of footholds) {
    const xs = [row?.x1, row?.x2];
    const ys = [row?.y1, row?.y2];
    if (![...xs, ...ys].every(finiteNumber)) return null;
    minX = Math.min(minX, xs[0], xs[1]);
    maxX = Math.max(maxX, xs[0], xs[1]);
    minY = Math.min(minY, ys[0], ys[1]);
    maxY = Math.max(maxY, ys[0], ys[1]);
  }
  const rect = {
    left: minX + 10,
    right: maxX - 10,
    top: minY - 360,
    bottom: maxY + 110,
  };
  if (rect.left > rect.right || rect.top > rect.bottom) return null;
  return Object.freeze(rect);
}

/** True when effectiveBounds is the 400×300 client inset of sourceBounds. */
export function isClientVrInset(source, effective) {
  if (!source || !effective) return false;
  const edges = [source.left, source.right, source.top, source.bottom, effective.left, effective.right, effective.top, effective.bottom];
  if (!edges.every(finiteNumber)) return false;
  const x = insetAxis(source.left, source.right, 400);
  const y = insetAxis(source.top, source.bottom, 300);
  return effective.left === x.left
    && effective.right === x.right
    && effective.top === y.left
    && effective.bottom === y.right;
}

function withCameraBounds(bounds, footholds) {
  const cameraBounds = cameraRectFromFootholds(footholds);
  if (!cameraBounds) return bounds;
  return Object.freeze({ ...bounds, cameraBounds });
}

function insetAxis(low, high, pad) {
  let left = low + pad;
  let right = high - pad;
  if (right - left <= 0) {
    const mid = (left + right) / 2;
    const truncated = mid < 0 ? Math.ceil(mid) : Math.floor(mid); // toward zero
    left = truncated;
    right = truncated;
  }
  return { left, right };
}

export function resolveBounds(map, footholds, mapId) {
  const diagnostics = [];
  const vr = map?.vr;
  if (
    vr
    && finiteNumber(vr.VRLeft)
    && finiteNumber(vr.VRTop)
    && finiteNumber(vr.VRRight)
    && finiteNumber(vr.VRBottom)
  ) {
    const sourceBounds = Object.freeze({
      left: vr.VRLeft,
      top: vr.VRTop,
      right: vr.VRRight,
      bottom: vr.VRBottom,
    });
    const x = insetAxis(sourceBounds.left, sourceBounds.right, 400);
    const y = insetAxis(sourceBounds.top, sourceBounds.bottom, 300);
    return {
      bounds: Object.freeze({
        source: "vr",
        adjustment: "client-vr-inset",
        sourceBounds,
        effectiveBounds: Object.freeze({
          left: x.left,
          top: y.left,
          right: x.right,
          bottom: y.right,
        }),
      }),
      diagnostics,
    };
  }

  const mini = map?.miniMap;
  if (
    mini
    && finiteNumber(mini.width)
    && finiteNumber(mini.height)
    && finiteNumber(mini.centerX)
    && finiteNumber(mini.centerY)
  ) {
    const sourceBounds = Object.freeze({
      left: -mini.centerX,
      top: -mini.centerY,
      right: mini.width - mini.centerX,
      bottom: mini.height - mini.centerY,
    });
    return {
      bounds: withCameraBounds(Object.freeze({
        source: "minimap",
        adjustment: "product-fallback",
        sourceBounds,
        effectiveBounds: sourceBounds,
      }), footholds),
      diagnostics,
    };
  }

  if (footholds.length > 0) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const row of footholds) {
      left = Math.min(left, row.x1, row.x2);
      right = Math.max(right, row.x1, row.x2);
      top = Math.min(top, row.y1, row.y2);
      bottom = Math.max(bottom, row.y1, row.y2);
    }
    const sourceBounds = Object.freeze({ left, top, right, bottom });
    const effectiveBounds = Object.freeze({
      left: left - 10,
      top: top - 360,
      right: right + 10,
      bottom: bottom + 110,
    });
    return {
      bounds: withCameraBounds(Object.freeze({
        source: "foothold",
        adjustment: "product-fallback",
        sourceBounds,
        effectiveBounds,
      }), footholds),
      diagnostics,
    };
  }

  diagnostics.push(diagnose("bounds-unavailable", "no VR, miniMap, or foothold bounds", { mapId }));
  return { bounds: null, diagnostics };
}

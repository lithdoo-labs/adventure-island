/**
 * effectiveBounds projection (legacy MapScenePlanV1 VR inset rules).
 * FSDB does not store effectiveBounds; Adapter computes them.
 */
import { diagnose } from "./status.mjs";

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
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
      bounds: Object.freeze({
        source: "minimap",
        adjustment: "product-fallback",
        sourceBounds,
        effectiveBounds: sourceBounds,
      }),
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
      bounds: Object.freeze({
        source: "foothold",
        adjustment: "product-fallback",
        sourceBounds,
        effectiveBounds,
      }),
      diagnostics,
    };
  }

  diagnostics.push(diagnose("bounds-unavailable", "no VR, miniMap, or foothold bounds", { mapId }));
  return { bounds: null, diagnostics };
}

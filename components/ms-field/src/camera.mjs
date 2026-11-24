/**
 * Camera presentation values for ms-scene-view (world-space top-left of viewport).
 *
 * Follow matches the OpenMS camera filter: the look point sits 50px above the
 * feet, the first sample snaps, and a later sample stays put while the error is
 * within 28px. Past that, coefficient 100 leaves a residual distance of
 * (scale * distance) / (elapsedMs * distance + scale), where scale is
 * coefficient * 1000. The clamp then runs once on that look point.
 *
 * The clamp rectangle is the raw map rectangle. A VR map's effectiveBounds is
 * already inset by a fixed 400×300, so the larger raw VR stays the clamp.
 * A map without VR may carry cameraBounds: the foothold rectangle inset by
 * 10px on x and expanded by 360/110 on y. That rectangle wins over the
 * published minimap or expanded foothold fallback.
 */

/** Look point is this far above the feet. Y grows downward. */
export const CAMERA_LOOK_OFFSET_Y = -50;

/** Axis error at or below this distance does not move the look point. */
export const CAMERA_FOLLOW_HOLD_PX = 28;

/** Distance/time damping. Not a millisecond constant. */
export const CAMERA_FOLLOW_COEFFICIENT = 100;

/**
 * @param {{ left: number, right: number, top: number, bottom: number } | null} rect
 */
function finiteRect(rect) {
  if (rect === null || typeof rect !== "object") return null;
  const { left, right, top, bottom } = rect;
  if (![left, right, top, bottom].every((edge) => Number.isFinite(edge))) return null;
  return rect;
}

/**
 * @param {object | null | undefined} bounds
 */
export function cameraClampRectangle(bounds) {
  if (bounds === null || bounds === undefined || typeof bounds !== "object") return null;
  const camera = finiteRect(bounds.cameraBounds);
  if (camera) return camera;
  const source = finiteRect(bounds.sourceBounds);
  const effective = finiteRect(bounds.effectiveBounds);
  if (source && effective) {
    const sourceSpan = (source.right - source.left) + (source.bottom - source.top);
    const effectiveSpan = (effective.right - effective.left) + (effective.bottom - effective.top);
    return sourceSpan >= effectiveSpan ? source : effective;
  }
  return source ?? effective ?? finiteRect(bounds);
}

/**
 * Look-point clamp on one axis. The returned value is the viewport origin.
 * A range smaller than the viewport centers on the midpoint of the edges.
 *
 * @param {number} position
 * @param {number} start
 * @param {number} end
 * @param {number} extent
 */
function cameraOrigin(position, start, end, extent) {
  const half = extent / 2;
  const low = start + half;
  const high = end - half;
  const center = high <= low
    ? Math.trunc((low + high) / 2)
    : Math.min(Math.max(position, low), high);
  return Math.trunc(center - half);
}

/**
 * Integer look point above the feet.
 * @param {{ worldX: number, worldY: number }} player
 */
export function cameraLookTarget(player) {
  return {
    x: Math.trunc(player.worldX),
    y: Math.trunc(player.worldY + CAMERA_LOOK_OFFSET_Y),
  };
}

/**
 * One follow sample. An uninitialized filter snaps. Later samples keep history.
 * @param {object | null | undefined} follow
 * @param {{ worldX: number, worldY: number }} player
 * @param {number} timeMs
 */
export function stepCameraFollow(follow, player, timeMs) {
  if (!Number.isFinite(timeMs)) throw new TypeError("camera follow time must be finite");
  const target = cameraLookTarget(player);
  const time = Math.trunc(timeMs);
  if (follow?.initialized !== true) {
    return Object.freeze({
      initialized: true,
      x: target.x,
      y: target.y,
      committedX: target.x,
      committedY: target.y,
      committedTimeMs: time,
    });
  }
  const elapsed = time - follow.committedTimeMs;
  const x = dampedAxis(target.x, follow.committedX, elapsed);
  const y = dampedAxis(target.y, follow.committedY, elapsed);
  return Object.freeze({
    initialized: true,
    x: Math.trunc(x),
    y: Math.trunc(y),
    committedX: x,
    committedY: y,
    committedTimeMs: time,
  });
}

/**
 * @param {number} target
 * @param {number} previous
 * @param {number} elapsedMs
 */
function dampedAxis(target, previous, elapsedMs) {
  const difference = target - previous;
  const distance = Math.abs(difference);
  let remaining = distance;
  if (distance > CAMERA_FOLLOW_HOLD_PX) {
    const scale = CAMERA_FOLLOW_COEFFICIENT * 1000;
    const denominator = elapsedMs * distance + scale;
    remaining = denominator === 0 ? distance : Math.max(0, (scale * distance) / denominator);
  }
  return difference < 0 ? target + remaining : target - remaining;
}

/**
 * Clamp a look point to the viewport top-left. `player` here is that look
 * point, already offset and filtered, expressed as worldX/worldY.
 * @param {{ worldX: number, worldY: number }} player
 * @param {{ width?: number, height?: number } | null} viewport
 * @param {object | null | undefined} bounds sourceBounds and/or effectiveBounds, or a bare rectangle
 */
export function cameraForViewport(player, viewport, bounds) {
  const width = viewport?.width;
  const height = viewport?.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { cameraX: player.worldX, cameraY: player.worldY };
  }
  const box = cameraClampRectangle(bounds);
  if (!box) {
    return {
      cameraX: player.worldX - width / 2,
      cameraY: player.worldY - height / 2,
    };
  }
  return {
    cameraX: cameraOrigin(player.worldX, box.left, box.right, width),
    cameraY: cameraOrigin(player.worldY, box.top, box.bottom, height),
  };
}

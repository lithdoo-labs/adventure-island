/**
 * Spike-only budgets for the M1 synthetic scene.
 * These numbers are not an approved product Canvas or coordinate policy.
 */
export const SPIKE_CANVAS_LIMITS = Object.freeze({
  maxDevicePixelRatio: 4,
  maxCanvasWidth: 256,
  maxCanvasHeight: 256,
  maxCanvasPixels: 65_536,
});

export const SPIKE_INPUT_LIMITS = Object.freeze({
  maxCoordinate: 1_000_000,
  maxPages: 8,
  maxItems: 32,
  maxPlacements: 32,
  maxIdLength: 128,
  maxMapIdLength: 12,
  stackRankMax: 2_147_483_646,
});

export const SPIKE_MARKER_TAG = "ms-synthetic-marker";
export const SPIKE_SCENE_CHILD_TAGS = Object.freeze(["ms-map-batch", "ms-world-item"]);

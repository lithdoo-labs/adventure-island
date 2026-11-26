/**
 * M3 field scene input and Canvas budgets (candidate / not product ABI).
 */
export const FIELD_CANVAS_LIMITS = Object.freeze({
  maxDevicePixelRatio: 4,
  maxCanvasWidth: 2048,
  maxCanvasHeight: 2048,
  maxCanvasPixels: 4_194_304,
  // Sliding one extra tile must stay inside the M7.1 water-map local canvas
  // ceiling (portal-budgets maxWaterMapLocalCanvasPixels). The 1028×720 route
  // viewport plus a 100×99 tile is 1128×819 and fails that gate.
  maxSlidingBackPixels: 900_000,
});

export const FIELD_INPUT_LIMITS = Object.freeze({
  maxCoordinate: 1_000_000,
  maxPages: 64,
  maxItems: 512,
  maxPlacements: 512,
  maxObjectFrames: 128,
  maxIdLength: 256,
  maxMapIdLength: 12,
  stackRankMax: 2_147_483_646,
});

export const MS_AVATAR_TAG = "ms-avatar";
export const MS_ACTION_TAG = "ms-action";

export const FIELD_SCENE_CHILD_TAGS = Object.freeze([
  "ms-map-back",
  "ms-map-batch",
  "ms-map-object",
  "ms-portal-visual",
  "ms-world-item",
]);

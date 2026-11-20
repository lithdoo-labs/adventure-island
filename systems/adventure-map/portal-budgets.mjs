/** M6 enforcement ceilings, measured on the canonical 222000001 target scene. */
export const M6_PORTAL_BUDGETS = Object.freeze({
  publishedMapResourceUnion: 178,
  maxTargetVisualCanvases: 16,
  maxTargetCanvasWidth: 512,
  maxTargetCanvasHeight: 1_024,
  maxTargetCanvasPixels: 250_000,
  maxTargetTotalCanvasPixels: 1_000_000,
  maxTargetFieldPlanResourceClosure: 32,
  maxTargetProjectionMs: 2_000,
  maxBrowserTravelReadyMs: 30_000,
});

/** M7.1 additive ceilings (do not relax M3/M6 canonical map222000000 budgets). */
export const M7_PORTAL_BUDGETS = Object.freeze({
  publishedMapResourceUnion: 286,
  maxTriFieldPlanProjectionMs: 4_000,
  maxWaterMapVisualCanvases: 200,
  maxWaterMapCanvasWidth: 2_500,
  maxWaterMapCanvasHeight: 900,
  maxWaterMapLocalCanvasPixels: 900_000,
  maxWaterMapTotalCanvasPixels: 12_000_000,
  maxWaterMapFieldPlanResourceClosure: 140,
  maxWaterMapFirstFramePaintResources: 100,
  maxWaterMapBrowserTravelReadyMs: 30_000,
});

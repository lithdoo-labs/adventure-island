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

/** M7.5 additive resource and Obj-flow ceilings; M7.1 ceilings above remain immutable evidence. */
export const M7_5_OBJ_FLOW_BUDGETS = Object.freeze({
  publishedMapResourceUnion: 322,
  maxWaterMapFieldPlanResourceClosure: 160,
  maxWaterMapObjFlowHosts: 11,
  maxWaterMapObjFlowHostWidth: 1_000,
  maxWaterMapObjFlowFrameResources: 48,
  maxContentReadConcurrency: 8,
});

/** Measured Node 2026-11-21 after M7.5 Obj flow (canonical 1000×700 viewport). */
export const M7_5_MEASURED_WATER_MAP_BUDGETS = Object.freeze({
  visualCanvases: 148,
  totalLocalPixels: 11_701_394,
  fieldPlanResourceClosure: 154,
  firstFramePaintResources: 91,
  fieldPlanVisualCanvases: 148,
  objFlowHosts: 11,
  objFlowFrameResources: 36,
});

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
  // Browser sum at the east00 stand (y=-94, 1000×700) measured 14,022,088 on 2026-11-24.
  maxWaterMapTotalCanvasPixels: 14_200_000,
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
  firstFramePaintResources: 98, // bare-character count plus the seven outfit atlases
  fieldPlanVisualCanvases: 148,
  objFlowHosts: 11,
  objFlowFrameResources: 36,
});

/** M7.6 additive viewport relayout + soak ceilings; M7.1–M7.5 gates remain immutable evidence. */
export const M7_6_VIEWPORT_BUDGETS = Object.freeze({
  maxViewportRelayoutCycles: 6,
  maxWaterMapTotalLocalPixelsAtSmallViewport: 13_000_000,
  maxWaterMapRelayoutPaintCommitsDelta: 150,
  maxWaterMapRelayoutResourceReads: 0,
  maxDetachedCanvasDelta: 0,
  maxDomNodeCount: 500,
  maxEventLoopLagProxyMs: 250,
  /** Deterministic proxy when performance.measureUserAgentSpecificMemory is unavailable. */
  maxHeapDomProxyScore: 20_000,
  maxHeapDomProxyDelta: 0,
});

/** M7.7 additive Back animation ceilings; M7.1–M7.6 gates remain immutable evidence. */
export const M7_7_BACK_ANIM_BUDGETS = Object.freeze({
  publishedMapResourceUnion: 351,
  maxWaterMapFieldPlanResourceClosure: 200,
  maxWaterMapBackAnimHosts: 21,
  maxWaterMapBackAnimFrameResources: 80,
  maxWaterMapBrowserReadyPaintResources: 140,
  maxContentReadConcurrency: 8,
  maxWaterMapProjectionMs: 2_000,
  maxWaterMapBrowserReadyMs: 30_000,
});

/** Measured Node 2026-11-21 after M7.7 Back animation slice (canonical 1000×700 viewport). */
export const M7_7_MEASURED_WATER_MAP_BUDGETS = Object.freeze({
  visualCanvases: 148,
  totalLocalPixels: 13_722_892,
  mapResourceClosure: 183,
  fieldPlanResourceClosure: 194, // map resources plus the clothed avatar atlases
  firstFramePaintResources: 98,
  browserReadyMapPaintResources: 116,
  browserReadyFieldPaintResources: 127,
  backAnimHosts: 21,
  backAnimFrameResources: 50,
});

/** Measured Node + Chromium 2026-11-21 after M7.6 bounded relayout soak (800↔1000 × 600↔700). */
export const M7_6_MEASURED_SOAK_BUDGETS = Object.freeze({
  maxWaterMapTotalLocalPixelsLarge: 11_701_394,
  maxWaterMapTotalLocalPixelsSmall: 11_347_794,
  browserLargeTotalPixels: 11_406_315,
  browserSmallTotalPixels: 11_250_000,
  relayoutHostsPerCycle: 23,
  soakCycles: 6,
});

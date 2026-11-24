/** CMS079-proven portal trigger half-extents (MAP-SCENE-PLAN-V1 §7). */
export const PORTAL_TRIGGER_HALF_X = 20;
export const PORTAL_TRIGGER_HALF_Y = 50;

export const PORTAL_LOGICAL_INDEX_MAX = 64;
export const DISABLED_TARGET_MAP = "999999999";

/** M6 product-enabled travel edges (name-level, not source-order). */
export const M6_ENABLED_PORTAL_EDGES = Object.freeze([
  Object.freeze({ mapId: "222000000", name: "in00" }),
  Object.freeze({ mapId: "222000001", name: "out00" }),
]);

/** M7 travel edges. 230030100 west00 stays disabled: its target map is unpublished. */
export const M7_ENABLED_PORTAL_EDGES = Object.freeze([
  ...M6_ENABLED_PORTAL_EDGES,
  Object.freeze({ mapId: "222000001", name: "sea00" }),
  Object.freeze({ mapId: "230030200", name: "east00" }),
  Object.freeze({ mapId: "230030200", name: "west00" }),
  Object.freeze({ mapId: "230030100", name: "east00" }),
]);

export function portalEdgeId(mapId, name) {
  return `${mapId}:${name}`;
}

export function isM7EnabledPortalEdge(mapId, name) {
  return M7_ENABLED_PORTAL_EDGES.some((edge) => edge.mapId === mapId && edge.name === name);
}

export function isM6EnabledPortalEdge(mapId, name) {
  return M6_ENABLED_PORTAL_EDGES.some((edge) => edge.mapId === mapId && edge.name === name);
}

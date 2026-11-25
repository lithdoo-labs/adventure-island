/** CMS079-proven portal trigger half-extents (MAP-SCENE-PLAN-V1 §7). */
export const PORTAL_TRIGGER_HALF_X = 20;
export const PORTAL_TRIGGER_HALF_Y = 50;

export const PORTAL_LOGICAL_INDEX_MAX = 64;
export const DISABLED_TARGET_MAP = "999999999";

export function portalEdgeId(mapId, name) {
  return `${mapId}:${name}`;
}

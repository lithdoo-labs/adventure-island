import { PORTAL_TRIGGER_HALF_X, PORTAL_TRIGGER_HALF_Y } from "./portal-constants.mjs";

/**
 * CMS079 / MAP-SCENE-PLAN-V1 fixed trigger box (Up-edge portals only).
 * @param {{ worldX: number, worldY: number }} player feet
 * @param {{ x: number, y: number }} portal
 */
export function playerInPortalTriggerBox(player, portal) {
  const px = player.worldX;
  const py = player.worldY;
  return px >= portal.x - PORTAL_TRIGGER_HALF_X
    && px <= portal.x + PORTAL_TRIGGER_HALF_X
    && py >= portal.y - PORTAL_TRIGGER_HALF_Y
    && py <= portal.y + PORTAL_TRIGGER_HALF_Y;
}

/**
 * @param {object} index portalLogicalIndex
 * @param {{ worldX: number, worldY: number }} player
 * @param {boolean} upEdge
 */
export function selectPortalTriggerCandidate(index, player, upEdge) {
  if (!upEdge || !index?.entries) return null;
  const matches = [];
  for (const portal of index.entries) {
    if (portal.type === 0) continue;
    if (!portal.enabled) continue;
    if (!playerInPortalTriggerBox(player, portal)) continue;
    matches.push(portal);
  }
  matches.sort((a, b) => a.sourceOrder - b.sourceOrder);
  return matches[0] ?? null;
}
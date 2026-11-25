import { PORTAL_TRIGGER_HALF_X, PORTAL_TRIGGER_HALF_Y } from "./portal-constants.mjs";

/** Nearby hidden-portal artwork. Right and bottom edges are excluded. */
export const PORTAL_REVEAL_HALF_X = 100;
export const PORTAL_REVEAL_HALF_Y = 50;

/**
 * @param {{ worldX: number, worldY: number }} player feet
 * @param {{ x: number, y: number }} portal
 */
export function playerInPortalRevealBox(player, portal) {
  const x = Math.trunc(player.worldX);
  const y = Math.trunc(player.worldY);
  return x >= portal.x - PORTAL_REVEAL_HALF_X
    && x < portal.x + PORTAL_REVEAL_HALF_X
    && y >= portal.y - PORTAL_REVEAL_HALF_Y
    && y < portal.y + PORTAL_REVEAL_HALF_Y;
}

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
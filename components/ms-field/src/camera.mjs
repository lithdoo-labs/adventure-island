/**
 * Camera presentation values for ms-scene-view (world-space top-left of viewport).
 */

/**
 * @param {{ worldX: number, worldY: number }} player
 * @param {{ width?: number, height?: number } | null} viewport
 * @param {{ effectiveBounds?: { left: number, right: number, top: number, bottom: number } } | null} bounds
 */
export function cameraForViewport(player, viewport, bounds) {
  const width = viewport?.width;
  const height = viewport?.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { cameraX: player.worldX, cameraY: player.worldY };
  }
  let cameraX = player.worldX - width / 2;
  let cameraY = player.worldY - height / 2;
  const box = bounds?.effectiveBounds;
  if (box && Number.isFinite(box.left) && Number.isFinite(box.right)) {
    const minX = box.left;
    const maxX = box.right - width;
    if (maxX >= minX) cameraX = Math.min(Math.max(cameraX, minX), maxX);
  }
  if (box && Number.isFinite(box.top) && Number.isFinite(box.bottom)) {
    const minY = box.top;
    const maxY = box.bottom - height;
    if (maxY >= minY) cameraY = Math.min(Math.max(cameraY, minY), maxY);
  }
  return { cameraX, cameraY };
}
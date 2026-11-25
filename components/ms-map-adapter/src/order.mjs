import { compareDrawOrder } from "./depth.mjs";

/**
 * ResolvedMapScene.drawables → OrderedDrawable[]
 * Only resolved, supported drawables enter the ordered paint sequence.
 * Unresolved entries remain available via scene.drawables for diagnostics.
 */
export function orderDrawables(scene, { includeUnresolved = false } = {}) {
  const selected = scene.drawables.filter((item) => {
    if (item.unsupported) return false;
    if (!includeUnresolved && !item.resolved) return false;
    return true;
  });
  const ordered = selected
    .map((item, index) => Object.freeze({
      ...item,
      orderIndex: index, // pre-sort audit index; replaced after sort
    }))
    .sort(compareDrawOrder)
    .map((item, index) => Object.freeze({
      stableId: item.stableId,
      sourceKind: item.sourceKind,
      sourceGroup: item.sourceGroup,
      sourceOrder: item.sourceOrder,
      mapId: item.mapId,
      worldX: item.worldX,
      worldY: item.worldY,
      sortKey: item.sortKey,
      tieKey: item.tieKey,
      sortKeySource: item.sortKeySource,
      updateClass: item.updateClass,
      front: item.front,
      layer: item.layer,
      bounds: item.bounds,
      flip: item.flip,
      opacity: item.opacity,
      resource: item.resource,
      frames: item.frames,
      clips: item.clips,
      placement: item.placement,
      flowPlacement: item.flowPlacement,
      presentation: item.presentation,
      visualName: item.visualName,
      portalStableId: item.portalStableId,
      orderIndex: index,
    }));
  return Object.freeze(ordered);
}

export function assertStrictlyIncreasingOrder(ordered) {
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const cmp = compareDrawOrder(prev, cur);
    if (cmp >= 0) {
      throw new Error(`non-increasing draw order at ${i}: ${prev.stableId} vs ${cur.stableId}`);
    }
  }
}

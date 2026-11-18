/**
 * World depth / sort-key formulas for M2 map projection.
 *
 * Sources:
 * - CMS079-PROVEN C-001 / C-002 / C-099
 * - OPENMS-REFERENCE Back formulas (GMS083); not CMS079-proven
 * - PRODUCT-DECISION: authored static equal-key tie uses sourceOrder
 */

export const DEPTH_BASE = -0x40000000; // -2^30 = -1073741824

/** CMS079-PROVEN C-001 */
export function tileSortKey(canvasZ, layer, zM) {
  return canvasZ + 10 * (layer * 3000 - zM) - 1073721834;
}

/** CMS079-PROVEN C-002 — placement z only */
export function objSortKey(layer, z) {
  return layer * 30000 + z - 1073739824;
}

/**
 * CMS079-PROVEN C-099 avatar insertion key.
 * flag!=0 → +5 controller term → {29992, 29997} family.
 */
export function avatarSortKey(layer, zM, flag = 0) {
  const controller = flag ? 5 : 0;
  return 10 * (layer * 3000 - zM) - 0x40000000 + 29990 + (2 + controller);
}

/**
 * OPENMS-REFERENCE GMS083 Back depth (not CMS079-proven).
 * front==0 → B - 128000 + index*1000
 * front!=0 → B + 272000 + index*1000
 */
export function backSortKey(sourceOrder, front) {
  const offset = front ? 272000 : -128000;
  return DEPTH_BASE + offset + sourceOrder * 1000;
}

/**
 * PRODUCT-DECISION (portal visual depth pending CMS079 evidence):
 * place portal visuals in a dedicated band above Front Back so they
 * remain deterministic and auditable without claiming CMS079 depth.
 */
export function portalVisualSortKey(sourceOrder) {
  return DEPTH_BASE + 300000 + sourceOrder;
}

export function compareDrawOrder(left, right) {
  if (left.sortKey !== right.sortKey) return left.sortKey < right.sortKey ? -1 : 1;
  if (left.tieKey !== right.tieKey) return left.tieKey < right.tieKey ? -1 : 1;
  if (left.stableId < right.stableId) return -1;
  if (left.stableId > right.stableId) return 1;
  return 0;
}

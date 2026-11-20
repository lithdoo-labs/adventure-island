/**
 * Resolve destination portal on target map by (tm, tn) → target index `pn` match.
 */

/**
 * @param {object} targetIndex validated portalLogicalIndex for destination map
 * @param {string} targetName tn from source portal (matches target pn)
 */
export function resolveTargetPortalByName(targetIndex, targetName) {
  if (typeof targetName !== "string" || targetName.length === 0) {
    return Object.freeze({ ok: false, code: "PORTAL_TARGET_NAME_EMPTY" });
  }
  const matches = targetIndex.entries.filter((entry) => entry.name === targetName);
  if (matches.length === 0) {
    return Object.freeze({ ok: false, code: "PORTAL_TARGET_MISSING" });
  }
  if (matches.length > 1) {
    return Object.freeze({ ok: false, code: "PORTAL_TARGET_DUPLICATE" });
  }
  return Object.freeze({ ok: true, portal: matches[0] });
}

/**
 * @param {object} sourcePortal entry from current map index
 * @param {object} targetIndex destination map portalLogicalIndex
 */
export function resolveTravelTarget(sourcePortal, targetIndex) {
  if (!sourcePortal?.enabled) {
    return Object.freeze({ ok: false, code: "PORTAL_SOURCE_DISABLED" });
  }
  if (String(sourcePortal.targetMap) !== targetIndex.mapId) {
    return Object.freeze({ ok: false, code: "PORTAL_TARGET_MAP_MISMATCH" });
  }
  return resolveTargetPortalByName(targetIndex, sourcePortal.targetName);
}
/**
 * M6 FieldPlan publishability gate for maps beyond bootstrap 222000000.
 * Does not relax M3 closure.ok for the bootstrap map.
 */

/** FSDB-FACT: single Back row on 222000001 has empty bS → unresolved back drawable. */
export const M6_222000001_KNOWN_UNRESOLVED_BACK = Object.freeze({
  mapId: "222000001",
  stableId: "back:map222000001:0",
  sourceKind: "back",
  sourceGroup: "back",
  sourceOrder: 0,
  emptyBackBranch: "",
});

const M6_EXTRA_PUBLISHABLE_MAP_IDS = new Set(["222000001"]);

/**
 * @param {string} mapId
 * @param {object} closure from validateContentClosure
 */
export function assertM6ExtraMapFieldPlanPublishable(mapId, closure) {
  if (!M6_EXTRA_PUBLISHABLE_MAP_IDS.has(mapId)) {
    throw new TypeError(`map ${mapId} is not an M6-approved extra FieldPlan publish target`);
  }
  if ((closure.missingResources?.length ?? 0) > 0) {
    throw new TypeError(`map ${mapId} has missing resources — not publishable`);
  }
  if ((closure.fatalDiagnostics?.length ?? 0) > 0) {
    throw new TypeError(`map ${mapId} has fatal diagnostics — not publishable`);
  }
  const unresolved = closure.unresolvedDrawables ?? [];
  if (mapId === M6_222000001_KNOWN_UNRESOLVED_BACK.mapId) {
    if (closure.ok === true) return;
    if (unresolved.length !== 1) {
      throw new TypeError(
        `map 222000001 must have exactly one known unresolved drawable (got ${unresolved.length})`,
      );
    }
    const only = unresolved[0];
    const known = M6_222000001_KNOWN_UNRESOLVED_BACK;
    if (only.stableId !== known.stableId) {
      throw new TypeError(`map 222000001 unexpected unresolved stableId ${only.stableId}`);
    }
    if (only.sourceKind !== known.sourceKind) {
      throw new TypeError(`map 222000001 unresolved must be back, got ${only.sourceKind}`);
    }
    if (only.sourceGroup !== known.sourceGroup) {
      throw new TypeError(`map 222000001 unresolved sourceGroup must be back`);
    }
    if (only.sourceOrder !== known.sourceOrder) {
      throw new TypeError(`map 222000001 unresolved back sourceOrder must be 0`);
    }
    if (only.placement?.bS !== known.emptyBackBranch) {
      throw new TypeError(`map 222000001 unresolved back must have the known empty bS source fact`);
    }
    if ((only.frames?.length ?? 0) !== 0 || only.resource !== null) {
      throw new TypeError(`map 222000001 unresolved back unexpectedly resolved visual content`);
    }
    return;
  }
  if (closure.ok !== true) {
    throw new TypeError(`map ${mapId} projection closure is not publishable`);
  }
}

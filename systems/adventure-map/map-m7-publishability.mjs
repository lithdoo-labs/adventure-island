/**
 * M7.1 FieldPlan publishability gate for map 230030200.
 * Does not relax M3 bootstrap or M6 map222000001 gates.
 */
import { assertM6ExtraMapFieldPlanPublishable } from "./map-m6-publishability.mjs";
import { UNSUPPORTED } from "../../components/ms-map-adapter/src/status.mjs";

/** FSDB-FACT: map 230030200 info.swim = 1 (validated at publish time). */
export const M7_230030200_SWIM_FACT = Object.freeze({ mapId: "230030200", swim: 1 });

/**
 * Presentation gaps audited on 230030200 — excluded from closure.ok but not hidden.
 * Full Back type1–4 repeat/parallax/auto-scroll and Obj flow visuals remain unsupported.
 */
export const M7_230030200_KNOWN_PRESENTATION_GAPS = Object.freeze({
  mapId: "230030200",
  unsupportedBackTypeLayouts: Object.freeze([1, 3, 4]),
  unsupportedObjFlowVisualCount: 11,
  minimapProductFallbackBounds: Object.freeze({
    left: -1928,
    top: -459,
    right: 636,
    bottom: 1058,
  }),
  /** Adapter closure resources not referenced by the static painted FieldPlan tree. */
  adapterOnlyResourceCount: 36,
  fieldPlanTreeResourceCount: 118,
  adapterClosureResourceCount: 154,
});

const M7_EXTRA_PUBLISHABLE_MAP_IDS = new Set(["230030200"]);
const EXPECTED_BACK_SOURCE_ORDERS = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 25, 29, 30,
]);
const EXPECTED_FLOW_SOURCE_ORDERS = Object.freeze([22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);

function sameNumbers(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function assertExactBounds(actual, expected) {
  for (const edge of ["left", "top", "right", "bottom"]) {
    if (actual?.[edge] !== expected[edge]) {
      throw new TypeError(`map 230030200 ${edge} bound drifted from the audited minimap fallback`);
    }
  }
}

/**
 * @param {string} mapId
 * @param {{closure: object, scene: object}} projection map adapter projection
 */
export function assertM7ExtraMapFieldPlanPublishable(mapId, projection) {
  if (!M7_EXTRA_PUBLISHABLE_MAP_IDS.has(mapId)) {
    throw new TypeError(`map ${mapId} is not an M7-approved extra FieldPlan publish target`);
  }
  const closure = projection?.closure;
  const scene = projection?.scene;
  if (!closure || !scene) {
    throw new TypeError(`map ${mapId} publishability requires the full adapter projection`);
  }
  if ((closure.missingResources?.length ?? 0) > 0) {
    throw new TypeError(`map ${mapId} has missing resources — not publishable`);
  }
  if ((closure.fatalDiagnostics?.length ?? 0) > 0) {
    throw new TypeError(`map ${mapId} has fatal diagnostics — not publishable`);
  }
  if ((closure.unresolvedDrawables?.length ?? 0) > 0) {
    throw new TypeError(`map ${mapId} has unresolved drawables — not publishable`);
  }
  if (closure.ok !== true) {
    throw new TypeError(`map ${mapId} projection closure is not publishable`);
  }
  if (scene.bounds?.source !== "minimap" || scene.bounds?.adjustment !== "product-fallback") {
    throw new TypeError(`map ${mapId} must use the audited minimap product-fallback bounds`);
  }
  assertExactBounds(scene.bounds.sourceBounds, M7_230030200_KNOWN_PRESENTATION_GAPS.minimapProductFallbackBounds);
  assertExactBounds(scene.bounds.effectiveBounds, M7_230030200_KNOWN_PRESENTATION_GAPS.minimapProductFallbackBounds);

  const unsupported = (scene.diagnostics ?? []).filter((item) => item.code === UNSUPPORTED);
  const backs = unsupported.filter((item) => /^back type [134] layout is not implemented/u.test(item.message));
  const flows = unsupported.filter((item) => item.message === "obj visual field unsupported (flow/r)");
  if (unsupported.length !== backs.length + flows.length) {
    throw new TypeError(`map ${mapId} has an unapproved unsupported diagnostic`);
  }
  if (!sameNumbers(backs.map((item) => item.sourceOrder), EXPECTED_BACK_SOURCE_ORDERS)
    || !backs.every((item) => item.stableId === `back:map${mapId}:${item.sourceOrder}`)) {
    throw new TypeError(`map ${mapId} Back presentation gaps drifted from the audited set`);
  }
  const backTypes = new Set(backs.map((item) => Number(item.message.match(/^back type (\d+)/u)?.[1])));
  if (!sameNumbers([...backTypes].sort(), [...M7_230030200_KNOWN_PRESENTATION_GAPS.unsupportedBackTypeLayouts])) {
    throw new TypeError(`map ${mapId} Back type set drifted from the audited set`);
  }
  if (!sameNumbers(flows.map((item) => item.sourceOrder), EXPECTED_FLOW_SOURCE_ORDERS)
    || !flows.every((item) => item.stableId === `obj:map${mapId}:${item.sourceOrder}`)) {
    throw new TypeError(`map ${mapId} Obj flow presentation gaps drifted from the audited set`);
  }
  if ((scene.resources?.length ?? -1) !== M7_230030200_KNOWN_PRESENTATION_GAPS.adapterClosureResourceCount) {
    throw new TypeError(`map ${mapId} adapter resource closure drifted from the audited count`);
  }
}

/**
 * Dispatch publishability checks for any non-bootstrap published map.
 * @param {string} mapId
 * @param {object} closure
 */
export function assertPublishedExtraMapFieldPlanPublishable(mapId, projection) {
  if (mapId === "222000001") {
    assertM6ExtraMapFieldPlanPublishable(mapId, projection?.closure ?? projection);
    return;
  }
  if (mapId === "230030200") {
    assertM7ExtraMapFieldPlanPublishable(mapId, projection);
    return;
  }
  throw new TypeError(`map ${mapId} has no extra-map publishability gate`);
}

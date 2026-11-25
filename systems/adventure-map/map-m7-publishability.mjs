/**
 * M7.1 FieldPlan publishability gate for map 230030200.
 * Does not relax M3 bootstrap or M6 map222000001 gates.
 */
import { assertM6ExtraMapFieldPlanPublishable } from "./map-m6-publishability.mjs";
import { UNSUPPORTED } from "../../components/ms-map-adapter/src/status.mjs";

/** FSDB-FACT: map 230030200 info.swim = 1 (validated at publish time). */
export const M7_230030200_SWIM_FACT = Object.freeze({ mapId: "230030200", swim: 1 });

/**
 * Audited 230030200 presentation facts for M7.5 Obj flow + M7.4 Back layout.
 */
export const M7_230030200_KNOWN_PRESENTATION_GAPS = Object.freeze({
  mapId: "230030200",
  unsupportedObjFlowVisualCount: 0,
  supportedObjFlowVisualCount: 11,
  minimapProductFallbackBounds: Object.freeze({
    left: -1928,
    top: -459,
    right: 636,
    bottom: 1058,
  }),
  adapterOnlyResourceCount: 0,
  fieldPlanTreeResourceCount: 190,
  adapterClosureResourceCount: 190,
  animatedBackVisualCount: 21,
});

const M7_EXTRA_PUBLISHABLE_MAP_IDS = new Set(["230030200"]);
const EXPECTED_BACK_TYPES = Object.freeze([
  3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 1, 4, 4, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 4, 1,
]);
const EXPECTED_REPEATED_BACK_SOURCE_ORDERS = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 25, 29, 30,
]);
const EXPECTED_OBJ_FLOW_SOURCE_ORDERS = Object.freeze([22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);

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

  const backNodes = (projection.projection?.root?.children ?? []).filter((node) => node.tag === "ms-map-back");
  const orderedBacks = [...backNodes].sort((a, b) => a.data.provenance.sourceOrder - b.data.provenance.sourceOrder);
  if (!sameNumbers(orderedBacks.map((node) => Number(node.data.source.type)), EXPECTED_BACK_TYPES)) {
    throw new TypeError(`map ${mapId} Back type facts drifted from the audited set`);
  }
  if (!sameNumbers(
    orderedBacks.filter((node) => node.data.layout?.tileHorizontal || node.data.layout?.tileVertical)
      .map((node) => node.data.provenance.sourceOrder),
    EXPECTED_REPEATED_BACK_SOURCE_ORDERS,
  )) {
    throw new TypeError(`map ${mapId} Back repeat source orders drifted from the audited set`);
  }
  if (orderedBacks.some((node) => {
    if (!node.data.layout) return true;
    if (node.data.mode === "local-animation") {
      return node.data.frames.some((frame) => (
        frame.image.pageWidth !== frame.image.source.w
        || frame.image.pageHeight !== frame.image.source.h
        || frame.offset[0] + frame.image.pageWidth > node.data.layout.frameWidth
        || frame.offset[1] + frame.image.pageHeight > node.data.layout.frameHeight
      ));
    }
    return node.data.layout.frameWidth !== node.data.image?.pageWidth
      || node.data.layout.frameHeight !== node.data.image?.pageHeight;
  })) {
    throw new TypeError(`map ${mapId} Back layout rewrote a resource dimension or escaped its local surface`);
  }

  const unsupported = (scene.diagnostics ?? []).filter((item) => item.code === UNSUPPORTED);
  if (unsupported.length > 0) {
    throw new TypeError(`map ${mapId} has an unapproved unsupported diagnostic: ${unsupported[0].message}`);
  }

  const flowObjects = (projection.projection?.root?.children ?? [])
    .filter((node) => node.tag === "ms-map-object" && node.data?.source?.flow === 1);
  if (!sameNumbers(
    flowObjects.map((node) => node.data.provenance.sourceOrder).sort((a, b) => a - b),
    EXPECTED_OBJ_FLOW_SOURCE_ORDERS,
  )) {
    throw new TypeError(`map ${mapId} Obj flow RenderNode facts drifted from the audited set`);
  }
  if (flowObjects.length !== M7_230030200_KNOWN_PRESENTATION_GAPS.supportedObjFlowVisualCount) {
    throw new TypeError(`map ${mapId} Obj flow publishable count drifted`);
  }
  const animatedBacks = orderedBacks.filter((node) => node.data?.mode === "local-animation");
  if (animatedBacks.length !== M7_230030200_KNOWN_PRESENTATION_GAPS.animatedBackVisualCount) {
    throw new TypeError(`map ${mapId} animated Back publishable count drifted`);
  }
  for (const node of animatedBacks) {
    if (!Array.isArray(node.data.frames) || node.data.frames.length < 2) {
      throw new TypeError(`map ${mapId} animated Back must publish ordered multi-frame data for ${node.key}`);
    }
    if (node.data.image !== undefined) {
      throw new TypeError(`map ${mapId} animated Back must not mix top-level image with frames for ${node.key}`);
    }
  }
  for (const node of flowObjects) {
    if (node.data.layout != null) {
      throw new TypeError(`map ${mapId} Obj flow layout drifted for ${node.key}`);
    }
    if (node.data.frames.length < 2) {
      throw new TypeError(`map ${mapId} Obj flow must publish a multi-frame sequence for ${node.key}`);
    }
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
/**
 * 230030100 is the west00 destination. Closure is complete: no missing
 * resources, fatal diagnostics, unresolved drawables, or unsupported visuals.
 * @param {string} mapId
 * @param {object} projection buildMapProjection result
 */
export function assertM7AquaLinkFieldPlanPublishable(mapId, projection) {
  if (mapId !== "230030100") {
    throw new TypeError(`map ${mapId} is not the aqua-road link FieldPlan`);
  }
  const closure = projection?.closure;
  if (!closure || closure.ok !== true) {
    throw new TypeError(`map ${mapId} projection closure is not publishable`);
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
  const unsupported = (projection.scene?.diagnostics ?? []).filter((item) => item.code === UNSUPPORTED);
  if (unsupported.length > 0) {
    throw new TypeError(`map ${mapId} has an unapproved unsupported diagnostic: ${unsupported[0].message}`);
  }
}

export function assertPublishedExtraMapFieldPlanPublishable(mapId, projection) {
  if (mapId === "222000001") {
    assertM6ExtraMapFieldPlanPublishable(mapId, projection?.closure ?? projection);
    return;
  }
  if (mapId === "230030200") {
    assertM7ExtraMapFieldPlanPublishable(mapId, projection);
    return;
  }
  if (mapId === "230030100") {
    assertM7AquaLinkFieldPlanPublishable(mapId, projection);
    return;
  }
  throw new TypeError(`map ${mapId} has no extra-map publishability gate`);
}

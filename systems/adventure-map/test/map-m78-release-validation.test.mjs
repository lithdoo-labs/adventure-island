import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import { summarizeProjectionCanvasBudget } from "../../../components/ms-field/test/canonical-budgets.mjs";
import {
  PUBLISHED_FIELD_PLAN_MAP_IDS,
  buildCanonicalAdventureFieldPlanContent,
} from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { buildCanonicalAdventurePwaContent } from "../../../scripts/pwa/build-installation-bundle.mjs";
import { FIELD_PLAN_NAMESPACE } from "../field-plan-model.mjs";
import { collectMapResourceRefsFromFieldTree } from "../../../scripts/pwa/collect-field-plan-map-resources.mjs";
import { DEFAULT_VIEWPORT_RANGE, resolveViewportFrame } from "../../../components/ms-viewport/src/layout.mjs";
import { resolveTravelTarget } from "../portal-target-resolve.mjs";
import { planCrossMapPortalCommit } from "../portal-transaction.mjs";
import { buildArrivalMovementState } from "../portal-arrival.mjs";
import { assertPublishedExtraMapFieldPlanPublishable } from "../map-m7-publishability.mjs";
import {
  M7_6_VIEWPORT_BUDGETS,
  M7_7_BACK_ANIM_BUDGETS,
  M7_7_MEASURED_WATER_MAP_BUDGETS,
  M7_8_MEASURED_RELEASE_BUDGETS,
  M7_8_RELEASE_VALIDATION_BUDGETS,
  M7_PORTAL_BUDGETS,
} from "../portal-budgets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const viewport = Object.freeze({ width: 1000, height: 700 });
const PUBLISHED_MAP_IDS = ["222000000", "222000001", "230030100", "230030200"];

function portalByName(index, name) {
  return index.entries.find((entry) => entry.name === name);
}

test("M7.8 budgets remain additive over M7.1–M7.7 immutable gates", () => {
  assert.ok(M7_8_RELEASE_VALIDATION_BUDGETS.publishedMapResourceUnion
    >= M7_7_BACK_ANIM_BUDGETS.publishedMapResourceUnion);
  assert.ok(M7_8_RELEASE_VALIDATION_BUDGETS.maxAquaLinkTotalLocalPixels
    >= M7_7_MEASURED_WATER_MAP_BUDGETS.totalLocalPixels);
  assert.ok(M7_8_RELEASE_VALIDATION_BUDGETS.maxReleaseSoakCycles
    >= M7_6_VIEWPORT_BUDGETS.maxViewportRelayoutCycles);
  assert.ok(M7_8_RELEASE_VALIDATION_BUDGETS.maxReleaseDomNodeCount
    >= M7_6_VIEWPORT_BUDGETS.maxDomNodeCount);
});

test("canonical PWA publishes four FieldPlan records and the M7.7 map resource union", async () => {
  const content = await buildCanonicalAdventurePwaContent({ gameRoot: repoRoot });
  const fieldRecords = content.entries.filter(
    (entry) => entry.kind === "record" && entry.namespace === FIELD_PLAN_NAMESPACE,
  );
  assert.equal(fieldRecords.length, PUBLISHED_FIELD_PLAN_MAP_IDS.length);
  const keys = new Set(fieldRecords.map((entry) => entry.key));
  for (const key of ["bootstrap", "map222000001", "map230030100", "map230030200"]) {
    assert.ok(keys.has(key), key);
  }
  const mapResources = content.entries.filter(
    (entry) => entry.kind === "resource" && entry.namespace === "resource.Map",
  );
  assert.ok(mapResources.length >= M7_8_RELEASE_VALIDATION_BUDGETS.publishedMapResourceUnion);
  assert.ok(mapResources.length >= M7_7_BACK_ANIM_BUDGETS.publishedMapResourceUnion);
});

test("each published map FieldPlan projects within M7.8 release ceilings", async (t) => {
  const started = performance.now();
  for (const mapId of PUBLISHED_MAP_IDS) {
    const { plan } = await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId });
    const projection = await buildMapProjection({ mapId, gameRoot: repoRoot, viewport });
    if (mapId !== "222000000") {
      assert.doesNotThrow(() => assertPublishedExtraMapFieldPlanPublishable(mapId, projection));
    } else {
      assert.equal(projection.closure.ok, true);
    }
    const budget = summarizeProjectionCanvasBudget(plan.root);
    const treeRefs = collectMapResourceRefsFromFieldTree(plan.root).length;
    t.diagnostic(`M7.8 ${mapId}: canvases=${budget.canvasCount} totalLocal=${budget.totalLocalPixels} closure=${treeRefs}`);
    if (mapId === "230030100") {
      assert.ok(budget.canvasCount <= M7_8_RELEASE_VALIDATION_BUDGETS.maxAquaLinkVisualCanvases);
      assert.ok(budget.totalLocalPixels <= M7_8_RELEASE_VALIDATION_BUDGETS.maxAquaLinkTotalLocalPixels);
      assert.ok(budget.fieldPlanResourceClosure
        <= M7_8_RELEASE_VALIDATION_BUDGETS.maxAquaLinkFieldPlanResourceClosure);
      assert.equal(budget.canvasCount, M7_8_MEASURED_RELEASE_BUDGETS.aquaLinkVisualCanvases);
    }
    if (mapId === "222000000") {
      assert.ok(budget.totalLocalPixels <= M7_8_RELEASE_VALIDATION_BUDGETS.maxBootstrapTotalLocalPixels);
      assert.ok(budget.fieldPlanResourceClosure
        <= M7_8_RELEASE_VALIDATION_BUDGETS.maxBootstrapFieldPlanResourceClosure);
    }
    if (mapId === "230030200") {
      assert.ok(budget.canvasCount <= M7_PORTAL_BUDGETS.maxWaterMapVisualCanvases);
      assert.ok(budget.totalLocalPixels <= M7_PORTAL_BUDGETS.maxWaterMapTotalCanvasPixels);
    }
  }
  const elapsed = performance.now() - started;
  assert.ok(elapsed <= M7_8_RELEASE_VALIDATION_BUDGETS.maxFourMapNodeProjectionMs);
  t.diagnostic(`M7.8 four-map Node projection ${elapsed.toFixed(1)}ms`);
});

test("four-map west00 graph commits B→C→aqua link→C→B without lowering velocity invariants", async () => {
  const plans = Object.freeze(Object.fromEntries(await Promise.all(PUBLISHED_MAP_IDS.map(async (mapId) => {
    const { plan } = await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId });
    return [mapId, plan];
  }))));
  const mapB = plans["222000001"];
  const mapC = plans["230030200"];
  const mapLink = plans["230030100"];
  const sea00 = portalByName(mapB.portalLogicalIndex, "sea00");
  const east00OnC = resolveTravelTarget(sea00, mapC.portalLogicalIndex).portal;
  const toLink = planCrossMapPortalCommit({
    sourcePlan: mapC,
    targetPlan: mapLink,
    fieldState: mapC.fieldState,
    movementState: buildArrivalMovementState(
      portalByName(mapC.portalLogicalIndex, "east00"),
      mapC.footholdCollisionPlan,
      { mapEnvironment: mapC.mapEnvironment },
    ),
    sourcePortal: portalByName(mapC.portalLogicalIndex, "west00"),
    targetPortal: resolveTravelTarget(
      portalByName(mapC.portalLogicalIndex, "west00"),
      mapLink.portalLogicalIndex,
    ).portal,
    viewport,
    travelToken: 1,
    nextSceneEpoch: 1,
  });
  assert.equal(toLink.fieldState.mapId, "230030100");
  assert.equal(toLink.movementState.medium, "water");
  assert.equal(toLink.movementState.velocityX, 0);
  assert.equal(toLink.movementState.velocityY, 0);
  const backToC = planCrossMapPortalCommit({
    sourcePlan: mapLink,
    targetPlan: mapC,
    fieldState: toLink.fieldState,
    movementState: toLink.movementState,
    sourcePortal: portalByName(mapLink.portalLogicalIndex, "east00"),
    targetPortal: resolveTravelTarget(
      portalByName(mapLink.portalLogicalIndex, "east00"),
      mapC.portalLogicalIndex,
    ).portal,
    viewport,
    travelToken: 2,
    nextSceneEpoch: 2,
  });
  assert.equal(backToC.fieldState.mapId, "230030200");
  const toB = planCrossMapPortalCommit({
    sourcePlan: mapC,
    targetPlan: mapB,
    fieldState: backToC.fieldState,
    movementState: backToC.movementState,
    sourcePortal: portalByName(mapC.portalLogicalIndex, "east00"),
    targetPortal: resolveTravelTarget(
      portalByName(mapC.portalLogicalIndex, "east00"),
      mapB.portalLogicalIndex,
    ).portal,
    viewport,
    travelToken: 3,
    nextSceneEpoch: 3,
  });
  assert.equal(toB.fieldState.mapId, "222000001");
  assert.equal(toB.movementState.medium, "land");
});

test("ms-viewport legal frame selection stays inside the documented 640×480…1280×720 envelope", () => {
  const samples = [
    [900, 650],
    [1920, 1080],
    [400, 900],
    [2000, 400],
  ];
  for (const [width, height] of samples) {
    const frame = resolveViewportFrame(width, height, DEFAULT_VIEWPORT_RANGE);
    assert.ok(frame.width >= DEFAULT_VIEWPORT_RANGE.minWidth);
    assert.ok(frame.width <= DEFAULT_VIEWPORT_RANGE.maxWidth);
    assert.ok(frame.height >= DEFAULT_VIEWPORT_RANGE.minHeight);
    assert.ok(frame.height <= DEFAULT_VIEWPORT_RANGE.maxHeight);
  }
});
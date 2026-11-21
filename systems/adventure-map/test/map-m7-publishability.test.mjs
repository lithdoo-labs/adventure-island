import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import {
  assertM7ExtraMapFieldPlanPublishable,
  M7_230030200_KNOWN_PRESENTATION_GAPS,
  M7_230030200_SWIM_FACT,
} from "../map-m7-publishability.mjs";
import { UNSUPPORTED } from "../../../components/ms-map-adapter/src/status.mjs";
import {
  assertM7WaterMapResourceBoundary,
  collectMapResourceRefsFromFieldTree,
} from "../../../scripts/pwa/collect-field-plan-map-resources.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("230030200 publishability allows closure.ok with no missing/fatal/unresolved", async () => {
  const projection = await buildMapProjection({ mapId: "230030200", gameRoot: repoRoot });
  assert.equal(projection.closure.ok, true);
  assert.equal(projection.closure.missingResources.length, 0);
  assert.equal(projection.closure.fatalDiagnostics.length, 0);
  assert.equal(projection.closure.unresolvedDrawables.length, 0);
  assert.doesNotThrow(() => assertM7ExtraMapFieldPlanPublishable("230030200", projection));
  const effective = projection.scene.bounds.effectiveBounds;
  assert.deepEqual(effective, M7_230030200_KNOWN_PRESENTATION_GAPS.minimapProductFallbackBounds);
});

test("230030200 documents Obj flow gaps only after M7.4 Back layout", async () => {
  const projection = await buildMapProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 800, height: 600 },
  });
  const diagnostics = projection.scene.diagnostics ?? [];
  const unsupported = diagnostics.filter((item) => item.code === UNSUPPORTED);
  const flowVisuals = unsupported.filter((item) => String(item.message).includes("flow"));
  const backUnsupported = unsupported.filter((item) => String(item.message).includes("back type"));
  assert.equal(backUnsupported.length, 0);
  assert.equal(flowVisuals.length, M7_230030200_KNOWN_PRESENTATION_GAPS.unsupportedObjFlowVisualCount);
  assert.equal(M7_230030200_SWIM_FACT.swim, 1);
});

test("230030200 FieldPlan tree resource closure is a documented subset of adapter closure", async () => {
  const built = await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "230030200" });
  const projection = await buildMapProjection({ mapId: "230030200", gameRoot: repoRoot });
  const treeRefs = collectMapResourceRefsFromFieldTree(built.plan.root);
  const adapterRefs = projection.scene.resources;
  assert.equal(treeRefs.length, M7_230030200_KNOWN_PRESENTATION_GAPS.fieldPlanTreeResourceCount);
  assert.equal(adapterRefs.length, M7_230030200_KNOWN_PRESENTATION_GAPS.adapterClosureResourceCount);
  assert.equal(
    adapterRefs.length - treeRefs.length,
    M7_230030200_KNOWN_PRESENTATION_GAPS.adapterOnlyResourceCount,
  );
  assert.doesNotThrow(() => assertM7WaterMapResourceBoundary(
    treeRefs,
    adapterRefs,
    projection.scene,
    "230030200 test boundary",
  ));
  const drifted = structuredClone(adapterRefs);
  drifted[drifted.length - 1] = {
    ...drifted[drifted.length - 1],
    key: "arbitrary/not-a-drawable-resource",
  };
  assert.throws(
    () => assertM7WaterMapResourceBoundary(treeRefs, drifted, projection.scene, "230030200 drift"),
    /omitted set|missing or mismatched/,
  );
});

test("230030200 publishability rejects Obj flow presentation-gap drift", async () => {
  const projection = await buildMapProjection({ mapId: "230030200", gameRoot: repoRoot });
  const candidate = structuredClone(projection);
  const unsupported = candidate.scene.diagnostics.find((item) => item.code === UNSUPPORTED);
  unsupported.stableId = "obj:map230030200:999";
  assert.throws(
    () => assertM7ExtraMapFieldPlanPublishable("230030200", candidate),
    /presentation gaps drifted|unapproved unsupported|Obj flow/,
  );
});

test("230030200 publishability rejects audited Back fact drift", async () => {
  const projection = await buildMapProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 800, height: 600 },
  });
  const candidate = structuredClone(projection);
  const back = candidate.projection.root.children.find((node) => node.tag === "ms-map-back");
  back.data.source.type = 2;
  assert.throws(
    () => assertM7ExtraMapFieldPlanPublishable("230030200", candidate),
    /Back type facts drifted/,
  );
});

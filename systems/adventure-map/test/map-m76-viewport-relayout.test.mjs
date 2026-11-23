import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import { CANONICAL_VIEWPORT_LARGE, CANONICAL_VIEWPORT_SMALL } from "../../../components/ms-map-adapter/src/viewport-envelope.mjs";
import { summarizeProjectionCanvasBudget } from "../../../components/ms-field/test/canonical-budgets.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { M7_5_OBJ_FLOW_BUDGETS, M7_5_MEASURED_WATER_MAP_BUDGETS, M7_6_VIEWPORT_BUDGETS, M7_6_MEASURED_SOAK_BUDGETS, M7_7_MEASURED_WATER_MAP_BUDGETS, M7_PORTAL_BUDGETS } from "../portal-budgets.mjs";
import { projectViewportRelayoutUpdates } from "../viewport-view-projection.mjs";
import { projectAdventureMapFieldSceneFromPlan } from "../field-scene-runtime.mjs";
import { planCrossMapPortalCommit } from "../portal-transaction.mjs";
import { createMovementState } from "../movement-sim.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("230030200 viewport relayout only touches bounded Back and flow Obj hosts", async () => {
  const atLarge = await buildMapProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: CANONICAL_VIEWPORT_LARGE,
  });
  const children = atLarge.projection.root.children;
  const relayout = projectViewportRelayoutUpdates(
    children,
    CANONICAL_VIEWPORT_SMALL,
    { cameraX: 100, cameraY: 50 },
  );
  assert.ok(relayout.length > 0);
  for (const node of relayout) {
    assert.ok(
      node.tag === undefined
        && (children.find((child) => child.key === node.key)?.tag === "ms-map-back"
          || children.find((child) => child.key === node.key)?.tag === "ms-map-object"),
      `unexpected relayout target ${node.key}`,
    );
    assert.ok(node.data?.set?.layout, `${node.key} must patch layout metadata only`);
    assert.equal(node.data.set.image, undefined);
  }
  const backs = relayout.filter((node) => children.find((c) => c.key === node.key)?.tag === "ms-map-back");
  const flows = relayout.filter((node) => children.find((c) => c.key === node.key)?.data?.source?.flow === 1);
  assert.equal(backs.length, 12);
  assert.equal(flows.length, 11);
  const sample = backs[0];
  assert.equal(sample.data.set.layout.canvasWidth, 800);
});

test("800x600 water map projection stays within immutable totals and M7.6 additive ceilings", async () => {
  const projection = await buildMapProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: CANONICAL_VIEWPORT_SMALL,
  });
  const summary = summarizeProjectionCanvasBudget(projection.projection.root);
  assert.ok(summary.canvasCount <= M7_PORTAL_BUDGETS.maxWaterMapVisualCanvases);
  assert.ok(summary.totalLocalPixels <= M7_PORTAL_BUDGETS.maxWaterMapTotalCanvasPixels);
  assert.ok(summary.totalLocalPixels <= M7_6_VIEWPORT_BUDGETS.maxWaterMapTotalLocalPixelsAtSmallViewport);
  assert.ok(summary.canvasCount <= M7_5_MEASURED_WATER_MAP_BUDGETS.fieldPlanVisualCanvases);
  const flowHosts = projection.projection.root.children.filter(
    (node) => node.tag === "ms-map-object" && node.data?.source?.flow === 1,
  );
  assert.ok(flowHosts.every((node) => node.data.layout.canvasWidth === 800));
  assert.ok(
    flowHosts.length <= M7_5_OBJ_FLOW_BUDGETS.maxWaterMapObjFlowHosts,
  );
});

test("canonical FieldPlan at 1000x700 preserves M7.6 evidence and stays inside the additive M7.7 total", async () => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030200",
  });
  const summary = summarizeProjectionCanvasBudget(plan.root);
  assert.equal(M7_6_MEASURED_SOAK_BUDGETS.maxWaterMapTotalLocalPixelsLarge, 11_701_394,
    "M7.6 measured evidence must remain immutable after additive animation work");
  assert.equal(summary.totalLocalPixels, M7_7_MEASURED_WATER_MAP_BUDGETS.totalLocalPixels);
  assert.equal(summary.canvasCount, M7_5_MEASURED_WATER_MAP_BUDGETS.fieldPlanVisualCanvases);
  assert.ok(summary.totalLocalPixels <= M7_PORTAL_BUDGETS.maxWaterMapTotalCanvasPixels);
});

test("first entry at 800x600 relayouts the published canonical FieldPlan immediately", async () => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030200",
  });
  const projected = projectAdventureMapFieldSceneFromPlan(plan, CANONICAL_VIEWPORT_SMALL);
  const viewportHosts = projected.root.children.filter((node) => (
    (node.tag === "ms-map-back" && node.data?.layout?.tileHorizontal)
    || (node.tag === "ms-map-object" && node.data?.source?.flow === 1)
  ));
  assert.equal(viewportHosts.length, 23);
  assert.ok(viewportHosts.every((node) => node.data.layout.canvasWidth === 800));
  assert.throws(
    () => projectAdventureMapFieldSceneFromPlan(plan, { width: 639, height: 600 }),
    RangeError,
  );
});

test("cross-map replace keeps viewport-sized water hosts at the live logical size", async () => {
  const source = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan;
  const target = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "230030200" })).plan;
  const sourcePortal = source.portalLogicalIndex.entries.find((entry) => (
    entry.enabled && String(entry.targetMap) === "230030200"
  ));
  const targetPortal = target.portalLogicalIndex.entries.find((entry) => entry.name === sourcePortal?.targetName);
  assert.ok(sourcePortal, "map 222000001 must publish an edge into the water map");
  assert.ok(targetPortal, "the water map must publish the arrival portal");
  const viewport = Object.freeze({ width: 996, height: 719 });
  const commit = planCrossMapPortalCommit({
    sourcePlan: source,
    targetPlan: target,
    fieldState: source.fieldState,
    movementState: createMovementState({
      worldX: source.fieldState.player.worldX,
      worldY: source.fieldState.player.worldY,
      segments: source.footholdCollisionPlan.segments,
    }),
    sourcePortal,
    targetPortal,
    viewport,
    travelToken: 2,
    nextSceneEpoch: 2,
  });
  const pinnedBacks = commit.renderRoot.children.filter((node) => (
    node.tag === "ms-map-back" && node.data?.layout?.tileHorizontal === true
  ));
  const pinnedFlows = commit.renderRoot.children.filter((node) => (
    node.tag === "ms-map-object" && node.data?.source?.flow === 1
  ));
  assert.equal(pinnedBacks.length, 12);
  assert.equal(pinnedFlows.length, 11);
  assert.ok(pinnedBacks.every((node) => node.data.layout.canvasWidth === viewport.width));
  assert.ok(pinnedFlows.every((node) => node.data.layout.canvasWidth === viewport.width));
});

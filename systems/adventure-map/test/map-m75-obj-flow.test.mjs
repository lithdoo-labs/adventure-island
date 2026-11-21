import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import { summarizeProjectionCanvasBudget } from "../../../components/ms-field/test/canonical-budgets.mjs";
import { RESOURCE_READ_CONCURRENCY } from "../../../components/ms-field/src/resource-read-pool.mjs";
import {
  assertM7ExtraMapFieldPlanPublishable,
  M7_230030200_KNOWN_PRESENTATION_GAPS,
} from "../map-m7-publishability.mjs";
import {
  M7_5_MEASURED_WATER_MAP_BUDGETS,
  M7_5_OBJ_FLOW_BUDGETS,
  M7_7_BACK_ANIM_BUDGETS,
  M7_7_MEASURED_WATER_MAP_BUDGETS,
  M7_PORTAL_BUDGETS,
} from "../portal-budgets.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { collectMapResourceRefsFromFieldTree } from "../../../scripts/pwa/collect-field-plan-map-resources.mjs";
import { projectObjFlowCameraUpdates } from "../obj-flow-view-projection.mjs";
import { UNSUPPORTED } from "../../../components/ms-map-adapter/src/status.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("230030200 publishability includes Obj flow after M7.5", async () => {
  const projection = await buildMapProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 1000, height: 700 },
  });
  assert.doesNotThrow(() => assertM7ExtraMapFieldPlanPublishable("230030200", projection));
  const unsupported = projection.scene.diagnostics.filter((item) => item.code === UNSUPPORTED);
  assert.equal(unsupported.length, 0);
  assert.equal(
    projection.projection.root.children.filter((node) => node.tag === "ms-map-object" && node.data?.source?.flow === 1).length,
    M7_230030200_KNOWN_PRESENTATION_GAPS.supportedObjFlowVisualCount,
  );
});

test("230030200 Obj flow stays within immutable canvas totals and additive M7.5 resource ceilings", async () => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030200",
  });
  const summary = summarizeProjectionCanvasBudget(plan.root);
  const flowNodes = plan.root.children.filter((node) => node.tag === "ms-map-object" && node.data?.source?.flow === 1);
  const flowFrameResources = new Set(flowNodes.flatMap((node) => node.data.frames.map((frame) => {
    const resource = frame.image.resource;
    return `${resource.namespace}\0${resource.key}\0${resource.contentVersion}`;
  })));
  assert.equal(flowNodes.length, M7_5_MEASURED_WATER_MAP_BUDGETS.objFlowHosts);
  assert.equal(summary.canvasCount, M7_5_MEASURED_WATER_MAP_BUDGETS.fieldPlanVisualCanvases);
  assert.equal(M7_5_MEASURED_WATER_MAP_BUDGETS.totalLocalPixels, 11_701_394,
    "M7.5 measured evidence must remain immutable after additive animation work");
  assert.equal(flowFrameResources.size, M7_5_MEASURED_WATER_MAP_BUDGETS.objFlowFrameResources);
  assert.equal(
    collectMapResourceRefsFromFieldTree(plan.root).length,
    M7_7_MEASURED_WATER_MAP_BUDGETS.mapResourceClosure,
  );
  assert.ok(summary.canvasCount <= M7_PORTAL_BUDGETS.maxWaterMapVisualCanvases);
  assert.ok(summary.totalLocalPixels <= M7_PORTAL_BUDGETS.maxWaterMapTotalCanvasPixels);
  assert.ok(summary.firstFramePaintResources <= M7_PORTAL_BUDGETS.maxWaterMapFirstFramePaintResources);
  assert.equal(summary.firstFramePaintResources, M7_5_MEASURED_WATER_MAP_BUDGETS.firstFramePaintResources);
  assert.ok(summary.browserReadyPaintResources <= M7_7_BACK_ANIM_BUDGETS.maxWaterMapBrowserReadyPaintResources);
  assert.equal(summary.browserReadyPaintResources, M7_7_MEASURED_WATER_MAP_BUDGETS.browserReadyFieldPaintResources);
  assert.ok(
    collectMapResourceRefsFromFieldTree(plan.root).length
      <= M7_7_BACK_ANIM_BUDGETS.maxWaterMapFieldPlanResourceClosure,
  );
  assert.ok(flowNodes.length <= M7_5_OBJ_FLOW_BUDGETS.maxWaterMapObjFlowHosts);
  assert.ok(flowFrameResources.size <= M7_5_OBJ_FLOW_BUDGETS.maxWaterMapObjFlowFrameResources);
  assert.equal(M7_5_OBJ_FLOW_BUDGETS.maxContentReadConcurrency, RESOURCE_READ_CONCURRENCY);
  assert.ok(flowNodes.every(
    (node) => node.data.layout.canvasWidth <= M7_5_OBJ_FLOW_BUDGETS.maxWaterMapObjFlowHostWidth,
  ));
});

test("camera updates move flow ms-map-object hosts without republishing data", () => {
  const child = Object.freeze({
    key: "obj:test:1",
    tag: "ms-map-object",
    attrs: Object.freeze({ "world-x": "0", "world-y": "40" }),
    data: Object.freeze({
      layout: Object.freeze({
        pinToViewportX: true,
        pinToViewportY: false,
        worldLeft: 10,
        worldTop: 40,
      }),
    }),
  });
  const nodes = projectObjFlowCameraUpdates([child], { cameraX: 25, cameraY: 10 });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].attrs.set["world-x"], "25");
  assert.equal(nodes[0].attrs.set["world-y"], undefined);
});

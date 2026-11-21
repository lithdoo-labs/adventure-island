import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import { UNSUPPORTED } from "../../../components/ms-map-adapter/src/status.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { summarizeProjectionCanvasBudget } from "../../../components/ms-field/test/canonical-budgets.mjs";
import { M7_PORTAL_BUDGETS } from "../portal-budgets.mjs";
import { projectBackCameraUpdates } from "../back-view-projection.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("230030200 has no unsupported Back type 1-4 diagnostics", async () => {
  const projection = await buildMapProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 800, height: 600 },
  });
  const backUnsupported = projection.scene.diagnostics.filter(
    (item) => item.code === UNSUPPORTED && /^back type/u.test(item.message),
  );
  assert.equal(backUnsupported.length, 0);
  const backs = projection.projection.root.children.filter((child) => child.tag === "ms-map-back");
  assert.equal(backs.length, 31);
  const typeCounts = new Map();
  for (const back of backs) {
    const type = Number(back.data?.source?.type);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    assert.ok(back.data?.layout, `${back.key} must carry layout metadata`);
    assert.notEqual(back.data.presentation, "layout-pending");
    assert.equal(back.data.image.pageWidth, back.data.layout.frameWidth,
      "resource page identity must not be replaced with local Canvas width");
  }
  assert.deepEqual(Object.fromEntries([...typeCounts].sort(([a], [b]) => a - b)), { 0: 10, 1: 12, 3: 1, 4: 8 });
  assert.equal(backs.filter((back) => back.data.layout.tileHorizontal).length, 12,
    "only four type1 and eight type4 rows have a non-zero authored cx");
  const zeroStepType3 = backs.find((back) => Number(back.data.source.type) === 3);
  assert.equal(zeroStepType3.data.layout.tileHorizontal, false);
  assert.equal(zeroStepType3.data.layout.tileVertical, false);
});

test("230030200 FieldPlan back layout stays within M7 canvas budgets", async () => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030200",
  });
  const summary = summarizeProjectionCanvasBudget(plan.root);
  const repeated = plan.root.children.filter((child) => child.tag === "ms-map-back" && child.data.layout?.tileHorizontal);
  assert.equal(repeated.length, 12);
  assert.ok(repeated.every((child) => child.data.layout.canvasWidth === 1_000),
    "canonical PWA Back surfaces must cover the bounded 1000px route viewport");
  assert.ok(summary.canvasCount <= M7_PORTAL_BUDGETS.maxWaterMapVisualCanvases);
  assert.ok(summary.maxWidth <= M7_PORTAL_BUDGETS.maxWaterMapCanvasWidth);
  assert.ok(summary.maxHeight <= M7_PORTAL_BUDGETS.maxWaterMapCanvasHeight);
  assert.ok(summary.maxLocalCanvasPixels <= M7_PORTAL_BUDGETS.maxWaterMapLocalCanvasPixels);
  assert.ok(summary.totalLocalPixels <= M7_PORTAL_BUDGETS.maxWaterMapTotalCanvasPixels);
});

test("back camera projection updates only view attrs", () => {
  const children = Object.freeze([
    Object.freeze({
      key: "back:test:0",
      tag: "ms-map-back",
      attrs: Object.freeze({ "view-x": "0", "view-y": "0" }),
      data: Object.freeze({
        layout: Object.freeze({
          kind: "tile-horizontal",
          worldLeft: 100,
          worldTop: 0,
          frameWidth: 32,
          frameHeight: 32,
          tileStepX: 800,
          tileStepY: 0,
          tileHorizontal: true,
          tileVertical: false,
          pinToViewportX: true,
          pinToViewportY: false,
        }),
      }),
    }),
  ]);
  const nodes = projectBackCameraUpdates(children, { cameraX: 50, cameraY: 0 });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].attrs.set["view-x"], "50");
  assert.equal(nodes[0].attrs.set["view-y"], undefined);
});

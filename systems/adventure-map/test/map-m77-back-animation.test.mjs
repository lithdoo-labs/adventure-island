import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import { SUPPORTED_BACK_LAYOUT_TYPES } from "../../../components/ms-map-adapter/src/back-layout.mjs";
import { UNSUPPORTED } from "../../../components/ms-map-adapter/src/status.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { collectMapResourceRefsFromFieldTree } from "../../../scripts/pwa/collect-field-plan-map-resources.mjs";
import { summarizeProjectionCanvasBudget } from "../../../components/ms-field/test/canonical-budgets.mjs";
import {
  M7_230030200_KNOWN_PRESENTATION_GAPS,
  assertM7ExtraMapFieldPlanPublishable,
} from "../map-m7-publishability.mjs";
import {
  M7_PORTAL_BUDGETS,
  M7_7_BACK_ANIM_BUDGETS,
  M7_7_MEASURED_WATER_MAP_BUDGETS,
} from "../portal-budgets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const THIRTEEN_MAP_IDS = Object.freeze([
  "222000000", "222000001", "230030200", "230030100", "230030000",
  "230020300", "230020200", "230020100", "230020000", "230000000",
  "230000001", "230000002", "230000003",
]);

test("13-map FSDB Back animation stays within type 0-4 with no extra unsupported Back diagnostics", async () => {
  let animatedPlacements = 0;
  for (const mapId of THIRTEEN_MAP_IDS) {
    const projection = await buildMapProjection({
      mapId,
      gameRoot: repoRoot,
      viewport: { width: 1000, height: 700 },
    });
    for (const row of projection.facts.groups.back.rows) {
      const type = Number(row.type);
      if (!SUPPORTED_BACK_LAYOUT_TYPES.has(type)) {
        throw new Error(`map ${mapId} carries unsupported Back type ${type}`);
      }
      if (Number(row.ani) !== 0) animatedPlacements += 1;
    }
    const backUnsupported = projection.scene.diagnostics.filter(
      (item) => item.code === UNSUPPORTED && /^back /iu.test(item.message),
    );
    assert.equal(backUnsupported.length, 0, `map ${mapId} must not emit unsupported Back diagnostics`);
  }
  assert.equal(animatedPlacements, 200, "audited 13-map scope carries 200 animated Back placements with ani=1");
});

test("230030200 animated backs publish multi-frame RenderNodes and stay within M7.7 budgets", async (t) => {
  const started = performance.now();
  const projection = await buildMapProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 1000, height: 700 },
  });
  const projectionMs = performance.now() - started;
  assert.ok(projectionMs <= M7_7_BACK_ANIM_BUDGETS.maxWaterMapProjectionMs);
  t.diagnostic(`M7.7 water map projection ${projectionMs.toFixed(1)}ms / ${M7_7_BACK_ANIM_BUDGETS.maxWaterMapProjectionMs}ms`);
  assert.doesNotThrow(() => assertM7ExtraMapFieldPlanPublishable("230030200", projection));
  const backs = projection.projection.root.children.filter((child) => child.tag === "ms-map-back");
  const animated = backs.filter((child) => child.data?.mode === "local-animation");
  assert.equal(animated.length, M7_230030200_KNOWN_PRESENTATION_GAPS.animatedBackVisualCount);
  assert.ok(
    animated.every((node) => node.data.frames.every((frame) => (
      frame.delay === null || (Number.isSafeInteger(frame.delay) && frame.delay >= 0)
    ))),
    "animated Back frames preserve authored delay without inventing missing timing",
  );
  assert.ok(animated.some((node) => node.data.frames.some((frame) => frame.delay === null)));
  const frameResources = new Set(animated.flatMap((node) => node.data.frames.map((frame) => {
    const resource = frame.image.resource;
    return `${resource.namespace}\0${resource.key}\0${resource.contentVersion}`;
  })));
  assert.ok(animated.length <= M7_7_BACK_ANIM_BUDGETS.maxWaterMapBackAnimHosts);
  assert.equal(frameResources.size, M7_7_MEASURED_WATER_MAP_BUDGETS.backAnimFrameResources);
  assert.ok(frameResources.size <= M7_7_BACK_ANIM_BUDGETS.maxWaterMapBackAnimFrameResources);
  const summary = summarizeProjectionCanvasBudget(projection.projection.root);
  assert.ok(summary.fieldPlanResourceClosure <= M7_7_BACK_ANIM_BUDGETS.maxWaterMapFieldPlanResourceClosure);
  assert.equal(summary.fieldPlanResourceClosure, M7_7_MEASURED_WATER_MAP_BUDGETS.mapResourceClosure);
  assert.ok(summary.totalLocalPixels <= M7_PORTAL_BUDGETS.maxWaterMapTotalCanvasPixels);
  assert.equal(summary.totalLocalPixels, M7_7_MEASURED_WATER_MAP_BUDGETS.totalLocalPixels);
  assert.equal(summary.browserReadyPaintResources, M7_7_MEASURED_WATER_MAP_BUDGETS.browserReadyMapPaintResources);
  const { plan } = await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "230030200" });
  const treeRefs = collectMapResourceRefsFromFieldTree(plan.root);
  assert.equal(treeRefs.length, M7_7_MEASURED_WATER_MAP_BUDGETS.mapResourceClosure);
  assert.equal(treeRefs.length, M7_230030200_KNOWN_PRESENTATION_GAPS.fieldPlanTreeResourceCount);
});

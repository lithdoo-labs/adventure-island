import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFieldProjection, stackRankOrder } from "../src/field-project.mjs";
import { validateFieldTree } from "../src/validate.mjs";
import { FIELD_MAP_222000000 } from "../src/field-state.mjs";
import { buildCanonicalAdventureAvatarContent } from "../../../scripts/pwa/read-adventure-fsdb.mjs";
import {
  CANONICAL_FIELD_BUDGETS,
  MEASURED_CANVAS_COUNT,
  MEASURED_MAX_CANVAS_HEIGHT,
  MEASURED_MAX_CANVAS_WIDTH,
  MEASURED_MAX_LOCAL_CANVAS_PIXELS,
  MEASURED_TOTAL_LOCAL_PIXELS,
  MEASURED_FIELD_PLAN_RESOURCE_CLOSURE,
  MEASURED_FIRST_FRAME_PAINT_RESOURCE_IDENTITIES,
  summarizeProjectionCanvasBudget,
} from "./canonical-budgets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// M6 extends FieldState.portalTravel with token/epoch/crossMap authority, so
// the exact hash intentionally differs from the M5-only schema baseline.
const FIELD_HASH_800X600 = "sha256:073874b5c5e683b42a0e5b28381ca826f457d11f9dbd7d3325d7f373769946c2";

test("canonical 222000000 Node projection: 297 paint units, player, exact ranks, canvas budgets", async () => {
  const started = performance.now();
  const { plan: avatarPlan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    viewport: { width: 800, height: 600 },
    avatarPlan,
  });
  const projectionMs = performance.now() - started;

  assert.ok(projectionMs < CANONICAL_FIELD_BUDGETS.maxProjectionMs,
    `projection took ${projectionMs.toFixed(1)}ms (budget ${CANONICAL_FIELD_BUDGETS.maxProjectionMs}ms)`);

  assert.equal(projection.fieldState.mapId, FIELD_MAP_222000000);
  assert.equal(validateFieldTree(projection.root).ok, true);
  assert.equal(projection.map.paintUnits.length, 297);
  assert.equal(projection.root.children.length, 298);
  assert.equal(projection.hash, FIELD_HASH_800X600);

  const mapChildKeys = projection.map.projection.root.children.map((child) => child.key);
  const fieldKeys = projection.root.children
    .filter((child) => child.key !== "player:adventure")
    .map((child) => child.key);
  assert.deepEqual(fieldKeys, mapChildKeys);
  assert.deepEqual(stackRankOrder(projection.root.children), projection.root.children.map((child) => child.key));

  for (let index = 0; index < projection.root.children.length; index += 1) {
    const expectedRank = index + 1;
    assert.equal(
      Number(projection.root.children[index].attrs["stack-rank"]),
      expectedRank,
      `stack-rank must be dense 1..${projection.root.children.length} at index ${index}`,
    );
  }

  const playerIndex = projection.root.children.findIndex((child) => child.key === "player:adventure");
  assert.ok(playerIndex > 0 && playerIndex < projection.root.children.length - 1,
    "player must sit between at least two static paint units");
  const beforeTag = projection.root.children[playerIndex - 1].tag;
  const afterTag = projection.root.children[playerIndex + 1].tag;
  const staticTags = new Set(["ms-map-back", "ms-map-batch", "ms-map-object", "ms-portal-visual"]);
  assert.ok(staticTags.has(beforeTag) && staticTags.has(afterTag));

  const summary = summarizeProjectionCanvasBudget(projection.root);
  assert.equal(summary.canvasCount, MEASURED_CANVAS_COUNT);
  assert.equal(summary.maxWidth, MEASURED_MAX_CANVAS_WIDTH);
  assert.equal(summary.maxHeight, MEASURED_MAX_CANVAS_HEIGHT);
  assert.equal(summary.maxLocalCanvasPixels, MEASURED_MAX_LOCAL_CANVAS_PIXELS);
  assert.equal(summary.totalLocalPixels, MEASURED_TOTAL_LOCAL_PIXELS);
  assert.equal(summary.fieldPlanResourceClosure, MEASURED_FIELD_PLAN_RESOURCE_CLOSURE);
  assert.equal(summary.firstFramePaintResources, MEASURED_FIRST_FRAME_PAINT_RESOURCE_IDENTITIES);
  assert.ok(summary.firstFramePaintResources < summary.fieldPlanResourceClosure,
    "first-frame paint must not pull the entire FieldPlan closure");

  assert.ok(summary.canvasCount <= CANONICAL_FIELD_BUDGETS.maxVisualCanvases);
  assert.ok(summary.maxWidth <= CANONICAL_FIELD_BUDGETS.maxCanvasWidth);
  assert.ok(summary.maxHeight <= CANONICAL_FIELD_BUDGETS.maxCanvasHeight);
  assert.ok(summary.maxLocalCanvasPixels <= CANONICAL_FIELD_BUDGETS.maxLocalCanvasPixels);
  assert.ok(summary.totalLocalPixels <= CANONICAL_FIELD_BUDGETS.maxTotalLocalPixels);
  assert.ok(summary.fieldPlanResourceClosure <= CANONICAL_FIELD_BUDGETS.maxFieldPlanResourceClosure);
  assert.ok(summary.firstFramePaintResources <= CANONICAL_FIELD_BUDGETS.maxFirstFrameUnderlyingReads);
});

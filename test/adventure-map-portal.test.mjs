import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAllCanonicalAdventureFieldPlans,
  buildCanonicalAdventureFieldPlanContent,
} from "../scripts/pwa/read-adventure-field-plan.mjs";
import { fieldPlanContentKey } from "../systems/adventure-map/field-plan-keys.mjs";
import { FIELD_PLAN_NAMESPACE } from "../systems/adventure-map/field-plan-model.mjs";
import { buildCanonicalAdventurePwaContent } from "../scripts/pwa/build-installation-bundle.mjs";
import { prepareCrossMapPortalCommit } from "../systems/adventure-map/portal-runtime-bridge.mjs";
import { bootstrapPortalState } from "../systems/adventure-map/portal-runtime-bridge.mjs";
import { createMovementState } from "../systems/adventure-map/movement-sim.mjs";
import { idlePortalTravelAfterFailedPrepare } from "../systems/adventure-map/portal-runtime-bridge.mjs";
import {
  M6_PORTAL_BUDGETS,
  M7_PORTAL_BUDGETS,
  M7_5_OBJ_FLOW_BUDGETS,
} from "../systems/adventure-map/portal-budgets.mjs";
import { summarizeProjectionCanvasBudget } from "../components/ms-field/test/canonical-budgets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("field plans publish bootstrap plus map222000001 and map230030200 records", async () => {
  const started = performance.now();
  const bundle = await buildAllCanonicalAdventureFieldPlans({ gameRoot: repoRoot });
  const projectionMs = performance.now() - started;
  assert.equal(bundle.plans.length, 3);
  assert.equal(bundle.entries.length, 3);
  const keys = bundle.entries.map((entry) => entry.key).sort();
  assert.deepEqual(keys, ["bootstrap", "map222000001", "map230030200"]);
  for (const plan of bundle.plans) {
    assert.ok(plan.portalLogicalIndex.entries.length > 0);
    assert.equal(plan.sceneEpoch, 0);
  }
  const target = bundle.plans.find((plan) => plan.mapId === "222000001");
  const budget = summarizeProjectionCanvasBudget(target.root);
  assert.ok(projectionMs <= M6_PORTAL_BUDGETS.maxTargetProjectionMs,
    `dual FieldPlan projection took ${projectionMs.toFixed(1)}ms`);
  assert.ok(budget.canvasCount <= M6_PORTAL_BUDGETS.maxTargetVisualCanvases);
  assert.ok(budget.maxWidth <= M6_PORTAL_BUDGETS.maxTargetCanvasWidth);
  assert.ok(budget.maxHeight <= M6_PORTAL_BUDGETS.maxTargetCanvasHeight);
  assert.ok(budget.maxLocalCanvasPixels <= M6_PORTAL_BUDGETS.maxTargetCanvasPixels);
  assert.ok(budget.totalLocalPixels <= M6_PORTAL_BUDGETS.maxTargetTotalCanvasPixels);
  assert.ok(budget.fieldPlanResourceClosure <= M6_PORTAL_BUDGETS.maxTargetFieldPlanResourceClosure);
  assert.ok(projectionMs <= M7_PORTAL_BUDGETS.maxTriFieldPlanProjectionMs,
    `tri FieldPlan projection took ${projectionMs.toFixed(1)}ms`);
  const water = bundle.plans.find((plan) => plan.mapId === "230030200");
  const waterBudget = summarizeProjectionCanvasBudget(water.root);
  assert.equal(water.mapEnvironment.swim, 1);
  assert.ok(waterBudget.canvasCount <= M7_PORTAL_BUDGETS.maxWaterMapVisualCanvases);
  assert.ok(waterBudget.maxWidth <= M7_PORTAL_BUDGETS.maxWaterMapCanvasWidth);
  assert.ok(waterBudget.maxHeight <= M7_PORTAL_BUDGETS.maxWaterMapCanvasHeight);
  assert.ok(waterBudget.maxLocalCanvasPixels <= M7_PORTAL_BUDGETS.maxWaterMapLocalCanvasPixels);
  assert.ok(waterBudget.totalLocalPixels <= M7_PORTAL_BUDGETS.maxWaterMapTotalCanvasPixels);
  assert.ok(waterBudget.fieldPlanResourceClosure <= M7_5_OBJ_FLOW_BUDGETS.maxWaterMapFieldPlanResourceClosure);
  assert.ok(waterBudget.firstFramePaintResources <= M7_PORTAL_BUDGETS.maxWaterMapFirstFramePaintResources);
});

test("prepareCrossMapPortalCommit loads map222000001 field plan record", async () => {
  const plans = await buildAllCanonicalAdventureFieldPlans({ gameRoot: repoRoot });
  const mapA = plans.plans.find((p) => p.mapId === "222000000");
  const mapB = plans.plans.find((p) => p.mapId === "222000001");
  const in00 = mapA.portalLogicalIndex.entries.find((p) => p.name === "in00");
  const scope = {
    async record(namespace, key) {
      if (namespace !== FIELD_PLAN_NAMESPACE) throw new Error("unexpected");
      const match = plans.plans.find((p) => fieldPlanContentKey(p.mapId) === key);
      if (!match) throw new Error(`missing ${key}`);
      return Object.freeze({ value: match });
    },
  };
  const controller = new AbortController();
  const prepared = await prepareCrossMapPortalCommit({
    scope: { content: scope },
    signal: controller.signal,
    sourcePlan: mapA,
    fieldState: { ...mapA.fieldState, portalTravel: { phase: "preparing", activeToken: 9, sceneEpoch: 0 } },
    movementState: createMovementState({
      worldX: mapA.fieldState.player.worldX,
      worldY: mapA.fieldState.player.worldY,
      segments: mapA.footholdCollisionPlan.segments,
    }),
    sourcePortal: in00,
    viewport: { width: 800, height: 600 },
    travelToken: 9,
    sceneEpoch: 0,
  });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.commit.activePlan.mapId, "222000001");
  assert.equal(prepared.commit.fieldState.mapId, "222000001");
});

test("aborted prepare does not change committed map id", async () => {
  const plans = await buildAllCanonicalAdventureFieldPlans({ gameRoot: repoRoot });
  const mapA = plans.plans.find((p) => p.mapId === "222000000");
  const in00 = mapA.portalLogicalIndex.entries.find((p) => p.name === "in00");
  const controller = new AbortController();
  const prepared = await prepareCrossMapPortalCommit({
    scope: {
      content: {
        async record(_ns, _key, { signal }) {
          controller.abort();
          if (signal.aborted) {
            const err = new Error("CONTENT_CANCELLED");
            err.name = "ContentReadError";
            err.code = "CONTENT_CANCELLED";
            throw err;
          }
          return { value: mapA };
        },
      },
    },
    signal: controller.signal,
    sourcePlan: mapA,
    fieldState: mapA.fieldState,
    movementState: createMovementState({
      worldX: mapA.fieldState.player.worldX,
      worldY: mapA.fieldState.player.worldY,
      segments: mapA.footholdCollisionPlan.segments,
    }),
    sourcePortal: in00,
    viewport: { width: 800, height: 600 },
    travelToken: 5,
    sceneEpoch: 0,
  });
  assert.equal(prepared.ok, false);
  assert.equal(prepared.code, "PORTAL_PREPARE_CANCELLED");
});

test("failed prepare restore leaves source map id on field state", () => {
  const source = Object.freeze({
    mapId: "222000000",
    portalTravel: Object.freeze({ phase: "preparing", activeToken: 2, sceneEpoch: 0 }),
    player: Object.freeze({ worldX: 1, worldY: 2 }),
  });
  const restored = idlePortalTravelAfterFailedPrepare(source);
  assert.equal(restored.mapId, "222000000");
  assert.equal(restored.portalTravel.phase, "idle");
  assert.equal(restored.player.worldX, 1);
});

test("prepareCrossMapPortalCommit loads map222000001 when returning from water east00", async () => {
  const plans = await buildAllCanonicalAdventureFieldPlans({ gameRoot: repoRoot });
  const mapC = plans.plans.find((p) => p.mapId === "230030200");
  const east00 = mapC.portalLogicalIndex.entries.find((p) => p.name === "east00");
  const scope = {
    async record(namespace, key) {
      if (namespace !== FIELD_PLAN_NAMESPACE) throw new Error("unexpected");
      const match = plans.plans.find((p) => fieldPlanContentKey(p.mapId) === key);
      if (!match) throw new Error(`missing ${key}`);
      return Object.freeze({ value: match });
    },
  };
  const prepared = await prepareCrossMapPortalCommit({
    scope: { content: scope },
    signal: new AbortController().signal,
    sourcePlan: mapC,
    fieldState: {
      ...mapC.fieldState,
      mapId: "230030200",
      portalTravel: { phase: "preparing", activeToken: 4, sceneEpoch: 2 },
    },
    movementState: createMovementState({
      worldX: 296,
      worldY: -98,
      segments: mapC.footholdCollisionPlan.segments,
    }),
    sourcePortal: east00,
    viewport: { width: 800, height: 600 },
    travelToken: 4,
    sceneEpoch: 2,
  });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.commit.activePlan.mapId, "222000001");
  assert.equal(prepared.commit.sceneEpoch, 3);
  assert.equal(prepared.commit.movementState.medium, "land");
  assert.ok(prepared.commit.renderRoot.key.includes(":e3"));
});

test("canonical PWA content merges three-map resource closures", async () => {
  const content = await buildCanonicalAdventurePwaContent({ gameRoot: repoRoot });
  const fieldRecords = content.entries.filter(
    (e) => e.kind === "record" && e.namespace === FIELD_PLAN_NAMESPACE,
  );
  assert.equal(fieldRecords.length, 3);
  const mapResources = content.entries.filter((e) => e.kind === "resource" && e.namespace === "resource.Map");
  assert.equal(mapResources.length, M7_5_OBJ_FLOW_BUDGETS.publishedMapResourceUnion);
  const bootstrap = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot })).plan;
  const portal = bootstrapPortalState(bootstrap);
  assert.equal(portal.portalIndex.entries.some((p) => p.name === "in00" && p.enabled), true);
});

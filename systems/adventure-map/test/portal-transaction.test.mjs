import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { buildPortalLogicalIndex } from "../portal-logical-index.mjs";
import { selectPortalTriggerCandidate } from "../portal-trigger.mjs";
import { resolveTargetPortalByName, resolveTravelTarget } from "../portal-target-resolve.mjs";
import { planCrossMapPortalCommit, planSameMapPortalCommit } from "../portal-transaction.mjs";
import { applySceneEpochToRenderRoot } from "../portal-scene-epoch.mjs";
import { buildArrivalMovementState } from "../portal-arrival.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const viewport = Object.freeze({ width: 800, height: 600 });
const published = new Set(["222000000", "222000001"]);

const plans = Object.freeze({
  "222000000": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000000" })).plan,
  "222000001": (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan,
});

function portalByName(index, name) {
  return index.entries.find((entry) => entry.name === name);
}

test("bidirectional M6 slice resolves in00 and out00 targets", () => {
  const mapA = plans["222000000"].portalLogicalIndex;
  const mapB = plans["222000001"].portalLogicalIndex;
  const in00 = portalByName(mapA, "in00");
  const out00 = portalByName(mapB, "out00");
  assert.ok(in00?.enabled);
  assert.equal(in00.type, 1);
  assert.ok(out00?.enabled);
  assert.equal(out00.type, 3);
  const toSt00 = resolveTravelTarget(in00, mapB);
  assert.equal(toSt00.ok, true);
  assert.equal(toSt00.portal.name, "st00");
  const toIn00 = resolveTravelTarget(out00, mapA);
  assert.equal(toIn00.ok, true);
  assert.equal(toIn00.portal.name, "in00");
});

test("pt=3 out00 is triggerable without visual dependency", () => {
  const out00 = portalByName(plans["222000001"].portalLogicalIndex, "out00");
  const player = Object.freeze({ worldX: out00.x, worldY: out00.y });
  const selected = selectPortalTriggerCandidate(plans["222000001"].portalLogicalIndex, player, true);
  assert.equal(selected?.name, "out00");
});

test("duplicate and missing target rejection", () => {
  const dupIndex = buildPortalLogicalIndex("000001", [
    Object.freeze({ sourceOrder: 0, pn: "a", pt: 1, x: 0, y: 0, tm: 1, tn: "x" }),
    Object.freeze({ sourceOrder: 1, pn: "x", pt: 1, x: 0, y: 0, tm: 1, tn: "" }),
    Object.freeze({ sourceOrder: 2, pn: "x", pt: 1, x: 0, y: 0, tm: 1, tn: "" }),
  ], new Set(["1"]));
  assert.equal(resolveTargetPortalByName(dupIndex, "x").code, "PORTAL_TARGET_DUPLICATE");
  assert.equal(resolveTargetPortalByName(dupIndex, "missing").code, "PORTAL_TARGET_MISSING");
});

test("cross-map commit zeros velocity and replaces render root with epoch keys", () => {
  const in00 = portalByName(plans["222000000"].portalLogicalIndex, "in00");
  const st00 = resolveTravelTarget(in00, plans["222000001"].portalLogicalIndex).portal;
  const movementState = buildArrivalMovementState(st00, plans["222000000"].footholdCollisionPlan);
  const commit = planCrossMapPortalCommit({
    sourcePlan: plans["222000000"],
    targetPlan: plans["222000001"],
    fieldState: plans["222000000"].fieldState,
    movementState,
    sourcePortal: in00,
    targetPortal: st00,
    viewport,
    travelToken: 1,
    nextSceneEpoch: 1,
  });
  assert.equal(commit.movementState.velocityX, 0);
  assert.equal(commit.movementState.velocityY, 0);
  assert.ok(commit.renderRoot.key.includes("222000001"));
  assert.ok(applySceneEpochToRenderRoot(plans["222000001"].root, 1).key.endsWith(":e1"));
});

test("same-map commit keeps renderReplace false", () => {
  const index = Object.freeze({
    formatVersion: 1,
    mapId: "222000000",
    entries: Object.freeze([
      Object.freeze({ sourceOrder: 0, name: "a", type: 1, x: 0, y: 0, targetMap: 222000000, targetName: "b", enabled: true }),
      Object.freeze({ sourceOrder: 1, name: "b", type: 1, x: 10, y: 0, targetMap: 222000000, targetName: "a", enabled: true }),
    ]),
  });
  const a = portalByName(index, "a");
  const b = portalByName(index, "b");
  const commit = planSameMapPortalCommit({
    activePlan: { ...plans["222000000"], portalLogicalIndex: index, effectiveBounds: plans["222000000"].effectiveBounds },
    fieldState: plans["222000000"].fieldState,
    movementState: buildArrivalMovementState(b, plans["222000000"].footholdCollisionPlan),
    sourcePortal: a,
    targetPortal: b,
    viewport,
    travelToken: 2,
  });
  assert.equal(commit.renderReplace, false);
  assert.equal(commit.crossMap, false);
});

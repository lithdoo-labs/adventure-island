import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { planCrossMapPortalCommit } from "../portal-transaction.mjs";
import { createMovementState } from "../movement-sim.mjs";
import { projectPlayerDepthUpdate } from "../movement-render-projection.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const viewport = Object.freeze({ width: 800, height: 600 });

test("depth updates reference epoch children present in committed render tree", async () => {
  const mapA = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000000" })).plan;
  const mapB = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot, mapId: "222000001" })).plan;
  const in00 = mapA.portalLogicalIndex.entries.find((p) => p.name === "in00");
  const st00 = mapB.portalLogicalIndex.entries.find((p) => p.name === "st00");
  const movementState = createMovementState({
    worldX: mapA.fieldState.player.worldX,
    worldY: mapA.fieldState.player.worldY,
    segments: mapA.footholdCollisionPlan.segments,
  });
  const commit = planCrossMapPortalCommit({
    sourcePlan: mapA,
    targetPlan: mapB,
    fieldState: mapA.fieldState,
    movementState,
    sourcePortal: in00,
    targetPortal: st00,
    viewport,
    travelToken: 1,
    nextSceneEpoch: 1,
  });
  const activeRenderChildren = commit.renderRoot.children;
  const player = { ...commit.fieldState.player, layer: 1, zM: 2 };
  const ranks = new Map(activeRenderChildren.map((c) => [c.key, c.attrs["stack-rank"]]));
  const depth = projectPlayerDepthUpdate(activeRenderChildren, player, ranks);
  const liveKeys = new Set(activeRenderChildren.map((c) => c.key));
  assert.deepEqual(depth.nodes.map((node) => node.key), ["player:adventure"]);
  for (const node of depth.nodes) {
    assert.ok(liveKeys.has(node.key), `depth update must target live key ${node.key}`);
  }
});
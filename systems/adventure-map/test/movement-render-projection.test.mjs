import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { applyMovementToFieldState, createMovementState } from "../movement-sim.mjs";
import { applyCameraToFieldState } from "../camera-state.mjs";
import { playerSortKey } from "../../../components/ms-field/src/player-node.mjs";
import {
  projectInitialMovementRoot,
  projectPlayerDepthUpdate,
} from "../movement-render-projection.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("initial snapshot uses snapped authority coordinates, camera, and Foothold depth", async () => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot });
  const movement = createMovementState({
    ...plan.fieldState.player,
    segments: plan.footholdCollisionPlan.segments,
  });
  let fieldState = applyMovementToFieldState(plan.fieldState, movement);
  const cameraProjection = applyCameraToFieldState(
    fieldState,
    { width: 800, height: 600 },
    plan,
  );
  fieldState = cameraProjection.fieldState;
  const camera = cameraProjection.camera;
  const root = projectInitialMovementRoot(plan.root, fieldState, camera);
  const player = root.children.find((child) => child.key === "player:adventure");
  const playerIndex = root.children.findIndex((child) => child.key === "player:adventure");
  assert.equal(player.attrs["world-y"], "243");
  assert.equal(playerIndex, 154, "spawn stays between the same paint units");
  assert.equal(player.attrs["stack-rank"], "309", "odd rank for static slot 154");
  assert.equal(player.data.provenance.layer, 2);
  assert.equal(player.data.provenance.zM, 8);
  let staticSeen = 0;
  for (const child of root.children) {
    if (child.key === "player:adventure") {
      assert.equal(child.attrs["stack-rank"], String(2 * staticSeen + 1));
      continue;
    }
    staticSeen += 1;
    assert.equal(child.attrs["stack-rank"], String(2 * staticSeen));
  }
  assert.equal(root.attrs["camera-x"], String(camera.cameraX));
  assert.equal(root.attrs["camera-y"], String(camera.cameraY));
  assert.equal(fieldState.camera.cameraX, camera.cameraX);
  assert.equal(fieldState.camera.cameraY, camera.cameraY);
});

test("a foothold change on map 222000000 patches only the player", async () => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot });
  const movement = createMovementState({
    ...plan.fieldState.player,
    segments: plan.footholdCollisionPlan.segments,
  });
  let fieldState = applyMovementToFieldState(plan.fieldState, movement);
  const cameraProjection = applyCameraToFieldState(
    fieldState,
    { width: 800, height: 600 },
    plan,
  );
  fieldState = cameraProjection.fieldState;
  const root = projectInitialMovementRoot(plan.root, fieldState, cameraProjection.camera);
  const current = new Map(root.children.map((child) => [child.key, child.attrs["stack-rank"]]));
  const update = projectPlayerDepthUpdate(
    root.children,
    { ...fieldState.player, layer: 5, zM: 0 },
    current,
  );
  assert.deepEqual(update.nodes.map((node) => node.key), ["player:adventure"]);
  assert.notEqual(update.nodes[0].attrs.set["stack-rank"], current.get("player:adventure"));
  assert.equal(update.nodes[0].data.set.provenance.layer, 5);
  assert.equal(update.nodes[0].data.set.provenance.zM, 0);
});

test("depth transition updates the player rank without touching static nodes", () => {
  const behind = playerSortKey({ layer: 2, zM: 8 });
  const ahead = playerSortKey({ layer: 5, zM: 0 });
  const nodes = [
    { key: "static:a", data: { depthInterval: { min: behind - 1 } }, attrs: {} },
    { key: "player:adventure", data: {}, attrs: {} },
    { key: "static:b", data: { depthInterval: { min: behind + 1 } }, attrs: {} },
  ];
  const initial = projectPlayerDepthUpdate(nodes, { layer: 2, zM: 8 }, new Map());
  const children = nodes.map((child) => ({
    ...child,
    attrs: { "stack-rank": initial.nextRanks.get(child.key) },
  }));
  const current = new Map(children.map((child) => [child.key, child.attrs["stack-rank"]]));
  const update = projectPlayerDepthUpdate(children, { layer: 5, zM: 0 }, current);
  assert.ok(ahead > behind + 1);
  assert.deepEqual(update.nodes.map((node) => node.key), ["player:adventure"]);
  assert.deepEqual(Object.keys(update.nodes[0].attrs.set), ["stack-rank"]);
  assert.notEqual(update.nodes[0].attrs.set["stack-rank"], current.get("player:adventure"));
  assert.equal(update.nodes[0].data.set.provenance.layer, 5);
  assert.equal(update.nodes[0].data.set.provenance.zM, 0);
  assert.equal(update.nextRanks.get("static:a"), current.get("static:a"));
  assert.equal(update.nextRanks.get("static:b"), current.get("static:b"));
});

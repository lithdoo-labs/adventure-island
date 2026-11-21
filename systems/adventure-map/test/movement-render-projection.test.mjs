import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { applyMovementToFieldState, createMovementState } from "../movement-sim.mjs";
import { applyCameraToFieldState } from "../camera-state.mjs";
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
  assert.equal(player.attrs["world-y"], "243");
  assert.equal(player.attrs["stack-rank"], "155");
  assert.equal(player.data.provenance.layer, 2);
  assert.equal(player.data.provenance.zM, 8);
  assert.deepEqual(
    root.children.map((child) => Number(child.attrs["stack-rank"])),
    Array.from({ length: root.children.length }, (_, index) => index + 1),
  );
  assert.equal(root.attrs["camera-x"], String(camera.cameraX));
  assert.equal(root.attrs["camera-y"], String(camera.cameraY));
  assert.equal(fieldState.camera.cameraX, camera.cameraX);
  assert.equal(fieldState.camera.cameraY, camera.cameraY);
});

test("depth transition updates ranks without resending static Canvas data", () => {
  const children = [
    { key: "static:a", data: { depthInterval: { min: 0 } }, attrs: { "stack-rank": "1" } },
    {
      key: "player:adventure",
      data: { provenance: { sortKey: 5 } },
      attrs: { "stack-rank": "2" },
    },
    { key: "static:b", data: { depthInterval: { min: 10 } }, attrs: { "stack-rank": "3" } },
  ];
  const current = new Map(children.map((child) => [child.key, child.attrs["stack-rank"]]));
  const update = projectPlayerDepthUpdate(children, { layer: 0, zM: 99999 }, current);
  assert.ok(update.nodes.length > 0);
  for (const node of update.nodes) {
    if (node.key.startsWith("static:")) assert.equal(node.data, undefined);
    assert.deepEqual(Object.keys(node.attrs.set), ["stack-rank"]);
  }
  assert.ok(update.nodes.find((node) => node.key === "player:adventure")?.data?.set?.provenance);
});

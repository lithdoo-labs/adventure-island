import assert from "node:assert/strict";
import test from "node:test";
import { layoutBackView } from "../../../components/ms-map-adapter/src/back-layout.mjs";
import { projectBackCameraUpdates } from "../back-view-projection.mjs";
import { applyProjectionPatches } from "../render-node-patches.mjs";
import { projectViewportRelayoutUpdates } from "../viewport-view-projection.mjs";

test("a height-only resize stores the new viewport extent and does not emit a second back update", () => {
  const camera = Object.freeze({ cameraX: -100, cameraY: -200 });
  const laid = layoutBackView({
    type: 1,
    bounds: { x: 0, y: 10 },
    placement: { cx: 32, cy: 0, rx: 0, ry: -50 },
    frameWidth: 32,
    frameHeight: 32,
    cameraX: camera.cameraX,
    cameraY: camera.cameraY,
    viewport: { width: 960, height: 720 },
  });
  const child = Object.freeze({
    key: "back:height-only",
    tag: "ms-map-back",
    attrs: Object.freeze({
      "view-x": String(laid.viewX),
      "view-y": String(laid.viewY),
    }),
    data: Object.freeze({
      source: Object.freeze({ type: 1, cx: 32, cy: 0, rx: 0, ry: -50 }),
      layout: laid.layout,
    }),
  });
  const nextViewport = Object.freeze({ width: 960, height: 600 });
  const relayout = projectViewportRelayoutUpdates([child], nextViewport, camera);
  assert.equal(relayout.length, 1);
  assert.equal(relayout[0].data.set.layout.canvasWidth, 960);
  assert.equal(relayout[0].data.set.layout.viewportWidth, 960);
  assert.equal(relayout[0].data.set.layout.viewportHeight, 600);
  const patched = applyProjectionPatches([child], relayout);
  const followUp = projectBackCameraUpdates(patched, camera);
  assert.deepEqual(followUp, []);
});

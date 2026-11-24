import assert from "node:assert/strict";
import test from "node:test";
import { applyCameraToFieldState, cameraBoundsForPlan } from "../camera-state.mjs";

const VR_SOURCE = Object.freeze({ left: -3510, top: -1000, right: 3600, bottom: 510 });
const VR_EFFECTIVE = Object.freeze({ left: -3110, top: -700, right: 3200, bottom: 210 });
const MINIMAP = Object.freeze({ left: -1928, top: -459, right: 636, bottom: 1058 });

function fieldAt(worldX, worldY) {
  return {
    player: { worldX, worldY },
    movement: { simulationTimeMs: 0 },
    camera: null,
  };
}

test("a VR plan keeps the raw VR clamp even when footholds are present", () => {
  const plan = {
    sourceBounds: VR_SOURCE,
    effectiveBounds: VR_EFFECTIVE,
    footholdCollisionPlan: {
      segments: [{ x1: -100, y1: 0, x2: 100, y2: 0 }],
    },
  };
  const bounds = cameraBoundsForPlan(plan);
  assert.equal(bounds.cameraBounds, undefined);
  const camera = applyCameraToFieldState(fieldAt(-92, 243), { width: 960, height: 720 }, plan).camera;
  assert.equal(camera.cameraX, -572);
  assert.equal(camera.cameraY, -210);
});

test("a minimap plan clamps the camera to the foothold rectangle", () => {
  const plan = {
    sourceBounds: MINIMAP,
    effectiveBounds: MINIMAP,
    footholdCollisionPlan: {
      segments: [{ x1: -1861, y1: -94, x2: 543, y2: 895 }],
    },
  };
  const camera = applyCameraToFieldState(fieldAt(296, -94), { width: 1280, height: 720 }, plan).camera;
  assert.equal(camera.cameraX, -747);
  assert.equal(camera.cameraY, -454);
  const narrow = applyCameraToFieldState(fieldAt(296, -94), { width: 1000, height: 700 }, plan).camera;
  assert.equal(narrow.cameraX, -467);
  assert.equal(narrow.cameraY, -454);
});

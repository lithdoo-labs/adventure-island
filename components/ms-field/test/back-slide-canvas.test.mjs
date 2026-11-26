import assert from "node:assert/strict";
import test from "node:test";
import { chooseBackCanvas } from "../src/elements.mjs";
import { FIELD_CANVAS_LIMITS } from "../src/limits.mjs";

test("the resolved 1028×720 water back keeps the viewport canvas when one extra tile exceeds 900k", () => {
  const chosen = chooseBackCanvas({
    canvasWidth: 1028,
    canvasHeight: 720,
    frameWidth: 100,
    frameHeight: 99,
    tileStepX: 100,
    tileStepY: 99,
    tileHorizontal: true,
    tileVertical: true,
  }, 1028, 720, 1);
  assert.equal(chosen.externalPhase, false);
  assert.equal(chosen.deviceW, 1028);
  assert.equal(chosen.deviceH, 720);
  assert.ok(chosen.deviceW * chosen.deviceH <= FIELD_CANVAS_LIMITS.maxSlidingBackPixels);
});

test("a tiled back still slides when the extra tile stays inside the ceiling", () => {
  const chosen = chooseBackCanvas({
    canvasWidth: 1000,
    canvasHeight: 600,
    frameWidth: 100,
    frameHeight: 600,
    tileStepX: 100,
    tileStepY: 0,
    tileHorizontal: true,
    tileVertical: false,
  }, 1000, 600, 1);
  assert.equal(chosen.externalPhase, true);
  assert.equal(chosen.deviceW, 1100);
  assert.equal(chosen.deviceH, 600);
  assert.ok(chosen.deviceW * chosen.deviceH <= FIELD_CANVAS_LIMITS.maxSlidingBackPixels);
});

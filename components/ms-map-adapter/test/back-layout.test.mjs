import assert from "node:assert/strict";
import test from "node:test";
import {
  BACK_SCROLL_MS_DIVISOR,
  backViewAttrsForCamera,
  layoutBackView,
  scrollPixelsPerMs,
} from "../src/back-layout.mjs";

test("type 4 scroll uses the proven 20000/abs(rx) interval", () => {
  assert.equal(scrollPixelsPerMs(4), 1 / (BACK_SCROLL_MS_DIVISOR / 4));
  assert.equal(scrollPixelsPerMs(-5), -1 / (BACK_SCROLL_MS_DIVISOR / 5));
  assert.equal(scrollPixelsPerMs(0), null);
});

test("a non-zero horizontal step uses one viewport-sized bounded surface", () => {
  const laidOut = layoutBackView({
    type: 1,
    bounds: { x: 30, y: 72, width: 64, height: 32 },
    placement: { cx: 800, cy: 0, rx: -10, ry: -15 },
    frameWidth: 348,
    frameHeight: 32,
    cameraX: 100,
    cameraY: 50,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(laidOut.canvasWidth, 800);
  assert.equal(laidOut.canvasHeight, 32);
  assert.equal(laidOut.viewX, 100, "world-plane -camera and host +camera cancel exactly once");
  assert.equal(laidOut.viewY, 72);
  assert.equal(laidOut.layout.tileStepX, 800);
  assert.equal(laidOut.layout.tileHorizontal, true);
  assert.equal(laidOut.layout.pinToViewportX, true);
});

test("cx/cy zero stays zero and draws one authored frame", () => {
  const laidOut = layoutBackView({
    type: 3,
    bounds: { x: -20, y: 40, width: 64, height: 32 },
    placement: { cx: 0, cy: 0, rx: 0, ry: 0 },
    frameWidth: 64,
    frameHeight: 32,
    cameraX: 500,
    cameraY: 200,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(laidOut.canvasWidth, 64);
  assert.equal(laidOut.canvasHeight, 32);
  assert.equal(laidOut.layout.tileHorizontal, false);
  assert.equal(laidOut.layout.tileVertical, false);
  assert.equal(laidOut.viewX, -20);
  assert.equal(laidOut.viewY, 40);
});

test("camera-only projection counter-positions only repeated axes", () => {
  const layout = Object.freeze({
    worldLeft: 100,
    worldTop: 200,
    pinToViewportX: true,
    pinToViewportY: false,
  });
  const next = backViewAttrsForCamera(layout, 250, 80);
  assert.equal(next.viewX, 250);
  assert.equal(next.viewY, 200);
  assert.equal(next.viewX - 250, 0, "scene Camera transform must not be applied twice");
});

test("oversized viewport surfaces fail closed instead of silently clipping", () => {
  assert.throws(() => layoutBackView({
    type: 1,
    bounds: { x: 0, y: 0 },
    placement: { cx: 32, cy: 0, rx: 0, ry: 0 },
    frameWidth: 32,
    frameHeight: 32,
    viewport: { width: 3_000, height: 600 },
  }), /canvas budget/);
});

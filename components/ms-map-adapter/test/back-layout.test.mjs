import assert from "node:assert/strict";
import test from "node:test";
import {
  BACK_SCROLL_DISTANCE_PX,
  BACK_SCROLL_MS_DIVISOR,
  backViewAttrsForCamera,
  horizontalScreenAnchor,
  layoutBackView,
  scrollPixelsPerMs,
  verticalScreenAnchor,
} from "../src/back-layout.mjs";

test("type 4 scroll travels 100px in trunc(20000/abs(rx)) ms", () => {
  const rate = (rx) => {
    const duration = Math.trunc(BACK_SCROLL_MS_DIVISOR / Math.abs(rx));
    return (rx > 0 ? -BACK_SCROLL_DISTANCE_PX : BACK_SCROLL_DISTANCE_PX) / duration;
  };
  assert.equal(scrollPixelsPerMs(4), rate(4));
  assert.equal(scrollPixelsPerMs(-5), rate(-5));
  assert.equal(scrollPixelsPerMs(3), rate(3));
  assert.equal(scrollPixelsPerMs(0), null);
  assert.ok(scrollPixelsPerMs(5) < -20 / 1000);
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
  assert.equal(laidOut.viewY, 370);
  assert.equal(laidOut.layout.parallaxRy, -15);
  assert.equal(laidOut.layout.tileStepX, 800);
  assert.equal(laidOut.layout.tileHorizontal, true);
  assert.equal(laidOut.layout.pinToViewportX, true);
});

test("cx/cy zero on a repeating type uses the frame size and covers the viewport", () => {
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
  assert.equal(laidOut.canvasWidth, 800);
  assert.equal(laidOut.canvasHeight, 600);
  assert.equal(laidOut.layout.tileStepX, 64);
  assert.equal(laidOut.layout.tileStepY, 32);
  assert.equal(laidOut.layout.tileHorizontal, true);
  assert.equal(laidOut.layout.tileVertical, true);
  assert.equal(laidOut.viewX, 500);
  assert.equal(laidOut.viewY, 200);
});

test("type 1 with cx zero repeats horizontally and keeps the authored vertical frame", () => {
  const laidOut = layoutBackView({
    type: 1,
    bounds: { x: 10, y: -80, width: 50, height: 550 },
    placement: { cx: 0, cy: 0, rx: 0, ry: -10 },
    frameWidth: 50,
    frameHeight: 550,
    cameraX: 120,
    cameraY: 40,
    viewport: { width: 996, height: 719 },
  });
  assert.equal(laidOut.layout.tileStepX, 50);
  assert.equal(laidOut.layout.tileHorizontal, true);
  assert.equal(laidOut.layout.tileVertical, false);
  assert.equal(laidOut.canvasWidth, 996);
  assert.equal(laidOut.canvasHeight, 550);
  assert.equal(laidOut.viewX, 120);
  assert.equal(laidOut.viewY, 280);
});

test("horizontal repeat anchor follows rx and type 4 stays on the screen", () => {
  const meadow = layoutBackView({
    type: 1,
    bounds: { x: -565, y: 0, width: 100, height: 40 },
    placement: { cx: 2046, cy: 0, rx: -25, ry: -40 },
    frameWidth: 1023,
    frameHeight: 40,
    cameraX: -993,
    cameraY: -210,
    viewport: { width: 1078, height: 720 },
  });
  assert.equal(meadow.layout.parallaxRx, -25);
  assert.equal(horizontalScreenAnchor(meadow.layout, -993, 0), 87);
  const mountains = layoutBackView({
    type: 4,
    bounds: { x: -400, y: -20, width: 80, height: 40 },
    placement: { cx: 1000, cy: 0, rx: 4, ry: -12 },
    frameWidth: 80,
    frameHeight: 40,
    cameraX: -993,
    cameraY: -210,
    viewport: { width: 1078, height: 720 },
  });
  assert.equal(mountains.layout.parallaxRx, null);
  const parked = -400 + Math.trunc(1078 / 2);
  assert.equal(horizontalScreenAnchor(mountains.layout, -993, 0), parked);
  assert.equal(horizontalScreenAnchor(mountains.layout, 200, 0), parked);
  assert.equal(horizontalScreenAnchor(mountains.layout, -993, 6), parked - 6);
  assert.ok(mountains.layout.scroll.pixelsPerMs < 0);
  const start = horizontalScreenAnchor(mountains.layout, -993, 0);
  const later = horizontalScreenAnchor(mountains.layout, -993, mountains.layout.scroll.pixelsPerMs * 1000);
  assert.ok(later > start, "positive rx moves the picture right");
});

test("vertical parallax follows ry and leaves ry -100 on the authored top", () => {
  const shared = {
    type: 1,
    bounds: { x: 0, y: 28, width: 100, height: 40 },
    frameWidth: 100,
    frameHeight: 40,
    cameraX: 0,
    viewport: { width: 800, height: 720 },
  };
  const far = layoutBackView({
    ...shared,
    placement: { cx: 100, cy: 0, rx: 0, ry: -30 },
    cameraY: -210,
  });
  const near = layoutBackView({
    ...shared,
    placement: { cx: 100, cy: 0, rx: 0, ry: -70 },
    cameraY: -210,
  });
  const locked = layoutBackView({
    ...shared,
    placement: { cx: 100, cy: 0, rx: 0, ry: -100 },
    cameraY: -210,
  });
  assert.equal(far.viewY, 28 + 105);
  assert.equal(near.viewY, 28 + 45);
  assert.equal(locked.viewY, 28);
  const moved = backViewAttrsForCamera(near.layout, 0, -110);
  assert.equal(moved.viewY, 28 + 75);
});

test("type 5 scrolls on ry and keeps horizontal rate rx+100", () => {
  const column = layoutBackView({
    type: 5,
    bounds: { x: -218, y: -139, width: 146, height: 250 },
    placement: { cx: 0, cy: 1300, rx: 0, ry: 15 },
    frameWidth: 146,
    frameHeight: 250,
    cameraX: 40,
    cameraY: 80,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(column.layout.kind, "scroll-vertical");
  assert.equal(column.layout.tileVertical, true);
  assert.equal(column.layout.tileHorizontal, false);
  assert.equal(column.layout.parallaxRy, 0);
  assert.equal(column.viewY, 80);
  assert.equal(verticalScreenAnchor(column.layout, 80, 0), -139 + 300);
  assert.equal(verticalScreenAnchor(column.layout, 400, 0), -139 + 300);
  assert.equal(verticalScreenAnchor(column.layout, 80, 6), -139 + 300 - 6);
  assert.equal(column.viewX, -218 + 40 + 400);
  assert.ok(column.layout.scroll.pixelsPerMs < 0);
});

test("type 7 tiles both axes and scrolls only vertically", () => {
  const both = layoutBackView({
    type: 7,
    bounds: { x: 10, y: 20, width: 48, height: 47 },
    placement: { cx: 450, cy: 820, rx: -80, ry: -7 },
    frameWidth: 48,
    frameHeight: 47,
    cameraX: 100,
    cameraY: 50,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(both.layout.kind, "scroll-vertical-both");
  assert.equal(both.layout.tileHorizontal, true);
  assert.equal(both.layout.tileVertical, true);
  assert.equal(both.viewX, 100);
  assert.equal(both.viewY, 50);
  assert.equal(verticalScreenAnchor(both.layout, 50, 0), 20 + 300);
  assert.equal(verticalScreenAnchor(both.layout, 900, 0), 20 + 300);
  const centerX = 100 + 400;
  const expectedX = 10 + Math.trunc((centerX * 20) / 100) - 100;
  assert.equal(horizontalScreenAnchor(both.layout, 100, 0), expectedX);
});

test("vertical repeat keeps ry and rate -100 tracks the authored top", () => {
  const tower = layoutBackView({
    type: 2,
    bounds: { x: -293, y: -834, width: 587, height: 160 },
    placement: { cx: 0, cy: 800, rx: -100, ry: -100 },
    frameWidth: 587,
    frameHeight: 160,
    cameraX: -200,
    cameraY: 400,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(tower.layout.tileVertical, true);
  assert.equal(tower.layout.pinToViewportY, true);
  assert.equal(tower.layout.parallaxRy, -100);
  assert.equal(tower.viewY, 400);
  assert.equal(verticalScreenAnchor(tower.layout, 400), -834 - 400);
  assert.equal(verticalScreenAnchor(tower.layout, 1600), -834 - 1600);
  const moved = backViewAttrsForCamera(tower.layout, -200, 1600);
  assert.equal(moved.viewY, 1600);
});

test("a screen-locked vertical repeat does not follow the camera", () => {
  const sky = layoutBackView({
    type: 3,
    bounds: { x: -25, y: -25, width: 50, height: 50 },
    placement: { cx: 0, cy: 0, rx: 0, ry: 0 },
    frameWidth: 50,
    frameHeight: 50,
    cameraX: 0,
    cameraY: 0,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(sky.layout.parallaxRy, 0);
  const parked = verticalScreenAnchor(sky.layout, 0);
  assert.equal(parked, -25 + 300);
  assert.equal(verticalScreenAnchor(sky.layout, 900), parked);
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

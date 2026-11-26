import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VIEWPORT_RANGE,
  resolveViewportFrame,
  viewportRangeFromAttributes,
} from "../src/layout.mjs";

const range = DEFAULT_VIEWPORT_RANGE;

test("a screen already inside the range renders at that size with scale 1", () => {
  const frame = resolveViewportFrame(800, 600, range);
  assert.deepEqual(frame, {
    mode: "uniform",
    width: 800,
    height: 600,
    scaleX: 1,
    scaleY: 1,
  });
  const fitted = resolveViewportFrame(640, 480, range);
  assert.equal(fitted.width, 640);
  assert.equal(fitted.height, 480);
  assert.equal(fitted.scaleX, 1);
  assert.equal(fitted.scaleY, 1);
});

test("a 16:9 window above the range lands on 1280×720 at scale 1.5", () => {
  const frame = resolveViewportFrame(1920, 1080, range);
  assert.equal(frame.mode, "uniform");
  assert.equal(frame.width, 1280);
  assert.equal(frame.height, 720);
  assert.equal(frame.scaleX, 1.5);
  assert.equal(frame.scaleY, 1.5);
});

test("a small 4:3 window uses the legal size whose scale is closest to 1", () => {
  const frame = resolveViewportFrame(320, 240, range);
  assert.equal(frame.mode, "uniform");
  assert.equal(frame.width, 640);
  assert.equal(frame.height, 480);
  assert.equal(frame.scaleX, 320 / 640);
  assert.equal(frame.scaleY, frame.scaleX);
});

test("a short fullscreen screen uses the smallest legal size instead of the largest", () => {
  const frame = resolveViewportFrame(640, 427, range);
  assert.equal(frame.mode, "uniform");
  assert.equal(frame.width, 720);
  assert.equal(frame.height, 480);
  assert.equal(frame.scaleX, 640 / 720);
  assert.equal(frame.scaleY, frame.scaleX);
});

test("a tall screen covers from the wide corner of the range", () => {
  const frame = resolveViewportFrame(400, 900, range);
  assert.deepEqual(frame, {
    mode: "cover",
    width: 1280,
    height: 480,
    scaleX: 400 / 1280,
    scaleY: 900 / 480,
  });
  assert.notEqual(frame.scaleX, frame.scaleY);
});

test("a wide screen covers from the tall corner of the range", () => {
  const frame = resolveViewportFrame(2000, 400, range);
  assert.deepEqual(frame, {
    mode: "cover",
    width: 640,
    height: 720,
    scaleX: 2000 / 640,
    scaleY: 400 / 720,
  });
});

test("an extreme aspect uses the same corner when only one axis is outside the range", () => {
  const tall = resolveViewportFrame(200, 600, range);
  assert.equal(tall.mode, "cover");
  assert.equal(tall.width, 1280);
  assert.equal(tall.height, 480);
  const wide = resolveViewportFrame(900, 200, range);
  assert.equal(wide.mode, "cover");
  assert.equal(wide.width, 640);
  assert.equal(wide.height, 720);
});

test("boundary aspects stay uniform and fill the matching corner", () => {
  const tallest = resolveViewportFrame(640, 720, range);
  assert.equal(tallest.mode, "uniform");
  assert.equal(tallest.width, 640);
  assert.equal(tallest.height, 720);
  assert.equal(tallest.scaleX, 1);
  const widest = resolveViewportFrame(1280, 480, range);
  assert.equal(widest.mode, "uniform");
  assert.equal(widest.width, 1280);
  assert.equal(widest.height, 480);
  assert.equal(widest.scaleX, 1);
});

test("an integer screen inside the range keeps that exact logical size", () => {
  const frame = resolveViewportFrame(1000, 700, range);
  assert.deepEqual(frame, {
    mode: "uniform",
    width: 1000,
    height: 700,
    scaleX: 1,
    scaleY: 1,
  });
});

test("a fractional screen inside the range rounds to an integer logical size near scale 1", () => {
  const frame = resolveViewportFrame(1000.4, 700.2, range);
  assert.equal(frame.mode, "uniform");
  assert.equal(frame.width, 1000);
  assert.equal(frame.height, 700);
  assert.ok(Math.abs(frame.scaleX - 1) < 0.001);
  assert.ok(Math.abs(frame.scaleY - 1) < 0.001);
});

test("a screen larger than the range still uses the largest legal size", () => {
  const frame = resolveViewportFrame(1500, 600, range);
  assert.equal(frame.mode, "uniform");
  assert.equal(frame.width, 1280);
  assert.equal(frame.height, 512);
  assert.equal(frame.scaleX, 1500 / 1280);
  assert.equal(frame.scaleY, frame.scaleX);
});

test("omitted range attributes use the default and illegal attributes fail closed", () => {
  assert.deepEqual(viewportRangeFromAttributes({}), DEFAULT_VIEWPORT_RANGE);
  assert.deepEqual(viewportRangeFromAttributes({
    "min-width": "800",
    "max-width": null,
    "min-height": "",
    "max-height": undefined,
  }), {
    minWidth: 800,
    maxWidth: 1280,
    minHeight: 480,
    maxHeight: 720,
  });
  assert.equal(viewportRangeFromAttributes({ "min-width": "0" }), null);
  assert.equal(viewportRangeFromAttributes({ "max-width": "639" }), null);
  assert.equal(viewportRangeFromAttributes({ "min-height": "12.5" }), null);
  assert.equal(viewportRangeFromAttributes({ "max-height": "1e3" }), null);
});

test("a non-positive screen produces no frame", () => {
  assert.equal(resolveViewportFrame(0, 600, range), null);
  assert.equal(resolveViewportFrame(800, Number.NaN, range), null);
});

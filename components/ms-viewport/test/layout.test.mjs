import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VIEWPORT_RANGE,
  resolveViewportFrame,
  viewportRangeFromAttributes,
} from "../src/layout.mjs";

const range = DEFAULT_VIEWPORT_RANGE;

test("an aspect inside the range uses the largest logical size and one scale", () => {
  const frame = resolveViewportFrame(800, 600, range);
  assert.deepEqual(frame, {
    mode: "uniform",
    width: 960,
    height: 720,
    scaleX: 800 / 960,
    scaleY: 800 / 960,
  });
});

test("a 16:9 window above the range lands on 1280×720 at scale 1.5", () => {
  const frame = resolveViewportFrame(1920, 1080, range);
  assert.equal(frame.mode, "uniform");
  assert.equal(frame.width, 1280);
  assert.equal(frame.height, 720);
  assert.equal(frame.scaleX, 1.5);
  assert.equal(frame.scaleY, 1.5);
});

test("a small 4:3 window still picks the largest fitting logical size", () => {
  const frame = resolveViewportFrame(320, 240, range);
  assert.equal(frame.mode, "uniform");
  assert.equal(frame.width, 960);
  assert.equal(frame.height, 720);
  assert.equal(frame.scaleX, 320 / 960);
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

test("non-integer screens still produce an integer logical size inside the range", () => {
  const frame = resolveViewportFrame(1000, 700, range);
  assert.equal(frame.mode, "uniform");
  assert.equal(Number.isSafeInteger(frame.width), true);
  assert.equal(Number.isSafeInteger(frame.height), true);
  assert.equal(frame.width, 1028);
  assert.equal(frame.height, 720);
  assert.equal(frame.scaleX, frame.scaleY);
  assert.ok(frame.width >= range.minWidth && frame.width <= range.maxWidth);
  assert.ok(frame.height >= range.minHeight && frame.height <= range.maxHeight);
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

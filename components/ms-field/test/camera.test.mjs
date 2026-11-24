import assert from "node:assert/strict";
import test from "node:test";
import { cameraClampRectangle, cameraForViewport, stepCameraFollow } from "../src/camera.mjs";

const MAP_222_SOURCE = Object.freeze({ left: -3510, top: -1000, right: 3600, bottom: 510 });
const MAP_222_EFFECTIVE = Object.freeze({ left: -3110, top: -700, right: 3200, bottom: 210 });
const MAP_222_BOUNDS = Object.freeze({
  sourceBounds: MAP_222_SOURCE,
  effectiveBounds: MAP_222_EFFECTIVE,
});
const FEET = Object.freeze({ worldX: -92, worldY: 243 });

test("a VR map clamps the viewport against raw VR once", () => {
  assert.equal(cameraClampRectangle(MAP_222_BOUNDS), MAP_222_SOURCE);
  const wide = cameraForViewport(FEET, { width: 960, height: 720 }, MAP_222_BOUNDS);
  assert.equal(wide.cameraX, -572);
  assert.equal(wide.cameraY, -210);
  const classic = cameraForViewport(FEET, { width: 800, height: 600 }, MAP_222_BOUNDS);
  assert.equal(classic.cameraX, -492);
  assert.equal(classic.cameraY, -90);
  const short = cameraForViewport(FEET, { width: 640, height: 480 }, MAP_222_BOUNDS);
  assert.equal(short.cameraX, -412);
  assert.equal(short.cameraY, 3);
});

test("an inset-only rectangle still clamps inside itself", () => {
  const camera = cameraForViewport(FEET, { width: 960, height: 720 }, MAP_222_EFFECTIVE);
  assert.equal(camera.cameraY, -510);
});

test("a rectangle smaller than the viewport is centered", () => {
  const camera = cameraForViewport(
    { worldX: 10, worldY: 10 },
    { width: 200, height: 200 },
    { left: 0, top: 0, right: 100, bottom: 100 },
  );
  assert.equal(camera.cameraX, -50);
  assert.equal(camera.cameraY, -50);
});

test("the first sample snaps 50px above the feet and later samples hold inside 28px", () => {
  const snapped = stepCameraFollow(null, FEET, 0);
  assert.equal(snapped.x, -92);
  assert.equal(snapped.y, 193);
  const held = stepCameraFollow(snapped, { worldX: -82, worldY: 243 }, 20);
  assert.equal(held.x, -92);
  assert.equal(held.y, 193);
  const easing = stepCameraFollow(snapped, { worldX: 8, worldY: 243 }, 20);
  assert.equal(easing.x, -90);
  assert.ok(easing.committedX > -92 && easing.committedX < 8);
});

test("a long sample closes part of a large look error", () => {
  const snapped = stepCameraFollow(null, { worldX: 0, worldY: 50 }, 0);
  const next = stepCameraFollow(snapped, { worldX: 100, worldY: 50 }, 1000);
  assert.equal(next.x, 50);
  assert.equal(next.y, 0);
});

test("map 222 presents the filtered look point on the raw VR", () => {
  const follow = stepCameraFollow(null, FEET, 0);
  const look = { worldX: follow.x, worldY: follow.y };
  assert.equal(cameraForViewport(look, { width: 960, height: 720 }, MAP_222_BOUNDS).cameraY, -210);
  assert.equal(cameraForViewport(look, { width: 800, height: 600 }, MAP_222_BOUNDS).cameraY, -107);
  assert.equal(cameraForViewport(look, { width: 640, height: 480 }, MAP_222_BOUNDS).cameraY, -47);
});

test("an expanded foothold fallback keeps the larger rectangle", () => {
  const source = { left: 0, top: 0, right: 100, bottom: 80 };
  const effective = { left: -10, top: -360, right: 110, bottom: 190 };
  assert.equal(cameraClampRectangle({ sourceBounds: source, effectiveBounds: effective }), effective);
  const camera = cameraForViewport(
    { worldX: 50, worldY: 100 },
    { width: 40, height: 40 },
    { sourceBounds: source, effectiveBounds: effective },
  );
  assert.equal(camera.cameraY, 80);
});

test("cameraBounds replaces a published minimap rectangle", () => {
  const published = { left: -1928, top: -459, right: 636, bottom: 1058 };
  const cameraBounds = { left: -1851, top: -454, right: 533, bottom: 1005 };
  const bounds = { sourceBounds: published, effectiveBounds: published, cameraBounds };
  assert.equal(cameraClampRectangle(bounds), cameraBounds);
  const camera = cameraForViewport(
    { worldX: 296, worldY: -144 },
    { width: 1280, height: 720 },
    bounds,
  );
  assert.equal(camera.cameraX, -747);
  assert.equal(camera.cameraY, -454);
});

test("the viewport origin is truncated toward zero", () => {
  const camera = cameraForViewport(
    { worldX: 100, worldY: -0.2 },
    { width: 101, height: 51 },
    { left: 0, top: -1000, right: 1000, bottom: 1000 },
  );
  assert.equal(camera.cameraX, 49);
  assert.equal(camera.cameraY, -25);
});

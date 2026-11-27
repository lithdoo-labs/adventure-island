import assert from "node:assert/strict";
import test from "node:test";
import { batchCanvasTiles, batchSliceSurface, viewportPaintRatio } from "../src/elements.mjs";

test("a wide batch at 1.25 device pixels splits under the 2048 canvas limit", () => {
  const tiles = batchCanvasTiles(1776, 383, 1.25);
  assert.ok(tiles);
  assert.ok(tiles.length >= 2);
  assert.equal(tiles.reduce((sum, tile) => sum + tile.w, 0), 1776);
  assert.equal(tiles[0].x, 0);
  assert.equal(tiles[1].x, tiles[0].w);
  assert.equal(tiles[0].h, 383);
  for (const tile of tiles) {
    assert.ok(tile.deviceW <= 2048);
    assert.ok(tile.deviceH <= 2048);
    assert.ok(tile.deviceW * tile.deviceH <= 4_194_304);
  }
});

test("a batch that already fits the device canvas stays one slice", () => {
  const tiles = batchCanvasTiles(389, 68, 1.25);
  assert.equal(tiles.length, 1);
  assert.deepEqual(
    { x: tiles[0].x, y: tiles[0].y, w: tiles[0].w, h: tiles[0].h },
    { x: 0, y: 0, w: 389, h: 68 },
  );
});

test("a batch slice grows one logical pixel on every side", () => {
  const surface = batchSliceSurface({ x: 10, y: 20, w: 90, h: 60 }, 1);
  assert.deepEqual(surface, {
    pad: 1,
    deviceW: 92,
    deviceH: 62,
    x: 9,
    y: 19,
    w: 92,
    h: 62,
  });
});

test("a batch slice drops the bleed when the padded canvas would pass 2048", () => {
  const surface = batchSliceSurface({ x: 0, y: 0, w: 2048, h: 10 }, 1);
  assert.equal(surface.pad, 0);
  assert.equal(surface.deviceW, 2048);
  assert.equal(surface.w, 2048);
  assert.equal(surface.x, 0);
});

test("field canvases stay on the logical grid when the fill scale is not a whole device pixel", () => {
  const previous = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1.25;
  try {
    const fractional = {
      closest() {
        return { diagnostics: () => ({ scaleX: 1.3723536737235367, scaleY: 1.3723536737235367 }) };
      },
    };
    const aligned = {
      closest() {
        return { diagnostics: () => ({ scaleX: 1.6, scaleY: 1.6 }) };
      },
    };
    const bare = { closest() { return null; } };
    assert.equal(viewportPaintRatio(fractional), 1);
    assert.equal(viewportPaintRatio(aligned), 2);
    assert.equal(viewportPaintRatio(bare), 1.25);
  } finally {
    if (previous === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = previous;
  }
});

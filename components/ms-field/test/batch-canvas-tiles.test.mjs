import assert from "node:assert/strict";
import test from "node:test";
import { batchCanvasTiles } from "../src/elements.mjs";

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

import assert from "node:assert/strict";
import test from "node:test";
import { createSpikeTree } from "../src/fixture.mjs";
import { placementDestRect, validateBatchData, validateSceneAttrs, validateSpikeTree } from "../src/validate.mjs";

function tree() {
  return createSpikeTree();
}

test("synthetic scene tree satisfies the spike validator", () => {
  const result = validateSpikeTree(tree());
  assert.equal(result.ok, true);
  assert.equal(result.value.paintUnits, 3);
  assert.equal(result.value.mapId, "900000001");
});

test("decimal, rank, and closed attrs fail closed", () => {
  const scene = tree();
  for (const value of ["-0", "-0.0", "01", "1e2", "+4", " 1", "Infinity"]) {
    const candidate = structuredClone(scene);
    candidate.attrs["camera-x"] = value;
    const result = validateSceneAttrs(candidate.attrs);
    assert.equal(result.ok, false, value);
    assert.equal(result.code, "INPUT_INVALID");
  }
  const rank = structuredClone(scene);
  rank.children[0].attrs["stack-rank"] = "2147483647";
  assert.equal(validateSpikeTree(rank).ok, false);
  const extra = structuredClone(scene);
  extra.attrs.zoom = "1";
  assert.equal(validateSceneAttrs(extra.attrs).code, "INPUT_INVALID");
  const visible = structuredClone(scene);
  visible.attrs.visible = "TRUE";
  assert.equal(validateSceneAttrs(visible.attrs).ok, false);
});

test("batch data rejects unknown fields, bad order, and world-sized bounds", () => {
  const batch = structuredClone(tree().children[0]);
  batch.data.unexpected = true;
  assert.equal(validateBatchData(batch.data).code, "INPUT_INVALID");

  const order = structuredClone(tree().children[0]);
  order.data.placements.push(structuredClone(order.data.placements[0]));
  order.data.placements[1].placementId = "tile:second";
  order.data.placements[1].order = { depth: 100, tieOrder: 0 };
  assert.equal(validateBatchData(order.data).code, "DEPTH_PLAN_INVALID");

  const huge = structuredClone(tree().children[0]);
  huge.data.bounds = { x: 0, y: 0, w: 4096, h: 4096 };
  huge.data.sprites.pages.p0.width = 4096;
  huge.data.sprites.pages.p0.height = 4096;
  huge.data.sprites.items.tile0.source = { x: 0, y: 0, w: 4096, h: 4096 };
  const limited = validateBatchData(huge.data);
  assert.equal(limited.ok, false);
  assert.equal(limited.code, "RESOURCE_LIMIT");
});

test("flip geometry mirrors around the anchor and must stay inside bounds", () => {
  const item = { source: { x: 0, y: 0, w: 10, h: 6 }, origin: [4, 2] };
  const flipped = placementDestRect({ x: 20, y: 30, flip: true }, item);
  assert.deepEqual(flipped, { x: 14, y: 28, w: 10, h: 6 });
  const batch = structuredClone(tree().children[0]);
  batch.data.sprites.items.tile0.origin = [4, 0];
  batch.data.placements[0].flip = true;
  batch.data.placements[0].x = 0;
  assert.equal(validateBatchData(batch.data).ok, false);
});

test("spike tree rejects avatar children, duplicate ranks, and duplicate placements", () => {
  const avatar = structuredClone(tree());
  avatar.children[1].children[0].tag = "ms-avatar";
  assert.equal(validateSpikeTree(avatar).ok, false);

  const ranks = structuredClone(tree());
  ranks.children[2].attrs["stack-rank"] = "10";
  assert.equal(validateSpikeTree(ranks).code, "DEPTH_PLAN_INVALID");

  const duplicated = structuredClone(tree());
  duplicated.children[2].data.placements[0].placementId = "tile:back";
  assert.equal(validateSpikeTree(duplicated).ok, false);
});

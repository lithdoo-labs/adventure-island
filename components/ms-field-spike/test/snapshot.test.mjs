import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createIdentityTree, createSpikeTree } from "../src/fixture.mjs";
import { validateSpikeTree } from "../src/validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("synthetic render tree snapshot stays on the M1 tags and finite batches", () => {
  const scene = createSpikeTree();
  assert.equal(validateSpikeTree(scene).ok, true);
  assert.deepEqual(scene.children.map((child) => child.tag), ["ms-map-batch", "ms-world-item", "ms-map-batch"]);
  assert.deepEqual(scene.children.map((child) => child.key), ["batch:back", "actor-host:spike", "batch:front"]);
  assert.equal(scene.children[1].children[0].tag, "ms-synthetic-marker");
  assert.deepEqual(scene.children.map((child) => child.attrs["stack-rank"]).filter(Boolean), ["10", "20", "30"]);
  assert.deepEqual(scene.children[0].data.bounds, { x: 0, y: 0, w: 32, h: 32 });
  assert.deepEqual(scene.children[2].data.bounds, { x: 16, y: 16, w: 32, h: 32 });
  assert.equal(scene.children[0].children.length, 0);
  assert.equal(scene.children[1].children.length, 1);
  const hash = createHash("sha256").update(JSON.stringify(scene)).digest("hex");
  assert.equal(hash, "e9283590c88984605964966b30d2ede04dce373735289623d52c3e7246bc5a9c");
  assert.equal(validateSpikeTree(createIdentityTree()).ok, true);
});

test("spike sources do not read Map FSDB or register themselves as an approved presentation", async () => {
  const files = [
    "src/limits.mjs",
    "src/validate.mjs",
    "src/elements.mjs",
    "src/fixture.mjs",
    "src/store-bridge.mjs",
  ];
  for (const relative of files) {
    const source = await readFile(path.join(root, relative), "utf8");
    assert.equal(/fsdb|222000000|adventure-map/i.test(source), false, relative);
  }
  const presentation = await readFile(path.join(root, "..", "..", "presentation.json"), "utf8");
  assert.equal(presentation.includes("ms-field-spike"), false);
});

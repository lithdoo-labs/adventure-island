import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildFieldProjection, stackRankOrder } from "../src/field-project.mjs";
import { validateFieldTree } from "../src/validate.mjs";
import { FIELD_MAP_222000000 } from "../src/field-state.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("real map 222000000 static field projection", () => {
  it("merges adapter order with player, camera, and stable field hash", async () => {
    const first = await buildFieldProjection({ gameRoot: repoRoot, viewport: { width: 800, height: 600 } });
    const second = await buildFieldProjection({ gameRoot: repoRoot, viewport: { width: 800, height: 600 } });

    assert.equal(first.fieldState.mapId, FIELD_MAP_222000000);
    assert.equal(validateFieldTree(first.root).ok, true);
    assert.equal(first.root.children.length, first.map.paintUnits.length + 1);
    assert.equal(first.map.projection.root.children.length, first.map.paintUnits.length);

    const mapChildKeys = first.map.projection.root.children.map((child) => child.key);
    const fieldKeys = first.root.children
      .filter((child) => child.key !== "player:adventure")
      .map((child) => child.key);
    assert.deepEqual(fieldKeys, mapChildKeys);
    assert.deepEqual(stackRankOrder(first.root.children), first.root.children.map((child) => child.key));

    assert.equal(first.hash, second.hash);
    assert.equal(
      first.hash,
      "sha256:c2639610e66ba310aaf1398e4bfb238c513616fe67da12758cbb1f361663ea8a",
    );

    assert.ok(Number.isFinite(first.camera.cameraX));
    assert.ok(Number.isFinite(first.camera.cameraY));
    assert.equal(first.root.attrs.visible, "true");
    const player = first.root.children.find((child) => child.key === "player:adventure");
    assert.ok(player);
    assert.equal(player.attrs["world-x"], "-92");
    assert.equal(player.attrs["world-y"], "294");
  });
});
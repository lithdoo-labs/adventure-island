import assert from "node:assert/strict";
import test from "node:test";
import { writeSyntheticMap, resetSyntheticFsdb } from "../../ms-map-adapter/test/fixtures/synthetic-fsdb.mjs";
import { buildFieldProjection, stackRankOrder } from "../src/field-project.mjs";
import { validateFieldTree } from "../src/validate.mjs";
import { playerSortKey } from "../src/player-node.mjs";

test("synthetic map field projection inserts player with unified stack-ranks", async () => {
  const suiteId = `field-${Date.now()}`;
  const fsdbRoot = await resetSyntheticFsdb(suiteId);
  await writeSyntheticMap({ suiteId, mapId: "900000001" });
  const projection = await buildFieldProjection({
    mapId: "900000001",
    fsdbRoot,
    viewport: { width: 320, height: 240 },
    player: { worldX: 12, worldY: 20, layer: 1, zM: 4, controllerFlag: 0 },
  });
  assert.equal(validateFieldTree(projection.root).ok, true);
  const playerKey = playerSortKey(projection.fieldState.player);
  const playerChild = projection.root.children.find((child) => child.key === "player:adventure");
  assert.ok(playerChild);
  assert.equal(playerChild.children[0].tag, "ms-m3-avatar-slot");
  assert.equal(playerChild.children[0].data.m4TargetTag, "ms-avatar");
  assert.ok(Number.isFinite(projection.camera.cameraX));
  const keys = stackRankOrder(projection.root.children);
  const mapKeys = projection.map.projection.root.children.map((child) => child.key);
  assert.equal(keys.length, mapKeys.length + 1);
  const withoutPlayer = keys.filter((key) => key !== "player:adventure");
  assert.deepEqual(withoutPlayer, mapKeys);
  const playerIndex = projection.root.children.findIndex((child) => child.key === "player:adventure");
  assert.ok(playerIndex >= 0 && playerIndex < projection.root.children.length);
  const before = projection.root.children.slice(0, playerIndex);
  const after = projection.root.children.slice(playerIndex + 1);
  if (before.length > 0 && after.length > 0) {
    const maxBefore = Math.max(...before.map((child) => child.data?.provenance?.sortKey ?? child.data?.depthInterval?.min ?? -Infinity));
    const minAfter = Math.min(...after.map((child) => child.data?.provenance?.sortKey ?? child.data?.depthInterval?.min ?? Infinity));
    assert.ok(playerKey > maxBefore || playerKey < minAfter, "player rank must fit the adapter sequence");
  }
});
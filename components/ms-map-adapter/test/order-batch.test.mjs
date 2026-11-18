import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  assertStrictlyIncreasingOrder,
  avatarSortKey,
  buildMapProjection,
  objSortKey,
  orderDrawables,
  planPaintUnits,
  tileSortKey,
} from "../src/index.mjs";
import { resetSyntheticFsdb, writeSyntheticMap } from "./fixtures/synthetic-fsdb.mjs";

const SUITE = "order-batch";

describe("ordering and batch planner", () => {
  let fsdbRoot;

  before(async () => {
    fsdbRoot = await resetSyntheticFsdb(SUITE);
    await writeSyntheticMap({ suiteId: SUITE, mapId: "900000010" });
  });

  after(async () => {
    await resetSyntheticFsdb(SUITE);
  });

  it("orders tile/obj by CMS079 keys with sourceOrder tie", async () => {
    const result = await buildMapProjection({ mapId: "900000010", fsdbRoot });
    assertStrictlyIncreasingOrder(result.ordered);
    const tile = result.ordered.find((d) => d.sourceKind === "tile");
    const obj = result.ordered.find((d) => d.sourceKind === "obj");
    assert.ok(tile);
    assert.ok(obj);
    assert.equal(tile.sortKey, tileSortKey(0, 1, 0));
    assert.equal(obj.sortKey, objSortKey(1, 1));
    assert.ok(obj.orderIndex < tile.orderIndex);
  });

  it("splits static batches at avatar insertion points", () => {
    const layer = 1;
    const zM = 0;
    const avatar = avatarSortKey(layer, zM, 0);
    const resource = { namespace: "resource.Map", key: "a", contentVersion: `sha256:${"a".repeat(64)}` };
    const behind = {
      stableId: "obj:a",
      sourceKind: "obj",
      sourceGroup: "obj",
      sourceOrder: 0,
      mapId: "1",
      sortKey: avatar - 100,
      tieKey: 0,
      orderIndex: 0,
      worldX: 0,
      worldY: 0,
      flip: false,
      opacity: 255,
      updateClass: "static",
      bounds: { x: 0, y: 0, width: 8, height: 8 },
      resource,
      frames: [{ origin: [0, 0], width: 8, height: 8, resource }],
      placement: {},
    };
    const ahead = {
      ...behind,
      stableId: "tile:b",
      sourceKind: "tile",
      sourceGroup: "tile",
      sourceOrder: 1,
      sortKey: avatar + 100,
      tieKey: 1,
      orderIndex: 1,
    };
    const scene = {
      mapId: "1",
      insertionPoints: [{ layer, zM, flag0: avatar, flag1: avatar + 5 }],
    };
    const units = planPaintUnits([behind, ahead], scene, {
      maxPlacements: 100,
      maxPixels: 10_000_000,
      regionSize: 10_000,
    });
    const batches = units.filter((u) => u.kind === "ms-map-batch");
    assert.equal(batches.length, 2);
    assert.equal(batches[0].placements.length, 1);
    assert.equal(batches[1].placements.length, 1);
    assert.equal(batches[0].stackRank, 1);
    assert.equal(batches[1].stackRank, 2);
  });

  it("splits at an avatar insertion key equal to the next static key", () => {
    const avatar = avatarSortKey(1, 0, 0);
    const resource = { namespace: "resource.Map", key: "equal", contentVersion: `sha256:${"e".repeat(64)}` };
    const make = (stableId, sourceOrder, sortKey) => ({
      stableId,
      sourceKind: "tile",
      sourceGroup: "tile",
      sourceOrder,
      mapId: "1",
      sortKey,
      tieKey: sourceOrder,
      orderIndex: sourceOrder,
      worldX: sourceOrder * 8,
      worldY: 0,
      flip: false,
      opacity: 255,
      updateClass: "static",
      bounds: { x: sourceOrder * 8, y: 0, width: 8, height: 8 },
      resource,
      frames: [{ origin: [0, 0], width: 8, height: 8, resource }],
      placement: {},
    });
    const units = planPaintUnits(
      [make("tile:before", 0, avatar - 1), make("tile:equal", 1, avatar)],
      { mapId: "1", insertionPoints: [{ flag0: avatar, flag1: avatar + 5 }] },
      { maxPlacements: 10, maxPixels: 10000, maxResources: 10, regionSize: 10000 },
    );
    assert.deepEqual(
      units.filter((unit) => unit.kind === "ms-map-batch").map((unit) => unit.placements.length),
      [1, 1],
    );
  });

  it("splits when placement budget is exceeded", () => {
    const items = [];
    for (let i = 0; i < 5; i += 1) {
      const resource = {
        namespace: "resource.Map",
        key: `t${i}`,
        contentVersion: `sha256:${"b".repeat(64)}`,
      };
      items.push({
        stableId: `tile:${i}`,
        sourceKind: "tile",
        sourceGroup: "tile",
        sourceOrder: i,
        mapId: "1",
        sortKey: i,
        tieKey: i,
        orderIndex: i,
        worldX: i * 8,
        worldY: 0,
        flip: false,
        opacity: 255,
        updateClass: "static",
        bounds: { x: i * 8, y: 0, width: 8, height: 8 },
        resource,
        frames: [{ origin: [0, 0], width: 8, height: 8, resource }],
        placement: {},
      });
    }
    const units = planPaintUnits(items, { mapId: "1", insertionPoints: [] }, {
      maxPlacements: 2,
      maxPixels: 10_000_000,
      regionSize: 10_000,
    });
    assert.equal(units.filter((u) => u.kind === "ms-map-batch").length, 3);
  });

  it("splits before exceeding the unique resource budget", () => {
    const items = Array.from({ length: 3 }, (_, i) => {
      const resource = {
        namespace: "resource.Map",
        key: `resource-${i}`,
        contentVersion: `sha256:${String(i + 1).repeat(64)}`,
      };
      return {
        stableId: `tile:resource:${i}`,
        sourceKind: "tile",
        sourceGroup: "tile",
        sourceOrder: i,
        mapId: "1",
        sortKey: i,
        tieKey: i,
        orderIndex: i,
        worldX: i * 8,
        worldY: 0,
        flip: false,
        opacity: 255,
        updateClass: "static",
        bounds: { x: i * 8, y: 0, width: 8, height: 8 },
        resource,
        frames: [{ origin: [0, 0], width: 8, height: 8, resource }],
        placement: {},
      };
    });
    const units = planPaintUnits(items, { mapId: "1", insertionPoints: [] }, {
      maxPlacements: 10,
      maxPixels: 10000,
      maxResources: 2,
      regionSize: 10000,
    }).filter((unit) => unit.kind === "ms-map-batch");
    assert.deepEqual(units.map((unit) => unit.resourceCount), [2, 1]);
    assert.ok(units.every((unit) => unit.budgetCompliance.ok));
  });

  it("marks an unavoidable singleton pixel overflow explicitly", () => {
    const resource = { namespace: "resource.Map", key: "large", contentVersion: `sha256:${"f".repeat(64)}` };
    const [unit] = planPaintUnits([{
      stableId: "tile:large:0",
      sourceKind: "tile",
      sourceGroup: "tile",
      sourceOrder: 0,
      mapId: "1",
      sortKey: 0,
      tieKey: 0,
      orderIndex: 0,
      worldX: 0,
      worldY: 0,
      flip: false,
      opacity: 255,
      updateClass: "static",
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      resource,
      frames: [{ origin: [0, 0], width: 100, height: 100, resource }],
      placement: {},
    }], { mapId: "1", insertionPoints: [] }, {
      maxPlacements: 10,
      maxPixels: 64,
      maxResources: 10,
      regionSize: 10000,
    });
    assert.equal(unit.budgetCompliance.ok, false);
    assert.deepEqual(unit.budgetCompliance.exceeded, ["maxPixels"]);
  });

  it("keeps back and portal visuals as independent paint units", async () => {
    const result = await buildMapProjection({ mapId: "900000010", fsdbRoot });
    const kinds = result.paintUnits.map((u) => u.kind);
    assert.ok(kinds.includes("ms-map-back"));
    assert.ok(kinds.includes("ms-portal-visual"));
    assert.ok(kinds.includes("ms-map-batch"));
    const json = JSON.stringify(result.projection.root);
    assert.equal(/\[FSDB\]|Map\.wz|\.img\b/i.test(json), false);
  });

  it("orderDrawables drops unresolved and unsupported entries", () => {
    const scene = {
      mapId: "1",
      drawables: [
        {
          stableId: "ok",
          sourceKind: "tile",
          sourceGroup: "tile",
          sourceOrder: 0,
          mapId: "1",
          sortKey: 1,
          tieKey: 0,
          resolved: true,
          unsupported: false,
        },
        {
          stableId: "bad",
          sourceKind: "tile",
          sourceGroup: "tile",
          sourceOrder: 1,
          mapId: "1",
          sortKey: 2,
          tieKey: 1,
          resolved: false,
          unsupported: false,
        },
        {
          stableId: "flow",
          sourceKind: "obj",
          sourceGroup: "obj",
          sourceOrder: 2,
          mapId: "1",
          sortKey: 0,
          tieKey: 2,
          resolved: true,
          unsupported: true,
        },
      ],
    };
    const ordered = orderDrawables(scene);
    assert.equal(ordered.length, 1);
    assert.equal(ordered[0].stableId, "ok");
  });

  it("keeps animated objects out of static batches and projects all frames", async () => {
    await writeSyntheticMap({
      suiteId: SUITE,
      mapId: "900000011",
      animatedObj: true,
    });
    const result = await buildMapProjection({ mapId: "900000011", fsdbRoot });
    const objectUnit = result.paintUnits.find((unit) => unit.kind === "ms-map-object");
    assert.ok(objectUnit);
    assert.equal(
      result.paintUnits
        .filter((unit) => unit.kind === "ms-map-batch")
        .some((unit) => unit.placements.some((placement) => placement.placementId === objectUnit.stableId)),
      false,
    );
    const objectNode = result.projection.root.children.find((node) => node.key === objectUnit.stableId);
    assert.equal(objectNode.tag, "ms-map-object");
    assert.equal(objectNode.data.mode, "local-animation");
    assert.equal(objectNode.data.frames.length, 2);
    assert.deepEqual(objectNode.data.frames.map((frame) => frame.delay), [100, 120]);
  });
});

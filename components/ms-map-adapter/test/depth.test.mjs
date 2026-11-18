import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avatarSortKey,
  backSortKey,
  compareDrawOrder,
  DEPTH_BASE,
  objSortKey,
  tileSortKey,
} from "../src/depth.mjs";

describe("CMS079 depth keys", () => {
  it("matches C-001 tile formula samples", () => {
    // Henesys-style: canvasZ=0, layer=0, zM=4 → -1073721874
    assert.equal(tileSortKey(0, 0, 4), -1073721874);
    assert.equal(tileSortKey(-3, 0, 4), -1073721877);
    assert.equal(tileSortKey(0, 1, 0), -1073691834);
  });

  it("matches C-002 obj formula samples", () => {
    assert.equal(objSortKey(0, 1), -1073739823);
    assert.equal(objSortKey(0, 2), -1073739822);
    assert.equal(objSortKey(0, 3), -1073739821);
  });

  it("matches C-099 avatar anchors from t086.1", () => {
    assert.equal(avatarSortKey(0, 0, 0), -1073711832);
    assert.equal(avatarSortKey(0, 0, 1), -1073711827);
  });

  it("uses OPENMS-REFERENCE back band relative to DEPTH_BASE", () => {
    assert.equal(backSortKey(0, false), DEPTH_BASE - 128000);
    assert.equal(backSortKey(1, false), DEPTH_BASE - 128000 + 1000);
    assert.equal(backSortKey(0, true), DEPTH_BASE + 272000);
  });

  it("orders by sortKey then tieKey then stableId", () => {
    const a = { sortKey: 1, tieKey: 2, stableId: "a" };
    const b = { sortKey: 1, tieKey: 3, stableId: "b" };
    const c = { sortKey: 2, tieKey: 0, stableId: "c" };
    assert.equal(compareDrawOrder(a, b), -1);
    assert.equal(compareDrawOrder(b, a), 1);
    assert.equal(compareDrawOrder(a, c), -1);
  });
});

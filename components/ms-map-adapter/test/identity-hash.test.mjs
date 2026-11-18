import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertTraceable } from "../src/validate.mjs";
import { buildMapProjection } from "../src/index.mjs";
import { resetSyntheticFsdb, writeSyntheticMap } from "./fixtures/synthetic-fsdb.mjs";

const SUITE = "identity-hash";

describe("identity and projection hash", () => {
  let fsdbRoot;

  before(async () => {
    fsdbRoot = await resetSyntheticFsdb(SUITE);
    await writeSyntheticMap({ suiteId: SUITE, mapId: "900000020" });
  });

  after(async () => {
    await resetSyntheticFsdb(SUITE);
  });

  it("traces every drawable to mapId/group/sourceOrder", async () => {
    const result = await buildMapProjection({ mapId: "900000020", fsdbRoot });
    assert.ok(result.scene.drawables.length > 0);
    for (const drawable of result.scene.drawables) {
      assertTraceable(drawable);
      assert.match(drawable.stableId, new RegExp(`map${result.scene.mapId}`));
    }
    for (const portal of result.scene.portals) {
      assert.equal(portal.mapId, "900000020");
      assert.ok(Number.isInteger(portal.sourceOrder));
      assert.match(portal.stableId, /portal:map900000020:\d+/);
    }
  });

  it("produces a stable projection hash for identical inputs", async () => {
    const a = await buildMapProjection({ mapId: "900000020", fsdbRoot });
    const b = await buildMapProjection({ mapId: "900000020", fsdbRoot });
    assert.equal(a.projection.hash, b.projection.hash);
    assert.match(a.projection.hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(a.paintUnits.length, b.paintUnits.length);
    assert.deepEqual(
      a.paintUnits.map((u) => [u.kind, u.stableId, u.stackRank]),
      b.paintUnits.map((u) => [u.kind, u.stableId, u.stackRank]),
    );
  });

  it("embeds provenance on render nodes without FSDB paths", async () => {
    const result = await buildMapProjection({ mapId: "900000020", fsdbRoot });
    const batch = result.projection.root.children.find((node) => node.tag === "ms-map-batch");
    assert.ok(batch);
    for (const placement of batch.data.placements) {
      assert.equal(placement.provenance.mapId, "900000020");
      assert.ok(["tile", "obj"].includes(placement.provenance.group));
      assert.ok(Number.isInteger(placement.provenance.sourceOrder));
    }
    const json = JSON.stringify(result.projection.root);
    assert.equal(json.includes("[FSDB]"), false);
    assert.equal(json.includes("content/"), false);
    for (const node of result.projection.root.children) {
      if (node.tag === "ms-map-batch") {
        for (const page of Object.values(node.data.sprites.pages)) {
          assert.equal(page.resource.namespace, "resource.Map");
          assert.match(page.resource.contentVersion, /^sha256:[0-9a-f]{64}$/);
        }
      }
    }
  });
});

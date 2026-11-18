import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  buildMapProjection,
  NO_VISUAL_PORTAL,
  RESOURCE_MISSING,
  SOURCE_ABSENT,
  SOURCE_EMPTY,
  SOURCE_PRESENT,
  VISUAL_PORTAL,
} from "../src/index.mjs";
import { resetSyntheticFsdb, writeSyntheticMap } from "./fixtures/synthetic-fsdb.mjs";

const SUITE = "validate";

describe("content validator distinctions", () => {
  let fsdbRoot;

  before(async () => {
    fsdbRoot = await resetSyntheticFsdb(SUITE);
  });

  after(async () => {
    await resetSyntheticFsdb(SUITE);
  });

  it("distinguishes SOURCE-ABSENT seat from SOURCE-PRESENT groups", async () => {
    await writeSyntheticMap({ suiteId: SUITE, mapId: "900000001", includeSeat: false });
    const result = await buildMapProjection({ mapId: "900000001", fsdbRoot });
    assert.equal(result.scene.groupStatus.seat, SOURCE_ABSENT);
    assert.equal(result.scene.groupStatus.back, SOURCE_PRESENT);
    assert.equal(result.scene.groupStatus.tile, SOURCE_PRESENT);
    assert.ok(result.closure.absentGroups.includes("seat"));
    assert.ok(result.closure.presentGroups.includes("portal"));
  });

  it("distinguishes SOURCE-EMPTY tile group from absent", async () => {
    await writeSyntheticMap({ suiteId: SUITE, mapId: "900000002", emptyTile: true });
    const result = await buildMapProjection({ mapId: "900000002", fsdbRoot });
    assert.equal(result.scene.groupStatus.tile, SOURCE_EMPTY);
    assert.ok(result.closure.emptyGroups.includes("tile"));
    assert.equal(result.closure.absentGroups.includes("tile"), false);
  });

  it("reports RESOURCE-MISSING without inventing bytes", async () => {
    await writeSyntheticMap({ suiteId: SUITE, mapId: "900000003", missingResource: true });
    const result = await buildMapProjection({ mapId: "900000003", fsdbRoot });
    const missing = result.scene.diagnostics.filter((d) => d.code === RESOURCE_MISSING);
    assert.ok(missing.length >= 1);
    assert.ok(missing.some((d) => String(d.resourceKey).includes("tile/toy")));
    assert.equal(result.closure.ok, false);
  });

  it("distinguishes no-visual portals from visual portals", async () => {
    await writeSyntheticMap({ suiteId: SUITE, mapId: "900000004" });
    const result = await buildMapProjection({ mapId: "900000004", fsdbRoot });
    const byPn = Object.fromEntries(result.scene.portals.map((p) => [p.pn, p]));
    assert.equal(byPn.sp.visualStatus, NO_VISUAL_PORTAL);
    assert.equal(byPn.east00.visualStatus, VISUAL_PORTAL);
    assert.equal(result.closure.noVisualPortals.length, 1);
    assert.equal(result.closure.visualPortals.length, 1);
    assert.ok(result.ordered.some((d) => d.sourceKind === "portal-visual" && d.sourceOrder === 1));
    assert.equal(
      result.ordered.some((d) => d.sourceKind === "portal-visual" && d.sourceOrder === 0),
      false,
    );
  });

  it("keeps physical JSONL line order authoritative", async () => {
    await writeSyntheticMap({
      suiteId: SUITE,
      mapId: "900000005",
      authoredSourceOrder: 999,
    });
    const result = await buildMapProjection({ mapId: "900000005", fsdbRoot });
    assert.equal(result.facts.groups.tile.rows[0].sourceOrder, 0);
    assert.equal(result.scene.drawables.some((item) => item.stableId === "tile:map900000005:0"), true);
    assert.equal(result.scene.drawables.some((item) => item.stableId.includes(":999")), false);
  });

  it("does not report malformed JSONL as a valid closure", async () => {
    await writeSyntheticMap({ suiteId: SUITE, mapId: "900000006", malformedTile: true });
    const result = await buildMapProjection({ mapId: "900000006", fsdbRoot });
    assert.equal(result.closure.ok, false);
    assert.ok(result.closure.fatalDiagnostics.some((item) => item.code === "jsonl-parse-error"));
  });

  it("does not report an unresolved frame reference as a valid closure", async () => {
    await writeSyntheticMap({ suiteId: SUITE, mapId: "900000007", omitTileFrame: true });
    const result = await buildMapProjection({ mapId: "900000007", fsdbRoot });
    assert.equal(result.closure.ok, false);
    assert.ok(result.closure.unresolvedDrawables.some((item) => item.sourceKind === "tile"));
    assert.ok(result.scene.diagnostics.some((item) => item.code === "tile-frame-missing"));
  });
});

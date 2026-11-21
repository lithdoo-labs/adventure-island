import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  SOURCE_ABSENT,
  SOURCE_PRESENT,
  NO_VISUAL_PORTAL,
  VISUAL_PORTAL,
  assertStrictlyIncreasingOrder,
  buildMapProjection,
  tileSortKey,
  objSortKey,
} from "../src/index.mjs";
import { assertTraceable } from "../src/validate.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MAP_ID = "222000000";

describe("real map 222000000 closure + projection", () => {
  it("loads FSDB closure, stable order, identities, and projection hash", async () => {
    const first = await buildMapProjection({ mapId: MAP_ID, gameRoot: repoRoot });
    const second = await buildMapProjection({ mapId: MAP_ID, gameRoot: repoRoot });

    assert.equal(first.scene.status, SOURCE_PRESENT);
    assert.equal(first.scene.groupStatus.back, SOURCE_PRESENT);
    assert.equal(first.scene.groupStatus.tile, SOURCE_PRESENT);
    assert.equal(first.scene.groupStatus.obj, SOURCE_PRESENT);
    assert.equal(first.scene.groupStatus.foothold, SOURCE_PRESENT);
    assert.equal(first.scene.groupStatus.portal, SOURCE_PRESENT);
    assert.equal(first.scene.groupStatus.rope, SOURCE_PRESENT);
    assert.equal(first.scene.groupStatus.seat, SOURCE_ABSENT);

    assert.equal(first.facts.groups.back.rows.length, 16);
    assert.equal(first.facts.groups.tile.rows.length, 795);
    assert.equal(first.facts.groups.obj.rows.length, 300);
    assert.equal(first.facts.groups.portal.rows.length, 22);
    assert.equal(first.facts.groups.foothold.rows.length, 376);

    assert.equal(first.scene.bounds.source, "vr");
    assert.equal(first.scene.bounds.adjustment, "client-vr-inset");
    assert.equal(first.scene.bounds.effectiveBounds.left, -3110);
    assert.equal(first.scene.bounds.effectiveBounds.top, -700);
    assert.equal(first.scene.bounds.effectiveBounds.right, 3200);
    assert.equal(first.scene.bounds.effectiveBounds.bottom, 210);

    const noVisual = first.scene.portals.filter((p) => p.visualStatus === NO_VISUAL_PORTAL);
    const visual = first.scene.portals.filter((p) => p.visualStatus === VISUAL_PORTAL);
    assert.ok(noVisual.length > 0);
    assert.ok(visual.length > 0);
    assert.ok(noVisual.some((p) => p.pt === 0 || p.pt === 1 || p.pt === 6));
    assert.ok(visual.some((p) => p.pt === 2 || p.pt === 10));

    for (const drawable of first.scene.drawables) {
      assertTraceable(drawable);
    }

    assertStrictlyIncreasingOrder(first.ordered);
    assert.equal(first.projection.hash, second.projection.hash);
    assert.equal(
      first.projection.hash,
      "sha256:ae366e03dd3b1d4f87796e26fa7cadfab159df24feb803abceb7953cf814e3b0",
    );

    // Spot-check first tile/obj keys against CMS079 formulas.
    const firstTile = first.facts.groups.tile.rows[0];
    const tileDrawable = first.scene.drawables.find((d) => d.stableId === `tile:map${MAP_ID}:0`);
    assert.ok(tileDrawable?.resolved);
    assert.equal(
      tileDrawable.sortKey,
      tileSortKey(tileDrawable.canvasZ, Number(firstTile.layer), Number(firstTile.zM)),
    );

    const firstObj = first.facts.groups.obj.rows[0];
    const objDrawable = first.scene.drawables.find((d) => d.stableId === `obj:map${MAP_ID}:0`);
    assert.ok(objDrawable?.resolved);
    assert.equal(objDrawable.sortKey, objSortKey(Number(firstObj.layer), Number(firstObj.z)));

    assert.ok(first.paintUnits.length >= 2);
    assert.ok(first.paintUnits.some((u) => u.kind === "ms-map-batch"));
    assert.ok(first.paintUnits.every((u, index) => u.stackRank === index + 1));
    assert.equal(first.paintUnits.length, 297);
    assert.equal(first.paintUnits.filter((u) => u.kind === "ms-map-back").length, 16);
    assert.equal(first.paintUnits.filter((u) => u.kind === "ms-map-batch").length, 253);
    assert.equal(first.paintUnits.filter((u) => u.kind === "ms-map-object").length, 25);
    assert.equal(first.paintUnits.filter((u) => u.kind === "ms-portal-visual").length, 3);
    assert.ok(
      first.paintUnits
        .filter((u) => u.kind === "ms-map-batch")
        .every((u) => u.budgetCompliance.ok && u.resourceCount <= u.budget.maxResources),
    );
    const animatedIds = new Set(
      first.ordered.filter((item) => item.updateClass === "local-animation").map((item) => item.stableId),
    );
    assert.equal(
      first.paintUnits
        .filter((u) => u.kind === "ms-map-batch")
        .some((u) => u.placements.some((placement) => animatedIds.has(placement.placementId))),
      false,
    );

    // Resource refs are logical and versioned.
    assert.ok(first.scene.resources.length > 0);
    for (const resource of first.scene.resources) {
      assert.equal(resource.namespace, "resource.Map");
      assert.match(resource.contentVersion, /^sha256:[0-9a-f]{64}$/);
      assert.equal(resource.key.includes("\\"), false);
      assert.equal(resource.key.startsWith("/"), false);
    }

    const treeJson = JSON.stringify(first.projection);
    assert.equal(/\[FSDB\]|Map\.wz|\.img\b|content\\/i.test(treeJson), false);
    assert.equal(treeJson.includes("sourceResourceKey"), false);
    assert.equal(first.projection.root.tag, "ms-scene-view");
    assert.equal(first.projection.root.data.mapId, MAP_ID);
    assert.equal(first.projection.root.children.length, first.paintUnits.length);

    // Closure distinguishes missing resources (none expected on this map).
    assert.equal(first.closure.missingResources.length, 0);
    assert.ok(first.closure.absentGroups.includes("seat"));
    assert.ok(first.closure.noVisualPortals.length > 0);
  });
});

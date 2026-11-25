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
import { hiddenPortalClipSources } from "../src/resolve.mjs";
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

    const east = first.scene.drawables.find((d) => d.sourceKind === "portal-visual" && d.placement?.pn === "east00");
    assert.equal(east.presentation, "loop");
    assert.equal(east.visualName, "pv");
    assert.equal(east.frames.length, 8);
    assert.deepEqual(east.frames.map((frame) => frame.delay), [120, 120, 120, 120, 120, 120, 120, 120]);
    assert.deepEqual(east.frames[0].origin, [43, 173]);
    assert.deepEqual(east.frames[6].origin, [41, 248]);
    const eastNode = first.projection.root.children.find((child) => child.key === east.stableId);
    assert.equal(eastNode.data.phase, "loop");
    assert.equal(eastNode.data.frames[2].delay, 120);
    assert.deepEqual(eastNode.data.frames[2].draw.origin, east.frames[2].origin);
    const hidden = first.scene.drawables.find((d) => d.sourceKind === "portal-visual" && d.placement?.pn === "ph00");
    assert.equal(hidden.presentation, "sequence");
    assert.equal(hidden.clips.portalStart.length, 4);
    assert.equal(hidden.clips.portalContinue.length, 7);
    assert.equal(hidden.clips.portalExit.length, 3);
    assert.equal(hidden.frames.length, 14);
    assert.ok(hidden.frames.every((frame) => frame.delay === 120));
    const hiddenNode = first.projection.root.children.find((child) => child.key === hidden.stableId);
    assert.equal(hiddenNode.data.phase, "sequence");
    assert.equal(hiddenNode.attrs.visible, "false");
    assert.equal(hiddenNode.data.clips.portalContinue[0].delay, 120);
    assert.equal(hiddenNode.data.frames.length, 14);

    for (const drawable of first.scene.drawables) {
      assertTraceable(drawable);
    }

    assertStrictlyIncreasingOrder(first.ordered);
    assert.equal(first.projection.hash, second.projection.hash);
    assert.equal(
      first.projection.hash,
      "sha256:db247ee94f52a0b174ba2bc4e1036cdbb184a3c32f98018c4e5220b7d9c4bfda",
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
    const backs = first.ordered.filter((item) => item.sourceKind === "back");
    const backAt = (no) => backs.findIndex((item) => Number(item.placement.no) === no);
    assert.ok(backAt(2) < backAt(4), "distant lake stays behind the meadow");
    assert.ok(backAt(2) < backAt(6), "distant lake stays behind the near forest");
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
    assert.deepEqual(hiddenPortalClipSources(10, "default"), {
      portalStart: ["ph", "default"],
      portalContinue: ["ph", "default"],
      portalExit: ["ph", "default"],
    });
    assert.deepEqual(hiddenPortalClipSources(11, "2"), {
      portalStart: ["psh", "2"],
      portalContinue: ["ph", "2"],
      portalExit: ["psh", "2"],
    });
  });
});

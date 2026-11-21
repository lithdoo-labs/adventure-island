import assert from "node:assert/strict";
import test from "node:test";
import { buildMapProjection } from "../src/index.mjs";
import { RESOURCE_MISSING } from "../src/status.mjs";
import { resetSyntheticFsdb, writeSyntheticMap } from "./fixtures/synthetic-fsdb.mjs";

const SUITE = "back-animation";

test("animated Back resolves ordered frames and full resource closure", async () => {
  await resetSyntheticFsdb(SUITE);
  const fixture = await writeSyntheticMap({ suiteId: SUITE, mapId: "900000040", animatedBack: true });
  const projection = await buildMapProjection({
    mapId: fixture.mapId,
    fsdbRoot: fixture.fsdbRoot,
    viewport: { width: 320, height: 240 },
  });
  const back = projection.projection.root.children.find((child) => child.tag === "ms-map-back");
  assert.ok(back);
  assert.equal(back.data.mode, "local-animation");
  assert.equal(back.data.frames.length, 2);
  assert.equal(back.data.frames[0].delay, 90);
  assert.equal(back.data.frames[1].delay, 110);
  assert.equal(back.data.frames[1].image.pageWidth, 10);
  assert.deepEqual(back.data.frames[1].draw.origin, [1, 0]);
  assert.deepEqual(back.data.frames.map((frame) => frame.offset), [[1, 0], [0, 0]]);
  assert.equal(back.data.layout.frameWidth, 10);
  assert.equal(back.data.layout.frameHeight, 9);
  assert.equal(back.attrs["view-x"], "-1");
  assert.equal(back.attrs["view-y"], "0");
  assert.equal(back.data.image, undefined);
  assert.equal(projection.scene.resources.length, 5);
  const drawable = projection.scene.drawables.find((item) => item.stableId === back.key);
  assert.equal(drawable.frames.length, 2);
  assert.equal(drawable.updateClass, "local-animation");
});

test("animated Back rejects a missing later frame without publishing a partial closure", async () => {
  const suiteId = `${SUITE}-missing`;
  await resetSyntheticFsdb(suiteId);
  const fixture = await writeSyntheticMap({
    suiteId,
    mapId: "900000041",
    animatedBack: true,
    missingAnimatedBackResource: true,
  });
  const projection = await buildMapProjection({ mapId: fixture.mapId, fsdbRoot: fixture.fsdbRoot });
  const drawable = projection.scene.drawables.find((item) => item.sourceKind === "back");
  assert.equal(drawable.resolved, false);
  assert.equal(projection.projection.root.children.some((child) => child.key === drawable.stableId), false);
  assert.ok(projection.scene.diagnostics.some((item) => (
    item.code === RESOURCE_MISSING
    && item.stableId === drawable.stableId
    && item.resourceKey === "back/toy/back/1"
    && item.frame === 1
  )));
});

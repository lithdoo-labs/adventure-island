import assert from "node:assert/strict";
import test from "node:test";
import { writeSyntheticMap, resetSyntheticFsdb } from "../../ms-map-adapter/test/fixtures/synthetic-fsdb.mjs";
import { buildFieldProjection } from "../src/field-project.mjs";
import { validateBackData, validateFieldTree, validateMapObjectData } from "../src/validate.mjs";

test("field tree validator rejects broken stack-ranks", async () => {
  const suiteId = `field-validate-${Date.now()}`;
  const fsdbRoot = await resetSyntheticFsdb(suiteId);
  await writeSyntheticMap({ suiteId });
  const projection = await buildFieldProjection({ mapId: "900000001", fsdbRoot, paintUnitCap: 4 });
  const broken = structuredClone(projection.root);
  broken.children[0].attrs["stack-rank"] = "99";
  assert.equal(validateFieldTree(broken).ok, false);
});

test("Back layout validator rejects forged surfaces and zero-step repetition", async () => {
  const projection = await buildFieldProjection({
    gameRoot: process.cwd(),
    mapId: "230030200",
    viewport: { width: 800, height: 600 },
  });
  const back = projection.root.children.find((child) => child.tag === "ms-map-back" && child.data.layout?.tileHorizontal);
  assert.ok(back);
  assert.equal(validateBackData(back.data).ok, true);

  const oversized = structuredClone(back.data);
  oversized.layout.canvasWidth = 10_000;
  assert.equal(validateBackData(oversized).ok, false);

  const zeroStepRepeat = structuredClone(back.data);
  zeroStepRepeat.layout.tileStepX = 0;
  assert.equal(validateBackData(zeroStepRepeat).ok, false);

  const forgedPage = structuredClone(back.data);
  forgedPage.image.pageWidth += 1;
  assert.equal(validateBackData(forgedPage).ok, false);
});

test("animated Back validator accepts ordered frames and rejects forged identity mixing", async () => {
  const projection = await buildFieldProjection({
    gameRoot: process.cwd(),
    mapId: "230030200",
    viewport: { width: 1000, height: 700 },
  });
  const back = projection.root.children.find((child) => child.tag === "ms-map-back" && child.data?.mode === "local-animation");
  assert.ok(back);
  assert.equal(validateBackData(back.data).ok, true);
  const forged = structuredClone(back.data);
  forged.image = back.data.frames[0].image;
  assert.equal(validateBackData(forged).ok, false);

  const outsideSurface = structuredClone(back.data);
  outsideSurface.frames[0].offset[0] = outsideSurface.layout.frameWidth;
  assert.equal(validateBackData(outsideSurface).ok, false);

  const missingSurface = structuredClone(back.data);
  missingSurface.layout = null;
  assert.equal(validateBackData(missingSurface).ok, false);

  const unordered = structuredClone(back.data);
  unordered.frames[1].frame = unordered.frames[0].frame;
  assert.equal(validateBackData(unordered).ok, false);
});

test("Obj flow validator bounds frames and rejects forged source/layout values", async () => {
  const projection = await buildFieldProjection({
    gameRoot: process.cwd(),
    mapId: "230030200",
    viewport: { width: 1000, height: 700 },
  });
  const object = projection.root.children.find(
    (child) => child.tag === "ms-map-object" && child.data?.source?.flow === 1,
  );
  assert.ok(object);
  assert.equal(validateMapObjectData(object.data).ok, true);

  const invalidRx = structuredClone(object.data);
  invalidRx.source.rx = Number.NaN;
  assert.equal(validateMapObjectData(invalidRx).ok, false);

  const missingAnchor = structuredClone(object.data);
  delete missingAnchor.layout.anchorOffsetX;
  assert.equal(validateMapObjectData(missingAnchor).ok, false);

  const excessiveFrames = structuredClone(object.data);
  excessiveFrames.frames = Array.from({ length: 129 }, () => object.data.frames[0]);
  assert.equal(validateMapObjectData(excessiveFrames).ok, false);
});

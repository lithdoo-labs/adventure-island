import assert from "node:assert/strict";
import test from "node:test";
import { writeSyntheticMap, resetSyntheticFsdb } from "../../ms-map-adapter/test/fixtures/synthetic-fsdb.mjs";
import { buildFieldProjection } from "../src/field-project.mjs";
import { validateBackData, validateFieldTree } from "../src/validate.mjs";

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

import assert from "node:assert/strict";
import test from "node:test";
import { writeSyntheticMap, resetSyntheticFsdb } from "../../ms-map-adapter/test/fixtures/synthetic-fsdb.mjs";
import { buildFieldProjection } from "../src/field-project.mjs";
import { validateFieldTree } from "../src/validate.mjs";

test("field tree validator rejects broken stack-ranks", async () => {
  const suiteId = `field-validate-${Date.now()}`;
  const fsdbRoot = await resetSyntheticFsdb(suiteId);
  await writeSyntheticMap({ suiteId });
  const projection = await buildFieldProjection({ mapId: "900000001", fsdbRoot, paintUnitCap: 4 });
  const broken = structuredClone(projection.root);
  broken.children[0].attrs["stack-rank"] = "99";
  assert.equal(validateFieldTree(broken).ok, false);
});
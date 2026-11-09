import test from "node:test";
import assert from "node:assert/strict";
import { deriveOcclusionFields } from "../src/real-look-adapter.mjs";

const zOrder = ["cap", "hairOverHead", "hair", "body", "Cp", "Hr", "Bd"];
const smap = {
  cap: "CpH1H5",
  hairOverHead: "H1",
  hair: "H2",
  body: "MaGw",
};

test("derives CMS079 priority from islot and tag from vslot intersect smap[z]", () => {
  assert.deepEqual(
    deriveOcclusionFields({ z: "cap", islot: "Cp", vslot: "CpH1H5", zOrder, smap }),
    { priority: -5, tag: ["Cp", "H1", "H5"] },
  );
  assert.deepEqual(
    deriveOcclusionFields({ z: "hairOverHead", islot: "Hr", vslot: "H1H2", zOrder, smap }),
    { priority: -6, tag: ["H1"] },
  );
});

test("fails closed on incomplete or malformed CMS079 slot metadata", () => {
  assert.throws(
    () => deriveOcclusionFields({ z: "cap", islot: "", vslot: "H1", zOrder, smap }),
    /islot is empty while vslot is non-empty/,
  );
  assert.throws(
    () => deriveOcclusionFields({ z: "missing", islot: "Cp", vslot: "Cp", zOrder, smap }),
    /smap has no entry/,
  );
  assert.throws(
    () => deriveOcclusionFields({ z: "cap", islot: "C", vslot: "Cp", zOrder, smap }),
    /two-character slot tokens/,
  );
  assert.throws(
    () => deriveOcclusionFields({ z: "cap", islot: "No", vslot: "No", zOrder, smap }),
    /absent from zmap/,
  );
});

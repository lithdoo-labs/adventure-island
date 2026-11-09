import test from "node:test";
import assert from "node:assert/strict";
import { buildProductionAvatarPlan, deriveOcclusionFields } from "../src/real-look-adapter.mjs";

const zmap = {
  body: 0,
  face: 1,
  Cp: 10,
  Hr: 7,
  Bd: 3,
};
const smap = {
  body: "Bd",
  face: "",
};

test("derives CMS079 priority from maximum islot zmap value and tag from vslot intersect smap[z]", () => {
  assert.deepEqual(
    deriveOcclusionFields({ z: "body", islot: "Cp", vslot: "CpH1H5", zmap, smap }),
    { priority: 10, tag: ["Bd"] },
  );
  assert.deepEqual(
    deriveOcclusionFields({ z: "body", islot: "HrBd", vslot: "H1Bd", zmap, smap }),
    { priority: 7, tag: ["Bd"] },
  );
});

test("fails closed on incomplete or malformed CMS079 slot metadata", () => {
  assert.throws(
    () => deriveOcclusionFields({ z: "body", islot: "", vslot: "H1", zmap, smap }),
    /islot is empty while vslot is non-empty/,
  );
  assert.throws(
    () => deriveOcclusionFields({ z: "missing", islot: "Cp", vslot: "Cp", zmap, smap }),
    /smap has no entry/,
  );
  assert.throws(
    () => deriveOcclusionFields({ z: "body", islot: "C", vslot: "Cp", zmap, smap }),
    /two-character slot tokens/,
  );
  assert.throws(
    () => deriveOcclusionFields({ z: "body", islot: "No", vslot: "No", zmap, smap }),
    /absent from zmap/,
  );
  assert.throws(
    () => deriveOcclusionFields({ z: "body", islot: "Cp", vslot: "Cp", zmap: { ...zmap, Cp: "10" }, smap }),
    /must map to an integer/,
  );
});

test("normalizes signed CMS079 frame delays to non-negative AvatarPlan delays", () => {
  const canvas = (z, resource) => ({
    z, resource, width: 2, height: 2, origin: [0, 0],
  });
  const body = {};
  for (const action of ["stand1", "walk1", "jump", "brandish1"]) {
    body[action] = {
      "0": {
        body: canvas("body", "Look/body"),
        face: 1,
        delay: action === "brandish1" ? -120 : 100,
      },
    };
  }
  const face = { default: { face: canvas("face", "Look/face") } };
  const slotMetadata = {
    body: { islot: "Bd", vslot: "Bd" },
    head: { islot: "Hd", vslot: "Hd" },
    face: { islot: "Fc", vslot: "Fc" },
    hair: { islot: "Hr", vslot: "Hr" },
    weapon: { islot: "Wp", vslot: "Wp" },
  };
  const versions = new Map([
    ["Look/body", "sha256:" + "a".repeat(64)],
    ["Look/face", "sha256:" + "b".repeat(64)],
  ]);
  const plan = buildProductionAvatarPlan({
    body,
    head: {},
    face,
    hair: {},
    weapon: { info: { stand: 1, walk: 1 } },
    zmap,
    slotMetadata,
    smap,
    versions,
  });
  assert.equal(plan.actions.brandish1.frames[0].delay, 120);
  assert.equal(plan.actions.stand1.frames[0].delay, 100);
});

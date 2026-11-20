import assert from "node:assert/strict";
import test from "node:test";
import { buildPortalLogicalIndex, validatePortalLogicalIndex } from "../portal-logical-index.mjs";
import { fieldPlanContentKey } from "../field-plan-keys.mjs";
import { PORTAL_LOGICAL_INDEX_MAX } from "../portal-constants.mjs";

test("buildPortalLogicalIndex throws when rows exceed cap", () => {
  const rows = Array.from({ length: PORTAL_LOGICAL_INDEX_MAX + 1 }, (_, i) => ({
    sourceOrder: i,
    pn: `p${i}`,
    pt: 1,
    x: 0,
    y: 0,
    tm: 222000001,
    tn: "x",
  }));
  assert.throws(
    () => buildPortalLogicalIndex("222000000", rows, new Set(["222000001"])),
    /exceeds/,
  );
});

test("buildPortalLogicalIndex rejects non-increasing sourceOrder", () => {
  const rows = [
    { sourceOrder: 0, pn: "a", pt: 1, x: 0, y: 0, tm: 222000001, tn: "b" },
    { sourceOrder: 0, pn: "b", pt: 1, x: 0, y: 0, tm: 222000000, tn: "a" },
  ];
  assert.throws(() => buildPortalLogicalIndex("222000000", rows, new Set(["222000001"])), /strictly increase/);
});

test("portal logical index rejects coercible and unsafe target map identities", () => {
  const base = { sourceOrder: 0, pn: "a", pt: 1, x: 0, y: 0, tn: "b" };
  for (const tm of ["222000001", 1.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => buildPortalLogicalIndex("222000000", [{ ...base, tm }], new Set(["222000001"])),
      /portal tm/u,
    );
  }
});

test("validated portal index freezes the nested entries", () => {
  const value = {
    formatVersion: 1,
    mapId: "222000000",
    entries: [{
      sourceOrder: 0,
      name: "a",
      type: 1,
      x: 0,
      y: 0,
      targetMap: 222000001,
      targetName: "b",
      enabled: true,
    }],
  };
  const validated = validatePortalLogicalIndex(value, "222000000");
  assert.equal(Object.isFrozen(validated), true);
  assert.equal(Object.isFrozen(validated.entries), true);
  assert.equal(Object.isFrozen(validated.entries[0]), true);
});

test("fieldPlanContentKey rejects omitted and non-canonical map ids", () => {
  assert.throws(() => fieldPlanContentKey(), /numeric map id/u);
  assert.throws(() => fieldPlanContentKey("map222000001"), /numeric map id/u);
  assert.equal(fieldPlanContentKey("222000000"), "bootstrap");
  assert.equal(fieldPlanContentKey("222000001"), "map222000001");
});

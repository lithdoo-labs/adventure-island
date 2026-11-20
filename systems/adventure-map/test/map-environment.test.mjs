import assert from "node:assert/strict";
import test from "node:test";
import { validateFieldPlan } from "../field-plan-model.mjs";
import { validateMapEnvironment } from "../map-environment.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";

const stamp = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

test("map environment rejects noncanonical ids and malformed swim facts", () => {
  const valid = {
    formatVersion: 1,
    mapId: "230030200",
    swim: 1,
    source: {
      namespace: "struct.map.Map",
      key: "map.230030200",
      contentVersion: stamp,
    },
  };
  assert.doesNotThrow(() => validateMapEnvironment(valid));
  assert.throws(() => validateMapEnvironment({ ...valid, mapId: "sea" }), /nine-digit map id/);
  assert.throws(() => validateMapEnvironment({ ...valid, swim: "1" }), /swim must be 0 or 1/);
});

test("FieldPlan rejects a map environment for a different map", async () => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({ mapId: "222000000" });
  const candidate = structuredClone(plan);
  candidate.mapEnvironment.mapId = "222000001";
  candidate.mapEnvironment.source.key = "map.222000001";
  assert.throws(() => validateFieldPlan(candidate), /mapEnvironment must describe the same mapId/);
});

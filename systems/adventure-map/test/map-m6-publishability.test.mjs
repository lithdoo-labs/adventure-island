import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../../components/ms-map-adapter/src/index.mjs";
import {
  assertM6ExtraMapFieldPlanPublishable,
  M6_222000001_KNOWN_UNRESOLVED_BACK,
} from "../map-m6-publishability.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("222000001 publishability allows only the empty-bS back unresolved drawable", async () => {
  const projection = await buildMapProjection({ mapId: "222000001", gameRoot: repoRoot });
  assert.equal(projection.closure.ok, false);
  assert.equal(projection.closure.missingResources.length, 0);
  assert.equal(projection.closure.fatalDiagnostics.length, 0);
  assert.equal(projection.closure.unresolvedDrawables.length, 1);
  assert.equal(projection.closure.unresolvedDrawables[0].stableId, M6_222000001_KNOWN_UNRESOLVED_BACK.stableId);
  assert.doesNotThrow(() => assertM6ExtraMapFieldPlanPublishable("222000001", projection.closure));
});

test("222000001 rejects extra unresolved drawables", async () => {
  const projection = await buildMapProjection({ mapId: "222000001", gameRoot: repoRoot });
  const tainted = {
    ...projection.closure,
    unresolvedDrawables: Object.freeze([
      ...projection.closure.unresolvedDrawables,
      Object.freeze({ stableId: "obj:fake", sourceKind: "obj", sourceOrder: 0 }),
    ]),
  };
  assert.throws(
    () => assertM6ExtraMapFieldPlanPublishable("222000001", tainted),
    /exactly one known unresolved/u,
  );
});

test("222000001 rejects a lookalike unresolved back without the exact empty-bS fact", async () => {
  const projection = await buildMapProjection({ mapId: "222000001", gameRoot: repoRoot });
  const only = projection.closure.unresolvedDrawables[0];
  const tainted = {
    ...projection.closure,
    unresolvedDrawables: [{ ...only, placement: { ...only.placement, bS: "not-empty" } }],
  };
  assert.throws(
    () => assertM6ExtraMapFieldPlanPublishable("222000001", tainted),
    /empty bS/u,
  );
});

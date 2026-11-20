import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFieldProjection } from "../src/field-project.mjs";
import { validateFieldTree } from "../src/validate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Soft M3 Node budget on Windows dev hardware; not a product SLA. */
const FULL_MAP_PROJECTION_BUDGET_MS = 8_000;

test("full 222000000 field projection validates within node baseline budget", async (t) => {
  const started = performance.now();
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    viewport: { width: 800, height: 600 },
  });
  const elapsed = performance.now() - started;

  assert.equal(validateFieldTree(projection.root).ok, true);
  assert.equal(projection.root.children.length, 298);
  assert.equal(projection.map.paintUnits.length, 297);
  assert.ok(
    elapsed < FULL_MAP_PROJECTION_BUDGET_MS,
    `full field projection took ${elapsed.toFixed(1)}ms (budget ${FULL_MAP_PROJECTION_BUDGET_MS}ms)`,
  );
  t.diagnostic(`full field projection ${elapsed.toFixed(1)}ms / ${FULL_MAP_PROJECTION_BUDGET_MS}ms budget`);
});

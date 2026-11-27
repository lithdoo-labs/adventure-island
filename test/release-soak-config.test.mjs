import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSoakCycleSizes,
  parseReleaseSoakConfig,
} from "./release-soak-shared.mjs";

test("release soak defaults to a bounded six-cycle developer gate", () => {
  const config = parseReleaseSoakConfig({});
  assert.equal(config.qualification, false);
  assert.equal(config.durationMs, 0);
  assert.equal(config.cycles, 6);
  assert.equal(buildSoakCycleSizes(config).length, 6);
});

test("release soak accepts an explicit 30-minute qualification", () => {
  const config = parseReleaseSoakConfig({
    ADVENTURE_RELEASE_SOAK_MS: "1800000",
    ADVENTURE_RELEASE_SOAK_CYCLES: "60",
  });
  assert.equal(config.qualification, true);
  assert.equal(config.durationMs, 1_800_000);
  assert.equal(config.cycles, 60);
});

test("release soak rejects malformed or negative configuration", () => {
  assert.throws(
    () => parseReleaseSoakConfig({ ADVENTURE_RELEASE_SOAK_MS: "NaN" }),
    /finite non-negative/,
  );
  assert.throws(
    () => parseReleaseSoakConfig({ ADVENTURE_RELEASE_SOAK_CYCLES: "-1" }),
    /non-negative integer/,
  );
});

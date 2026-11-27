import assert from "node:assert/strict";
import test from "node:test";
import {
  M7_8_RELEASE_VALIDATION_BUDGETS,
} from "../systems/adventure-map/portal-budgets.mjs";
import {
  assertReleaseSoakBudgets,
  buildSoakCycleSizes,
  collectReleaseSoakSnapshot,
  parseReleaseSoakConfig,
  runViewportResizeSoakCycle,
} from "./release-soak-shared.mjs";
import { launchChromium } from "../components/cms-actor/test/harness.mjs";

const soakConfig = parseReleaseSoakConfig();
const testTimeout = soakConfig.qualification
  ? M7_8_RELEASE_VALIDATION_BUDGETS.maxReleaseSoakDurationMs + 120_000
  : 240_000;

test("M7.8 bounded release soak on canonical PWA", { timeout: testTimeout }, async (t) => {
  const url = process.env.LOOMREALM_PWA_URL;
  assert.ok(url?.endsWith("/pwa/adventure-island/"), "LOOMREALM_PWA_URL staging scope is required");
  const browser = await launchChromium();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const state = document.documentElement.dataset.loomrealmProduct;
      return state === "ready" || state === "failed";
    }, null, { timeout: 45_000 });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.loomrealmProduct), "ready");
    await page.waitForFunction(() => (
      [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object")]
        .length >= 100
        && [...document.querySelectorAll("ms-map-back, ms-map-object")]
          .every((host) => host.diagnostics().state === "ready")
    ), null, { timeout: 90_000 });

    // Warm the published walk action before taking the stability baseline.
    // The first transition may populate the Avatar page cache; subsequent
    // movement updates during the soak must reuse it without Content reads.
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(() => document.querySelector("ms-avatar")?.getAttribute("action") === "walk1", null, { timeout: 10_000 });
    await page.keyboard.up("ArrowRight");
    await page.waitForFunction(() => (
      document.querySelector("ms-avatar")?.getAttribute("action") === "stand1"
      && document.querySelector("ms-avatar")?.diagnostics?.().state === "ready"
    ), null, { timeout: 10_000 });
    let before = await collectReleaseSoakSnapshot(page);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.waitForTimeout(250);
      const next = await collectReleaseSoakSnapshot(page);
      if (next.resourceReads === before.resourceReads) {
        before = next;
        break;
      }
      before = next;
    }
    assert.ok(before.relayoutBackCount > 0, "canonical scene must expose viewport-bound Back hosts");
    assert.equal(before.relayoutObjectCount, 0);
    const sizes = buildSoakCycleSizes(soakConfig);
    const deadline = soakConfig.qualification && soakConfig.durationMs > 0
      ? Date.now() + soakConfig.durationMs
      : null;
    let cyclesRun = 0;
    let maxEventLoopLagMs = 0;
    let index = 0;
    while (index < sizes.length) {
      if (deadline !== null && Date.now() >= deadline) break;
      const size = sizes[index];
      const { eventLoopLagMs } = await runViewportResizeSoakCycle(page, size, before.relayoutBackCount);
      maxEventLoopLagMs = Math.max(maxEventLoopLagMs, eventLoopLagMs);
      cyclesRun += 1;
      index += 1;
      if (deadline !== null && Date.now() < deadline) {
        sizes.push(soakConfig.alternateSizes[index % soakConfig.alternateSizes.length]);
      }
    }
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(() => document.querySelector("ms-avatar")?.getAttribute("action") === "walk1", null, { timeout: 10_000 });
    await page.keyboard.up("ArrowRight");
    await page.waitForFunction(() => document.querySelector("ms-avatar")?.getAttribute("action") === "stand1", null, { timeout: 10_000 });
    await page.waitForTimeout(300);
    const after = await collectReleaseSoakSnapshot(page);
    assertReleaseSoakBudgets(before, after, {
      eventLoopLagMs: maxEventLoopLagMs,
      cycleCount: cyclesRun,
      qualification: soakConfig.qualification,
    });
    t.diagnostic(`M7.8 release soak cycles=${cyclesRun} qualification=${soakConfig.qualification}; heap ${after.heapProxy.toFixed(1)}; lag ${maxEventLoopLagMs.toFixed(1)}ms`);
  } finally {
    await browser.close();
  }
});

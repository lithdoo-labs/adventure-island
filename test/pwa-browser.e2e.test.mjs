import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

// Resolve Playwright from the exact pinned framework workspace installed by CI.
const requireFromFramework = createRequire(new URL("../loom-realm/apps/pwa/package.json", import.meta.url));
const { chromium } = requireFromFramework("playwright");

// Unlike the framework's persistent demo, the Adventure Island Smoke
// subsystem completes its initial Frame immediately: the product moves from
// "ready" to "settled" before a browser polling loop may observe "ready".
test("Adventure Island Smoke PWA settles under its isolated Service Worker scope", { timeout: 60_000 }, async () => {
  const url = process.env.LOOMREALM_PWA_URL;
  assert.ok(url?.endsWith("/pwa/adventure-island/"), "real upstream loopback E2E URL must use Adventure Island scope");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "allow" });
    const page = await context.newPage();
    const diagnostics = [];
    page.on("console", (message) => diagnostics.push(`console:${message.type()}:${message.text()}`));
    page.on("pageerror", (error) => diagnostics.push(`pageerror:${error.stack ?? error.message}`));
    page.on("requestfailed", (request) => diagnostics.push(`requestfailed:${request.url()}:${request.failure()?.errorText}`));
    page.on("response", (response) => {
      if (response.status() >= 400) diagnostics.push(`http:${response.status()}:${response.url()}`);
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `index.html response: ${response?.status()}`);

    // A one-frame completed application settles; do NOT use the framework's
    // openProduct() helper, which waits only for "ready"/"failed".
    try {
      await page.waitForFunction(() =>
        document.documentElement.dataset.loomrealmProduct === "settled"
        || document.documentElement.dataset.loomrealmProduct === "failed",
        null, { timeout: 25_000 },
      );
    } catch (cause) {
      const state = await page.evaluate(() => ({
        path: location.pathname,
        dataset: { ...document.documentElement.dataset },
        ready: document.readyState,
        scripts: [...document.scripts].map((s) => s.src),
        pwa: window.__loomrealmPwa
          ? { failure: window.__loomrealmPwa.failure,
              ready: window.__loomrealmPwa.ready,
              statuses: window.__loomrealmPwa.statuses.slice(-8) }
          : null,
        sw: navigator.serviceWorker?.controller?.scriptURL ?? null,
      }));
      throw new Error(`Smoke PWA did not settle: ${cause.message}\n${JSON.stringify({ state, diagnostics }, null, 2)}`);
    }

    const evidence = await page.evaluate(async () => {
      const generation = await (await fetch("./generation.json", { cache: "no-store" })).json();
      const bundle = await (await fetch("./installation-bundle.json", { cache: "no-store" })).json();
      return {
        pathname: location.pathname,
        productState: document.documentElement.dataset.loomrealmProduct,
        controlled: navigator.serviceWorker.controller !== null,
        controllerScript: navigator.serviceWorker.controller?.scriptURL ?? null,
        generation,
        executableModules: bundle.executables.map(({ logicalModule }) => logicalModule),
        contentCount: bundle.content.length,
        failure: window.__loomrealmPwa?.failure ?? null,
        statuses: window.__loomrealmPwa?.statuses ?? [],
      };
    });
    assert.equal(evidence.pathname, "/pwa/adventure-island/");
    assert.equal(evidence.productState, "settled", JSON.stringify({ diagnostics, evidence }));
    assert.equal(evidence.controlled, true, JSON.stringify({ diagnostics, evidence }));
    assert.match(evidence.controllerScript, /\/pwa\/adventure-island\/service-worker\.js$/);
    assert.equal(evidence.generation.appId, "adventure-island");
    assert.equal(evidence.generation.basePath, "/pwa/adventure-island/");
    assert.deepEqual(evidence.executableModules, ["subsystems/smoke.mjs"]);
    assert.equal(evidence.contentCount, 0);
    assert.equal(evidence.failure, null);
    assert.ok(evidence.statuses.some((entry) => entry?.status === "main-started"),
      "the real Runtime must have started Main");
    assert.ok(evidence.statuses.some((entry) => entry?.status === "settled"),
      "the Smoke Frame must settle");
  } finally {
    await browser.close();
  }
});

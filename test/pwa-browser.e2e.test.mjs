import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildAdventureIslandInstallationBundle } from "../scripts/pwa/build-installation-bundle.mjs";
import {
  PRESENTATION_SCRIPT_KEY,
  buildCanonicalSyntheticAvatarContent,
} from "../scripts/pwa/synthetic-avatar-content.mjs";
import { FIXTURE_LOGICAL_MODULE, composeAvatarFixturePayload } from "./pwa-avatar-fixture.mjs";
import { COLORS, FRAME_MARKERS } from "../components/cms-actor/test/synthetic-fsdb.mjs";

const repoRoot = new URL("../", import.meta.url);
const repoRootPath = fileURLToPath(repoRoot);
const CANONICAL_CONTENT_COUNT = buildCanonicalSyntheticAvatarContent().entries.length + 1;

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
        presentationState: document.documentElement.dataset.loomrealmPresentation ?? null,
        cmsActorRegistered: typeof customElements.get("cms-actor"),
        controlled: navigator.serviceWorker.controller !== null,
        controllerScript: navigator.serviceWorker.controller?.scriptURL ?? null,
        generation,
        executableModules: bundle.executables.map(({ logicalModule }) => logicalModule),
        contentCount: bundle.content.length,
        presentationScripts: bundle.presentation.scripts,
        failure: window.__loomrealmPwa?.failure ?? null,
        statuses: window.__loomrealmPwa?.statuses ?? [],
      };
    });
    assert.equal(evidence.pathname, "/pwa/adventure-island/");
    assert.equal(evidence.productState, "settled", JSON.stringify({ diagnostics, evidence }));
    assert.equal(evidence.presentationState, "ready", `the canonical presentation bootstrap must succeed: ${JSON.stringify({ diagnostics, evidence })}`);
    assert.equal(evidence.cmsActorRegistered, "function", "the canonical staging must bootstrap the cms-actor classic script through the Service Worker Content route");
    assert.equal(evidence.controlled, true, JSON.stringify({ diagnostics, evidence }));
    assert.match(evidence.controllerScript, /\/pwa\/adventure-island\/service-worker\.js$/);
    assert.equal(evidence.generation.appId, "adventure-island");
    assert.equal(evidence.generation.basePath, "/pwa/adventure-island/");
    assert.deepEqual(evidence.executableModules, ["subsystems/smoke.mjs"]);
    assert.equal(evidence.contentCount, CANONICAL_CONTENT_COUNT);
    assert.deepEqual(evidence.presentationScripts, [{ namespace: "Presentation", key: PRESENTATION_SCRIPT_KEY }]);
    assert.equal(evidence.failure, null);
    assert.ok(evidence.statuses.some((entry) => entry?.status === "main-started"),
      "the real Runtime must have started Main");
    assert.ok(evidence.statuses.some((entry) => entry?.status === "settled"),
      "the Smoke Frame must settle");
  } finally {
    await browser.close();
  }
});

// ---------------------------------------------------------------------------
// PR-B: real PWA + Service Worker + Renderer Projector synthetic-actor E2E.
//
// Builds the CANONICAL product payload with the real builder, composes the
// isolated avatar-fixture payload from it (same Content, test-only subsystem),
// runs the REAL pinned generic PWA builder, serves the result exactly like
// the CI's staging loopback server, and observes the projected paper doll in
// real Chromium: pixels for stand/walk/jump, Content version rejection and
// missing-resource failures with cleared canvases, recovery, and disconnect
// cancellation with cache release. Never a bare customElements.get check.
// ---------------------------------------------------------------------------

const GENERIC_BUILDER = fileURLToPath(new URL("loom-realm/apps/pwa/scripts/build-bundle.mjs", repoRoot));

/** Explicit, honest skip reasons when the environment lacks a prerequisite. */
async function actorE2eSkipReason() {
  const required = [
    GENERIC_BUILDER,
    fileURLToPath(new URL("loom-realm/apps/pwa/scripts/build-identity.mjs", repoRoot)),
    fileURLToPath(new URL("loom-realm/apps/pwa/scripts/pwa-bundle-id.mjs", repoRoot)),
    fileURLToPath(new URL("loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js", repoRoot)),
  ];
  for (const file of required) {
    try { await access(file); } catch { return `pinned LoomRealm generic PWA builder artifacts are missing (${path.relative(repoRootPath, file)}); run the framework build inside loom-realm/ first`; }
  }
  try {
    requireFromFramework.resolve("esbuild");
  } catch {
    try {
      createRequire(new URL("../loom-realm/package.json", import.meta.url)).resolve("esbuild");
    } catch {
      return "esbuild is not installed inside the pinned loom-realm checkout (the generic builder bundles its runtime scripts with it)";
    }
  }
  return null;
}

/** Staging loopback server with the same semantics as run-e2e.mjs. */
async function serveStaging(dist, basePath) {
  const mime = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"]]);
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith(basePath)) { response.writeHead(404).end(); return; }
    const relative = url.pathname.slice(basePath.length);
    const requested = relative === "" ? "index.html" : relative;
    const file = path.normalize(path.join(dist, requested));
    if (!file.startsWith(path.normalize(dist)) || relative.includes("..")) { response.writeHead(403).end(); return; }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "Content-Type": mime.get(path.extname(file)) ?? "application/octet-stream",
        "Content-Length": info.size,
        "Cache-Control": requested.endsWith("service-worker.js") ? "no-store" : "no-cache",
        "Service-Worker-Allowed": "/",
      });
      if (request.method === "HEAD") response.end(); else createReadStream(file).pipe(response);
    } catch { response.writeHead(404, { "Content-Type": "text/plain" }).end("Not Found"); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return {
    url: `http://127.0.0.1:${server.address().port}${basePath}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForEvaluate(page, expression, label, { timeout = 40_000, arg } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await page.evaluate(expression, arg);
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${label}; last observation: ${JSON.stringify(last)}`);
}

// Scene-space sample points — identical geometry to the component fixture
// (components/cms-actor/test/integration.chromium.test.mjs): body spans
// x[-19,8) y[-32,0); head x[-12,12) y[-34,-10); face x[-6,6) y[-29,-19);
// hair x[-12,12) y[-32,-14) with the transparent hole over the face; weapon
// x[1,17) y[-19,9). The marker row is at the bottom of the body canvas.
const POINTS = {
  headOverBody: [-8, -12],
  bodyOnly: [0, -6],
  hairOverHead: [-10, -20],
  faceThroughHairHole: [0, -24],
  weaponRight: [4, -10],
  marker: [-6, -1],
};

test("the canonical synthetic Content projects a paper-doll actor in the real PWA Service Worker", { timeout: 300_000 }, async (t) => {
  const skipReason = await actorE2eSkipReason();
  if (skipReason !== null) {
    t.skip(skipReason);
    return;
  }

  const work = await mkdtemp(path.join(tmpdir(), "adventure-avatar-e2e-"));
  const fixtureBundlePath = path.join(work, "avatar-fixture-bundle.json");
  const stagingDir = path.join(work, "staging", "adventure-island");
  let browser = null;
  let server = null;
  t.after(async () => {
    await browser?.close().catch(() => {});
    await server?.close().catch(() => {});
    await rm(work, { recursive: true, force: true }).catch(() => {});
  });

  // 1. The CANONICAL product payload from the real builder (real Gitlink pin).
  const canonicalPath = path.join(work, "canonical-bundle.json");
  const canonical = await buildAdventureIslandInstallationBundle({ outputFile: canonicalPath });
  assert.equal(canonical.contentCount, CANONICAL_CONTENT_COUNT);
  const canonicalPayload = JSON.parse(await readFile(canonical.outputFile, "utf8"));

  // 2. The isolated fixture payload: same presentation + Content, test-only
  //    subsystem that projects the plan the builder proved consistent.
  const { payload: fixturePayload } = composeAvatarFixturePayload({ canonicalPayload });
  await writeFile(fixtureBundlePath, `${JSON.stringify(fixturePayload)}\n`, "utf8");

  // 3. The REAL pinned generic PWA builder with the pinned product identity.
  const build = spawnSync(process.execPath, [
    GENERIC_BUILDER,
    "--bundle", fixtureBundlePath,
    "--app-id", "adventure-island",
    "--base-path", "/pwa/adventure-island/",
    "--output-dir", stagingDir,
  ], { cwd: path.dirname(GENERIC_BUILDER), encoding: "utf8" });
  assert.equal(build.status, 0, `the generic PWA builder must succeed: ${build.stderr}\n${build.stdout}`);
  for (const artifact of ["index.html", "window.js", "session-worker.js", "worker-runner.js", "service-worker.js", "installation-bundle.json", "generation.json"]) {
    await access(path.join(stagingDir, artifact));
  }

  // 4. Serve exactly like the CI staging loopback and drive real Chromium.
  server = await serveStaging(stagingDir, "/pwa/adventure-island/");
  try {
    browser = await chromium.launch({ headless: true });
  } catch (cause) {
    t.skip(`Chromium could not be launched in this environment: ${cause.message.split("\n")[0]}`);
    return;
  }
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  const diagnostics = [];
  page.on("console", (message) => diagnostics.push(`console:${message.type()}:${message.text()}`));
  page.on("pageerror", (error) => diagnostics.push(`pageerror:${error.stack ?? error.message}`));
  page.on("response", (response) => { if (response.status() >= 400) diagnostics.push(`http:${response.status()}:${response.url()}`); });

  const response = await page.goto(server.url, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, `index.html response: ${response?.status()}`);

  // 5. The fixture subsystem keeps its Frame open: the product must reach
  //    "ready" (Main started) without failing; a failure is a test failure.
  await page.waitForFunction(() => {
    const state = document.documentElement.dataset.loomrealmProduct;
    return state === "ready" || state === "settled" || state === "failed";
  }, null, { timeout: 30_000 });
  const productState = await page.evaluate(() => ({
    state: document.documentElement.dataset.loomrealmProduct,
    presentation: document.documentElement.dataset.loomrealmPresentation ?? null,
    presentationError: document.documentElement.dataset.loomrealmPresentationError ?? null,
    failure: window.__loomrealmPwa?.failure ?? null,
  }));
  const evidence = await page.evaluate(async () => {
    const generation = await (await fetch("./generation.json", { cache: "no-store" })).json();
    const bundle = await (await fetch("./installation-bundle.json", { cache: "no-store" })).json();
    return {
      generation,
      executableModules: bundle.executables.map(({ logicalModule }) => logicalModule),
      contentCount: bundle.content.length,
      controlled: navigator.serviceWorker.controller !== null,
      controllerScript: navigator.serviceWorker.controller?.scriptURL ?? null,
      cmsActorRegistered: typeof customElements.get("cms-actor"),
    };
  });
  assert.equal(productState.state, "ready", `the avatar fixture must start, not fail: ${JSON.stringify({ productState, diagnostics })}`);
  assert.equal(productState.presentation, "ready", `the presentation bootstrap must succeed: ${JSON.stringify({ productState, diagnostics })}`);
  assert.equal(evidence.generation.appId, "adventure-island");
  assert.equal(evidence.generation.basePath, "/pwa/adventure-island/");
  assert.deepEqual(evidence.executableModules, [FIXTURE_LOGICAL_MODULE]);
  assert.equal(evidence.contentCount, CANONICAL_CONTENT_COUNT);
  assert.equal(evidence.controlled, true, "the Service Worker must control the fixture page");
  assert.match(evidence.controllerScript, /\/pwa\/adventure-island\/service-worker\.js$/);
  assert.equal(evidence.cmsActorRegistered, "function", "the canonical cms-actor IIFE must be bootstrapped from the Service Worker Content route");

  // 6. The worker consumed the published records through the real Content API.
  await waitForEvaluate(page, () => {
    const status = document.querySelector("#avatar-fixture-status");
    const verdict = status?.getAttribute("data-records");
    return verdict === "verified" ? true : verdict === "invalid" ? (status.getAttribute("data-error") ?? "invalid") : null;
  }, "record verification through the Content API");
  const recordVerdict = await page.evaluate(() => document.querySelector("#avatar-fixture-status")?.getAttribute("data-records") ?? null);
  assert.equal(recordVerdict, "verified", `published records must match the canonical Content through the real Content API: ${recordVerdict}`);

  // 7. stand1: the actor paints with real decoded Content pixels. The pixel
  //    probes are frame-independent, so they hold in every painting window
  //    and the polling helper self-heals across phase boundaries.
  await waitForEvaluate(page, () => {
    const actor = document.querySelector("cms-actor");
    return actor?.getAttribute("data-render-state") === "ready" && actor.getAttribute("data-action") === "stand1";
  }, "stand1 active and ready", { timeout: 60_000 });
  const expectPixel = async (point, color, label) => {
    await waitForEvaluate(page, ({ x, y, expected }) => {
      const canvas = document.querySelector("cms-actor")?.shadowRoot?.querySelector("canvas");
      if (!canvas || canvas.width <= 1) return false;
      const dpr = window.devicePixelRatio || 1;
      const left = Number.parseFloat(canvas.style.left) || 0;
      const top = Number.parseFloat(canvas.style.top) || 0;
      const px = Math.round((x - left) * dpr);
      const py = Math.round((y - top) * dpr);
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return false;
      const pixel = canvas.getContext("2d").getImageData(px, py, 1, 1).data;
      return expected.every((channel, index) => channel === pixel[index]);
    }, label, { timeout: 30_000, arg: { x: point[0], y: point[1], expected: color.slice(0, 3) } });
  };
  await expectPixel(POINTS.headOverBody, COLORS.head, "head aligned over the body via the neck anchor");
  await expectPixel(POINTS.bodyOnly, COLORS.body, "body fill painted from published Content");
  await expectPixel(POINTS.hairOverHead, COLORS.hair, "hair in front of the head");
  await expectPixel(POINTS.faceThroughHairHole, COLORS.face, "face visible through the hair alpha window");
  await expectPixel(POINTS.weaponRight, COLORS.weapon, "weapon anchored to the hand, in front of the body");

  // The director loop cycles every ~12s; each assertion below is a CONJUNCTION
  // of the phase marker and its actor evidence, so a window that closed while
  // an earlier assertion was running is simply re-observed on the next cycle.

  // stand1 animates through its two frames (observed while the phase is stand).
  const standFrames = await page.evaluate(async () => {
    const stand = new Set();
    const deadline = Date.now() + 14_000;
    while (Date.now() < deadline) {
      const phase = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase");
      const frame = document.querySelector("cms-actor")?.getAttribute("data-frame");
      if ((phase === "stand" || phase === "back") && typeof frame === "string") stand.add(frame);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return [...stand];
  });
  assert.deepEqual(standFrames.sort(), ["0", "1"], `stand1 must advance through both frames (saw ${JSON.stringify(standFrames)})`);

  // Keep this element reference for the disconnect phase (identity-stable
  // until a "gone" phase removes it from the authoritative view).
  await page.evaluate(() => { window.__firstActor = document.querySelector("cms-actor"); });

  // 8. walk1: the locomotion attribute drives the walk cycle markers.
  await waitForEvaluate(page, () => {
    const phaseOk = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase") === "walk";
    return phaseOk && document.querySelector("cms-actor")?.getAttribute("data-action") === "walk1";
  }, "walk phase with walk1 active");
  const walkMarkersObserved = await page.evaluate(async (palette) => {
    const allowed = new Set(palette.map((color) => color.join(",")));
    const seen = new Set();
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && seen.size < 3) {
      const phase = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase");
      if (phase === "walk") {
        const canvas = document.querySelector("cms-actor")?.shadowRoot?.querySelector("canvas");
        if (canvas && canvas.width > 1) {
          const dpr = window.devicePixelRatio || 1;
          const left = Number.parseFloat(canvas.style.left) || 0;
          const top = Number.parseFloat(canvas.style.top) || 0;
          const px = Math.round((-6 - left) * dpr);
          const py = Math.round((-1 - top) * dpr);
          if (px >= 0 && py >= 0 && px < canvas.width && py < canvas.height) {
            const pixel = canvas.getContext("2d").getImageData(px, py, 1, 1).data;
            const key = `${pixel[0]},${pixel[1]},${pixel[2]}`;
            if (allowed.has(key)) seen.add(key);
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    return [...seen];
  }, FRAME_MARKERS.walk1.map((color) => color.slice(0, 3)));
  assert.ok(walkMarkersObserved.length >= 2, `the walk cycle must visibly animate through its frame markers (saw ${JSON.stringify(walkMarkersObserved)})`);

  // 9. jump holds its single frame with the jump marker.
  await waitForEvaluate(page, (expected) => {
    const phaseOk = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase") === "jump";
    const actor = document.querySelector("cms-actor");
    if (!phaseOk || actor?.getAttribute("data-action") !== "jump" || actor.getAttribute("data-frame") !== "0") return false;
    const canvas = actor.shadowRoot?.querySelector("canvas");
    if (!canvas || canvas.width <= 1) return false;
    const dpr = window.devicePixelRatio || 1;
    const left = Number.parseFloat(canvas.style.left) || 0;
    const top = Number.parseFloat(canvas.style.top) || 0;
    const px = Math.round((-6 - left) * dpr);
    const py = Math.round((-1 - top) * dpr);
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return false;
    const pixel = canvas.getContext("2d").getImageData(px, py, 1, 1).data;
    return expected.every((channel, index) => channel === pixel[index]);
  }, "jump phase holding its single marker frame", { timeout: 45_000, arg: FRAME_MARKERS.jump[0].slice(0, 3) });

  // 10. ContentVersion rejection: the pinned resource client refuses the
  //     mismatched version, the element surfaces a locatable error and the
  //     canvas is cleared (no partial frame).
  const conflictState = await waitForEvaluate(page, () => {
    const phaseOk = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase") === "version-conflict";
    const actor = document.querySelector("cms-actor");
    const canvas = actor?.shadowRoot?.querySelector("canvas");
    const error = actor?.getAttribute("data-render-error");
    if (!phaseOk || actor?.getAttribute("data-render-state") !== "error" || error === null) return false;
    return { error, canvasWidth: canvas?.width ?? 0 };
  }, "version-conflict error state", { timeout: 45_000 });
  assert.match(conflictState.error, /CONTENT_UNAVAILABLE/u, `the pinned resource client must reject the wrong version (${conflictState.error})`);
  // The conflicted plan lands while whichever locomotion is active, so the
  // failing fetch names that action's hair canvas.
  assert.match(conflictState.error, /Look\/00030000\/(?:stand1|walk1|jump)\/0\/hair/u, `the diagnostic must name the conflicted hair resource (${conflictState.error})`);
  assert.match(conflictState.error, /sha256:0{64}/u, `the diagnostic must name the expected (wrong) version (${conflictState.error})`);
  assert.equal(conflictState.canvasWidth, 1, "the error must clear the canvas, not leave a partial frame");

  await waitForEvaluate(page, () => {
    const phaseOk = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase") === "version-recover";
    return phaseOk && document.querySelector("cms-actor")?.getAttribute("data-render-state") === "ready";
  }, "recovered from the version conflict", { timeout: 45_000 });
  await expectPixel(POINTS.faceThroughHairHole, COLORS.face, "pixels restored after the version-conflict recovery");

  // 11. Missing resource: the Service Worker answers 404 and the element
  //     reports a locatable unavailable error.
  const missingState = await waitForEvaluate(page, () => {
    const phaseOk = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase") === "missing";
    const actor = document.querySelector("cms-actor");
    const canvas = actor?.shadowRoot?.querySelector("canvas");
    const error = actor?.getAttribute("data-render-error");
    if (!phaseOk || actor?.getAttribute("data-render-state") !== "error" || error === null) return false;
    return { error, canvasWidth: canvas?.width ?? 0 };
  }, "missing-resource error state", { timeout: 45_000 });
  assert.match(missingState.error, /CONTENT_UNAVAILABLE/u, `a missing Content resource must surface an error (${missingState.error})`);
  assert.ok(missingState.error.includes("Look/00020000/default/0/ghost"), `the diagnostic must name the missing key (${missingState.error})`);
  assert.equal(missingState.canvasWidth, 1, "the missing-resource error must clear the canvas");

  await waitForEvaluate(page, () => {
    const phaseOk = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase") === "missing-recover";
    return phaseOk && document.querySelector("cms-actor")?.getAttribute("data-render-state") === "ready";
  }, "recovered from the missing resource", { timeout: 45_000 });
  await expectPixel(POINTS.bodyOnly, COLORS.body, "pixels restored after the missing-resource recovery");

  // 12. Disconnect: removing the node from the authoritative view disconnects
  //     the element, cancelling its reads and releasing the bitmap cache.
  await waitForEvaluate(page, () => {
    const phaseOk = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase") === "gone";
    return phaseOk && document.querySelector("cms-actor") === null;
  }, "the actor must leave the managed DOM during the gone phase", { timeout: 45_000 });
  const released = await waitForEvaluate(page, () => {
    const first = window.__firstActor;
    if (!first || document.body.contains(first)) return false;
    return { cacheEntries: first.diagnostics().cache.entries };
  }, "the disconnected element releases its bitmap cache", { timeout: 20_000 });
  assert.equal(released.cacheEntries, 0, "the disconnected element must release its bitmap cache");

  // 13. Reconnect: a fresh element renders the same plan again.
  await waitForEvaluate(page, () => {
    const phaseOk = document.querySelector("#avatar-fixture-status")?.getAttribute("data-phase") === "back";
    const actor = document.querySelector("cms-actor");
    return phaseOk && actor !== null && actor !== window.__firstActor && actor.getAttribute("data-render-state") === "ready";
  }, "a fresh actor renders after reconnection", { timeout: 45_000 });
  await expectPixel(POINTS.headOverBody, COLORS.head, "the reconnected actor paints");

  // 14. No unhandled page errors across the whole directed loop.
  const pageErrors = diagnostics.filter((line) => line.startsWith("pageerror:"));
  assert.deepEqual(pageErrors, [], `no unhandled page errors may escape the closed loop (${JSON.stringify(pageErrors)})`);
});

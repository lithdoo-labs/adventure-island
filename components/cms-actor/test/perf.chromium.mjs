/**
 * cms-actor performance measurement (NOT a node:test suite).
 *
 * Reproducible, same-condition harness for the one-shot consolidated
 * optimization audit: run on the frozen baseline and on the candidate HEAD
 * with identical commands and compare the printed PERF lines.
 *
 *   node components/cms-actor/test/perf.chromium.mjs
 *
 * Measures, on real Chromium against the pinned LoomRealm dist:
 *  - time-to-first-ready paint (DPR 1/2/3);
 *  - steady walk animation: painted frames, per-paint canvas (drawImage)
 *    time p50/p95, canvas backing-store setter calls vs effective resizes;
 *  - action switching (stand→walk→jump→stand + one-shot brandish1);
 *  - 5-layer (default), padded 9-layer and padded 32-layer frames;
 *  - rapid AvatarPlan replacement (30 swaps) incl. paint request/round
 *    counters when the running build exposes them;
 *  - decode active/queued peaks during the first 32-layer fetch burst;
 *  - approximate JS heap deltas when performance.memory is available.
 *
 * Everything is synthetic (no real WZ); numbers are host-dependent.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  launchChromium,
  openBootstrappedPage as openHarnessPage,
  preparePresentation as prepareHarnessPresentation,
  startContentServer,
} from "./harness.mjs";
import { generateSyntheticFsdb } from "./synthetic-fsdb.mjs";
import { validateAvatarPlan } from "../src/avatar-model.mjs";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(componentRoot, "..", "..");
const INSTALLATION_ID = "cms-actor-perf";
const BEARER = "Bearer cms-actor-perf-token";
const RENDER_EVENT = {
  sessionId: "session-cms-actor", subsystemKey: "avatar", generation: 1,
  domainId: "field", targetKey: "player-1",
};

function percentiles(samples, ratio) {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index];
}

function report(metric, value, unit = "") {
  process.stdout.write(`PERF ${metric} ${value}${unit ? ` ${unit}` : ""}\n`);
}

/** Single-action plan whose one stand1 frame uses `count` DISTINCT resources. */
function paddedPlan(plan, count) {
  const distinct = new Map();
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) {
        const identity = `${layer.resource.namespace}\u0000${layer.resource.key}\u0000${layer.resource.contentVersion}`;
        if (!distinct.has(identity)) distinct.set(identity, layer);
      }
    }
  }
  const body = plan.actions.stand1.frames[0].layers.find((layer) => layer.id === "body");
  const layers = [structuredClone(body)];
  for (const layer of distinct.values()) {
    if (layers.length >= count) break;
    if (layer === body) continue;
    layers.push({ ...structuredClone(layer), id: `pad${layers.length}` });
  }
  return {
    formatVersion: 1,
    zOrder: [...plan.zOrder],
    actions: { stand1: { loop: true, frames: [{ delay: 60_000, layers }] } },
  };
}

function hairlessPlan(plan) {
  const clone = structuredClone(plan);
  for (const action of Object.values(clone.actions)) {
    for (const frame of action.frames) {
      frame.layers = frame.layers.filter((layer) => layer.id !== "hair");
    }
  }
  return clone;
}

// Page-side instrumentation installed before the first projection.
const INSTRUMENT = `(function () {
  window.__perf = { paints: [], bucket: 0, widthSets: 0, widthResizes: 0, frames: 0 };
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    const start = performance.now();
    try { return draw.apply(this, args); }
    finally { window.__perf.bucket += performance.now() - start; }
  };
  for (const field of ["width", "height"]) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, field);
    Object.defineProperty(HTMLCanvasElement.prototype, field, {
      configurable: true,
      get() { return descriptor.get.call(this); },
      set(value) {
        if (value !== descriptor.get.call(this)) {
          if (field === "width") window.__perf.widthResizes += 1;
        }
        if (field === "width") window.__perf.widthSets += 1;
        descriptor.set.call(this, value);
      },
    });
  }
  const actor = () => document.querySelector("cms-actor");
  const frameAttr = actor()?.getAttribute("data-frame");
  new MutationObserver(() => {
    const current = actor()?.getAttribute("data-frame");
    if (current === null || current === window.__perf.lastFrame) return;
    window.__perf.lastFrame = current;
    window.__perf.frames += 1;
    if (window.__perf.bucket > 0) {
      window.__perf.paints.push(window.__perf.bucket);
      window.__perf.bucket = 0;
    }
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-frame", "data-action"] });
})();`;

async function instrument(page) {
  await page.evaluate(INSTRUMENT);
}

/** In-page timing: apply a view and measure ms until the actor is ready. */
const APPLY_READY = async (payload) => {
  const start = performance.now();
  window.__applyView(payload.view);
  const actor = () => document.querySelector("cms-actor");
  while (performance.now() - start < 20_000) {
    const element = actor();
    if (element && element.getAttribute("data-render-state") === "ready"
      && element.shadowRoot.querySelector("canvas").width > 1) break;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  return performance.now() - start;
};

async function main() {
  const scriptBytes = await readFile(path.join(componentRoot, "browser", "cms-actor.browser.js"));
  const fsdb = generateSyntheticFsdb(path.join(repoRoot, ".work", "cms-actor-perf"), { scriptBytes });
  const avatarPlan = validateAvatarPlan(
    (await import("./look-adapter.mjs")).buildAvatarPlan(fsdb.looks, fsdb.readStruct("ZMap", "order").order, fsdb.index),
  );
  const fixture = await startContentServer({
    index: fsdb.index, scriptBytes,
    scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
    installationId: INSTALLATION_ID, bearer: BEARER,
  });
  const chromium = await launchChromium();
  const cleanups = [];
  const t = { after: (fn) => cleanups.push(fn) };

  const view = (options) => ({
    sessionId: RENDER_EVENT.sessionId,
    subsystems: [{
      subsystemKey: RENDER_EVENT.subsystemKey, generation: RENDER_EVENT.generation, eligible: true,
      domains: [{
        domainId: RENDER_EVENT.domainId, zIndex: 0,
        roots: [{
          key: RENDER_EVENT.targetKey, tag: "cms-actor",
          attrs: { x: "0", y: "0", locomotion: "stand", facing: "right", skin: "0",
            face: "00020000", hair: "00030000", expression: "default", equips: "",
            ...(options?.attrs ?? {}) },
          data: { avatarPlan: options?.plan ?? avatarPlan },
          children: [],
        }],
      }],
    }],
  });

  try {
    for (const deviceScaleFactor of [1, 2, 3]) {
      const prepared = await prepareHarnessPresentation({
        origin: fixture.origin, index: fsdb.index,
        configPath: path.join(componentRoot, "presentation.json"),
        scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
      });
      const page = await openHarnessPage(t, {
        chromium, origin: fixture.origin, prepared,
        installationId: INSTALLATION_ID, bearer: BEARER, deviceScaleFactor,
      });
      await instrument(page);
      const firstReady = await page.evaluate(APPLY_READY, { view: view() });
      report(`first-ready/plan5/dpr${deviceScaleFactor}`, firstReady.toFixed(1), "ms");

      // Steady walk animation for ~4s.
      await page.evaluate(async (payload) => {
        window.__applyView(payload.view);
        await new Promise((resolve) => setTimeout(resolve, 4_000));
      }, { view: view({ attrs: { locomotion: "walk" } }) });
      const steady = await page.evaluate(() => {
        const paints = window.__perf.paints;
        return {
          frames: window.__perf.frames,
          paints: paints.length,
          widthSets: window.__perf.widthSets,
          widthResizes: window.__perf.widthResizes,
        };
      });
      const durations = await page.evaluate(() => window.__perf.paints);
      report(`steady-walk/frames-painted/dpr${deviceScaleFactor}`, steady.frames);
      report(`steady-walk/canvas-paints/dpr${deviceScaleFactor}`, steady.paints);
      report(`steady-walk/paint-p50/dpr${deviceScaleFactor}`, percentiles(durations, 0.5)?.toFixed(3), "ms");
      report(`steady-walk/paint-p95/dpr${deviceScaleFactor}`, percentiles(durations, 0.95)?.toFixed(3), "ms");
      report(`steady-walk/width-sets/dpr${deviceScaleFactor}`, steady.widthSets);
      report(`steady-walk/width-resizes/dpr${deviceScaleFactor}`, steady.widthResizes);

      // Action switching: walk -> jump -> stand -> one-shot -> back.
      const switches = [];
      for (const [label, options, event] of [
        ["jump", { attrs: { locomotion: "jump" } }, null],
        ["stand", { attrs: { locomotion: "stand" } }, null],
        ["brandish1", { attrs: { locomotion: "walk" } }, { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } }],
      ]) {
        const elapsed = await page.evaluate(async (payload) => {
          const start = performance.now();
          window.__applyView(payload.view);
          if (payload.event) window.__emitEvent(payload.event);
          while (performance.now() - start < 10_000) {
            const element = document.querySelector("cms-actor");
            if (element && element.getAttribute("data-render-state") === "ready"
              && element.getAttribute("data-action") === payload.expect) break;
            await new Promise((resolve) => setTimeout(resolve, 2));
          }
          return performance.now() - start;
        }, { view: view(options), event, expect: event ? "walk1" : label === "jump" ? "jump" : "stand1" });
        switches.push(elapsed);
        report(`action-switch/${label}/dpr${deviceScaleFactor}`, elapsed.toFixed(1), "ms");
      }
      if (deviceScaleFactor === 1) report("action-switch/mean-of-3", (switches.reduce((a, b) => a + b, 0) / switches.length).toFixed(1), "ms");
      const heap = await page.evaluate(() => window.performance?.memory?.usedJSHeapSize ?? null);
      if (heap !== null) report(`heap/after-steady/dpr${deviceScaleFactor}`, (heap / 1_048_576).toFixed(1), "MiB");
      await page.close().catch(() => {});
    }

    // Layer-count sweep + decode burst peaks + rapid plan replacement at DPR 1.
    const prepared = await prepareHarnessPresentation({
      origin: fixture.origin, index: fsdb.index,
      configPath: path.join(componentRoot, "presentation.json"),
      scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
    });
    const page = await openHarnessPage(t, {
      chromium, origin: fixture.origin, prepared,
      installationId: INSTALLATION_ID, bearer: BEARER, deviceScaleFactor: 1,
    });
    await instrument(page);

    // Fresh 32-distinct-resource first paint with in-loop decode peak
    // sampling (nothing cached on this page yet).
    const plan32 = validateAvatarPlan(paddedPlan(avatarPlan, 32));
    const burst = await page.evaluate(async (payload) => {
      const start = performance.now();
      const peak = { active: 0, queued: 0 };
      window.__applyView(payload.view);
      while (performance.now() - start < 20_000) {
        const element = document.querySelector("cms-actor");
        const decode = element?.diagnostics?.()?.decode;
        if (decode) {
          peak.active = Math.max(peak.active, decode.active);
          peak.queued = Math.max(peak.queued, decode.queued);
        }
        if (element && element.getAttribute("data-render-state") === "ready"
          && element.shadowRoot.querySelector("canvas").width > 1) break;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      return { readyMs: performance.now() - start, peak };
    }, { view: view({ plan: plan32 }) });
    report("first-ready/plan32-distinct/dpr1", burst.readyMs.toFixed(1), "ms");
    report("decode-burst32/peak-active", burst.peak.active);
    report("decode-burst32/peak-queued", burst.peak.queued);

    // 9-layer cache-hit repaint on the same page.
    const plan9 = validateAvatarPlan(paddedPlan(avatarPlan, 9));
    const plan9Ready = await page.evaluate(APPLY_READY, { view: view({ plan: plan9 }) });
    report("first-ready/plan9-mostly-cached/dpr1", plan9Ready.toFixed(1), "ms");

    // Rapid plan replacement: 30 alternating swaps, then settle.
    const hairless = hairlessPlan(avatarPlan);
    const countersBefore = await page.evaluate(() => {
      const element = document.querySelector("cms-actor");
      const diagnostics = element?.diagnostics?.();
      return diagnostics ? { requests: diagnostics.paintRequests ?? null, rounds: diagnostics.paintRounds ?? null } : null;
    });
    const swapMs = await page.evaluate(async (payload) => {
      const start = performance.now();
      for (let index = 0; index < 30; index += 1) {
        window.__applyView(index % 2 === 0 ? payload.hairless : payload.full);
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
      while (performance.now() - start < 15_000) {
        const element = document.querySelector("cms-actor");
        if (element && element.getAttribute("data-render-state") === "ready"
          && element.getAttribute("data-action") === "stand1") break;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      return performance.now() - start;
    }, { hairless: view({ plan: hairless }), full: view({}) });
    report("plan-swaps-30/settle", swapMs.toFixed(1), "ms");
    const countersAfter = await page.evaluate(() => {
      const element = document.querySelector("cms-actor");
      const diagnostics = element?.diagnostics?.();
      return diagnostics ? { requests: diagnostics.paintRequests ?? null, rounds: diagnostics.paintRounds ?? null } : null;
    });
    if (countersBefore?.requests != null && countersAfter?.requests != null) {
      report("plan-swaps-30/paint-requests", countersAfter.requests - countersBefore.requests);
      report("plan-swaps-30/paint-rounds", countersAfter.rounds - countersBefore.rounds);
    } else {
      report("plan-swaps-30/paint-counters", "NOT MEASURED (baseline build exposes no counters)");
    }
    const heap = await page.evaluate(() => window.performance?.memory?.usedJSHeapSize ?? null);
    if (heap !== null) report("heap/after-swaps", (heap / 1_048_576).toFixed(1), "MiB");
    await page.close().catch(() => {});
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup().catch(() => {});
    await chromium.close().catch(() => {});
    await fixture.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

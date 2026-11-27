import {
  M7_8_RELEASE_VALIDATION_BUDGETS,
} from "../systems/adventure-map/portal-budgets.mjs";
import { DEFAULT_VIEWPORT_RANGE, resolveViewportFrame } from "../components/ms-viewport/src/layout.mjs";

export function parseReleaseSoakConfig(env = process.env) {
  const durationMs = Number(env.ADVENTURE_RELEASE_SOAK_MS ?? 0);
  const cyclesFromEnv = Number(env.ADVENTURE_RELEASE_SOAK_CYCLES ?? 0);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError("ADVENTURE_RELEASE_SOAK_MS must be a finite non-negative number");
  }
  if (!Number.isInteger(cyclesFromEnv) || cyclesFromEnv < 0) {
    throw new RangeError("ADVENTURE_RELEASE_SOAK_CYCLES must be a non-negative integer");
  }
  const boundedCycles = cyclesFromEnv > 0
    ? Math.min(cyclesFromEnv, M7_8_RELEASE_VALIDATION_BUDGETS.maxReleaseSoakCycles * 50)
    : M7_8_RELEASE_VALIDATION_BUDGETS.maxReleaseSoakCycles;
  const qualification = durationMs > 0
    || cyclesFromEnv > M7_8_RELEASE_VALIDATION_BUDGETS.maxReleaseSoakCycles;
  const capDuration = Math.min(durationMs, M7_8_RELEASE_VALIDATION_BUDGETS.maxReleaseSoakDurationMs);
  return Object.freeze({
    qualification,
    durationMs: capDuration,
    cycles: boundedCycles,
    alternateSizes: Object.freeze([
      { width: 800, height: 600 },
      { width: 1000, height: 700 },
    ]),
  });
}

export function buildSoakCycleSizes(config) {
  const sizes = [];
  const templates = config.alternateSizes;
  for (let index = 0; index < config.cycles; index += 1) {
    sizes.push(templates[index % templates.length]);
  }
  return sizes;
}

export async function collectReleaseSoakSnapshot(page) {
  return page.evaluate(() => {
    const hosts = [...document.querySelectorAll(
      "ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual, ms-avatar",
    )];
    const relayoutWidth = document.querySelector("ms-viewport-frame")?.diagnostics?.().width;
    const relayoutBacks = [...document.querySelectorAll("ms-map-back")]
      .filter((host) => relayoutWidth != null
        && Number(getComputedStyle(host).width.replace("px", "")) === relayoutWidth);
    const relayoutObjects = [...document.querySelectorAll("ms-map-object")]
      .filter((host) => relayoutWidth != null
        && Number(getComputedStyle(host).width.replace("px", "")) === relayoutWidth);
    const stable = [...relayoutBacks, ...relayoutObjects, ...document.querySelectorAll("ms-map-batch, ms-portal-visual, ms-avatar")];
    const canvases = stable
      .map((host) => host.shadowRoot?.querySelector("canvas"))
      .filter(Boolean);
    const domNodes = document.getElementsByTagName("*").length;
    return {
      mapId: document.querySelector("ms-scene-view")?.getAttribute("map-id") ?? null,
      resourceReads: hosts.reduce((sum, host) => sum + (host.diagnostics?.().resourceReads ?? 0), 0),
      paintCommits: hosts.reduce((sum, host) => sum + (host.diagnostics?.().paintCommits ?? 0), 0),
      batchPaints: [...document.querySelectorAll("ms-map-batch")].map((host) => host.diagnostics().paintCommits),
      staticStamp: [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual")]
        .map((host) => host.diagnostics().paintCommits).join(","),
      domNodes,
      canvasCount: canvases.length,
      heapProxy: domNodes + canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0) / 1_000,
      frame: document.querySelector("ms-viewport-frame")?.diagnostics?.() ?? null,
      relayoutBackCount: relayoutBacks.length,
      relayoutObjectCount: relayoutObjects.length,
    };
  });
}

export async function runViewportResizeSoakCycle(page, size, beforeBackCount) {
  const logical = resolveViewportFrame(size.width, size.height, DEFAULT_VIEWPORT_RANGE);
  await page.setViewportSize(size);
  await page.waitForFunction(({ expectedWidth, expectedBacks }) => {
    const backs = [...document.querySelectorAll("ms-map-back")]
      .filter((host) => Number(getComputedStyle(host).width.replace("px", "")) === expectedWidth);
    const flows = [...document.querySelectorAll("ms-map-object")]
      .filter((host) => Number(getComputedStyle(host).width.replace("px", "")) === expectedWidth);
    return backs.length === expectedBacks && flows.length === 0
      && backs.every((host) => host.isConnected && host.diagnostics().state === "ready");
  }, { expectedWidth: logical.width, expectedBacks: beforeBackCount }, { timeout: 25_000 });
  const eventLoopLagMs = await page.evaluate(() => new Promise((resolve) => {
    const started = performance.now();
    setTimeout(() => resolve(performance.now() - started), 0);
  }));
  return { logical, eventLoopLagMs };
}

export function assertReleaseSoakBudgets(before, after, {
  eventLoopLagMs,
  cycleCount,
  qualification = false,
  budgets = M7_8_RELEASE_VALIDATION_BUDGETS,
}) {
  const readDelta = after.resourceReads - before.resourceReads;
  const paintDelta = after.paintCommits - before.paintCommits;
  if (readDelta > budgets.maxReleaseRelayoutResourceReadDelta) {
    throw new Error(`release soak re-read Content: delta ${readDelta}`);
  }
  if (after.staticStamp !== before.staticStamp && budgets.maxReleaseStaticPaintCommitDelta === 0) {
    throw new Error("release soak changed static paint commit stamps");
  }
  if (paintDelta > budgets.maxReleasePaintCommitsDelta) {
    throw new Error(`release soak paint commits delta ${paintDelta} > ${budgets.maxReleasePaintCommitsDelta}`);
  }
  if (after.domNodes > budgets.maxReleaseDomNodeCount) {
    throw new Error(`release soak DOM nodes ${after.domNodes}`);
  }
  if (after.heapProxy > budgets.maxReleaseHeapDomProxyScore) {
    throw new Error(`release soak heap proxy ${after.heapProxy}`);
  }
  if (Math.abs(after.heapProxy - before.heapProxy) > budgets.maxReleaseHeapDomProxyDelta) {
    throw new Error(`release soak heap proxy delta ${Math.abs(after.heapProxy - before.heapProxy)}`);
  }
  if (eventLoopLagMs > budgets.maxReleaseEventLoopLagProxyMs) {
    throw new Error(`release soak event-loop lag ${eventLoopLagMs}ms`);
  }
  if (cycleCount > budgets.maxReleaseSoakCycles && !qualification) {
    throw new Error(`release soak cycles ${cycleCount} exceed bounded CI default`);
  }
}

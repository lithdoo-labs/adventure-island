import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import {
  M7_8_MEASURED_RELEASE_BUDGETS,
  M7_8_RELEASE_VALIDATION_BUDGETS,
  M7_PORTAL_BUDGETS,
} from "../../../systems/adventure-map/portal-budgets.mjs";
import { summarizeProjectionCanvasBudget } from "./canonical-budgets.mjs";
import {
  BEARER,
  INSTALLATION_ID,
  SCRIPT_PATH,
  launchChromium,
  openFieldPage,
  preparePresentation,
  startFieldServer,
  waitFor,
} from "./harness.mjs";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(componentRoot, "..", "..");
const scriptBytes = await readFile(path.join(componentRoot, "browser", "ms-field.browser.js"));

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function walkResources(node, sink) {
  const image = node.data?.image;
  if (image?.resource) sink.push(image.resource);
  const pages = node.data?.sprites?.pages;
  if (pages) {
    for (const page of Object.values(pages)) {
      if (page?.resource) sink.push(page.resource);
    }
  }
  const frames = node.data?.frames;
  if (Array.isArray(frames)) {
    for (const frame of frames) {
      if (frame?.image?.resource) sink.push(frame.image.resource);
    }
  }
  for (const child of node.children ?? []) walkResources(child, sink);
}

const FSDB_BY_NAMESPACE = (gameRoot) => Object.freeze({
  "resource.Map": path.join(gameRoot, "content", "[FSDB]adventure", "[resource]Map"),
  "resource.Avatar": path.join(gameRoot, "content", "[FSDB]adventure", "[resource]Avatar"),
});

async function loadResourceIndex(root, gameRoot) {
  const refs = [];
  walkResources(root, refs);
  const unique = new Map();
  for (const ref of refs) unique.set(`${ref.namespace}\0${ref.key}`, ref);
  const roots = FSDB_BY_NAMESPACE(gameRoot);
  const index = new Map();
  for (const ref of unique.values()) {
    const fsdbRoot = roots[ref.namespace];
    if (!fsdbRoot) throw new Error(`unsupported resource namespace ${ref.namespace}`);
    const filePath = path.join(fsdbRoot, `${ref.key.split("/").join(path.sep)}.png`);
    const bytes = await readFile(filePath);
    index.set(`${ref.namespace}\0${ref.key}`, {
      bytes,
      mime: "image/png",
      contentVersion: ref.contentVersion,
    });
  }
  index.set(`resource.Presentation\0ms-field/ms-field.browser.js`, {
    bytes: scriptBytes,
    mime: "text/javascript",
    contentVersion: sha256(scriptBytes),
  });
  return index;
}

let chromium;

before(async () => {
  chromium = await launchChromium();
});

after(async () => {
  await chromium?.close().catch(() => {});
});

test("M7.8 aqua link 230030100 paints within release budgets and keeps static commits stable", { timeout: 120_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030100",
  });
  const nodeBudget = summarizeProjectionCanvasBudget(plan.root);
  assert.ok(nodeBudget.canvasCount <= M7_8_RELEASE_VALIDATION_BUDGETS.maxAquaLinkVisualCanvases);
  assert.equal(nodeBudget.canvasCount, M7_8_MEASURED_RELEASE_BUDGETS.aquaLinkVisualCanvases);
  const index = await loadResourceIndex(plan.root, repoRoot);
  const server = await startFieldServer({ index, scriptBytes });
  t.after(() => server.close());
  const prepared = await preparePresentation({
    origin: server.origin,
    index,
    configPath: path.join(componentRoot, "presentation.json"),
    scriptPath: SCRIPT_PATH,
  });
  const page = await openFieldPage(t, {
    chromium,
    origin: server.origin,
    prepared,
    installationId: INSTALLATION_ID,
    bearer: BEARER,
    viewport: { width: 1000, height: 700 },
  });
  const readyStarted = performance.now();
  await page.evaluate((opened) => window.__open(opened), plan.root);
  await waitFor(page, () => (
    [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual, ms-avatar")]
      .every((host) => host.diagnostics().state === "ready")
      && window.__resourceActive === 0
  ), "aqua link field hosts ready", 90_000);
  const readyMs = performance.now() - readyStarted;
  assert.ok(readyMs <= M7_8_RELEASE_VALIDATION_BUDGETS.maxAquaLinkBrowserReadyMs);
  const before = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual, ms-avatar")];
    return {
      staticPaints: hosts.map((host) => host.diagnostics().paintCommits),
      resourceReads: hosts.reduce((sum, host) => sum + host.diagnostics().resourceReads, 0),
    };
  });
  await page.evaluate(() => {
    const player = document.querySelector("ms-world-item");
    if (player) player.setAttribute("world-x", String(Number(player.getAttribute("world-x")) + 40));
  });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual, ms-avatar")];
    return {
      staticPaints: hosts.map((host) => host.diagnostics().paintCommits),
      resourceReads: hosts.reduce((sum, host) => sum + host.diagnostics().resourceReads, 0),
    };
  });
  assert.equal(after.resourceReads, before.resourceReads);
  for (let index = 0; index < before.staticPaints.length; index += 1) {
    const stamp = before.staticPaints[index];
    if (stamp === 0) continue;
    assert.equal(after.staticPaints[index], stamp,
      `static host ${index} repainted on high-frequency world-x update`);
  }
  const browserBudget = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll(
      "ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual, ms-avatar",
    )]
      .map((host) => host.shadowRoot?.querySelector("canvas"))
      .filter(Boolean);
    return {
      count: canvases.length,
      totalPixels: canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0),
      maxWidth: Math.max(0, ...canvases.map((canvas) => canvas.width)),
      maxHeight: Math.max(0, ...canvases.map((canvas) => canvas.height)),
    };
  });
  assert.ok(browserBudget.count <= M7_8_RELEASE_VALIDATION_BUDGETS.maxAquaLinkVisualCanvases);
  assert.ok(browserBudget.totalPixels <= M7_8_RELEASE_VALIDATION_BUDGETS.maxAquaLinkTotalLocalPixels);
  assert.ok(browserBudget.maxWidth <= M7_PORTAL_BUDGETS.maxWaterMapCanvasWidth);
  assert.ok(browserBudget.maxHeight <= M7_PORTAL_BUDGETS.maxWaterMapCanvasHeight);
  t.diagnostic(`M7.8 aqua link ready ${readyMs.toFixed(1)}ms; canvases ${browserBudget.count}; total ${browserBudget.totalPixels}px`);
  assert.deepEqual(page.__pageErrors, []);
});
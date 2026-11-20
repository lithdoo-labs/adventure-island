import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { buildFieldProjection } from "../src/field-project.mjs";
import { buildCanonicalAdventureAvatarContent } from "../../../scripts/pwa/read-adventure-fsdb.mjs";
import { validateFieldTree } from "../src/validate.mjs";
import {
  CANONICAL_FIELD_BUDGETS,
  MEASURED_CANVAS_COUNT,
  MEASURED_FIELD_PLAN_RESOURCE_CLOSURE,
  MEASURED_FIRST_FRAME_UNDERLYING_READS,
  MEASURED_MAX_LOCAL_CANVAS_PIXELS,
  collectFieldPlanResourceClosure,
} from "./canonical-budgets.mjs";
import {
  BEARER,
  INSTALLATION_ID,
  SCRIPT_PATH,
  launchChromium,
  openFieldPage,
  preparePresentation,
  startFieldServer,
  waitFor,
  waitForFullCanonicalFieldReady,
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

test("canonical 222000000 full WebProjector scene: all visual canvases, ranks, budgets, camera", { timeout: 360_000 }, async (t) => {
  const { plan: avatarPlan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    viewport: { width: 800, height: 600 },
    avatarPlan,
  });
  assert.equal(validateFieldTree(projection.root).ok, true);
  assert.equal(projection.root.children.length, 298);
  assert.equal(collectFieldPlanResourceClosure(projection.root).size, MEASURED_FIELD_PLAN_RESOURCE_CLOSURE);

  const index = await loadResourceIndex(projection.root, repoRoot);
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
    viewport: { width: 800, height: 600 },
  });

  const readyStarted = Date.now();
  await page.evaluate((tree) => window.__open(tree), projection.root);
  await waitForFullCanonicalFieldReady(page, { timeout: CANONICAL_FIELD_BUDGETS.maxReadyMs });
  const readyMs = Date.now() - readyStarted;
  assert.ok(readyMs < CANONICAL_FIELD_BUDGETS.maxReadyMs,
    `ready took ${readyMs}ms (budget ${CANONICAL_FIELD_BUDGETS.maxReadyMs}ms)`);
  t.diagnostic(`canonical browser ready ${readyMs}ms / ${CANONICAL_FIELD_BUDGETS.maxReadyMs}ms budget`);

  const evidence = await page.evaluate(() => {
    const opaqueSample = (canvas) => {
      if (!canvas || canvas.width === 0 || canvas.height === 0) return 0;
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 3; i < data.length; i += 16) if (data[i] > 0) count += 1;
      return count;
    };
    const scene = document.querySelector("ms-scene-view");
    const hosts = [
      ...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual, ms-avatar"),
    ];
    const canvases = hosts.map((host) => host.shadowRoot?.querySelector("canvas")).filter(Boolean);
    let maxWidth = 0;
    let maxHeight = 0;
    let maxLocalCanvasPixels = 0;
    let totalPixels = 0;
    const perHost = hosts.map((host) => {
      const canvas = host.shadowRoot?.querySelector("canvas");
      const diag = host.diagnostics();
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        maxWidth = Math.max(maxWidth, canvas.width);
        maxHeight = Math.max(maxHeight, canvas.height);
        const pixels = canvas.width * canvas.height;
        maxLocalCanvasPixels = Math.max(maxLocalCanvasPixels, pixels);
        totalPixels += pixels;
      }
      return {
        tag: host.localName,
        state: diag.state,
        width: canvas?.width ?? 0,
        height: canvas?.height ?? 0,
        opaqueSample: opaqueSample(canvas),
      };
    });
    const ranks = [...scene.children].map((node) => Number(node.getAttribute("stack-rank")));
    const playerIndex = [...scene.children].map((node) => node.localName).indexOf("ms-world-item");
    const uniqueCalls = new Map();
    for (const call of window.__resourceCalls ?? []) {
      uniqueCalls.set(`${call.namespace}\0${call.key}\0${call.expectedContentVersion}`, true);
    }
    return {
      canvasCount: canvases.length,
      hostCount: hosts.length,
      maxWidth,
      maxHeight,
      maxLocalCanvasPixels,
      totalPixels,
      perHost,
      ranks,
      playerIndex,
      dpr: window.devicePixelRatio,
      clientMaxActive: window.__resourceMaxActive ?? 0,
      clientCallCount: window.__resourceCalls?.length ?? 0,
      clientUniqueReads: uniqueCalls.size,
      resourceActive: window.__resourceActive ?? 0,
    };
  });

  assert.equal(evidence.resourceActive, 0);
  assert.equal(evidence.dpr, 1);
  assert.equal(evidence.hostCount, MEASURED_CANVAS_COUNT);
  assert.equal(evidence.canvasCount, MEASURED_CANVAS_COUNT);
  assert.ok(evidence.perHost.every((host) => host.state === "ready"), "every visual host must be ready");
  assert.ok(evidence.perHost.every((host) => host.width > 0 && host.height > 0), "every visual canvas must be finite");
  assert.ok(evidence.perHost.every((host) => host.opaqueSample > 0), "every visual canvas must commit nontransparent pixels");

  assert.ok(evidence.maxWidth <= CANONICAL_FIELD_BUDGETS.maxCanvasWidth);
  assert.ok(evidence.maxHeight <= CANONICAL_FIELD_BUDGETS.maxCanvasHeight);
  assert.equal(evidence.maxLocalCanvasPixels, MEASURED_MAX_LOCAL_CANVAS_PIXELS);
  assert.ok(evidence.maxLocalCanvasPixels <= CANONICAL_FIELD_BUDGETS.maxLocalCanvasPixels);
  assert.ok(evidence.totalPixels <= CANONICAL_FIELD_BUDGETS.maxTotalLocalPixels);
  assert.ok(evidence.canvasCount <= CANONICAL_FIELD_BUDGETS.maxVisualCanvases);

  for (let index = 1; index < evidence.ranks.length; index += 1) {
    assert.ok(evidence.ranks[index] > evidence.ranks[index - 1], "stack-rank must increase with DOM child order");
  }
  assert.ok(evidence.playerIndex > 0 && evidence.playerIndex < evidence.ranks.length - 1);

  assert.equal(evidence.clientUniqueReads, MEASURED_FIRST_FRAME_UNDERLYING_READS);
  assert.equal(evidence.clientCallCount, evidence.clientUniqueReads,
    "immutable Content identities must dedupe underlying client reads");
  assert.ok(evidence.clientMaxActive <= CANONICAL_FIELD_BUDGETS.maxReadConcurrency);
  assert.ok(evidence.clientMaxActive < CANONICAL_FIELD_BUDGETS.belowPwaContentLimit);
  assert.ok(server.metrics.maxConcurrentContentReads <= CANONICAL_FIELD_BUDGETS.maxReadConcurrency);
  assert.ok(server.metrics.maxConcurrentContentReads < CANONICAL_FIELD_BUDGETS.belowPwaContentLimit);
  assert.equal(server.metrics.totalContentReads, MEASURED_FIRST_FRAME_UNDERLYING_READS);

  const beforePaints = await page.evaluate(() => [...document.querySelectorAll("ms-map-batch, ms-map-back")]
    .map((host) => host.diagnostics().paintCommits));
  await page.evaluate(() => window.__update([{
    op: "update",
    key: "scene:map222000000",
    attrs: { set: { "camera-x": "15", "camera-y": "18" } },
  }]));
  await waitFor(page, () => document.querySelector("ms-scene-view").getAttribute("camera-x") === "15", "camera moved");
  const afterCamera = await page.evaluate(() => ({
    paints: [...document.querySelectorAll("ms-map-batch, ms-map-back")].map((host) => host.diagnostics().paintCommits),
    cameraX: getComputedStyle(document.querySelector("ms-scene-view").shadowRoot.querySelector(".world-plane"))
      .getPropertyValue("--ms-scene-camera-x"),
  }));
  assert.deepEqual(afterCamera.paints, beforePaints);
  assert.equal(afterCamera.cameraX.trim(), "15px");

  const beforeWorldMove = await page.evaluate(() => ({
    staticPaints: [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual")]
      .map((host) => host.diagnostics().paintCommits),
    avatarRounds: document.querySelector("ms-avatar").diagnostics().paintRounds,
  }));
  await page.evaluate(() => window.__update([{
    op: "update",
    key: "player:adventure",
    attrs: { set: { "world-x": "1340", "world-y": "220" } },
  }]));
  await waitFor(page, () => {
    const player = document.querySelector("ms-world-item");
    return player?.getAttribute("world-x") === "1340"
      && player.getAttribute("world-y") === "220";
  }, "player world host moved");
  const afterWorldMove = await page.evaluate(() => ({
    staticPaints: [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual")]
      .map((host) => host.diagnostics().paintCommits),
    avatarRounds: document.querySelector("ms-avatar").diagnostics().paintRounds,
    hostStyle: document.querySelector("ms-world-item").shadowRoot.querySelector("style").textContent,
  }));
  assert.deepEqual(afterWorldMove.staticPaints, beforeWorldMove.staticPaints,
    "world position updates must not repaint static map canvases");
  assert.equal(afterWorldMove.avatarRounds, beforeWorldMove.avatarRounds,
    "world position updates must not repaint the local avatar canvas");
  assert.match(afterWorldMove.hostStyle, /left:1340px; top:220px;/,
    "world position belongs to the outer ms-world-item host");

  const playerIndex = projection.root.children.findIndex((child) => child.key === "player:adventure");
  const nextDepthNode = projection.root.children[playerIndex + 1];
  const playerRank = projection.root.children[playerIndex].attrs["stack-rank"];
  const nextRank = nextDepthNode.attrs["stack-rank"];
  const beforeDepthChange = await page.evaluate(() => ({
    staticPaints: [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual")]
      .map((host) => host.diagnostics().paintCommits),
    avatarRounds: document.querySelector("ms-avatar").diagnostics().paintRounds,
  }));
  await page.evaluate(({ nextKey, playerRankValue, nextRankValue }) => window.__update([
    { op: "update", key: "player:adventure", attrs: { set: { "stack-rank": nextRankValue } } },
    { op: "update", key: nextKey, attrs: { set: { "stack-rank": playerRankValue } } },
  ]), { nextKey: nextDepthNode.key, playerRankValue: playerRank, nextRankValue: nextRank });
  await waitFor(page, (rank) => document.querySelector("ms-world-item")?.getAttribute("stack-rank") === rank,
    "player depth rank moved", 20_000, nextRank);
  const afterDepthChange = await page.evaluate(() => ({
    staticPaints: [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual")]
      .map((host) => host.diagnostics().paintCommits),
    avatarRounds: document.querySelector("ms-avatar").diagnostics().paintRounds,
  }));
  assert.deepEqual(afterDepthChange.staticPaints, beforeDepthChange.staticPaints,
    "stack-rank updates must not repaint static map canvases");
  assert.equal(afterDepthChange.avatarRounds, beforeDepthChange.avatarRounds,
    "stack-rank updates must not repaint the local avatar canvas");

  const beforeAction = await page.evaluate(() => ({
    staticPaints: [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual")]
      .map((host) => host.diagnostics().paintCommits),
    avatarRounds: document.querySelector("ms-avatar").diagnostics().paintRounds,
  }));
  await page.evaluate(() => window.__update([{
    op: "update",
    key: "player:adventure:avatar",
    attrs: { set: { action: "walk1", facing: "left", "frame-index": "1", "elapsed-ms": "180" } },
  }]));
  await waitFor(page, () => {
    const avatar = document.querySelector("ms-avatar");
    return avatar?.getAttribute("data-action") === "walk1"
      && avatar.getAttribute("data-frame") === "1"
      && avatar.diagnostics().paintPending === false;
  }, "avatar action frame projected");
  const afterAction = await page.evaluate(() => ({
    staticPaints: [...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual")]
      .map((host) => host.diagnostics().paintCommits),
    avatarRounds: document.querySelector("ms-avatar").diagnostics().paintRounds,
  }));
  assert.deepEqual(afterAction.staticPaints, beforeAction.staticPaints,
    "avatar action updates must not repaint static map canvases");
  assert.ok(afterAction.avatarRounds > beforeAction.avatarRounds,
    "avatar action updates must repaint the local avatar canvas");

  assert.deepEqual(page.__pageErrors, []);
  assert.deepEqual(await page.evaluate(() => window.__presentationFailures), []);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { buildFieldProjection } from "../src/field-project.mjs";
import { presentationViewFromStore } from "../src/store-bridge.mjs";
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
const storeUrl = pathToFileURL(path.resolve(repoRoot, "loom-realm/packages/renderer/dist/internal/render-store.js"));

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

async function loadResourceIndex(root, gameRoot) {
  const refs = [];
  walkResources(root, refs);
  const unique = new Map();
  for (const ref of refs) unique.set(`${ref.namespace}\0${ref.key}`, ref);
  const fsdbRoot = path.join(gameRoot, "content", "[FSDB]adventure", "[resource]Map");
  const index = new Map();
  for (const ref of unique.values()) {
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

test("RendererRenderStore carrier fences stale patches after retire", async () => {
  const { RendererRenderStore } = await import(storeUrl);
  const projection = await buildFieldProjection({ gameRoot: repoRoot, paintUnitCap: 4, viewport: { width: 64, height: 64 } });
  const store = new RendererRenderStore(3);
  const identity = { sessionId: "session-field", subsystemKey: "field" };
  store.beginCarrier();
  assert.equal(store.onDomains({ type: "render.domains", domains: ["field"] }).kind, "accepted");
  assert.equal(store.onSnapshot({
    type: "render.snapshot",
    domainId: "field",
    revision: 1,
    zIndex: 0,
    roots: [projection.root],
  }).kind, "accepted");
  assert.equal(presentationViewFromStore(store, identity).subsystems[0].eligible, true);
  store.retireCarrier();
  const stale = store.onPatch({
    type: "render.patch",
    domainId: "field",
    baseRevision: 1,
    revision: 2,
    ops: [{ op: "update", key: "player:adventure", attrs: { set: { "world-x": "0" } } }],
  });
  assert.equal(stale.kind, "accepted", "retired carrier accepts wire traffic without mutating presentation");
  assert.equal(presentationViewFromStore(store, identity).subsystems[0].eligible, false);
  store.beginCarrier();
  assert.equal(store.onDomains({ type: "render.domains", domains: ["field"] }).kind, "accepted");
  assert.equal(presentationViewFromStore(store, identity).subsystems[0].eligible, false,
    "fresh carrier stays ineligible until a new baseline snapshot");
  assert.equal(store.onSnapshot({
    type: "render.snapshot",
    domainId: "field",
    revision: 9,
    zIndex: 0,
    roots: [projection.root],
  }).kind, "accepted");
  assert.equal(presentationViewFromStore(store, identity).subsystems[0].eligible, true,
    "fresh carrier becomes eligible only after its own baseline snapshot");
});

test("disconnect, stale async, and teardown leave no late pixels or leaked reads", { timeout: 180_000 }, async (t) => {
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 20,
    viewport: { width: 96, height: 96 },
  });
  // Select a Back beyond the smaller projection's cap. Back used to miss the
  // post-decode lifetime check present on sprite batches, allowing an old
  // createImageBitmap result to repopulate a disconnected canvas.
  const slowChild = projection.root.children.findLast((child) => child.tag === "ms-map-back" && child.data?.image?.resource);
  assert.ok(slowChild, "capped projection must include a removable Back");
  const slowChildIndex = projection.root.children.indexOf(slowChild);
  const slowRef = slowChild.data.image.resource;
  const slowIdentity = `${slowRef.namespace}\0${slowRef.key}`;

  const index = await loadResourceIndex(projection.root, repoRoot);
  const delays = new Map([[slowIdentity, 1_500]]);
  const server = await startFieldServer({ index, scriptBytes, resourceDelayMs: delays });
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
  });
  await page.evaluate((tree) => window.__open(tree), projection.root);
  await waitFor(
    page,
    (slowKey) => window.__resourceCalls?.some((call) => call.key === slowKey),
    "slow read started",
    20_000,
    slowRef.key,
  );
  const capturedTag = await page.evaluate((childIndex) => {
    window.__slowHost = document.querySelector("ms-scene-view")?.children[childIndex] ?? null;
    return window.__slowHost?.localName ?? null;
  }, slowChildIndex);
  assert.equal(capturedTag, "ms-map-back", "DOM child order must identify the delayed Back exactly");

  const smaller = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 8,
    viewport: { width: 96, height: 96 },
  });
  await page.evaluate((tree) => window.__replace(tree), smaller.root);
  await waitFor(page, () => {
    const scene = document.querySelector("ms-scene-view");
    return scene?.diagnostics().state === "ready";
  }, "smaller replacement ready", 20_000);
  await waitFor(page, () => {
    const host = window.__slowHost;
    if (host?.isConnected) return false;
    if ((window.__resourceActive ?? 0) > 0) return false;
    const paints = [...document.querySelectorAll("ms-map-batch, ms-map-back")]
      .map((el) => el.diagnostics().paintCommits);
    return paints.length > 0 && paints.every((count) => count === 1);
  }, "stale async settled without late paints", 5_000);
  const staleEvidence = await page.evaluate(() => {
    const host = window.__slowHost;
    const paints = [...document.querySelectorAll("ms-map-batch, ms-map-back")]
      .map((el) => el.diagnostics().paintCommits);
    return {
      failures: window.__presentationFailures ?? [],
      pendingActive: window.__resourceActive ?? 0,
      hostConnected: host?.isConnected === true,
      hostCanvasWidth: host?.shadowRoot?.querySelector("canvas")?.width ?? 0,
      paints,
    };
  });
  assert.equal(staleEvidence.hostConnected, false, "slow Back must disconnect before the delayed Content completes");
  assert.equal(staleEvidence.hostCanvasWidth, 0, "disconnected Back must not retain a bitmap surface");
  assert.ok(staleEvidence.paints.every((count) => count === 1),
    "stale async completion must not trigger a second paint on surviving units");
  assert.deepEqual(staleEvidence.failures, []);
  assert.equal(staleEvidence.pendingActive, 0, "no pending resource client work may leak after replacement");

  await page.evaluate(() => {
    window.__batchHost = document.querySelector("ms-map-batch");
  });
  await page.evaluate(() => window.__replace([]));
  await waitFor(page, () => document.querySelector("ms-scene-view") === null, "authoritative disconnect");
  const disconnected = await page.evaluate(() => {
    const host = window.__batchHost;
    const stillConnected = host?.isConnected === true;
    const canvas = host?.shadowRoot?.querySelector("canvas");
    return {
      stillConnected,
      canvasWidth: canvas?.width ?? 0,
      state: host?.diagnostics?.().state ?? null,
      pendingActive: window.__resourceActive ?? 0,
    };
  });
  assert.equal(disconnected.stillConnected, false);
  assert.equal(disconnected.canvasWidth, 0);
  assert.equal(disconnected.pendingActive, 0);

  await page.evaluate(() => window.__teardown());
  assert.equal(await page.evaluate(() => document.querySelector("ms-scene-view")), null);
  assert.deepEqual(page.__pageErrors, []);
});

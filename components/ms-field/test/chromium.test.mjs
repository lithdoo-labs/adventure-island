import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { buildFieldProjection } from "../src/field-project.mjs";
import { RESOURCE_READ_CONCURRENCY } from "../src/resource-read-pool.mjs";
import { buildCanonicalAdventureAvatarContent } from "../../../scripts/pwa/read-adventure-fsdb.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../../../scripts/pwa/read-adventure-field-plan.mjs";
import { validateFieldTree } from "../src/validate.mjs";
import {
  M7_6_VIEWPORT_BUDGETS,
  M7_7_BACK_ANIM_BUDGETS,
  M7_PORTAL_BUDGETS,
} from "../../../systems/adventure-map/portal-budgets.mjs";
import { projectViewportRelayoutUpdates } from "../../../systems/adventure-map/viewport-view-projection.mjs";
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

test("real map field tree keeps player between paint units in WebProjector", { timeout: 120_000 }, async (t) => {
  const { plan: avatarPlan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 20,
    viewport: { width: 96, height: 96 },
    avatarPlan,
  });
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
  });
  await page.evaluate((tree) => window.__open(tree), projection.root);
  await waitFor(page, () => {
    const scene = document.querySelector("ms-scene-view");
    const player = document.querySelector("ms-world-item");
    const avatar = document.querySelector("ms-avatar");
    return scene?.diagnostics().state === "ready"
      && player?.diagnostics().state === "ready"
      && avatar?.getAttribute("data-render-state") === "ready"
      && document.querySelectorAll("ms-map-batch, ms-map-back").length > 0;
  }, "field scene ready");
  const inspected = await page.evaluate(() => {
    const scene = document.querySelector("ms-scene-view");
    const keys = [...scene.children].map((node) => node.localName);
    const playerIndex = keys.indexOf("ms-world-item");
    return {
      keys,
      playerIndex,
      hasBatchBefore: keys.slice(0, playerIndex).some((name) => name === "ms-map-batch" || name === "ms-map-back"),
      hasBatchAfter: keys.slice(playerIndex + 1).some((name) => name === "ms-map-batch" || name === "ms-map-back"),
      camera: [scene.getAttribute("camera-x"), scene.getAttribute("camera-y")],
      dpr: window.devicePixelRatio,
    };
  });
  assert.ok(inspected.playerIndex > 0);
  assert.equal(inspected.hasBatchBefore && inspected.hasBatchAfter, true);
  assert.equal(inspected.dpr, 1);
  assert.deepEqual(page.__pageErrors, []);
  assert.deepEqual(await page.evaluate(() => window.__presentationFailures), []);
});

test("camera update keeps static batch paint counts stable", { timeout: 120_000 }, async (t) => {
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 20,
    viewport: { width: 96, height: 96 },
  });
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
  });
  await page.evaluate((tree) => window.__open(tree), projection.root);
  await waitFor(page, () => {
    const scene = document.querySelector("ms-scene-view");
    const batches = [...document.querySelectorAll("ms-map-batch")];
    return scene?.diagnostics().state === "ready"
      && batches.length > 0
      && batches.every((batch) => batch.diagnostics().state === "ready");
  }, "field ready");
  const before = await page.evaluate(() => [...document.querySelectorAll("ms-map-batch")]
    .map((batch) => batch.diagnostics().paintCommits));
  await page.evaluate(() => window.__update([{
    op: "update",
    key: "scene:map222000000",
    attrs: { set: { "camera-x": "10", "camera-y": "12" } },
  }]));
  await waitFor(page, () => document.querySelector("ms-scene-view").getAttribute("camera-x") === "10", "camera moved");
  const after = await page.evaluate(() => {
    const batches = [...document.querySelectorAll("ms-map-batch")];
    const scene = document.querySelector("ms-scene-view");
    return {
      paints: batches.map((batch) => batch.diagnostics().paintCommits),
      cameraX: getComputedStyle(scene.shadowRoot.querySelector(".world-plane")).getPropertyValue("--ms-scene-camera-x"),
    };
  });
  assert.deepEqual(after.paints, before);
  assert.equal(after.cameraX.trim(), "10px");
});

test("field scene commits drawable pixels on ms-avatar and finite canvases", { timeout: 120_000 }, async (t) => {
  const { plan: avatarPlan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 20,
    viewport: { width: 96, height: 96 },
    avatarPlan,
  });
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
  });
  await page.evaluate((tree) => window.__open(tree), projection.root);
  await waitFor(page, () => {
    const scene = document.querySelector("ms-scene-view");
    const avatar = document.querySelector("ms-avatar");
    return scene?.diagnostics().state === "ready"
      && avatar?.getAttribute("data-render-state") === "ready"
      && document.querySelectorAll("ms-map-batch, ms-map-back").length > 0;
  }, "field scene ready");
  const pixels = await page.evaluate(() => {
    const sample = (element) => {
      const canvas = element?.shadowRoot?.querySelector("canvas");
      if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
      const ctx = canvas.getContext("2d");
      const x = Math.min(4, canvas.width - 1);
      const y = Math.min(4, canvas.height - 1);
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    };
    const canvases = [...document.querySelectorAll("ms-map-batch, ms-map-back, ms-avatar")]
      .map((element) => element.shadowRoot?.querySelector("canvas"))
      .filter((canvas) => canvas && canvas.width > 0 && canvas.height > 0);
    const pixelArea = canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0);
    return {
      avatar: sample(document.querySelector("ms-avatar")),
      pixelArea,
      canvasCount: canvases.length,
    };
  });
  assert.ok(pixels.canvasCount > 0);
  assert.ok(pixels.pixelArea > 0, "field scene should allocate finite local canvas pixels");
  assert.ok(Array.isArray(pixels.avatar), "ms-avatar should commit non-empty canvas pixels");
  assert.ok(pixels.avatar[3] > 0, "ms-avatar pixels should be visible");
  assert.deepEqual(page.__pageErrors, []);
  assert.deepEqual(await page.evaluate(() => window.__presentationFailures), []);
});

function minimalStandaloneEvidenceTree(fullRoot) {
  const order = ["ms-map-back", "ms-map-batch", "ms-map-object", "ms-world-item", "ms-portal-visual"];
  const children = [];
  for (const tag of order) {
    const child = fullRoot.children.find((unit) => unit.tag === tag);
    if (child) children.push(child);
  }
  const root = structuredClone(fullRoot);
  root.children = children.map((child, index) => ({
    ...child,
    attrs: Object.freeze({ ...child.attrs, "stack-rank": String(index + 1) }),
  }));
  assert.equal(validateFieldTree(root).ok, true);
  return root;
}

test("standalone map objects and portal visuals paint first-frame pixels in DOM stack-rank order", { timeout: 120_000 }, async (t) => {
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 298,
    viewport: { width: 96, height: 96 },
  });
  const tree = minimalStandaloneEvidenceTree(projection.root);
  const index = await loadResourceIndex(tree, repoRoot);
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
  });
  await page.evaluate((opened) => window.__open(opened), tree);
  await waitFor(page, () => {
    const scene = document.querySelector("ms-scene-view");
    const objects = [...document.querySelectorAll("ms-map-object, ms-portal-visual")];
    return scene?.diagnostics().state === "ready"
      && objects.length > 0
      && objects.every((element) => element.diagnostics().state === "ready");
  }, "standalone units ready", 20_000);
  const evidence = await page.evaluate(() => {
    const scene = document.querySelector("ms-scene-view");
    const childTags = [...scene.children].map((node) => node.localName);
    const ranks = [...scene.children].map((node) => Number(node.getAttribute("stack-rank")));
    const sampleOpaque = (element) => {
      const canvas = element.shadowRoot?.querySelector("canvas");
      if (!canvas || canvas.width === 0 || canvas.height === 0) return 0;
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1;
      return count;
    };
    const standalone = [...document.querySelectorAll("ms-map-object, ms-portal-visual")];
    return {
      childTags: childTags.slice(0, 12),
      ranks,
      objectCount: document.querySelectorAll("ms-map-object").length,
      portalCount: document.querySelectorAll("ms-portal-visual").length,
      opaquePixels: standalone.map((element) => sampleOpaque(element)),
    };
  });
  assert.ok(evidence.objectCount > 0);
  assert.ok(evidence.portalCount > 0);
  assert.ok(evidence.opaquePixels.every((count) => count > 0), "standalone canvases must commit nontransparent pixels");
  for (let index = 1; index < evidence.ranks.length; index += 1) {
    assert.ok(evidence.ranks[index] > evidence.ranks[index - 1], "stack-rank must increase with DOM child order");
  }
});

test("initial standalone resource failure stays hidden with an empty canvas", { timeout: 120_000 }, async (t) => {
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 90,
    viewport: { width: 96, height: 96 },
  });
  const root = structuredClone(projection.root);
  const standalone = root.children.find((child) => child.tag === "ms-map-object" || child.tag === "ms-portal-visual");
  assert.ok(standalone, "projection must include a standalone paint unit");
  const frameImage = standalone.data?.phase === "sequence"
    ? standalone.data.frames[0].image
    : standalone.tag === "ms-map-object" || standalone.data?.phase === "loop"
      ? standalone.data.frames[0].image
      : standalone.data.image;
  frameImage.resource.key = "missing/frame";
  frameImage.resource.contentVersion = `sha256:${"0".repeat(64)}`;
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
  });
  await page.evaluate((tree) => window.__open(tree), root);
  await waitFor(page, () => {
    const target = [...document.querySelectorAll("ms-map-object, ms-portal-visual")]
      .find((element) => element.diagnostics().state === "failed");
    return target?.shadowRoot?.querySelector("canvas")?.width === 0;
  }, "failed standalone unit cleared");
  const proof = await page.evaluate(() => {
    const target = [...document.querySelectorAll("ms-map-object, ms-portal-visual")]
      .find((element) => element.diagnostics().state === "failed");
    const canvas = target?.shadowRoot?.querySelector("canvas");
    return {
      state: target?.diagnostics().state ?? null,
      width: canvas?.width ?? 0,
      visible: getComputedStyle(target).visibility,
    };
  });
  assert.equal(proof.state, "failed");
  assert.equal(proof.width, 0);
  assert.equal(proof.visible, "hidden");
});

test("failed standalone replacement keeps last-good pixels, geometry, and paint count", { timeout: 120_000 }, async (t) => {
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 298,
    viewport: { width: 96, height: 96 },
  });
  const goodTree = minimalStandaloneEvidenceTree(projection.root);
  const index = await loadResourceIndex(goodTree, repoRoot);
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
  });
  await page.evaluate((opened) => window.__open(opened), goodTree);
  await waitFor(page, () => {
    const target = document.querySelector("ms-map-object");
    return target?.diagnostics().state === "ready" && target.shadowRoot?.querySelector("canvas")?.width > 0;
  }, "map object ready", 20_000);
  const before = await page.evaluate(() => {
    const target = document.querySelector("ms-map-object");
    const canvas = target.shadowRoot.querySelector("canvas");
    const style = getComputedStyle(target);
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque += 1;
    return {
      paintCommits: target.diagnostics().paintCommits,
      width: canvas.width,
      height: canvas.height,
      opaque,
      left: style.left,
      top: style.top,
      hostWidth: style.width,
      hostHeight: style.height,
    };
  });
  const objectNode = goodTree.children.find((child) => child.tag === "ms-map-object");
  const badData = structuredClone(objectNode.data);
  badData.frames[0].image.resource.key = "missing/frame";
  badData.frames[0].image.resource.contentVersion = `sha256:${"0".repeat(64)}`;
  await page.evaluate(({ key, data }) => window.__update([{ op: "update", key, data: { set: data } }]), {
    key: objectNode.key,
    data: badData,
  });
  await waitFor(page, () => document.querySelector("ms-map-object")?.diagnostics().state === "failed", "replacement failed");
  const after = await page.evaluate(() => {
    const target = document.querySelector("ms-map-object");
    const canvas = target.shadowRoot.querySelector("canvas");
    const style = getComputedStyle(target);
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque += 1;
    return {
      state: target.diagnostics().state,
      paintCommits: target.diagnostics().paintCommits,
      width: canvas.width,
      height: canvas.height,
      opaque,
      left: style.left,
      top: style.top,
      hostWidth: style.width,
      hostHeight: style.height,
    };
  });
  assert.equal(after.state, "failed");
  assert.equal(after.paintCommits, before.paintCommits);
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
  assert.equal(after.opaque, before.opaque);
  assert.equal(after.left, before.left);
  assert.equal(after.top, before.top);
  assert.equal(after.hostWidth, before.hostWidth);
  assert.equal(after.hostHeight, before.hostHeight);
});

test("Obj flow camera attrs retain decoded frames and static paint commits", { timeout: 120_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030200",
  });
  const tree = structuredClone(plan.root);
  const flowObjects = tree.children.filter(
    (child) => child.tag === "ms-map-object" && child.data?.source?.flow === 1,
  );
  assert.equal(flowObjects.length, 11);
  flowObjects.forEach((object, index) => { object.attrs["stack-rank"] = String(index + 1); });
  tree.children = flowObjects;
  assert.equal(validateFieldTree(tree).ok, true);
  const flowObject = flowObjects[0];

  const index = await loadResourceIndex(tree, repoRoot);
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
  await page.evaluate((opened) => window.__open(opened), tree);
  await waitFor(page, () => {
    const objects = [...document.querySelectorAll("ms-map-object")];
    return objects.length === 11
      && objects.every((object) => object.diagnostics().state === "ready")
      && window.__resourceActive === 0;
  }, "Obj flow hosts ready", 30_000);
  const fishCanvasWidths = await page.evaluate(() => [...document.querySelectorAll("ms-map-object")]
    .map((host) => host.shadowRoot?.querySelector("canvas")?.width ?? 0));
  assert.equal(fishCanvasWidths.length, 11);
  assert.ok(fishCanvasWidths.every((width) => width > 0 && width < 200),
    `flow fish must stay on their own sprite, got ${fishCanvasWidths.join(",")}`);
  assert.ok(server.metrics.maxConcurrentContentReads <= RESOURCE_READ_CONCURRENCY);
  t.diagnostic(`Obj flow max concurrent Content reads ${server.metrics.maxConcurrentContentReads}/${RESOURCE_READ_CONCURRENCY}`);
  const before = await page.evaluate(() => document.querySelector("ms-map-object").diagnostics());
  const beforeLeft = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector("ms-map-object")).left));
  const nextWorldX = Number(flowObject.attrs["world-x"]) + 25;
  await page.evaluate(({ key, worldX }) => window.__update([{
    op: "update",
    key,
    attrs: { set: { "world-x": String(worldX) } },
  }]), { key: flowObject.key, worldX: nextWorldX });
  await waitFor(page, (expected) => getComputedStyle(document.querySelector("ms-map-object")).left === `${expected}px`, "Obj flow moved", 20_000, beforeLeft + 25);
  const after = await page.evaluate(() => document.querySelector("ms-map-object").diagnostics());
  assert.equal(after.state, "ready");
  assert.equal(after.resourceReads, before.resourceReads, "camera-only attrs must not reload Obj frames");
  assert.equal(after.paintCommits, before.paintCommits, "camera-only attrs must not repaint Obj pixels");
  assert.ok(after.animationPaints >= before.animationPaints);
  assert.deepEqual(page.__pageErrors, []);
});

test("retiring Obj flow during a later frame read closes decoded stale bitmaps", { timeout: 120_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030200",
  });
  const tree = structuredClone(plan.root);
  const flowObject = tree.children.find(
    (child) => child.tag === "ms-map-object" && child.data?.source?.flow === 1,
  );
  assert.ok(flowObject?.data.frames.length > 1);
  flowObject.attrs["stack-rank"] = "1";
  tree.children = [flowObject];
  const index = await loadResourceIndex(tree, repoRoot);
  const delayed = flowObject.data.frames[1].image.resource;
  const resourceDelayMs = new Map([[`${delayed.namespace}\0${delayed.key}`, 5_000]]);
  const server = await startFieldServer({ index, scriptBytes, resourceDelayMs });
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
  await page.evaluate(() => {
    window.__bitmapCloses = 0;
    const close = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function trackedClose() {
      window.__bitmapCloses += 1;
      return close.call(this);
    };
  });
  await page.evaluate((opened) => window.__open(opened), tree);
  await waitFor(page, () => window.__resourceCalls.length >= 2, "second Obj frame read started", 20_000);
  await page.evaluate(() => window.__replace([]));
  await waitFor(page, () => (
    document.querySelector("ms-map-object") === null
      && window.__resourceActive === 0
      && window.__bitmapCloses >= 1
  ), "retired Obj stale bitmap closed", 20_000);
  assert.deepEqual(page.__pageErrors, []);
});

test("M7.6 relayout during Content load cannot restore stale viewport geometry", { timeout: 90_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030200",
  });
  const tree = structuredClone(plan.root);
  const tiledBacks = tree.children.filter((child) => child.tag === "ms-map-back" && child.data?.layout?.tileHorizontal);
  const back = tiledBacks[0];
  const otherBack = tiledBacks[1];
  assert.ok(back?.data?.draw);
  assert.ok(otherBack);
  tree.children = [back, otherBack];
  tree.children.forEach((child, index) => {
    child.attrs["stack-rank"] = String(index + 1);
  });
  const index = await loadResourceIndex(tree, repoRoot);
  const delayedRefs = [];
  walkResources(tree, delayedRefs);
  const resourceDelayMs = new Map(delayedRefs.map((ref) => [`${ref.namespace}\0${ref.key}`, 750]));
  const server = await startFieldServer({ index, scriptBytes, resourceDelayMs });
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
  await page.evaluate((opened) => window.__open(opened), tree);
  await waitFor(page, () => (
    document.querySelectorAll("ms-map-back, ms-map-object").length === 2
      && window.__resourceActive > 0
  ), "M7.6 delayed Content reads start", 20_000);
  const camera = {
    cameraX: Number(tree.attrs["camera-x"]),
    cameraY: Number(tree.attrs["camera-y"]),
  };
  const relayout = projectViewportRelayoutUpdates(tree.children, { width: 800, height: 600 }, camera);
  await page.evaluate((ops) => window.__update(ops), relayout.map((node) => ({ op: "update", ...node })));
  await page.setViewportSize({ width: 800, height: 600 });
  await waitFor(page, () => (
    [...document.querySelectorAll("ms-map-back, ms-map-object")]
      .every((host) => host.diagnostics().state === "ready")
      && window.__resourceActive === 0
  ), "M7.6 delayed hosts ready at latest viewport", 60_000);
  const latestGeometry = await page.evaluate(() => [...document.querySelectorAll("ms-map-back, ms-map-object")]
    .map((host) => ({
      tag: host.localName,
      hostWidth: getComputedStyle(host).width,
      canvasWidth: host.shadowRoot.querySelector("canvas").style.width,
    })));
  assert.deepEqual(latestGeometry, [
    { tag: "ms-map-back", hostWidth: "800px", canvasWidth: "800px" },
    { tag: "ms-map-back", hostWidth: "800px", canvasWidth: "800px" },
  ]);

  const beforeDrawChange = await page.evaluate(() => document.querySelector("ms-map-back").diagnostics());
  const nextDraw = structuredClone(back.data.draw);
  nextDraw.opacity = nextDraw.opacity === 255 ? 254 : nextDraw.opacity + 1;
  await page.evaluate(({ key, draw }) => window.__update([{
    op: "update",
    key,
    data: { set: { draw } },
  }]), { key: back.key, draw: nextDraw });
  await waitFor(page, (before) => {
    const diagnostics = document.querySelector("ms-map-back")?.diagnostics();
    return diagnostics?.state === "ready"
      && diagnostics.resourceReads === before.resourceReads + 1
      && diagnostics.paintCommits === before.paintCommits + 1;
  }, "Back draw change invalidates its content signature", 20_000, beforeDrawChange);
  assert.deepEqual(page.__pageErrors, []);
});

test("M7.6 viewport relayout retains decoded Content and bounded animation clocks", { timeout: 180_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({
    gameRoot: repoRoot,
    mapId: "230030200",
  });
  const tree = structuredClone(plan.root);
  const relayoutHosts = tree.children.filter((child) => (
    (child.tag === "ms-map-back" && child.data?.layout?.tileHorizontal)
    || (child.tag === "ms-map-object" && child.data?.source?.flow === 1)
  ));
  assert.equal(relayoutHosts.filter((child) => child.tag === "ms-map-back").length, 21);
  assert.equal(relayoutHosts.filter((child) => child.data?.source?.flow === 1).length, 11);
  relayoutHosts.forEach((child, index) => {
    child.attrs["stack-rank"] = String(index + 1);
  });
  tree.children = relayoutHosts;
  const index = await loadResourceIndex(tree, repoRoot);
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
  await page.evaluate((opened) => window.__open(opened), tree);
  await waitFor(page, () => (
    document.querySelectorAll("ms-map-back, ms-map-object").length === 32
      && [...document.querySelectorAll("ms-map-back, ms-map-object")]
        .every((host) => host.diagnostics().state === "ready")
      && window.__resourceActive === 0
  ), "water relayout hosts ready", 90_000);
  await page.evaluate(() => { window.__settledReads = null; });
  await waitFor(page, () => {
    const reads = [...document.querySelectorAll("ms-map-back, ms-map-object")]
      .reduce((sum, host) => sum + host.diagnostics().resourceReads, 0);
    if (window.__settledReads === reads && window.__resourceActive === 0) return true;
    window.__settledReads = reads;
    return false;
  }, "Obj multi-frame reads settle", 60_000);
  const afterReady = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll("ms-map-back, ms-map-object")];
    const canvases = hosts.map((host) => host.shadowRoot?.querySelector("canvas")).filter(Boolean);
    const domNodes = document.getElementsByTagName("*").length;
    return {
      resourceReads: hosts.reduce((sum, host) => sum + host.diagnostics().resourceReads, 0),
      paintCommits: hosts.reduce((sum, host) => sum + host.diagnostics().paintCommits, 0),
      backAnims: hosts.filter((host) => host.localName === "ms-map-back")
        .map((host) => host.diagnostics().animationPaints ?? 0),
      objAnims: hosts.filter((host) => host.localName === "ms-map-object")
        .map((host) => host.diagnostics().animationPaints ?? 0),
      domNodes,
      heapProxy: domNodes + canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0) / 1_000,
    };
  });
  let liveChildren = tree.children;
  const camera = {
    cameraX: Number(tree.attrs["camera-x"]),
    cameraY: Number(tree.attrs["camera-y"]),
  };
  const cycles = [
    { width: 800, height: 600 },
    { width: 1000, height: 700 },
    { width: 800, height: 600 },
    { width: 1000, height: 700 },
    { width: 800, height: 600 },
    { width: 1000, height: 700 },
  ];
  let maxEventLoopLagMs = 0;
  for (const size of cycles) {
    const readsBeforeCycle = await page.evaluate(() => [...document.querySelectorAll("ms-map-back, ms-map-object")]
      .reduce((sum, host) => sum + host.diagnostics().resourceReads, 0));
    const relayout = projectViewportRelayoutUpdates(liveChildren, size, camera);
    const ops = relayout.map((node) => ({ op: "update", ...node }));
    await page.evaluate((patchOps) => window.__update(patchOps), ops);
    for (const node of relayout) {
      if (!node.data?.set?.layout) continue;
      const index = liveChildren.findIndex((child) => child.key === node.key);
      if (index < 0) continue;
      const child = liveChildren[index];
      liveChildren[index] = Object.freeze({
        ...child,
        data: Object.freeze({ ...child.data, layout: node.data.set.layout }),
      });
    }
    await page.setViewportSize(size);
    await page.waitForTimeout(80);
    const eventLoopLagMs = await page.evaluate(() => new Promise((resolve) => {
      const started = performance.now();
      setTimeout(() => resolve(performance.now() - started), 0);
    }));
    maxEventLoopLagMs = Math.max(maxEventLoopLagMs, eventLoopLagMs);
    const snap = await page.evaluate((expectedWidth) => {
      const backs = [...document.querySelectorAll("ms-map-back")]
        .filter((host) => Number(getComputedStyle(host).width.replace("px", "")) === expectedWidth);
      const flows = [...document.querySelectorAll("ms-map-object")]
        .filter((host) => Number(getComputedStyle(host).width.replace("px", "")) === expectedWidth);
      const canvases = [...document.querySelectorAll("ms-map-back, ms-map-object")]
        .map((host) => host.shadowRoot?.querySelector("canvas")).filter(Boolean);
      return {
        backs: backs.length,
        flows: flows.length,
        backsReady: backs.every((host) => host.diagnostics().state === "ready"),
        flowsReady: flows.every((host) => host.diagnostics().state === "ready"),
        totalPixels: canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0),
      };
    }, size.width);
    assert.ok(snap.backsReady && snap.flowsReady);
    assert.equal(snap.backs, 21);
    assert.equal(snap.flows, 0);
    assert.ok(snap.totalPixels <= M7_PORTAL_BUDGETS.maxWaterMapTotalCanvasPixels);
    await waitFor(page, () => window.__resourceActive === 0, "relayout cycle quiesced", 10_000);
    const readsAfterCycle = await page.evaluate(() => [...document.querySelectorAll("ms-map-back, ms-map-object")]
      .reduce((sum, host) => sum + host.diagnostics().resourceReads, 0));
    assert.equal(readsAfterCycle, readsBeforeCycle,
      "each Back/Obj relayout cycle must retain decoded Content without extra reads");
  }
  await waitFor(page, (before) => {
    const backs = [...document.querySelectorAll("ms-map-back")]
      .map((host) => host.diagnostics().animationPaints ?? 0);
    const objects = [...document.querySelectorAll("ms-map-object")]
      .map((host) => host.diagnostics().animationPaints ?? 0);
    return backs.some((count, index) => count > before.backAnims[index])
      && objects.some((count, index) => count > before.objAnims[index]);
  }, "Back and Obj animation clocks advance after relayout", 10_000, afterReady);
  const afterSoak = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll("ms-map-back, ms-map-object")];
    const canvases = hosts.map((host) => host.shadowRoot?.querySelector("canvas")).filter(Boolean);
    const domNodes = document.getElementsByTagName("*").length;
    return {
      resourceReads: hosts.reduce((sum, host) => sum + host.diagnostics().resourceReads, 0),
      paintCommits: hosts.reduce((sum, host) => sum + host.diagnostics().paintCommits, 0),
      backAnims: hosts.filter((host) => host.localName === "ms-map-back")
        .map((host) => host.diagnostics().animationPaints ?? 0),
      objAnims: hosts.filter((host) => host.localName === "ms-map-object")
        .map((host) => host.diagnostics().animationPaints ?? 0),
      domNodes,
      heapProxy: domNodes + canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0) / 1_000,
    };
  });
  assert.equal(afterSoak.resourceReads, afterReady.resourceReads,
    "viewport relayout must not re-read decoded Content after soak");
  assert.ok(afterSoak.domNodes <= M7_6_VIEWPORT_BUDGETS.maxDomNodeCount);
  assert.ok(afterSoak.heapProxy <= M7_6_VIEWPORT_BUDGETS.maxHeapDomProxyScore);
  assert.ok(Math.abs(afterSoak.heapProxy - afterReady.heapProxy) <= M7_6_VIEWPORT_BUDGETS.maxHeapDomProxyDelta);
  assert.ok(
    afterSoak.paintCommits - afterReady.paintCommits
      <= M7_6_VIEWPORT_BUDGETS.maxWaterMapRelayoutPaintCommitsDelta,
  );
  assert.ok(maxEventLoopLagMs <= M7_6_VIEWPORT_BUDGETS.maxEventLoopLagProxyMs);
  assert.ok(
    afterSoak.backAnims.some((count, index) => count > afterReady.backAnims[index]),
    "a dynamic Back clock must continue advancing across relayout",
  );
  assert.ok(
    afterSoak.objAnims.some((count, index) => count > afterReady.objAnims[index]),
    "a dynamic Obj clock must continue advancing across relayout",
  );
  await page.evaluate(() => {
    window.__retiredRelayoutHosts = [...document.querySelectorAll("ms-map-back, ms-map-object")];
    window.__replace([]);
  });
  await waitFor(page, () => window.__retiredRelayoutHosts.every((host) => (
    !host.isConnected && host.shadowRoot?.querySelector("canvas")?.width === 0
  )), "relayout hosts retire and release canvases", 20_000);
  const detachedCanvasDelta = await page.evaluate(() => window.__retiredRelayoutHosts
    .filter((host) => host.shadowRoot?.querySelector("canvas")?.width > 0).length);
  assert.ok(detachedCanvasDelta <= M7_6_VIEWPORT_BUDGETS.maxDetachedCanvasDelta);
  t.diagnostic(`M7.6 soak cycles ${cycles.length}; retained Content reads ${afterSoak.resourceReads}; paint commits delta ${afterSoak.paintCommits - afterReady.paintCommits}; event-loop lag proxy ${maxEventLoopLagMs.toFixed(1)} ms`);
  assert.deepEqual(page.__pageErrors, []);
});

test("M7.7 animated Back loops without further Content reads after frame closure", { timeout: 90_000 }, async (t) => {
  const projection = await buildFieldProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 96, height: 96 },
  });
  const back = projection.root.children.find((child) => (
    child.tag === "ms-map-back"
    && child.data?.mode === "local-animation"
    && child.data.frames.length > 1
    && child.data.frames.some((frame) => Number(frame.delay) > 0)
    && child.data.frames.reduce((sum, frame) => sum + (Number(frame.delay) || 0), 0) <= 2_000
  ));
  assert.ok(back);
  const isolatedBack = { ...back, attrs: { ...back.attrs, "stack-rank": "1" } };
  const tree = { ...projection.root, children: [isolatedBack] };
  assert.equal(validateFieldTree(tree).ok, true);
  const index = await loadResourceIndex(tree, repoRoot);
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
  });
  const readyStarted = performance.now();
  await page.evaluate((root) => window.__open(root), tree);
  await waitFor(page, () => {
    const host = document.querySelector("ms-map-back");
    return host?.diagnostics?.().state === "ready" && (host.diagnostics().animationPaints ?? 0) > 0;
  }, "animated Back host reaches ready and paints", 30_000);
  const readyMs = performance.now() - readyStarted;
  assert.ok(readyMs <= M7_7_BACK_ANIM_BUDGETS.maxWaterMapBrowserReadyMs);
  const afterReady = await page.evaluate(() => {
    const host = document.querySelector("ms-map-back");
    const canvas = host.shadowRoot.querySelector("canvas");
    const style = getComputedStyle(host);
    return {
      resourceReads: host.diagnostics().resourceReads,
      animationPaints: host.diagnostics().animationPaints ?? 0,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      hostLeft: style.left,
      hostTop: style.top,
      hostWidth: style.width,
      hostHeight: style.height,
    };
  });
  assert.ok(afterReady.animationPaints > 0);
  assert.equal(afterReady.resourceReads, back.data.frames.length);
  assert.ok(afterReady.resourceReads <= M7_7_BACK_ANIM_BUDGETS.maxWaterMapBackAnimFrameResources);
  await page.evaluate((target) => { window.__m77AnimationPaintTarget = target; }, afterReady.animationPaints + 2);
  await waitFor(page, () => (
    document.querySelector("ms-map-back")?.diagnostics().animationPaints >= window.__m77AnimationPaintTarget
  ), "animated Back keeps painting", 5_000);
  const afterLoop = await page.evaluate(() => {
    const host = document.querySelector("ms-map-back");
    const canvas = host.shadowRoot.querySelector("canvas");
    const style = getComputedStyle(host);
    return {
      ...host.diagnostics(),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      hostLeft: style.left,
      hostTop: style.top,
      hostWidth: style.width,
      hostHeight: style.height,
    };
  });
  assert.equal(afterLoop.resourceReads, afterReady.resourceReads);
  assert.ok(afterLoop.animationPaints > afterReady.animationPaints);
  assert.deepEqual(
    [afterLoop.canvasWidth, afterLoop.canvasHeight, afterLoop.hostLeft, afterLoop.hostTop, afterLoop.hostWidth, afterLoop.hostHeight],
    [afterReady.canvasWidth, afterReady.canvasHeight, afterReady.hostLeft, afterReady.hostTop, afterReady.hostWidth, afterReady.hostHeight],
    "Back frame changes must retain one stable local Canvas and host box",
  );
  const maxActive = await page.evaluate(() => window.__resourceMaxActive);
  assert.ok(maxActive <= M7_7_BACK_ANIM_BUDGETS.maxContentReadConcurrency);
  t.diagnostic(`M7.7 isolated Back ready ${readyMs.toFixed(1)}ms; Content concurrency ${maxActive}/${M7_7_BACK_ANIM_BUDGETS.maxContentReadConcurrency}`);
  assert.deepEqual(page.__pageErrors, []);
});

test("M7.7 retire during later-frame Back load cannot commit stale bitmaps", { timeout: 60_000 }, async (t) => {
  const projection = await buildFieldProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 96, height: 96 },
  });
  const back = projection.root.children.find((child) => child.tag === "ms-map-back" && child.data?.frames?.length > 1);
  assert.ok(back);
  const isolatedBack = { ...back, attrs: { ...back.attrs, "stack-rank": "1" } };
  const tree = { ...projection.root, children: [isolatedBack] };
  assert.equal(validateFieldTree(tree).ok, true);
  const index = await loadResourceIndex(tree, repoRoot);
  const delayed = back.data.frames[1].image.resource;
  const resourceDelayMs = delayed
    ? new Map([[`${delayed.namespace}\0${delayed.key}`, 5_000]])
    : new Map();
  const server = await startFieldServer({ index, scriptBytes, resourceDelayMs });
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
  await page.evaluate((root) => window.__open(root), tree);
  await waitFor(page, () => document.querySelector("ms-map-back")?.diagnostics()?.resourceReads >= 2,
    "M7.7 later-frame Back load starts", 5_000);
  const emptyTree = { ...tree, key: "scene:m77-empty", children: [] };
  await page.evaluate((root) => {
    window.__retiredBack = document.querySelector("ms-map-back");
    window.__replace(root);
  }, emptyTree);
  await waitFor(page, () => (
    !window.__retiredBack?.isConnected
    && window.__retiredBack?.shadowRoot?.querySelector("canvas")?.width === 0
  ), "retired Back drops canvas", 30_000);
  assert.deepEqual(page.__pageErrors, []);
});

test("M7.7 failed animated Back replacement retains last-good pixels", { timeout: 60_000 }, async (t) => {
  const projection = await buildFieldProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 96, height: 96 },
  });
  const back = projection.root.children.find((child) => child.tag === "ms-map-back" && child.data?.frames?.length > 1);
  assert.ok(back);
  const isolatedBack = { ...back, attrs: { ...back.attrs, "stack-rank": "1" } };
  const tree = { ...projection.root, children: [isolatedBack] };
  assert.equal(validateFieldTree(tree).ok, true);
  const index = await loadResourceIndex(tree, repoRoot);
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
  });
  await page.evaluate((root) => window.__open(root), tree);
  await waitFor(page, () => document.querySelector("ms-map-back")?.diagnostics()?.state === "ready",
    "M7.7 Back initial paint reaches ready", 30_000);
  const before = await page.evaluate(() => {
    const host = document.querySelector("ms-map-back");
    const canvas = host.shadowRoot.querySelector("canvas");
    return {
      paintCommits: host.diagnostics().paintCommits,
      width: canvas.width,
      height: canvas.height,
      visibility: getComputedStyle(host).visibility,
    };
  });
  const brokenTree = structuredClone(tree);
  brokenTree.children[0].data.frames[1].image.resource.key += "-missing";
  assert.equal(validateFieldTree(brokenTree).ok, true);
  await page.evaluate((root) => window.__replace(root), brokenTree);
  await waitFor(page, () => document.querySelector("ms-map-back")?.diagnostics()?.state === "failed",
    "M7.7 Back replacement reports missing later frame", 30_000);
  const afterFailure = await page.evaluate(() => {
    const host = document.querySelector("ms-map-back");
    const canvas = host.shadowRoot.querySelector("canvas");
    return {
      ...host.diagnostics(),
      width: canvas.width,
      height: canvas.height,
      visibility: getComputedStyle(host).visibility,
    };
  });
  assert.equal(afterFailure.code, "RESOURCE_MISSING");
  assert.equal(afterFailure.paintCommits, before.paintCommits);
  assert.deepEqual(
    [afterFailure.width, afterFailure.height, afterFailure.visibility],
    [before.width, before.height, before.visibility],
  );
  assert.ok(afterFailure.width > 0 && afterFailure.height > 0);
  assert.deepEqual(page.__pageErrors, []);
});

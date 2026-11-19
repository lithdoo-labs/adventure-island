import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { buildFieldProjection } from "../src/field-project.mjs";
import { validateFieldTree } from "../src/validate.mjs";
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

test("real map field tree keeps player between paint units in WebProjector", { timeout: 120_000 }, async (t) => {
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
    const player = document.querySelector("ms-world-item");
    const slot = document.querySelector("ms-m3-avatar-slot");
    return scene?.diagnostics().state === "ready"
      && player?.diagnostics().state === "ready"
      && slot?.diagnostics().state === "ready"
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

test("field scene commits drawable pixels on avatar slot and finite canvases", { timeout: 120_000 }, async (t) => {
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
    const slot = document.querySelector("ms-m3-avatar-slot");
    return scene?.diagnostics().state === "ready"
      && slot?.diagnostics().state === "ready"
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
    const canvases = [...document.querySelectorAll("ms-map-batch, ms-map-back, ms-m3-avatar-slot")]
      .map((element) => element.shadowRoot?.querySelector("canvas"))
      .filter((canvas) => canvas && canvas.width > 0 && canvas.height > 0);
    const pixelArea = canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0);
    return {
      slot: sample(document.querySelector("ms-m3-avatar-slot")),
      pixelArea,
      canvasCount: canvases.length,
    };
  });
  assert.ok(pixels.canvasCount > 0);
  assert.ok(pixels.pixelArea > 0, "field scene should allocate finite local canvas pixels");
  assert.deepEqual(pixels.slot?.slice(0, 3), [0, 200, 80]);
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
  if (standalone.tag === "ms-map-object") {
    standalone.data.frames[0].image.resource.key = "missing/frame";
    standalone.data.frames[0].image.resource.contentVersion = `sha256:${"0".repeat(64)}`;
  } else {
    standalone.data.image.resource.key = "missing/frame";
    standalone.data.image.resource.contentVersion = `sha256:${"0".repeat(64)}`;
  }
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
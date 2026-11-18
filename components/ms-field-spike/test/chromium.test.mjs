import assert from "node:assert/strict";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { createIdentityTree, createSpikeTree } from "../src/fixture.mjs";
import { decodePng } from "./png-decode.mjs";
import {
  BEARER,
  INSTALLATION_ID,
  SCRIPT_PATH,
  launchChromium,
  openSpikePage,
  preparePresentation,
  sha256,
  solidPng,
  startSpikeServer,
  waitFor,
} from "./harness.mjs";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptBytes = await import("node:fs/promises").then(({ readFile }) => readFile(path.join(componentRoot, "browser", "ms-field-spike.browser.js")));
const images = {
  "pixels/back.png": solidPng(32, 32, [255, 0, 0, 255]),
  "pixels/front.png": solidPng(32, 32, [0, 0, 255, 255]),
  "pixels/slow.png": solidPng(32, 32, [255, 0, 0, 255]),
  "pixels/replacement.png": solidPng(32, 32, [0, 0, 255, 255]),
};
const versions = Object.fromEntries(Object.entries(images).map(([key, bytes]) => [key, sha256(bytes)]));
const index = new Map();
for (const [key, bytes] of Object.entries(images)) {
  index.set(`spike\0${key}`, { bytes, mime: "image/png", contentVersion: versions[key] });
}
index.set(`resource.Presentation\0ms-field-spike/ms-field-spike.browser.js`, {
  bytes: scriptBytes,
  mime: "text/javascript",
  contentVersion: sha256(scriptBytes),
});

let server;
let chromium;

function withVersions(node, replacements = versions) {
  const copy = structuredClone(node);
  const visit = (current) => {
    const pages = current.data?.sprites?.pages;
    if (pages) {
      for (const page of Object.values(pages)) {
        const key = page.resource?.key;
        if (replacements[key]) page.resource.contentVersion = replacements[key];
      }
    }
    for (const child of current.children ?? []) visit(child);
  };
  visit(copy);
  return copy;
}

before(async () => {
  server = await startSpikeServer({ index, scriptBytes });
  chromium = await launchChromium();
});

after(async () => {
  await chromium?.close().catch(() => {});
  if (server) await server.close();
});

async function openReady(t, roots = withVersions(createSpikeTree())) {
  const prepared = await preparePresentation({
    origin: server.origin,
    index,
    configPath: path.join(componentRoot, "presentation.json"),
    scriptPath: SCRIPT_PATH,
  });
  const page = await openSpikePage(t, { chromium, origin: server.origin, prepared, installationId: INSTALLATION_ID, bearer: BEARER });
  await page.evaluate((tree) => window.__open(tree), roots);
  await waitFor(page, () => {
    const batches = [...document.querySelectorAll("ms-map-batch")];
    const marker = document.querySelector("ms-synthetic-marker");
    return document.querySelector("ms-scene-view")?.diagnostics().state === "ready"
      && batches.length > 0
      && batches.every((batch) => batch.diagnostics().state === "ready")
      && marker?.diagnostics().state === "ready";
  }, "spike scene ready");
  assert.deepEqual(page.__pageErrors, []);
  assert.deepEqual(await page.evaluate(() => window.__presentationFailures), []);
  return page;
}

function sample(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return [image.rgba[offset], image.rgba[offset + 1], image.rgba[offset + 2], image.rgba[offset + 3]];
}

test("real WebProjector projects finite canvases and pixel occlusion", { timeout: 60_000 }, async (t) => {
  const page = await openReady(t);
  const inspected = await page.evaluate(() => {
    const scene = document.querySelector("ms-scene-view");
    const batches = [...document.querySelectorAll("ms-map-batch")];
    const item = document.querySelector("ms-world-item");
    const marker = document.querySelector("ms-synthetic-marker");
    const plane = scene.shadowRoot.querySelector(".world-plane");
    const canvases = [...document.querySelectorAll("ms-map-batch, ms-synthetic-marker")]
      .map((host) => host.shadowRoot.querySelector("canvas"));
    const count = (root) => {
      let total = 0;
      const walk = (node) => {
        if (node.nodeType !== 1) return;
        total += 1;
        for (const child of node.children) walk(child);
        if (node.shadowRoot) for (const child of node.shadowRoot.children) walk(child);
      };
      walk(root);
      return total;
    };
    const pixel = (canvas, x, y) => {
      const data = canvas.getContext("2d").getImageData(x, y, 1, 1).data;
      return [data[0], data[1], data[2], data[3]];
    };
    return {
      registered: ["ms-scene-view", "ms-map-batch", "ms-world-item", "ms-synthetic-marker"]
        .every((tag) => typeof customElements.get(tag) === "function"),
      lightOrder: [...scene.children].map((element) => element.localName),
      assigned: [...scene.shadowRoot.querySelector("slot").assignedNodes()].map((node) => node.localName),
      shadow: {
        viewport: scene.shadowRoot.querySelector(".viewport") !== null,
        plane: plane !== null,
        slotParent: plane.querySelector(":scope > slot") !== null,
      },
      zIndex: {
        back: getComputedStyle(batches[0]).zIndex,
        item: getComputedStyle(item).zIndex,
        front: getComputedStyle(batches[1]).zIndex,
      },
      hits: {
        back: document.elementFromPoint(4, 4)?.localName ?? null,
        marker: document.elementFromPoint(10, 10)?.localName ?? null,
        front: document.elementFromPoint(20, 20)?.localName ?? null,
      },
      canvasPixels: canvases.map((canvas) => pixel(canvas, 4, 4)),
      canvasSizes: canvases.map((canvas) => ({ width: canvas.width, height: canvas.height })),
      paints: {
        back: batches[0].diagnostics().paintCommits,
        front: batches[1].diagnostics().paintCommits,
        marker: marker.diagnostics().paintCommits,
      },
      elements: count(scene),
      canvasCount: canvases.length,
      lightCanvasCount: document.querySelectorAll("canvas").length,
      pixelArea: canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0),
      styleAttrs: [scene, ...batches, item, marker].map((element) => element.getAttribute("style")),
      attrs: {
        scene: scene.getAttributeNames().sort(),
        marker: marker.getAttributeNames().sort(),
      },
      parents: {
        marker: marker.parentElement.localName,
        item: item.parentElement.localName,
        batch: batches[0].parentElement.localName,
      },
      childTransform: new DOMMatrix(getComputedStyle(batches[0]).transform).isIdentity,
      dpr: window.devicePixelRatio,
    };
  });
  assert.equal(inspected.registered, true);
  assert.deepEqual(inspected.lightOrder, ["ms-map-batch", "ms-world-item", "ms-map-batch"]);
  assert.deepEqual(inspected.assigned, ["ms-map-batch", "ms-world-item", "ms-map-batch"]);
  assert.deepEqual(inspected.shadow, { viewport: true, plane: true, slotParent: true });
  assert.deepEqual(inspected.zIndex, { back: "10", item: "20", front: "30" });
  assert.deepEqual(inspected.hits, { back: "ms-map-batch", marker: "ms-synthetic-marker", front: "ms-map-batch" });
  assert.deepEqual(inspected.canvasPixels[0], [255, 0, 0, 255]);
  assert.deepEqual(inspected.canvasPixels[1], [0, 255, 0, 255]);
  assert.deepEqual(inspected.canvasPixels[2], [0, 0, 255, 255]);
  assert.deepEqual(inspected.canvasSizes, [
    { width: 32, height: 32 },
    { width: 16, height: 16 },
    { width: 32, height: 32 },
  ]);
  assert.equal(inspected.canvasCount, 3);
  assert.equal(inspected.lightCanvasCount, 0);
  assert.equal(inspected.pixelArea, 2304);
  assert.equal(inspected.elements, 17);
  assert.deepEqual(inspected.paints, { back: 1, front: 1, marker: 1 });
  assert.deepEqual(inspected.styleAttrs, [null, null, null, null, null]);
  assert.deepEqual(inspected.attrs.scene, ["camera-x", "camera-y", "visible"]);
  assert.deepEqual(inspected.attrs.marker, []);
  assert.deepEqual(inspected.parents, { marker: "ms-world-item", item: "ms-scene-view", batch: "ms-scene-view" });
  assert.equal(inspected.childTransform, true);
  assert.equal(inspected.dpr, 1);

  const png = decodePng(await page.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 }, type: "png" }));
  assert.equal(png.width, 64);
  assert.deepEqual(sample(png, 4, 4), [255, 0, 0, 255]);
  assert.deepEqual(sample(png, 10, 10), [0, 255, 0, 255]);
  assert.deepEqual(sample(png, 20, 20), [0, 0, 255, 255]);
  assert.deepEqual(sample(png, 40, 40), [0, 0, 255, 255]);
});

test("camera and position updates do not redraw static canvases", { timeout: 60_000 }, async (t) => {
  const page = await openReady(t);
  const before = await page.evaluate(() => {
    const batches = [...document.querySelectorAll("ms-map-batch")];
    const hash = (canvas) => {
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let value = 0;
      for (let index = 0; index < data.length; index += 4) value = (Math.imul(31, value) + data[index] + data[index + 3]) | 0;
      return value;
    };
    return {
      paints: batches.map((batch) => batch.diagnostics().paintCommits),
      marker: document.querySelector("ms-synthetic-marker").diagnostics().paintCommits,
      hashes: batches.map((batch) => hash(batch.shadowRoot.querySelector("canvas"))),
    };
  });
  await page.evaluate(() => window.__ids = {
    back: document.querySelector('[stack-rank="10"]'),
    marker: document.querySelector("ms-synthetic-marker"),
  });
  await page.evaluate(() => window.__update([
    { op: "update", key: "scene:spike", attrs: { set: { "camera-x": "6", "camera-y": "6" } } },
  ]));
  await page.evaluate(() => window.__update([
    { op: "update", key: "actor-host:spike", attrs: { set: { "world-x": "0" } } },
  ]));
  const after = await page.evaluate(() => {
    const batches = [...document.querySelectorAll("ms-map-batch")];
    const plane = document.querySelector("ms-scene-view").shadowRoot.querySelector(".world-plane");
    const matrix = new DOMMatrix(getComputedStyle(plane).transform);
    const hash = (canvas) => {
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let value = 0;
      for (let index = 0; index < data.length; index += 4) value = (Math.imul(31, value) + data[index] + data[index + 3]) | 0;
      return value;
    };
    return {
      paints: batches.map((batch) => batch.diagnostics().paintCommits),
      marker: document.querySelector("ms-synthetic-marker").diagnostics().paintCommits,
      hashes: batches.map((batch) => hash(batch.shadowRoot.querySelector("canvas"))),
      matrix: { e: matrix.e, f: matrix.f },
      childMatrix: new DOMMatrix(getComputedStyle(batches[0]).transform).isIdentity,
      sameBack: window.__ids.back === document.querySelector('[stack-rank="10"]'),
      sameMarker: window.__ids.marker === document.querySelector("ms-synthetic-marker"),
      worldX: document.querySelector("ms-world-item").getAttribute("world-x"),
    };
  });
  assert.deepEqual(after.paints, before.paints);
  assert.equal(after.marker, before.marker);
  assert.deepEqual(after.hashes, before.hashes);
  assert.deepEqual(after.matrix, { e: -6, f: -6 });
  assert.equal(after.childMatrix, true);
  assert.equal(after.sameBack, true);
  assert.equal(after.sameMarker, true);
  assert.equal(after.worldX, "0");
  const png = decodePng(await page.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 }, type: "png" }));
  assert.deepEqual(sample(png, 4, 4), [0, 255, 0, 255]);
});

test("replace reorder and reparent keep unchanged HTMLElement identity", { timeout: 60_000 }, async (t) => {
  const page = await openReady(t);
  await page.evaluate(() => {
    window.__ids = {
      back: document.querySelector('[stack-rank="10"]'),
      item: document.querySelector("ms-world-item"),
      front: document.querySelector('[stack-rank="30"]'),
      marker: document.querySelector("ms-synthetic-marker"),
    };
  });
  const reordered = withVersions(createSpikeTree());
  const [back, item, front] = reordered.children;
  reordered.children = [front, item, back];
  await page.evaluate((tree) => window.__replace(tree), reordered);
  const order = await page.evaluate(() => ({
    light: [...document.querySelector("ms-scene-view").children].map((element) => element.getAttribute("stack-rank") ?? element.localName),
    same: {
      back: window.__ids.back === document.querySelector('[stack-rank="10"]'),
      item: window.__ids.item === document.querySelector("ms-world-item"),
      front: window.__ids.front === document.querySelector('[stack-rank="30"]'),
      marker: window.__ids.marker === document.querySelector("ms-synthetic-marker"),
    },
    paints: [...document.querySelectorAll("ms-map-batch")].map((batch) => batch.diagnostics().paintCommits),
  }));
  assert.deepEqual(order.light, ["30", "20", "10"]);
  assert.deepEqual(order.same, { back: true, item: true, front: true, marker: true });
  assert.deepEqual(order.paints, [1, 1]);

  const identity = withVersions(createIdentityTree());
  const identityPage = await openReady(t, identity);
  await identityPage.evaluate(() => {
    window.__hosts = {
      a: document.querySelector('[stack-rank="20"]'),
      b: document.querySelector('[stack-rank="21"]'),
      markerA: document.querySelector('[stack-rank="20"]').querySelector("ms-synthetic-marker"),
      markerB: document.querySelector('[stack-rank="21"]').querySelector("ms-synthetic-marker"),
      back: document.querySelector('[stack-rank="10"]'),
    };
  });
  const swapped = structuredClone(identity);
  const hostA = swapped.children[1];
  const hostB = swapped.children[2];
  const [markerA] = hostA.children;
  const [markerB] = hostB.children;
  hostA.children = [markerB];
  hostB.children = [markerA];
  await identityPage.evaluate((tree) => window.__replace(tree), swapped);
  const reparented = await identityPage.evaluate(() => ({
    markerAParent: window.__hosts.markerA.parentElement === window.__hosts.b,
    markerBParent: window.__hosts.markerB.parentElement === window.__hosts.a,
    sameHosts: window.__hosts.a === document.querySelector('[stack-rank="20"]')
      && window.__hosts.b === document.querySelector('[stack-rank="21"]')
      && window.__hosts.back === document.querySelector('[stack-rank="10"]'),
    sameMarkers: document.querySelector('[stack-rank="21"]').querySelector("ms-synthetic-marker") === window.__hosts.markerA
      && document.querySelector('[stack-rank="20"]').querySelector("ms-synthetic-marker") === window.__hosts.markerB,
  }));
  assert.equal(reparented.markerAParent, true);
  assert.equal(reparented.markerBParent, true);
  assert.equal(reparented.sameHosts, true);
  assert.equal(reparented.sameMarkers, true);
});

test("invalid data, missing resources, stale replies, and teardown stay local", { timeout: 60_000 }, async (t) => {
  const page = await openReady(t);
  const invalid = withVersions(createSpikeTree());
  invalid.children[0].data.placements[0].opacity = 999;
  await page.evaluate((tree) => window.__replace(tree), invalid);
  await waitFor(page, () => document.querySelector("ms-map-batch")?.diagnostics().state === "invalid", "invalid batch");
  const invalidState = await page.evaluate(() => {
    const [back, front] = document.querySelectorAll("ms-map-batch");
    return {
      back: back.diagnostics(),
      front: front.diagnostics().state,
      width: back.shadowRoot.querySelector("canvas").width,
      failures: window.__presentationFailures,
    };
  });
  assert.equal(invalidState.back.code, "INPUT_INVALID");
  assert.equal(invalidState.back.paintCommits, 1);
  assert.equal(invalidState.width, 0);
  assert.equal(invalidState.front, "ready");
  assert.deepEqual(invalidState.failures, []);

  const missingPage = await openReady(t);
  const missing = withVersions(createSpikeTree());
  missing.children[0].data.sprites.pages.p0.resource.key = "pixels/missing.png";
  await missingPage.evaluate((tree) => window.__replace(tree), missing);
  await waitFor(missingPage, () => document.querySelector("ms-map-batch")?.diagnostics().code === "RESOURCE_MISSING", "missing resource");
  assert.equal(await missingPage.evaluate(() => document.querySelector('[stack-rank="30"]').diagnostics().state), "ready");

  const slow = withVersions(createSpikeTree());
  slow.children[0].data.sprites.pages.p0.resource.key = "pixels/slow.png";
  slow.children[0].data.sprites.pages.p0.resource.contentVersion = versions["pixels/slow.png"];
  server.state.delays.set("spike/pixels/slow.png", 1_200);
  const prepared = await preparePresentation({
    origin: server.origin,
    index,
    configPath: path.join(componentRoot, "presentation.json"),
    scriptPath: SCRIPT_PATH,
  });
  const stalePage = await openSpikePage(t, { chromium, origin: server.origin, prepared });
  await stalePage.evaluate((tree) => window.__open(tree), slow);
  await waitFor(stalePage, () => window.__resourceCalls.some((call) => call.key === "pixels/slow.png"), "slow request started");
  const replacement = structuredClone(slow);
  replacement.children[0].data.sprites.pages.p0.resource.key = "pixels/replacement.png";
  replacement.children[0].data.sprites.pages.p0.resource.contentVersion = versions["pixels/replacement.png"];
  await stalePage.evaluate((tree) => window.__replace(tree), replacement);
  await waitFor(stalePage, () => {
    const back = document.querySelector('[stack-rank="10"]');
    const canvas = back?.shadowRoot.querySelector("canvas");
    if (!canvas || back.diagnostics().state !== "ready" || canvas.width === 0) return false;
    const pixel = canvas.getContext("2d").getImageData(0, 0, 1, 1).data;
    return pixel[2] === 255 && pixel[0] === 0;
  }, "replacement pixels");
  await new Promise((resolve) => setTimeout(resolve, 1_400));
  const stale = await stalePage.evaluate(() => {
    const back = document.querySelector('[stack-rank="10"]');
    const pixel = back.shadowRoot.querySelector("canvas").getContext("2d").getImageData(0, 0, 1, 1).data;
    return {
      pixel: [pixel[0], pixel[1], pixel[2], pixel[3]],
      paints: back.diagnostics().paintCommits,
      slowAborted: window.__resourceCalls.some((call) => call.key === "pixels/slow.png" && call.aborted),
      failures: window.__presentationFailures,
    };
  });
  assert.deepEqual(stale.pixel, [0, 0, 255, 255]);
  assert.equal(stale.paints, 1);
  assert.equal(stale.slowAborted, true);
  assert.deepEqual(stale.failures, []);

  const teardownPage = await openReady(t);
  await teardownPage.evaluate(() => window.__teardown());
  assert.equal(await teardownPage.evaluate(() => document.querySelector("ms-scene-view")), null);
  assert.deepEqual(teardownPage.__pageErrors, []);
});

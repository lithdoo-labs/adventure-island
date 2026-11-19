import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureAvatarContent } from "../../../scripts/pwa/read-adventure-fsdb.mjs";
import { projectAvatarFromPlan } from "../src/plan-projection.mjs";
import { launchChromium, preparePresentation, waitFor } from "../../cms-actor/test/harness.mjs";
import {
  BEARER,
  INSTALLATION_ID,
  SCRIPT_PATH as FIELD_SCRIPT_PATH,
  openFieldPage,
  startFieldServer,
} from "../../ms-field/test/harness.mjs";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(componentRoot, "..", "..");
const fieldScript = await readFile(path.join(repoRoot, "components", "ms-field", "browser", "ms-field.browser.js"));

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function loadAvatarResourceIndex(avatarNode) {
  const refs = [];
  for (const page of Object.values(avatarNode.data.sprites.pages)) refs.push(page.resource);
  const index = new Map();
  for (const ref of refs) {
    const roots = {
      "resource.Avatar": path.join(repoRoot, "content", "[FSDB]adventure", "[resource]Avatar"),
      "resource.Map": path.join(repoRoot, "content", "[FSDB]adventure", "[resource]Map"),
    };
    const fsdbRoot = roots[ref.namespace];
    if (!fsdbRoot) throw new Error(`unsupported namespace ${ref.namespace}`);
    const filePath = path.join(fsdbRoot, `${ref.key.split("/").join(path.sep)}.png`);
    const bytes = await readFile(filePath);
    index.set(`${ref.namespace}\0${ref.key}`, {
      bytes,
      mime: "image/png",
      contentVersion: ref.contentVersion,
    });
  }
  index.set(`resource.Presentation\0ms-field/ms-field.browser.js`, {
    bytes: fieldScript,
    mime: "text/javascript",
    contentVersion: sha256(fieldScript),
  });
  return index;
}

function sceneForAvatar(avatar) {
  return {
    key: "scene:test",
    tag: "ms-scene-view",
    attrs: { "camera-x": "0", "camera-y": "0", visible: "true" },
    data: { mapId: "test" },
    children: [{
      key: "player:test",
      tag: "ms-world-item",
      attrs: { "world-x": "48", "world-y": "48", "stack-rank": "1", visible: "true" },
      data: { actorVisualId: "player:test", anchor: "feet", provenance: { sortKey: 0, layer: 0, zM: 0, controllerFlag: false } },
      children: [avatar],
    }],
  };
}

let chromium;

before(async () => {
  chromium = await launchChromium();
});

after(async () => {
  await chromium?.close().catch(() => {});
});

test("ms-avatar paints stand1 under ms-world-item", { timeout: 120_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const avatar = projectAvatarFromPlan(plan, { locomotion: "stand", facing: "right" });
  const tree = sceneForAvatar(avatar);
  const index = await loadAvatarResourceIndex(avatar);
  const server = await startFieldServer({ index, scriptBytes: fieldScript });
  t.after(() => server.close());
  const prepared = await preparePresentation({
    origin: server.origin,
    index,
    configPath: path.join(repoRoot, "components", "ms-field", "presentation.json"),
    scriptPath: FIELD_SCRIPT_PATH,
  });
  const page = await openFieldPage(t, {
    chromium,
    origin: server.origin,
    prepared,
    installationId: INSTALLATION_ID,
    bearer: BEARER,
  });
  await page.evaluate((root) => window.__open(root), tree);
  await waitFor(page, () => {
    const avatarEl = document.querySelector("ms-avatar");
    return avatarEl?.getAttribute("data-render-state") === "ready"
      && avatarEl?.getAttribute("data-action") === "stand1";
  }, "ms-avatar ready");
  const sample = await page.evaluate(() => {
    const canvas = document.querySelector("ms-avatar")?.shadowRoot?.querySelector("canvas");
    if (!canvas || canvas.width === 0) return null;
    const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque += 1;
    return opaque;
  });
  assert.ok(sample > 0, "ms-avatar canvas should contain opaque pixels");
});

test("missing avatar Content fails closed without stale pixels or leaked decode work", { timeout: 120_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const avatar = projectAvatarFromPlan(plan, { locomotion: "stand", facing: "right" });
  const index = await loadAvatarResourceIndex(avatar);
  const stand = avatar.children.find((child) => child.attrs.name === "stand1");
  const firstLayer = stand.data.clip.frames[0].layers[0];
  const missing = avatar.data.sprites.pages[avatar.data.sprites.items[firstLayer.sprite].page].resource;
  index.delete(`${missing.namespace}\0${missing.key}`);
  const server = await startFieldServer({ index, scriptBytes: fieldScript });
  t.after(() => server.close());
  const prepared = await preparePresentation({
    origin: server.origin,
    index,
    configPath: path.join(repoRoot, "components", "ms-field", "presentation.json"),
    scriptPath: FIELD_SCRIPT_PATH,
  });
  const page = await openFieldPage(t, {
    chromium,
    origin: server.origin,
    prepared,
    installationId: INSTALLATION_ID,
    bearer: BEARER,
  });
  await page.evaluate((root) => window.__open(root), sceneForAvatar(avatar));
  await waitFor(page, () => document.querySelector("ms-avatar")?.diagnostics?.().state === "error",
    "missing avatar resource rejected");
  const evidence = await page.evaluate(() => {
    const avatarEl = document.querySelector("ms-avatar");
    const canvas = avatarEl.shadowRoot.querySelector("canvas");
    const pixels = canvas.width === 0 || canvas.height === 0
      ? new Uint8ClampedArray()
      : canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    return {
      opaque: [...pixels].filter((_, index) => index % 4 === 3 && pixels[index] > 0).length,
      diagnostics: avatarEl.diagnostics(),
    };
  });
  assert.equal(evidence.opaque, 0);
  assert.equal(evidence.diagnostics.paintPending, false);
  assert.equal(evidence.diagnostics.decode.active, 0);
  assert.equal(evidence.diagnostics.decode.queued, 0);
  assert.deepEqual(page.__pageErrors, []);
});

test("superseded avatar resource completion cannot overwrite the projected action", { timeout: 120_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const avatar = projectAvatarFromPlan(plan, { locomotion: "stand", facing: "right" });
  const tree = sceneForAvatar(avatar);
  const index = await loadAvatarResourceIndex(avatar);
  const stand = avatar.children.find((child) => child.attrs.name === "stand1");
  const firstLayer = stand.data.clip.frames[0].layers[0];
  const item = avatar.data.sprites.items[firstLayer.sprite];
  const delayed = avatar.data.sprites.pages[item.page].resource;
  const delays = new Map([[`${delayed.namespace}\0${delayed.key}`, 500]]);
  const server = await startFieldServer({ index, scriptBytes: fieldScript, resourceDelayMs: delays });
  t.after(() => server.close());
  const prepared = await preparePresentation({
    origin: server.origin,
    index,
    configPath: path.join(repoRoot, "components", "ms-field", "presentation.json"),
    scriptPath: FIELD_SCRIPT_PATH,
  });
  const page = await openFieldPage(t, {
    chromium,
    origin: server.origin,
    prepared,
    installationId: INSTALLATION_ID,
    bearer: BEARER,
  });
  await page.evaluate((root) => window.__open(root), tree);
  await waitFor(page, (key) => window.__resourceCalls?.some((call) => call.key === key), "delayed stand read started", 20_000, delayed.key);
  await page.evaluate(() => window.__update([{
    op: "update",
    key: "avatar:player",
    attrs: { set: { action: "jump", "frame-index": "0", "elapsed-ms": "0" } },
  }]));
  await waitFor(page, () => document.querySelector("ms-avatar")?.getAttribute("data-action") === "jump", "jump replacement ready");
  await new Promise((resolve) => setTimeout(resolve, 650));
  const evidence = await page.evaluate(() => ({
    action: document.querySelector("ms-avatar")?.getAttribute("data-action"),
    frame: document.querySelector("ms-avatar")?.getAttribute("data-frame"),
    errors: window.__presentationFailures,
  }));
  assert.equal(evidence.action, "jump");
  assert.equal(evidence.frame, "0");
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(page.__pageErrors, []);
});

test("avatar carrier teardown during a delayed read leaves no stale surface", { timeout: 120_000 }, async (t) => {
  const { plan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const avatar = projectAvatarFromPlan(plan, { locomotion: "stand", facing: "right" });
  const index = await loadAvatarResourceIndex(avatar);
  const stand = avatar.children.find((child) => child.attrs.name === "stand1");
  const firstLayer = stand.data.clip.frames[0].layers[0];
  const firstPage = avatar.data.sprites.pages[avatar.data.sprites.items[firstLayer.sprite].page].resource;
  const delays = new Map([[`${firstPage.namespace}\0${firstPage.key}`, 500]]);
  const server = await startFieldServer({ index, scriptBytes: fieldScript, resourceDelayMs: delays });
  t.after(() => server.close());
  const prepared = await preparePresentation({
    origin: server.origin,
    index,
    configPath: path.join(repoRoot, "components", "ms-field", "presentation.json"),
    scriptPath: FIELD_SCRIPT_PATH,
  });
  const page = await openFieldPage(t, {
    chromium,
    origin: server.origin,
    prepared,
    installationId: INSTALLATION_ID,
    bearer: BEARER,
  });
  await page.evaluate((root) => window.__open(root), sceneForAvatar(avatar));
  await waitFor(page, (key) => window.__resourceCalls?.some((call) => call.key === key), "avatar read started", 20_000, firstPage.key);
  await page.evaluate(() => window.__teardown());
  await waitFor(page, () => document.querySelector("ms-avatar") === null, "avatar carrier retired");
  await new Promise((resolve) => setTimeout(resolve, 650));
  assert.equal(await page.evaluate(() => document.querySelector("ms-avatar")), null);
  assert.deepEqual(page.__pageErrors, []);
});

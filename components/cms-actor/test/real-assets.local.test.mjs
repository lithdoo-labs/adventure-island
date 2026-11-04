/**
 * cms-actor × REAL CMS 079 assets, LoomRealm Chromium closed loop (local only).
 *
 * Consumes a REAL converted FSDB (produced locally by scripts/wz_fsdb from a
 * legally obtained CMS 079 client; never committed to this repository).
 * The suite skips with an explicit reason when no real FSDB is present —
 * synthetic-only checkouts (including CI) never fake this acceptance.
 *
 * Activate: convert the paper-doll subset to .work/cms-actor-real/fsdb (with a
 * locally, legally obtained CMS 079 client; the converted FSDB is never
 * committed) or point CMS_ACTOR_REAL_FSDB at a converted FSDB root containing
 * [struct]Look/{00002000,00012000,00020000,00030000,01302000}.json,
 * [struct]ZMap/order.json and [resource]图/.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import {
  actorView,
  launchChromium,
  openBootstrappedPage,
  preparePresentation,
  startContentServer,
  waitAction,
  waitFor,
  repoRoot,
} from "./harness.mjs";
import { buildRealAvatarPlan, readRealRecords } from "./real-look-adapter.mjs";
import { measureAvatarPlanDataBytes } from "../src/avatar-model.mjs";

const IMAGE_NAMESPACE = "resource.图";
const PRESENTATION_NAMESPACE = "resource.Presentation";
const INSTALLATION_ID = "cms-actor-real";
const BEARER = "Bearer cms-actor-real-token";
const IDENTITY = { sessionId: "session-real", subsystemKey: "avatar", generation: 1, domainId: "field", targetKey: "player-real" };

const realRoot = process.env.CMS_ACTOR_REAL_FSDB
  ? path.resolve(process.env.CMS_ACTOR_REAL_FSDB)
  : path.join(repoRoot, ".work", "cms-actor-real", "fsdb");
const available = existsSync(path.join(realRoot, "[struct]Look", "00002000.json"));
const skipReason = available ? false : `real converted FSDB not found at ${realRoot}; run the local conversion from a legally obtained client first (see components/cms-actor/IMPLEMENTATION.md §7) — this acceptance is never faked on synthetic-only checkouts`;

const readJson = async (root, table, key) => JSON.parse(await readFile(path.join(root, `[struct]${table}`, `${key}.json`), "utf8"));

async function walkResources(root, relative = "") {
  const entries = [];
  for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = relative ? `${relative}/${item.name}` : item.name;
    if (item.isDirectory()) entries.push(...await walkResources(root, child));
    else entries.push(child);
  }
  return entries;
}

async function buildIndex() {
  const index = new Map();
  const version = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const prefix = "[resource]图/";
  for (const relative of await walkResources(realRoot)) {
    if (!relative.startsWith(prefix)) continue;
    const bytes = await readFile(path.join(realRoot, relative));
    const key = relative.slice(prefix.length).replace(/\.[^.]+$/, "");
    index.set(`${IMAGE_NAMESPACE}\0${key}`, { bytes, mime: "image/png", contentVersion: version(bytes) });
  }
  const scriptBytes = await readFile(path.join(repoRoot, "components", "cms-actor", "browser", "cms-actor.browser.js"));
  index.set(`${PRESENTATION_NAMESPACE}\0cms-actor/cms-actor.browser.js`, {
    bytes: scriptBytes,
    mime: "text/javascript; charset=utf-8",
    contentVersion: version(scriptBytes),
  });
  return index;
}

let chromium;
let fixture;
let plan;
let index;

before(async () => {
  if (skipReason) return;
  chromium = await launchChromium();
  index = await buildIndex();
  const { looks, zmapOrder } = await readRealRecords(realRoot, (root, table, key) => readJson(root, table, key));
  plan = buildRealAvatarPlan(looks, zmapOrder, index);
});

after(async () => {
  if (skipReason) return;
  await chromium?.close().catch(() => {});
  if (fixture) await fixture.close();
});

const captureFrame = (page, expected, label, timeout = 6_000) =>
  waitFor(page, (frame) => {
    const actor = window.__actor();
    if (actor.getAttribute("data-frame") !== String(frame)) return false;
    const snapshot = window.__snapshot();
    return snapshot ? { hash: snapshot.hash } : false;
  }, label, timeout, expected);

test("converted real records match the independently reverse-engineered 079 geometry", { skip: skipReason }, async () => {
  const { looks, zmapOrder } = await readRealRecords(realRoot, (root, table, key) => readJson(root, table, key));

  const walk10 = looks.body.walk1["0"];
  assert.equal(walk10.delay, 180);
  assert.equal(walk10.face, 1);
  assert.deepEqual(
    { width: walk10.body.width, height: walk10.body.height, origin: walk10.body.origin, z: walk10.body.z },
    { width: 27, height: 32, origin: [19, 32], z: "body" },
    "body walk1/0 must match Task 050 / DESIGN.md geometry",
  );
  assert.deepEqual(walk10.body.map.neck, [-4, -32]);
  assert.deepEqual(walk10.body.map.navel, [-6, -20]);
  assert.deepEqual({ width: walk10.arm.width, height: walk10.arm.height }, { width: 12, height: 17 });

  assert.deepEqual(Object.keys(looks.body.stand1), ["0", "1", "2"]);
  assert.equal(looks.body.stand1["0"].delay, 500);
  assert.deepEqual(Object.keys(looks.body.walk1), ["0", "1", "2", "3"]);
  assert.deepEqual(Object.keys(looks.body.jump), ["0"]);
  assert.equal(looks.body.jump["0"].delay, 200);

  const brandish = looks.body.brandish1;
  assert.equal(Object.keys(brandish).length, 7);
  assert.equal(Object.values(brandish).reduce((sum, frame) => sum + Math.abs(frame.delay), 0), 840, "brandish1 must total the documented 840ms");
  assert.deepEqual(
    Object.values(brandish).map((frame) => [frame.action, frame.frame]),
    [["swingOF", 0], ["swingOF", 1], ["swingOF", 2], ["swingOF", 3], ["stabOF", 0], ["stabOF", 1], ["stabOF", 2]],
  );

  const headCanvas = looks.head.walk1["0"].head;
  assert.equal(headCanvas.z, "head");
  assert.ok(headCanvas.map.neck && headCanvas.map.brow, "head canvas must carry neck and brow anchors");
  assert.equal(headCanvas.resource, "Look/00012000/front/head", "head walk1 UOL must resolve to front/head");

  assert.equal(looks.weapon.info.walk, 1);
  assert.equal(looks.weapon.info.stand, 1);
  assert.ok(looks.weapon.walk1["0"].weapon.map.hand, "weapon canvas must carry the hand anchor");
  assert.ok(zmapOrder.length > 100, "real zmap order must be the full table");
});

test("real avatarPlan is bounded and renderable", { skip: skipReason }, () => {
  const bytes = measureAvatarPlanDataBytes(plan);
  assert.ok(bytes > 0 && bytes <= 262_144, `real plan must fit the frozen byte cap (got ${bytes})`);
  assert.deepEqual(Object.keys(plan.actions), ["stand1", "walk1", "jump", "brandish1"]);
  assert.deepEqual(plan.locomotionActions, { stand: "stand1", walk: "walk1", jump: "jump" });
  const distinct = new Set();
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) for (const layer of frame.layers) distinct.add(layer.resource.key);
  }
  assert.ok(distinct.size >= 40, `real plan should reference dozens of distinct real canvases (got ${distinct.size})`);
});

test("real 079 paper doll renders through the formal LoomRealm Chromium loop", { skip: skipReason, timeout: 120_000 }, async (t) => {
  fixture = await startContentServer({
    index,
    scriptBytes: index.get(`${PRESENTATION_NAMESPACE}\0cms-actor/cms-actor.browser.js`).bytes,
    scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
    installationId: INSTALLATION_ID,
    bearer: BEARER,
  });
  const prepared = await preparePresentation({
    origin: fixture.origin,
    index,
    configPath: path.join(repoRoot, "components", "cms-actor", "presentation.json"),
    scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
  });
  const page = await openBootstrappedPage(t, { chromium, origin: fixture.origin, prepared, installationId: INSTALLATION_ID, bearer: BEARER });
  const apply = (options) => page.evaluate((view) => window.__applyView(view), actorView(IDENTITY, { ...options, plan }));

  assert.equal(await page.evaluate(() => typeof customElements.get("cms-actor")), "function", "classic entry registered");
  await apply({ attrs: { locomotion: "stand" } });
  if (process.env.CMS_ACTOR_REAL_DEBUG) {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    console.log("DEBUG element:", await page.evaluate(() => ({
      state: window.__actor()?.getAttribute("data-render-state"),
      error: window.__actor()?.getAttribute("data-render-error"),
      action: window.__actor()?.getAttribute("data-action"),
      skipped: window.__actor()?.getAttribute("data-skipped-layers"),
      failures: window.__presentationFailures,
      calls: window.__resourceCalls.slice(0, 12),
    })));
  }
  await waitAction(page, "stand1", "real stand1 active");
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "real composite ready");
  await waitFor(page, () => window.__canvas()?.width > 1, "real composite painted");
  assert.deepEqual(await page.evaluate(() => window.__presentationFailures), [], "no presentation failures");

  // Every read carries an exact real-plan identity + expected version.
  const planIdentities = new Set();
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) planIdentities.add(`${layer.resource.namespace}\0${layer.resource.key}\0${layer.resource.contentVersion}`);
    }
  }
  const calls = await page.evaluate(() => window.__resourceCalls.map(({ namespace, key, expectedContentVersion }) => `${namespace}\0${key}\0${expectedContentVersion}`));
  assert.ok(calls.length > 0, "real resources must be fetched");
  for (const identity of calls) assert.ok(planIdentities.has(identity), `unexpected resource read ${identity.replace(/\0/g, " | ")}`);

  // Real art has opaque pixels both in the body band and above the neck.
  const opaque = await page.evaluate(() => ({
    bodyBand: window.__opaqueCount(-20, -30, 40, 28),
    aboveNeck: window.__opaqueCount(-20, -62, 40, 28),
  }));
  assert.ok(opaque.bodyBand > 40, `body band must have opaque pixels (got ${opaque.bodyBand})`);
  assert.ok(opaque.aboveNeck > 40, `head/hair band must have opaque pixels (got ${opaque.aboveNeck})`);

  // walk1: four real frames cycle with visibly different art.
  await apply({ attrs: { locomotion: "walk" } });
  const hashes = new Map();
  for (const expected of [0, 1, 2, 3, 1]) {
    const snapshot = await captureFrame(page, expected, `walk1 frame ${expected}`);
    if (!hashes.has(expected)) hashes.set(expected, snapshot.hash);
  }
  assert.equal(hashes.size, 4, "each walk1 frame must have been sampled");
  assert.ok(new Set(hashes.values()).size >= 3, `real walk frames must differ in pixels (${new Set(hashes.values()).size} distinct of 4)`);

  // jump: single real frame, held.
  await apply({ attrs: { locomotion: "jump" } });
  await waitAction(page, "jump", "jump active");
  const jump = await captureFrame(page, 0, "jump frame 0");
  await new Promise((resolve) => setTimeout(resolve, 650));
  const held = await page.evaluate(() => ({ frame: window.__actor().getAttribute("data-frame"), hash: window.__snapshot()?.hash }));
  assert.equal(held.frame, "0");
  assert.equal(held.hash, jump.hash, "jump must hold its frame");

  // brandish1: the real 7-frame, 840ms one-shot plays once and returns.
  await apply({ attrs: { locomotion: "walk" } });
  await waitAction(page, "walk1", "back to walk");
  await page.evaluate((event) => window.__emitEvent(event), { ...IDENTITY, name: "action", data: { action: "brandish1" } });
  await waitAction(page, "brandish1", "real brandish1 active");
  const duringBrandish = await captureFrame(page, 0, "brandish frame 0", 6_000);
  assert.ok(!hashes.has(undefined) && ![...hashes.values()].includes(duringBrandish.hash), "brandish art must differ from walk");
  await waitAction(page, "walk1", "brandish1 finished and returned to locomotion", 10_000);

  // Facing left mirrors the real composite around the body origin x.
  // jump holds a still frame, so the comparison is not disturbed by the clock.
  await apply({ attrs: { locomotion: "jump" } });
  await waitAction(page, "jump", "jump active for mirror capture");
  await captureFrame(page, 0, "jump frame 0 again");
  await waitFor(page, () => window.__actor().diagnostics().paintPending === false, "paint settled before mirror capture");
  const mirrored = await page.evaluate(async () => {
    const capture = async (facing) => {
      window.__actor().setAttribute("facing", facing);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const canvas = window.__canvas();
      const left = Number.parseFloat(canvas.style.left) || 0;
      const top = Number.parseFloat(canvas.style.top) || 0;
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      return { left, top, width: canvas.width, height: canvas.height, data };
    };
    const right = await capture("right");
    const leftView = await capture("left");
    const at = (snap, x, y) => {
      const px = Math.round(x - snap.left);
      const py = Math.round(y - snap.top);
      if (px < 0 || py < 0 || px >= snap.width || py >= snap.height) return null;
      const offset = (py * snap.width + px) * 4;
      return [snap.data[offset], snap.data[offset + 1], snap.data[offset + 2], snap.data[offset + 3]];
    };
    let compared = 0;
    let mismatches = 0;
    let opaqueCompared = 0;
    const points = [];
    for (let x = -60; x <= 60; x += 2) {
      for (let y = -70; y <= 5; y += 2) {
        const r = at(right, x, y);
        const l = at(leftView, -x, y);
        if (r === null || l === null) continue;
        compared += 1;
        // Semi-transparent stacked layers can differ by 1/255 per channel in
        // Chromium's flipped-blit premultiply round-trip; alpha must match
        // exactly and RGB within ±1.
        const same = r[3] === l[3] && (r[3] === 0 || (Math.abs(r[0] - l[0]) <= 1 && Math.abs(r[1] - l[1]) <= 1 && Math.abs(r[2] - l[2]) <= 1));
        if (!same) {
          mismatches += 1;
          if (points.length < 10) points.push({ x, y, R: r, L: l });
        }
        if (r[3] > 0) opaqueCompared += 1;
      }
    }
    return { compared, mismatches, opaqueCompared, points };
  });
  assert.ok(mirrored.compared > 500, `mirror comparison must cover the composite (got ${mirrored.compared})`);
  assert.ok(mirrored.opaqueCompared > 100, `mirror comparison must include opaque art pixels (got ${mirrored.opaqueCompared})`);
  assert.equal(mirrored.mismatches, 0, `facing left must mirror facing right around the body origin (${mirrored.mismatches} mismatches over ${mirrored.compared} points): ${JSON.stringify((mirrored.points ?? []).slice(0, 10))}`);
});

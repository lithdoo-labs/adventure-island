/**
 * cms-actor × REAL CMS 079 assets, LoomRealm Chromium closed loop (local only).
 *
 * Consumes a REAL converted FSDB (produced locally by scripts/wz_fsdb from a
 * legally obtained CMS 079 client; never committed to this repository) and
 * drives the FULL production stack:
 *
 *   converted [FSDB]cms → prepareHostraGame (PREPARE)
 *     → prepareDesktopContentView (trusted Content Index, contentVersion)
 *     → createDesktopContentService (Content HTTP v1, real bearer grant)
 *     → createBoundContentClient (record / resource)
 *     → production adapter systems/adventure-island/cms079-avatar-plan.mjs
 *     → bounded AvatarPlanV1 with exact contentVersions
 *     → bootstrapWebPresentation / WebProjector / PresentationResourceClient
 *     → real Chromium pixel / animation assertions.
 *
 * The suite skips with an explicit reason when no real FSDB is present —
 * synthetic-only checkouts (including CI) never fake this acceptance.
 *
 * Activate: run scripts/wz_fsdb/convert_cms.py --scope avatar (with a locally,
 * legally obtained CMS 079 client) or point CMS_ACTOR_REAL_FSDB at a converted
 * FSDB root containing [struct]Look/{00002000,00012000,00020000,00030000,
 * 01302000}.json, [struct]ZMap/order.json and [resource]图/.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
import { startRealContentService } from "./real-content-service.mjs";
import {
  buildCms079AvatarPlan,
  collectAvatarResourceKeys,
  CMS079_LOOK_KEYS,
  readCms079LookRecords,
} from "../../../systems/adventure-island/cms079-avatar-plan.mjs";
import { measureAvatarPlanDataBytes } from "../src/avatar-model.mjs";

const PRESENTATION_NAMESPACE = "resource.Presentation";
const INSTALLATION_ID = "cms-actor-real";
const BEARER = "Bearer cms-actor-real-token";
const IDENTITY = { sessionId: "session-real", subsystemKey: "avatar", generation: 1, domainId: "field", targetKey: "player-real" };

const realRoot = process.env.CMS_ACTOR_REAL_FSDB
  ? path.resolve(process.env.CMS_ACTOR_REAL_FSDB)
  : path.join(repoRoot, ".work", "cms-actor-real", "fsdb");
const available = existsSync(path.join(realRoot, "[struct]Look", "00002000.json"));
const skipReason = available ? false : `real converted FSDB not found at ${realRoot}; run the local avatar conversion from a legally obtained client first (see components/cms-actor/IMPLEMENTATION.md §7) — this acceptance is never faked on synthetic-only checkouts`;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

let chromium;
let contentService;
let workDir;
let plan;
let looks;
let zmapOrder;

before(async () => {
  if (skipReason) return;
  chromium = await launchChromium();
  workDir = await mkdtemp(path.join(tmpdir(), "cms-actor-real-"));
  contentService = await startRealContentService({
    fsdbRoot: realRoot,
    installRoot: path.join(workDir, "installation"),
  });
  const { looks: realLooks, zmapOrder: order } = await readCms079LookRecords(contentService.content);
  looks = realLooks;
  zmapOrder = order;
  plan = await buildCms079AvatarPlan(contentService.content);
});

after(async () => {
  if (skipReason) return;
  await chromium?.close().catch(() => {});
  await contentService?.close().catch(() => {});
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

const captureFrame = (page, expected, label, timeout = 6_000) =>
  waitFor(page, (frame) => {
    const actor = window.__actor();
    if (actor.getAttribute("data-frame") !== String(frame)) return false;
    const snapshot = window.__snapshot();
    return snapshot ? { hash: snapshot.hash } : false;
  }, label, timeout, expected);

test("ContentClient reads the five real Look records and ZMap with exact contentVersions", { skip: skipReason }, async () => {
  const seenVersions = {};
  for (const [part, key] of Object.entries(CMS079_LOOK_KEYS)) {
    const record = await contentService.content.record("struct.Look", key);
    assert.equal(record.value && typeof record.value, "object", `struct.Look/${key} must be an object`);
    const raw = await fetch(new URL(
      `/_lr/v1/games/${contentService.access.installationId}/records/${encodeURIComponent("struct.Look")}/${encodeURIComponent(key)}`,
      contentService.access.origin,
    ), { headers: { Authorization: `Bearer ${contentService.access.token}` } });
    assert.equal(raw.status, 200);
    assert.equal(raw.headers.get("x-loom-content-version"), record.contentVersion);
    assert.equal(record.contentVersion, sha256(Buffer.from(await raw.arrayBuffer())));
    seenVersions[part] = record.contentVersion;
  }
  assert.equal(Object.keys(seenVersions).length, 5);
  const zmap = await contentService.content.record("struct.ZMap", "order");
  assert.match(zmap.contentVersion, /^sha256:[0-9a-f]{64}$/);
  assert.ok(Object.keys(zmap.value).length > 100, "real zmap order must be the full table");
});

test("converted real records match the independently reverse-engineered 079 geometry", { skip: skipReason }, async () => {
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

test("every avatar-plan PNG reads through the real Content Service with matching version and MIME", { skip: skipReason }, async () => {
  const wanted = collectAvatarResourceKeys(looks);
  const planKeys = new Set();
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) planKeys.add(layer.resource.key);
    }
  }
  assert.equal(planKeys.size, wanted.size, "plan references exactly the wanted canvases");
  for (const key of wanted) {
    const resource = await contentService.content.resource("resource.图", key);
    assert.equal(resource.mime, "image/png", `${key} must be served as image/png`);
    assert.equal(resource.contentVersion, sha256(Buffer.from(resource.bytes)), `${key} contentVersion must be its body SHA-256`);
    assert.ok(JSON.stringify(plan).includes(key), `${key} must appear in the plan`);
  }
  // Fail-closed: a missing canvas is CONTENT_NOT_FOUND, never a silent stand-in.
  await assert.rejects(
    () => contentService.content.resource("resource.图", "Look/00002000/nonexistent/9/ghost"),
    (error) => error.code === "CONTENT_NOT_FOUND",
  );
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
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) {
      assert.ok(frame.layers[0].id === "body", "body must be the first layer of every frame");
    }
  }
});

test("real 079 paper doll renders through the formal LoomRealm Chromium loop", { skip: skipReason, timeout: 180_000 }, async (t) => {
  const scriptBytes = await readFile(path.join(repoRoot, "components", "cms-actor", "browser", "cms-actor.browser.js"));
  const index = new Map();
  const version = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  index.set(`${PRESENTATION_NAMESPACE}\0cms-actor/cms-actor.browser.js`, {
    bytes: scriptBytes,
    mime: "text/javascript; charset=utf-8",
    contentVersion: version(scriptBytes),
  });
  const fixture = await startContentServer({
    index,
    scriptBytes,
    scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
    installationId: INSTALLATION_ID,
    bearer: BEARER,
    // Every image read is forwarded to the REAL Content Service over the
    // converted FSDB; only the presentation script stays local.
    contentProxy: {
      origin: contentService.service.origin,
      bearer: `Bearer ${contentService.access.token}`,
      installationId: contentService.access.installationId,
      exceptNamespaces: [PRESENTATION_NAMESPACE],
    },
  });
  t.after(() => fixture.close());
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

  // Every read carries an exact real-plan identity + expected version, and
  // was answered by the real Content Service behind the proxy.
  const planIdentities = new Set();
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) planIdentities.add(`${layer.resource.namespace}\0${layer.resource.key}\0${layer.resource.contentVersion}`);
    }
  }
  const calls = await page.evaluate(() => window.__resourceCalls.map(({ namespace, key, expectedContentVersion }) => `${namespace}\0${key}\0${expectedContentVersion}`));
  assert.ok(calls.length > 0, "real resources must be fetched");
  for (const identity of calls) assert.ok(planIdentities.has(identity), `unexpected resource read ${identity.replace(/\0/g, " | ")}`);
  const proxied = await page.evaluate(async ({ installationId }) => {
    const key = "Look/00002000/walk1/0/body".split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`/_lr/v1/games/${installationId}/resources/${encodeURIComponent("resource.图")}/${key}`, {
      headers: { Authorization: "Bearer cms-actor-real-token" },
    });
    return { status: response.status, version: response.headers.get("x-loom-content-version") };
  }, { installationId: INSTALLATION_ID });
  assert.equal(proxied.status, 200, "the harness origin proxies to the real Content Service");
  assert.ok(planIdentities.has(`resource.图\0Look/00002000/walk1/0/body\0${proxied.version}`), "proxied body canvas carries the exact plan version");

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
  assert.deepEqual(page.__pageErrors, [], "no unhandled page errors");
});

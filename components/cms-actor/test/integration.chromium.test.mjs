/**
 * cms-actor × LoomRealm real-Chromium closed loop.
 *
 * Proves, with the FROZEN platform path (no test shortcuts):
 *  - `bootstrapWebPresentation()` loads the classic <script> entry declared
 *    by presentation.json (Web Presentation Config v1);
 *  - `customElements.get("cms-actor")` is defined before first projection;
 *  - WebProjector injects the Context, projects attrs and delivers the
 *    retained avatarPlan through `receiveRenderData`;
 *  - `PresentationResourceClient.resource()` receives the exact Content
 *    logical identity + expectedContentVersion for every painted canvas;
 *  - Canvas pixels: body/head/face/hair anchor alignment, front/back
 *    z-order (incl. alpha), left/right mirroring around the body origin —
 *    pixel-exact at deviceScaleFactor 1 AND 2, including a frame `move`
 *    mirror pivot;
 *  - stand1 / walk1 / jump frame advancement per WZ delay;
 *  - one-shot `action` events play once and return to the CURRENT
 *    locomotion; rapid re-trigger restarts from frame 0;
 *  - slow resource responses never let a stale paint overwrite a newer
 *    action; version conflicts and missing resources produce locatable
 *    error diagnostics with no partial frame; disconnect cancels in-flight
 *    reads and releases the bitmap cache; reconnect renders again;
 *  - the decoded-bitmap cache keeps its strict capacity guarantee: oversized
 *    canvases and over-budget frames are rejected at plan validation, the
 *    cacheable tier never exceeds 64 entries / 12 MiB (polled during a
 *    32-resource concurrent burst), and cross-plan dimension conflicts for
 *    a cached identity are rejected locatably without unhandled rejections.
 *
 * All imagery is generated at test time (synthetic FSDB + synthetic PNG);
 * nothing here validates real CMS 079 WZ assets.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import {
  launchChromium,
  openBootstrappedPage as openBootstrappedHarnessPage,
  preparePresentation as prepareHarnessPresentation,
  startContentServer,
  waitAction,
  waitFrame,
  waitPixel,
  waitFor,
} from "./harness.mjs";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(componentRoot, "..", "..");

const INSTALLATION_ID = "cms-actor-test";
const BEARER = "Bearer cms-actor-test-token";
const SESSION_ID = "session-cms-actor";
const SUBSYSTEM_KEY = "avatar";
const GENERATION = 1;
const DOMAIN_ID = "field";
const TARGET_KEY = "player-1";

const { generateSyntheticFsdb, COLORS, FRAME_MARKERS } = await import("./synthetic-fsdb.mjs");
const { buildAvatarPlan, withResourceVersion } = await import("./look-adapter.mjs");
const { validateAvatarPlan, measureAvatarPlanDataBytes } = await import("../src/avatar-model.mjs");

// ---------------------------------------------------------------------------
// Shared fixture state
// ---------------------------------------------------------------------------
const scriptBytes = await readFile(path.join(componentRoot, "browser", "cms-actor.browser.js"));
const fsdb = generateSyntheticFsdb(path.join(repoRoot, ".work", "cms-actor"), { scriptBytes });
const zOrder = fsdb.readStruct("ZMap", "order").order;
const avatarPlan = validateAvatarPlan(buildAvatarPlan(fsdb.looks, zOrder, fsdb.index));

let fixture;
let chromium;

function actorView({ attrs = {}, plan = avatarPlan, withActor = true } = {}) {
  return {
    sessionId: SESSION_ID,
    subsystems: [{
      subsystemKey: SUBSYSTEM_KEY,
      generation: GENERATION,
      eligible: true,
      domains: [{
        domainId: DOMAIN_ID,
        zIndex: 0,
        roots: withActor ? [{
          key: TARGET_KEY,
          tag: "cms-actor",
          attrs: {
            x: "0",
            y: "0",
            locomotion: "stand",
            facing: "right",
            skin: "0",
            face: "00020000",
            hair: "00030000",
            expression: "default",
            equips: "",
            ...attrs,
          },
          data: { avatarPlan: plan },
          children: [],
        }] : [],
      }],
    }],
  };
}

const RENDER_EVENT = {
  sessionId: SESSION_ID,
  subsystemKey: SUBSYSTEM_KEY,
  generation: GENERATION,
  domainId: DOMAIN_ID,
  targetKey: TARGET_KEY,
};

async function preparePresentation() {
  return prepareHarnessPresentation({
    origin: fixture.origin,
    index: fsdb.index,
    configPath: path.join(componentRoot, "presentation.json"),
    scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
  });
}

async function openBootstrappedPage(t, { deviceScaleFactor = 1 } = {}) {
  const prepared = await preparePresentation();
  return openBootstrappedHarnessPage(t, {
    chromium,
    origin: fixture.origin,
    prepared,
    installationId: INSTALLATION_ID,
    bearer: BEARER,
    deviceScaleFactor,
  });
}

// Scene-space sample points (see synthetic-fsdb.mjs geometry):
//   body spans x[-19,8) y[-32,0); head x[-12,12) y[-34,-10); face x[-6,6)
//   y[-29,-19); hair x[-12,12) y[-32,-14) with a transparent hole over the
//   face; weapon x[1,17) y[-19,9). Body-local (13,31) = (-6,-1) is the
//   per-frame marker row at the bottom of the body canvas.
const POINTS = {
  headOverBody: [-8, -12],
  bodyOnly: [0, -6],
  hairOverHead: [-10, -20],
  faceThroughHairHole: [0, -24],
  weaponRight: [4, -10],
  weaponLeft: [-4, -10],
  marker: [-6, -1],
};

before(async () => {
  fixture = await startContentServer({
    index: fsdb.index,
    scriptBytes,
    scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
    installationId: INSTALLATION_ID,
    bearer: BEARER,
  });
  chromium = await launchChromium();
});

after(async () => {
  await chromium?.close().catch(() => {});
  if (fixture) await fixture.close();
});

const serverState = () => fixture.state;

// ---------------------------------------------------------------------------

test("formal bootstrap registers the classic entry and projects context, attrs and avatarPlan", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  assert.equal(await page.evaluate(() => typeof customElements.get("cms-actor")), "function", "classic script must register cms-actor");

  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitAction(page, "stand1", "element renders stand1");
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "element ready");
  await waitFor(page, () => window.__actor()?.shadowRoot?.querySelector("canvas")?.width > 1, "canvas painted");

  const projected = await page.evaluate(() => {
    const actor = window.__actor();
    return {
      attrs: Object.fromEntries(["x", "y", "locomotion", "facing", "skin", "face", "hair", "expression", "equips"].map((name) => [name, actor.getAttribute(name)])),
      diagnostics: actor.diagnostics(),
      inDocument: document.body.contains(actor),
    };
  });
  assert.deepEqual(projected.attrs, {
    x: "0", y: "0", locomotion: "stand", facing: "right",
    skin: "0", face: "00020000", hair: "00030000", expression: "default", equips: "",
  });
  assert.equal(projected.inDocument, true);
  assert.equal(projected.diagnostics.contextInjected, true, "Projector must inject the WebPresentationContext");
  assert.deepEqual(await page.evaluate(() => window.__presentationFailures), [], "no presentation failures during bootstrap + projection");

  // Every resource read must carry an exact plan identity and version.
  const calls = await page.evaluate(() => window.__resourceCalls.map(({ namespace, key, expectedContentVersion }) => `${namespace}\0${key}\0${expectedContentVersion}`));
  const planIdentities = new Set();
  for (const action of Object.values(avatarPlan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) {
        planIdentities.add(`${layer.resource.namespace}\0${layer.resource.key}\0${layer.resource.contentVersion}`);
      }
    }
  }
  for (const identity of calls) assert.ok(planIdentities.has(identity), `resource call ${identity.replace(/\0/g, " | ")} must belong to the plan`);
  for (const layer of avatarPlan.actions.stand1.frames[0].layers) {
    const identity = `${layer.resource.namespace}\0${layer.resource.key}\0${layer.resource.contentVersion}`;
    assert.ok(calls.includes(identity), `first frame must fetch ${layer.id} (${layer.resource.key}) through the formal Content identity`);
  }
});

test("anchors align body, head, face and hair; z-order and alpha compose; mirroring flips around the body origin", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { x: "40", y: "60" } }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "element ready");

  await waitPixel(page, POINTS.headOverBody, COLORS.head, "head aligned over body via the neck anchor");
  await waitPixel(page, POINTS.bodyOnly, COLORS.body, "body fill visible below the head");
  await waitPixel(page, POINTS.hairOverHead, COLORS.hair, "hair paints in front of the head");
  await waitPixel(page, POINTS.faceThroughHairHole, COLORS.face, "face visible through the hair's transparent window");
  await waitPixel(page, POINTS.weaponRight, COLORS.weapon, "weapon aligned to the hand anchor, in front of the body");

  // Facing left mirrors the whole composite around the body origin x.
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { x: "40", y: "60", facing: "left" } }));
  await waitPixel(page, POINTS.weaponLeft, COLORS.weapon, "weapon mirrored to the left side");
  await waitPixel(page, [4, -11], COLORS.head, "right side now shows the head, not the weapon");
  await waitPixel(page, [0, -12], COLORS.head, "anchored parts stay aligned after mirroring");
});

test("stand1 and walk1 advance by WZ delay and loop; jump holds its single frame", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);

  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "walk" } }));
  for (const expected of [0, 1, 2, 3, 0]) {
    await waitFrame(page, expected, `walk1 frame ${expected}`);
    await waitPixel(page, POINTS.marker, FRAME_MARKERS.walk1[expected], `walk1 frame ${expected} marker`);
  }

  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "stand" } }));
  await waitAction(page, "stand1", "stand1 active");
  for (const expected of [1, 0]) await waitFrame(page, expected, `stand1 frame ${expected}`);

  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "jump" } }));
  await waitAction(page, "jump", "jump active");
  await waitPixel(page, POINTS.marker, FRAME_MARKERS.jump[0], "jump frame painted");
  await new Promise((resolve) => setTimeout(resolve, 700));
  const held = await page.evaluate(({ x, y }) => ({
    frame: window.__actor().getAttribute("data-frame"),
    marker: window.__sample(x, y),
  }), { x: POINTS.marker[0], y: POINTS.marker[1] });
  assert.equal(held.frame, "0", "jump holds its only frame");
  assert.deepEqual(held.marker, FRAME_MARKERS.jump[0].slice(0, 3));
});

test("one-shot action events play once and return to the CURRENT locomotion; rapid re-trigger restarts at frame 0", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "walk" } }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "walk ready");

  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitAction(page, "brandish1", "one-shot action active");
  for (const [index, marker] of FRAME_MARKERS.brandish1.entries()) {
    await waitPixel(page, POINTS.marker, marker, `brandish1 frame ${index} marker`);
  }
  await waitAction(page, "walk1", "returns to the locomotion current when the one-shot finished");
  await waitFor(page, (colors) => colors.some((color) => {
    const actual = window.__sample(-6, -1);
    return actual !== null && color.every((channel, index) => channel === actual[index]);
  }), "no freeze on the last one-shot frame", 4_000, FRAME_MARKERS.walk1.map((color) => color.slice(0, 3)));

  // Locomotion changing MID-play must win when the one-shot finishes.
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitAction(page, "brandish1", "second one-shot starts");
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "stand" } }));
  await waitAction(page, "stand1", "post-one-shot state is the latest locomotion, not the old one", 5_000);

  // Rapid re-trigger: a second event during playback restarts from frame 0.
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitPixel(page, POINTS.marker, FRAME_MARKERS.brandish1[0], "first frame visible");
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitFor(page, () => window.__actor().diagnostics().oneShotAction === "brandish1", "re-trigger accepted");
  await waitFor(page, ({ x, y, expected }) => {
    const actor = window.__actor();
    const actual = window.__sample(x, y);
    return actor.diagnostics().frameIndex === 0 && actual !== null && expected.every((channel, index) => channel === actual[index]);
  }, "re-trigger restarts at frame 0", 5_000, { x: POINTS.marker[0], y: POINTS.marker[1], expected: FRAME_MARKERS.brandish1[0].slice(0, 3) });
  await waitAction(page, "stand1", "re-triggered one-shot still completes", 6_000);
});

test("a slow resource response never lets the stale paint overwrite the newer action", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  const standFrame1Body = avatarPlan.actions.stand1.frames[1].layers[0].resource;
  serverState().delays.set(`${standFrame1Body.namespace}/${standFrame1Body.key}`, 1_200);

  try {
    await page.evaluate((view) => window.__applyView(view), actorView());
    await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "stand frame 0 ready");
    // Let the stand clock advance into frame 1, whose body PNG is delayed.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "walk" } }));
    await waitAction(page, "walk1", "walk active while stand frame 1 is still in flight");
    await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "walk painted");

    // Wait well past the delayed response; the stale stand frame 1 must be discarded.
    await new Promise((resolve) => setTimeout(resolve, 1_600));
    const observed = await page.evaluate(({ x, y }) => ({
      action: window.__actor().getAttribute("data-action"),
      state: window.__actor().getAttribute("data-render-state"),
      marker: window.__sample(x, y),
    }), { x: POINTS.marker[0], y: POINTS.marker[1] });
    assert.equal(observed.action, "walk1");
    assert.equal(observed.state, "ready");
    assert.ok(FRAME_MARKERS.walk1.some((color) => color.slice(0, 3).every((channel, index) => channel === observed.marker[index])),
      `marker must stay walk-colored, got ${JSON.stringify(observed.marker)}`);
  } finally {
    serverState().delays.clear();
  }
});

test("version conflict and missing resources surface locatable errors with no partial frame, then recover", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "baseline ready");

  const hairKey = avatarPlan.actions.stand1.frames[0].layers.find((layer) => layer.id === "hair").resource.key;
  const conflicting = withResourceVersion(avatarPlan, hairKey, `sha256:${"0".repeat(64)}`);
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: conflicting }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "error", "conflict error state");
  const conflict = await page.evaluate(() => ({
    message: window.__actor().getAttribute("data-render-error"),
    canvasWidth: window.__actor().shadowRoot.querySelector("canvas").width,
  }));
  assert.match(conflict.message, /CONTENT_CONFLICT/);
  assert.ok(conflict.message.includes(hairKey), `diagnostic must name the resource (${conflict.message})`);
  assert.equal(conflict.canvasWidth, 1, "error must clear the canvas, not leave a partial frame");

  const missingKey = "Look/00020000/default/0/ghost";
  const missingPlan = structuredClone(avatarPlan);
  for (const frame of missingPlan.actions.stand1.frames) {
    const face = frame.layers.find((layer) => layer.id === "face");
    face.resource.key = missingKey;
  }
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: missingPlan }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "error", "missing error state", 6_000);
  const missing = await page.evaluate(() => window.__actor().getAttribute("data-render-error"));
  assert.match(missing, /CONTENT_NOT_FOUND/);
  assert.ok(missing.includes(missingKey), `diagnostic must name the missing key (${missing})`);

  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "recovers on the corrected plan");
  await waitPixel(page, POINTS.faceThroughHairHole, COLORS.face, "pixels restored after recovery");
});

test("disconnect cancels in-flight reads and releases the cache; reconnect renders again", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "baseline ready");

  const brandishFrame2Body = avatarPlan.actions.brandish1.frames[2].layers[0].resource;
  serverState().delays.set(`${brandishFrame2Body.namespace}/${brandishFrame2Body.key}`, 1_500);
  try {
    await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
    await waitFor(page, (key) => window.__resourceCalls.some((call) => call.key === key), "delayed brandish frame 2 requested", 6_000, brandishFrame2Body.key);
    await page.evaluate(() => { window.__removedActor = window.__actor(); });
    // Remove the node from the authoritative view: the Projector disconnects it.
    await page.evaluate((view) => window.__applyView(view), actorView({ withActor: false }));
    await waitFor(page, () => document.body.contains(window.__removedActor) === false, "element removed from the managed DOM");
    await waitFor(page, (key) => window.__resourceCalls.find((call) => call.key === key)?.aborted === true, "in-flight read aborted on disconnect", 6_000, brandishFrame2Body.key);
    await waitFor(page, () => window.__removedActor.diagnostics().cache.entries === 0, "bitmap cache released on disconnect");

    // Reconnect: the same key returns as a fresh element and renders again.
    await page.evaluate((view) => window.__applyView(view), actorView());
    await waitFor(page, () => window.__actor() !== null && window.__actor() !== window.__removedActor, "fresh element instance");
    await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "reconnected element ready");
    await waitPixel(page, POINTS.headOverBody, COLORS.head, "reconnected element paints");
    assert.equal(await page.evaluate(() => window.__removedActor.diagnostics().cache.entries), 0, "the disconnected instance must stay released");
    assert.deepEqual(await page.evaluate(() => window.__presentationFailures), [], "no presentation failures across disconnect/reconnect");
  } finally {
    serverState().delays.clear();
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(serverState().active, 0, "server must not keep aborted requests open");
});

test("decoded-bitmap cache keeps its documented capacity bound across many frames", { timeout: 90_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  // Touch stand, a full walk cycle and a full brandish play, then stressSpin
  // (48 body frames × 4 layers; the weapon intentionally lacks the action):
  // 73 distinct decoded bitmaps against the 64-entry cap.
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "walk" } }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "walk ready");
  for (const expected of [0, 1, 2, 3]) await waitFrame(page, expected, `walk1 frame ${expected}`, 5_000);
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "stand" } }));
  await waitAction(page, "stand1", "stand1 active");
  await waitFrame(page, 1, "stand1 frame 1", 5_000);
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitAction(page, "brandish1", "brandish started");
  await waitPixel(page, POINTS.marker, FRAME_MARKERS.brandish1[2], "brandish last frame", 6_000);

  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "stressSpin" } });
  await waitAction(page, "stressSpin", "stressSpin active");
  await waitFor(page, (color) => {
    const actual = window.__sample(-6, -1);
    return actual !== null && color.every((channel, index) => channel === actual[index]);
  }, "stressSpin last frame painted", 25_000, FRAME_MARKERS.stressSpin[47].slice(0, 3));
  await waitAction(page, "stand1", "stressSpin completed and returned to locomotion", 10_000);
  await waitFor(page, () => {
    const actor = window.__actor();
    return actor.diagnostics().paintPending === false && actor.getAttribute("data-render-state") === "ready";
  }, "paint settled");
  const diagnostics = await page.evaluate(() => window.__actor().diagnostics());
  assert.ok(diagnostics.cache.entries <= diagnostics.cache.maxEntries,
    `cache must respect the entry cap (${diagnostics.cache.entries} > ${diagnostics.cache.maxEntries})`);
  assert.ok(diagnostics.cache.bytes <= diagnostics.cache.maxBytes, "cache must respect the byte cap");
});

test("avatarPlan built from the synthetic FSDB respects the frozen RenderNode.data byte cap", () => {
  const bytes = measureAvatarPlanDataBytes(avatarPlan);
  assert.ok(bytes > 0 && bytes <= 262_144, `plan must fit the frozen cap (got ${bytes} bytes)`);
  const distinctResources = new Set();
  for (const action of Object.values(avatarPlan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) distinctResources.add(`${layer.resource.namespace}/${layer.resource.key}`);
    }
  }
  // 73 synthetic canvases: body per frame (2+4+1+3+48) plus per-action
  // head (5), hair (4 + shared default via UOL), the shared face canvas and
  // per-action weapon (4; the weapon lacks stressSpin and is not drawn).
  assert.equal(distinctResources.size, 73);
  assert.ok(distinctResources.size > 64, "fixture must exceed the bitmap cache entry cap to exercise eviction");
});

// ---------------------------------------------------------------------------
// Plan-mutation helpers for capacity / consistency tests

function clonePlan() {
  return structuredClone(avatarPlan);
}

function mutateLayers(plan, predicate, mutate) {
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) {
        if (predicate(layer)) mutate(layer);
      }
    }
  }
}

function distinctLayerTemplates(plan, count) {
  const seen = new Set();
  const templates = [];
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) {
        const identity = `${layer.resource.namespace}\u0000${layer.resource.key}\u0000${layer.resource.contentVersion}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        templates.push(structuredClone(layer));
        if (templates.length >= count) return templates;
      }
    }
  }
  throw new Error(`only ${templates.length} distinct layers available, needed ${count}`);
}

function withBurstActions(plan, perBurst = 32) {
  const templates = distinctLayerTemplates(plan, 2 * perBurst);
  const makeFrame = (slice) => ({
    delay: 10_000,
    move: [0, 0],
    flip: false,
    layers: slice.map((template, index) => ({ ...template, id: index === 0 ? "body" : `pad${index}` })),
  });
  plan.actions.burstA = { loop: false, frames: [makeFrame(templates.slice(0, perBurst))] };
  plan.actions.burstB = { loop: false, frames: [makeFrame(templates.slice(perBurst, 2 * perBurst))] };
  return plan;
}

const burstIdentities = (plan, actionName) => {
  const identities = [];
  for (const layer of plan.actions[actionName].frames[0].layers) {
    identities.push(`${layer.resource.namespace}/${layer.resource.key}`);
  }
  return identities;
};

test("oversized single canvases and over-budget frames are rejected at plan validation", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "baseline ready");
  const before = await page.evaluate(() => window.__resourceCalls.length);

  // One canvas decoding to > maxDecodedFrameBytes on its own.
  const oversized = clonePlan();
  mutateLayers(oversized, (layer) => layer.id === "hair", (layer) => {
    layer.width = 1_800;
    layer.height = 1_800; // 12,960,000 bytes > 12,582,912
  });
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: oversized }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "invalid", "oversized canvas rejected");
  const single = await page.evaluate(() => ({
    message: window.__actor().getAttribute("data-render-error"),
    canvasWidth: window.__actor().shadowRoot.querySelector("canvas").width,
  }));
  assert.match(single.message, /decodes to 12960000 bytes, exceeding the 12582912-byte canvas budget/);
  assert.ok(single.message.includes("layers[") || single.message.includes("hair"), `diagnostic must locate the layer (${single.message})`);
  assert.equal(single.canvasWidth, 1, "invalid plans must leave the canvas cleared");

  // A frame whose combined layers exceed the budget while each canvas fits.
  const frameHeavy = clonePlan();
  mutateLayers(frameHeavy, (layer) => layer.id !== "body", (layer) => {
    layer.width = 900;
    layer.height = 900; // 3,240,000 bytes each; four such layers + body blow the frame budget
  });
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: frameHeavy }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "invalid", "over-budget frame rejected");
  const frameMessage = await page.evaluate(() => window.__actor().getAttribute("data-render-error"));
  assert.match(frameMessage, /bytes across its layers, exceeding the 12582912-byte frame budget/);

  // Validation gates before any browser-side fetch of the mutated identity.
  const callsAfter = await page.evaluate(() => window.__resourceCalls.length);
  assert.equal(callsAfter, before, "invalid plans must not trigger resource reads");

  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "recovers after oversized plans");
  assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), [], "no unhandled page errors");
});

test("cross-plan dimension conflicts on a cached identity are rejected locatably", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "baseline ready");
  await waitFor(page, () => window.__actor().diagnostics().cache.entries > 0, "hair identity decoded and cached");

  // Same Content identity, same version, DIFFERENT declared dimensions in a
  // later plan: consistent inside the plan, so only the cache can catch it.
  const conflicting = clonePlan();
  mutateLayers(conflicting, (layer) => layer.id === "hair", (layer) => {
    layer.height = 17; // real decode is 24x18
  });
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: conflicting }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "error", "dimension conflict rejected");
  const conflict = await page.evaluate(() => ({
    message: window.__actor().getAttribute("data-render-error"),
    canvasWidth: window.__actor().shadowRoot.querySelector("canvas").width,
  }));
  assert.match(conflict.message, /CONTENT_INVALID/);
  assert.match(conflict.message, /declares 24x17 but the cached decode of the same identity and version is 24x18/);
  assert.ok(conflict.message.includes("hair"), `diagnostic must name the resource (${conflict.message})`);
  assert.equal(conflict.canvasWidth, 1, "conflict must clear the canvas, not paint a stretched bitmap");

  // The rejection happened synchronously inside the paint round's error
  // handling — no unhandled rejection may escape to the page.
  assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), [], "no unhandled page errors");

  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "recovers on the corrected plan");
  await waitPixel(page, POINTS.faceThroughHairHole, COLORS.face, "pixels restored after recovery");
  assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), [], "still no unhandled page errors");
});

test("a 32-resource concurrent burst never violates the strict cacheable-tier bound", { timeout: 90_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  const plan = withBurstActions(clonePlan());
  const burstB = burstIdentities(plan, "burstB");

  await page.evaluate((view) => window.__applyView(view), actorView({ plan }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "baseline ready");

  // Fill the cacheable tier with burstA (36 entries), then delay every
  // burstB resource so its 32 loads are observably concurrent.
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "burstA" } });
  await waitFor(page, () => window.__actor()?.getAttribute("data-action") === "burstA", "burstA active");
  await waitFor(page, () => {
    const actor = window.__actor();
    return actor.diagnostics().cache.loading === 0 && actor.getAttribute("data-render-state") === "ready";
  }, "burstA settled");
  const afterA = await page.evaluate(() => window.__actor().diagnostics());
  assert.ok(afterA.cache.entries > 20 && afterA.cache.entries <= 64, `burstA fill out of range (${afterA.cache.entries})`);

  for (const identity of burstB) serverState().delays.set(identity, 700);
  try {
    await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "burstB" } });
    // Poll the diagnostics throughout the concurrent burst: the cacheable
    // tier must stay within BOTH bounds at every observation.
    const samples = [];
    const deadline = Date.now() + 1_400;
    while (Date.now() < deadline) {
      const diagnostics = await page.evaluate(() => window.__actor().diagnostics());
      samples.push(diagnostics);
      assert.ok(diagnostics.cache.entries <= diagnostics.cache.maxEntries,
        `cacheable entries must never exceed the cap (saw ${diagnostics.cache.entries})`);
      assert.ok(diagnostics.cache.bytes <= diagnostics.cache.maxBytes,
        `cacheable bytes must never exceed the cap (saw ${diagnostics.cache.bytes})`);
      assert.ok(diagnostics.cache.entries + diagnostics.cache.loading <= diagnostics.cache.maxEntries + 32,
        `map must stay within cap + one working frame (saw ${diagnostics.cache.entries}+${diagnostics.cache.loading})`);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    assert.ok(samples.some((sample) => sample.cache.loading >= 8),
      `the burst must actually load concurrently (peak loading ${Math.max(...samples.map((s) => s.cache.loading))})`);

    await waitFor(page, () => {
      const actor = window.__actor();
      return actor.diagnostics().cache.loading === 0 && actor.getAttribute("data-render-state") === "ready";
    }, "burst settled", 15_000);
    const settled = await page.evaluate(() => window.__actor().diagnostics());
    assert.ok(settled.cache.entries <= settled.cache.maxEntries, `settled entries within cap (${settled.cache.entries})`);
    assert.ok(settled.cache.bytes <= settled.cache.maxBytes, `settled bytes within cap (${settled.cache.bytes})`);
    assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), [], "no unhandled page errors");
  } finally {
    serverState().delays.clear();
  }
});

test("left/right mirroring is pixel-exact at deviceScaleFactor 1 and 2, including a frame move pivot", { timeout: 90_000 }, async (t) => {
  for (const deviceScaleFactor of [1, 2]) {
    const page = await openBootstrappedPage(t, { deviceScaleFactor });
    // Give the still jump frame an x-pivot so the mirror axis is provably
    // derived from the frame `move`, not hardcoded at zero.
    const pivot = 3;
    const pivotPlan = clonePlan();
    pivotPlan.actions.jump.frames[0].move = [pivot, -5];
    await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "jump" }, plan: pivotPlan }));
    await waitAction(page, "jump", `jump active at dsf ${deviceScaleFactor}`);
    await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", `ready at dsf ${deviceScaleFactor}`);
    await waitFor(page, () => window.__actor().diagnostics().paintPending === false, `paint settled at dsf ${deviceScaleFactor}`);

    const snapshot = await waitFor(page, () => window.__snapshot(), `snapshot at dsf ${deviceScaleFactor}`);
    assert.equal(snapshot.dpr, deviceScaleFactor, "devicePixelRatio must match the requested scale factor");
    assert.equal(snapshot.width, Math.round(snapshot.cssWidth * deviceScaleFactor), "canvas backing store must scale with dpr");

    // Anchors stay aligned under the shifted composite at both DPRs.
    // The mutated frame move [pivot, -5] shifts every rect by (3, -5).
    await waitPixel(page, [POINTS.headOverBody[0] + pivot, POINTS.headOverBody[1] - 5], COLORS.head, `head anchored at dsf ${deviceScaleFactor}`);
    await waitPixel(page, [POINTS.faceThroughHairHole[0] + pivot, POINTS.faceThroughHairHole[1] - 5], COLORS.face, `face visible at dsf ${deviceScaleFactor}`);

    const mirrored = await page.evaluate(async ({ pivotX }) => {
      const capture = async (facing) => {
        window.__actor().setAttribute("facing", facing);
        await new Promise((resolve) => setTimeout(resolve, 200));
        const canvas = window.__canvas();
        const dpr = window.devicePixelRatio || 1;
        const left = Number.parseFloat(canvas.style.left) || 0;
        const top = Number.parseFloat(canvas.style.top) || 0;
        const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        return { left, top, dpr, width: canvas.width, height: canvas.height, data };
      };
      const right = await capture("right");
      const leftView = await capture("left");
      const at = (snap, x, y) => {
        const px = Math.round((x - snap.left) * snap.dpr);
        const py = Math.round((y - snap.top) * snap.dpr);
        if (px < 0 || py < 0 || px >= snap.width || py >= snap.height) return null;
        const offset = (py * snap.width + px) * 4;
        return [snap.data[offset], snap.data[offset + 1], snap.data[offset + 2], snap.data[offset + 3]];
      };
      let compared = 0;
      let mismatches = 0;
      let opaqueCompared = 0;
      for (let x = -60 + 2 * pivotX; x <= 60 + 2 * pivotX; x += 2) {
        for (let y = -70; y <= 5; y += 2) {
          const r = at(right, x, y);
          const l = at(leftView, 2 * pivotX - x, y);
          if (r === null || l === null) continue;
          compared += 1;
          const same = r[3] === l[3] && (r[3] === 0 || (r[0] === l[0] && r[1] === l[1] && r[2] === l[2]));
          if (!same) mismatches += 1;
          if (r[3] > 0) opaqueCompared += 1;
        }
      }
      return { compared, mismatches, opaqueCompared };
    }, { pivotX: pivot });
    assert.ok(mirrored.compared > 300, `mirror comparison must cover the composite at dsf ${deviceScaleFactor} (got ${mirrored.compared})`);
    assert.ok(mirrored.opaqueCompared > 80, `mirror comparison must include opaque pixels at dsf ${deviceScaleFactor} (got ${mirrored.opaqueCompared})`);
    assert.equal(mirrored.mismatches, 0,
      `facing left must mirror facing right around the frame-move pivot at dsf ${deviceScaleFactor} (${mirrored.mismatches}/${mirrored.compared})`);
    assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), [], `no unhandled page errors at dsf ${deviceScaleFactor}`);
  }
});

test("composite canvas bounds reject extreme layouts before any allocation, at any DPR", { timeout: 90_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "baseline ready");

  // Valid per AvatarPlanV1 (every anchor stays inside the ±100,000 bound)
  // but the head's neck anchor places it ~99,000 px from the body: the
  // composite would be ~99,000 CSS px wide.
  const extreme = clonePlan();
  const head = extreme.actions.jump.frames[0].layers.find((layer) => layer.id === "head");
  head.anchors = { ...head.anchors, neck: [-99_000, -32] };
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "jump" }, plan: extreme }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "error", "extreme layout rejected");
  const rejection = await page.evaluate(() => ({
    message: window.__actor().getAttribute("data-render-error"),
    width: window.__actor().shadowRoot.querySelector("canvas").width,
    height: window.__actor().shadowRoot.querySelector("canvas").height,
  }));
  assert.match(rejection.message, /COMPOSITE_TOO_LARGE/);
  assert.match(rejection.message, /device px/);
  assert.ok(rejection.message.includes("head"), `diagnostic must name the farthest layer (${rejection.message})`);
  assert.equal(rejection.width, 1, "rejection must happen before any canvas allocation");
  assert.equal(rejection.height, 1, "rejection must happen before any canvas allocation");

  // An absurd host devicePixelRatio must not make a VALID plan allocate a
  // huge backing store either: the ratio is clamped before sizing.
  await page.evaluate(() => Object.defineProperty(window, "devicePixelRatio", { value: 64, configurable: true }));
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "normal plan ready at clamped dpr");
  const clamped = await page.evaluate(() => {
    const canvas = window.__canvas();
    return { device: canvas.width, deviceArea: canvas.width * canvas.height, css: Number.parseFloat(canvas.style.width) };
  });
  assert.equal(clamped.device, Math.ceil(clamped.css * 8), "backing store must use the clamped dpr (8), not the host dpr (64)");
  assert.ok(clamped.deviceArea <= 3_145_728, "clamped backing store must stay inside the device-pixel budget");

  // The extreme layout stays rejected at the same absurd DPR, again without
  // any allocation: the canvas must shrink back from the painted 8× store
  // to the cleared 1×1 state.
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "jump" }, plan: extreme }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "error"
    && window.__canvas()?.width === 1, "extreme layout still rejected at dpr 64");
  const rejection64 = await page.evaluate(() => window.__actor().getAttribute("data-render-error"));
  assert.match(rejection64, /COMPOSITE_TOO_LARGE/);

  await page.evaluate((dpr) => Object.defineProperty(window, "devicePixelRatio", { value: dpr, configurable: true }), 1);
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "normal plan ready again at dpr 1");
  await waitPixel(page, POINTS.bodyOnly, COLORS.body, "normal rendering restored at dpr 1");
  assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), [], "no unhandled page errors");
});

test("rapid delayed plan replacements cancel stale reads; the latest plan still renders", { timeout: 90_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  const hairless = clonePlan();
  for (const action of Object.values(hairless.actions)) {
    for (const frame of action.frames) {
      frame.layers = frame.layers.filter((layer) => layer.id !== "hair");
    }
  }

  // Slow every image response so reads linger across the plan swaps.
  const imageIdentities = [...fsdb.index.keys()]
    .map((identity) => identity.split("\0"))
    .filter(([namespace]) => namespace === "resource.图")
    .map(([namespace, key]) => `${namespace}/${key}`);
  for (const identity of imageIdentities) serverState().delays.set(identity, 900);

  try {
    let sawInFlight = false;
    for (let round = 0; round < 6; round += 1) {
      const plan = round % 2 === 0 ? hairless : avatarPlan;
      await page.evaluate((view) => window.__applyView(view), actorView({ plan }));
      await new Promise((resolve) => setTimeout(resolve, 120));
      const diagnostics = await page.evaluate(() => window.__actor().diagnostics());
      sawInFlight = sawInFlight || diagnostics.cache.loading >= 1;
      assert.ok(diagnostics.cache.loading <= 16,
        `in-flight reads must stay bounded across plan replacements (saw ${diagnostics.cache.loading})`);
    }
    assert.ok(sawInFlight, "the stream must actually leave reads in flight");

    serverState().delays.clear();
    await page.evaluate((view) => window.__applyView(view), actorView());
    await waitAction(page, "stand1", "latest plan active");
    await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "latest plan ready");
    await waitPixel(page, POINTS.faceThroughHairHole, COLORS.face, "hair restored by the latest plan");

    const calls = await page.evaluate(() => window.__resourceCalls);
    assert.ok(calls.some((call) => call.aborted), "stale-plan reads must be cancelled, not left running");
    const settled = await page.evaluate(() => window.__actor().diagnostics());
    assert.equal(settled.cache.loading, 0, "no reads may remain in flight after settling");
    assert.equal(settled.cache.pendingClose, 0, "no evicted bitmaps may remain pinned after settling");
    assert.ok(settled.cache.entries <= settled.cache.maxEntries, "cache within the entry cap");
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(serverState().active, 0, "server must not keep cancelled requests open");
    assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), [], "no unhandled page errors");
  } finally {
    serverState().delays.clear();
  }
});

test("stale decode work is gated, bounded and discarded; the latest plan still renders", { timeout: 90_000 }, async (t) => {
  const page = await openBootstrappedPage(t);

  // Gate createImageBitmap: fetch responses arrive immediately (no server
  // delay), but decodes only run when the test releases them. This exposes
  // the decode-phase window the network-delay regression cannot reach.
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window);
    window.__decodeState = { started: 0, active: 0, peakActive: 0, completed: 0, gates: [] };
    window.createImageBitmap = (...args) => {
      window.__decodeState.started += 1;
      window.__decodeState.active += 1;
      window.__decodeState.peakActive = Math.max(window.__decodeState.peakActive, window.__decodeState.active);
      return new Promise((resolve, reject) => {
        window.__decodeState.gates.push({
          release: () => {
            window.__decodeState.active -= 1;
            window.__decodeState.completed += 1;
            original(...args).then(resolve, reject);
          },
        });
      });
    };
    window.__releaseDecodes = async () => {
      while (window.__decodeState.gates.length > 0) {
        window.__decodeState.gates.shift().release();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
  });

  // A plan with only stand/walk/jump and no hair: replacing the full plan
  // with it evicts every brandish1/stressSpin/hair identity.
  const stripped = clonePlan();
  delete stripped.actions.brandish1;
  delete stripped.actions.stressSpin;
  for (const action of Object.values(stripped.actions)) {
    for (const frame of action.frames) {
      frame.layers = frame.layers.filter((layer) => layer.id !== "hair");
    }
  }

  // stand1 frame 0: 5 gated decodes (body, head, hair, face, weapon).
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__decodeState.started >= 5 && window.__decodeState.active === 5, "stand1 frame decodes gated");
  // brandish1 frame 0: 4 fresh identities (face is a shared cache hit) — 8
  // slots fill and exactly one decode must queue.
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitFor(page, () => window.__actor().diagnostics().decode.queued === 1 && window.__decodeState.started === 8,
    "decode slots saturated at the cap with one job queued");

  // Replace the plan while all 8 decodes are pending: the queued brandish
  // decode must be discarded WITHOUT ever starting, and the running set must
  // stay at the cap.
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: stripped }));
  const afterSwap = await page.evaluate(() => ({
    queued: window.__actor().diagnostics().decode.queued,
    active: window.__actor().diagnostics().decode.active,
    started: window.__decodeState.started,
  }));
  assert.equal(afterSwap.queued, 0, "queued stale decodes must be discarded at eviction, before starting");
  assert.equal(afterSwap.started, 8, "the discarded queued decode must never reach createImageBitmap");
  assert.equal(afterSwap.active, 8, "running decodes stay capped while unabortable decodes drain");

  // Rapid further replacements: a wanted hair decode queues behind the cap,
  // then gets discarded again when the plan changes back — no growth.
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor().diagnostics().decode.queued === 1, "wanted hair decode queues behind the cap");
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: stripped }));
  const bounded = await page.evaluate(() => ({
    queued: window.__actor().diagnostics().decode.queued,
    active: window.__actor().diagnostics().decode.active,
    peakActive: window.__decodeState.peakActive,
  }));
  assert.equal(bounded.queued, 0, "second replacement discards the queued decode again");
  assert.ok(bounded.active <= 8 && bounded.peakActive <= 8,
    `concurrent decodes must never exceed the cap (active ${bounded.active}, peak ${bounded.peakActive})`);

  // Release every gated decode: stale results are discarded by the
  // post-decode checks, the stripped plan renders.
  await page.evaluate(() => window.__releaseDecodes());
  await waitAction(page, "stand1", "stripped plan active after decode release");
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "stripped plan ready");
  await waitPixel(page, POINTS.bodyOnly, COLORS.body, "stripped composite painted");

  // The latest FULL plan re-decodes hair through the same bounded gate and
  // completes it.
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__decodeState.started >= 9, "hair re-decode started");
  await page.evaluate(() => window.__releaseDecodes());
  await waitPixel(page, POINTS.faceThroughHairHole, COLORS.face, "latest full plan rendered with hair");

  const settled = await page.evaluate(() => ({
    diagnostics: window.__actor().diagnostics(),
    decodeState: window.__decodeState,
  }));
  assert.equal(settled.diagnostics.decode.active, 0, "no decode may keep a slot after settling");
  assert.equal(settled.diagnostics.decode.queued, 0, "queue must be empty after settling");
  assert.equal(settled.diagnostics.cache.loading, 0, "no reads may remain in flight after settling");
  assert.equal(settled.diagnostics.cache.pendingClose, 0, "no evicted bitmaps may remain pinned after settling");
  assert.ok(settled.decodeState.peakActive <= 8, `page-side observed peak concurrency ${settled.decodeState.peakActive} must respect the cap`);
  assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), [], "no unhandled page errors");
});

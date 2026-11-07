// Runtime contract tests for the Base → Adventure Map vertical slice
// (issue #62, T1–T3 of docs/implementation/
// 2026-11-06-base-adventure-map-actor-slice-draft.md §5).
//
// T1 — Base lifecycle: Frame params are forwarded verbatim, exactly ONE
//       Controls Producer RenderDomain exists while the child Frame is
//       active, and the producer is closed when the child completes, is
//       cancelled, fails, or throws. Base touches no other scope capability.
// T2 — Map actions: the REAL pinned createControlsConsumer +
//       createDirectionalControlsTracker drive the locomotion/facing mapping
//       (left/right walk + facing, up jump, down stand, release → stand with
//       facing kept, repeated states produce no extra updates) and the
//       Viewport-centered x/y projection on resize.
// T3 — Map failure/cancel: Content unavailability fails with a stable code,
//       Abort cancels, sync projection errors surface as
//       ADVENTURE_INPUT_PROJECTION_FAILED, init errors map to
//       ADVENTURE_MAP_INIT_FAILED — and every path releases the Controls
//       consumer, the Viewport subscription, and the RenderDomain.
//
// The subsystem sources are imported directly (they resolve their pinned
// framework deps through the root workspace); the Controls consumer and the
// directional tracker are the REAL pinned implementations — this file never
// re-implements the held-key state machine.

import assert from "node:assert/strict";
import test from "node:test";

import baseSubsystem from "../systems/base/subsystem.mjs";
import mapSubsystem from "../systems/adventure-map/subsystem.mjs";
import { AVATAR_PLAN_KEY, AVATAR_PLAN_NAMESPACE } from "../scripts/pwa/read-adventure-fsdb.mjs";

const PLAN = Object.freeze({
  formatVersion: 1,
  bodyKey: "avatar.part.body.00002000",
  zOrder: ["body"],
  locomotionActions: { stand: "stand1", walk: "walk1", jump: "jump" },
  actions: { stand1: { loop: true, frames: [{ layers: [] }] } },
});

// --- Shared fakes -----------------------------------------------------------

function createDomainHarness({ failOnAttr = null } = {}) {
  const domains = [];
  const createRenderDomain = (state) => {
    const domain = {
      initialState: state,
      updates: [],
      closed: false,
      update(update) {
        if (domain.closed) throw new Error("update after close");
        const set = update.nodes?.[0]?.attrs?.set ?? {};
        if (failOnAttr !== null && Object.hasOwn(set, failOnAttr)) {
          throw new Error(`projection failed while setting ${failOnAttr}`);
        }
        domain.updates.push(update);
      },
      replace() { if (domain.closed) throw new Error("replace after close"); },
      emit() {},
      close() { domain.closed = true; },
    };
    domains.push(domain);
    return domain;
  };
  return { domains, createRenderDomain };
}

function createViewportHarness(initial = { width: 800, height: 600 }) {
  const listeners = new Set();
  const unsubscribed = [];
  const viewport = {
    current: initial,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        unsubscribed.push(true);
      };
    },
  };
  return {
    viewport,
    notify(value) {
      viewport.current = value;
      for (const listener of [...listeners]) listener(value);
    },
    get listenerCount() { return listeners.size; },
    get unsubscribeCount() { return unsubscribed.length; },
  };
}

/** Fake PresentationEventClient wired to the REAL pinned Controls consumer. */
function createPresentationEventsHarness() {
  const listeners = [];
  const client = {
    createListener({ channels }) {
      const handlers = new Map();
      const listener = {
        channels: [...channels],
        handlers,
        closed: false,
        on(channel, handler) {
          handlers.set(channel, handler);
          return () => handlers.delete(channel);
        },
        setChannels(next) { listener.channels = [...next]; },
        close() {
          listener.closed = true;
          handlers.clear();
        },
      };
      listeners.push(listener);
      return listener;
    },
  };
  return {
    client,
    listeners,
    /** Dispatch one Presentation Event the way the projector would. */
    dispatch(channel, name, data) {
      for (const listener of listeners) {
        if (listener.closed) continue;
        const handler = listener.handlers.get(channel);
        if (typeof handler === "function") handler({ channel, name, data, source: {} });
      }
    },
  };
}

function createContentHarness({ plan = PLAN, recordError = null } = {}) {
  const calls = [];
  const content = {
    calls,
    async record(namespace, key, options) {
      calls.push({ namespace, key, options });
      if (recordError !== null) throw recordError;
      if (namespace === AVATAR_PLAN_NAMESPACE && key === AVATAR_PLAN_KEY) {
        return { value: plan, contentVersion: `sha256:${"a".repeat(64)}` };
      }
      throw new Error(`unexpected content record ${namespace}/${key}`);
    },
    async group() { throw new Error("unexpected content group read"); },
    async resource() { throw new Error("unexpected content resource read"); },
  };
  return content;
}

function createFrame({ params = null } = {}) {
  const controller = new AbortController();
  return {
    id: "test-frame",
    params,
    signal: controller.signal,
    abort: () => controller.abort(),
    call: async () => { throw new Error("unexpected frame.call"); },
  };
}

function denyScopeExtra(capabilities) {
  const used = [];
  const deny = (capability) => () => {
    used.push(capability);
    throw new Error(`unexpected scope capability use: ${capability}`);
  };
  return {
    used,
    scope: Object.freeze({
      signal: new AbortController().signal,
      state: Object.freeze({ read: deny("state"), subscribe: deny("state") }),
      events: Object.freeze({ publish: deny("events"), subscribe: deny("events") }),
      content: Object.freeze({ record: deny("content.record"), group: deny("content.group"), resource: deny("content.resource") }),
      viewport: Object.freeze({ current: null, subscribe: deny("viewport.subscribe") }),
      presentationEvents: Object.freeze({ createListener: deny("presentationEvents.createListener") }),
      ...capabilities,
    }),
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

function contentReadError(code) {
  const error = new Error(code);
  error.name = "ContentReadError";
  error.code = code;
  return error;
}

// ---------------------------------------------------------------------------
// T1 — Base lifecycle
// ---------------------------------------------------------------------------

test("T1: Base forwards params verbatim through exactly one Controls Producer and closes it on child completion", async () => {
  const domains = [];
  const guard = denyScopeExtra({
    createRenderDomain: (state) => {
      domains.push({ state, closed: false });
      return { update() {}, replace() {}, emit() {}, close() { domains.at(-1).closed = true; } };
    },
  });
  const observed = [];
  const params = { stage: 1, note: "forward-me" };
  const frame = createFrame({ params });
  frame.call = async (subsystem, forwarded) => {
    observed.push({ subsystem, forwarded });
    assert.equal(domains.length, 1, "exactly one Controls Producer while the child Frame is active");
    assert.equal(domains[0].closed, false, "the producer stays open while the child Frame is active");
    return Object.freeze({ type: "completed", value: { ok: true } });
  };

  const outcome = await baseSubsystem(guard.scope).frame(frame);

  assert.deepEqual(observed, [{ subsystem: "adventure-map", forwarded: params }], "params must be forwarded verbatim");
  assert.equal(observed[0].forwarded, params, "the params OBJECT is forwarded, not a copy");
  assert.deepEqual(outcome, { type: "completed", value: { ok: true } });
  assert.equal(domains.length, 1, "Base never creates a second Producer");
  assert.equal(domains[0].closed, true, "the Producer is closed after the child completes");
  assert.deepEqual(guard.used, [], "Base touches no scope capability besides createRenderDomain/frame.call");
  assert.deepEqual(
    domains[0].state,
    {
      zIndex: 0,
      roots: [{
        key: "game-controls-input",
        tag: "game-controls-input",
        attrs: {},
        data: {},
        children: [],
      }],
    },
    "the single root is the unified Controls component at zIndex 0",
  );
});

test("T1: Base closes the Controls Producer when the child is cancelled, fails, or throws", async () => {
  for (const [label, childOutcome, expectRejection] of [
    ["cancelled", Object.freeze({ type: "cancelled" }), false],
    ["failed", Object.freeze({ type: "failed", error: { code: "CHILD_FAILED" } }), false],
    ["thrown", null, true],
  ]) {
    const domains = [];
    const guard = denyScopeExtra({
      createRenderDomain: (state) => {
        domains.push({ state, closed: false });
        return { update() {}, replace() {}, emit() {}, close() { domains.at(-1).closed = true; } };
      },
    });
    const frame = createFrame();
    frame.call = async () => {
      if (expectRejection) throw new Error("child exploded");
      return childOutcome;
    };
    const definition = baseSubsystem(guard.scope);
    if (expectRejection) {
      await assert.rejects(() => definition.frame(frame), /child exploded/, `${label}: the child error propagates`);
    } else {
      assert.deepEqual(await definition.frame(frame), childOutcome, `${label}: the child outcome is returned as-is`);
    }
    assert.equal(domains.length, 1, `${label}: still exactly one Producer`);
    assert.equal(domains[0].closed, true, `${label}: the Producer is closed in the finally block`);
  }
});

test("T1: each new Base Frame activation owns a fresh single Producer", async () => {
  const created = [];
  const guard = denyScopeExtra({
    createRenderDomain: (state) => {
      const domain = { state, closed: false, update() {}, replace() {}, emit() {}, close() { domain.closed = true; } };
      created.push(domain);
      return domain;
    },
  });
  const definition = baseSubsystem(guard.scope);
  for (let index = 0; index < 2; index += 1) {
    const frame = createFrame({ params: index });
    frame.call = async () => Object.freeze({ type: "completed", value: index });
    assert.deepEqual(await definition.frame(frame), { type: "completed", value: index });
  }
  assert.equal(created.length, 2, "one Producer per Frame activation");
  assert.ok(created.every((domain) => domain.closed), "every Producer is closed");
});

// ---------------------------------------------------------------------------
// T2 — Adventure Map direction mapping and centering
// ---------------------------------------------------------------------------

function startMapFrame({ content, viewport, events, domains, failOnAttr } = {}) {
  const domainHarness = domains ?? createDomainHarness({ failOnAttr });
  const viewportHarness = viewport ?? createViewportHarness();
  const eventsHarness = events ?? createPresentationEventsHarness();
  const contentHarness = content ?? createContentHarness();
  const frame = createFrame();
  const scope = Object.freeze({
    signal: new AbortController().signal,
    state: Object.freeze({ read() { throw new Error("no state"); }, subscribe() { throw new Error("no state"); } }),
    events: Object.freeze({ publish() { throw new Error("no events"); }, subscribe() { throw new Error("no events"); } }),
    content: contentHarness,
    viewport: viewportHarness.viewport,
    presentationEvents: eventsHarness.client,
    createRenderDomain: domainHarness.createRenderDomain,
  });
  return {
    frame,
    outcome: mapSubsystem(scope).frame(frame),
    domains: domainHarness.domains,
    domain: () => domainHarness.domains[0],
    viewportHarness,
    eventsHarness,
    contentHarness,
  };
}

/** Press a direction through the REAL consumer: fresh state + down event. */
function pressDirection(harness, button, held) {
  harness.eventsHarness.dispatch("controls.state", "input.state", { down: held ?? [button] });
  harness.eventsHarness.dispatch("controls.event", "input.event", { action: "down", button, repeat: false });
}

test("T2: the Map projects one centered actor and maps directions onto locomotion/facing", async () => {
  const harness = startMapFrame();
  const outcome = harness.outcome;
  await settle();

  // Exactly one RenderDomain with one cms-actor root, centered in the
  // viewport (x = 800/2, y = 600/2 + 16), string attrs, plan passed once.
  assert.equal(harness.domains.length, 1);
  assert.deepEqual(harness.domain().initialState, {
    zIndex: 0,
    roots: [{
      key: "adventure-player",
      tag: "cms-actor",
      attrs: { x: "400", y: "316", locomotion: "stand", facing: "right" },
      data: { avatarPlan: PLAN },
      children: [],
    }],
  });
  assert.equal(harness.eventsHarness.listeners.length, 1, "exactly one Controls consumer listener");
  assert.deepEqual(harness.eventsHarness.listeners[0].channels, ["controls.state", "controls.event"]);

  const attrsOfUpdate = (index) => {
    const update = index === -1 ? harness.domain().updates.at(-1) : harness.domain().updates[index];
    return update?.nodes?.[0]?.attrs?.set ?? {};
  };
  const nodeOfUpdate = (index) => harness.domain().updates[index]?.nodes?.[0]?.key;

  // left → walk + facing left
  pressDirection(harness, "left");
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { locomotion: "walk", facing: "left" }, "left maps to walk + facing left");

  // release everything → stand, facing kept (no facing key in the delta)
  harness.eventsHarness.dispatch("controls.state", "input.state", { down: [] });
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { locomotion: "stand" }, "release maps back to stand, keeping the last facing");

  // right → walk + facing right (fresh from stand)
  pressDirection(harness, "right");
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { locomotion: "walk", facing: "right" }, "right maps to walk + facing right");

  // up → jump, facing untouched
  pressDirection(harness, "up");
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { locomotion: "jump" }, "up maps to jump and keeps the last facing");

  // down → stand, facing untouched
  pressDirection(harness, "down");
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { locomotion: "stand" }, "down maps to stand and keeps the last facing");

  // already standing: releasing produces no additional update
  const updateCountAfterRelease = harness.domain().updates.length;
  harness.eventsHarness.dispatch("controls.state", "input.state", { down: [] });
  await settle();
  assert.equal(harness.domain().updates.length, updateCountAfterRelease, "same-value states are not re-projected");

  // repeated identical state produces no additional update either
  harness.eventsHarness.dispatch("controls.state", "input.state", { down: [] });
  await settle();
  assert.equal(harness.domain().updates.length, updateCountAfterRelease, "same-value states are not re-projected");

  // walking left, then switching to right while walking: ONLY facing changes
  pressDirection(harness, "left");
  await settle();
  pressDirection(harness, "right");
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { facing: "right" }, "left→right while walking updates only the facing attr");

  // every update targets the single stable node key
  for (let index = 0; index < harness.domain().updates.length; index += 1) {
    assert.equal(nodeOfUpdate(index), "adventure-player");
  }

  // Held-order semantics come from the pinned tracker: hold left, then right
  // (right wins), release right → left is still held. The character is
  // already walking here, so only the facing attr flips each time.
  pressDirection(harness, "left", ["left"]);
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { facing: "left" }, "newly held left wins the direction");
  pressDirection(harness, "right", ["left", "right"]);
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { facing: "right" }, "the most recently held direction wins");
  harness.eventsHarness.dispatch("controls.state", "input.state", { down: ["left"] });
  harness.eventsHarness.dispatch("controls.event", "input.event", { action: "up", button: "right", repeat: false });
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { facing: "left" }, "releasing right falls back to the still-held left");

  // Viewport resize re-centers x/y only.
  harness.viewportHarness.notify({ width: 1000, height: 500 });
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { x: "500", y: "266" }, "resize recenters the actor (x = w/2, y = h/2 + 16)");
  // A null/invalid viewport never updates attrs.
  const before = harness.domain().updates.length;
  harness.viewportHarness.notify(null);
  harness.viewportHarness.notify({ width: 0, height: 100 });
  await settle();
  assert.equal(harness.domain().updates.length, before, "null/zero viewports do not project");

  // The plan data is never re-sent on direction changes.
  for (const update of harness.domain().updates) {
    assert.equal(update.nodes?.[0]?.data, undefined, "direction changes never resend avatarPlan data");
  }

  // Cancel: the frame resolves cancelled and every resource is released.
  harness.frame.abort();
  assert.deepEqual(await outcome, { type: "cancelled" });
  assert.equal(harness.domain().closed, true, "the RenderDomain is closed on cancel");
  assert.equal(harness.viewportHarness.unsubscribeCount, 1, "the Viewport subscription is released on cancel");
  assert.equal(harness.eventsHarness.listeners[0].closed, true, "the Controls consumer listener is closed on cancel");
});

// ---------------------------------------------------------------------------
// T3 — Adventure Map failure and cancellation paths
// ---------------------------------------------------------------------------

test("T3: unavailable bootstrap Content fails with ADVENTURE_AVATAR_CONTENT_UNAVAILABLE and creates nothing", async () => {
  for (const code of ["CONTENT_NOT_FOUND", "CONTENT_UNAVAILABLE", "CONTENT_INVALID", "CONTENT_CONFLICT"]) {
    const harness = startMapFrame({ content: createContentHarness({ recordError: contentReadError(code) }) });
    const outcome = await harness.outcome;
    assert.equal(outcome.type, "failed", `${code}: must fail the Frame`);
    assert.equal(outcome.error.code, "ADVENTURE_AVATAR_CONTENT_UNAVAILABLE", `${code}: stable failure code`);
    assert.equal(harness.domains.length, 0, `${code}: no RenderDomain may be created`);
    assert.equal(harness.eventsHarness.listeners.length, 0, `${code}: no Controls consumer may be created`);
    assert.equal(harness.viewportHarness.listenerCount, 0, `${code}: no Viewport subscription may be created`);
  }
});

test("T3: cancelled Content reads map to cancelled(), other init errors to ADVENTURE_MAP_INIT_FAILED", async () => {
  const cancelledHarness = startMapFrame({ content: createContentHarness({ recordError: contentReadError("CONTENT_CANCELLED") }) });
  assert.deepEqual(await cancelledHarness.outcome, { type: "cancelled" }, "CONTENT_CANCELLED maps to cancelled");

  const abortedHarness = startMapFrame({ content: createContentHarness({ recordError: contentReadError("CONTENT_NOT_FOUND") }) });
  abortedHarness.frame.abort();
  const abortedOutcome = await abortedHarness.outcome;
  assert.deepEqual(abortedOutcome, { type: "cancelled" }, "an already-aborted Frame cancels even on Content failure");

  const brokenHarness = startMapFrame({ content: createContentHarness({ recordError: new Error("disk melted") }) });
  const brokenOutcome = await brokenHarness.outcome;
  assert.equal(brokenOutcome.type, "failed");
  assert.equal(brokenOutcome.error.code, "ADVENTURE_MAP_INIT_FAILED", "non-Content init errors get the init failure code");
  assert.equal(brokenHarness.domains.length, 0);

  const createRenderDomain = () => { throw new Error("renderer refused"); };
  const frame = createFrame();
  const scope = Object.freeze({
    signal: new AbortController().signal,
    state: {}, events: {},
    content: createContentHarness(),
    viewport: createViewportHarness().viewport,
    presentationEvents: createPresentationEventsHarness().client,
    createRenderDomain,
  });
  const domainFailure = await mapSubsystem(scope).frame(frame);
  assert.equal(domainFailure.type, "failed");
  assert.equal(domainFailure.error.code, "ADVENTURE_MAP_INIT_FAILED", "mid-initialization throw maps to the init failure code");
});

test("T3: a synchronous projection failure fails the Frame and releases every resource", async () => {
  const harness = startMapFrame({ failOnAttr: "locomotion" });
  const outcome = harness.outcome;
  await settle();
  assert.equal(harness.domain().closed, false, "the domain is alive before the failure");

  pressDirection(harness, "left");
  const failure = await outcome;
  assert.equal(failure.type, "failed", "a swallowed-by-consumer projection error must still fail the Frame");
  assert.equal(failure.error.code, "ADVENTURE_INPUT_PROJECTION_FAILED");

  assert.equal(harness.domain().closed, true, "the RenderDomain is closed after the projection failure");
  assert.equal(harness.viewportHarness.unsubscribeCount, 1, "the Viewport subscription is released");
  assert.equal(harness.eventsHarness.listeners[0].closed, true, "the Controls consumer is closed");

  // Late input after the failure must not resurrect anything.
  const updatesBefore = harness.domain().updates.length;
  harness.eventsHarness.dispatch("controls.state", "input.state", { down: ["right"] });
  await settle();
  assert.equal(harness.domain().updates.length, updatesBefore, "no projection happens after the fatal gate closed");
});

test("T3: a Viewport projection failure uses its own stable code", async () => {
  const domains = createDomainHarness({ failOnAttr: "y" });
  const harness = startMapFrame({ domains });
  const outcome = harness.outcome;
  await settle();
  harness.viewportHarness.notify({ width: 640, height: 480 });
  const failure = await outcome;
  assert.equal(failure.type, "failed");
  assert.equal(failure.error.code, "ADVENTURE_VIEWPORT_PROJECTION_FAILED");
  assert.equal(harness.domain().closed, true);
  assert.equal(harness.viewportHarness.unsubscribeCount, 1);
  assert.equal(harness.eventsHarness.listeners[0].closed, true);
});

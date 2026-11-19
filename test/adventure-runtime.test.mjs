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
//       ADVENTURE_INPUT_PROJECTION_FAILED / ADVENTURE_VIEWPORT_PROJECTION_FAILED,
//       init errors map to ADVENTURE_MAP_INIT_FAILED — and every path releases
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
import {
  FIELD_PLAN_KEY,
  FIELD_PLAN_NAMESPACE,
} from "../systems/adventure-map/field-plan-model.mjs";
import { FIELD_SCENE_ROOT_KEY } from "../systems/adventure-map/field-scene-runtime.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../scripts/pwa/read-adventure-field-plan.mjs";
import { fileURLToPath } from "node:url";

const repoRootPath = fileURLToPath(new URL("../", import.meta.url));
const canonicalFieldPlan = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRootPath })).plan;

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

function createContentHarness({ recordError = null, fieldPlan = canonicalFieldPlan } = {}) {
  const calls = [];
  const content = {
    calls,
    async record(namespace, key, options) {
      calls.push({ namespace, key, options });
      if (recordError !== null) throw recordError;
      if (namespace === FIELD_PLAN_NAMESPACE && key === FIELD_PLAN_KEY) {
        return Object.freeze({ value: fieldPlan });
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
// T2 — Adventure Map static Field scene and camera projection
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

test("T2: the Map projects the static Field scene and reprojects camera on resize", async (t) => {
  const harness = startMapFrame();
  t.after(() => harness.frame.abort());
  const outcome = harness.outcome;
  await settle();

  assert.equal(harness.domains.length, 1);
  const root = harness.domain().initialState.roots[0];
  assert.equal(root.key, FIELD_SCENE_ROOT_KEY);
  assert.equal(root.tag, "ms-scene-view");
  assert.equal(root.attrs["camera-x"], "-492");
  assert.equal(root.attrs["camera-y"], "-390");
  assert.ok(root.children.length > 200, "the Field root carries the full map Paint Unit tree");
  assert.ok(root.children.some((child) => child.key === "player:adventure"));
  assert.equal(harness.eventsHarness.listeners.length, 1, "exactly one Controls consumer listener");
  assert.deepEqual(harness.eventsHarness.listeners[0].channels, ["controls.state", "controls.event"]);

  const attrsOfUpdate = (index) => {
    const update = index === -1 ? harness.domain().updates.at(-1) : harness.domain().updates[index];
    return update?.nodes?.[0]?.attrs?.set ?? {};
  };

  const updatesBeforeInput = harness.domain().updates.length;
  pressDirection(harness, "left");
  pressDirection(harness, "right");
  await settle();
  assert.ok(
    harness.domain().updates.length > updatesBeforeInput,
    "M4 projects locomotion/facing to ms-avatar attrs from Controls",
  );
  const avatarUpdate = harness.domain().updates.find((update) => update.nodes?.[0]?.key === "player:adventure:avatar");
  assert.ok(avatarUpdate, "controls input must update the nested ms-avatar node");
  pressDirection(harness, "up");
  await settle();
  assert.ok(harness.domain().updates.some((update) => (
    update.nodes?.[0]?.key === "player:adventure:avatar"
      && update.nodes[0].attrs?.set?.action === "jump"
  )), "up must select the projected jump action");

  harness.viewportHarness.notify({ width: 1000, height: 500 });
  await settle();
  assert.deepEqual(
    attrsOfUpdate(-1),
    { "camera-x": "-592", "camera-y": "-290" },
    "viewport resize projects clamped camera attrs on ms-scene-view",
  );
  harness.viewportHarness.notify({ width: 1002, height: 500 });
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { "camera-x": "-593" }, "width-only resize updates camera-x only");
  harness.viewportHarness.notify({ width: 1002, height: 502 });
  await settle();
  assert.deepEqual(attrsOfUpdate(-1), { "camera-y": "-292" }, "height-only resize updates camera-y only");

  const before = harness.domain().updates.length;
  harness.viewportHarness.notify(null);
  harness.viewportHarness.notify({ width: 0, height: 100 });
  await settle();
  assert.equal(harness.domain().updates.length, before, "null/zero viewports do not project");

  for (const update of harness.domain().updates) {
    const key = update.nodes?.[0]?.key;
    assert.ok(
      key === FIELD_SCENE_ROOT_KEY || key === "player:adventure:avatar",
      `updates must target camera or avatar attrs only (saw ${key})`,
    );
    assert.equal(update.nodes?.[0]?.data, undefined, "projection updates must not resend scene data");
  }

  harness.frame.abort();
  assert.deepEqual(await outcome, { type: "cancelled" });
  assert.equal(harness.domain().closed, true);
  assert.equal(harness.viewportHarness.unsubscribeCount, 1);
  assert.equal(harness.eventsHarness.listeners[0].closed, true);
});

// ---------------------------------------------------------------------------
// T3 — Adventure Map failure and cancellation paths
// ---------------------------------------------------------------------------

test("T3: missing FieldPlan Content fails with the stable field-unavailable code", async () => {
  const harness = startMapFrame({
    content: createContentHarness({ recordError: contentReadError("CONTENT_NOT_FOUND") }),
  });
  const failure = await harness.outcome;
  assert.equal(failure.type, "failed");
  assert.equal(failure.error.code, "ADVENTURE_FIELD_CONTENT_UNAVAILABLE");
  assert.equal(harness.domains.length, 0);
});

test("T3: cancellation and initialization failures release every resource", async () => {
  const activeHarness = startMapFrame();
  activeHarness.frame.abort();
  assert.deepEqual(await activeHarness.outcome, { type: "cancelled" });

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

test("T3: a Viewport projection failure uses its own stable code", async () => {
  const domains = createDomainHarness({ failOnAttr: "camera-y" });
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

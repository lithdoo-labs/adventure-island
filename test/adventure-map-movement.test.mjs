import assert from "node:assert/strict";
import test from "node:test";
import mapSubsystem from "../systems/adventure-map/subsystem.mjs";
import { FIELD_PLAN_KEY, FIELD_PLAN_NAMESPACE } from "../systems/adventure-map/field-plan-model.mjs";
import { FIELD_SCENE_ROOT_KEY } from "../systems/adventure-map/field-scene-runtime.mjs";
import { PLAYER_AVATAR_KEY, PLAYER_WORLD_ITEM_KEY } from "../systems/adventure-map/avatar-locomotion.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../scripts/pwa/read-adventure-field-plan.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalFieldPlan = (await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot })).plan;

function createDomainHarness() {
  const domains = [];
  const createRenderDomain = (state) => {
    const domain = {
      initialState: state,
      updates: [],
      closed: false,
      update(update) {
        if (domain.closed) throw new Error("update after close");
        domain.updates.push(update);
      },
      replace() {},
      emit() {},
      close() { domain.closed = true; },
    };
    domains.push(domain);
    return domain;
  };
  return { domains, createRenderDomain };
}

function createPresentationEventsHarness() {
  const listeners = [];
  return {
    client: {
      createListener({ channels }) {
        const handlers = new Map();
        const listener = { channels: [...channels], handlers, closed: false,
          on(channel, handler) { handlers.set(channel, handler); return () => handlers.delete(channel); },
          setChannels(next) { listener.channels = [...next]; },
          close() { listener.closed = true; handlers.clear(); },
        };
        listeners.push(listener);
        return listener;
      },
    },
    listeners,
    dispatch(channel, name, data) {
      for (const listener of listeners) {
        if (listener.closed) continue;
        const handler = listener.handlers.get(channel);
        if (typeof handler === "function") handler({ channel, name, data, source: {} });
      }
    },
  };
}

function createContentHarness(fieldPlan = canonicalFieldPlan) {
  return {
    async record(databasePath, namespace, key) {
      if (databasePath !== "adventure") throw new Error(`unexpected database ${databasePath}`);
      if (namespace === FIELD_PLAN_NAMESPACE && key === FIELD_PLAN_KEY) {
        return Object.freeze({ value: fieldPlan });
      }
      throw new Error("unexpected record");
    },
  };
}

test("subsystem projects world position and camera on simulation tick without scene data", async (t) => {
  const domainHarness = createDomainHarness();
  const eventsHarness = createPresentationEventsHarness();
  const controller = new AbortController();
  const frame = {
    id: "movement-frame",
    signal: controller.signal,
    abort: () => controller.abort(),
    call: async () => { throw new Error("no nested call"); },
  };
  const scope = Object.freeze({
    signal: frame.signal,
    state: Object.freeze({ read() { throw new Error("no state"); }, subscribe() { throw new Error("no state"); } }),
    events: Object.freeze({ publish() {}, subscribe() {} }),
    content: createContentHarness(),
    viewport: Object.freeze({
      current: { width: 800, height: 600 },
      subscribe() { return () => {}; },
    }),
    presentationEvents: eventsHarness.client,
    createRenderDomain: domainHarness.createRenderDomain,
  });

  const outcome = mapSubsystem(scope).frame(frame);
  t.after(() => { if (!controller.signal.aborted) controller.abort(); });

  await new Promise((resolve) => setTimeout(resolve, 10));
  eventsHarness.dispatch("controls.state", "input.state", { down: ["right"] });
  eventsHarness.dispatch("controls.event", "input.event", { action: "down", button: "right", repeat: false });
  // Camera follow holds until the player leaves a 28px dead zone, so a single
  // 40ms slice can move the avatar without changing camera-x/camera-y.
  const deadline = Date.now() + 1_000;
  let domain = domainHarness.domains[0];
  while (Date.now() < deadline) {
    domain = domainHarness.domains[0];
    if (domain?.updates.some((u) => u.nodes?.some((n) => n.key === FIELD_SCENE_ROOT_KEY))) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  assert.ok(domain.updates.length > 0);
  const keys = new Set(domain.updates.flatMap((u) => (u.nodes ?? []).map((n) => n.key)));
  assert.ok(keys.has(PLAYER_WORLD_ITEM_KEY) || domain.updates.some((u) => u.nodes?.some((n) => n.key === PLAYER_WORLD_ITEM_KEY)));
  assert.ok(domain.updates.some((u) => u.nodes?.some((n) => n.key === FIELD_SCENE_ROOT_KEY)));
  assert.ok(domain.updates.some((u) => u.nodes?.some((n) => n.key === PLAYER_AVATAR_KEY)));
  for (const update of domain.updates) {
    for (const node of update.nodes ?? []) {
      assert.equal(node.data, undefined, "movement updates must not resend retained scene data");
    }
  }

  controller.abort();
  assert.deepEqual(await outcome, { type: "cancelled" });
});
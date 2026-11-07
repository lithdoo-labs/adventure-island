// T1–T3 for the canonical Base → Adventure Map slice.
//
// One file, three scenarios: Base owns the controls producer, Map projects
// the fixed directional tracker onto actor attrs, and Map failures release
// every resource. The tracker and consumer are the pinned LoomRealm
// implementations; this file does not reimplement held-key rules.

import assert from "node:assert/strict";
import test from "node:test";

import { ContentReadError } from "@loomrealm/subsystem";

const baseModule = await import("../systems/base/subsystem.mjs");
const mapModule = await import("../systems/adventure-map/subsystem.mjs");
const base = baseModule.default;
const adventureMap = mapModule.default;

function controlsHarness() {
  const listeners = [];
  const presentationEvents = {
    createListener({ frame }) {
      const handlers = new Map();
      const listener = {
        closed: false,
        on(channel, handler) {
          handlers.set(channel, handler);
          return () => handlers.delete(channel);
        },
        setChannels() {},
        close() {
          listener.closed = true;
        },
        emit(channel, name, data) {
          if (listener.closed) return;
          handlers.get(channel)?.({
            channel,
            name,
            data,
            source: { subsystemKey: "base", domainId: "controls", targetKey: "game-controls-input" },
          });
        },
      };
      listeners.push(listener);
      frame.signal.addEventListener("abort", () => listener.close(), { once: true });
      return listener;
    },
  };
  return {
    presentationEvents,
    listeners,
    emit(channel, name, data) {
      for (const listener of listeners) listener.emit(channel, name, data);
    },
  };
}

function changedAttrs(update) {
  assert.equal(update.nodes.length, 1);
  assert.equal(update.nodes[0].key, "adventure-player");
  return update.nodes[0].attrs.set;
}

test("T1 base passes params through and closes the controls producer", async () => {
  const opened = [];
  const scope = {
    createRenderDomain(state) {
      const domain = {
        state,
        closed: false,
        close() {
          this.closed = true;
        },
      };
      opened.push(domain);
      return domain;
    },
  };
  let seen;
  let finish;
  const child = new Promise((resolve) => {
    finish = resolve;
  });
  const pending = base(scope).frame({
    id: "base-1",
    params: { continueFrom: "door-1" },
    signal: new AbortController().signal,
    call(subsystem, params) {
      seen = { subsystem, params, producerOpen: opened.length === 1 && opened[0].closed === false };
      return child;
    },
  });
  await Promise.resolve();
  assert.deepEqual(seen, {
    subsystem: "adventure-map",
    params: { continueFrom: "door-1" },
    producerOpen: true,
  });
  assert.equal(opened[0].state.zIndex, 0);
  assert.equal(opened[0].state.roots.length, 1);
  assert.equal(opened[0].state.roots[0].key, "game-controls-input");
  assert.equal(opened[0].state.roots[0].tag, "game-controls-input");
  const outcome = { type: "completed", value: null };
  finish(outcome);
  assert.equal(await pending, outcome);
  assert.equal(opened[0].closed, true);

  const cancelled = [];
  const cancelScope = {
    createRenderDomain(state) {
      const domain = { state, closed: false, close() { this.closed = true; } };
      cancelled.push(domain);
      return domain;
    },
  };
  const controller = new AbortController();
  assert.deepEqual(await base(cancelScope).frame({
    id: "base-2",
    params: null,
    signal: controller.signal,
    call(_subsystem, params) {
      assert.equal(params, null);
      assert.equal(cancelled[0].closed, false);
      controller.abort();
      return { type: "cancelled" };
    },
  }), { type: "cancelled" });
  assert.equal(cancelled[0].closed, true);

  const failed = [];
  const failScope = {
    createRenderDomain(state) {
      const domain = { state, closed: false, close() { this.closed = true; } };
      failed.push(domain);
      return domain;
    },
  };
  await assert.rejects(base(failScope).frame({
    id: "base-3",
    params: { n: 1 },
    signal: new AbortController().signal,
    call() {
      return Promise.reject(new Error("child exploded"));
    },
  }), /child exploded/);
  assert.equal(failed[0].closed, true);
});

test("T2 adventure map projects directions onto locomotion and facing", async () => {
  const harness = controlsHarness();
  const updates = [];
  let root = null;
  let releaseViewport = null;
  const viewport = {
    current: { width: 640, height: 480 },
    subscribe(listener) {
      listener(this.current);
      releaseViewport = listener;
      return () => {
        viewport.unsubscribed = true;
      };
    },
    unsubscribed: false,
  };
  const controller = new AbortController();
  const pending = adventureMap({
    content: {
      async record(namespace, key, options) {
        assert.equal(namespace, "struct.AdventureAvatarPlan");
        assert.equal(key, "bootstrap");
        assert.equal(options.signal.aborted, false);
        return { value: { formatVersion: 1, marker: "plan" }, contentVersion: `sha256:${"a".repeat(64)}` };
      },
    },
    viewport,
    presentationEvents: harness.presentationEvents,
    createRenderDomain(state) {
      root = state.roots[0];
      return {
        update(update) {
          updates.push(update);
        },
        close() {},
      };
    },
  }).frame({
    id: "map-actions",
    params: null,
    signal: controller.signal,
    call() {
      throw new Error("adventure-map must not call another subsystem");
    },
  });
  await Promise.resolve();
  assert.equal(root.tag, "cms-actor");
  assert.equal(root.key, "adventure-player");
  assert.deepEqual(root.data, { avatarPlan: { formatVersion: 1, marker: "plan" } });
  assert.deepEqual(root.attrs, { x: "320", y: "256", locomotion: "stand", facing: "right" });
  assert.equal(updates.length, 0, "the initial empty controls state must not republish unchanged attrs");

  harness.emit("controls.state", "input.state", { down: ["right"] });
  assert.deepEqual(changedAttrs(updates.at(-1)), { locomotion: "walk" });
  harness.emit("controls.state", "input.state", { down: ["left"] });
  assert.deepEqual(changedAttrs(updates.at(-1)), { facing: "left" });
  harness.emit("controls.state", "input.state", { down: [] });
  assert.deepEqual(changedAttrs(updates.at(-1)), { locomotion: "stand" });
  harness.emit("controls.state", "input.state", { down: ["up"] });
  assert.deepEqual(changedAttrs(updates.at(-1)), { locomotion: "jump" });
  harness.emit("controls.state", "input.state", { down: ["down"] });
  assert.deepEqual(changedAttrs(updates.at(-1)), { locomotion: "stand" });
  const beforeIdle = updates.length;
  harness.emit("controls.state", "input.state", { down: [] });
  assert.equal(updates.length, beforeIdle, "releasing from stand keeps the last facing and sends no extra update");

  releaseViewport({ width: 800, height: 600 });
  assert.deepEqual(changedAttrs(updates.at(-1)), { x: "400", y: "316" });
  const beforeInvalid = updates.length;
  releaseViewport({ width: 0, height: 600 });
  releaseViewport(null);
  assert.equal(updates.length, beforeInvalid, "an invalid viewport must not move the actor");

  controller.abort();
  assert.deepEqual(await pending, { type: "cancelled" });
  assert.equal(viewport.unsubscribed, true);
  assert.equal(harness.listeners.every((listener) => listener.closed), true);
});

test("T3 adventure map failures and cancellation release every resource", async () => {
  const unavailable = await adventureMap({
    content: {
      record() {
        return Promise.reject(new ContentReadError("CONTENT_NOT_FOUND"));
      },
    },
    viewport: { current: null, subscribe() { throw new Error("viewport must not be subscribed"); } },
    presentationEvents: { createListener() { throw new Error("consumer must not be created"); } },
    createRenderDomain() {
      throw new Error("domain must not be created");
    },
  }).frame({
    id: "missing-plan",
    params: null,
    signal: new AbortController().signal,
    call() {
      throw new Error("no child");
    },
  });
  assert.deepEqual(unavailable, { type: "failed", error: { code: "ADVENTURE_AVATAR_CONTENT_UNAVAILABLE" } });

  const hostCopy = await adventureMap({
    content: {
      record() {
        return Promise.reject(Object.assign(new Error("CONTENT_UNAVAILABLE"), {
          name: "ContentReadError",
          code: "CONTENT_UNAVAILABLE",
        }));
      },
    },
    viewport: { current: null, subscribe() { throw new Error("no viewport"); } },
    presentationEvents: { createListener() { throw new Error("no consumer"); } },
    createRenderDomain() {
      throw new Error("no domain");
    },
  }).frame({
    id: "host-content-error",
    params: null,
    signal: new AbortController().signal,
    call() {
      throw new Error("no child");
    },
  });
  assert.deepEqual(hostCopy, { type: "failed", error: { code: "ADVENTURE_AVATAR_CONTENT_UNAVAILABLE" } });

  const aborted = new AbortController();
  aborted.abort();
  const cancelled = await adventureMap({
    content: {
      record() {
        return Promise.reject(new ContentReadError("CONTENT_CANCELLED"));
      },
    },
    viewport: { current: null, subscribe() { throw new Error("no viewport"); } },
    presentationEvents: { createListener() { throw new Error("no consumer"); } },
    createRenderDomain() {
      throw new Error("no domain");
    },
  }).frame({
    id: "aborted-read",
    params: null,
    signal: aborted.signal,
    call() {
      throw new Error("no child");
    },
  });
  assert.deepEqual(cancelled, { type: "cancelled" });

  const initFailed = await adventureMap({
    content: {
      record() {
        return Promise.reject(new Error("disk"));
      },
    },
    viewport: { current: null, subscribe() { throw new Error("no viewport"); } },
    presentationEvents: { createListener() { throw new Error("no consumer"); } },
    createRenderDomain() {
      throw new Error("no domain");
    },
  }).frame({
    id: "init-failed",
    params: null,
    signal: new AbortController().signal,
    call() {
      throw new Error("no child");
    },
  });
  assert.deepEqual(initFailed, { type: "failed", error: { code: "ADVENTURE_MAP_INIT_FAILED" } });

  const harness = controlsHarness();
  const closed = { domain: 0, viewport: 0 };
  let resolveRecord;
  const controller = new AbortController();
  const pending = adventureMap({
    content: {
      record() {
        return new Promise((resolve) => {
          resolveRecord = resolve;
        });
      },
    },
    viewport: {
      current: { width: 100, height: 80 },
      subscribe(listener) {
        listener(this.current);
        return () => {
          closed.viewport += 1;
        };
      },
    },
    presentationEvents: harness.presentationEvents,
    createRenderDomain() {
      return {
        update() {
          throw new Error("projection boom");
        },
        close() {
          closed.domain += 1;
        },
      };
    },
  }).frame({
    id: "projection-failed",
    params: null,
    signal: controller.signal,
    call() {
      throw new Error("no child");
    },
  });
  resolveRecord({ value: { formatVersion: 1 }, contentVersion: `sha256:${"b".repeat(64)}` });
  await Promise.resolve();
  harness.emit("controls.state", "input.state", { down: ["left"] });
  assert.deepEqual(await pending, { type: "failed", error: { code: "ADVENTURE_INPUT_PROJECTION_FAILED" } });
  assert.equal(closed.domain, 1);
  assert.equal(closed.viewport, 1);
  assert.equal(harness.listeners.every((listener) => listener.closed), true);
  const updatesAfterClose = [];
  harness.emit("controls.state", "input.state", { down: ["right"] });
  assert.deepEqual(updatesAfterClose, []);
});

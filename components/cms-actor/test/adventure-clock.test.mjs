import test from "node:test";
import assert from "node:assert/strict";
import { CmsActor } from "../src/cms-actor.mjs";
import { validateAvatarPlan } from "../src/avatar-model.mjs";

const version = `sha256:${"b".repeat(64)}`;

function layer(id, z, width = 8, height = 8) {
  return {
    id,
    z,
    resource: { namespace: "resource.Avatar", key: `page/${id}`, contentVersion: version },
    width,
    height,
    origin: [1, 1],
    anchors: id === "body" ? { neck: [0, -2], brow: [0, -4] } : { brow: [0, -1] },
  };
}

function frames(delays, bodyId = "body") {
  return delays.map((delay) => ({
    delay,
    layers: [layer(bodyId, "body")],
  }));
}

function makePlan({ bodyKey = "avatar.part.body.00002000", expressionName = "blink", expressionDelays = [60, 60, 60], faceWidth = 8, actions } = {}) {
  const face = (delay) => ({
    delay,
    layers: [{ ...layer("face", "face", faceWidth, 8), anchors: { brow: [0, -1] } }],
  });
  return validateAvatarPlan({
    formatVersion: 1,
    bodyKey,
    zOrder: ["face", "body"],
    locomotionActions: { stand: "stand1", walk: "walk1", jump: "jump" },
    expression: {
      name: expressionName,
      frames: expressionDelays.map((delay) => face(delay)),
    },
    actions: actions ?? {
      stand1: { loop: true, frames: [{ layers: [layer("body", "body")] }] },
      walk1: { loop: true, frames: frames([100, 100, 100, 100]) },
      jump: { loop: false, frames: frames([200]) },
      brandish1: { loop: false, frames: frames([80, 80, 80]) },
    },
  });
}

function actor(locomotion = "stand") {
  const node = new CmsActor();
  const attrs = new Map([["locomotion", locomotion], ["facing", "right"]]);
  node.getAttribute = (name) => (attrs.has(name) ? attrs.get(name) : null);
  node.setAttribute = (name, value) => attrs.set(name, String(value));
  node.removeAttribute = (name) => attrs.delete(name);
  node.hasAttribute = (name) => attrs.has(name);
  node.style = {};
  return node;
}

test("an action event that arrives before the plan is consumed only by the next plan", () => {
  const node = actor();
  node.receiveRenderEvent({ name: "action", data: { action: "brandish1" } });
  assert.equal(node.diagnostics().pendingAction, "brandish1");

  node.receiveRenderData({ avatarPlan: makePlan() });
  assert.equal(node.diagnostics().pendingAction, null);
  assert.equal(node.diagnostics().oneShotAction, "brandish1");
  assert.equal(node.diagnostics().frameIndex, 0);

  const without = makePlan();
  delete without.actions.brandish1;
  node.receiveRenderData({ avatarPlan: validateAvatarPlan(without) });
  assert.equal(node.diagnostics().oneShotAction, null);
  assert.equal(node.diagnostics().pendingAction, null);

  node.receiveRenderData({ avatarPlan: makePlan() });
  assert.equal(node.diagnostics().oneShotAction, null);
});

test("a plan update keeps an unchanged one-shot frame and restarts when the frame list changes", () => {
  const node = actor();
  const plan = makePlan();
  node.receiveRenderData({ avatarPlan: plan });
  node.receiveRenderEvent({ name: "action", data: { action: "brandish1" } });
  node._frameIndex = 2;
  node._elapsed = 15;
  node.receiveRenderData({ avatarPlan: makePlan() });
  assert.equal(node.diagnostics().oneShotAction, "brandish1");
  assert.equal(node.diagnostics().frameIndex, 2);

  const changed = makePlan();
  changed.actions.brandish1.frames[0].delay = 90;
  node.receiveRenderData({ avatarPlan: validateAvatarPlan(changed) });
  assert.equal(node.diagnostics().oneShotAction, "brandish1");
  assert.equal(node.diagnostics().frameIndex, 0);
});

test("walk frame index survives a plan update when the walk frames are unchanged", () => {
  const node = actor("walk");
  node.receiveRenderData({ avatarPlan: makePlan() });
  node._frameIndex = 3;
  node._elapsed = 40;
  node._activeActionName = "walk1";
  node.receiveRenderData({ avatarPlan: makePlan() });
  assert.equal(node.diagnostics().frameIndex, 3);
  assert.equal(node._elapsed, 40);
});

test("changing the blink frame list restarts the expression, and a body frame does not", () => {
  const node = actor();
  node.receiveRenderData({ avatarPlan: makePlan() });
  node._expressionFrameIndex = 2;
  node.receiveRenderData({ avatarPlan: makePlan() });
  assert.equal(node.diagnostics().expressionFrame, 2);

  node.receiveRenderData({ avatarPlan: makePlan({ faceWidth: 9 }) });
  assert.equal(node.diagnostics().expressionFrame, 0);

  node.receiveRenderData({ avatarPlan: makePlan({ faceWidth: 9 }) });
  node._expressionFrameIndex = 1;
  node._connected = true;
  node._elapsed = 0;
  node._expressionElapsed = 0;
  node._lastTick = 0;
  node._tick(60);
  assert.equal(node.diagnostics().expressionFrame, 2);
  assert.equal(node.diagnostics().frameIndex, 0);
});

test("showFace false skips the expression track, and a bodyKey change drops the previous pose", () => {
  const node = actor();
  const plan = makePlan();
  plan.actions.stand1.frames[0].showFace = false;
  node.receiveRenderData({ avatarPlan: validateAvatarPlan(plan) });
  assert.deepEqual(node._expressionLayersFor(plan.actions.stand1.frames[0]), []);

  node.receiveRenderEvent({ name: "action", data: { action: "brandish1" } });
  assert.equal(node.diagnostics().rememberedAction, "brandish1");
  const next = makePlan({ bodyKey: "avatar.part.body.00002001" });
  node.receiveRenderData({ avatarPlan: next });
  assert.equal(node.diagnostics().oneShotAction, null);
  assert.equal(node.diagnostics().rememberedAction, "stand1");
  assert.equal(node.diagnostics().rememberedBodyKey, "avatar.part.body.00002001");
});

test("a missing action keeps the remembered pose when it is still in the plan, otherwise stand", () => {
  const node = actor("walk");
  node.receiveRenderData({ avatarPlan: makePlan() });
  node.receiveRenderEvent({ name: "action", data: { action: "brandish1" } });
  node.receiveRenderEvent({ name: "action", data: { action: "no-such-pose" } });
  assert.equal(node.diagnostics().pendingAction, "no-such-pose");
  node.receiveRenderData({ avatarPlan: makePlan() });
  assert.equal(node.diagnostics().pendingAction, null);
  assert.equal(node.diagnostics().oneShotAction, "brandish1");

  const without = makePlan();
  delete without.actions.brandish1;
  node.receiveRenderEvent({ name: "action", data: { action: "still-missing" } });
  node.receiveRenderData({ avatarPlan: validateAvatarPlan(without) });
  assert.equal(node.diagnostics().oneShotAction, null);
  assert.equal(node.diagnostics().fallbackAction, "stand1");
});

test("delay 0 advances immediately and a one-shot's last zero-delay frame returns to locomotion", () => {
  const node = actor();
  const plan = makePlan({
    actions: {
      stand1: { loop: true, frames: [{ layers: [layer("body", "body")] }] },
      walk1: { loop: true, frames: frames([100]) },
      jump: { loop: false, frames: frames([0]) },
      brandish1: { loop: false, frames: [{ delay: 0, layers: [layer("body", "body")] }, { delay: 50, layers: [layer("body", "body")] }] },
    },
  });
  node.receiveRenderData({ avatarPlan: plan });
  node.receiveRenderEvent({ name: "action", data: { action: "brandish1" } });
  assert.equal(node.diagnostics().oneShotAction, "brandish1");
  assert.equal(node.diagnostics().frameIndex, 1);

  const ending = makePlan({
    actions: {
      stand1: { loop: true, frames: [{ layers: [layer("body", "body")] }] },
      walk1: { loop: true, frames: frames([100]) },
      jump: { loop: false, frames: frames([0]) },
      brandish1: { loop: false, frames: [{ delay: 0, layers: [layer("body", "body")] }] },
    },
  });
  node.receiveRenderData({ avatarPlan: ending });
  node.receiveRenderEvent({ name: "action", data: { action: "brandish1" } });
  assert.equal(node.diagnostics().oneShotAction, null);
  assert.equal(node._resolveActiveAction(), "stand1");
});

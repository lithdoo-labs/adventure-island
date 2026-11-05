import test from "node:test";
import assert from "node:assert/strict";
import {
  AVATAR_PLAN_LIMITS,
  formatSkippedLayers,
  frameDuration,
  layoutFrame,
  measureAvatarPlanDataBytes,
  measureCompactJsonBytes,
  mirrorBounds,
  resolveActionName,
  validateAvatarPlan,
} from "../src/avatar-model.mjs";

const version = `sha256:${"a".repeat(64)}`;
const resource = { namespace: "图", key: "Look/00002000/stand1/0/body", contentVersion: version };

function layer(id, z, origin, anchors = {}) {
  return { id, z, resource: { ...resource, key: `${resource.key}/${id}` }, width: 24, height: 32, origin, anchors };
}

function plan() {
  return {
    formatVersion: 1,
    zOrder: ["hair", "face", "head", "body"],
    locomotionActions: { stand: "stand1", walk: "stand1", jump: "jump" },
    actions: {
      stand1: { loop: true, frames: [{ delay: 500, layers: [
        layer("body", "body", [12, 32], { neck: [-4, -32], navel: [-6, -20] }),
        layer("head", "head", [12, 12], { neck: [-4, -10], brow: [0, -7] }),
        layer("face", "face", [6, 5], { brow: [0, -5] }),
        layer("hair", "hair", [12, 10], { brow: [0, -8] }),
      ] }] },
      jump: { loop: false, frames: [{ delay: -200, move: [0, -4], layers: [layer("body", "body", [12, 32])] }] },
    },
  };
}

test("accepts a renderer-ready AvatarPlanV1", () => {
  assert.equal(validateAvatarPlan(plan()).formatVersion, 1);
});

test("rejects a resource without a SHA-256 content version", () => {
  const candidate = plan();
  candidate.actions.stand1.frames[0].layers[0].resource.contentVersion = "v079";
  assert.throws(() => validateAvatarPlan(candidate), /contentVersion/);
});

test("rejects a layer whose z is absent from the authoritative order", () => {
  const candidate = plan();
  candidate.actions.stand1.frames[0].layers[0].z = "unknown-layer";
  assert.throws(() => validateAvatarPlan(candidate), /z must appear in zOrder/);
});

test("rejects the same resource declared with two different dimensions", () => {
  const candidate = plan();
  const head = candidate.actions.stand1.frames[0].layers[1];
  const duplicate = layer("hairShade", "hair", [12, 10], { brow: [0, -8] });
  duplicate.resource = { ...head.resource };
  duplicate.width = 20;
  duplicate.height = 20;
  candidate.actions.stand1.frames[0].layers.push(duplicate);
  assert.throws(() => validateAvatarPlan(candidate), /declares 20x20 .* but an earlier layer declared 24x32/);
});

test("enforces bounded actions, frames and layers", () => {
  const tooManyActions = plan();
  for (let index = 0; index < AVATAR_PLAN_LIMITS.maxActions + 1; index += 1) {
    tooManyActions.actions[`fill${index}`] = tooManyActions.actions.jump;
  }
  assert.throws(() => validateAvatarPlan(tooManyActions), /at most 32 entries/);

  const tooManyFrames = plan();
  tooManyFrames.actions.filler = {
    loop: false,
    frames: Array.from({ length: AVATAR_PLAN_LIMITS.maxFramesPerAction + 1 }, () => ({
      delay: 100,
      layers: [layer("body", "body", [12, 32])],
    })),
  };
  assert.throws(() => validateAvatarPlan(tooManyFrames), /at most 128 entries/);

  const tooManyLayers = plan();
  const frame = tooManyLayers.actions.stand1.frames[0];
  for (let index = 0; index < AVATAR_PLAN_LIMITS.maxLayersPerFrame; index += 1) {
    frame.layers.push(layer(`extra${index}`, "head", [12, 12], { neck: [-4, -10] }));
  }
  assert.throws(() => validateAvatarPlan(tooManyLayers), /at most 32 entries/);
});

test("rejects a plan whose serialized RenderNode.data passes the frozen 262,144-byte cap", () => {
  const candidate = plan();
  const wide = {
    formatVersion: 1,
    zOrder: ["body"],
    actions: {
      bulk: { loop: true, frames: [] },
    },
  };
  for (let index = 0; index < 100; index += 1) {
    wide.actions.bulk.frames.push({
      delay: 100,
      layers: Array.from({ length: 24 }, (_, layerIndex) => ({
        id: layerIndex === 0 ? "body" : `body${layerIndex}`,
        z: "body",
        resource: { namespace: "resource.图", key: `Look/00002000/bulk/${index}/${layerIndex}`, contentVersion: version },
        width: 24,
        height: 32,
        origin: [12, 32],
        anchors: { navel: [-6, -20] },
      })),
    });
  }
  assert.throws(() => measureAvatarPlanDataBytes(wide), RangeError, "bounded measurer aborts at the budget");
  assert.throws(() => validateAvatarPlan(wide), /exceeds the frozen Render Update v1 cap of 262144/);
});

test("rejects a single canvas whose decoded bytes exceed the budget", () => {
  const candidate = plan();
  const hair = candidate.actions.stand1.frames[0].layers.find((layer) => layer.id === "hair");
  hair.width = 1_800;
  hair.height = 1_800; // 12,960,000 > 12,582,912
  assert.throws(() => validateAvatarPlan(candidate), /decodes to 12960000 bytes, exceeding the 12582912-byte canvas budget/);
});

test("rejects a frame whose combined decoded bytes exceed the budget", () => {
  const candidate = plan();
  const frame = candidate.actions.stand1.frames[0];
  for (const layer of frame.layers) {
    if (layer.id === "body") continue;
    layer.width = 1_050;
    layer.height = 1_050; // 4,410,000 each; three of them + body exceed the budget
  }
  assert.throws(() => validateAvatarPlan(candidate), /bytes across its layers, exceeding the 12582912-byte frame budget/);
});

test("compact measurement counts UTF-8 bytes, not UTF-16 code units", () => {
  assert.equal(measureCompactJsonBytes("冒险岛"), 11); // 3×3 UTF-8 bytes + 2 quotes
  assert.equal(measureCompactJsonBytes({ a: [1, 2], b: null, c: true }), 29);
  assert.equal(measureAvatarPlanDataBytes(plan()), 15 + measureCompactJsonBytes(plan()));
});

test("compact measurement aborts at the budget without building a giant string", () => {
  const big = "x".repeat(1024);
  assert.throws(() => measureCompactJsonBytes({ nested: { deep: [big, big, big] } }, 2048), RangeError);
});

test("maps body, head, face and hair by shared WZ anchors", () => {
  const candidate = plan();
  const frame = candidate.actions.stand1.frames[0];
  const result = layoutFrame(frame, candidate.zOrder);
  const byId = new Map(result.positioned.map((item) => [item.layer.id, item]));
  assert.deepEqual([byId.get("body").originX, byId.get("body").originY], [0, 0]);
  assert.deepEqual([byId.get("head").originX, byId.get("head").originY], [0, -22]);
  assert.deepEqual([byId.get("face").originX, byId.get("face").originY], [0, -24]);
  assert.deepEqual([byId.get("hair").originX, byId.get("hair").originY], [0, -21]);
  assert.equal(result.skipped.length, 0);
});

test("paints back-to-front while keeping z-order separate from anchor order", () => {
  const candidate = plan();
  const result = layoutFrame(candidate.actions.stand1.frames[0], candidate.zOrder);
  assert.deepEqual(result.drawOrder.map((item) => item.layer.id), ["body", "head", "face", "hair"]);
});

test("applies frame move to this frame only and does not mutate source data", () => {
  const candidate = plan();
  const frame = candidate.actions.jump.frames[0];
  const before = structuredClone(frame);
  const result = layoutFrame(frame, candidate.zOrder, 100, 80);
  assert.deepEqual([result.positioned[0].originX, result.positioned[0].originY], [100, 76]);
  assert.deepEqual(frame, before);
});

test("uses WZ delay magnitude and resolves adapter-selected locomotion actions", () => {
  const candidate = plan();
  assert.equal(frameDuration({ delay: -200 }), 200);
  assert.equal(frameDuration({}), 0);
  assert.equal(resolveActionName(candidate, "stand"), "stand1");
  assert.equal(resolveActionName(candidate, "walk"), "stand1");
  assert.equal(resolveActionName(candidate, "jump"), "jump");
  candidate.actions.stand2 = candidate.actions.stand1;
  candidate.locomotionActions.stand = "stand2";
  assert.equal(resolveActionName(candidate, "stand"), "stand2");
});

test("skips a layer whose required anchor cannot be resolved, with a locatable diagnostic", () => {
  const candidate = plan();
  const frame = candidate.actions.stand1.frames[0];
  frame.layers.push(layer("detached", "head", [12, 12], { missing: [0, 0], gone: [1, 1] }));
  const result = layoutFrame(frame, candidate.zOrder);
  assert.deepEqual(result.skipped, [{ id: "detached", anchors: ["missing", "gone"] }]);
  assert.equal(formatSkippedLayers(result.skipped), "detached[needs=missing+gone]");
});

test("mirrors a layer around the frame body origin, including frame move", () => {
  const rect = { left: 8, top: -20, width: 10, height: 12 };
  assert.deepEqual(mirrorBounds(rect, 3), { left: -12, right: -2, top: -20, bottom: -8 });
});

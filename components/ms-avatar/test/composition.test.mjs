import assert from "node:assert/strict";
import test from "node:test";
import { layoutFrame, occludedLayers } from "../../cms-actor/src/avatar-model.mjs";
import { composeInternalPaintPlan, shouldMirrorAvatar } from "../src/compose-internal-plan.mjs";
import { validateAvatarRenderData, validateMsActionData } from "../src/avatar-render-data.mjs";
import { stagePaintRatio } from "../src/ms-avatar.mjs";

const version = `sha256:${"1".repeat(64)}`;
const zOrder = ["hair", "face", "head", "body"];
const parent = validateAvatarRenderData({
  appearance: { zOrder },
  sprites: {
    pages: {
      body: { resource: { namespace: "resource.Avatar", key: "synthetic/body", contentVersion: version }, width: 27, height: 32 },
      head: { resource: { namespace: "resource.Avatar", key: "synthetic/head", contentVersion: version }, width: 24, height: 24 },
      face: { resource: { namespace: "resource.Avatar", key: "synthetic/face", contentVersion: version }, width: 12, height: 10 },
      hair: { resource: { namespace: "resource.Avatar", key: "synthetic/hair", contentVersion: version }, width: 24, height: 18 },
    },
    items: {
      body: { page: "body", source: { x: 0, y: 0, w: 27, h: 32 } },
      head: { page: "head", source: { x: 0, y: 0, w: 24, h: 24 } },
      face: { page: "face", source: { x: 0, y: 0, w: 12, h: 10 } },
      hair: { page: "hair", source: { x: 0, y: 0, w: 24, h: 18 } },
    },
  },
  expressions: { default: { frames: [{ durationMs: 0, layers: [] }] } },
});

const clipData = validateMsActionData({
  clip: {
    playback: { mode: "loop" },
    frames: [{
      durationMs: 180,
      layers: [
        { id: "body", sprite: "body", z: "body", origin: [19, 32], anchors: { neck: [-4, -32] } },
        { id: "head", sprite: "head", z: "head", origin: [12, 12], anchors: { neck: [-4, -10], brow: [0, -7] } },
        { id: "face", sprite: "face", z: "face", origin: [6, 5], anchors: { brow: [0, -5] } },
        { id: "hair", sprite: "hair", z: "hair", origin: [12, 9], anchors: { brow: [0, -8] } },
      ],
    }],
  },
}, zOrder, parent.sprites.items);

test("normalized paper-doll data preserves anchor placement and back-to-front z order", () => {
  const plan = composeInternalPaintPlan(parent, { walk1: clipData.clip });
  const layout = layoutFrame(plan.actions.walk1.frames[0], plan.zOrder);
  assert.deepEqual(layout.skipped, []);
  assert.deepEqual(layout.positioned.map(({ layer, originX, originY }) => [layer.id, originX, originY]), [
    ["body", 0, 0],
    ["head", 0, -22],
    ["face", 0, -24],
    ["hair", 0, -21],
  ]);
  assert.deepEqual(layout.drawOrder.map((item) => item.layer.id), ["body", "head", "face", "hair"]);
});

test("slot priority and facing/frame flip retain CMS079 composition semantics", () => {
  const low = { id: "low", z: "body", priority: 1, tag: ["pants"] };
  const high = { id: "high", z: "head", priority: 2, tag: ["pants"] };
  const hidden = occludedLayers([{ layer: low, index: 0 }, { layer: high, index: 1 }], zOrder);
  assert.equal(hidden.has(low), true);
  assert.equal(hidden.has(high), false);
  assert.equal(shouldMirrorAvatar("right", false), true);
  assert.equal(shouldMirrorAvatar("left", false), false);
  assert.equal(shouldMirrorAvatar("right", true), false);
  assert.equal(shouldMirrorAvatar("left", true), true);
});

test("the avatar backing follows the logical grid when the stage scale is fractional", () => {
  const previous = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1.25;
  try {
    const fractional = {
      closest() {
        return { diagnostics: () => ({ scaleX: 1.3723536737235367, scaleY: 1.3723536737235367 }) };
      },
    };
    const aligned = {
      closest() {
        return { diagnostics: () => ({ scaleX: 1.6, scaleY: 1.6 }) };
      },
    };
    assert.deepEqual(stagePaintRatio(fractional), { ratio: 1, smooth: true });
    assert.deepEqual(stagePaintRatio(aligned), { ratio: 2, smooth: false });
    assert.deepEqual(stagePaintRatio({ closest() { return null; } }), { ratio: 1.25, smooth: false });
  } finally {
    if (previous === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = previous;
  }
});

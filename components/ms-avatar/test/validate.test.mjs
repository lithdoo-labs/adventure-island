import assert from "node:assert/strict";
import test from "node:test";
import { validateActionClip } from "../src/action-clip.mjs";
import { validateAvatarRenderData } from "../src/avatar-render-data.mjs";

test("validateActionClip rejects priority/tag mismatch", () => {
  assert.throws(() => validateActionClip({
    playback: { mode: "loop" },
    frames: [{
      durationMs: 100,
      layers: [{ id: "body", sprite: "s1", z: "body", origin: [0, 0], priority: 1 }],
    }],
  }), /priority and tag must appear together/);
});

test("validateAvatarRenderData requires default expression", () => {
  assert.throws(() => validateAvatarRenderData({
    appearance: { zOrder: ["body"] },
    sprites: { pages: {}, items: {} },
    expressions: {},
  }), /default/);
});

test("validateAvatarRenderData rejects negative crops and oversized pages", () => {
  const base = {
    appearance: { zOrder: ["body"] },
    sprites: {
      pages: {
        p: { resource: { namespace: "resource.Avatar", key: "p", contentVersion: `sha256:${"0".repeat(64)}` }, width: 16, height: 16 },
      },
      items: { body: { page: "p", source: { x: -1, y: 0, w: 1, h: 1 } } },
    },
    expressions: { default: { frames: [{ durationMs: 0, layers: [] }] } },
  };
  assert.throws(() => validateAvatarRenderData(base), /source is invalid/);
  base.sprites.items.body.source.x = 0;
  base.sprites.pages.p.width = 9000;
  assert.throws(() => validateAvatarRenderData(base), /decoded page budget/);
});

test("validateActionClip rejects suffix loops without a repeatable suffix", () => {
  assert.throws(() => validateActionClip({
    playback: { mode: "suffix-loop", repeatFrom: 1 },
    frames: [{ durationMs: 100, layers: [] }],
  }), /inside the clip/);
});

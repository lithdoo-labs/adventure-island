import assert from "node:assert/strict";
import test from "node:test";
import { nextClipBoundaryMs, seekClipPresentation } from "../src/presentation-timing.mjs";

test("seekClipPresentation loops walk frames", () => {
  const clip = {
    playback: { mode: "loop" },
    frames: [
      { durationMs: 100, layers: [] },
      { durationMs: 100, layers: [] },
    ],
  };
  assert.equal(seekClipPresentation(clip, 0).frameIndex, 0);
  assert.equal(seekClipPresentation(clip, 150).frameIndex, 1);
  assert.equal(seekClipPresentation(clip, 200).frameIndex, 0);
});

test("seekClipPresentation holds on non-loop clips", () => {
  const clip = {
    playback: { mode: "hold" },
    frames: [{ durationMs: 80, layers: [] }, { durationMs: 40, layers: [] }],
  };
  assert.equal(seekClipPresentation(clip, 200).frameIndex, 1);
  assert.equal(nextClipBoundaryMs(clip, 200), null);
});

test("seekClipPresentation plays a prefix once then loops only the suffix", () => {
  const clip = {
    playback: { mode: "suffix-loop", repeatFrom: 1 },
    frames: [
      { durationMs: 100, layers: [] },
      { durationMs: 40, layers: [] },
      { durationMs: 60, layers: [] },
    ],
  };
  assert.equal(seekClipPresentation(clip, 50).frameIndex, 0);
  assert.equal(seekClipPresentation(clip, 210).frameIndex, 1);
  assert.equal(seekClipPresentation(clip, 260).frameIndex, 2);
  assert.equal(seekClipPresentation(clip, 300).frameIndex, 1);
  assert.equal(nextClipBoundaryMs(clip, 210), 30);
});

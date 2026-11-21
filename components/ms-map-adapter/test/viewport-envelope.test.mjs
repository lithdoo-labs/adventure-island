import assert from "node:assert/strict";
import test from "node:test";
import {
  assertViewportRelayoutEnvelope,
  CANONICAL_VIEWPORT_LARGE,
  CANONICAL_VIEWPORT_SMALL,
  viewportRelayoutEnvelopeMessage,
  VIEWPORT_RELAYOUT_ENVELOPE,
} from "../src/viewport-envelope.mjs";

test("canonical PWA sizes sit inside the M7.6 envelope", () => {
  assert.equal(viewportRelayoutEnvelopeMessage(CANONICAL_VIEWPORT_SMALL), null);
  assert.equal(viewportRelayoutEnvelopeMessage(CANONICAL_VIEWPORT_LARGE), null);
  assert.deepEqual(VIEWPORT_RELAYOUT_ENVELOPE, {
    minWidth: 640,
    maxWidth: 1_280,
    minHeight: 480,
    maxHeight: 720,
  });
});

test("oversized or undersized viewports fail closed", () => {
  assert.match(viewportRelayoutEnvelopeMessage({ width: 639, height: 600 }), /outside/);
  assert.match(viewportRelayoutEnvelopeMessage({ width: 1_281, height: 700 }), /outside/);
  assert.match(viewportRelayoutEnvelopeMessage({ width: 900, height: 479 }), /outside/);
  assert.throws(() => assertViewportRelayoutEnvelope({ width: 3_000, height: 600 }), RangeError);
});
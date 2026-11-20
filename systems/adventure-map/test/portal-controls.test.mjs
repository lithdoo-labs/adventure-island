import assert from "node:assert/strict";
import test from "node:test";
import { controlsUpEdgeFromEvent, movementIntentFromHeldForState } from "../portal-controls.mjs";
import { movementIntentFromHeld } from "../movement-intent.mjs";

test("controlsUpEdgeFromEvent accepts up down when held already includes up (state before event)", () => {
  const edge = controlsUpEdgeFromEvent({
    action: "down",
    button: "up",
    repeat: false,
  });
  assert.equal(edge, true);
});

test("controlsUpEdgeFromEvent rejects repeat only", () => {
  assert.equal(controlsUpEdgeFromEvent({ action: "down", button: "up", repeat: true }), false);
  assert.equal(controlsUpEdgeFromEvent({ action: "up", button: "up", repeat: false }), false);
});

test("movementIntentFromHeldForState does not treat up as jump", () => {
  const stateIntent = movementIntentFromHeldForState(["up", "right"]);
  const fullIntent = movementIntentFromHeld(["up", "right"]);
  assert.equal(stateIntent.jump, false);
  assert.equal(fullIntent.jump, true);
});

test("south and jump still latch jump on state path", () => {
  assert.equal(movementIntentFromHeldForState(["south"]).jump, true);
  assert.equal(movementIntentFromHeldForState(["jump"]).jump, true);
});
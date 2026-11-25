import assert from "node:assert/strict";
import test from "node:test";
import { hiddenPortalClipAfterFinish, hiddenPortalClipForDesire } from "../src/portal-sequence.mjs";

test("approaching a hidden portal plays Start once, then Continue", () => {
  assert.equal(hiddenPortalClipForDesire("hidden", false), "hidden");
  assert.equal(hiddenPortalClipForDesire("hidden", true), "portalStart");
  assert.equal(hiddenPortalClipForDesire("portalStart", true), "portalStart");
  assert.equal(hiddenPortalClipAfterFinish("portalStart", true), "portalContinue");
  assert.equal(hiddenPortalClipForDesire("portalContinue", true), "portalContinue");
});

test("leaving a hidden portal plays Exit once and does not reverse Start", () => {
  assert.equal(hiddenPortalClipForDesire("portalStart", false), "portalExit");
  assert.equal(hiddenPortalClipForDesire("portalContinue", false), "portalExit");
  assert.equal(hiddenPortalClipForDesire("portalExit", false), "portalExit");
  assert.equal(hiddenPortalClipAfterFinish("portalExit", false), "hidden");
  assert.equal(hiddenPortalClipForDesire("portalExit", true), "portalStart");
});

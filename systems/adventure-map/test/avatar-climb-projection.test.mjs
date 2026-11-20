import assert from "node:assert/strict";
import test from "node:test";
import { projectAvatarLocomotionAttrs } from "../avatar-locomotion.mjs";

test("climb locomotion projects to rope action only", () => {
  const attrs = projectAvatarLocomotionAttrs({
    player: { locomotion: "climb", facing: "right" },
    avatarPlanRef: Object.freeze({
      actions: Object.freeze({ rope: {}, stand1: {} }),
      locomotionActions: Object.freeze({ climb: "rope" }),
    }),
  });
  assert.equal(attrs.action, "rope");
  assert.equal(attrs.locomotion, "climb");
});
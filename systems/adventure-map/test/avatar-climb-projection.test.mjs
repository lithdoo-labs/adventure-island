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

test("a ladder rope uses the ladder clip only when that action is published", () => {
  const withLadder = projectAvatarLocomotionAttrs({
    player: { locomotion: "climb", facing: "left" },
    movement: { ropeContact: { l: 1 } },
    avatarPlanRef: Object.freeze({
      actions: Object.freeze({ rope: {}, ladder: {}, stand1: {} }),
      locomotionActions: Object.freeze({ climb: "rope" }),
    }),
  });
  assert.equal(withLadder.action, "ladder");
  const ropeOnly = projectAvatarLocomotionAttrs({
    player: { locomotion: "climb", facing: "left" },
    movement: { ropeContact: { l: 1 } },
    avatarPlanRef: Object.freeze({
      actions: Object.freeze({ rope: {}, stand1: {} }),
      locomotionActions: Object.freeze({ climb: "rope" }),
    }),
  });
  assert.equal(ropeOnly.action, "rope");
});
import assert from "node:assert/strict";
import test from "node:test";
import { projectAvatarLocomotionAttrs } from "../avatar-locomotion.mjs";

test("swim locomotion projects to fly action only", () => {
  const fieldState = Object.freeze({
    player: Object.freeze({ locomotion: "swim", facing: "right" }),
    avatarPlanRef: Object.freeze({
      actions: Object.freeze({ fly: {}, stand1: {} }),
      locomotionActions: Object.freeze({ swim: "fly" }),
    }),
  });
  const attrs = projectAvatarLocomotionAttrs(fieldState);
  assert.equal(attrs.action, "fly");
  assert.equal(attrs.locomotion, "swim");
});

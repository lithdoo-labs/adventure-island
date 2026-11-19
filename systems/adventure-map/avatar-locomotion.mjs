import { resolveActionName } from "../../components/cms-actor/src/avatar-model.mjs";
import { presentationTimingAttrs } from "../../components/ms-avatar/src/presentation-attrs.mjs";

export const PLAYER_AVATAR_KEY = "player:adventure:avatar";
export const LOCOMOTION_TO_MODE = Object.freeze({
  idle: "stand",
  left: "walk",
  right: "walk",
  up: "jump",
  down: "stand",
  jump: "jump",
});

/**
 * Map pinned Controls state to ms-avatar attrs (presentation only — no Movement).
 *
 * @param {object} held button ids currently down
 * @param {object} [fieldState]
 */
export function projectAvatarLocomotionAttrs(held = [], fieldState = null, timingState = null) {
  const locomotion = fieldState?.player?.locomotion ?? "stand";
  const facing = fieldState?.player?.facing ?? "right";
  let nextFacing = facing;
  let nextLocomotion = locomotion;
  const buttons = new Set(held);
  if (buttons.has("up") || buttons.has("jump") || buttons.has("south")) nextLocomotion = "jump";
  else if (buttons.has("left") || buttons.has("right")) nextLocomotion = "walk";
  else nextLocomotion = "stand";
  if (buttons.has("left")) nextFacing = "left";
  if (buttons.has("right")) nextFacing = "right";

  const planRef = fieldState?.avatarPlanRef;
  const action = planRef
    ? resolveActionName(planRef, nextLocomotion)
    : ({ stand: "stand1", walk: "walk1", jump: "jump" }[nextLocomotion] ?? "stand1");

  const timing = timingState?.clip
    ? presentationTimingAttrs(timingState.clip, timingState.elapsedMs ?? 0)
    : { "frame-index": "0", "elapsed-ms": "0" };
  return Object.freeze({
    action,
    facing: nextFacing,
    expression: fieldState?.player?.expression ?? "default",
    "one-shot-enabled": "true",
    "frame-index": timing["frame-index"],
    "elapsed-ms": timing["elapsed-ms"],
    locomotion: nextLocomotion,
  });
}

/**
 * @param {object} avatarNode ms-avatar RenderNode
 * @param {string} actionName
 */
export function findAvatarActionClip(avatarNode, actionName) {
  if (!avatarNode || !Array.isArray(avatarNode.children)) return null;
  for (const child of avatarNode.children) {
    if (child.tag !== "ms-action") continue;
    if (child.attrs?.name === actionName && child.data?.clip) return child.data.clip;
  }
  return null;
}

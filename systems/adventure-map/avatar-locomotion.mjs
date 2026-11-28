import { resolveActionName } from "../../components/cms-actor/src/avatar-model.mjs";
import { presentationTimingAttrs } from "../../components/ms-avatar/src/presentation-attrs.mjs";

export const PLAYER_AVATAR_KEY = "player:adventure:avatar";
export const PLAYER_WORLD_ITEM_KEY = "player:adventure";

/**
 * Project ms-avatar attrs from authoritative FieldState only (M5).
 *
 * @param {object} [fieldState]
 * @param {object} [timingState]
 */
const LOCOMOTION_ACTION_FALLBACK = Object.freeze({
  stand: "stand1",
  walk: "walk1",
  jump: "jump",
  prone: "prone",
  swim: "fly",
  climb: "rope",
});

export function projectAvatarLocomotionAttrs(fieldState = null, timingState = null) {
  const locomotion = fieldState?.player?.locomotion ?? "stand";
  const facing = fieldState?.player?.facing ?? "right";
  const planRef = fieldState?.avatarPlanRef;
  let action;
  if (planRef) {
    action = resolveActionName(planRef, locomotion);
  } else {
    action = LOCOMOTION_ACTION_FALLBACK[locomotion] ?? LOCOMOTION_ACTION_FALLBACK.stand;
  }
  // l selects the ladder clip. A published plan that omitted ladder stays on
  // rope. The live field does not carry avatarPlanRef; the body plan includes
  // the clip, so l === 1 uses ladder. CMS079 writes ladder2/rope2 from the
  // same bit; those frames redirect to ladder/rope. OpenMS selects the same
  // two action names from the ladder flag.
  const ladderPublished = planRef ? Boolean(planRef.actions?.ladder) : true;
  if (locomotion === "climb" && fieldState?.movement?.ropeContact?.l === 1 && ladderPublished) {
    action = "ladder";
  }

  const timing = timingState?.clip
    ? presentationTimingAttrs(timingState.clip, timingState.elapsedMs ?? 0)
    : { "frame-index": "0", "elapsed-ms": "0" };
  return Object.freeze({
    action,
    facing,
    expression: fieldState?.player?.expression ?? "default",
    "one-shot-enabled": "true",
    "frame-index": timing["frame-index"],
    "elapsed-ms": timing["elapsed-ms"],
    locomotion,
  });
}

/**
 * @param {object} player
 */
export function projectPlayerWorldAttrs(player) {
  const decimal = (value) => {
    if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
    if (Object.is(value, -0)) return "0";
    return String(value);
  };
  return Object.freeze({
    "world-x": decimal(player.worldX),
    "world-y": decimal(player.worldY),
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

import { projectAvatarFromPlan } from "../../ms-avatar/src/plan-projection.mjs";

/**
 * Embed canonical avatar RenderNodes under the player world item.
 *
 * @param {object} player field-state player slice
 * @param {object} avatarPlan validated AvatarPlanV1 (adapter input — not wire ABI)
 */
export function buildPlayerAvatarSubtree(player, avatarPlan) {
  const nodeKey = player.nodeKey ?? "player:adventure";
  return projectAvatarFromPlan(avatarPlan, {
    avatarKey: `${nodeKey}:avatar`,
    actionKeyPrefix: `${nodeKey}:action`,
    locomotion: player.locomotion ?? "stand",
    facing: player.facing ?? "right",
    expression: player.expression ?? "default",
    action: undefined,
  });
}
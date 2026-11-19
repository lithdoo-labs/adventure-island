import { avatarSortKey } from "../../ms-map-adapter/src/depth.mjs";
import { buildPlayerAvatarSubtree } from "./avatar-field-projection.mjs";

export const MS_AVATAR_TAG = "ms-avatar";

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

export function playerSortKey(player) {
  const layer = Number(player.layer ?? 0);
  const zM = Number(player.zM ?? 0);
  const flag = player.controllerFlag ? 1 : 0;
  return avatarSortKey(layer, zM, flag);
}

/**
 * @param {object} player
 * @param {{ stackRank?: number, avatarPlan?: object }} [opts]
 */
export function createPlayerWorldItem(player, { stackRank = 1, avatarPlan = null } = {}) {
  const sortKey = playerSortKey(player);
  const nodeKey = player.nodeKey ?? "player:adventure";
  const avatarChild = avatarPlan
    ? buildPlayerAvatarSubtree(player, avatarPlan)
    : Object.freeze({
      key: `${nodeKey}:avatar-pending`,
      tag: MS_AVATAR_TAG,
      attrs: Object.freeze({
        action: "stand1",
        facing: player.facing ?? "right",
        expression: "default",
        "one-shot-enabled": "true",
        "frame-index": "0",
        "elapsed-ms": "0",
      }),
      data: Object.freeze({
        appearance: Object.freeze({ zOrder: Object.freeze(["body"]) }),
        sprites: Object.freeze({ pages: Object.freeze({}), items: Object.freeze({}) }),
        expressions: Object.freeze({
          default: Object.freeze({ frames: Object.freeze([Object.freeze({ durationMs: 0, layers: Object.freeze([]) })]) }),
        }),
      }),
      children: Object.freeze([Object.freeze({
        key: `${nodeKey}:action:stand1`,
        tag: "ms-action",
        attrs: Object.freeze({ name: "stand1" }),
        data: Object.freeze({
          clip: Object.freeze({
            playback: Object.freeze({ mode: "hold" }),
            frames: Object.freeze([Object.freeze({
              durationMs: 0,
              layers: Object.freeze([]),
            })]),
          }),
        }),
        children: Object.freeze([]),
      })]),
    });
  return Object.freeze({
    key: nodeKey,
    tag: "ms-world-item",
    attrs: Object.freeze({
      "world-x": decimalAttr(player.worldX),
      "world-y": decimalAttr(player.worldY),
      "stack-rank": String(stackRank),
      visible: "true",
    }),
    data: Object.freeze({
      actorVisualId: nodeKey,
      anchor: "feet",
      provenance: Object.freeze({
        sortKey,
        layer: Number(player.layer ?? 0),
        zM: Number(player.zM ?? 0),
        controllerFlag: Boolean(player.controllerFlag),
      }),
    }),
    children: Object.freeze([avatarChild]),
  });
}
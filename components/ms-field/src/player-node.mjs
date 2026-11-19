import { avatarSortKey } from "../../ms-map-adapter/src/depth.mjs";
import { M3_AVATAR_SLOT_TAG } from "./limits.mjs";

/** Formal M4 target: replace `ms-m3-avatar-slot` with `ms-avatar` + render-ready appearance. */
export const M4_AVATAR_TARGET_TAG = "ms-avatar";

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
 * @param {{ stackRank?: number }} [opts]
 */
export function createPlayerWorldItem(player, { stackRank = 1 } = {}) {
  const sortKey = playerSortKey(player);
  const nodeKey = player.nodeKey ?? "player:adventure";
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
    children: Object.freeze([Object.freeze({
      key: `${nodeKey}:avatar-slot`,
      tag: M3_AVATAR_SLOT_TAG,
      attrs: Object.freeze({}),
      data: Object.freeze({
        m4TargetTag: M4_AVATAR_TARGET_TAG,
        phase: "static-placeholder",
        width: 16,
        height: 24,
        localX: -8,
        localY: -24,
        color: Object.freeze({ r: 0, g: 200, b: 80, a: 255 }),
      }),
      children: Object.freeze([]),
    })]),
  });
}
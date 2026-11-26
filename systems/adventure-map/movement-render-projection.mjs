/** Pure Movement -> RenderNode projection helpers (no simulation or DOM). */
import { playerSortKey } from "../../components/ms-field/src/player-node.mjs";
import {
  PLAYER_AVATAR_KEY,
  PLAYER_WORLD_ITEM_KEY,
  projectAvatarLocomotionAttrs,
  projectPlayerWorldAttrs,
} from "./avatar-locomotion.mjs";

function childSortKey(node) {
  const provenance = node.data?.provenance;
  if (provenance && Number.isFinite(provenance.sortKey)) return provenance.sortKey;
  const interval = node.data?.depthInterval;
  if (interval && Number.isFinite(interval.min)) return interval.min;
  return Number.POSITIVE_INFINITY;
}

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function playerProvenance(player) {
  return Object.freeze({
    sortKey: playerSortKey(player),
    layer: Number(player.layer ?? 0),
    zM: Number(player.zM ?? 0),
    controllerFlag: Boolean(player.controllerFlag),
  });
}

/** Static paint units keep even ranks. The player takes the odd rank in its depth slot. */
function staticStackRank(staticIndex) {
  return String(2 * (staticIndex + 1));
}

function playerStackRank(insertAt) {
  return String(2 * insertAt + 1);
}

/**
 * Place the player among static nodes by sort key.
 * Static ranks stay fixed for a given node order, so a later depth move
 * changes only the player's rank.
 */
export function playerStackRankPlan(children, player) {
  if (!Array.isArray(children)) throw new TypeError("children must be an array");
  const playerNode = children.find((child) => child.key === PLAYER_WORLD_ITEM_KEY);
  if (!playerNode) throw new TypeError("player world item is missing");
  const staticChildren = children.filter((child) => child.key !== PLAYER_WORLD_ITEM_KEY);
  const sortKey = playerSortKey(player);
  let insertAt = staticChildren.findIndex((child) => sortKey < childSortKey(child));
  if (insertAt < 0) insertAt = staticChildren.length;
  const ordered = [];
  for (let index = 0; index < staticChildren.length; index += 1) {
    if (index === insertAt) {
      ordered.push(Object.freeze({ key: playerNode.key, rank: playerStackRank(insertAt) }));
    }
    ordered.push(Object.freeze({
      key: staticChildren[index].key,
      rank: staticStackRank(index),
    }));
  }
  if (insertAt === staticChildren.length) {
    ordered.push(Object.freeze({ key: playerNode.key, rank: playerStackRank(insertAt) }));
  }
  return Object.freeze(ordered);
}

/** Build the first authoritative snapshot before the Domain becomes visible. */
export function projectInitialMovementRoot(root, fieldState, camera) {
  const rankPlan = playerStackRankPlan(root.children, fieldState.player);
  const byKey = new Map(root.children.map((child) => [child.key, child]));
  const worldAttrs = projectPlayerWorldAttrs(fieldState.player);
  const avatarAttrs = projectAvatarLocomotionAttrs(fieldState);

  const children = rankPlan.map(({ key, rank }) => {
    const child = byKey.get(key);
    if (key !== PLAYER_WORLD_ITEM_KEY) {
      return Object.freeze({
        ...child,
        attrs: Object.freeze({ ...child.attrs, "stack-rank": rank }),
        children: child.children,
      });
    }
    const avatarChildren = child.children.map((avatar) => {
      if (avatar.key !== PLAYER_AVATAR_KEY) return avatar;
      return Object.freeze({
        ...avatar,
        attrs: Object.freeze({
          ...avatar.attrs,
          action: avatarAttrs.action,
          facing: avatarAttrs.facing,
          "frame-index": avatarAttrs["frame-index"],
          "elapsed-ms": avatarAttrs["elapsed-ms"],
        }),
        children: avatar.children,
      });
    });
    return Object.freeze({
      ...child,
      attrs: Object.freeze({ ...child.attrs, ...worldAttrs, "stack-rank": rank }),
      data: Object.freeze({
        ...child.data,
        provenance: playerProvenance(fieldState.player),
      }),
      children: Object.freeze(avatarChildren),
    });
  });

  return Object.freeze({
    ...root,
    attrs: Object.freeze({
      ...root.attrs,
      "camera-x": decimalAttr(camera.cameraX),
      "camera-y": decimalAttr(camera.cameraY),
    }),
    children: Object.freeze(children),
  });
}

/**
 * Existing-node update for a Player depth transition. Static Canvas data is
 * never resent. A node whose rank is already the stable value is left alone,
 * so a foothold change patches the player only.
 */
export function projectPlayerDepthUpdate(children, player, currentRanks) {
  const plan = playerStackRankPlan(children, player);
  const nextRanks = new Map(plan.map(({ key, rank }) => [key, rank]));
  const nodes = [];
  for (const { key, rank } of plan) {
    if (currentRanks.get(key) === rank && key !== PLAYER_WORLD_ITEM_KEY) continue;
    const node = { key, attrs: { set: { "stack-rank": rank } } };
    if (key === PLAYER_WORLD_ITEM_KEY) {
      node.data = { set: { provenance: playerProvenance(player) } };
    }
    nodes.push(node);
  }
  return Object.freeze({ nodes: Object.freeze(nodes), nextRanks });
}

/**
 * Map Adapter/Projection + static FieldState → ms-scene-view RenderNode tree.
 */
import { buildMapProjection } from "../../ms-map-adapter/src/index.mjs";
import { projectionHash, canonicalJson } from "../../ms-map-adapter/src/hash.mjs";
import { cameraForViewport } from "./camera.mjs";
import { createStaticFieldState } from "./field-state.mjs";
import { createPlayerWorldItem, playerSortKey } from "./player-node.mjs";

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function childSortKey(node) {
  const provenance = node.data?.provenance;
  if (provenance && Number.isFinite(provenance.sortKey)) return provenance.sortKey;
  const interval = node.data?.depthInterval;
  if (interval && Number.isFinite(interval.min)) return interval.min;
  return Number.POSITIVE_INFINITY;
}

function renumberStackRanks(children) {
  return children.map((child, index) => Object.freeze({
    ...child,
    attrs: Object.freeze({
      ...child.attrs,
      "stack-rank": String(index + 1),
    }),
    children: child.children,
  }));
}

function insertPlayerChildren(children, player) {
  const key = playerSortKey(player);
  let insertAt = children.findIndex((child) => key < childSortKey(child));
  if (insertAt < 0) insertAt = children.length;
  const playerNode = createPlayerWorldItem(player, { stackRank: insertAt + 1 });
  const next = [...children];
  next.splice(insertAt, 0, playerNode);
  return renumberStackRanks(next);
}

export function stackRankOrder(children) {
  return [...children]
    .map((child, index) => ({
      key: child.key,
      rank: Number(child.attrs?.["stack-rank"]),
      index,
    }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.key);
}

/**
 * @param {object} [options]
 */
export async function buildFieldProjection(options = {}) {
  const fieldState = options.fieldState
    ?? createStaticFieldState({ mapId: options.mapId, player: options.player });
  const map = await buildMapProjection({
    mapId: fieldState.mapId,
    gameRoot: options.gameRoot,
    fsdbRoot: options.fsdbRoot,
    budget: options.budget,
    cameraX: 0,
    cameraY: 0,
  });

  let children = map.projection.root.children;
  const cap = options.paintUnitCap;
  if (Number.isFinite(cap) && cap > 0) {
    children = children.slice(0, cap);
  }

  const viewport = options.viewport ?? null;
  const explicitCamera = Number.isFinite(options.cameraX) && Number.isFinite(options.cameraY);
  const cam = explicitCamera
    ? { cameraX: options.cameraX, cameraY: options.cameraY }
    : cameraForViewport(fieldState.player, viewport, map.scene.bounds);

  children = insertPlayerChildren(children, fieldState.player);

  const root = Object.freeze({
    ...map.projection.root,
    attrs: Object.freeze({
      "camera-x": decimalAttr(cam.cameraX),
      "camera-y": decimalAttr(cam.cameraY),
      visible: "true",
    }),
    data: map.projection.root.data,
    children: Object.freeze(children),
  });

  const hashInput = Object.freeze({
    mapProjectionHash: map.projection.hash,
    fieldState,
    camera: cam,
    paintUnitCap: cap ?? null,
    childKeys: children.map((child) => child.key),
    stackRanks: children.map((child) => child.attrs["stack-rank"]),
  });

  return Object.freeze({
    fieldState,
    map,
    camera: cam,
    root,
    hash: projectionHash(hashInput),
    hashInput,
    canonical: canonicalJson(hashInput),
  });
}
import { SPIKE_MARKER_TAG } from "./limits.mjs";

export const SPIKE_BACK_VERSION = `sha256:${"11".repeat(32)}`;
export const SPIKE_FRONT_VERSION = `sha256:${"22".repeat(32)}`;

function resource(key, contentVersion) {
  return { namespace: "spike", key, contentVersion };
}

function batchNode({
  key,
  batchId,
  rank,
  bounds,
  contentVersion,
  resourceKey,
  placementId,
  depth,
  tieOrder,
}) {
  return {
    key,
    tag: "ms-map-batch",
    attrs: { "stack-rank": rank, visible: "true" },
    data: {
      batchId,
      bounds,
      sprites: {
        pages: {
          p0: { resource: resource(resourceKey, contentVersion), width: bounds.w, height: bounds.h },
        },
        items: {
          tile0: { page: "p0", source: { x: 0, y: 0, w: bounds.w, h: bounds.h }, origin: [0, 0] },
        },
      },
      placements: [{
        placementId,
        kind: "tile",
        sprite: "tile0",
        x: bounds.x,
        y: bounds.y,
        flip: false,
        opacity: 255,
        order: { depth, tieOrder },
      }],
    },
    children: [],
  };
}

function markerNode({ key, markerId, color, localX = 0, localY = -16 }) {
  return {
    key,
    tag: SPIKE_MARKER_TAG,
    attrs: {},
    data: {
      markerId,
      width: 16,
      height: 16,
      color,
      localX,
      localY,
    },
    children: [],
  };
}

function worldNode({ key, rank, worldX, worldY, actorVisualId, marker }) {
  return {
    key,
    tag: "ms-world-item",
    attrs: {
      "world-x": worldX,
      "world-y": worldY,
      "stack-rank": rank,
      visible: "true",
    },
    data: { actorVisualId, anchor: "feet" },
    children: [marker],
  };
}

export function createSpikeTree({
  backVersion = SPIKE_BACK_VERSION,
  frontVersion = SPIKE_FRONT_VERSION,
  cameraX = "0",
  cameraY = "0",
  worldX = "8",
  worldY = "24",
} = {}) {
  return {
    key: "scene:spike",
    tag: "ms-scene-view",
    attrs: { "camera-x": cameraX, "camera-y": cameraY, visible: "true" },
    data: { mapId: "900000001", pixelSnap: "round" },
    children: [
      batchNode({
        key: "batch:back",
        batchId: "back",
        rank: "10",
        bounds: { x: 0, y: 0, w: 32, h: 32 },
        contentVersion: backVersion,
        resourceKey: "pixels/back.png",
        placementId: "tile:back",
        depth: 100,
        tieOrder: 0,
      }),
      worldNode({
        key: "actor-host:spike",
        rank: "20",
        worldX,
        worldY,
        actorVisualId: "spike-player",
        marker: markerNode({
          key: "marker:spike-player",
          markerId: "spike-player",
          color: { r: 0, g: 255, b: 0, a: 255 },
        }),
      }),
      batchNode({
        key: "batch:front",
        batchId: "front",
        rank: "30",
        bounds: { x: 16, y: 16, w: 32, h: 32 },
        contentVersion: frontVersion,
        resourceKey: "pixels/front.png",
        placementId: "tile:front",
        depth: 300,
        tieOrder: 0,
      }),
    ],
  };
}

export function createIdentityTree() {
  const markerA = markerNode({
    key: "marker:a",
    markerId: "a",
    color: { r: 0, g: 255, b: 0, a: 255 },
    localX: 0,
    localY: 0,
  });
  const markerB = markerNode({
    key: "marker:b",
    markerId: "b",
    color: { r: 255, g: 255, b: 0, a: 255 },
    localX: 0,
    localY: 0,
  });
  return {
    key: "scene:spike",
    tag: "ms-scene-view",
    attrs: { "camera-x": "0", "camera-y": "0", visible: "true" },
    data: { mapId: "900000001", pixelSnap: "round" },
    children: [
      batchNode({
        key: "batch:back",
        batchId: "back",
        rank: "10",
        bounds: { x: 0, y: 0, w: 32, h: 32 },
        contentVersion: SPIKE_BACK_VERSION,
        resourceKey: "pixels/back.png",
        placementId: "tile:back",
        depth: 100,
        tieOrder: 0,
      }),
      worldNode({
        key: "actor-host:a",
        rank: "20",
        worldX: "0",
        worldY: "0",
        actorVisualId: "actor-a",
        marker: markerA,
      }),
      worldNode({
        key: "actor-host:b",
        rank: "21",
        worldX: "40",
        worldY: "0",
        actorVisualId: "actor-b",
        marker: markerB,
      }),
      batchNode({
        key: "batch:front",
        batchId: "front",
        rank: "30",
        bounds: { x: 16, y: 16, w: 32, h: 32 },
        contentVersion: SPIKE_FRONT_VERSION,
        resourceKey: "pixels/front.png",
        placementId: "tile:front",
        depth: 300,
        tieOrder: 0,
      }),
    ],
  };
}

export function cloneTree(value) {
  return JSON.parse(JSON.stringify(value));
}

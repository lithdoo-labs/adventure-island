/**
 * Compose a transient internal paint plan from ms-avatar render-ready data.
 * Not wire ABI — used only inside the Renderer.
 */
import { frameHolds } from "../../cms-actor/src/avatar-model.mjs";

function resolveSprite(spriteId, sprites) {
  const item = sprites.items[spriteId];
  if (!item) return null;
  const page = sprites.pages[item.page];
  if (!page) return null;
  return { item, page };
}

function clipLayerToPaintLayer(layer, sprites) {
  const resolved = resolveSprite(layer.sprite, sprites);
  if (!resolved) return null;
  const { item, page } = resolved;
  return {
    id: layer.id,
    z: layer.z,
    width: item.source.w,
    height: item.source.h,
    origin: [...layer.origin],
    resource: { ...page.resource },
    ...(item.source.x !== 0 || item.source.y !== 0 || item.source.w !== page.width || item.source.h !== page.height
      ? { source: { ...item.source } }
      : {}),
    ...(layer.anchors ? { anchors: { ...layer.anchors } } : {}),
    ...(Number.isInteger(layer.priority) ? { priority: layer.priority, tag: [...layer.tag] } : {}),
  };
}

function clipFrameToPaintFrame(frame, sprites) {
  const layers = [];
  for (const layer of frame.layers) {
    const painted = clipLayerToPaintLayer(layer, sprites);
    if (painted) layers.push(painted);
  }
  const delay = frame.durationMs > 0 ? frame.durationMs : undefined;
  return {
    ...(delay !== undefined ? { delay } : {}),
    ...(frame.move ? { move: [...frame.move] } : {}),
    ...(frame.rotate ? { rotate: frame.rotate } : {}),
    ...(frame.flip ? { flip: true } : {}),
    ...(frame.showFace === false ? { showFace: false } : {}),
    layers,
  };
}

function playbackToLoop(playback) {
  return playback?.mode === "loop";
}

/**
 * @param {object} parentData validated ms-avatar data
 * @param {Record<string, object>} clips action name → validated clip
 */
export function composeInternalPaintPlan(parentData, clips) {
  const actions = {};
  for (const [name, clip] of Object.entries(clips)) {
    actions[name] = {
      loop: playbackToLoop(clip.playback),
      frames: clip.frames.map((frame) => clipFrameToPaintFrame(frame, parentData.sprites)),
    };
  }
  let expression = null;
  for (const [name, expressionDef] of Object.entries(parentData.expressions ?? {})) {
    expression = {
      name,
      frames: expressionDef.frames.map((frame) => clipFrameToPaintFrame({ ...frame, showFace: true }, parentData.sprites)),
    };
    break;
  }
  return {
    formatVersion: 1,
    zOrder: [...parentData.appearance.zOrder],
    actions,
    ...(expression ? { expression } : {}),
  };
}

export function frameDurationFromClip(frame) {
  if (frameHolds(frame)) return 0;
  return frame.delay ?? 0;
}

/** Body sheets face left. Mirror when facing right; a frame flip XOR-inverts that. */
export function shouldMirrorAvatar(facing, frameFlip = false) {
  return (facing === "right") !== Boolean(frameFlip);
}

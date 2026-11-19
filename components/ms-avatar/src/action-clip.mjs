import { AVATAR_RENDER_LIMITS } from "./limits.mjs";

const ROTATIONS = new Set([0, 90, 180, 270]);

function isFinitePair(value) {
  return Array.isArray(value)
    && value.length === 2
    && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

function invalid(message) {
  throw new TypeError(`Invalid Action Clip: ${message}`);
}

export function validateActionClip(clip, label = "clip") {
  if (!clip || typeof clip !== "object" || Array.isArray(clip)) invalid(`${label} must be an object`);
  const playback = clip.playback;
  if (!playback || typeof playback !== "object" || Array.isArray(playback)) invalid(`${label}.playback is required`);
  const mode = playback.mode;
  if (mode !== "loop" && mode !== "hold" && mode !== "suffix-loop") invalid(`${label}.playback.mode is invalid`);
  if (mode === "suffix-loop") {
    const repeatFrom = playback.repeatFrom;
    if (!Number.isInteger(repeatFrom) || repeatFrom < 1) invalid(`${label}.playback.repeatFrom must be a positive integer`);
  } else if (playback.repeatFrom !== undefined) invalid(`${label}.playback.repeatFrom is only allowed for suffix-loop`);
  if (!Array.isArray(clip.frames) || clip.frames.length === 0) invalid(`${label}.frames must be non-empty`);
  if (clip.frames.length > AVATAR_RENDER_LIMITS.maxFramesPerClip) invalid(`${label}.frames exceeds frame budget`);
  if (mode === "suffix-loop" && playback.repeatFrom >= clip.frames.length) {
    invalid(`${label}.playback.repeatFrom must name a non-first frame inside the clip`);
  }
  for (const [index, frame] of clip.frames.entries()) {
    const frameLabel = `${label}.frames[${index}]`;
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) invalid(`${frameLabel} must be an object`);
    if (!Number.isInteger(frame.durationMs) || frame.durationMs < 0) invalid(`${frameLabel}.durationMs must be a non-negative integer`);
    if (frame.move !== undefined) {
      if (!isFinitePair(frame.move)) invalid(`${frameLabel}.move must be a finite pair`);
    }
    if (frame.rotate !== undefined && !ROTATIONS.has(frame.rotate)) invalid(`${frameLabel}.rotate must be 0, 90, 180 or 270`);
    if (frame.flip !== undefined && typeof frame.flip !== "boolean") invalid(`${frameLabel}.flip must be boolean`);
    if (frame.showFace !== undefined && typeof frame.showFace !== "boolean") invalid(`${frameLabel}.showFace must be boolean`);
    if (!Array.isArray(frame.layers)) invalid(`${frameLabel}.layers must be an array`);
    if (frame.layers.length > AVATAR_RENDER_LIMITS.maxLayersPerFrame) invalid(`${frameLabel}.layers exceeds layer budget`);
    const ids = new Set();
    for (const [layerIndex, layer] of frame.layers.entries()) {
      const layerLabel = `${frameLabel}.layers[${layerIndex}]`;
      if (!layer || typeof layer !== "object" || Array.isArray(layer)) invalid(`${layerLabel} must be an object`);
      if (typeof layer.id !== "string" || layer.id.length === 0) invalid(`${layerLabel}.id must be non-empty`);
      if (ids.has(layer.id)) invalid(`${frameLabel} layer ids must be unique`);
      ids.add(layer.id);
      if (typeof layer.sprite !== "string" || layer.sprite.length === 0) invalid(`${layerLabel}.sprite must be non-empty`);
      if (typeof layer.z !== "string" || layer.z.length === 0) invalid(`${layerLabel}.z must be non-empty`);
      if (!isFinitePair(layer.origin)) invalid(`${layerLabel}.origin must be a finite pair`);
      if (layer.anchors !== undefined) {
        if (!layer.anchors || typeof layer.anchors !== "object" || Array.isArray(layer.anchors)) {
          invalid(`${layerLabel}.anchors must be an object`);
        }
        for (const [anchorName, point] of Object.entries(layer.anchors)) {
          if (anchorName.length === 0) invalid(`${layerLabel}.anchors keys must be non-empty`);
          if (!isFinitePair(point)) invalid(`${layerLabel}.anchors.${anchorName} must be a finite pair`);
        }
      }
      const hasPriority = layer.priority !== undefined;
      const hasTag = layer.tag !== undefined;
      if (hasPriority !== hasTag) invalid(`${layerLabel}.priority and tag must appear together`);
      if (hasPriority) {
        if (!Number.isInteger(layer.priority)) invalid(`${layerLabel}.priority must be an integer`);
        if (!Array.isArray(layer.tag) || layer.tag.length === 0) invalid(`${layerLabel}.tag must be a non-empty array`);
      }
    }
  }
  return clip;
}

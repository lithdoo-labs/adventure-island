import { seekClipPresentation } from "./presentation-timing.mjs";

const PRESENTATION_ATTRS = Object.freeze([
  "action",
  "facing",
  "expression",
  "one-shot-enabled",
  "frame-index",
  "elapsed-ms",
]);

/**
 * @param {object} clip
 * @param {number} elapsedMs
 */
export function presentationTimingAttrs(clip, elapsedMs) {
  const timing = seekClipPresentation(clip, elapsedMs);
  return Object.freeze({
    "frame-index": String(timing.frameIndex),
    "elapsed-ms": String(Math.max(0, Math.floor(elapsedMs))),
  });
}

export function isPresentationAttrName(name) {
  return PRESENTATION_ATTRS.includes(name);
}

export { PRESENTATION_ATTRS };
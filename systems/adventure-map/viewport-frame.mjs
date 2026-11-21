/**
 * Screen adaptation shell. The fullscreen component owns the scale; the
 * subsystem lays the Field out at the logical size the component reports.
 */
import {
  DEFAULT_VIEWPORT_RANGE,
  resolveViewportFrame,
  VIEWPORT_RESOLUTION_CHANNEL,
  VIEWPORT_RESOLUTION_EVENT,
} from "../../components/ms-viewport/src/layout.mjs";

export { VIEWPORT_RESOLUTION_CHANNEL };

export const VIEWPORT_FRAME_KEY = "viewport:frame";

export function wrapSceneWithViewportFrame(sceneRoot) {
  if (sceneRoot === null || typeof sceneRoot !== "object" || sceneRoot.tag !== "ms-scene-view") {
    throw new TypeError("viewport frame requires an ms-scene-view scene");
  }
  return Object.freeze({
    key: VIEWPORT_FRAME_KEY,
    tag: "ms-viewport-frame",
    attrs: Object.freeze({}),
    data: Object.freeze({}),
    children: Object.freeze([sceneRoot]),
  });
}

/** Map a raw screen size through the same rule the fullscreen component uses. */
export function logicalViewportFromScreen(screen) {
  if (screen === null || typeof screen !== "object") return null;
  const frame = resolveViewportFrame(screen.width, screen.height, DEFAULT_VIEWPORT_RANGE);
  if (frame === null) return null;
  return Object.freeze({ width: frame.width, height: frame.height });
}

/**
 * Owner-only presentation publication. The renderer wraps the component
 * payload as `{ domainId, targetKey, data }`.
 */
export function logicalViewportFromResolutionEvent(event) {
  if (event === null || typeof event !== "object") return null;
  if (event.channel !== VIEWPORT_RESOLUTION_CHANNEL || event.type !== VIEWPORT_RESOLUTION_EVENT) return null;
  const data = event.payload?.data;
  if (data === null || typeof data !== "object") return null;
  const { width, height } = data;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return null;
  if (width < DEFAULT_VIEWPORT_RANGE.minWidth || width > DEFAULT_VIEWPORT_RANGE.maxWidth) return null;
  if (height < DEFAULT_VIEWPORT_RANGE.minHeight || height > DEFAULT_VIEWPORT_RANGE.maxHeight) return null;
  return Object.freeze({ width, height });
}

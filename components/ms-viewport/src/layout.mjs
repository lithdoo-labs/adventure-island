/** Default logical range: 640×480 through 1280×720. */
export const DEFAULT_VIEWPORT_RANGE = Object.freeze({
  minWidth: 640,
  maxWidth: 1_280,
  minHeight: 480,
  maxHeight: 720,
});

export const VIEWPORT_RESOLUTION_CHANNEL = "viewport.resolution";
export const VIEWPORT_RESOLUTION_EVENT = "viewport.resolution";

const RANGE_ATTRIBUTE_NAMES = Object.freeze(["min-width", "max-width", "min-height", "max-height"]);

function readBound(raw, fallback) {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw !== "string" || !/^[1-9][0-9]*$/u.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

/**
 * Read the four range attributes. An omitted attribute uses the default.
 * A present but illegal attribute, or a minimum above its maximum, returns null.
 */
export function viewportRangeFromAttributes(attributes) {
  const minWidth = readBound(attributes["min-width"], DEFAULT_VIEWPORT_RANGE.minWidth);
  const maxWidth = readBound(attributes["max-width"], DEFAULT_VIEWPORT_RANGE.maxWidth);
  const minHeight = readBound(attributes["min-height"], DEFAULT_VIEWPORT_RANGE.minHeight);
  const maxHeight = readBound(attributes["max-height"], DEFAULT_VIEWPORT_RANGE.maxHeight);
  if (minWidth === null || maxWidth === null || minHeight === null || maxHeight === null) return null;
  if (minWidth > maxWidth || minHeight > maxHeight) return null;
  return { minWidth, maxWidth, minHeight, maxHeight };
}

export function viewportRangeAttributeNames() {
  return RANGE_ATTRIBUTE_NAMES;
}

function integerInside(value, minimum, maximum) {
  const rounded = Math.round(value);
  if (rounded < minimum) return minimum;
  if (rounded > maximum) return maximum;
  return rounded;
}

/**
 * Choose the logical resolution for a screen of `screenWidth` × `screenHeight`.
 *
 * When both screen edges already lie inside the range, render at that screen
 * size. An integer screen keeps scale 1.
 * When either edge is outside the range but the aspect can sit inside it, keep
 * that aspect and use the largest legal logical size, which is the smallest
 * uniform scale.
 * When the aspect is too tall, render at maximum width and minimum height.
 * When the aspect is too wide, render at minimum width and maximum height.
 * The caller stretches those corner sizes to cover the screen.
 */
export function resolveViewportFrame(screenWidth, screenHeight, range) {
  if (!Number.isFinite(screenWidth) || !Number.isFinite(screenHeight) || screenWidth <= 0 || screenHeight <= 0) {
    return null;
  }
  if (screenWidth >= range.minWidth && screenWidth <= range.maxWidth
    && screenHeight >= range.minHeight && screenHeight <= range.maxHeight) {
    const width = integerInside(screenWidth, range.minWidth, range.maxWidth);
    const height = integerInside(screenHeight, range.minHeight, range.maxHeight);
    return Object.freeze({
      mode: "uniform",
      width,
      height,
      scaleX: screenWidth / width,
      scaleY: screenHeight / height,
    });
  }
  const aspect = screenWidth / screenHeight;
  const minAspect = range.minWidth / range.maxHeight;
  const maxAspect = range.maxWidth / range.minHeight;
  if (aspect >= minAspect && aspect <= maxAspect) {
    const low = Math.max(range.minWidth, range.minHeight * aspect);
    const high = Math.min(range.maxWidth, range.maxHeight * aspect);
    const minInt = Math.ceil(low - 1e-9);
    let width = Math.min(range.maxWidth, Math.floor(high + 1e-9));
    if (width < minInt) width = minInt;
    let height = Math.round(width / aspect);
    while (width >= minInt && (height < range.minHeight || height > range.maxHeight || width > range.maxWidth)) {
      width -= 1;
      height = Math.round(width / aspect);
    }
    if (width < range.minWidth || width > range.maxWidth || height < range.minHeight || height > range.maxHeight) {
      return null;
    }
    const scale = screenWidth / width;
    return Object.freeze({
      mode: "uniform",
      width,
      height,
      scaleX: scale,
      scaleY: scale,
    });
  }
  if (aspect < minAspect) {
    return Object.freeze({
      mode: "cover",
      width: range.maxWidth,
      height: range.minHeight,
      scaleX: screenWidth / range.maxWidth,
      scaleY: screenHeight / range.minHeight,
    });
  }
  return Object.freeze({
    mode: "cover",
    width: range.minWidth,
    height: range.maxHeight,
    scaleX: screenWidth / range.minWidth,
    scaleY: screenHeight / range.maxHeight,
  });
}

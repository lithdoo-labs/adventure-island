/**
 * M7.6 bounded viewport relayout envelope — experimental slice only.
 * Sizes outside this box fail closed; they are not an approved adaptive ABI.
 */
export const VIEWPORT_RELAYOUT_ENVELOPE = Object.freeze({
  minWidth: 800,
  maxWidth: 1_000,
  minHeight: 600,
  maxHeight: 700,
});

export const CANONICAL_VIEWPORT_SMALL = Object.freeze({ width: 800, height: 600 });
export const CANONICAL_VIEWPORT_LARGE = Object.freeze({ width: 1_000, height: 700 });

export function viewportRelayoutEnvelopeMessage(viewport) {
  if (viewport === null || typeof viewport !== "object") {
    return "viewport is required for relayout projection";
  }
  const { width, height } = viewport;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "viewport width and height must be finite and positive";
  }
  const { minWidth, maxWidth, minHeight, maxHeight } = VIEWPORT_RELAYOUT_ENVELOPE;
  if (width < minWidth || width > maxWidth || height < minHeight || height > maxHeight) {
    return `viewport ${width}x${height} is outside the M7.6 relayout envelope (${minWidth}..${maxWidth} x ${minHeight}..${maxHeight})`;
  }
  return null;
}

export function assertViewportRelayoutEnvelope(viewport) {
  const message = viewportRelayoutEnvelopeMessage(viewport);
  if (message !== null) throw new RangeError(message);
}
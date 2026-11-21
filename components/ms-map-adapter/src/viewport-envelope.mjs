/**
 * Logical relayout range used by ms-viewport-frame.
 * The component maps the raw screen into this box; sizes outside it fail closed.
 */
export const VIEWPORT_RELAYOUT_ENVELOPE = Object.freeze({
  minWidth: 640,
  maxWidth: 1_280,
  minHeight: 480,
  maxHeight: 720,
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
    return `viewport ${width}x${height} is outside the viewport frame range (${minWidth}..${maxWidth} x ${minHeight}..${maxHeight})`;
  }
  return null;
}

export function assertViewportRelayoutEnvelope(viewport) {
  const message = viewportRelayoutEnvelopeMessage(viewport);
  if (message !== null) throw new RangeError(message);
}
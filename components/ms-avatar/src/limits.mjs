/** M4 ms-avatar / ms-action finite budgets (measured on canonical CMS079 closure). */
/** Renderer-only budgets; tag constants live in ms-field/limits.mjs for Field trees. */
export const AVATAR_RENDER_LIMITS = Object.freeze({
  maxParentDataBytes: 262_144,
  maxActionDataBytes: 262_144,
  maxActionChildren: 32,
  maxFramesPerClip: 128,
  maxLayersPerFrame: 32,
  maxSpriteItems: 4096,
  maxSpritePages: 512,
  maxIdentifierLength: 256,
  maxPageWidth: 8_192,
  maxPageHeight: 8_192,
  maxPagePixels: 16_777_216,
  maxExpressionFrames: 128,
  maxConcurrentDecodes: 8,
  maxDecodeCacheEntries: 64,
  maxDevicePixelRatio: 8,
  maxDeviceWidth: 8_192,
  maxDeviceHeight: 8_192,
  maxDevicePixels: 3_145_728,
});

/**
 * Seek body presentation timing from accumulated elapsed milliseconds.
 * Shared by Field Subsystem projection and ms-avatar attr consumption.
 */

function frameDurationMs(frame) {
  if (!frame || !Number.isInteger(frame.durationMs)) return 0;
  return frame.durationMs < 0 ? 0 : frame.durationMs;
}

function rangeDuration(frames, from = 0) {
  let total = 0;
  for (let index = from; index < frames.length; index += 1) {
    total += frameDurationMs(frames[index]);
  }
  return total;
}

/**
 * @param {object} clip validated action clip
 * @param {number} elapsedMs non-negative accumulated time for the active action
 * @returns {{ frameIndex: number, elapsedWithinFrame: number }}
 */
export function seekClipPresentation(clip, elapsedMs) {
  const frames = clip?.frames ?? [];
  if (frames.length === 0) return { frameIndex: 0, elapsedWithinFrame: 0 };
  const safeElapsed = Number.isFinite(elapsedMs) && elapsedMs >= 0 ? Math.floor(elapsedMs) : 0;
  const total = rangeDuration(frames);
  const mode = clip?.playback?.mode ?? "hold";
  let cursor = safeElapsed;
  if (mode === "loop" && total > 0) cursor %= total;
  if (mode === "suffix-loop" && total > 0 && cursor >= total) {
    const repeatFrom = clip.playback.repeatFrom;
    const prefix = rangeDuration(frames.slice(0, repeatFrom));
    const suffix = rangeDuration(frames, repeatFrom);
    cursor = suffix > 0 ? prefix + ((cursor - prefix) % suffix) : total;
  }
  if (mode === "hold" && total > 0 && cursor >= total) {
    return { frameIndex: frames.length - 1, elapsedWithinFrame: 0 };
  }
  for (let index = 0; index < frames.length; index += 1) {
    const duration = frameDurationMs(frames[index]);
    if (duration === 0) continue;
    if (cursor < duration) return { frameIndex: index, elapsedWithinFrame: cursor };
    cursor -= duration;
  }
  const last = frames.length - 1;
  return { frameIndex: last, elapsedWithinFrame: 0 };
}

/** Milliseconds until the next visible frame boundary, or null for a hold. */
export function nextClipBoundaryMs(clip, elapsedMs) {
  const frames = clip?.frames ?? [];
  if (frames.length === 0) return null;
  const timing = seekClipPresentation(clip, elapsedMs);
  const duration = frameDurationMs(frames[timing.frameIndex]);
  if (duration === 0) return null;
  if (clip?.playback?.mode === "hold" && timing.frameIndex === frames.length - 1
    && elapsedMs >= rangeDuration(frames)) return null;
  return Math.max(1, duration - timing.elapsedWithinFrame);
}

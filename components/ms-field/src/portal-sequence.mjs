/**
 * Hidden portal (type 10/11) clip choice.
 * Approaching plays portalStart once, then portalContinue loops.
 * Leaving plays portalExit once and then hides. An in-flight Start is not reversed.
 */

export function hiddenPortalClipForDesire(clip, desired) {
  if (desired) {
    if (clip === "portalStart" || clip === "portalContinue") return clip;
    return "portalStart";
  }
  if (clip === "portalStart" || clip === "portalContinue") return "portalExit";
  return clip === "portalExit" ? "portalExit" : "hidden";
}

export function hiddenPortalClipAfterFinish(clip, desired) {
  if (clip === "portalStart") return desired ? "portalContinue" : "portalExit";
  if (clip === "portalExit") return "hidden";
  return clip;
}

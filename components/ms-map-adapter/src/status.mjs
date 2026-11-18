/** Content presence / closure status codes for M2 validator. */
export const SOURCE_PRESENT = "SOURCE-PRESENT";
export const SOURCE_EMPTY = "SOURCE-EMPTY";
export const SOURCE_ABSENT = "SOURCE-ABSENT";
export const RESOURCE_MISSING = "RESOURCE-MISSING";
export const UNSUPPORTED = "UNSUPPORTED";
export const NO_VISUAL_PORTAL = "NO-VISUAL-PORTAL";
export const VISUAL_PORTAL = "VISUAL-PORTAL";

export const GROUP_NAMES = Object.freeze([
  "back",
  "tile",
  "obj",
  "foothold",
  "portal",
  "rope",
  "seat",
]);

/** CMS079-PROVEN portal artwork branches (MAP-PORTAL-REVERSE). */
export const PORTAL_VISUAL_BY_PT = Object.freeze({
  2: "pv",
  4: "pv",
  7: "pv",
  10: "ph",
  11: "psh",
});

export function portalVisualName(pt) {
  return PORTAL_VISUAL_BY_PT[pt] ?? null;
}

export function diagnose(code, message, extra = {}) {
  return Object.freeze({ code, message, ...extra });
}

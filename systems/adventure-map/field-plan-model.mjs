/**
 * Browser-safe validation for the derived bootstrap AdventureFieldPlan record.
 */

export const FIELD_PLAN_NAMESPACE = "struct.AdventureFieldPlan";
export const FIELD_PLAN_KEY = "bootstrap";

export function validateFieldPlan(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("AdventureFieldPlan must be a plain object");
  }
  if (typeof value.mapId !== "string" || value.mapId.length === 0) {
    throw new TypeError("AdventureFieldPlan.mapId must be a non-empty string");
  }
  if (typeof value.hash !== "string" || !value.hash.startsWith("sha256:")) {
    throw new TypeError("AdventureFieldPlan.hash must be a sha256 content stamp");
  }
  if (typeof value.mapProjectionHash !== "string" || !value.mapProjectionHash.startsWith("sha256:")) {
    throw new TypeError("AdventureFieldPlan.mapProjectionHash must be a sha256 content stamp");
  }
  const bounds = value.effectiveBounds;
  if (bounds === null || typeof bounds !== "object") {
    throw new TypeError("AdventureFieldPlan.effectiveBounds must be an object");
  }
  for (const edge of ["left", "right", "top", "bottom"]) {
    if (!Number.isFinite(bounds[edge])) {
      throw new TypeError(`AdventureFieldPlan.effectiveBounds.${edge} must be finite`);
    }
  }
  const root = value.root;
  if (root === null || typeof root !== "object" || typeof root.key !== "string" || root.tag !== "ms-scene-view") {
    throw new TypeError("AdventureFieldPlan.root must be an ms-scene-view RenderNode");
  }
  if (!Array.isArray(root.children) || root.children.length === 0) {
    throw new TypeError("AdventureFieldPlan.root must carry Paint Unit children");
  }
  const fieldState = value.fieldState;
  if (fieldState === null || typeof fieldState !== "object" || fieldState.mapId !== value.mapId) {
    throw new TypeError("AdventureFieldPlan.fieldState must describe the same mapId");
  }
  const player = fieldState.player;
  if (player === null || typeof player !== "object" || !Number.isFinite(player.worldX) || !Number.isFinite(player.worldY)) {
    throw new TypeError("AdventureFieldPlan.fieldState.player must carry world coordinates");
  }
  return Object.freeze(value);
}
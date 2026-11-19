/**
 * Derive the bootstrap AdventureFieldPlan record for map 222000000 at bundle
 * build time (Node-only FSDB projection — never checked into the PWA worker).
 */
import { fileURLToPath } from "node:url";
import { projectAdventureMapFieldScene } from "../../systems/adventure-map/field-static-projection.mjs";
import {
  FIELD_PLAN_KEY,
  FIELD_PLAN_NAMESPACE,
  validateFieldPlan,
} from "../../systems/adventure-map/field-plan-model.mjs";

const canonicalRepoRoot = fileURLToPath(new URL("../../", import.meta.url));
const RECORD_MIME = "application/json; charset=utf-8";
export const FIELD_PLAN_DEFAULT_VIEWPORT = Object.freeze({ width: 800, height: 600 });

export { FIELD_PLAN_KEY, FIELD_PLAN_NAMESPACE };

/**
 * @returns {Promise<{
 *   entries: ReadonlyArray<{kind: string, namespace: string, key: string, mime: string, bytes: Buffer}>,
 *   plan: object,
 *   sources: ReadonlyArray<string>,
 * }>}
 */
export async function buildCanonicalAdventureFieldPlanContent({
  gameRoot = canonicalRepoRoot,
  repoRoot = canonicalRepoRoot,
  viewport = FIELD_PLAN_DEFAULT_VIEWPORT,
  mapId,
} = {}) {
  const projection = await projectAdventureMapFieldScene({
    gameRoot: repoRoot,
    viewport,
    mapId,
  });
  const effectiveBounds = projection.map?.scene?.bounds?.effectiveBounds
    ?? projection.root?.data?.bounds?.effectiveBounds;
  if (effectiveBounds === undefined || effectiveBounds === null) {
    throw new TypeError("map projection did not yield effectiveBounds for the bootstrap FieldPlan");
  }
  const plan = validateFieldPlan(Object.freeze({
    mapId: projection.fieldState.mapId,
    hash: projection.hash,
    mapProjectionHash: projection.map.projection.hash,
    effectiveBounds,
    fieldState: projection.fieldState,
    root: projection.root,
  }));
  const bytes = Buffer.from(JSON.stringify(plan), "utf8");
  return Object.freeze({
    entries: Object.freeze([Object.freeze({
      kind: "record",
      namespace: FIELD_PLAN_NAMESPACE,
      key: FIELD_PLAN_KEY,
      mime: RECORD_MIME,
      bytes,
    })]),
    plan,
    sources: Object.freeze([]),
  });
}
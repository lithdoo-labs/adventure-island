/**
 * M2 map content closure + pure Adapter/Projection pipeline.
 *
 * FSDB → MapFacts → ResolvedMapScene → OrderedDrawable[] → PaintUnitPlan[] → RenderNode candidate
 *
 * Pure data only: no DOM, Canvas, or WebProjector.
 */
import { planPaintUnits } from "./batch-planner.mjs";
import { readMapFacts } from "./fsdb-reader.mjs";
import { orderDrawables, assertStrictlyIncreasingOrder } from "./order.mjs";
import { projectRenderTree } from "./project.mjs";
import { resolveMapScene } from "./resolve.mjs";
import { validateContentClosure } from "./validate.mjs";

export {
  readMapFacts,
  resolveMapScene,
  orderDrawables,
  planPaintUnits,
  projectRenderTree,
  validateContentClosure,
  assertStrictlyIncreasingOrder,
};

export {
  tileSortKey,
  objSortKey,
  avatarSortKey,
  backSortKey,
  portalVisualSortKey,
  compareDrawOrder,
  DEPTH_BASE,
} from "./depth.mjs";

export {
  SOURCE_PRESENT,
  SOURCE_EMPTY,
  SOURCE_ABSENT,
  RESOURCE_MISSING,
  NO_VISUAL_PORTAL,
  VISUAL_PORTAL,
  UNSUPPORTED,
  portalVisualName,
} from "./status.mjs";

export { projectionHash, contentVersionOf, canonicalJson } from "./hash.mjs";
export { DEFAULT_BUDGET } from "./batch-planner.mjs";

/**
 * End-to-end pure projection for one mapId.
 */
export async function buildMapProjection({
  mapId,
  fsdbRoot,
  gameRoot,
  budget,
  cameraX = 0,
  cameraY = 0,
  viewport,
} = {}) {
  const facts = await readMapFacts({ mapId, fsdbRoot, gameRoot });
  const scene = resolveMapScene(facts);
  const ordered = orderDrawables(scene);
  assertStrictlyIncreasingOrder(ordered);
  const paintUnits = planPaintUnits(ordered, scene, budget);
  const projection = projectRenderTree(scene, paintUnits, { cameraX, cameraY, viewport });
  const closure = validateContentClosure(scene);
  return Object.freeze({
    facts,
    scene,
    ordered,
    paintUnits,
    projection,
    closure,
  });
}

/**
 * M3 bridge: static Field RenderNode for adventure-map (live FSDB projection).
 * Bundle build publishes `struct.AdventureFieldPlan/bootstrap`; browser
 * executables consume that record through `field-scene-runtime.mjs`.
 */
import { buildFieldProjection } from "../../components/ms-field/src/field-project.mjs";
import { createStaticFieldState, FIELD_MAP_222000000 } from "../../components/ms-field/src/field-state.mjs";

export { FIELD_MAP_222000000, createStaticFieldState };

/**
 * @param {{
 *   gameRoot: string,
 *   viewport: { width: number, height: number },
 *   mapId?: string,
 *   fieldState?: object,
 * }} input
 */
export async function projectAdventureMapFieldScene(input) {
  const { viewport } = input;
  if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
    throw new TypeError("viewport width and height are required");
  }
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new TypeError("viewport width and height must be positive");
  }
  return buildFieldProjection({
    gameRoot: input.gameRoot,
    mapId: input.mapId ?? FIELD_MAP_222000000,
    viewport,
    fieldState: input.fieldState ?? createStaticFieldState({ mapId: input.mapId }),
  });
}
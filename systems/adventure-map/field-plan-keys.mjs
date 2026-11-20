import { FIELD_MAP_222000000 } from "../../components/ms-field/src/field-state.mjs";
import { FIELD_PLAN_KEY, FIELD_PLAN_NAMESPACE } from "./field-plan-model.mjs";

export { FIELD_PLAN_NAMESPACE, FIELD_PLAN_KEY };

const MAP_ID_PATTERN = /^\d{6,12}$/u;

export function assertPublishableMapId(mapId, label = "mapId") {
  if (typeof mapId !== "string" || !MAP_ID_PATTERN.test(mapId)) {
    throw new TypeError(`${label} must be a numeric map id string`);
  }
}

/** Bootstrap record remains map 222000000 for compatibility. */
export function fieldPlanContentKey(mapId) {
  assertPublishableMapId(mapId);
  if (mapId === FIELD_MAP_222000000) {
    return FIELD_PLAN_KEY;
  }
  return `map${mapId}`;
}

export function fieldPlanRecordKeyForMap(mapId) {
  return fieldPlanContentKey(mapId);
}

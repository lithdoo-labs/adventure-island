/**
 * FSDB-derived map environment facts carried on AdventureFieldPlan (M7.1).
 */

export const MAP_ENVIRONMENT_NAMESPACE = "struct.map.Map";
export const mapEnvironmentRecordKey = (mapId) => `map.${mapId}`;
const MAP_ID_PATTERN = /^\d{9}$/u;

export function validateMapEnvironment(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("mapEnvironment must be an object");
  }
  if (value.formatVersion !== 1) throw new TypeError("mapEnvironment.formatVersion must be 1");
  if (typeof value.mapId !== "string" || !MAP_ID_PATTERN.test(value.mapId)) {
    throw new TypeError("mapEnvironment.mapId must be a canonical nine-digit map id");
  }
  if (value.swim !== 0 && value.swim !== 1) {
    throw new TypeError("mapEnvironment.swim must be 0 or 1");
  }
  if (value.fieldLimit !== undefined && !Number.isSafeInteger(value.fieldLimit)) {
    throw new TypeError("mapEnvironment.fieldLimit must be a safe integer");
  }
  const source = value.source;
  if (source === null || typeof source !== "object"
    || source.namespace !== MAP_ENVIRONMENT_NAMESPACE
    || source.key !== mapEnvironmentRecordKey(value.mapId)
    || typeof source.contentVersion !== "string"
    || !/^sha256:[0-9a-f]{64}$/u.test(source.contentVersion)) {
    throw new TypeError("mapEnvironment.source must identify the map FSDB record");
  }
  return Object.freeze({
    ...value,
    source: Object.freeze({ ...source }),
  });
}

/** @param {object | null | undefined} mapEnvironment */
export function mapEnvironmentIsSwim(mapEnvironment) {
  return mapEnvironment?.swim === 1;
}

/** Browser-safe validation for the FSDB-derived M5 movement constants. */

export const MOVEMENT_CONFIG_NAMESPACE = "struct.physics.Default";
export const MOVEMENT_CONFIG_KEY = "physics.default";

export function validateMovementConfig(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("movementConfig must be an object");
  }
  if (value.formatVersion !== 1) throw new TypeError("movementConfig.formatVersion must be 1");
  const source = value.source;
  if (source === null || typeof source !== "object"
    || source.namespace !== MOVEMENT_CONFIG_NAMESPACE
    || source.key !== MOVEMENT_CONFIG_KEY
    || typeof source.contentVersion !== "string"
    || !/^sha256:[0-9a-f]{64}$/u.test(source.contentVersion)) {
    throw new TypeError("movementConfig.source must identify the physics FSDB record");
  }
  for (const key of ["walkSpeed", "gravityAcc", "fallSpeed", "jumpSpeed"]) {
    if (!Number.isFinite(value[key]) || value[key] <= 0 || value[key] > 1_000_000) {
      throw new TypeError(`movementConfig.${key} must be a bounded positive number`);
    }
  }
  for (const key of ["swimForce", "swimSpeed", "floatDrag1"]) {
    if (!Number.isFinite(value[key]) || value[key] <= 0 || value[key] > 1_000_000) {
      throw new TypeError(`movementConfig.${key} must be a bounded positive number`);
    }
  }
  if (!Number.isFinite(value.swimSpeedDec) || value.swimSpeedDec <= 0 || value.swimSpeedDec > 1) {
    throw new TypeError("movementConfig.swimSpeedDec must be in (0, 1]");
  }
  for (const key of ["walkForce", "walkDrag", "slipForce", "slipSpeed", "floatDrag2"]) {
    if (value[key] === undefined) continue;
    if (!Number.isFinite(value[key]) || value[key] <= 0 || value[key] > 1_000_000) {
      throw new TypeError(`movementConfig.${key} must be a bounded positive number`);
    }
  }
  if (value.floatCoefficient !== undefined
    && (!Number.isFinite(value.floatCoefficient) || value.floatCoefficient <= 0 || value.floatCoefficient > 1)) {
    throw new TypeError("movementConfig.floatCoefficient must be in (0, 1]");
  }
  return Object.freeze({
    ...value,
    source: Object.freeze({ ...source }),
  });
}

import { canonicalJson, projectionHash } from "../../components/ms-map-adapter/src/hash.mjs";

/**
 * Stable FieldState fingerprint for replay tests (map-local authority only).
 * @param {object} fieldState
 */
export function hashFieldState(fieldState) {
  return projectionHash(fieldState);
}

export function canonicalFieldState(fieldState) {
  return canonicalJson(fieldState);
}
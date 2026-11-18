import { createHash } from "node:crypto";

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function contentVersionOf(bytes) {
  return `sha256:${sha256Hex(bytes)}`;
}

/** Deterministic JSON for projection hashes — sorted object keys, no whitespace. */
export function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeys(value[key]);
  }
  return out;
}

export function projectionHash(value) {
  return contentVersionOf(Buffer.from(canonicalJson(value), "utf8"));
}

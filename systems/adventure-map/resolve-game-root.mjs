import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Installation root for bundled PWA executables (`subsystems/adventure-map.mjs`)
 * and development sources (`systems/adventure-map/subsystem.mjs`).
 */
export function resolveAdventureGameRoot(moduleUrl = import.meta.url) {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..", "..");
}
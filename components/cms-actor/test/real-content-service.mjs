/**
 * Real-FSDB Content Service harness (local-only, no synthetic stand-ins).
 *
 * Wraps a converted `[FSDB]cms` directory into a prepared LoomRealm game
 * installation and serves it through the pinned platform stack —
 * `prepareHostraGame` (PREPARE) → `prepareDesktopContentView` (trusted
 * Content Index, contentVersion = SHA-256 of every entry) →
 * `createDesktopContentService` (Content HTTP v1) → `createBoundContentClient`
 * (the production ContentClient with record/group/resource).
 *
 * The FSDB is copied into a temporary installation root because a prepared
 * installation must contain exactly one `[FSDB]*` directory as a real
 * directory (symlinks are rejected by the platform). Only use this for small
 * subsets (the avatar FSDB); full-database verification lives in
 * scripts/wz_fsdb/verify_content.mjs, which points an installation root at
 * the converted output in place.
 */
import { cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

export const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(componentRoot, "..", "..");
export const loomRoot = path.join(repoRoot, "loom-realm");

const require = createRequire(path.join(loomRoot, "package.json"));
const IMPORT_CONDITIONS = { conditions: new Set(["node", "import"]) };

/** Resolve a pinned loom-realm package/module from the submodule checkout. */
export function loomRequire(specifier) {
  return require.resolve(specifier, IMPORT_CONDITIONS);
}

export async function importLoom(specifier) {
  return import(pathToFileURL(loomRequire(specifier)).href);
}

export const CONTENT_PERMISSIONS = Object.freeze(["manifest", "records", "groups", "resources"]);

/**
 * Materialize a prepared installation root around a converted FSDB root.
 *
 * @param {string} fsdbRoot directory that directly contains `[struct]Look` etc.
 * @param {string} installRoot directory to create; receives `[FSDB]cms`, game.json,
 *   launch.hostra.json and a stub subsystem module. Must be empty or absent.
 */
export async function prepareRealInstallation(fsdbRoot, installRoot) {
  if (!existsSync(path.join(fsdbRoot, "[struct]Look"))) {
    throw new Error(`${fsdbRoot} is not a converted CMS079 FSDB root (missing [struct]Look)`);
  }
  await mkdir(path.join(installRoot, "subsystems"), { recursive: true });
  await cp(fsdbRoot, path.join(installRoot, "[FSDB]cms"), { recursive: true, verbatimSymlinks: false });
  await Promise.all([
    writeFile(path.join(installRoot, "game.json"), JSON.stringify({
      formatVersion: 1,
      subsystems: [{ key: "avatar" }],
      initial: { input: null, subsystem: "avatar" },
    }, null, 2)),
    writeFile(path.join(installRoot, "launch.hostra.json"), JSON.stringify({
      formatVersion: 1,
      subsystems: [{ key: "avatar", module: "subsystems/avatar.mjs" }],
    })),
    writeFile(path.join(installRoot, "subsystems", "avatar.mjs"), "export default () => ({ frame() {} });\n"),
  ]);
  return installRoot;
}

/**
 * Start the real Content Service over a converted FSDB root and return the
 * service, a bearer-bound production ContentClient and its lifetime.
 *
 * @param {{ fsdbRoot: string, installRoot: string }} options
 */
export async function startRealContentService({ fsdbRoot, installRoot }) {
  await prepareRealInstallation(fsdbRoot, installRoot);
  const hostra = await importLoom("@loomrealm/game-launcher-hostra");
  const desktop = await importLoom("@loomrealm/desktop");
  const { createBoundContentClient } = await importLoom("@loomrealm/subsystem/host");
  const prepared = await hostra.prepareHostraGame({
    source: { installationRoot: installRoot },
    runnerPolicy: { helloDeadlineMs: 5_000, frameDeadlineMs: 5_000, terminalCleanupDeadlineMs: 1_000, terminationGraceMs: 100 },
  });
  const view = await desktop.prepareDesktopContentView(prepared);
  const service = await desktop.createDesktopContentService({ view });
  const grant = service.createGrant({
    permissions: [...CONTENT_PERMISSIONS],
    expiresAtUnixMs: Date.now() + 30 * 60_000,
  });
  const access = service.access(grant);
  const lifetime = new AbortController();
  const content = createBoundContentClient({
    origin: access.origin,
    installationId: access.installationId,
    token: access.token,
  }, lifetime.signal);
  return {
    service,
    content,
    access,
    async close() {
      lifetime.abort();
      service.revokeGrant(grant);
      await service.close();
    },
  };
}

#!/usr/bin/env node
/**
 * Build the Adventure-Island-owned product payload (installation-bundle v1
 * input) for LoomRealm's generic PWA builder — PWA migration Stage 4A.
 *
 * Authoritative inputs are the canonical root Game Entry documents added in
 * Stage 3A (game.json, launch.pwa.json, presentation.json) plus the pinned
 * dependency-free smoke implementation. Nothing is read from apps/pwa or
 * apps/hostra, no directory is scanned, and no research material
 * (research/**, .raw/**, .work/**, glm-work/**, task/**), WZ/client data, or
 * secret can enter the payload: the input set is a frozen whitelist below.
 *
 * The payload schema is byte-compatible with the upstream generic builder at
 * loom-realm 93648192323bf5f57996b7b54cbae641d8a53fdb
 * (apps/pwa/scripts/build-bundle.mjs, validatePwaBundlePayload) and with
 * PokeMan's product-owned generator (scripts/pwa/build-installation-bundle.mjs):
 *   { formatVersion: 1, gameEntryText, launchManifestText,
 *     presentation: { formatVersion: 1, styles: [], scripts: [] },
 *     executables: [{ logicalModule: "subsystems/smoke.mjs",
 *                     mime: "text/javascript", source, contentVersion }],
 *     content: [] }
 *
 * PWA executable publication contract (pinned by test/game-entry.test.mjs):
 * the executable for the logical module `subsystems/smoke.mjs` is the
 * dependency-free shared implementation
 * systems/loomrealm-smoke/subsystem.mjs (empty import graph). The
 * installation-root shim subsystems/smoke.mjs is NOT publishable — its
 * re-export escapes the declared executable set — and this builder enforces
 * that rule instead of trusting the mapping below.
 *
 * Output is deterministic: same inputs → byte-identical JSON (compact,
 * trailing newline, no timestamps, no paths inside the payload). The
 * destination must live inside <repo>/dist/ or the system temp directory,
 * must not be a Git-tracked file, and must not sit in a protected tree.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Pinned LoomRealm baseline this generator (and the whole repo) targets. */
export const PINNED_LOOM_REALM_GITLINK = "c5217e47be5a43f974e9e6ce82230077fb639c39";

/**
 * The frozen input whitelist: logical module → physical source inside this
 * repository. Stage 4A publishes the dependency-free shared implementation
 * directly (empty import graph). A future Stage 4B may replace the physical
 * path with a built self-contained bundle — never the root shim.
 */
export const EXECUTABLE_SOURCE_BINDINGS = Object.freeze(
  Object.freeze({
    "subsystems/smoke.mjs": "systems/loomrealm-smoke/subsystem.mjs",
  }),
);

const INPUT_PATHS = Object.freeze({
  gameEntry: "game.json",
  pwaLaunchManifest: "launch.pwa.json",
  presentation: "presentation.json",
});

/** Protected trees the writer refuses to touch even inside allowed roots. */
const OUTPUT_DENYLIST = Object.freeze([
  /^research(\/|$)/u,
  /^glm-work(\/|$)/u,
  /^task(\/|$)/u,
  /^(\.raw|\.work)(\/|$)/u,
  /^loom-realm(\/|$)/u,
  /^(\.github|scripts|tests|apps|systems|test|docs)(\/|$)/u,
]);

const MODULE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const ENCODER = new TextEncoder();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function exactKeys(value, expected, label) {
  if (!isObject(value)) throw new TypeError(`${label} must be an object`);
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must have exactly [${wanted.join(", ")}]`);
  }
  return value;
}

function git(directory, ...args) {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
}

// ---------------------------------------------------------------------------
// Document validation (lean mirrors of the pinned LoomRealm rules)
// ---------------------------------------------------------------------------

function assertSubsystemKeyShape(key, label) {
  requireString(key, `${label}: subsystem key`);
  if (ENCODER.encode(key).length > 256) throw new TypeError(`${label}: subsystem key exceeds 256 UTF-8 bytes`);
}

function assertLogicalModuleShape(module, label) {
  requireString(module, `${label}: module`);
  if (ENCODER.encode(module).length > 512 || !module.endsWith(".mjs")
    || module.includes("\\") || module.includes(":")) {
    throw new TypeError(`${label}: invalid logical module "${module}"`);
  }
  const segments = module.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || !MODULE_SEGMENT.test(segment))) {
    throw new TypeError(`${label}: invalid logical module "${module}"`);
  }
}

/** Mirrors parseGameEntryV1 (pinned game-package/src/validate.ts), lean form. */
function validateGameEntry(text, label) {
  const value = parseJsonObject(text, label);
  exactKeys(value, ["formatVersion", "initial", "subsystems", ...("state" in value ? ["state"] : [])], `${label}: Game Entry`);
  if (value.formatVersion !== 1) throw new TypeError(`${label}: formatVersion must be 1`);
  exactKeys(value.initial, ["subsystem", "input"], `${label}: initial`);
  assertSubsystemKeyShape(value.initial.subsystem, `${label}: initial.subsystem`);
  if (!Array.isArray(value.subsystems)) throw new TypeError(`${label}: subsystems must be an array`);
  const seen = new Set();
  for (const [index, descriptor] of value.subsystems.entries()) {
    exactKeys(descriptor, ["key"], `${label}: subsystems[${index}]`);
    assertSubsystemKeyShape(descriptor.key, `${label}: subsystems[${index}].key`);
    if (seen.has(descriptor.key)) throw new TypeError(`${label}: duplicate subsystem key "${descriptor.key}"`);
    seen.add(descriptor.key);
  }
  if (!seen.has(value.initial.subsystem)) {
    throw new TypeError(`${label}: initial subsystem "${value.initial.subsystem}" is not declared`);
  }
  return value;
}

/** Mirrors parsePwaLaunchManifestV1 (pinned game-launcher-pwa), lean form. */
function validatePwaLaunchManifest(text, label) {
  const value = parseJsonObject(text, label);
  exactKeys(value, ["formatVersion", "subsystems"], `${label}: PWA launch manifest`);
  if (value.formatVersion !== 1) throw new TypeError(`${label}: formatVersion must be 1`);
  if (!Array.isArray(value.subsystems)) throw new TypeError(`${label}: subsystems must be an array`);
  const seen = new Set();
  for (const [index, binding] of value.subsystems.entries()) {
    exactKeys(binding, ["key", "module"], `${label}: subsystems[${index}]`);
    assertSubsystemKeyShape(binding.key, `${label}: subsystems[${index}].key`);
    if (seen.has(binding.key)) throw new TypeError(`${label}: duplicate binding key "${binding.key}"`);
    seen.add(binding.key);
    assertLogicalModuleShape(binding.module, `${label}: subsystems[${index}].module`);
  }
  return value;
}

function validSegment(value, hierarchy, label) {
  if (typeof value !== "string" || value.length === 0 || value === "." || value === "..") return false;
  if (/[\\\0]|\p{Cc}|\p{Cs}/u.test(value)) return false;
  if (!hierarchy && value.includes("/")) return false;
  if (value.startsWith("/") || value.endsWith("/")) return false;
  if (value.split("/").some((part) => part.length === 0 || part === "." || part === "..")) return false;
  if (/^[A-Za-z]:/u.test(value) || value.startsWith("\\\\") || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)) return false;
  return true;
}

/** Mirrors validateWebPresentationConfigV1 (pinned renderer), lean form. */
function validatePresentation(value, label) {
  exactKeys(value, ["formatVersion", "scripts", "styles"], `${label}: Web Presentation Config`);
  if (value.formatVersion !== 1) throw new TypeError(`${label}: formatVersion must be 1`);
  const refs = (list, listLabel) => {
    if (!Array.isArray(list)) throw new TypeError(`${label}: ${listLabel} must be an array`);
    const seen = new Set();
    return list.map((candidate, index) => {
      exactKeys(candidate, ["namespace", "key"], `${label}: ${listLabel}[${index}]`);
      if (!validSegment(candidate.namespace, false, `${label}: ${listLabel}[${index}].namespace`)
        || !validSegment(candidate.key, true, `${label}: ${listLabel}[${index}].key`)) {
        throw new TypeError(`${label}: invalid ${listLabel}[${index}] resource reference`);
      }
      const identity = JSON.stringify([candidate.namespace, candidate.key]);
      if (seen.has(identity)) throw new TypeError(`${label}: duplicate ${listLabel} resource`);
      seen.add(identity);
      return Object.freeze({ namespace: candidate.namespace, key: candidate.key });
    });
  };
  return Object.freeze({
    formatVersion: 1,
    styles: Object.freeze(refs(value.styles, "styles")),
    scripts: Object.freeze(refs(value.scripts, "scripts")),
  });
}

function parseJsonObject(text, label) {
  requireString(text, `${label}: document text`);
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new TypeError(`${label}: not valid JSON (${cause.message})`);
  }
  if (!isObject(value)) throw new TypeError(`${label}: must contain a JSON object`);
  return value;
}

// ---------------------------------------------------------------------------
// Executable import-graph validation (PWA publication contract)
// ---------------------------------------------------------------------------

/** Mirrors resolveRelativeModule (pinned game-launcher-pwa/src/index.ts). */
function resolveLogicalImport(from, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return { ok: false, code: "SUBSYSTEM_MODULE_GRAPH_INVALID" };
  }
  if (specifier.includes("\\") || specifier.includes(":") || specifier.includes("?") || specifier.includes("#")) {
    return { ok: false, code: "SUBSYSTEM_MODULE_GRAPH_INVALID" };
  }
  const output = from.split("/");
  output.pop();
  for (const segment of specifier.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") {
      if (output.length === 0) return { ok: false, code: "SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION" };
      output.pop();
    } else {
      if (!MODULE_SEGMENT.test(segment)) return { ok: false, code: "SUBSYSTEM_MODULE_INVALID" };
      output.push(segment);
    }
  }
  return { ok: true, logicalModule: output.join("/") };
}

/** Collects static import/export-from edges and literal dynamic imports. */
function readModuleEdges(source, label) {
  if (/\bimport\s*\(\s*[^"'\s]/u.test(source)) {
    throw new TypeError(`${label}: non-literal dynamic import() is not publishable`);
  }
  if (/\bprocess\.\w/u.test(source) || /\brequire\s*\(/u.test(source) || /["']node:/u.test(source)) {
    throw new TypeError(`${label}: source must be loadable in Chromium (no process.*/require()/node: references)`);
  }
  const edges = new Set();
  for (const match of source.matchAll(/\bfrom\s*["']([^"']+)["']/gu)) edges.add(match[1]);
  for (const match of source.matchAll(/\bimport\s*\(\s*(["'])([^"']+)\1/gu)) edges.add(match[2]);
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gmu)) edges.add(match[1]);
  return [...edges];
}

/**
 * Enforces the PWA executable import-graph rules on the published set:
 *   - no bare package specifiers, no out-of-installation escapes (pinned
 *     walker rules, mirrored above);
 *   - every edge must resolve to a logical module that is itself part of the
 *     published executable set;
 *   - Stage 4A policy: every executable must additionally be dependency-free
 *     (zero import edges) — the payload publishes the shared smoke
 *     implementation or, later, a self-contained bundle, never a shim whose
 *     dependencies are not published.
 *
 * Exported for the regression tests in test/pwa-bundle.test.mjs.
 */
export function assertExecutableGraph(executables, { requireDependencyFree = true } = {}) {
  const modules = new Set(executables.map((executable) => executable.logicalModule));
  for (const executable of executables) {
    const edges = readModuleEdges(executable.source, executable.logicalModule);
    if (requireDependencyFree && edges.length > 0) {
      throw new TypeError(
        `${executable.logicalModule}: Stage 4A executables must be dependency-free; found import/re-export edges [${edges.join(", ")}]`,
      );
    }
    for (const specifier of edges) {
      const resolved = resolveLogicalImport(executable.logicalModule, specifier);
      if (!resolved.ok) {
        throw new TypeError(`${executable.logicalModule}: import "${specifier}" rejected (${resolved.code})`);
      }
      if (!modules.has(resolved.logicalModule)) {
        throw new TypeError(
          `${executable.logicalModule}: import "${specifier}" resolves to "${resolved.logicalModule}", which is not part of the published executable set`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Output confinement
// ---------------------------------------------------------------------------

function gitTracked(gameRoot, file) {
  try {
    execFileSync("git", ["-C", gameRoot, "ls-files", "--error-unmatch", "--", file], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function insideDirectory(base, candidate) {
  const relativePath = relative(base, candidate);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

/**
 * The artifact may only be written inside <repo>/dist/ or the system temp
 * directory, never into a protected tree, never over a Git-tracked file. The
 * lexical check runs before any directory creation; the realpath check after
 * creation closes symlink escapes.
 */
async function assertWritableOutput(destination, gameRoot) {
  const distRoot = join(gameRoot, "dist");
  const canonicalTmp = await realpath(tmpdir());
  const lexicallyAllowed = insideDirectory(distRoot, destination) || insideDirectory(canonicalTmp, destination);
  if (!lexicallyAllowed) {
    throw new Error(`refusing to write outside <repo>/dist/ or the system temp directory: ${destination}`);
  }
  const relativeToRepo = relative(gameRoot, destination).replaceAll("\\", "/");
  if (OUTPUT_DENYLIST.some((pattern) => pattern.test(relativeToRepo))) {
    throw new Error(`refusing to write into a protected tree: ${destination}`);
  }
  if (gitTracked(gameRoot, destination)) {
    throw new Error(`refusing to overwrite a Git-tracked file: ${destination}`);
  }
  let facts;
  try {
    facts = await stat(destination);
  } catch {
    facts = null;
  }
  if (facts !== null && facts.isDirectory()) {
    throw new Error(`output path is a directory: ${destination}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  const canonical = join(await realpath(dirname(destination)), basename(destination));
  const canonicallyAllowed = insideDirectory(await realpath(distRoot), canonical)
    || insideDirectory(canonicalTmp, canonical);
  if (!canonicallyAllowed) {
    throw new Error(`refusing to write outside <repo>/dist/ or the system temp directory (symlinked): ${destination}`);
  }
  return canonical;
}

// ---------------------------------------------------------------------------
// Bundle assembly
// ---------------------------------------------------------------------------

function assertPinnedFramework(game, framework) {
  const gitlink = git(game, "rev-parse", "HEAD:loom-realm");
  if (!/^[a-f0-9]{40}$/u.test(gitlink) || gitlink !== PINNED_LOOM_REALM_GITLINK) {
    throw new Error(`LoomRealm gitlink ${gitlink} is not the pinned baseline ${PINNED_LOOM_REALM_GITLINK}`);
  }
  const checkedOut = git(framework, "rev-parse", "HEAD");
  if (checkedOut !== PINNED_LOOM_REALM_GITLINK) {
    throw new Error(`checked-out LoomRealm ${checkedOut} does not match the pinned gitlink ${PINNED_LOOM_REALM_GITLINK}`);
  }
  return checkedOut;
}

/**
 * Builds the Adventure Island installation-bundle v1 payload from the
 * canonical root sources. `executableSources` maps logical module → physical
 * path (relative to gameRoot or absolute) and is injectable so tests can
 * prove that non-sanctioned sources — the root or apps/* shims — are
 * rejected instead of published.
 */
export async function buildAdventureIslandInstallationBundle({
  gameRoot = root,
  frameworkRoot,
  outputFile,
  verifyGitlink = true,
  executableSources = EXECUTABLE_SOURCE_BINDINGS,
} = {}) {
  const game = resolve(gameRoot);
  if (typeof outputFile !== "string" || outputFile.length === 0) {
    throw new TypeError("outputFile is required");
  }
  const frameworkSha = verifyGitlink
    ? assertPinnedFramework(game, frameworkRoot === undefined ? join(game, "loom-realm") : resolve(frameworkRoot))
    : null;
  const gameSha = verifyGitlink ? git(game, "rev-parse", "HEAD") : null;

  const gameEntryText = await readFile(join(game, INPUT_PATHS.gameEntry), "utf8");
  const launchManifestText = await readFile(join(game, INPUT_PATHS.pwaLaunchManifest), "utf8");
  const gameEntry = validateGameEntry(gameEntryText, `${INPUT_PATHS.gameEntry} (root)`);
  const manifest = validatePwaLaunchManifest(launchManifestText, `${INPUT_PATHS.pwaLaunchManifest} (root)`);
  const presentation = validatePresentation(
    parseJsonObject(await readFile(join(game, INPUT_PATHS.presentation), "utf8"), `${INPUT_PATHS.presentation} (root)`),
    `${INPUT_PATHS.presentation} (root)`,
  );

  const gameKeys = new Set(gameEntry.subsystems.map(({ key }) => key));
  const manifestKeys = new Set(manifest.subsystems.map(({ key }) => key));
  for (const key of gameKeys) {
    if (!manifestKeys.has(key)) throw new TypeError(`launch.pwa.json (root): subsystem "${key}" has no PWA binding`);
  }
  for (const key of manifestKeys) {
    if (!gameKeys.has(key)) throw new TypeError(`launch.pwa.json (root): binding "${key}" is not declared by the Game Entry`);
  }

  // Smoke content package: empty by design. Every presentation resource
  // reference would need a matching Content entry; the empty application
  // references none.
  const content = Object.freeze([]);
  const contentIdentities = new Set(content.map((entry) => [entry.kind, entry.namespace, entry.key].join("\0")));
  for (const ref of [...presentation.styles, ...presentation.scripts]) {
    const identity = ["resource", ref.namespace, ref.key].join("\0");
    if (!contentIdentities.has(identity)) {
      throw new TypeError(`presentation.json (root): resource ${ref.namespace}/${ref.key} has no Content entry`);
    }
  }

  const executables = [];
  const provenance = [];
  for (const binding of manifest.subsystems) {
    const physicalPath = Object.hasOwn(executableSources, binding.module)
      ? executableSources[binding.module]
      : undefined;
    if (physicalPath === undefined) {
      throw new TypeError(
        `launch.pwa.json (root): logical module "${binding.module}" has no sanctioned executable source; `
          + "Stage 4A publishes the dependency-free shared implementation, never an installation shim",
      );
    }
    const source = await readFile(resolve(game, physicalPath), "utf8");
    const contentVersion = `sha256:${sha256(source)}`;
    assertExecutableGraph([{ logicalModule: binding.module, source }]);
    executables.push(Object.freeze({
      logicalModule: binding.module,
      mime: "text/javascript",
      source,
      contentVersion,
    }));
    provenance.push(Object.freeze({ logicalModule: binding.module, physicalPath, contentVersion }));
  }

  const payload = Object.freeze({
    formatVersion: 1,
    gameEntryText,
    launchManifestText,
    presentation,
    executables: Object.freeze(executables),
    content,
  });

  const destination = resolve(outputFile);
  const canonical = await assertWritableOutput(destination, game);
  await writeFile(canonical, `${JSON.stringify(payload)}\n`, "utf8");
  return Object.freeze({
    outputFile: canonical,
    executableCount: payload.executables.length,
    contentCount: payload.content.length,
    executableModules: Object.freeze(payload.executables.map(({ logicalModule }) => logicalModule)),
    sources: Object.freeze(provenance),
    gameSha,
    frameworkSha,
  });
}

function parseOutput(args) {
  if (args.length !== 2 || args[0] !== "--output" || args[1].length === 0 || args[1].startsWith("--")) {
    throw new Error("Usage: node scripts/pwa/build-installation-bundle.mjs --output <absolute-or-relative-json-path>");
  }
  return resolve(args[1]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await buildAdventureIslandInstallationBundle({ outputFile: parseOutput(process.argv.slice(2)) });
    console.log("Prepared Adventure Island installation-bundle v1 from canonical root sources");
    console.log(JSON.stringify(result));
  } catch (cause) {
    console.error(`build-installation-bundle: ${cause.message}`);
    process.exitCode = 1;
  }
}

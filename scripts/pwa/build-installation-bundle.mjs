#!/usr/bin/env node
/**
 * Build the Adventure-Island-owned product payload (installation-bundle v1
 * input) for LoomRealm's generic PWA builder — PWA migration Stage 4A,
 * extended by the Base → Adventure Map → cms-actor slice (issue #62).
 *
 * Authoritative inputs are the canonical root Game Entry documents
 * (game.json, launch.pwa.json, presentation.json), the two subsystem
 * implementations under systems/, the pinned classic browser scripts, and the
 * existing single-character Avatar closure inside content/[FSDB]adventure.
 * Nothing is read from apps/pwa or apps/hostra, no directory is scanned, and
 * no research material (research/**, .raw/**, .work/**, glm-work/**, task/**),
 * WZ/client data, or secret can enter the payload: the input set is a frozen
 * whitelist below.
 *
 * The payload schema is byte-compatible with the upstream generic builder at
 * loom-realm 93648192323bf5f57996b7b54cbae641d8a53fdb
 * (apps/pwa/scripts/build-bundle.mjs, validatePwaBundlePayload) and with
 * PokeMan's product-owned generator (scripts/pwa/build-installation-bundle.mjs):
 *   { formatVersion: 1, gameEntryText, launchManifestText,
 *     presentation: { formatVersion: 1, styles: [], scripts: [resource refs] },
 *     executables: [{ logicalModule: "subsystems/base.mjs",
 *                     mime: "text/javascript", source, contentVersion }],
 *     content: [{ kind, namespace, key, mime, encoding: "base64", body }] }
 *
 * Executables (issue #62): the canonical application declares base and
 * adventure-map. Each executable is a SELF-CONTAINED esbuild bundle compiled
 * from the single sanctioned source file (absWorkingDir = the game root,
 * bundle, ESM, browser, chrome140, write:false); the published bytes are what
 * gets hashed, and the import graph must stay empty (no bare specifiers, no
 * shims, no Node-only APIs). The installation-root shims under subsystems/
 * are never publishable.
 *
 * Content (issue #62): the canonical application registers exactly two
 * classic presentation scripts, in order — the pinned common-controls IIFE
 * (resource.Presentation/controls/device-input.browser.js, built inside the
 * fixed gitlink by `npm run build:game-common-controls-input --prefix
 * loom-realm`) and the cms-actor IIFE — plus the read-only single-character
 * Avatar closure from the existing content/[FSDB]adventure library and the
 * DERIVED record struct.AdventureAvatarPlan/bootstrap (the official
 * buildAdventureAvatarPlan() output). The builder re-decodes the plan and
 * every referenced PNG from the FINAL published entries and cross-checks
 * identity, MIME and sha256 versions before writing anything.
 *
 * Output is deterministic: same inputs → byte-identical JSON (compact,
 * trailing newline, no timestamps, no paths inside the payload). The
 * destination must live inside <repo>/dist/ or the system temp directory,
 * must not be a Git-tracked file, and must not sit in a protected tree.
 */
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build as esbuild } from "esbuild";

import {
  AVATAR_PLAN_DATA_BYTE_LIMIT,
  AVATAR_PLAN_KEY,
  AVATAR_PLAN_NAMESPACE,
  buildCanonicalAdventureAvatarContent,
} from "./read-adventure-fsdb.mjs";
import {
  measureAvatarPlanDataBytes,
  validateAvatarPlan,
} from "../../components/cms-actor/src/avatar-model.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The repository Gitlink (`HEAD:loom-realm`) is the ONLY trusted pin for the
 * LoomRealm submodule: the actually checked-out framework HEAD must equal it
 * exactly. No checkout SHA is ever accepted on its own, and no SHA is
 * hardcoded here — when a maintainer updates the Gitlink through a PR, this
 * check keeps protecting the exact-revision contract without edits. (The
 * current main Gitlink is 93648192323bf5f57996b7b54cbae641d8a53fdb.)
 */

/**
 * The frozen input whitelist: logical module → physical source inside this
 * repository. The canonical application publishes exactly the two subsystem
 * implementations; the PWA executable for each is the SELF-CONTAINED esbuild
 * bundle compiled from that source (never the installation-root shims under
 * subsystems/, whose re-exports escape the declared executable set).
 */
export const EXECUTABLE_SOURCE_BINDINGS = Object.freeze(
  Object.freeze({
    "subsystems/base.mjs": "systems/base/subsystem.mjs",
    "subsystems/adventure-map.mjs": "systems/adventure-map/subsystem.mjs",
  }),
);

const INPUT_PATHS = Object.freeze({
  gameEntry: "game.json",
  pwaLaunchManifest: "launch.pwa.json",
  presentation: "presentation.json",
});

/** Logical Content key of the pinned common-controls classic IIFE. */
export const CONTROLS_SCRIPT_KEY = "controls/device-input.browser.js";
/** Physical artifact (built inside the fixed gitlink), relative to the game root. */
export const CONTROLS_SCRIPT_PATH = "loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js";
/** Logical Content key of the cms-actor classic IIFE. */
export const ACTOR_SCRIPT_KEY = "cms-actor/cms-actor.browser.js";
/** Physical artifact (PR-A generated), relative to the game root. */
export const ACTOR_SCRIPT_PATH = "components/cms-actor/browser/cms-actor.browser.js";

/**
 * The frozen Content-script whitelist: Content identity (kind\0namespace\0key)
 * → physical classic-script artifact. The canonical presentation registers
 * exactly the two pinned IIFEs — Controls first (it defines the
 * `game-controls-input` element Base projects), Actor second — never the ESM
 * sources (the builder rejects module syntax below) and never anything from
 * research/**, .raw/**, .work/**, glm-work/** or task/**. The Controls IIFE
 * must be the artifact built inside the fixed gitlink checkout, not a copy
 * committed into a Git-tracked tree.
 */
export const CONTENT_SCRIPT_SOURCE_BINDINGS = Object.freeze(
  Object.freeze({
    [`resource\0resource.Presentation\0${CONTROLS_SCRIPT_KEY}`]: CONTROLS_SCRIPT_PATH,
    [`resource\0resource.Presentation\0${ACTOR_SCRIPT_KEY}`]: ACTOR_SCRIPT_PATH,
  }),
);

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
// Adventure Content validation (FSDB closure + derived plan; issue #62)
// ---------------------------------------------------------------------------

/** Mirrors segment() of the pinned PWA installer (apps/pwa/src/installer.ts). */
function assertContentSegment(value, label) {
  requireString(value, label);
  if (value === "." || value === ".." || /[\\/\0:]|\p{Cc}|\p{Cs}/u.test(value)
    || /^[A-Za-z]:/u.test(value) || value.startsWith("\\\\")
    || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)) {
    throw new TypeError(`${label} is not a valid Content segment ("${value}")`);
  }
}

/** Record/group keys are flat; resource keys are `/`-joined valid segments. */
function assertContentKey(kind, key, label) {
  requireString(key, label);
  const segments = key.split("/");
  if (kind !== "resource" && segments.length !== 1) {
    throw new TypeError(`${label} must not contain "/" for kind "${kind}"`);
  }
  for (const [index, segment] of segments.entries()) {
    assertContentSegment(segment, `${label} segment ${index}`);
  }
}

/** Lean MIME check: a type/subtype essence plus syntactically valid parameters. */
function assertContentMime(mime, label) {
  requireString(mime, label);
  if (mime !== mime.trim()) throw new TypeError(`${label} has surrounding whitespace`);
  const [essence, ...parameters] = mime.split(";");
  if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/u.test(essence)) {
    throw new TypeError(`${label} has no valid type/subtype essence ("${mime}")`);
  }
  const parameter = /^\s*[A-Za-z0-9!#$%&'*+.^_`|~-]+\s*=\s*(?:[A-Za-z0-9!#$%&'*+.^_`|~-]+|"(?:[^"\\\r\n]|\\.)*")\s*$/u;
  if (parameters.some((part) => part !== "" && !parameter.test(part))) {
    throw new TypeError(`${label} has invalid parameters ("${mime}")`);
  }
}

/**
 * A published Content script must be a CLASSIC script: the pinned Web
 * Presentation bootstrap loads it as an ordered <script src> element, never
 * as an ES module, so module syntax would be a syntax error in the product.
 * The PR-A builder guarantees this for the checked-in artifact; this guard
 * keeps the publication contract independent of that build step.
 */
function assertClassicScriptSource(source, label) {
  if (/(^|\n)\s*(import|export)\s*[({"'\s]/u.test(source) || /\bimport\s*\(/u.test(source)) {
    throw new TypeError(`${label} contains ES module syntax and cannot be published as a classic script`);
  }
}

/**
 * Assemble and validate the payload's Content array. Every entry must pass
 * the shape rules of the upstream payload validator (kind/namespace/key/MIME/
 * canonical base64, unique identity); JSON records and NDJSON groups must
 * parse; and the bootstrap AvatarPlanV1 decoded from the FINAL published
 * entries must re-validate against the frozen cms-actor model with every
 * referenced atlas PNG present under the exact stamped sha256 version —
 * identity/version/reference consistency proven on every build, not just in
 * tests. Missing resources, version contradictions, or tampered entries fail
 * the build; no empty plan or transparent placeholder is ever substituted.
 */
async function assembleAdventureContent({ scriptEntries, adventureContent }) {
  const generated = await adventureContent();
  const byIdentity = new Map();
  const content = [];
  const push = (candidate) => {
    const { kind, namespace, key, mime, bytes } = candidate;
    if (!["record", "group", "resource"].includes(kind)) {
      throw new TypeError(`Content entry ${namespace}/${key}: invalid kind "${kind}"`);
    }
    assertContentSegment(namespace, `Content entry ${namespace}/${key}: namespace`);
    assertContentKey(kind, key, `Content entry ${namespace}/${key}: key`);
    assertContentMime(mime, `Content entry ${namespace}/${key}: mime`);
    if (kind === "record" && mime.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new TypeError(`Content record ${namespace}/${key}: MIME essence must be application/json`);
    }
    if (kind === "group" && mime.split(";")[0].trim().toLowerCase() !== "application/x-ndjson") {
      throw new TypeError(`Content group ${namespace}/${key}: MIME essence must be application/x-ndjson`);
    }
    const body = bytes.toString("base64");
    if (Buffer.from(body, "base64").toString("base64") !== body) {
      throw new TypeError(`Content entry ${namespace}/${key}: body is not canonical base64`);
    }
    if (kind === "record") JSON.parse(bytes.toString("utf8"));
    if (kind === "group") {
      for (const line of bytes.toString("utf8").split(/\r?\n/u)) {
        if (line.trim().length === 0) continue;
        JSON.parse(line);
      }
    }
    const identity = [kind, namespace, key].join("\0");
    if (byIdentity.has(identity)) throw new TypeError(`duplicate Content identity ${kind} ${namespace}/${key}`);
    byIdentity.set(identity, Object.freeze({ bytes, mime, contentVersion: `sha256:${sha256(bytes)}` }));
    content.push(Object.freeze({ kind, namespace, key, mime, encoding: "base64", body }));
  };
  for (const entry of generated.entries) push(entry);
  for (const entry of scriptEntries) push(entry);
  content.sort((left, right) => (left.kind < right.kind ? -1 : left.kind > right.kind ? 1
    : left.namespace < right.namespace ? -1 : left.namespace > right.namespace ? 1
      : left.key < right.key ? -1 : left.key > right.key ? 1 : 0));

  // Cross-consistency, proven on the FINAL published bytes: re-decode the
  // derived bootstrap plan record and every atlas PNG it references.
  const planEntry = byIdentity.get(`record\0${AVATAR_PLAN_NAMESPACE}\0${AVATAR_PLAN_KEY}`);
  if (planEntry === undefined) {
    throw new TypeError(`the published Content set is missing the derived ${AVATAR_PLAN_NAMESPACE}/${AVATAR_PLAN_KEY} record`);
  }
  const plan = validateAvatarPlan(JSON.parse(planEntry.bytes.toString("utf8")));
  const planDataBytes = measureAvatarPlanDataBytes(plan);
  if (planDataBytes > AVATAR_PLAN_DATA_BYTE_LIMIT) {
    throw new TypeError(`the published bootstrap AvatarPlanV1 is ${planDataBytes} bytes, above the frozen RenderNode.data cap`);
  }
  const planLayers = [
    ...Object.values(plan.actions).flatMap((action) => action.frames.flatMap((frame) => frame.layers)),
    ...(plan.expression?.frames ?? []).flatMap((frame) => frame.layers),
  ];
  for (const [index, layer] of planLayers.entries()) {
    const published = byIdentity.get(`resource\0${layer.resource.namespace}\0${layer.resource.key}`);
    if (published === undefined) {
      throw new TypeError(`the published plan references unpublished Content ${layer.resource.namespace}/${layer.resource.key} (layer ${index})`);
    }
    if (published.contentVersion !== layer.resource.contentVersion) {
      throw new TypeError(
        `the published plan stamps ${layer.resource.contentVersion} for ${layer.resource.namespace}/${layer.resource.key} `
          + `but the published resource is ${published.contentVersion}`,
      );
    }
    if (!published.bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      throw new TypeError(`the published atlas resource ${layer.resource.namespace}/${layer.resource.key} is not a PNG`);
    }
  }
  if (planLayers.length === 0) {
    throw new TypeError("the published bootstrap AvatarPlanV1 references no layers at all");
  }
  return Object.freeze({ content, plan });
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
 *   - canonical policy: every executable must additionally be dependency-free
 *     (zero import edges) — the payload publishes the self-contained esbuild
 *     bundle for each subsystem, never an installation shim whose
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

async function pathFacts(target) {
  try {
    return await lstat(target);
  } catch {
    return null;
  }
}

/**
 * Splits the (already rebased) parent directory into trusted path segments
 * relative to a realpath'd anchor. Defensive: the caller guarantees the
 * parent is lexically inside the anchor, so any `..` here is an internal
 * error and fails closed.
 */
function trustedParentSegments(anchorReal, rebasedParent, destination) {
  const chain = relative(anchorReal, rebasedParent);
  if (chain === "") return [];
  if (chain.startsWith("..") || isAbsolute(chain)) {
    throw new Error(`internal error: output parent escapes its anchor (fail closed): ${destination}`);
  }
  const segments = chain.split(sep);
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`internal error: untrusted parent segment (fail closed): ${destination}`);
  }
  return segments;
}

/**
 * Validates the existing parent chain segment by segment and creates missing
 * directories ONE level at a time with non-recursive mkdir — never
 * mkdir({recursive:true}) followed by a safety verdict. Every existing
 * segment must be a real directory: ANY symlink in the parent chain is
 * rejected before a deeper directory can be created through it, so a
 * rejected build leaves the filesystem untouched. The pre-mkdir re-check of
 * the immediate parent narrows (but cannot eliminate — no dirfd in Node)
 * the window for a concurrent swap of an already-validated directory.
 */
async function ensureTrustedParentDirectory(anchorReal, segments, destination) {
  let current = anchorReal;
  for (const segment of segments) {
    const child = join(current, segment);
    let facts = await pathFacts(child);
    if (facts === null) {
      const parentFacts = await pathFacts(current);
      if (parentFacts === null || !parentFacts.isDirectory()) {
        throw new Error(`parent chain changed during the build (fail closed): ${current}`);
      }
      try {
        await mkdir(child);
      } catch (cause) {
        if (cause?.code !== "EEXIST") throw cause;
        facts = await pathFacts(child);
        if (facts === null || !facts.isDirectory()) {
          throw new Error(`refusing to traverse a non-directory parent created concurrently (fail closed): ${child}`);
        }
      }
    } else if (facts.isSymbolicLink()) {
      throw new Error(`refusing to traverse a symlink parent directory: ${child}`);
    } else if (!facts.isDirectory()) {
      throw new Error(`parent path component is not a directory: ${child}`);
    }
    current = child;
  }
  return current;
}

/** Re-walks the trusted chain in verify-only mode (no creation). */
async function assertChainStillTrusted(anchorReal, segments, destination) {
  let current = anchorReal;
  for (const segment of segments) {
    current = join(current, segment);
    const facts = await pathFacts(current);
    if (facts === null || !facts.isDirectory()) {
      throw new Error(`parent chain changed during the build (fail closed): ${destination}`);
    }
  }
  return current;
}

/**
 * Validates the output location and publishes the artifact atomically.
 *
 * Threat model (see docs/game-entry.md §5): the builder defends against
 * filesystem entries it did not create — a destination that is (or becomes) a
 * symlink, and symlinked parents that redirect the write out of the allowed
 * roots (<repo>/dist/ or the system temp directory) into protected trees
 * (research/**, glm-work/**, task/**, loom-realm/**, .github/**, …) or onto
 * Git-tracked files. Rejections must happen BEFORE any filesystem mutation:
 *
 *   1. Lexical gate (zero fs access): inside <repo>/dist/ or the system temp
 *      directory; not in a protected tree; not Git-tracked.
 *   2. The destination entry itself must be a regular file or absent —
 *      symlinks (including dangling) and directories are rejected (lstat,
 *      no following).
 *   3. The destination is rebased onto a realpath'd anchor and the parent
 *      chain is walked segment by segment: existing segments must be real
 *      directories (ANY symlink parent is rejected — including a symlinked
 *      dist root — before a deeper directory could be created through it);
 *      missing segments are created one level at a time with non-recursive
 *      mkdir, re-validating each level. A missing dist/ is created on demand
 *      in a clean checkout; temp targets never require dist/ to exist.
 *   4. The resolved parent must satisfy realpath identity (proving no
 *      hidden symlinks), stay within the lexically chosen allowed root, out
 *      of protected trees, and off Git-tracked files.
 *   5. Publication writes an exclusive temporary file (flag "wx" =
 *      O_CREAT|O_EXCL — the temp entry itself can never be a followed
 *      symlink) in the validated real directory, re-walks the chain in
 *      verify-only mode, re-checks the destination entry, then rename(2)s
 *      into place. rename replaces the destination directory entry itself
 *      and never follows symlinks, so a symlink swapped in after the final
 *      check is replaced, not written through. Rebuilding an existing
 *      regular artifact stays legal and byte-deterministic.
 *
 * Residual limitation, stated honestly: Node offers no renameat/dirfd
 * primitives, so a concurrent attacker that swaps an already-validated
 * directory for a symlink between validation and the rename can still
 * redirect the write. The pre-mkdir parent re-check and the verify-only
 * re-walk narrow the windows and every observable anomaly fails closed, but
 * this tool does not claim to defeat a racing writer with the same
 * filesystem permissions — that is out of scope for a build tool and matches
 * the upstream PokeMan/LoomRealm builders' guarantees.
 */
async function writeBundleSafely(destination, gameRoot, data) {
  // Phase A — pure lexical validation, zero filesystem mutation.
  const gameReal = await realpath(gameRoot);
  const distRootLexical = join(gameRoot, "dist");
  const tmpLexical = tmpdir();
  const canonicalTmp = await realpath(tmpLexical);

  const lexicallyInDist = insideDirectory(distRootLexical, destination);
  const lexicallyInTmp = insideDirectory(tmpLexical, destination) || insideDirectory(canonicalTmp, destination);
  if (!lexicallyInDist && !lexicallyInTmp) {
    throw new Error(`refusing to write outside <repo>/dist/ or the system temp directory: ${destination}`);
  }
  const lexicalRelative = relative(gameRoot, destination).replaceAll("\\", "/");
  if (OUTPUT_DENYLIST.some((pattern) => pattern.test(lexicalRelative))) {
    throw new Error(`refusing to write into a protected tree: ${destination}`);
  }
  if (gitTracked(gameRoot, destination)) {
    throw new Error(`refusing to overwrite a Git-tracked file: ${destination}`);
  }

  // Rebase onto the realpath'd anchor of the chosen branch so that no
  // symlink inside the game root's or tmpdir's own path is ever traversed.
  let anchorReal;
  let anchorForRelative;
  if (lexicallyInDist) {
    anchorReal = gameReal;
    anchorForRelative = gameRoot;
  } else if (insideDirectory(tmpLexical, destination)) {
    anchorReal = canonicalTmp;
    anchorForRelative = tmpLexical;
  } else {
    anchorReal = canonicalTmp;
    anchorForRelative = canonicalTmp;
  }
  const rebased = join(anchorReal, relative(anchorForRelative, destination));
  const parentSegments = trustedParentSegments(anchorReal, dirname(rebased), destination);

  // Phase B — the destination entry itself must be a regular file or absent.
  const entryFacts = await pathFacts(rebased);
  if (entryFacts !== null) {
    if (entryFacts.isSymbolicLink()) {
      throw new Error(`refusing to write through a symlink destination: ${destination}`);
    }
    if (entryFacts.isDirectory()) {
      throw new Error(`output path is a directory: ${destination}`);
    }
  }

  // Phase C — segment-wise parent validation and creation; rejections
  // happen before any directory is created.
  const parent = await ensureTrustedParentDirectory(anchorReal, parentSegments, destination);

  // Phase D — resolved-path re-validation (defense in depth).
  const expectedParent = dirname(rebased);
  if ((await realpath(parent).catch(() => null)) !== expectedParent) {
    throw new Error(`parent chain failed realpath identity (fail closed): ${destination}`);
  }
  const resolved = join(parent, basename(rebased));
  if (lexicallyInDist) {
    const resolvedRelative = relative(gameReal, resolved).replaceAll("\\", "/");
    if (!insideDirectory(join(gameReal, "dist"), resolved) || resolvedRelative.split("/")[0] !== "dist") {
      throw new Error(`refusing to write outside <repo>/dist/ (symlinked parent redirects the write): ${destination}`);
    }
  } else if (!insideDirectory(canonicalTmp, resolved)) {
    throw new Error(`refusing to write outside the system temp directory (symlinked parent redirects the write): ${destination}`);
  }
  const resolvedTree = relative(gameReal, resolved);
  if (!resolvedTree.startsWith("..") && !isAbsolute(resolvedTree)) {
    const normalized = resolvedTree.replaceAll("\\", "/");
    if (OUTPUT_DENYLIST.some((pattern) => pattern.test(normalized))) {
      throw new Error(`refusing to write into a protected tree (resolved): ${destination}`);
    }
    if (gitTracked(gameRoot, resolved)) {
      throw new Error(`refusing to overwrite a Git-tracked file (resolved): ${destination}`);
    }
  }

  // Phase E — atomic, symlink-free publication.
  const temp = join(parent, `.${basename(rebased)}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`);
  try {
    await writeFile(temp, data, { encoding: "utf8", flag: "wx" });
    const lateParent = await assertChainStillTrusted(anchorReal, parentSegments, destination);
    if (lateParent !== parent || (await realpath(parent).catch(() => null)) !== parent) {
      throw new Error(`parent directory of the output changed during the build (fail closed): ${destination}`);
    }
    const lateFacts = await pathFacts(rebased);
    if (lateFacts !== null && (lateFacts.isSymbolicLink() || lateFacts.isDirectory())) {
      throw new Error(`refusing to write through a symlink or directory destination: ${destination}`);
    }
    await rename(temp, rebased);
  } catch (cause) {
    await rm(temp, { force: true }).catch(() => {});
    throw cause;
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Bundle assembly
// ---------------------------------------------------------------------------

/**
 * Compile one self-contained browser executable from its sanctioned source.
 * Fixed options (issue #62): absWorkingDir = the game root, absolute entry
 * point, bundling, ESM, browser platform, chrome140, no sourcemap, no write.
 * Exactly one output is expected; the returned text is the published source.
 */
async function bundleExecutableSource(game, entryPoint, label) {
  const result = await esbuild({
    absWorkingDir: game,
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome140",
    sourcemap: false,
    write: false,
  });
  const outputs = result.outputFiles ?? [];
  if (outputs.length !== 1) {
    throw new TypeError(`${label}: expected exactly one esbuild output for ${entryPoint}, got ${outputs.length}`);
  }
  return outputs[0].text;
}

function assertFrameworkPin(game, framework) {
  let gitlink;
  try {
    gitlink = git(game, "rev-parse", "HEAD:loom-realm");
  } catch {
    throw new Error("the repository does not record a loom-realm Gitlink at HEAD:loom-realm — the Gitlink is the only trusted framework pin");
  }
  if (!/^[a-f0-9]{40}$/u.test(gitlink)) {
    throw new Error(`the loom-realm Gitlink "${gitlink}" is not a valid commit SHA`);
  }
  let checkedOut;
  // A submodule checkout owns a `.git` entry (a directory for plain repos,
  // a "gitdir:" pointer file for standard submodule layouts). Without one,
  // git resolves to a PARENT repository — that is not the submodule.
  if (!existsSync(join(framework, ".git"))) {
    throw new Error(`the loom-realm submodule is not checked out at ${framework} — run \`git submodule update --init\` first`);
  }
  try {
    checkedOut = git(framework, "rev-parse", "HEAD");
  } catch {
    throw new Error(`the loom-realm submodule is not checked out at ${framework} — run \`git submodule update --init\` first`);
  }
  if (checkedOut !== gitlink) {
    throw new Error(
      `checked-out LoomRealm ${checkedOut} does not match the pinned repository Gitlink ${gitlink}; `
        + "the repository Gitlink is the only trusted pin — update it via a maintainer PR and check the submodule out exactly",
    );
  }
  return checkedOut;
}

/**
 * Builds the Adventure Island installation-bundle v1 payload from the
 * canonical root sources. `executableSources` maps logical module → physical
 * source path (relative to gameRoot or absolute) and `contentScriptSources`
 * maps Content identity → physical classic-script artifact; both are
 * injectable so tests can prove that non-sanctioned sources — the root or
 * apps/* shims, or the component's ESM sources — are rejected instead of
 * published. `adventureContent` produces the read-only FSDB closure and the
 * derived bootstrap plan ({entries, plan}); it is injectable so tests can
 * prove tampered Content fails the consistency checks.
 */
export async function buildAdventureIslandInstallationBundle({
  gameRoot = root,
  frameworkRoot,
  outputFile,
  verifyGitlink = true,
  executableSources = EXECUTABLE_SOURCE_BINDINGS,
  contentScriptSources = CONTENT_SCRIPT_SOURCE_BINDINGS,
  adventureContent = buildCanonicalAdventureAvatarContent,
} = {}) {
  const game = resolve(gameRoot);
  if (typeof outputFile !== "string" || outputFile.length === 0) {
    throw new TypeError("outputFile is required");
  }
  const frameworkSha = verifyGitlink
    ? assertFrameworkPin(game, frameworkRoot === undefined ? join(game, "loom-realm") : resolve(frameworkRoot))
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

  // Canonical Content (issue #62): the presentation script entries come from
  // the frozen whitelist below (classic IIFEs only — Controls first, Actor
  // second); the Avatar closure and the derived bootstrap plan record come
  // from the read-only adventure FSDB adapter. Assembly validates every entry
  // plus the plan/PNG identity+version consistency on the final bytes.
  const scriptEntries = [];
  for (const [identity, physicalPath] of Object.entries(contentScriptSources)) {
    const [kind, namespace, key] = identity.split("\0");
    if (kind !== "resource") {
      throw new TypeError("content script bindings must publish resource entries");
    }
    const source = await readFile(resolve(game, physicalPath), "utf8");
    assertClassicScriptSource(source, `${physicalPath} (Content script ${namespace}/${key})`);
    scriptEntries.push(Object.freeze({
      kind,
      namespace,
      key,
      mime: "text/javascript; charset=utf-8",
      bytes: Buffer.from(source, "utf8"),
    }));
  }
  const { content } = await assembleAdventureContent({
    scriptEntries,
    adventureContent: () => adventureContent({ gameRoot: game }),
  });

  // Every presentation resource reference must resolve to a published
  // resource entry through the pinned PWA hosting convention: the renderer
  // host fetches bootstrap scripts from Content namespace `resource.<namespace>`
  // (loom-realm apps/pwa/src/renderer-host.ts, resolveBootstrapResource).
  const contentIdentities = new Set(content.map((entry) => [entry.kind, entry.namespace, entry.key].join("\0")));
  for (const ref of [...presentation.styles, ...presentation.scripts]) {
    const identity = ["resource", `resource.${ref.namespace}`, ref.key].join("\0");
    if (!contentIdentities.has(identity)) {
      throw new TypeError(
        `presentation.json (root): resource ${ref.namespace}/${ref.key} has no Content entry `
          + `(expected published resource resource.${ref.namespace}/${ref.key})`,
      );
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
          + "the canonical application publishes the self-contained systems/* implementations, never an installation shim",
      );
    }
    const entryPoint = resolve(game, physicalPath);
    if (typeof physicalPath === "string" && !isAbsolute(physicalPath)
      && !physicalPath.replaceAll("\\", "/").startsWith("systems/")) {
      throw new TypeError(
        `launch.pwa.json (root): executable source "${physicalPath}" for "${binding.module}" is not a sanctioned systems/* implementation `
          + "(installation-root shims and apps/* bindings are load-time bindings, never publication sources)",
      );
    }
    const source = await bundleExecutableSource(game, entryPoint, binding.module);
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
  const canonical = await writeBundleSafely(destination, game, `${JSON.stringify(payload)}\n`);
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

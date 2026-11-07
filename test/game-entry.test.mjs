// Headless validation for the canonical root Game Entry (PWA migration 3A;
// Base → Adventure Map slice, issue #62).
//
// Deterministic base layer (no build, no network, no browser):
//   - the ROOT game.json is the canonical base → adventure-map entry; the
//     apps/pwa and apps/hostra Game Entries remain LEGACY SMOKE entries
//     (kept as isolated test fixtures — they are no longer required to equal
//     the canonical root entry);
//   - the root launch.pwa.json / launch.hostra.json bind exactly the Game
//     Entry subsystem key set to the same logical modules, and the physical
//     modules stay inside the repository installation root as thin re-export
//     shims of the single systems/* implementations;
//   - the root bindings forward the shared factories; the Base binding runs
//     its Controls-Producer/call/finally contract;
//   - neither the root shims nor the raw systems/* sources are publishable
//     PWA executables (the publication is the esbuild bundle built by
//     scripts/pwa/build-installation-bundle.mjs, pinned in
//     test/pwa-bundle.test.mjs).
//
// Optional deep layer (auto-enabled when the checked-out loom-realm submodule
// has been built): the same documents are validated through the real pinned
// LoomRealm APIs, and the repository root is used as a real Hostra
// installation root (prepareHostraGame) resolving both runtimes to the root
// shims. A runMain boot-to-completed-Frame is no longer possible for this
// entry: the adventure-map Frame intentionally stays active until cancelled
// (its lifecycle is pinned by test/adventure-runtime.test.mjs and the real
// PWA E2E instead).
//
// The structural rules mirrored below track the pinned submodule revision
// (93648192323bf5f57996b7b54cbae641d8a53fdb), exactly like
// systems/loomrealm-smoke/test/smoke.test.mjs, so drift surfaces as a failing
// assertion instead of a silent mismatch.

import assert from "node:assert/strict";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = new URL("../", import.meta.url);
const appsPwaRoot = new URL("apps/pwa/", repoRoot);
const appsHostraRoot = new URL("apps/hostra/", repoRoot);
const loomRealmRoot = new URL("loom-realm/", repoRoot);

const MODULE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ENCODER = new TextEncoder();

/** The canonical root entry: Base boots and calls Adventure Map. */
const EXPECTED_GAME_ENTRY = Object.freeze({
  formatVersion: 1,
  initial: Object.freeze({ subsystem: "base", input: null }),
  subsystems: Object.freeze([{ key: "base" }, { key: "adventure-map" }]),
});
const EXPECTED_LAUNCH_MANIFEST = Object.freeze({
  formatVersion: 1,
  subsystems: Object.freeze([
    Object.freeze({ key: "base", module: "subsystems/base.mjs" }),
    Object.freeze({ key: "adventure-map", module: "subsystems/adventure-map.mjs" }),
  ]),
});
/** The apps/* entries stay minimal LEGACY SMOKE fixtures (isolated tests). */
const EXPECTED_LEGACY_SMOKE_GAME_ENTRY = Object.freeze({
  formatVersion: 1,
  initial: Object.freeze({ subsystem: "smoke", input: null }),
  subsystems: Object.freeze([{ key: "smoke" }]),
});

const readText = (url) => readFile(url, "utf8");

// ---------------------------------------------------------------------------
// Structural validation mirroring the pinned LoomRealm rules
// ---------------------------------------------------------------------------

/** Mirrors the subsystem key rules shared by game-package, both launchers. */
function assertSubsystemKeyShape(key, label) {
  assert.equal(typeof key, "string", `${label}: subsystem key must be a string`);
  assert.ok(key.length > 0, `${label}: subsystem key must not be empty`);
  let encodable = true;
  try {
    encodeURIComponent(key);
  } catch {
    encodable = false;
  }
  assert.ok(encodable, `${label}: subsystem key contains unpaired surrogates`);
  assert.ok(
    ENCODER.encode(key).length <= 256,
    `${label}: subsystem key exceeds 256 UTF-8 bytes`,
  );
}

/** Mirrors validateLogicalModule (launch.hostra.json) / validatePwaLogicalModule. */
function assertLogicalModuleShape(module, label) {
  assert.equal(typeof module, "string", `${label}: module must be a string`);
  assert.ok(module.length > 0, `${label}: module must not be empty`);
  assert.ok(ENCODER.encode(module).length <= 512, `${label}: module exceeds 512 UTF-8 bytes`);
  assert.ok(module.endsWith(".mjs"), `${label}: module must end with .mjs`);
  assert.ok(!module.includes("\\"), `${label}: module must not contain backslashes`);
  assert.ok(!module.includes(":"), `${label}: module must not contain ":"`);
  const segments = module.split("/");
  assert.ok(
    !segments.some((segment) => segment === "" || segment === "." || segment === ".."),
    `${label}: module contains an empty, ".", or ".." segment`,
  );
  for (const segment of segments) {
    assert.match(segment, MODULE_SEGMENT, `${label}: invalid module segment "${segment}"`);
  }
}

/** Mirrors parseGameEntryV1 (loom-realm/packages/game-package/src/validate.ts). */
function validateGameEntryStructural(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    assert.fail(`${label}: not valid JSON (${cause.message})`);
  }
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label}: Game Entry must be a JSON object`,
  );
  const keys = Object.keys(value);
  for (const required of ["formatVersion", "initial", "subsystems"]) {
    assert.ok(keys.includes(required), `${label}: missing required key "${required}"`);
  }
  for (const key of keys) {
    assert.ok(
      ["formatVersion", "initial", "subsystems", "state"].includes(key),
      `${label}: unknown top-level key "${key}"`,
    );
  }
  assert.equal(value.formatVersion, 1, `${label}: formatVersion must be 1`);

  const initial = value.initial;
  assert.ok(
    initial !== null && typeof initial === "object" && !Array.isArray(initial),
    `${label}: initial must be an object`,
  );
  assert.deepEqual(
    Object.keys(initial).sort(),
    ["input", "subsystem"],
    `${label}: initial must have exactly "subsystem" and "input"`,
  );
  assert.equal(typeof initial.subsystem, "string", `${label}: initial.subsystem must be a string`);

  assert.ok(Array.isArray(value.subsystems), `${label}: subsystems must be an array`);
  const seen = new Set();
  for (const descriptor of value.subsystems) {
    assert.ok(
      descriptor !== null && typeof descriptor === "object" && !Array.isArray(descriptor),
      `${label}: subsystem descriptor must be an object`,
    );
    assert.deepEqual(Object.keys(descriptor), ["key"], `${label}: descriptor must have exactly "key"`);
    assertSubsystemKeyShape(descriptor.key, label);
    assert.ok(!seen.has(descriptor.key), `${label}: duplicate subsystem key "${descriptor.key}"`);
    seen.add(descriptor.key);
  }
  assert.ok(
    seen.has(initial.subsystem),
    `${label}: initial subsystem "${initial.subsystem}" is not declared`,
  );

  if ("state" in value) {
    // Deep Shared State semantics belong to @loomrealm/shared-state; only the
    // structural contract of the optional state section is checked here.
    const state = value.state;
    assert.ok(
      state !== null && typeof state === "object" && !Array.isArray(state),
      `${label}: state must be an object`,
    );
    assert.deepEqual(Object.keys(state), ["records"], `${label}: state must have exactly "records"`);
    assert.ok(Array.isArray(state.records), `${label}: state.records must be an array`);
  }
  return value;
}

/** Mirrors parsePwaLaunchManifestV1 / parseHostraLaunchManifest. */
function validateLaunchManifestStructural(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    assert.fail(`${label}: not valid JSON (${cause.message})`);
  }
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label}: launch manifest must be a JSON object`,
  );
  assert.deepEqual(
    Object.keys(value).sort(),
    ["formatVersion", "subsystems"],
    `${label}: launch manifest must have exactly "formatVersion" and "subsystems"`,
  );
  assert.equal(value.formatVersion, 1, `${label}: formatVersion must be 1`);
  assert.ok(Array.isArray(value.subsystems), `${label}: subsystems must be an array`);
  const seen = new Set();
  for (const binding of value.subsystems) {
    assert.ok(
      binding !== null && typeof binding === "object" && !Array.isArray(binding),
      `${label}: subsystem binding must be an object`,
    );
    assert.deepEqual(
      Object.keys(binding).sort(),
      ["key", "module"],
      `${label}: binding must have exactly "key" and "module"`,
    );
    assertSubsystemKeyShape(binding.key, label);
    assert.ok(!seen.has(binding.key), `${label}: duplicate binding key "${binding.key}"`);
    seen.add(binding.key);
    assertLogicalModuleShape(binding.module, label);
  }
  return value;
}

/** Mirrors joinBindings (loom-realm/packages/game-launcher-hostra/src/launch-plan.ts). */
function assertJoinedBindings(game, manifest, label) {
  const gameKeys = new Set(game.subsystems.map(({ key }) => key));
  const manifestKeys = new Set(manifest.subsystems.map(({ key }) => key));
  for (const key of gameKeys) {
    assert.ok(manifestKeys.has(key), `${label}: subsystem "${key}" has no platform binding`);
  }
  for (const key of manifestKeys) {
    assert.ok(gameKeys.has(key), `${label}: binding "${key}" is not declared by the Game Entry`);
  }
}

/** Mirrors canonicalizeInstallationRoot + resolveInstallationModule. */
async function resolveInstallationModuleFile(installationRootUrl, logicalModule, label) {
  const canonicalRoot = await realpath(fileURLToPath(installationRootUrl));
  assert.ok((await stat(canonicalRoot)).isDirectory(), `${label}: installation root is not a directory`);

  const lexical = path.resolve(canonicalRoot, ...logicalModule.split("/"));
  const relative = path.relative(canonicalRoot, lexical);
  assert.ok(
    relative !== "" && !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`),
    `${label}: module "${logicalModule}" escapes the installation root`,
  );
  const canonical = await realpath(lexical);
  assert.ok((await stat(canonical)).isFile(), `${label}: module "${logicalModule}" is not a regular file`);
  assert.ok(canonical.endsWith(".mjs"), `${label}: module "${logicalModule}" must resolve to a .mjs file`);
  const canonicalRelative = path.relative(canonicalRoot, canonical);
  assert.ok(
    canonicalRelative !== "" && !path.isAbsolute(canonicalRelative)
      && canonicalRelative !== ".." && !canonicalRelative.startsWith(`..${path.sep}`),
    `${label}: canonical module for "${logicalModule}" escapes the installation root`,
  );
  return canonical;
}

/** Resolves the `export ... from "..."` targets of an installation shim module. */
async function readShimReexportTargets(shimUrl, label) {
  const source = await readText(shimUrl);
  const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(specifiers.length > 0, `${label}: shim has no re-export targets`);
  return specifiers.map((specifier) => path.resolve(path.dirname(fileURLToPath(shimUrl)), specifier));
}

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
  const logicalModule = output.join("/");
  const segments = logicalModule.split("/");
  if (
    !logicalModule.endsWith(".mjs") || logicalModule.includes("\\") || logicalModule.includes(":")
    || segments.some((segment) => segment === "" || segment === "." || segment === ".." || !MODULE_SEGMENT.test(segment))
  ) {
    return { ok: false, code: "SUBSYSTEM_MODULE_INVALID" };
  }
  return { ok: true, logicalModule };
}

/** Collects the static/dynamic import specifiers of a module's source text. */
function readModuleEdges(source, label) {
  const specifiers = new Set();
  for (const match of source.matchAll(/from\s+"([^"]+)"/g)) specifiers.add(match[1]);
  for (const match of source.matchAll(/import\s*\(\s*"([^"]+)"/g)) specifiers.add(match[1]);
  for (const match of source.matchAll(/^\s*import\s+"([^"]+)"/gm)) specifiers.add(match[1]);
  return [...specifiers].map((specifier) => {
    assert.equal(typeof specifier, "string", `${label}: malformed import specifier`);
    return specifier;
  });
}

async function readRootLaunchManifests() {
  const pwaManifest = validateLaunchManifestStructural(
    await readText(new URL("launch.pwa.json", repoRoot)),
    "launch.pwa.json (root)",
  );
  const hostraManifest = validateLaunchManifestStructural(
    await readText(new URL("launch.hostra.json", repoRoot)),
    "launch.hostra.json (root)",
  );
  return { pwaManifest, hostraManifest };
}

// ---------------------------------------------------------------------------
// Deterministic base validation
// ---------------------------------------------------------------------------

test("the canonical root Game Entry is the base → adventure-map entry; apps/* stay legacy smoke fixtures", async () => {
  const rootGameText = await readText(new URL("game.json", repoRoot));
  const pwaGameText = await readText(new URL("game.json", appsPwaRoot));
  const hostraGameText = await readText(new URL("game.json", appsHostraRoot));
  const rootGame = validateGameEntryStructural(rootGameText, "game.json (root)");
  const pwaGame = validateGameEntryStructural(pwaGameText, "apps/pwa/game.json");
  const hostraGame = validateGameEntryStructural(hostraGameText, "apps/hostra/game.json");

  assert.deepEqual(rootGame, EXPECTED_GAME_ENTRY, "game.json (root) is not the canonical base → adventure-map Game Entry");
  assert.deepEqual(pwaGame, EXPECTED_LEGACY_SMOKE_GAME_ENTRY, "apps/pwa/game.json must stay the legacy smoke fixture");
  assert.deepEqual(hostraGame, EXPECTED_LEGACY_SMOKE_GAME_ENTRY, "apps/hostra/game.json must stay the legacy smoke fixture");
  assert.equal("state" in rootGame, false, "the canonical application carries no initial Shared State");
  assert.equal(rootGame.initial.input, null, "the canonical application starts from a null Frame input");
  assert.equal(rootGame.initial.subsystem, "base", "Base is the canonical initial Subsystem");
});

test("both root launch manifests bind exactly the Game Entry subsystem keys", async () => {
  const game = validateGameEntryStructural(await readText(new URL("game.json", repoRoot)), "game.json (root)");
  const { pwaManifest, hostraManifest } = await readRootLaunchManifests();

  assert.deepEqual(pwaManifest, EXPECTED_LAUNCH_MANIFEST, "launch.pwa.json (root) has unexpected content");
  assert.deepEqual(hostraManifest, EXPECTED_LAUNCH_MANIFEST, "launch.hostra.json (root) has unexpected content");
  assert.deepEqual(pwaManifest, hostraManifest, "both root launch manifests must be identical");
  assertJoinedBindings(game, pwaManifest, "launch.pwa.json (root)");
  assertJoinedBindings(game, hostraManifest, "launch.hostra.json (root)");

  const gameKeys = new Set(game.subsystems.map(({ key }) => key));
  for (const manifest of [pwaManifest, hostraManifest]) {
    assert.deepEqual(
      new Set(manifest.subsystems.map(({ key }) => key)),
      gameKeys,
      "root launch manifest keys must match the Game Entry key set exactly",
    );
  }
  for (const pwaBinding of pwaManifest.subsystems) {
    const hostraBinding = hostraManifest.subsystems.find(({ key }) => key === pwaBinding.key);
    assert.deepEqual(
      hostraBinding?.module,
      pwaBinding.module,
      `both root manifests must bind subsystem "${pwaBinding.key}" to the same logical module`,
    );
  }
});

test("the root bindings resolve to physical modules inside the repository installation root", async () => {
  const canonicalRoot = await realpath(fileURLToPath(repoRoot));
  const { pwaManifest, hostraManifest } = await readRootLaunchManifests();
  for (const [label, manifest] of [["launch.pwa.json (root)", pwaManifest], ["launch.hostra.json (root)", hostraManifest]]) {
    for (const { module } of manifest.subsystems) {
      const physical = await resolveInstallationModuleFile(repoRoot, module, label);
      assert.equal(
        path.relative(canonicalRoot, physical),
        module.split("/").join(path.sep),
        `${label}: physical module for "${module}" must be the repository-root file`,
      );
    }
  }
});

test("the root bindings re-export the shared implementations instead of duplicating them", async () => {
  const expectations = [
    ["subsystems/base.mjs", new URL("../systems/base/subsystem.mjs", import.meta.url)],
    ["subsystems/adventure-map.mjs", new URL("../systems/adventure-map/subsystem.mjs", import.meta.url)],
  ];
  for (const [shim, shared] of expectations) {
    const targets = await readShimReexportTargets(new URL(shim, repoRoot), `${shim} (root)`);
    const sharedPath = fileURLToPath(shared);
    const sharedReal = await realpath(sharedPath);
    assert.deepEqual(
      await Promise.all(targets.map((target) => realpath(target))),
      targets.map(() => sharedReal),
      `${shim} (root) must re-export ${relativeLabel(sharedPath)}`,
    );
  }
});

function relativeLabel(sharedPath) {
  const segments = sharedPath.split(path.sep);
  return `${segments.at(-2)}/subsystem.mjs`;
}

test("the root Base binding forwards the factory and runs its producer/call/finally contract", async () => {
  const used = [];
  const deny = (capability) => () => {
    used.push(capability);
    throw new Error(`the Base subsystem must not use ${capability}`);
  };
  const domains = [];
  const scope = Object.freeze({
    signal: new AbortController().signal,
    state: Object.freeze({ read: deny("state"), subscribe: deny("state") }),
    events: Object.freeze({ publish: deny("events"), subscribe: deny("events") }),
    content: Object.freeze({ record: deny("content.record"), group: deny("content.group"), resource: deny("content.resource") }),
    viewport: Object.freeze({ current: null, subscribe: deny("viewport.subscribe") }),
    presentationEvents: Object.freeze({ createListener: deny("presentationEvents.createListener") }),
    createRenderDomain: (state) => {
      const domain = { state, closed: false, update() {}, replace() {}, emit() {}, close() { domain.closed = true; } };
      domains.push(domain);
      return domain;
    },
  });
  const forwarded = [];
  const frame = Object.freeze({
    id: "root-base-frame-1",
    params: { turn: 1 },
    signal: new AbortController().signal,
    call: async (subsystem, params) => {
      forwarded.push({ subsystem, params });
      return Object.freeze({ type: "completed", value: { status: "ok", subsystem } });
    },
  });

  const sharedModule = await import(new URL("../systems/base/subsystem.mjs", import.meta.url).href);
  const rootShim = await import(new URL("subsystems/base.mjs", repoRoot).href);

  assert.equal(typeof sharedModule.default, "function", "the Base default export must be a factory function");
  assert.equal(rootShim.default, sharedModule.default, "the root binding must forward the shared Base factory");
  assert.equal(rootShim.BASE_SUBSYSTEM_KEY, "base");
  assert.equal(sharedModule.BASE_CHILD_SUBSYSTEM_KEY, "adventure-map");

  const definition = rootShim.default(scope);
  assert.equal(typeof definition.frame, "function", "the definition must expose frame()");

  const outcome = await definition.frame(frame);
  assert.deepEqual(outcome, { type: "completed", value: { status: "ok", subsystem: "adventure-map" } });
  assert.deepEqual(forwarded, [{ subsystem: "adventure-map", params: frame.params }]);
  assert.equal(forwarded[0].params, frame.params, "Frame params must be forwarded by identity");
  assert.equal(domains.length, 1, "exactly one Controls Producer RenderDomain");
  assert.deepEqual(domains[0].state, {
    zIndex: 0,
    roots: [{ key: "game-controls-input", tag: "game-controls-input", attrs: {}, data: {}, children: [] }],
  });
  assert.equal(domains[0].closed, true, "the producer closes with the child Frame");
  assert.deepEqual(used, [], "Base touches no scope capability besides createRenderDomain/frame.call");
});

test("the root Adventure Map binding forwards the shared factory", async () => {
  const sharedModule = await import(new URL("../systems/adventure-map/subsystem.mjs", import.meta.url).href);
  const rootShim = await import(new URL("subsystems/adventure-map.mjs", repoRoot).href);
  assert.equal(typeof sharedModule.default, "function", "the Map default export must be a factory function");
  assert.equal(rootShim.default, sharedModule.default, "the root binding must forward the shared Map factory");
  assert.equal(rootShim.AVATAR_PLAN_NAMESPACE, "struct.AdventureAvatarPlan");
  assert.equal(rootShim.AVATAR_PLAN_KEY, "bootstrap");
});

test("the root shims and the raw sources must never be published as PWA executables", async () => {
  // Calibrate the local mirror against the pinned graph-walker rules
  // (packages/game-launcher-pwa/src/index.ts, resolveRelativeModule).
  assert.deepEqual(
    resolveLogicalImport("subsystems/base.mjs", "../systems/base/subsystem.mjs"),
    { ok: true, logicalModule: "systems/base/subsystem.mjs" },
  );
  assert.deepEqual(
    resolveLogicalImport("subsystems/base.mjs", "../../../systems/base/subsystem.mjs"),
    { ok: false, code: "SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION" },
    "the apps/* shims' deeper escapes must stay out of bounds",
  );
  assert.deepEqual(
    resolveLogicalImport("subsystems/base.mjs", "@loomrealm/subsystem"),
    { ok: false, code: "SUBSYSTEM_MODULE_GRAPH_INVALID" },
    "bare package specifiers are not publishable executable edges",
  );

  const { pwaManifest, hostraManifest } = await readRootLaunchManifests();
  const declaredLogicalModules = new Set(
    [...pwaManifest.subsystems, ...hostraManifest.subsystems].map(({ module }) => module),
  );

  // The root shims are not self-contained: every module-graph edge leaves the
  // set of logical modules declared by the launch manifests, so a publication
  // built from those declared modules alone cannot satisfy a shim's import
  // graph (the deep test below pins the exact pinned-walker rejection).
  for (const [shimPath, from] of [
    ["subsystems/base.mjs", "subsystems/base.mjs"],
    ["subsystems/adventure-map.mjs", "subsystems/adventure-map.mjs"],
  ]) {
    const shimSource = await readText(new URL(shimPath, repoRoot));
    const edges = readModuleEdges(shimSource, `${shimPath} (root)`);
    assert.ok(edges.length > 0, `${shimPath} is expected to re-export the shared implementation`);
    for (const specifier of edges) {
      const resolved = resolveLogicalImport(from, specifier);
      assert.equal(resolved.ok, true, `${shimPath} edge "${specifier}" must stay inside the installation root`);
      assert.equal(
        declaredLogicalModules.has(resolved.logicalModule),
        false,
        `${shimPath} edge "${specifier}" resolves to "${resolved.logicalModule}", which the launch manifests do not declare`,
      );
    }
  }

  // The raw systems/* sources import the pinned framework packages as bare
  // specifiers — valid inside the repository workspace, but NOT publishable
  // as executables. The published executable for each logical module is the
  // self-contained esbuild bundle built by scripts/pwa/build-installation-bundle.mjs
  // (its dependency-free graph is pinned by test/pwa-bundle.test.mjs).
  for (const [sourcePath, allowedEdges] of [
    ["systems/base/subsystem.mjs", ["@loomrealm/subsystem"]],
    [
      "systems/adventure-map/subsystem.mjs",
      ["@loomrealm/subsystem", "@loomrealm-game/common-controls/subsystem"],
    ],
  ]) {
    const source = await readText(new URL(sourcePath, repoRoot));
    const edges = readModuleEdges(source, sourcePath);
    assert.deepEqual([...edges].sort(), [...allowedEdges].sort(), `${sourcePath} must import exactly the pinned framework packages`);
    for (const specifier of edges) {
      assert.deepEqual(
        resolveLogicalImport("subsystems/base.mjs", specifier),
        { ok: false, code: "SUBSYSTEM_MODULE_GRAPH_INVALID" },
        `the raw source edge "${specifier}" must be unpublishable — only the bundle ships`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Optional deep validation through the real pinned LoomRealm APIs
// ---------------------------------------------------------------------------

async function tryImportLoomRealmPackage(packagePath) {
  try {
    return await import(new URL(packagePath, loomRealmRoot).href);
  } catch {
    // The submodule is either not built or its workspace dependencies are not
    // installed. The deterministic base layer above still fully applies.
    return null;
  }
}

const gamePackage = await tryImportLoomRealmPackage("packages/game-package/dist/index.js");
const pwaLauncher = await tryImportLoomRealmPackage("packages/game-launcher-pwa/dist/index.js");
const hostraLauncher = await tryImportLoomRealmPackage("packages/game-launcher-hostra/dist/index.js");
// parseHostraLaunchManifest is an internal module of @loomrealm/game-launcher-hostra
// (not re-exported by the package index), so it is imported from its dist file.
const hostraManifestModule = await tryImportLoomRealmPackage("packages/game-launcher-hostra/dist/manifest.js");

const deepValidationAvailable = Boolean(gamePackage && pwaLauncher && hostraLauncher && hostraManifestModule);

const UNBUILT_NOTE = "loom-realm packages are not built; run `npm install && npm run build:packages` inside loom-realm/ to enable deep validation";

test("built LoomRealm APIs validate the root Game Entry and both launch compositions", { skip: !deepValidationAvailable && UNBUILT_NOTE }, async () => {
  const game = gamePackage.parseGameEntryV1(await readText(new URL("game.json", repoRoot)));
  assert.deepEqual(game, EXPECTED_GAME_ENTRY);

  const pwaManifest = pwaLauncher.parsePwaLaunchManifestV1(await readText(new URL("launch.pwa.json", repoRoot)));
  assert.deepEqual(pwaManifest, EXPECTED_LAUNCH_MANIFEST);
  const hostraManifest = hostraManifestModule.parseHostraLaunchManifest(await readText(new URL("launch.hostra.json", repoRoot)));
  assert.deepEqual(hostraManifest, EXPECTED_LAUNCH_MANIFEST);

  // The repository root itself is a real Hostra installation root: prepare
  // resolves BOTH logical modules to the physical root shims. Executing the
  // full Base → Map boot here is no longer a completed-Frame story (the Map
  // Frame stays active until cancelled); that lifecycle is pinned by
  // test/adventure-runtime.test.mjs and the real PWA E2E.
  const prepared = await hostraLauncher.prepareHostraGame({
    source: { installationRoot: fileURLToPath(repoRoot) },
    runnerPolicy: {
      helloDeadlineMs: 5_000,
      frameDeadlineMs: 5_000,
      terminalCleanupDeadlineMs: 1_000,
      terminationGraceMs: 100,
    },
  });
  assert.deepEqual(prepared.logicalBootstrap.subsystemKeys, ["base", "adventure-map"]);
  assert.deepEqual(prepared.logicalBootstrap.initial, { subsystemKey: "base", input: null });
  assert.ok(Array.isArray(prepared.state.records) && prepared.state.records.length === 0);
  assert.equal(prepared.launchPlan.runtimes.length, 2);
  assert.deepEqual(
    prepared.launchPlan.runtimes.map((runtime) => [runtime.subsystemKey, runtime.logicalModule]),
    [
      ["base", "subsystems/base.mjs"],
      ["adventure-map", "subsystems/adventure-map.mjs"],
    ],
  );
  const repoReal = await realpath(fileURLToPath(repoRoot));
  for (const runtime of prepared.launchPlan.runtimes) {
    assert.equal(
      path.relative(repoReal, runtime.physicalModule),
      path.join("subsystems", `${runtime.subsystemKey}.mjs`),
      "the physical module must be the repository-root binding, not an apps/* shim",
    );
  }

  // PWA publication contract: the raw sources' bare framework imports are
  // rejected by the real pinned graph builder (bare specifiers are invalid
  // executable edges) — only the self-contained esbuild bundle published by
  // scripts/pwa/build-installation-bundle.mjs is a valid executable (its
  // empty import graph is pinned by test/pwa-bundle.test.mjs).
  const baseSource = await readText(new URL("../systems/base/subsystem.mjs", import.meta.url));
  await assert.rejects(
    pwaLauncher.buildPwaExecutableIndexV1([
      { logicalModule: "subsystems/base.mjs", source: baseSource, contentVersion: "sha256:" + "0".repeat(64) },
    ]),
    (error) => {
      assert.equal(error?.code, "SUBSYSTEM_MODULE_GRAPH_INVALID");
      return true;
    },
    "publishing the raw Base source directly must fail the PWA executable graph",
  );

  // The installation-root shims' own sources must NOT be published as-is
  // either: their re-export targets are outside the executable set declared
  // by the launch manifests.
  const shimSource = await readText(new URL("subsystems/base.mjs", repoRoot));
  await assert.rejects(
    pwaLauncher.buildPwaExecutableIndexV1([
      { logicalModule: "subsystems/base.mjs", source: shimSource, contentVersion: "sha256:" + "1".repeat(64) },
    ]),
    (error) => {
      assert.equal(error?.code, "SUBSYSTEM_MODULE_NOT_FOUND");
      return true;
    },
    "publishing the root shim source directly must fail the PWA executable graph",
  );
});

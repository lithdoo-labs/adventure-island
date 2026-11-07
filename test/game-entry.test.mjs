// Headless validation for the canonical root Game Entry (PWA migration 3A).
//
// Deterministic base layer (no build, no network, no browser):
//   - the root game.json is the canonical base → adventure-map entry;
//   - apps/pwa and apps/hostra stay isolated legacy Smoke entries and are
//     not required to equal the canonical entry;
//   - the root launch manifests bind exactly the canonical subsystem keys;
//   - each root binding stays inside the installation root and re-exports
//     the single systems/* implementation;
//   - the legacy smoke shim still forwards the shared no-op factory;
//   - canonical shims are not publishable as PWA executables.
//
// Optional deep layer (auto-enabled when the checked-out loom-realm submodule
// has been built): the same documents are validated through the real pinned
// LoomRealm APIs, the repository root is used as a real Hostra installation
// root until a completed Frame, and the PWA executable-graph contract
// (shared dependency-free source in, root shim source out) is enforced by
// the real buildPwaExecutableIndexV1.
//
// The structural rules mirrored below track the pinned submodule revision
// (c5217e47be5a43f974e9e6ce82230077fb639c39), exactly like
// systems/loomrealm-smoke/test/smoke.test.mjs, so drift surfaces as a failing
// assertion instead of a silent mismatch.

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = new URL("../", import.meta.url);
const appsPwaRoot = new URL("apps/pwa/", repoRoot);
const appsHostraRoot = new URL("apps/hostra/", repoRoot);
const smokeSystemRoot = new URL("systems/loomrealm-smoke/", repoRoot);
const sharedSubsystemUrl = new URL("subsystem.mjs", smokeSystemRoot);
const loomRealmRoot = new URL("loom-realm/", repoRoot);

const MODULE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ENCODER = new TextEncoder();

const EXPECTED_GAME_ENTRY = Object.freeze({
  formatVersion: 1,
  initial: Object.freeze({ subsystem: "base", input: null }),
  subsystems: Object.freeze([{ key: "base" }, { key: "adventure-map" }]),
});
const EXPECTED_LAUNCH_MANIFEST = Object.freeze({
  formatVersion: 1,
  subsystems: Object.freeze([
    { key: "base", module: "subsystems/base.mjs" },
    { key: "adventure-map", module: "subsystems/adventure-map.mjs" },
  ]),
});
const LEGACY_SMOKE_GAME_ENTRY = Object.freeze({
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

test("the canonical root Game Entry is base and the platform apps stay legacy Smoke", async () => {
  const rootGame = validateGameEntryStructural(await readText(new URL("game.json", repoRoot)), "game.json (root)");
  const pwaGame = validateGameEntryStructural(await readText(new URL("game.json", appsPwaRoot)), "apps/pwa/game.json");
  const hostraGame = validateGameEntryStructural(await readText(new URL("game.json", appsHostraRoot)), "apps/hostra/game.json");

  assert.deepEqual(rootGame, EXPECTED_GAME_ENTRY, "game.json (root) must start at base and declare adventure-map");
  assert.deepEqual(pwaGame, LEGACY_SMOKE_GAME_ENTRY, "apps/pwa remains the isolated legacy Smoke entry");
  assert.deepEqual(hostraGame, LEGACY_SMOKE_GAME_ENTRY, "apps/hostra remains the isolated legacy Smoke entry");
  assert.equal("state" in rootGame, false, "this slice carries no initial Shared State");
  assert.equal(rootGame.initial.input, null);
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

test("canonical root bindings re-export the single Base and Adventure Map implementations", async () => {
  const cases = [
    ["subsystems/base.mjs", "systems/base/subsystem.mjs"],
    ["subsystems/adventure-map.mjs", "systems/adventure-map/subsystem.mjs"],
  ];
  for (const [shim, implementation] of cases) {
    const targets = await readShimReexportTargets(new URL(shim, repoRoot), `${shim} (root)`);
    const shared = await realpath(fileURLToPath(new URL(implementation, repoRoot)));
    assert.deepEqual(
      await Promise.all(targets.map((target) => realpath(target))),
      targets.map(() => shared),
      `${shim} must re-export ${implementation}`,
    );
    const shimModule = await import(new URL(shim, repoRoot).href);
    const systemModule = await import(new URL(implementation, repoRoot).href);
    assert.equal(shimModule.default, systemModule.default, `${shim} must forward the same factory`);
  }

  const legacyTargets = await readShimReexportTargets(new URL("subsystems/smoke.mjs", repoRoot), "subsystems/smoke.mjs (legacy)");
  const legacy = await realpath(fileURLToPath(sharedSubsystemUrl));
  assert.deepEqual(
    await Promise.all(legacyTargets.map((target) => realpath(target))),
    legacyTargets.map(() => legacy),
    "the legacy smoke shim must keep re-exporting systems/loomrealm-smoke/subsystem.mjs",
  );
});

test("the legacy smoke binding forwards the shared factory and completes Frames deterministically", async () => {
  const used = [];
  const deny = (capability) => () => {
    used.push(capability);
    throw new Error(`the smoke subsystem must not use ${capability}`);
  };
  const scope = Object.freeze({
    signal: new AbortController().signal,
    state: Object.freeze({
      read: deny("state.read"), readInitial: deny("state.readInitial"), list: deny("state.list"),
      scan: deny("state.scan"), commit: deny("state.commit"), subscribe: deny("state.subscribe"),
    }),
    events: Object.freeze({ publish: deny("events.publish"), subscribe: deny("events.subscribe") }),
    content: Object.freeze({ record: deny("content.record"), group: deny("content.group"), resource: deny("content.resource") }),
    viewport: Object.freeze({ current: null, subscribe: deny("viewport.subscribe") }),
    presentationEvents: Object.freeze({ createListener: deny("presentationEvents.createListener") }),
    createRenderDomain: deny("createRenderDomain"),
  });
  const frame = Object.freeze({
    id: "root-smoke-frame-1",
    params: null,
    signal: new AbortController().signal,
    call: deny("frame.call"),
  });

  const sharedModule = await import(sharedSubsystemUrl.href);
  const rootShim = await import(new URL("subsystems/smoke.mjs", repoRoot).href);

  assert.equal(typeof sharedModule.default, "function", "subsystem default export must be a factory function");
  assert.equal(rootShim.default, sharedModule.default, "the root binding must forward the shared factory");
  assert.equal(rootShim.SMOKE_SUBSYSTEM_KEY, "smoke");
  assert.equal(rootShim.SMOKE_FRAME_VALUE, sharedModule.SMOKE_FRAME_VALUE);

  const definition = rootShim.default(scope);
  assert.equal(typeof definition.frame, "function", "the definition must expose frame()");

  const first = definition.frame(frame);
  assert.deepEqual(first, { type: "completed", value: { status: "ok", subsystem: "smoke" } });
  assert.equal(Object.isFrozen(first), true, "FrameOutcome must be frozen like @loomrealm/subsystem completed()");
  assert.deepEqual(definition.frame(frame), first, "the no-op subsystem must complete every Frame identically");
  assert.deepEqual(used, [], "the no-op subsystem must not touch any scope capability or call other subsystems");
});

test("canonical shims must never be published directly as PWA executables", async () => {
  // Calibrate the local mirror against the pinned graph-walker rules
  // (packages/game-launcher-pwa/src/index.ts, resolveRelativeModule).
  assert.deepEqual(
    resolveLogicalImport("subsystems/smoke.mjs", "../systems/loomrealm-smoke/subsystem.mjs"),
    { ok: true, logicalModule: "systems/loomrealm-smoke/subsystem.mjs" },
  );
  assert.deepEqual(
    resolveLogicalImport("subsystems/smoke.mjs", "../../../systems/loomrealm-smoke/subsystem.mjs"),
    { ok: false, code: "SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION" },
    "the apps/* shims' deeper escapes must stay out of bounds",
  );
  assert.deepEqual(
    resolveLogicalImport("subsystems/smoke.mjs", "@loomrealm/subsystem"),
    { ok: false, code: "SUBSYSTEM_MODULE_GRAPH_INVALID" },
    "bare package specifiers are not publishable executable edges",
  );

  const { pwaManifest, hostraManifest } = await readRootLaunchManifests();
  const declaredLogicalModules = new Set(
    [...pwaManifest.subsystems, ...hostraManifest.subsystems].map(({ module }) => module),
  );

  // The root shim is not self-contained: every module-graph edge leaves the
  // set of logical modules declared by the launch manifests. A publication
  // built from those declared modules alone therefore cannot satisfy the
  // shim's import graph — publishing the shim source directly is rejected by
  // the pinned walker (deep test below pins the exact code).
  for (const logicalModule of ["subsystems/base.mjs", "subsystems/adventure-map.mjs"]) {
    const shimSource = await readText(new URL(logicalModule, repoRoot));
    const edges = readModuleEdges(shimSource, `${logicalModule} (root)`);
    assert.ok(edges.length > 0, `${logicalModule} is a shim and must re-export its implementation`);
    for (const specifier of edges) {
      const resolved = resolveLogicalImport(logicalModule, specifier);
      assert.equal(resolved.ok, true, `${logicalModule} edge "${specifier}" must stay inside the installation root`);
      assert.equal(
        declaredLogicalModules.has(resolved.logicalModule),
        false,
        `${logicalModule} edge "${specifier}" resolves to "${resolved.logicalModule}", which the launch manifests do not declare`,
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
const mainRuntime = await tryImportLoomRealmPackage("packages/main/dist/index.js");
const sharedState = await tryImportLoomRealmPackage("packages/shared-state/dist/index.js");
const sessionEvents = await tryImportLoomRealmPackage("packages/session-events/dist/index.js");

const deepValidationAvailable = Boolean(gamePackage && pwaLauncher && hostraLauncher && hostraManifestModule);
const deepLaunchAvailable = deepValidationAvailable
  && mainRuntime !== null && sharedState !== null && sessionEvents !== null;

const UNBUILT_NOTE = "loom-realm packages are not built; run `npm install && npm run build:packages` inside loom-realm/ to enable deep validation";

test("built LoomRealm APIs validate the root Game Entry and both launch compositions", { skip: !deepValidationAvailable && UNBUILT_NOTE }, async () => {
  const game = gamePackage.parseGameEntryV1(await readText(new URL("game.json", repoRoot)));
  assert.deepEqual(game, EXPECTED_GAME_ENTRY);

  const pwaManifest = pwaLauncher.parsePwaLaunchManifestV1(await readText(new URL("launch.pwa.json", repoRoot)));
  assert.deepEqual(pwaManifest, EXPECTED_LAUNCH_MANIFEST);
  const hostraManifest = hostraManifestModule.parseHostraLaunchManifest(await readText(new URL("launch.hostra.json", repoRoot)));
  assert.deepEqual(hostraManifest, EXPECTED_LAUNCH_MANIFEST);

  // The repository root itself is a real Hostra installation root: prepare
  // resolves the logical module to the physical root binding.
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
  const byKey = new Map(prepared.launchPlan.runtimes.map((runtime) => [runtime.subsystemKey, runtime]));
  for (const [key, logicalModule] of [["base", "subsystems/base.mjs"], ["adventure-map", "subsystems/adventure-map.mjs"]]) {
    assert.equal(byKey.get(key).logicalModule, logicalModule);
    assert.equal(
      path.relative(await realpath(fileURLToPath(repoRoot)), byKey.get(key).physicalModule),
      logicalModule.split("/").join(path.sep),
      `the physical module for ${key} must be the repository-root binding`,
    );
  }

  // Publishing a shim source directly is rejected: its re-export is not in
  // the executable set. The self-contained bundle is what PWA publishes.
  const shimSource = await readText(new URL("subsystems/base.mjs", repoRoot));
  const shimContentVersion = `sha256:${createHash("sha256").update(shimSource).digest("hex")}`;
  await assert.rejects(
    pwaLauncher.buildPwaExecutableIndexV1([
      { logicalModule: "subsystems/base.mjs", source: shimSource, contentVersion: shimContentVersion },
    ]),
    (error) => {
      assert.equal(error?.code, "SUBSYSTEM_MODULE_NOT_FOUND");
      return true;
    },
    "publishing the root shim source directly must fail the PWA executable graph",
  );
});

test("Hostra preparation resolves the canonical bindings and does not treat them as Smoke", { skip: !deepLaunchAvailable && UNBUILT_NOTE }, async () => {
  // Live Hostra/desktop execution of this slice is BLOCKED: there is no
  // Hostra Content installation in this checkout. This test only proves the
  // launch plan names base and adventure-map. The active Frame lifecycle is
  // covered by test/adventure-runtime.test.mjs and the PWA E2E.
  const prepared = await hostraLauncher.prepareHostraGame({
    source: { installationRoot: fileURLToPath(repoRoot) },
    runnerPolicy: {
      helloDeadlineMs: 5_000,
      frameDeadlineMs: 5_000,
      terminalCleanupDeadlineMs: 1_000,
      terminationGraceMs: 100,
    },
  });
  assert.deepEqual(prepared.logicalBootstrap.initial, { subsystemKey: "base", input: null });
  assert.deepEqual(prepared.launchPlan.runtimes.map((runtime) => runtime.subsystemKey), ["base", "adventure-map"]);
  assert.equal(prepared.logicalBootstrap.subsystemKeys.includes("smoke"), false);
});

function withDeadline(promise, deadlineMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not finish within ${deadlineMs}ms`)), deadlineMs);
    timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

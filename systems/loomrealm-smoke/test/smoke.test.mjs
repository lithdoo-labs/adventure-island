// Headless smoke validation for the empty LoomRealm application scaffold.
//
// Deterministic base layer (no build, no network, no browser):
//   - both platform entries declare the identical minimal Game Entry V1;
//   - the PWA and Hostra launch compositions resolve against their
//     installation roots;
//   - the no-op smoke subsystem imports, constructs, and completes Frames;
//   - the pinned loom-realm submodule references this scaffold relies on
//     are present.
//
// Optional deep layer (auto-enabled when the checked-out loom-realm submodule
// has been built with `npm install && npm run build:packages` inside
// loom-realm/): the same documents are validated through the real pinned
// LoomRealm APIs, and the empty application is actually booted through real
// Main + Hostra hosting until the initial Frame completes.
//
// The structural rules mirrored below track the pinned submodule revision
// (c5217e47be5a43f974e9e6ce82230077fb639c39) and are cross-checked against
// the pinned PokeMan reference files in a test, so drift surfaces as a
// failing assertion instead of a silent mismatch.

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { access, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = new URL("../../../", import.meta.url);
const appsPwaRoot = new URL("apps/pwa/", repoRoot);
const appsHostraRoot = new URL("apps/hostra/", repoRoot);
const smokeSystemRoot = new URL("systems/loomrealm-smoke/", repoRoot);
const sharedSubsystemUrl = new URL("subsystem.mjs", smokeSystemRoot);
const loomRealmRoot = new URL("loom-realm/", repoRoot);

const MODULE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ENCODER = new TextEncoder();

const EXPECTED_GAME_ENTRY = Object.freeze({
  formatVersion: 1,
  initial: Object.freeze({ subsystem: "smoke", input: null }),
  subsystems: Object.freeze([{ key: "smoke" }]),
});
const EXPECTED_LAUNCH_MANIFEST = Object.freeze({
  formatVersion: 1,
  subsystems: Object.freeze([{ key: "smoke", module: "subsystems/smoke.mjs" }]),
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

// ---------------------------------------------------------------------------
// Deterministic base validation
// ---------------------------------------------------------------------------

test("both platform entries declare the identical minimal Game Entry V1 topology", async () => {
  const pwaGameText = await readText(new URL("game.json", appsPwaRoot));
  const hostraGameText = await readText(new URL("game.json", appsHostraRoot));
  const pwaGame = validateGameEntryStructural(pwaGameText, "apps/pwa/game.json");
  const hostraGame = validateGameEntryStructural(hostraGameText, "apps/hostra/game.json");

  assert.deepEqual(pwaGame, EXPECTED_GAME_ENTRY, "apps/pwa/game.json is not the minimal smoke Game Entry");
  assert.deepEqual(hostraGame, EXPECTED_GAME_ENTRY, "apps/hostra/game.json is not the minimal smoke Game Entry");
  assert.deepEqual(pwaGame, hostraGame, "the two platform entries must be the same empty application");
  assert.equal("state" in pwaGame, false, "the empty application carries no initial Shared State");
  assert.equal(pwaGame.initial.input, null, "the empty application starts from a null Frame input");
});

test("the PWA launch composition resolves against the PWA installation root", async () => {
  const manifest = validateLaunchManifestStructural(
    await readText(new URL("launch.pwa.json", appsPwaRoot)),
    "apps/pwa/launch.pwa.json",
  );
  const game = validateGameEntryStructural(await readText(new URL("game.json", appsPwaRoot)), "apps/pwa/game.json");
  assert.deepEqual(manifest, EXPECTED_LAUNCH_MANIFEST);
  assertJoinedBindings(game, manifest, "apps/pwa");

  const physical = await resolveInstallationModuleFile(appsPwaRoot, "subsystems/smoke.mjs", "apps/pwa");
  assert.ok(physical.endsWith(path.join("apps", "pwa", "subsystems", "smoke.mjs")));

  const targets = await readShimReexportTargets(new URL("subsystems/smoke.mjs", appsPwaRoot), "apps/pwa");
  const shared = await realpath(fileURLToPath(sharedSubsystemUrl));
  assert.deepEqual(
    await Promise.all(targets.map((target) => realpath(target))),
    targets.map(() => shared),
    "apps/pwa/subsystems/smoke.mjs must re-export systems/loomrealm-smoke/subsystem.mjs",
  );
});

test("the Hostra launch composition resolves against the Hostra installation root", async () => {
  const manifest = validateLaunchManifestStructural(
    await readText(new URL("launch.hostra.json", appsHostraRoot)),
    "apps/hostra/launch.hostra.json",
  );
  const game = validateGameEntryStructural(await readText(new URL("game.json", appsHostraRoot)), "apps/hostra/game.json");
  assert.deepEqual(manifest, EXPECTED_LAUNCH_MANIFEST);
  assertJoinedBindings(game, manifest, "apps/hostra");

  const physical = await resolveInstallationModuleFile(appsHostraRoot, "subsystems/smoke.mjs", "apps/hostra");
  assert.ok(physical.endsWith(path.join("apps", "hostra", "subsystems", "smoke.mjs")));

  const targets = await readShimReexportTargets(new URL("subsystems/smoke.mjs", appsHostraRoot), "apps/hostra");
  const shared = await realpath(fileURLToPath(sharedSubsystemUrl));
  assert.deepEqual(
    await Promise.all(targets.map((target) => realpath(target))),
    targets.map(() => shared),
    "apps/hostra/subsystems/smoke.mjs must re-export systems/loomrealm-smoke/subsystem.mjs",
  );
});

test("the no-op subsystem imports, constructs, and completes Frames deterministically", async () => {
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
    id: "smoke-frame-1",
    params: null,
    signal: new AbortController().signal,
    call: deny("frame.call"),
  });

  const sharedModule = await import(sharedSubsystemUrl.href);
  const pwaShim = await import(new URL("subsystems/smoke.mjs", appsPwaRoot).href);
  const hostraShim = await import(new URL("subsystems/smoke.mjs", appsHostraRoot).href);

  assert.equal(typeof sharedModule.default, "function", "subsystem default export must be a factory function");
  assert.equal(pwaShim.default, sharedModule.default, "the PWA shim must forward the shared factory");
  assert.equal(hostraShim.default, sharedModule.default, "the Hostra shim must forward the shared factory");
  assert.equal(pwaShim.SMOKE_SUBSYSTEM_KEY, "smoke");
  assert.equal(pwaShim.SMOKE_FRAME_VALUE, sharedModule.SMOKE_FRAME_VALUE);

  const definition = sharedModule.default(scope);
  assert.equal(typeof definition.frame, "function", "the definition must expose frame()");

  const first = definition.frame(frame);
  assert.deepEqual(first, { type: "completed", value: { status: "ok", subsystem: "smoke" } });
  assert.equal(Object.isFrozen(first), true, "FrameOutcome must be frozen like @loomrealm/subsystem completed()");
  assert.deepEqual(definition.frame(frame), first, "the no-op subsystem must complete every Frame identically");
  assert.deepEqual(used, [], "the no-op subsystem must not touch any scope capability or call other subsystems");
});

test("the pinned PokeMan reference topology still satisfies the same structural rules", async () => {
  const pokemanRoot = new URL("examples/PokeMan/", loomRealmRoot);
  const game = validateGameEntryStructural(await readText(new URL("game.json", pokemanRoot)), "PokeMan game.json");
  assert.deepEqual(game.subsystems, [{ key: "base" }, { key: "map" }, { key: "dialogue" }]);
  assert.equal(game.initial.subsystem, "base");
  assert.equal(typeof game.initial.input.mapId, "number");

  const pwa = validateLaunchManifestStructural(await readText(new URL("launch.pwa.json", pokemanRoot)), "PokeMan launch.pwa.json");
  const hostra = validateLaunchManifestStructural(await readText(new URL("launch.hostra.json", pokemanRoot)), "PokeMan launch.hostra.json");
  assert.deepEqual(pwa.subsystems, hostra.subsystems);
  for (const binding of pwa.subsystems) {
    await resolveInstallationModuleFile(pokemanRoot, binding.module, "PokeMan");
  }
});

test("the pinned loom-realm APIs this scaffold depends on are present in the submodule", async () => {
  const pinnedFiles = [
    "packages/game-package/src/index.ts",
    "packages/game-package/src/model.ts",
    "packages/game-package/src/validate.ts",
    "packages/game-package/src/snapshot.ts",
    "packages/game-launcher-pwa/src/index.ts",
    "packages/game-launcher-hostra/src/index.ts",
    "packages/game-launcher-hostra/src/manifest.ts",
    "packages/game-launcher-hostra/src/prepare.ts",
    "packages/game-launcher-hostra/src/launch-plan.ts",
    "packages/game-launcher-hostra/src/module-resolver.ts",
    "packages/game-launcher-hostra/src/runner/bootstrap.ts",
    "packages/subsystem/src/index.ts",
    "packages/subsystem/src/model.ts",
    "packages/subsystem/src/outcome.ts",
    "packages/main/src/index.ts",
    "examples/PokeMan/game.json",
    "examples/PokeMan/launch.pwa.json",
    "examples/PokeMan/launch.hostra.json",
    "examples/PokeMan/subsystems/_empty.mjs",
    "examples/PokeMan/test/map-smoke.test.mjs",
    "examples/PokeMan/test/pwa-content.test.mjs",
    "packages/game-launcher-hostra/test/e2e.test.mjs",
  ];
  for (const file of pinnedFiles) {
    await assert.doesNotReject(
      access(new URL(file, loomRealmRoot)),
      `missing pinned loom-realm file: ${file}`,
    );
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
const subsystemSdk = await tryImportLoomRealmPackage("packages/subsystem/dist/index.js");
const mainRuntime = await tryImportLoomRealmPackage("packages/main/dist/index.js");
const sharedState = await tryImportLoomRealmPackage("packages/shared-state/dist/index.js");
const sessionEvents = await tryImportLoomRealmPackage("packages/session-events/dist/index.js");

const deepValidationAvailable = Boolean(gamePackage && pwaLauncher && hostraLauncher && hostraManifestModule);
const deepSdkAvailable = deepValidationAvailable && subsystemSdk !== null;
const deepLaunchAvailable = deepValidationAvailable
  && mainRuntime !== null && sharedState !== null && sessionEvents !== null;

const UNBUILT_NOTE = "loom-realm packages are not built; run `npm install && npm run build:packages` inside loom-realm/ to enable deep validation";

test("built LoomRealm APIs validate the Game Entry and both launch compositions", { skip: !deepValidationAvailable && UNBUILT_NOTE }, async () => {
  const pwaGameText = await readText(new URL("game.json", appsPwaRoot));
  const hostraGameText = await readText(new URL("game.json", appsHostraRoot));
  const game = gamePackage.parseGameEntryV1(pwaGameText);
  assert.deepEqual(game, EXPECTED_GAME_ENTRY);
  assert.deepEqual(gamePackage.parseGameEntryV1(hostraGameText), game);

  const pwaManifest = pwaLauncher.parsePwaLaunchManifestV1(await readText(new URL("launch.pwa.json", appsPwaRoot)));
  assert.deepEqual(pwaManifest, EXPECTED_LAUNCH_MANIFEST);
  const hostraManifest = hostraManifestModule.parseHostraLaunchManifest(await readText(new URL("launch.hostra.json", appsHostraRoot)));
  assert.deepEqual(hostraManifest, EXPECTED_LAUNCH_MANIFEST);

  const prepared = await hostraLauncher.prepareHostraGame({
    source: { installationRoot: fileURLToPath(appsHostraRoot) },
    runnerPolicy: {
      helloDeadlineMs: 5_000,
      frameDeadlineMs: 5_000,
      terminalCleanupDeadlineMs: 1_000,
      terminationGraceMs: 100,
    },
  });
  assert.deepEqual(prepared.logicalBootstrap.subsystemKeys, ["smoke"]);
  assert.deepEqual(prepared.logicalBootstrap.initial, { subsystemKey: "smoke", input: null });
  assert.ok(Array.isArray(prepared.state.records) && prepared.state.records.length === 0);
  assert.equal(prepared.launchPlan.runtimes.length, 1);
  assert.equal(prepared.launchPlan.runtimes[0].subsystemKey, "smoke");
  assert.equal(prepared.launchPlan.runtimes[0].logicalModule, "subsystems/smoke.mjs");
  assert.ok(prepared.launchPlan.runtimes[0].physicalModule.endsWith(path.join("apps", "hostra", "subsystems", "smoke.mjs")));

  // PWA publication contract: the executable published for the logical module
  // `subsystems/smoke.mjs` is the dependency-free shared implementation (its
  // import graph is empty), exactly like PokeMan publishes bundled
  // dependency-free artifacts instead of its source subsystem files.
  const source = await readText(sharedSubsystemUrl);
  const contentVersion = `sha256:${createHash("sha256").update(source).digest("hex")}`;
  const executableIndex = await pwaLauncher.buildPwaExecutableIndexV1([
    { logicalModule: "subsystems/smoke.mjs", source, contentVersion },
  ]);
  assert.deepEqual(executableIndex, [{ logicalModule: "subsystems/smoke.mjs", contentVersion, imports: [] }]);

  // The installation-root shim's own source must NOT be published as-is: its
  // re-export specifier escapes the PWA installation's logical root, and the
  // pinned graph walker rejects it. This guard keeps the publication
  // substitution above explicit instead of accidental.
  const shimSource = await readText(new URL("subsystems/smoke.mjs", appsPwaRoot));
  const shimContentVersion = `sha256:${createHash("sha256").update(shimSource).digest("hex")}`;
  await assert.rejects(
    pwaLauncher.buildPwaExecutableIndexV1([
      { logicalModule: "subsystems/smoke.mjs", source: shimSource, contentVersion: shimContentVersion },
    ]),
    (error) => {
      assert.equal(error?.code, "SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION");
      return true;
    },
    "publishing the shim source directly must fail the PWA executable graph",
  );
});

test("built LoomRealm SDK agrees with the dependency-free smoke ABI", { skip: !deepSdkAvailable && UNBUILT_NOTE }, async () => {
  const sharedModule = await import(sharedSubsystemUrl.href);
  assert.equal(subsystemSdk.defineSubsystem(sharedModule.default), sharedModule.default);
  const definition = sharedModule.default(Object.freeze({}));
  assert.deepEqual(
    definition.frame(Object.freeze({ id: "f", params: null, signal: new AbortController().signal })),
    subsystemSdk.completed({ status: "ok", subsystem: "smoke" }),
  );
});

test("the empty application boots to a completed Frame through real Main and Hostra", { skip: !deepLaunchAvailable && UNBUILT_NOTE }, async () => {
  const prepared = await hostraLauncher.prepareHostraGame({
    source: { installationRoot: fileURLToPath(appsHostraRoot) },
    runnerPolicy: {
      helloDeadlineMs: 5_000,
      frameDeadlineMs: 5_000,
      terminalCleanupDeadlineMs: 1_000,
      terminationGraceMs: 100,
    },
  });
  const authority = sharedState.createSharedStateAuthority(prepared.state);
  const sessionEventHub = sessionEvents.createSessionEventHub({ onFatal() {} });
  const scheduler = Object.freeze({
    schedule(delayMs, callback) {
      const timer = setTimeout(callback, delayMs);
      return () => clearTimeout(timer);
    },
  });
  const platform = Object.freeze({
    scheduler,
    opaqueMaterial: Object.freeze({ generate: () => randomBytes(32).toString("base64url") }),
    runtimeHosting: hostraLauncher.createHostraRuntimeHosting({
      launchPlan: prepared.launchPlan,
      sharedStateAuthority: authority,
      sessionEventHub,
    }),
    sessionEventsFatal: Object.freeze({ subscribe: () => () => {} }),
  });

  const result = await withDeadline(
    mainRuntime.runMain({
      bootstrap: prepared.logicalBootstrap,
      platform,
      policy: {
        runtimeBootstrapDeadlineMs: 10_000,
        frameDeadlineMs: 10_000,
        shutdownDeadlineMs: 5_000,
        terminationDeadlineMs: 2_000,
      },
    }),
    30_000,
    "Main launch of the empty application",
  );
  assert.deepEqual(result, {
    kind: "root-outcome",
    outcome: { type: "completed", value: { status: "ok", subsystem: "smoke" } },
  });
});

function withDeadline(promise, deadlineMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not finish within ${deadlineMs}ms`)), deadlineMs);
    timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

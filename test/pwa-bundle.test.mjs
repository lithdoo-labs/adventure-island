// Headless validation for the Adventure Island PWA installation-bundle
// generator (PWA migration Stage 4A, scripts/pwa/build-installation-bundle.mjs).
//
// Deterministic base layer (no build, no network):
//   - the CLI produces a byte-deterministic installation-bundle v1 payload
//     whose every field derives exactly from the canonical root sources;
//   - the payload satisfies the upstream generic bundle validator
//     validatePwaBundlePayload (vendored verbatim below from loom-realm
//     93648192323bf5f57996b7b54cbae641d8a53fdb,
//     apps/pwa/scripts/build-bundle.mjs; the pinned submodule c5217e47 does
//     not ship that validator yet, so a byte-faithful local copy is the only
//     offline way to check against the future Stage 4B consumer);
//   - manifest/subsystem keys round-trip; the executable set is unique,
//     dependency-free, and content-hashed correctly; content stays empty;
//   - the root and apps/* shims and other non-sanctioned executable sources
//     are rejected by the builder's import-graph rules;
//   - illegal CLI usage and failing inputs are rejected without writing;
//   - the artifact carries no research material or sensitive markers.
//
// Optional deep layer (auto-enabled when the checked-out loom-realm submodule
// has been built): the real pinned buildPwaExecutableIndexV1 accepts the
// payload's executable graph.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXECUTABLE_SOURCE_BINDINGS,
  assertExecutableGraph,
  buildAdventureIslandInstallationBundle,
} from "../scripts/pwa/build-installation-bundle.mjs";

const repoRoot = new URL("../", import.meta.url);
const repoRootPath = fileURLToPath(repoRoot);
const scriptPath = fileURLToPath(new URL("../scripts/pwa/build-installation-bundle.mjs", import.meta.url));
const loomRealmRoot = new URL("loom-realm/", repoRoot);

const EXPECTED_GAME_ENTRY = Object.freeze({
  formatVersion: 1,
  initial: Object.freeze({ subsystem: "smoke", input: null }),
  subsystems: Object.freeze([{ key: "smoke" }]),
});
const EXPECTED_LAUNCH_MANIFEST = Object.freeze({
  formatVersion: 1,
  subsystems: Object.freeze([{ key: "smoke", module: "subsystems/smoke.mjs" }]),
});

const readText = (urlOrPath) => readFile(urlOrPath, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function runCli(args, cwd = repoRootPath) {
  return spawnSync(process.execPath, [scriptPath, ...args], { cwd, encoding: "utf8" });
}

async function makeTempDir(prefix = "adventure-pwa-bundle-") {
  return mkdtemp(path.join(tmpdir(), prefix));
}

// ---------------------------------------------------------------------------
// Vendored upstream validator (verbatim) — the Stage 4B consumer's schema
// ---------------------------------------------------------------------------

// Source: https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/apps/pwa/scripts/build-bundle.mjs
// Copied verbatim; the only edits are the dropped `export` keyword on
// validatePwaBundlePayload (this file keeps it module-local) and these
// trailing comments. Any change here must be re-diffed against that file.
// Buffer is Node-global as upstream assumes.
function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(label + " must be a non-empty string");
  return value;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validBase64(value) {
  if (value.length === 0) return true;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  return Buffer.from(value, "base64").toString("base64") === value;
}

function validatePwaBundlePayload(value) {
  if (!isObject(value) || value.formatVersion !== 1) throw new TypeError("PWA bundle formatVersion must be 1");
  requireString(value.gameEntryText, "gameEntryText");
  requireString(value.launchManifestText, "launchManifestText");
  try {
    if (!isObject(JSON.parse(value.gameEntryText))) throw new Error();
  } catch {
    throw new TypeError("gameEntryText must contain a JSON object");
  }
  try {
    if (!isObject(JSON.parse(value.launchManifestText))) throw new Error();
  } catch {
    throw new TypeError("launchManifestText must contain a JSON object");
  }
  if (!isObject(value.presentation)) throw new TypeError("presentation must be a JSON object");
  if (!Array.isArray(value.executables) || value.executables.length === 0) {
    throw new TypeError("executables must contain at least one entry");
  }
  const modules = new Set();
  for (const [index, entry] of value.executables.entries()) {
    if (!isObject(entry)) throw new TypeError("Invalid executable at index " + index);
    requireString(entry.logicalModule, "executables[" + index + "].logicalModule");
    if (modules.has(entry.logicalModule)) throw new TypeError("Duplicate executable module: " + entry.logicalModule);
    modules.add(entry.logicalModule);
    if (entry.mime !== "text/javascript" && entry.mime !== "application/javascript") {
      throw new TypeError("Unsupported executable MIME type at index " + index);
    }
    requireString(entry.source, "executables[" + index + "].source");
    requireString(entry.contentVersion, "executables[" + index + "].contentVersion");
  }
  if (!Array.isArray(value.content)) throw new TypeError("content must be an array");
  const identities = new Set();
  for (const [index, entry] of value.content.entries()) {
    if (!isObject(entry)) throw new TypeError("Invalid Content entry at index " + index);
    if (!["record", "group", "resource"].includes(entry.kind)) {
      throw new TypeError("Invalid Content kind at index " + index);
    }
    requireString(entry.namespace, "content[" + index + "].namespace");
    requireString(entry.key, "content[" + index + "].key");
    requireString(entry.mime, "content[" + index + "].mime");
    if (entry.encoding !== "base64" || typeof entry.body !== "string" || !validBase64(entry.body)) {
      throw new TypeError("Content body must be canonical base64 at index " + index);
    }
    const identity = [entry.kind, entry.namespace, entry.key].join("\0");
    if (identities.has(identity)) throw new TypeError("Duplicate PWA Content identity at index " + index);
    identities.add(identity);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Deterministic base validation
// ---------------------------------------------------------------------------

test("the CLI builds a byte-deterministic installation-bundle v1 payload", async () => {
  const temp = await makeTempDir();
  try {
    const first = runCli(["--output", path.join(temp, "a", "bundle.json")]);
    assert.equal(first.status, 0, `CLI must succeed (stderr: ${first.stderr})`);
    assert.match(first.stdout, /Prepared Adventure Island installation-bundle v1 from canonical root sources/);
    const summary = JSON.parse(first.stdout.split("\n")[1]);
    assert.equal(summary.executableCount, 1);
    assert.equal(summary.contentCount, 0);
    assert.deepEqual(summary.executableModules, ["subsystems/smoke.mjs"]);
    assert.equal(summary.frameworkSha, "c5217e47be5a43f974e9e6ce82230077fb639c39");

    const firstText = await readText(path.join(temp, "a", "bundle.json"));
    // Compact JSON with exactly one trailing newline — the same serialization
    // the upstream generic builder writes for its artifacts.
    assert.equal(firstText, `${JSON.stringify(JSON.parse(firstText))}\n`, "artifact must be canonical compact JSON + newline");

    // Re-running to a new path, and over its own previous artifact, yields
    // byte-identical output.
    const second = runCli(["--output", path.join(temp, "b", "bundle.json")]);
    assert.equal(second.status, 0, `second CLI run must succeed (stderr: ${second.stderr})`);
    assert.equal(await readText(path.join(temp, "b", "bundle.json")), firstText);
    const third = runCli(["--output", path.join(temp, "a", "bundle.json")]);
    assert.equal(third.status, 0, `re-running over the previous artifact must succeed (stderr: ${third.stderr})`);
    assert.equal(await readText(path.join(temp, "a", "bundle.json")), firstText);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("the payload schema and provenance are exact", async () => {
  const temp = await makeTempDir();
  try {
    const run = runCli(["--output", path.join(temp, "bundle.json")]);
    assert.equal(run.status, 0, `CLI must succeed (stderr: ${run.stderr})`);
    const payload = JSON.parse(await readText(path.join(temp, "bundle.json")));

    assert.deepEqual(
      Object.keys(payload),
      ["formatVersion", "gameEntryText", "launchManifestText", "presentation", "executables", "content"],
      "payload must have exactly the installation-bundle v1 keys",
    );
    assert.equal(payload.formatVersion, 1);

    // Exact provenance: the texts are the canonical root documents verbatim.
    assert.equal(payload.gameEntryText, await readText(new URL("game.json", repoRoot)));
    assert.deepEqual(JSON.parse(payload.gameEntryText), EXPECTED_GAME_ENTRY);
    assert.equal(payload.launchManifestText, await readText(new URL("launch.pwa.json", repoRoot)));
    assert.deepEqual(JSON.parse(payload.launchManifestText), EXPECTED_LAUNCH_MANIFEST);
    assert.deepEqual(payload.presentation, { formatVersion: 1, styles: [], scripts: [] });
    assert.deepEqual(payload.presentation, JSON.parse(await readText(new URL("presentation.json", repoRoot))));

    // Exactly one executable: the dependency-free shared implementation —
    // never the root or apps/* installation shims.
    assert.equal(payload.executables.length, 1);
    const executable = payload.executables[0];
    assert.deepEqual(Object.keys(executable), ["logicalModule", "mime", "source", "contentVersion"]);
    assert.equal(executable.logicalModule, "subsystems/smoke.mjs");
    assert.equal(executable.mime, "text/javascript");
    assert.equal(executable.source, await readText(new URL("systems/loomrealm-smoke/subsystem.mjs", repoRoot)));
    assert.notEqual(executable.source, await readText(new URL("subsystems/smoke.mjs", repoRoot)));
    assert.notEqual(executable.source, await readText(new URL("apps/pwa/subsystems/smoke.mjs", repoRoot)));
    assert.equal(executable.contentVersion, `sha256:${sha256(executable.source)}`);

    assert.deepEqual(payload.content, []);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("manifest and subsystem keys round-trip through the payload", async () => {
  const temp = await makeTempDir();
  try {
    const run = runCli(["--output", path.join(temp, "bundle.json")]);
    assert.equal(run.status, 0, `CLI must succeed (stderr: ${run.stderr})`);
    const payload = JSON.parse(await readText(path.join(temp, "bundle.json")));
    const game = JSON.parse(payload.gameEntryText);
    const manifest = JSON.parse(payload.launchManifestText);
    const gameKeys = new Set(game.subsystems.map(({ key }) => key));
    const manifestKeys = new Set(manifest.subsystems.map(({ key }) => key));
    const boundModules = new Set(manifest.subsystems.map(({ module }) => module));
    const executableModules = new Set(payload.executables.map(({ logicalModule }) => logicalModule));
    assert.deepEqual(manifestKeys, gameKeys, "manifest keys must equal Game Entry keys");
    assert.deepEqual(executableModules, boundModules, "exactly one executable per bound logical module");
    assert.equal(new Set(payload.executables.map((entry) => entry.logicalModule + "\0" + entry.contentVersion)).size, payload.executables.length);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("the upstream generic bundle validator (vendored from loom-realm 9364819) accepts the payload", async () => {
  const temp = await makeTempDir();
  try {
    const run = runCli(["--output", path.join(temp, "bundle.json")]);
    assert.equal(run.status, 0, `CLI must succeed (stderr: ${run.stderr})`);
    const payload = JSON.parse(await readText(path.join(temp, "bundle.json")));
    assert.equal(validatePwaBundlePayload(payload), payload);

    // Calibrate the vendored copy against representative invalid documents so
    // a future change of the upstream schema surfaces as a failing assertion.
    const validFixture = validatePwaBundlePayload({
      formatVersion: 1,
      gameEntryText: "{}",
      launchManifestText: "{}",
      presentation: {},
      executables: [{ logicalModule: "subsystems/a.mjs", mime: "text/javascript", source: "export default 1;\n", contentVersion: "sha256:x" }],
      content: [],
    });
    assert.ok(validFixture.formatVersion === 1);

    const executable = { logicalModule: "subsystems/a.mjs", mime: "text/javascript", source: "x", contentVersion: "sha256:y" };
    const contentEntry = { kind: "resource", namespace: "Presentation", key: "a.css", mime: "text/css", encoding: "base64", body: "aGVsbG8=" };
    const invalid = new Map([
      ["formatVersion", { ...validFixture, formatVersion: 2 }],
      ["gameEntryText not JSON", { ...validFixture, gameEntryText: "<" }],
      ["gameEntryText not object", { ...validFixture, gameEntryText: "[]" }],
      ["launchManifestText not JSON", { ...validFixture, launchManifestText: "" }],
      ["launchManifestText not object", { ...validFixture, launchManifestText: "null" }],
      ["presentation not object", { ...validFixture, presentation: [] }],
      ["empty executables", { ...validFixture, executables: [] }],
      ["executables not array", { ...validFixture, executables: "x" }],
      ["bad mime", { ...validFixture, executables: [{ ...executable, mime: "text/plain" }] }],
      ["duplicate logicalModule", { ...validFixture, executables: [executable, executable] }],
      ["missing source", { ...validFixture, executables: [{ ...executable, source: "" }] }],
      ["content not array", { ...validFixture, content: "x" }],
      ["bad content kind", { ...validFixture, content: [{ ...contentEntry, kind: "blob" }] }],
      ["non-canonical base64 body", { ...validFixture, content: [{ ...contentEntry, body: "%%%" }] }],
      ["wrong encoding", { ...validFixture, content: [{ ...contentEntry, encoding: "hex" }] }],
      ["duplicate content identity", { ...validFixture, content: [contentEntry, contentEntry] }],
    ]);
    for (const [label, document] of invalid) {
      assert.throws(() => validatePwaBundlePayload(document), TypeError, `vendored validator must reject: ${label}`);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("non-sanctioned executable sources are rejected — never the shims", async () => {
  const temp = await makeTempDir();
  try {
    const rootShimSource = await readText(new URL("subsystems/smoke.mjs", repoRoot));
    const appsShimSource = await readText(new URL("apps/pwa/subsystems/smoke.mjs", repoRoot));
    const sharedSource = await readText(new URL("systems/loomrealm-smoke/subsystem.mjs", repoRoot));
    const writeSource = async (name, source) => {
      await writeFile(path.join(temp, name), source, "utf8");
      return source;
    };
    const bareSource = await writeSource("bare.mjs", "import { completed } from \"@loomrealm/subsystem\";\nexport default 1;\n");
    const dynamicSource = await writeSource("dynamic.mjs", "export default async (x) => (await import(x)).y;\n");
    const nodeishSource = await writeSource("nodeish.mjs", "export default process.argv;\n");

    // Stage 4A policy: published executables must be dependency-free.
    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "out-1.json"),
        verifyGitlink: false,
        executableSources: { "subsystems/smoke.mjs": "subsystems/smoke.mjs" },
      }),
      /dependency-free/,
      "publishing the root shim must be rejected",
    );
    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "out-2.json"),
        verifyGitlink: false,
        executableSources: { "subsystems/smoke.mjs": "apps/pwa/subsystems/smoke.mjs" },
      }),
      /dependency-free/,
      "publishing the apps/pwa shim must be rejected",
    );
    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "out-3.json"),
        verifyGitlink: false,
        executableSources: {},
      }),
      /no sanctioned executable source/,
      "an unbound logical module must be rejected",
    );

    // Under the relaxed graph policy the deeper pinned walker rules apply.
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/smoke.mjs", source: rootShimSource }], { requireDependencyFree: false }),
      /not part of the published executable set/,
      "the root shim re-exports a module outside the published set",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/smoke.mjs", source: appsShimSource }], { requireDependencyFree: false }),
      /SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION/,
      "the apps/* shims lexically escape the installation root",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/smoke.mjs", source: bareSource }], { requireDependencyFree: false }),
      /SUBSYSTEM_MODULE_GRAPH_INVALID/,
      "bare package specifiers are not publishable",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/smoke.mjs", source: dynamicSource }]),
      /non-literal dynamic import/,
      "non-literal dynamic imports are not publishable",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/smoke.mjs", source: nodeishSource }]),
      /Chromium/,
      "Node-only globals are not loadable in Chromium",
    );
    // Graph-level fact worth pinning: a multi-module publication that also
    // carries the shared implementation under its logical path would satisfy
    // the pinned walker — Stage 4A forbids it via the dependency-free policy
    // and the frozen source bindings instead.
    assert.doesNotThrow(() => assertExecutableGraph([
      { logicalModule: "subsystems/smoke.mjs", source: rootShimSource },
      { logicalModule: "systems/loomrealm-smoke/subsystem.mjs", source: sharedSource },
    ], { requireDependencyFree: false }));
    // The sanctioned single-module publication stays valid under both policies.
    assert.doesNotThrow(() => assertExecutableGraph([{ logicalModule: "subsystems/smoke.mjs", source: sharedSource }]));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("illegal CLI usage and failing inputs are rejected without writing output", async () => {
  const badArgSets = [
    [],
    ["--output"],
    ["--output", "--dist"],
    ["--foo", "x"],
    ["--output", "a.json", "b.json"],
  ];
  for (const args of badArgSets) {
    const run = runCli(args);
    assert.notEqual(run.status, 0, `args ${JSON.stringify(args)} must be rejected`);
    assert.match(run.stderr, /build-installation-bundle: /);
    assert.doesNotMatch(run.stdout, /Prepared Adventure Island/);
  }

  const tracked = path.join(repoRootPath, "game.json");
  const trackedBefore = await readText(tracked);
  for (const args of [
    ["--output", "game.json"],
    ["--output", "research/evil.json"],
    ["--output", "bundle-at-root.json"],
    ["--output", "apps/pwa/game.json"],
    ["--output", "dist/../escape.json"],
  ]) {
    const run = runCli(args);
    assert.notEqual(run.status, 0, `output ${args[1]} must be refused`);
    assert.match(run.stderr, /refusing to write|protected tree|Git-tracked/);
  }
  assert.equal(await readText(tracked), trackedBefore, "tracked files must stay untouched");
  await assert.rejects(readText(path.join(repoRootPath, "research", "evil.json")));

  // An existing directory is not a valid artifact target.
  const temp = await makeTempDir();
  try {
    await assert.rejects(
      buildAdventureIslandInstallationBundle({ outputFile: temp, verifyGitlink: false }),
      /output path is a directory/,
    );

    // Failing documents are rejected before any write happens: a fixture root
    // starts from the valid canonical documents and is patched one field at
    // a time (always rewriting the full triple so cases stay independent).
    const fixture = await makeTempDir("adventure-pwa-fixture-");
    try {
      const writeFixture = async (documents) => {
        await Promise.all(Object.entries(documents).map(([name, text]) => writeFile(path.join(fixture, name), text, "utf8")));
      };
      const game = await readText(new URL("game.json", repoRoot));
      const manifest = await readText(new URL("launch.pwa.json", repoRoot));
      const presentation = await readText(new URL("presentation.json", repoRoot));
      const baseDocuments = { "game.json": game, "launch.pwa.json": manifest, "presentation.json": presentation };
      const output = path.join(temp, "fixture-bundle.json");
      const runBuild = () => buildAdventureIslandInstallationBundle({
        gameRoot: fixture,
        outputFile: output,
        verifyGitlink: false,
        executableSources: { "subsystems/smoke.mjs": path.join(repoRootPath, "systems", "loomrealm-smoke", "subsystem.mjs") },
      });
      const rejectFixture = async (overrides, pattern, message) => {
        await writeFixture({ ...baseDocuments, ...overrides });
        await assert.rejects(runBuild(), pattern, message);
      };

      await assert.rejects(runBuild(), /ENOENT/, "missing canonical inputs must be rejected");

      await rejectFixture(
        { "game.json": JSON.stringify({ formatVersion: 1, initial: { subsystem: "smoke", input: null }, subsystems: [{ key: "smoke" }, { key: "ghost" }] }) },
        /has no PWA binding/,
        "a subsystem without a PWA binding must be rejected",
      );
      await rejectFixture(
        { "launch.pwa.json": JSON.stringify({ formatVersion: 1, subsystems: [{ key: "ghost", module: "subsystems/smoke.mjs" }] }) },
        /has no PWA binding|not declared by the Game Entry/,
        "a manifest/Game Entry key-set mismatch must be rejected",
      );
      await rejectFixture(
        { "launch.pwa.json": JSON.stringify({ formatVersion: 1, subsystems: [{ key: "smoke", module: "../escape.mjs" }] }) },
        /invalid logical module/,
        "an out-of-root logical module must be rejected",
      );
      await rejectFixture(
        { "presentation.json": JSON.stringify({ formatVersion: 1, styles: [{ namespace: "Presentation", key: "page.css" }], scripts: [] }) },
        /has no Content entry/,
        "a presentation resource without Content must be rejected",
      );
      await rejectFixture(
        { "game.json": "{ not json" },
        /not valid JSON/,
        "a corrupt Game Entry must be rejected",
      );
      await rejectFixture(
        { "presentation.json": JSON.stringify({ formatVersion: 1, styles: [], scripts: [], extra: 1 }) },
        /must have exactly/,
        "an over-shaped presentation document must be rejected",
      );
      await assert.rejects(readText(output), /ENOENT/, "no artifact may be written for rejected inputs");
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("the artifact carries no research material or sensitive markers", async () => {
  const temp = await makeTempDir();
  try {
    const run = runCli(["--output", path.join(temp, "bundle.json")]);
    assert.equal(run.status, 0, `CLI must succeed (stderr: ${run.stderr})`);
    const text = await readText(path.join(temp, "bundle.json"));
    const forbidden = [
      "research",
      "CMS079",
      ".wz",
      ".raw",
      "glm-work",
      "task/",
      fileURLToPath(repoRoot),
      tmpdir(),
    ];
    for (const marker of forbidden) {
      assert.equal(text.includes(marker), false, `artifact must not contain "${marker}"`);
    }

    // Structural zero-research guarantee: the generator's frozen input
    // whitelist references only canonical/allowed trees.
    const whitelisted = [
      "game.json",
      "launch.pwa.json",
      "presentation.json",
      ...Object.values(EXECUTABLE_SOURCE_BINDINGS),
    ];
    for (const input of whitelisted) {
      assert.match(input, /^(game\.json|launch\.pwa\.json|presentation\.json|systems\/)/u, `input whitelist entry must stay canonical: ${input}`);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
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

const pwaLauncher = await tryImportLoomRealmPackage("packages/game-launcher-pwa/dist/index.js");
const UNBUILT_NOTE = "loom-realm packages are not built; run `npm install && npm run build:packages` inside loom-realm/ to enable deep validation";

test("the pinned buildPwaExecutableIndexV1 accepts the payload executable graph", {
  skip: !pwaLauncher && UNBUILT_NOTE,
}, async () => {
  const temp = await makeTempDir();
  try {
    const run = runCli(["--output", path.join(temp, "bundle.json")]);
    assert.equal(run.status, 0, `CLI must succeed (stderr: ${run.stderr})`);
    const payload = JSON.parse(await readText(path.join(temp, "bundle.json")));

    const graph = await pwaLauncher.buildPwaExecutableIndexV1(
      payload.executables.map(({ logicalModule, source, contentVersion }) => ({ logicalModule, source, contentVersion })),
    );
    assert.deepEqual(graph, [
      { logicalModule: "subsystems/smoke.mjs", contentVersion: payload.executables[0].contentVersion, imports: [] },
    ]);

    // Bundle-level echo of the Turn 1 guard: feeding the root shim source in
    // place of the published executable must fail the real graph builder.
    const shimSource = await readText(new URL("subsystems/smoke.mjs", repoRoot));
    await assert.rejects(
      pwaLauncher.buildPwaExecutableIndexV1([
        { logicalModule: "subsystems/smoke.mjs", source: shimSource, contentVersion: `sha256:${sha256(shimSource)}` },
      ]),
      (error) => {
        assert.equal(error?.code, "SUBSYSTEM_MODULE_NOT_FOUND");
        return true;
      },
      "the root shim must never satisfy the executable graph",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

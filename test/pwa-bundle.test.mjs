// Headless validation for the Adventure Island PWA installation-bundle
// generator (scripts/pwa/build-installation-bundle.mjs — Base → Adventure
// Map → cms-actor slice, issue #62).
//
// Deterministic base layer (no build, no network):
//   - the CLI produces a byte-deterministic installation-bundle v1 payload
//     whose every field derives exactly from the canonical root sources;
//   - the payload satisfies the upstream generic bundle validator
//     validatePwaBundlePayload (vendored verbatim below from loom-realm
//     93648192323bf5f57996b7b54cbae641d8a53fdb,
//     apps/pwa/scripts/build-bundle.mjs; the local mirror remains calibrated
//     against the same validator used by the pinned generic PWA builder);
//   - manifest/subsystem keys round-trip; the executable set is exactly the
//     two SELF-CONTAINED esbuild bundles (base + adventure-map), unique,
//     dependency-free, and content-hashed correctly;
//   - the Content whitelist is exact: the two classic presentation scripts
//     (pinned Controls IIFE + cms-actor IIFE) plus the read-only single-
//     character FSDB closure and the derived bootstrap AvatarPlan record —
//     every identity, MIME and canonical base64 body is pinned, and the
//     published FSDB bytes equal the repository library files;
//   - T4 round-trip: the plan and every referenced PNG are re-decoded from
//     the FINAL bundle, re-validated, and cross-checked against sha256s;
//   - the root/apps shims, the raw (unbundled) subsystem sources, the
//     component's ESM sources, and tampered adventure Content are all
//     rejected by the builder's rules;
//   - illegal CLI usage and failing inputs are rejected without writing;
//   - the artifact carries no research material or sensitive markers.
//
// Optional deep layer (auto-enabled when the checked-out loom-realm submodule
// has been built): the real pinned buildPwaExecutableIndexV1 accepts the
// payload's executable graph.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ACTOR_SCRIPT_KEY,
  CONTROLS_SCRIPT_KEY,
  CONTENT_SCRIPT_SOURCE_BINDINGS,
  EXECUTABLE_SOURCE_BINDINGS,
  assertExecutableGraph,
  buildAdventureIslandInstallationBundle,
} from "../scripts/pwa/build-installation-bundle.mjs";
import {
  ADVENTURE_FSDB_RELATIVE_PATH,
  AVATAR_PLAN_DATA_BYTE_LIMIT,
  AVATAR_PLAN_KEY,
  AVATAR_PLAN_NAMESPACE,
  buildCanonicalAdventureAvatarContent,
} from "../scripts/pwa/read-adventure-fsdb.mjs";
import {
  measureAvatarPlanDataBytes,
  validateAvatarPlan,
} from "../components/cms-actor/src/avatar-model.mjs";

const repoRoot = new URL("../", import.meta.url);
const repoRootPath = fileURLToPath(repoRoot);
const scriptPath = fileURLToPath(new URL("../scripts/pwa/build-installation-bundle.mjs", import.meta.url));
const loomRealmRoot = new URL("loom-realm/", repoRoot);

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
const EXPECTED_PRESENTATION = Object.freeze({
  formatVersion: 1,
  styles: Object.freeze([]),
  scripts: Object.freeze([
    Object.freeze({ namespace: "Presentation", key: CONTROLS_SCRIPT_KEY }),
    Object.freeze({ namespace: "Presentation", key: ACTOR_SCRIPT_KEY }),
  ]),
});

/** The canonical Content closure, computed once (read-only FSDB + plan + 2 scripts). */
const canonicalAdventure = await buildCanonicalAdventureAvatarContent();

/** The exact canonical Content identity set, sorted. */
const expectedContentIdentities = () => [
  ...canonicalAdventure.entries.map(({ kind, namespace, key }) => `${kind}\0${namespace}\0${key}`),
  `resource\0resource.Presentation\0${CONTROLS_SCRIPT_KEY}`,
  `resource\0resource.Presentation\0${ACTOR_SCRIPT_KEY}`,
].sort();

const readText = (urlOrPath) => readFile(urlOrPath, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function runCli(args, cwd = repoRootPath) {
  return spawnSync(process.execPath, [scriptPath, ...args], { cwd, encoding: "utf8" });
}

async function makeTempDir(prefix = "adventure-pwa-bundle-") {
  return mkdtemp(path.join(tmpdir(), prefix));
}

// Absolute sources for the two executables: the builder bundles them with
// esbuild from the REAL repository sources (which resolve the pinned
// framework workspace), so isolated fixtures never need a node_modules.
const EXECUTABLE_ABSOLUTE_SOURCES = Object.freeze({
  "subsystems/base.mjs": fileURLToPath(new URL("../systems/base/subsystem.mjs", import.meta.url)),
  "subsystems/adventure-map.mjs": fileURLToPath(new URL("../systems/adventure-map/subsystem.mjs", import.meta.url)),
});

/** The Controls artifact's repo-relative path segments (frozen binding value). */
const CONTROLS_RELATIVE_SEGMENTS = Object.freeze(
  CONTENT_SCRIPT_SOURCE_BINDINGS[`resource\0resource.Presentation\0${CONTROLS_SCRIPT_KEY}`].split("/"),
);

// A fully isolated "project root" that mimics a fresh checkout of this
// repository: the three canonical documents, the two subsystem sources, the
// two classic browser artifacts (cms-actor + pinned Controls), the read-only
// adventure FSDB closure, and a protected research/ tree with a sentinel.
// Nothing here ever touches the real repository's research/.
async function makeIsolatedGameRoot() {
  const isolatedRoot = await mkdtemp(path.join(tmpdir(), "adventure-isolated-root-"));
  await mkdir(path.join(isolatedRoot, "research"), { recursive: true });
  await writeFile(path.join(isolatedRoot, "research", "keep.txt"), "sentinel-content\n", "utf8");
  for (const name of ["game.json", "launch.pwa.json", "presentation.json"]) {
    await writeFile(path.join(isolatedRoot, name), await readText(new URL(name, repoRoot)), "utf8");
  }
  for (const [logical, physical] of Object.entries(EXECUTABLE_SOURCE_BINDINGS)) {
    const target = path.join(isolatedRoot, physical);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(repoRootPath, physical), target);
  }
  await mkdir(path.join(isolatedRoot, "components", "cms-actor", "browser"), { recursive: true });
  await copyFile(
    path.join(repoRootPath, "components", "cms-actor", "browser", "cms-actor.browser.js"),
    path.join(isolatedRoot, "components", "cms-actor", "browser", "cms-actor.browser.js"),
  );
  const controlsSource = path.join(
    repoRootPath, "loom-realm", "game-libs", "game-common-controls", "dist", "browser", "device-input.browser.js",
  );
  await mkdir(path.dirname(path.join(isolatedRoot, ...CONTROLS_RELATIVE_SEGMENTS)), { recursive: true });
  await copyFile(
    controlsSource,
    path.join(isolatedRoot, ...CONTROLS_RELATIVE_SEGMENTS),
  );
  for (const relativeFile of canonicalAdventure.sources) {
    const target = path.join(isolatedRoot, relativeFile);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(repoRootPath, relativeFile), target);
  }
  const build = (outputFile, options = {}) => buildAdventureIslandInstallationBundle({
    gameRoot: isolatedRoot,
    outputFile,
    verifyGitlink: false,
    ...options,
    executableSources: EXECUTABLE_ABSOLUTE_SOURCES,
  });
  return { root: isolatedRoot, build };
}

// Symlink tests run wherever the platform allows symlink creation; if it does
// not (e.g. unprivileged Windows), they skip with an explicit reason instead
// of masking the Linux CI result.
const symlinkSupport = await (async () => {
  const dir = await makeTempDir("adventure-symlink-probe-");
  try {
    await symlink(path.join(dir, "target.txt"), path.join(dir, "link"));
    return { ok: true };
  } catch (cause) {
    return { ok: false, reason: `symlink creation unavailable on this platform (${cause.code ?? cause.message}); symlink rejection tests skipped` };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
})();

// Full recursive snapshot of a directory tree ("d"/"f"/"l" + relative path),
// so tests can prove that a rejected build leaves ZERO filesystem traces —
// not merely "the bundle file was not written".
async function snapshotTree(root) {
  const entries = [];
  const walk = async (dir, prefix) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      entries.push(`${entry.isDirectory() ? "d" : entry.isSymbolicLink() ? "l" : "f"} ${relativePath}`);
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), relativePath);
    }
  };
  await walk(root, "");
  return entries.sort();
}

// The builder's exclusive temp files are named `.<basename>.tmp-<pid>-<hex>`.
const TEMP_RESIDUE_PATTERN = /^\..+\.tmp-\d+-[0-9a-f]{6,}$/u;

async function tempResidue(root) {
  const residue = [];
  const walk = async (dir, prefix) => {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (TEMP_RESIDUE_PATTERN.test(entry.name)) residue.push(relativePath);
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), relativePath);
    }
  };
  await walk(root, "");
  return residue.sort();
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
    assert.equal(summary.executableCount, 2);
    assert.equal(summary.contentCount, expectedContentIdentities().length);
    assert.deepEqual(summary.executableModules, ["subsystems/base.mjs", "subsystems/adventure-map.mjs"]);
    const gitlink = execFileSync("git", ["-C", repoRootPath, "rev-parse", "HEAD:loom-realm"], { encoding: "utf8" }).trim();
    assert.match(gitlink, /^[0-9a-f]{40}$/u);
    assert.equal(summary.frameworkSha, gitlink);

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
    assert.deepEqual(payload.presentation, EXPECTED_PRESENTATION);
    assert.deepEqual(payload.presentation, JSON.parse(await readText(new URL("presentation.json", repoRoot))));

    // Exactly two executables: the self-contained esbuild bundles — never
    // the installation shims and never the raw (unbundled) subsystem sources.
    assert.equal(payload.executables.length, 2);
    const baseShimSource = await readText(new URL("subsystems/base.mjs", repoRoot));
    const mapShimSource = await readText(new URL("subsystems/adventure-map.mjs", repoRoot));
    const baseSource = await readText(new URL("../systems/base/subsystem.mjs", import.meta.url));
    const mapSource = await readText(new URL("../systems/adventure-map/subsystem.mjs", import.meta.url));
    for (const [index, expectedModule] of ["subsystems/base.mjs", "subsystems/adventure-map.mjs"].entries()) {
      const executable = payload.executables[index];
      assert.deepEqual(Object.keys(executable), ["logicalModule", "mime", "source", "contentVersion"]);
      assert.equal(executable.logicalModule, expectedModule);
      assert.equal(executable.mime, "text/javascript");
      assert.equal(executable.contentVersion, `sha256:${sha256(executable.source)}`);
      assert.notEqual(executable.source, baseShimSource);
      assert.notEqual(executable.source, mapShimSource);
      assert.notEqual(executable.source, baseSource, "the executable must be the BUNDLED source, not the raw file");
      assert.notEqual(executable.source, mapSource, "the executable must be the BUNDLED source, not the raw file");
      assert.doesNotMatch(executable.source, /\bfrom\s*["']/u, "the bundle must be dependency-free (no import edges)");
      assert.doesNotMatch(executable.source, /\bimport\s*\(/u, "the bundle must not dynamically import");
      assert.doesNotMatch(executable.source, /\bprocess\.\w/u, "the bundle must not reference Node-only globals");
    }
    assert.match(payload.executables[0].source, /game-controls-input/u, "the base bundle contains the Controls producer root");
    assert.match(payload.executables[1].source, /struct\.AdventureAvatarPlan/u, "the map bundle contains the bootstrap plan identity");
    assert.match(payload.executables[1].source, /adventure-player/u, "the map bundle contains the single actor node key");

    // The Content set is the exact PR-B whitelist, canonically ordered.
    assert.deepEqual(
      payload.content.map((entry) => [entry.kind, entry.namespace, entry.key].join("\0")),
      expectedContentIdentities(),
      "the Content whitelist must be exact (identity and order)",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("the Content whitelist is exact: the two classic scripts plus the read-only FSDB closure and derived plan", async () => {
  const temp = await makeTempDir();
  try {
    const run = runCli(["--output", path.join(temp, "bundle.json")]);
    assert.equal(run.status, 0, `CLI must succeed (stderr: ${run.stderr})`);
    const payload = JSON.parse(await readText(path.join(temp, "bundle.json")));
    const actorScriptBytes = await readFile(fileURLToPath(new URL("components/cms-actor/browser/cms-actor.browser.js", repoRoot)));
    const controlsScriptBytes = await readFile(fileURLToPath(
      new URL("loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js", repoRoot),
    ));

    for (const entry of payload.content) {
      assert.deepEqual(Object.keys(entry), ["kind", "namespace", "key", "mime", "encoding", "body"], "content entries must have exactly the payload schema keys");
      assert.equal(entry.encoding, "base64");
      const bytes = Buffer.from(entry.body, "base64");
      assert.equal(bytes.toString("base64"), entry.body, "content bodies must be canonical base64");
      if (entry.kind === "resource" && entry.namespace === "resource.Presentation") {
        assert.ok([CONTROLS_SCRIPT_KEY, ACTOR_SCRIPT_KEY].includes(entry.key));
        assert.equal(entry.mime, "text/javascript; charset=utf-8");
        const expected = entry.key === CONTROLS_SCRIPT_KEY ? controlsScriptBytes : actorScriptBytes;
        assert.ok(bytes.equals(expected), `the published script ${entry.key} must be the pinned artifact, byte for byte`);
        assert.doesNotMatch(bytes.toString("utf8"), /(^|\n)\s*(import|export)\s*[({"'\s]/u, "ES module sources must never be published as classic scripts");
      } else if (entry.kind === "resource") {
        assert.equal(entry.namespace, "resource.Avatar");
        assert.equal(entry.mime, "image/png");
        assert.deepEqual(bytes.subarray(1, 4), Buffer.from([0x50, 0x4e, 0x47]), "image resources must be PNGs");
      } else if (entry.kind === "record") {
        assert.ok(
          ["struct.avatar.Part", "struct.avatar.DrawOrder", "struct.avatar.LayerSlot", AVATAR_PLAN_NAMESPACE].includes(entry.namespace),
          "records must be the FSDB part/order tables or the derived plan",
        );
        assert.ok(!entry.key.includes("/"), "record keys must be flat");
        assert.equal(entry.mime, "application/json; charset=utf-8");
        JSON.parse(bytes.toString("utf8"));
      } else {
        assert.equal(entry.kind, "group");
        assert.ok(["group.avatar.PartFrame", "group.avatar.Resource"].includes(entry.namespace), "groups must be the FSDB frame/resource tables");
        assert.ok(!entry.key.includes("/"), "group keys must be flat");
        assert.equal(entry.mime, "application/x-ndjson; charset=utf-8");
        for (const line of bytes.toString("utf8").split(/\r?\n/u)) {
          if (line.trim().length === 0) continue;
          JSON.parse(line);
        }
      }
    }

    // Every closure entry is published byte-identical to the repository FSDB
    // (plus the derived plan record), and every generator entry appears.
    const published = new Map(payload.content.map((entry) => [[entry.kind, entry.namespace, entry.key].join("\0"), Buffer.from(entry.body, "base64")]));
    for (const { kind, namespace, key, mime, bytes } of canonicalAdventure.entries) {
      const observed = published.get(`${kind}\0${namespace}\0${key}`);
      assert.ok(observed !== undefined, `closure entry ${namespace}/${key} must be published`);
      assert.ok(observed.equals(bytes), `published bytes for ${namespace}/${key} must equal the repository FSDB file`);
      assert.equal(payload.content.find((entry) => entry.namespace === namespace && entry.key === key).mime, mime);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("T4: the plan and every referenced PNG round-trip from the FINAL published bundle", async () => {
  const temp = await makeTempDir();
  try {
    const run = runCli(["--output", path.join(temp, "bundle.json")]);
    assert.equal(run.status, 0, `CLI must succeed (stderr: ${run.stderr})`);
    const payload = JSON.parse(await readText(path.join(temp, "bundle.json")));

    // Identity uniqueness across the whole published set.
    const identities = payload.content.map((entry) => [entry.kind, entry.namespace, entry.key].join("\0"));
    assert.equal(new Set(identities).size, identities.length, "Content identities must be unique");

    // Decode the derived bootstrap plan from the published record body.
    const planEntry = payload.content.find(
      (entry) => entry.kind === "record" && entry.namespace === AVATAR_PLAN_NAMESPACE && entry.key === AVATAR_PLAN_KEY,
    );
    assert.ok(planEntry !== undefined, "the derived bootstrap plan record must be published");
    const planBytes = Buffer.from(planEntry.body, "base64");
    assert.deepEqual(
      JSON.parse(planBytes.toString("utf8")),
      canonicalAdventure.plan,
      "the published plan must equal the adapter-derived plan",
    );
    const plan = validateAvatarPlan(JSON.parse(planBytes.toString("utf8")));
    assert.deepEqual(Object.keys(plan.actions).sort(), ["jump", "stand1", "walk1"], "exactly the locomotion actions");
    assert.equal(plan.actions.jump.loop, false, "jump is the one-shot action");
    assert.equal(plan.locomotionActions.stand, "stand1");
    assert.equal(plan.locomotionActions.walk, "walk1");
    const planDataBytes = measureAvatarPlanDataBytes(plan);
    assert.ok(planDataBytes <= AVATAR_PLAN_DATA_BYTE_LIMIT, `plan data ${planDataBytes}B must stay under the cap`);
    assert.ok(planBytes.length <= AVATAR_PLAN_DATA_BYTE_LIMIT, "the published plan record body itself stays bounded");

    // Every layer resource must resolve to a published PNG whose sha256
    // equals the version stamped in the plan (identity + version + bytes).
    const publishedResources = new Map(payload.content
      .filter((entry) => entry.kind === "resource" && entry.namespace === "resource.Avatar")
      .map((entry) => [entry.key, Buffer.from(entry.body, "base64")]));
    const planLayers = [
      ...Object.values(plan.actions).flatMap((action) => action.frames.flatMap((frame) => frame.layers)),
      ...plan.expression.frames.flatMap((frame) => frame.layers),
    ];
    assert.ok(planLayers.length > 0, "the plan references layers");
    for (const [index, layer] of planLayers.entries()) {
      assert.equal(layer.resource.namespace, "resource.Avatar");
      const png = publishedResources.get(layer.resource.key);
      assert.ok(png !== undefined, `plan layer ${index} (${layer.resource.key}) must reference a published PNG`);
      assert.equal(layer.resource.contentVersion, `sha256:${sha256(png)}`, `layer ${index} version must equal the published PNG sha256`);
      assert.deepEqual(png.subarray(1, 4), Buffer.from([0x50, 0x4e, 0x47]), `layer ${index} must reference a PNG`);
    }
    // The published atlas pages are exactly the referenced closure — no
    // unrelated equipment or library images ship.
    const referencedKeys = new Set(planLayers.map((layer) => layer.resource.key));
    assert.deepEqual([...publishedResources.keys()].sort(), [...referencedKeys].sort(), "only the referenced atlas pages are published");
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

test("non-sanctioned executable sources are rejected — never the shims, never the raw sources", async () => {
  const temp = await makeTempDir();
  try {
    const baseShimSource = await readText(new URL("subsystems/base.mjs", repoRoot));
    const appsShimSource = await readText(new URL("apps/pwa/subsystems/smoke.mjs", repoRoot));
    const rawBaseSource = await readText(new URL("../systems/base/subsystem.mjs", import.meta.url));
    const writeSource = async (name, source) => {
      await writeFile(path.join(temp, name), source, "utf8");
      return source;
    };
    const bareSource = await writeSource("bare.mjs", "import { completed } from \"@loomrealm/subsystem\";\nexport default 1;\n");
    const dynamicSource = await writeSource("dynamic.mjs", "export default async (x) => (await import(x)).y;\n");
    const nodeishSource = await writeSource("nodeish.mjs", "export default process.argv;\n");

    // Canonical policy: publication sources are the sanctioned systems/*
    // implementations — never the installation-root shims, never apps/*
    // bindings, and never an unbound logical module.
    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "out-1.json"),
        verifyGitlink: false,
        executableSources: { ...EXECUTABLE_ABSOLUTE_SOURCES, "subsystems/base.mjs": "subsystems/base.mjs" },
      }),
      /sanctioned systems\/\* implementation/,
      "publishing the root shim must be rejected",
    );
    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "out-2.json"),
        verifyGitlink: false,
        executableSources: { ...EXECUTABLE_ABSOLUTE_SOURCES, "subsystems/base.mjs": "apps/pwa/subsystems/smoke.mjs" },
      }),
      /sanctioned systems\/\* implementation/,
      "publishing an apps/* shim must be rejected",
    );
    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "out-3.json"),
        verifyGitlink: false,
        executableSources: { "subsystems/adventure-map.mjs": EXECUTABLE_ABSOLUTE_SOURCES["subsystems/adventure-map.mjs"] },
      }),
      /no sanctioned executable source/,
      "an unbound logical module must be rejected",
    );
    await assert.rejects(readText(path.join(temp, "out-1.json")), /ENOENT/, "rejections must not write an artifact");

    // Under the relaxed graph policy the deeper pinned walker rules apply.
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/base.mjs", source: baseShimSource }], { requireDependencyFree: false }),
      /not part of the published executable set/,
      "the root shim re-exports a module outside the published set",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/smoke.mjs", source: appsShimSource }], { requireDependencyFree: false }),
      /SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION/,
      "the apps/* shims lexically escape the installation root",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/base.mjs", source: rawBaseSource }], { requireDependencyFree: false }),
      /SUBSYSTEM_MODULE_GRAPH_INVALID/,
      "bare framework specifiers are not publishable",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/base.mjs", source: bareSource }], { requireDependencyFree: false }),
      /SUBSYSTEM_MODULE_GRAPH_INVALID/,
      "bare package specifiers are not publishable",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/base.mjs", source: dynamicSource }]),
      /non-literal dynamic import/,
      "non-literal dynamic imports are not publishable",
    );
    assert.throws(
      () => assertExecutableGraph([{ logicalModule: "subsystems/base.mjs", source: nodeishSource }]),
      /Chromium/,
      "Node-only globals are not loadable in Chromium",
    );
    // The sanctioned two-module publication stays valid under both policies
    // once bundled (the CLI build above proved the real bytes are used).
    const bundlePath = path.join(temp, "sanctioned.json");
    const summary = await buildAdventureIslandInstallationBundle({
      outputFile: bundlePath,
      verifyGitlink: false,
      executableSources: EXECUTABLE_ABSOLUTE_SOURCES,
    });
    assert.equal(summary.executableCount, 2);
    const sanctioned = JSON.parse(await readText(bundlePath));
    assert.doesNotThrow(() => assertExecutableGraph(sanctioned.executables));
    assert.doesNotThrow(() => assertExecutableGraph(sanctioned.executables, { requireDependencyFree: false }));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("non-sanctioned Content script sources are rejected — never the ESM sources", async () => {
  const temp = await makeTempDir();
  try {
    const actorIdentity = `resource\0resource.Presentation\0${ACTOR_SCRIPT_KEY}`;
    const controlsIdentity = `resource\0resource.Presentation\0${CONTROLS_SCRIPT_KEY}`;
    // The component's authored ESM sources must never be published as the
    // classic presentation script.
    for (const esmSource of ["src/cms-actor.mjs", "src/avatar-model.mjs"]) {
      await assert.rejects(
        buildAdventureIslandInstallationBundle({
          outputFile: path.join(temp, `out-${path.basename(esmSource)}.json`),
          verifyGitlink: false,
          executableSources: EXECUTABLE_ABSOLUTE_SOURCES,
          contentScriptSources: {
            ...CONTENT_SCRIPT_SOURCE_BINDINGS,
            [actorIdentity]: `components/cms-actor/${esmSource}`,
          },
        }),
        /classic script|module syntax/,
        `publishing ${esmSource} as the Content script must be rejected`,
      );
    }
    // The Controls binding must not publish the framework's ESM/TS sources
    // (or any scanning of its source tree) instead of the built IIFE.
    for (const badControls of [
      "loom-realm/game-libs/game-common-controls/src/subsystem.ts",
      "loom-realm/game-libs/game-common-controls/dist/subsystem.js",
    ]) {
      await assert.rejects(
        buildAdventureIslandInstallationBundle({
          outputFile: path.join(temp, `out-controls-${path.basename(badControls)}.json`),
          verifyGitlink: false,
          executableSources: EXECUTABLE_ABSOLUTE_SOURCES,
          contentScriptSources: {
            ...CONTENT_SCRIPT_SOURCE_BINDINGS,
            [controlsIdentity]: badControls,
          },
        }),
        /classic script|module syntax|ENOENT/,
        `publishing ${badControls} as the Controls script must be rejected`,
      );
    }
    // A binding that does not name a resource identity is rejected.
    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "out-kind.json"),
        verifyGitlink: false,
        executableSources: EXECUTABLE_ABSOLUTE_SOURCES,
        contentScriptSources: { [`record\0resource.Presentation\0x`]: "components/cms-actor/browser/cms-actor.browser.js" },
      }),
      /must publish resource entries/,
    );
    await assert.rejects(readText(path.join(temp, "out-kind.json")), /ENOENT/, "rejections must not write an artifact");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("adventure FSDB preflight rejects duplicate action frames and symlinked directory roots", async () => {
  // Change only a temporary copy of the already-used FSDB closure.
  const fixture = await makeIsolatedGameRoot();
  try {
    const groupFile = path.join(
      fixture.root, ADVENTURE_FSDB_RELATIVE_PATH,
      "[group]avatar.PartFrame", "avatar.part.body.00002000.jsonl",
    );
    const original = await readFile(groupFile, "utf8");
    const firstFrame = original.split(/\r?\n/u).find((line) => line.trim().length > 0);
    assert.ok(firstFrame, "the fixture must contain at least one body frame");
    await writeFile(groupFile, `${original.trimEnd()}\n${firstFrame}\n`, "utf8");
    await assert.rejects(
      buildCanonicalAdventureAvatarContent({ gameRoot: fixture.root }),
      /duplicate \(action,frame\)/u,
      "ambiguous (action,frame) rows must fail before building the Plan",
    );

    // A single terminal newline is valid JSONL. Another blank row is not.
    await writeFile(groupFile, `${original.trimEnd()}\n\n`, "utf8");
    await assert.rejects(
      buildCanonicalAdventureAvatarContent({ gameRoot: fixture.root }),
      /row \d+ is empty/u,
      "internal blank JSONL rows must fail instead of being skipped",
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }

  if (symlinkSupport.ok) {
    // Both a symlinked FSDB root and a symlinked 'content' ancestor must fail.
    for (const linkTarget of ["content", "fsdb"]) {
      const game = await makeTempDir("adventure-fsdb-root-symlink-");
      try {
        if (linkTarget === "content") {
          await symlink(path.join(repoRootPath, "content"), path.join(game, "content"), "dir");
        } else {
          await mkdir(path.join(game, "content"));
          await symlink(
            path.join(repoRootPath, ADVENTURE_FSDB_RELATIVE_PATH),
            path.join(game, ADVENTURE_FSDB_RELATIVE_PATH),
            "dir",
          );
        }
        await assert.rejects(
          buildCanonicalAdventureAvatarContent({ gameRoot: game }),
          /must be a real directory \(no symlinks\)/u,
          `${linkTarget}: an FSDB directory symlink must not escape the checkout`,
        );
      } finally {
        await rm(game, { recursive: true, force: true });
      }
    }
  }
});

test("tampered adventure Content fails the builder's consistency checks", async () => {
  const temp = await makeTempDir();
  try {
    const output = path.join(temp, "bundle.json");
    const buildWith = (adventureContent) => buildAdventureIslandInstallationBundle({
      outputFile: output,
      verifyGitlink: false,
      executableSources: EXECUTABLE_ABSOLUTE_SOURCES,
      adventureContent,
    });

    // A plan whose atlas version no longer matches the published PNG bytes.
    await assert.rejects(
      buildWith(async () => ({
        ...canonicalAdventure,
        entries: canonicalAdventure.entries.map((entry) => {
          if (entry.namespace !== AVATAR_PLAN_NAMESPACE || entry.key !== AVATAR_PLAN_KEY) return entry;
          const plan = JSON.parse(entry.bytes.toString("utf8"));
          plan.actions.stand1.frames[0].layers[0].resource.contentVersion = `sha256:${"0".repeat(64)}`;
          return { ...entry, bytes: Buffer.from(`${JSON.stringify(plan)}\n`, "utf8") };
        }),
      })),
      /stamps sha256:0+ for resource\.Avatar|version mismatch/u,
      "a plan/PNG version mismatch must be rejected",
    );

    // A dropped atlas PNG referenced by the plan.
    await assert.rejects(
      buildWith(async () => ({
        ...canonicalAdventure,
        entries: canonicalAdventure.entries.filter((entry) => entry.key !== "part/body/00002000/0"),
      })),
      /references unpublished Content|missing/u,
      "dropping a referenced atlas PNG must be rejected",
    );

    // The derived plan record replaced by a different kind at the same identity.
    await assert.rejects(
      buildWith(async () => ({
        ...canonicalAdventure,
        entries: canonicalAdventure.entries.map((entry) => (entry.namespace === AVATAR_PLAN_NAMESPACE && entry.key === AVATAR_PLAN_KEY
          ? { ...entry, kind: "group" }
          : entry)),
      })),
      /missing the derived struct\.AdventureAvatarPlan\/bootstrap record|group/u,
      "removing the derived plan record must be rejected",
    );

    // A corrupted NDJSON group body.
    await assert.rejects(
      buildWith(async () => ({
        ...canonicalAdventure,
        entries: canonicalAdventure.entries.map((entry) => (entry.namespace === "group.avatar.PartFrame" && entry.key === "avatar.part.body.00002000"
          ? { ...entry, bytes: Buffer.from("{not json\n", "utf8") }
          : entry)),
      })),
      /JSON/u,
      "corrupted JSONL groups must be rejected",
    );

    // The untampered canonical closure still builds.
    const summary = await buildWith(async () => canonicalAdventure);
    assert.equal(summary.contentCount, expectedContentIdentities().length);
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
        await Promise.all(Object.entries(documents).map(async ([name, text]) => {
          const target = path.join(fixture, name);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, text, "utf8");
        }));
      };
      const game = await readText(new URL("game.json", repoRoot));
      const manifest = await readText(new URL("launch.pwa.json", repoRoot));
      const presentation = await readText(new URL("presentation.json", repoRoot));
      const output = path.join(temp, "fixture-bundle.json");
      const runBuild = () => buildAdventureIslandInstallationBundle({
        gameRoot: fixture,
        outputFile: output,
        verifyGitlink: false,
        executableSources: EXECUTABLE_ABSOLUTE_SOURCES,
      });
      const rejectFixture = async (overrides, pattern, message) => {
        await writeFixture({
          "game.json": game,
          "launch.pwa.json": manifest,
          "presentation.json": presentation,
          ...overrides,
        });
        await assert.rejects(runBuild(), pattern, message);
      };

      await assert.rejects(runBuild(), /ENOENT/, "missing canonical inputs must be rejected");

      // The read-only inputs that never change across cases: both classic
      // script artifacts and the adventure FSDB closure. The docs are
      // (re)written per case below.
      await writeFixture({
        "game.json": game,
        "launch.pwa.json": manifest,
        "presentation.json": presentation,
      });
      await mkdir(path.join(fixture, "components", "cms-actor", "browser"), { recursive: true });
      await copyFile(
        path.join(repoRootPath, "components", "cms-actor", "browser", "cms-actor.browser.js"),
        path.join(fixture, "components", "cms-actor", "browser", "cms-actor.browser.js"),
      );
      await mkdir(path.dirname(path.join(fixture, ...CONTROLS_RELATIVE_SEGMENTS)), { recursive: true });
      await copyFile(
        path.join(repoRootPath, ...CONTROLS_RELATIVE_SEGMENTS),
        path.join(fixture, ...CONTROLS_RELATIVE_SEGMENTS),
      );
      for (const relativeFile of canonicalAdventure.sources) {
        const target = path.join(fixture, relativeFile);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.join(repoRootPath, relativeFile), target);
      }

      await rejectFixture(
        { "game.json": JSON.stringify({ formatVersion: 1, initial: { subsystem: "base", input: null }, subsystems: [{ key: "base" }, { key: "adventure-map" }, { key: "ghost" }] }) },
        /has no PWA binding/,
        "a subsystem without a PWA binding must be rejected",
      );
      await rejectFixture(
        { "launch.pwa.json": JSON.stringify({ formatVersion: 1, subsystems: [{ key: "ghost", module: "subsystems/base.mjs" }] }) },
        /has no PWA binding|not declared by the Game Entry/,
        "a manifest/Game Entry key-set mismatch must be rejected",
      );
      await rejectFixture(
        { "launch.pwa.json": JSON.stringify({ formatVersion: 1, subsystems: [{ key: "base", module: "../escape.mjs" }, { key: "adventure-map", module: "subsystems/adventure-map.mjs" }] }) },
        /invalid logical module/,
        "an out-of-root logical module must be rejected",
      );
      await rejectFixture(
        { "presentation.json": JSON.stringify({ formatVersion: 1, styles: [{ namespace: "Presentation", key: "page.css" }], scripts: [] }) },
        /has no Content entry/,
        "a presentation resource without Content must be rejected",
      );
      await rejectFixture(
        { "presentation.json": JSON.stringify({ formatVersion: 1, styles: [], scripts: [{ namespace: "Presentation", key: "ghost/ghost.browser.js" }] }) },
        /has no Content entry/,
        "a presentation script without a matching published resource must be rejected",
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

test("output path safety: a project root without dist/ supports both dist and temp targets", async () => {
  // Regression (P0): a fresh checkout has no dist/ — a temp-directory target
  // must not require dist/ to exist, and a dist target must create it.
  const isolated = await makeIsolatedGameRoot();
  try {
    const tempTarget = path.join(await makeTempDir(), "bundle.json");
    const tempSummary = await isolated.build(tempTarget);
    assert.equal(JSON.parse(await readText(tempSummary.outputFile)).executables.length, 2);

    const distTarget = path.join(isolated.root, "dist", "adventure-island-installation-bundle.json");
    const distSummary = await isolated.build(distTarget);
    const payload = JSON.parse(await readText(distSummary.outputFile));
    assert.equal(payload.executables.length, 2);
    assert.equal(payload.content.length, expectedContentIdentities().length);
    await assert.rejects(readText(path.join(isolated.root, "research", "bundle.json")), /ENOENT/);

    // Multi-level missing parents are created along the trusted chain — both
    // under dist/ and under the system temp directory.
    const deepDist = path.join(isolated.root, "dist", "a", "b", "bundle.json");
    await isolated.build(deepDist);
    assert.equal(JSON.parse(await readText(deepDist)).formatVersion, 1);
    const deepTemp = path.join(await makeTempDir(), "x", "y", "bundle.json");
    await isolated.build(deepTemp);
    assert.equal(JSON.parse(await readText(deepTemp)).formatVersion, 1);
  } finally {
    await rm(isolated.root, { recursive: true, force: true });
  }
});

test("output path safety: a symlink destination (including dangling) is rejected without following it", {
  skip: !symlinkSupport.ok && symlinkSupport.reason,
}, async () => {
  const isolated = await makeIsolatedGameRoot();
  try {
    await mkdir(path.join(isolated.root, "dist"), { recursive: true });
    const sentinel = path.join(isolated.root, "research", "keep.txt");
    const sentinelBefore = await readFile(sentinel, "utf8");

    const target = path.join(isolated.root, "dist", "bundle.json");
    await symlink("../research/keep.txt", target);
    await assert.rejects(() => isolated.build(target), /symlink destination|refusing/);
    assert.equal(await readFile(sentinel, "utf8"), sentinelBefore, "the sentinel behind the symlink must not be touched");
    assert.equal((await lstat(target)).isSymbolicLink(), true, "the rejected symlink must be left in place");

    const dangling = path.join(isolated.root, "dist", "dangling.json");
    await symlink("../research/does-not-exist.txt", dangling);
    await assert.rejects(() => isolated.build(dangling), /symlink destination|refusing/);
    await assert.rejects(readFile(path.join(isolated.root, "research", "does-not-exist.txt")), /ENOENT/);
    assert.equal(await readFile(sentinel, "utf8"), sentinelBefore);
  } finally {
    await rm(isolated.root, { recursive: true, force: true });
  }
});

test("output path safety: parent-directory symlinks are rejected before any directory is created", {
  skip: !symlinkSupport.ok && symlinkSupport.reason,
}, async () => {
  // Case 1 — symlinked intermediate parent with a MISSING deeper directory:
  // the write must be refused BEFORE newchild/ is created through the link.
  // (Regression for the recursive-mkdir side effect: the old implementation
  // created research/newchild/ first and rejected only afterwards.)
  {
    const isolated = await makeIsolatedGameRoot();
    try {
      await mkdir(path.join(isolated.root, "dist"), { recursive: true });
      await symlink("../research", path.join(isolated.root, "dist", "evil"));
      const before = await snapshotTree(isolated.root);
      const target = path.join(isolated.root, "dist", "evil", "newchild", "bundle.json");
      await assert.rejects(() => isolated.build(target), /refusing|protected|symlink/);
      assert.deepEqual(await snapshotTree(isolated.root), before, "a rejected build must leave the tree untouched — no research/newchild may appear");
      assert.deepEqual(await tempResidue(isolated.root), [], "no temp files may remain");
    } finally {
      await rm(isolated.root, { recursive: true, force: true });
    }
  }

  // Case 2 — direct file target behind a symlinked parent (Turn 3 regression).
  {
    const isolated = await makeIsolatedGameRoot();
    try {
      await mkdir(path.join(isolated.root, "dist"), { recursive: true });
      await symlink("../research", path.join(isolated.root, "dist", "evil"));
      const before = await snapshotTree(isolated.root);
      const target = path.join(isolated.root, "dist", "evil", "bundle.json");
      await assert.rejects(() => isolated.build(target), /refusing|protected|symlink/);
      assert.deepEqual(await snapshotTree(isolated.root), before, "no artifact may land in the protected tree");
      const sentinel = path.join(isolated.root, "research", "keep.txt");
      assert.equal(await readFile(sentinel, "utf8"), "sentinel-content\n", "the sentinel must be untouched");
    } finally {
      await rm(isolated.root, { recursive: true, force: true });
    }
  }

  // Case 3 — the dist root itself is a symlink.
  {
    const isolated = await makeIsolatedGameRoot();
    try {
      await symlink("../research", path.join(isolated.root, "dist"));
      const before = await snapshotTree(isolated.root);
      await assert.rejects(
        () => isolated.build(path.join(isolated.root, "dist", "bundle.json")),
        /refusing|protected|symlink/,
      );
      assert.deepEqual(await snapshotTree(isolated.root), before, "a symlinked dist root must be rejected without side effects");
      await assert.rejects(readText(path.join(isolated.root, "research", "bundle.json")), /ENOENT/);
    } finally {
      await rm(isolated.root, { recursive: true, force: true });
    }
  }

  // Case 4 — an ancestor symlink inside the system temp directory pointing at
  // the (fake) protected tree, with a missing deeper directory to create.
  {
    const isolated = await makeIsolatedGameRoot();
    const tmpBase = await makeTempDir();
    try {
      await symlink(path.join(isolated.root, "research"), path.join(tmpBase, "link"));
      const beforeIsolated = await snapshotTree(isolated.root);
      const beforeTmp = await snapshotTree(tmpBase);
      const target = path.join(tmpBase, "link", "newchild", "bundle.json");
      await assert.rejects(() => isolated.build(target), /refusing|protected|symlink/);
      assert.deepEqual(await snapshotTree(isolated.root), beforeIsolated, "no directory may be created inside the protected tree via a tmpdir symlink");
      assert.deepEqual(await snapshotTree(tmpBase), beforeTmp);
      assert.deepEqual(await tempResidue(isolated.root), [], "no temp files may remain");
    } finally {
      await rm(tmpBase, { recursive: true, force: true });
      await rm(isolated.root, { recursive: true, force: true });
    }
  }
});

test("output path safety: rebuilding over an existing regular artifact stays legal and byte-deterministic", async () => {
  const isolated = await makeIsolatedGameRoot();
  try {
    const target = path.join(isolated.root, "dist", "bundle.json");
    await mkdir(path.join(isolated.root, "dist"), { recursive: true });
    await writeFile(target, "stale artifact\n", "utf8");
    await isolated.build(target);
    const first = await readFile(target, "utf8");
    assert.notEqual(first, "stale artifact\n", "the stale artifact must be replaced");
    await isolated.build(target);
    assert.equal(await readFile(target, "utf8"), first, "repeated builds must be byte-identical");
    assert.equal((await lstat(target)).isSymbolicLink(), false, "the artifact must be a regular file");
  } finally {
    await rm(isolated.root, { recursive: true, force: true });
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
      ...Object.values(CONTENT_SCRIPT_SOURCE_BINDINGS),
    ];
    for (const input of whitelisted) {
      assert.match(
        input,
        /^(game\.json|launch\.pwa\.json|presentation\.json|systems\/|components\/cms-actor\/browser\/|loom-realm\/game-libs\/game-common-controls\/dist\/browser\/)/u,
        `input whitelist entry must stay canonical: ${input}`,
      );
    }
    // The Avatar Content is read verbatim from the fixed single-character
    // closure of the existing FSDB library — every published byte comes from
    // a whitelisted library file or is the derived plan record.
    for (const source of canonicalAdventure.sources) {
      assert.match(
        source,
        /^content\/\[FSDB\]adventure\//u,
        `adventure Content source must stay inside the FSDB library: ${source}`,
      );
    }
    const planEntry = canonicalAdventure.entries.find(
      (entry) => entry.namespace === AVATAR_PLAN_NAMESPACE && entry.key === AVATAR_PLAN_KEY,
    );
    assert.ok(planEntry !== undefined, "the derived plan record must be part of the closure");
    assert.ok(Buffer.isBuffer(planEntry.bytes), "the derived plan record must be generated bytes");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("the framework pin rejects mismatches and unchecked-out submodules", async () => {
  const temp = await makeTempDir();
  try {
    // A framework repository at a DIFFERENT revision than the repo Gitlink.
    const drift = path.join(temp, "drift-framework");
    await mkdir(drift, { recursive: true });
    const { execFileSync } = await import("node:child_process");
    const git = (dir, ...args) => execFileSync(
      "git",
      ["-C", dir, "-c", "user.email=fixture@example.invalid", "-c", "user.name=fixture", ...args],
      { encoding: "utf8" },
    ).trim();
    git(drift, "init", "-q");
    await writeFile(path.join(drift, "README.md"), "drift\n", "utf8");
    git(drift, "add", "-A");
    git(drift, "commit", "-q", "-m", "drift");

    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "mismatch-bundle.json"),
        frameworkRoot: drift,
      }),
      /does not match the pinned repository Gitlink/,
      "a checkout at any other revision must be rejected",
    );

    // A framework directory with no repository of its own: git would resolve
    // to the parent repository, which is NOT the submodule.
    const empty = path.join(temp, "empty-framework");
    await mkdir(empty, { recursive: true });
    await assert.rejects(
      buildAdventureIslandInstallationBundle({
        outputFile: path.join(temp, "empty-bundle.json"),
        frameworkRoot: empty,
      }),
      /not checked out/,
      "a directory that is not a submodule checkout must be rejected",
    );
    await assert.rejects(readText(path.join(temp, "mismatch-bundle.json")), /ENOENT/);
    await assert.rejects(readText(path.join(temp, "empty-bundle.json")), /ENOENT/);
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
    assert.deepEqual(graph, payload.executables.map(({ logicalModule, contentVersion }) => (
      { logicalModule, contentVersion, imports: [] }
    )), "both self-contained bundles must publish with empty import graphs");

    // Bundle-level echo of the game-entry guard: feeding the root shim source
    // in place of the published executable must fail the real graph builder.
    const shimSource = await readText(new URL("subsystems/base.mjs", repoRoot));
    await assert.rejects(
      pwaLauncher.buildPwaExecutableIndexV1([
        { logicalModule: "subsystems/base.mjs", source: shimSource, contentVersion: `sha256:${sha256(shimSource)}` },
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

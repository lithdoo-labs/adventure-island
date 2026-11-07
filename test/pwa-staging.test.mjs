// Headless validation for the Stage 4B staging orchestration
// (scripts/pwa/build-staging.mjs).
//
// Coverage:
//   - the current pinned LoomRealm generic builder is used after the framework
//     workspace and required browser artifacts are installed/built; missing
//     prerequisites fail closed before any staging write or deletion;
//   - against isolated git fixtures (real gitlink via --cacheinfo 160000) and
//     a faithful stub of the upstream generic builder (including its
//     recursive rm of the output directory): pinned CLI arguments
//     (--app-id adventure-island --base-path /pwa/adventure-island/), fixed
//     staging target, post-build verification of generation.json /
//     installation-bundle.json / runtime scripts, payload consistency;
//   - negative paths: missing builder, missing built artifacts, Gitlink
//     mismatch, submodule not checked out, symlinked staging directory
//     (target itself or an ancestor) with the sentinel intact and the stub
//     never invoked (no deletion possible), Git-tracked staging content,
//     wrong appId / missing bundleId / missing runtime script in the
//     builder output;
//   - a REAL integration test that runs only when the pinned LoomRealm
//     actually provides the generic builder — until the maintainer updates
//     the Gitlink it reports an explicit skip, never a pass.
//
// The stub is a test double for deterministic unit tests only; nothing here
// claims a real staging build or any Chromium/Service-Worker E2E.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ACTOR_SCRIPT_KEY,
  CONTENT_SCRIPT_SOURCE_BINDINGS,
  CONTROLS_SCRIPT_KEY,
  EXECUTABLE_SOURCE_BINDINGS,
  PRESENTATION_SCRIPT_NAMESPACE,
} from "../scripts/pwa/build-installation-bundle.mjs";
import { STAGING_APP_ID, STAGING_BASE_PATH, buildAdventureIslandPwaStaging } from "../scripts/pwa/build-staging.mjs";
import { AVATAR_PLAN_KEY, AVATAR_PLAN_NAMESPACE, readAdventureAvatarClosure } from "../scripts/pwa/read-adventure-fsdb.mjs";

const repoRoot = new URL("../", import.meta.url);
const repoRootPath = fileURLToPath(repoRoot);
const stagingScriptPath = fileURLToPath(new URL("../scripts/pwa/build-staging.mjs", import.meta.url));
const readText = (target) => readFile(target, "utf8");

async function copyRepoFile(relativePath, targetRoot) {
  const target = path.join(targetRoot, ...relativePath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(repoRootPath, ...relativePath.split("/")), target);
}

function runGit(directory, ...args) {
  return execFileSync(
    "git",
    ["-C", directory, "-c", "user.email=fixture@example.invalid", "-c", "user.name=fixture", ...args],
    { encoding: "utf8" },
  ).trim();
}

function runCli(args) {
  return spawnSync(process.execPath, [stagingScriptPath, ...args], { cwd: repoRootPath, encoding: "utf8" });
}

async function makeTempDir(prefix = "adventure-staging-") {
  return mkdtemp(path.join(tmpdir(), prefix));
}

// Isolated "project root" fixture: canonical documents, both Subsystem
// sources, the actor classic script, the selected FSDB closure, a protected
// research/ tree with a sentinel, and a REAL gitlink (git update-index
// --cacheinfo 160000) pointing at the embedded framework repository.
async function makeStagingFixture() {
  const game = await makeTempDir("adventure-staging-fixture-");
  await mkdir(path.join(game, "research"), { recursive: true });
  await writeFile(path.join(game, "research", "keep.txt"), "sentinel-content\n", "utf8");
  for (const name of ["game.json", "launch.pwa.json", "presentation.json"]) await copyRepoFile(name, game);
  for (const physicalPath of Object.values(EXECUTABLE_SOURCE_BINDINGS)) await copyRepoFile(physicalPath, game);
  await copyRepoFile(CONTENT_SCRIPT_SOURCE_BINDINGS[`resource\0${PRESENTATION_SCRIPT_NAMESPACE}\0${ACTOR_SCRIPT_KEY}`], game);
  const closure = await readAdventureAvatarClosure(repoRootPath);
  for (const relativePath of closure.relativeFiles) await copyRepoFile(relativePath, game);

  const framework = path.join(game, "loom-realm");
  await mkdir(path.join(framework, "apps", "pwa"), { recursive: true });
  await writeFile(path.join(framework, "apps", "pwa", "README.md"), "fixture framework\n", "utf8");
  runGit(framework, "init", "-q");
  runGit(framework, "add", "-A");
  runGit(framework, "commit", "-q", "-m", "fixture framework");
  const frameworkSha = runGit(framework, "rev-parse", "HEAD");

  runGit(game, "init", "-q");
  runGit(game, "update-index", "--add", "--cacheinfo", `160000,${frameworkSha},loom-realm`);
  runGit(game, "add", "game.json", "launch.pwa.json", "presentation.json", "systems", "components", "content");
  runGit(game, "commit", "-q", "-m", "fixture game");
  return { game, framework, frameworkSha };
}

// A faithful stub of the upstream generic builder: records its arguments,
// recursively deletes the output directory (like the real builder), then
// writes the documented artifact set. `stub-mode` selects verification
// negatives. Test double only — never counts as a real staging build.
const STUB_BUILDER_SOURCE = `
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const parsed = {};
for (let i = 0; i + 1 < args.length; i += 2) parsed[args[i]] = args[i + 1];
await writeFile(join(here, "stub-args.json"), JSON.stringify(parsed, null, 2) + "\\n");

const mode = await readFile(join(here, "stub-mode"), "utf8").catch(() => "ok");
const payload = JSON.parse(await readFile(parsed["--bundle"], "utf8"));
const out = parsed["--output-dir"];
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const generation = {
  version: 1,
  generation: "pwa-v1-" + "b".repeat(32),
  appId: parsed["--app-id"],
  basePath: parsed["--base-path"],
};
if (mode === "wrong-appid") generation.appId = "other-app";
const bundle = { bundleId: "loomrealm-pwa-sha256-" + "a".repeat(64), ...payload };
if (mode === "no-bundleid") delete bundle.bundleId;

await writeFile(join(out, "installation-bundle.json"), JSON.stringify(bundle) + "\\n");
await writeFile(join(out, "index.html"), "<!doctype html>\\n");
await writeFile(join(out, "generation.json"), JSON.stringify(generation) + "\\n");
for (const artifact of ["window.js", "session-worker.js", "worker-runner.js", "service-worker.js"]) {
  if (mode === "missing-script" && artifact === "window.js") continue;
  await writeFile(join(out, artifact), "// stub artifact\\n");
}
`.trimStart();

async function installStubBuilder(framework) {
  const scripts = path.join(framework, "apps", "pwa", "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(path.join(scripts, "build-identity.mjs"), "export const GENERATION_PLACEHOLDER = 1;\n", "utf8");
  await writeFile(path.join(scripts, "pwa-bundle-id.mjs"), "export function pwaBundleId() { return \"x\"; }\n", "utf8");
  await writeFile(path.join(scripts, "build-bundle.mjs"), STUB_BUILDER_SOURCE, "utf8");
  const controls = path.join(framework, "game-libs", "game-common-controls", "dist", "browser");
  await mkdir(controls, { recursive: true });
  await writeFile(path.join(controls, "device-input.browser.js"), "// built browser artifact\n", "utf8");
  const esbuild = path.join(framework, "apps", "pwa", "node_modules", "esbuild");
  await mkdir(esbuild, { recursive: true });
  await writeFile(path.join(esbuild, "package.json"), "{\"name\":\"esbuild\"}\n", "utf8");
}

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

const symlinkSupport = await (async () => {
  const dir = await makeTempDir("adventure-staging-symlink-probe-");
  try {
    await symlink(path.join(dir, "target.txt"), path.join(dir, "link"));
    return { ok: true };
  } catch (cause) {
    return { ok: false, reason: `symlink creation unavailable on this platform (${cause.code ?? cause.message}); symlink staging tests skipped` };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
})();

// ---------------------------------------------------------------------------
// Fail-closed behavior on the currently pinned LoomRealm
// ---------------------------------------------------------------------------

test("staging preflight matches the checked-out framework capability", async () => {
  const usage = runCli(["--output-dir", "/tmp/evil"]);
  assert.notEqual(usage.status, 0);
  assert.ok(usage.stderr.includes("Usage: node scripts/pwa/build-staging.mjs"));

  // A generic-builder-capable pin must not be treated as an absent builder.
  // Its real success path is asserted by the explicit integration test below.
  const genericBuilderAvailable = await access(new URL("loom-realm/apps/pwa/scripts/build-bundle.mjs", repoRoot))
    .then(() => true, () => false);
  if (genericBuilderAvailable) return;

  // On the historical Gitlink without the generic builder, fail closed.
  await assert.rejects(
    () => buildAdventureIslandPwaStaging(),
    /does not contain the generic PWA builder.*93648192323bf5f57996b7b54cbae641d8a53fdb/s,
  );
  const run = runCli([]);
  assert.notEqual(run.status, 0, "the staging CLI must exit non-zero without the generic builder");
  assert.match(run.stderr, /does not contain the generic PWA builder/);
  assert.match(run.stderr, /never upgrades or downloads the submodule itself/);
  assert.doesNotMatch(run.stdout, /Prepared Adventure Island PWA staging/);
  await assert.rejects(access(path.join(repoRootPath, "dist", "staging")), /ENOENT/);
});

// ---------------------------------------------------------------------------
// Deterministic orchestration against git fixtures and the builder stub
// ---------------------------------------------------------------------------

test("staging orchestrates payload and generic builder with pinned arguments", async () => {
  const fixture = await makeStagingFixture();
  try {
    await installStubBuilder(fixture.framework);
    const summary = await buildAdventureIslandPwaStaging({ gameRoot: fixture.game, frameworkRoot: fixture.framework });

    // The stub received exactly the pinned CLI arguments.
    const stubArgs = JSON.parse(await readText(path.join(fixture.framework, "apps", "pwa", "scripts", "stub-args.json")));
    const payloadPath = path.join(fixture.game, "dist", "adventure-island-installation-bundle.json");
    const stagingDir = path.join(fixture.game, "dist", "staging", STAGING_APP_ID);
    assert.deepEqual(stubArgs, {
      "--bundle": payloadPath,
      "--app-id": STAGING_APP_ID,
      "--base-path": STAGING_BASE_PATH,
      "--output-dir": stagingDir,
    });
    assert.equal(STAGING_APP_ID, "adventure-island");
    assert.equal(STAGING_BASE_PATH, "/pwa/adventure-island/");

    // The payload is the deterministic product input.
    const payload = JSON.parse(await readText(payloadPath));
    assert.equal(payload.formatVersion, 1);
    assert.deepEqual(payload.executables.map((entry) => entry.logicalModule), ["subsystems/base.mjs", "subsystems/adventure-map.mjs"]);
    const closure = await readAdventureAvatarClosure(repoRootPath);
    assert.equal(payload.content.length, closure.entries.length + 1 + Object.keys(CONTENT_SCRIPT_SOURCE_BINDINGS).length);
    assert.ok(payload.content.some((entry) => entry.namespace === PRESENTATION_SCRIPT_NAMESPACE && entry.key === CONTROLS_SCRIPT_KEY));
    assert.ok(payload.content.some((entry) => entry.namespace === PRESENTATION_SCRIPT_NAMESPACE && entry.key === ACTOR_SCRIPT_KEY));
    assert.ok(payload.content.some((entry) => entry.namespace === AVATAR_PLAN_NAMESPACE && entry.key === AVATAR_PLAN_KEY));
    const allowed = new Set([
      ...closure.entries.map((entry) => entry.namespace),
      AVATAR_PLAN_NAMESPACE,
      PRESENTATION_SCRIPT_NAMESPACE,
    ]);
    assert.ok(payload.content.every((entry) => allowed.has(entry.namespace)), "no unrelated Content may enter the staged bundle");

    // The builder output verifies against the product inputs.
    const generation = JSON.parse(await readText(path.join(stagingDir, "generation.json")));
    assert.equal(generation.appId, STAGING_APP_ID);
    assert.equal(generation.basePath, STAGING_BASE_PATH);
    const bundle = JSON.parse(await readText(path.join(stagingDir, "installation-bundle.json")));
    assert.match(bundle.bundleId, /^loomrealm-pwa-sha256-[0-9a-f]{64}$/u);
    const { bundleId, ...payloadEcho } = bundle;
    assert.deepEqual(payloadEcho, payload);
    for (const artifact of ["index.html", "window.js", "session-worker.js", "worker-runner.js", "service-worker.js"]) {
      const facts = await lstat(path.join(stagingDir, artifact));
      assert.equal(facts.isFile(), true, `missing runtime artifact ${artifact}`);
    }

    assert.equal(summary.appId, STAGING_APP_ID);
    assert.equal(summary.basePath, STAGING_BASE_PATH);
    assert.equal(summary.frameworkSha, fixture.frameworkSha);
    assert.equal(summary.bundleId, bundle.bundleId);

    // A second run succeeds over the stub-deleted staging directory.
    const second = await buildAdventureIslandPwaStaging({ gameRoot: fixture.game, frameworkRoot: fixture.framework });
    assert.equal(second.bundleId, bundle.bundleId);
  } finally {
    await rm(fixture.game, { recursive: true, force: true });
  }
});

test("staging refuses a Gitlink mismatch and an unchecked-out submodule", async () => {
  const mismatchFixture = await makeStagingFixture();
  try {
    await installStubBuilder(mismatchFixture.framework);
    runGit(mismatchFixture.framework, "commit", "--allow-empty", "-q", "-m", "drift");
    await assert.rejects(
      () => buildAdventureIslandPwaStaging({ gameRoot: mismatchFixture.game, frameworkRoot: mismatchFixture.framework }),
      /does not match the pinned repository Gitlink/,
    );
  } finally {
    await rm(mismatchFixture.game, { recursive: true, force: true });
  }

  const missingFixture = await makeStagingFixture();
  try {
    await installStubBuilder(missingFixture.framework);
    await rm(path.join(missingFixture.framework, ".git"), { recursive: true, force: true });
    await assert.rejects(
      () => buildAdventureIslandPwaStaging({ gameRoot: missingFixture.game, frameworkRoot: missingFixture.framework }),
      /not checked out/,
    );
  } finally {
    await rm(missingFixture.game, { recursive: true, force: true });
  }
});

test("staging refuses missing builder and missing framework build artifacts before any write", async () => {
  const noBuilder = await makeStagingFixture();
  try {
    await assert.rejects(
      () => buildAdventureIslandPwaStaging({ gameRoot: noBuilder.game, frameworkRoot: noBuilder.framework }),
      /does not contain the generic PWA builder/,
    );
    await assert.rejects(access(path.join(noBuilder.game, "dist", "staging")), /ENOENT/);
  } finally {
    await rm(noBuilder.game, { recursive: true, force: true });
  }

  const noArtifact = await makeStagingFixture();
  try {
    await installStubBuilder(noArtifact.framework);
    await rm(path.join(noArtifact.framework, "game-libs", "game-common-controls", "dist", "browser", "device-input.browser.js"));
    await assert.rejects(
      () => buildAdventureIslandPwaStaging({ gameRoot: noArtifact.game, frameworkRoot: noArtifact.framework }),
      /required LoomRealm build artifact/,
    );
    await assert.rejects(
      access(path.join(noArtifact.framework, "apps", "pwa", "scripts", "stub-args.json")),
      /ENOENT/,
      "the generic builder must never be invoked when preconditions fail",
    );
    await assert.rejects(access(path.join(noArtifact.game, "dist", "staging")), /ENOENT/);
  } finally {
    await rm(noArtifact.game, { recursive: true, force: true });
  }
});

test("staging refuses a symlinked staging target or ancestor without deleting anything", {
  skip: !symlinkSupport.ok && symlinkSupport.reason,
}, async () => {
  // The staging directory itself is a symlink into the protected tree.
  {
    const fixture = await makeStagingFixture();
    try {
      await installStubBuilder(fixture.framework);
      await mkdir(path.join(fixture.game, "dist", "staging"), { recursive: true });
      await symlink(path.join(fixture.game, "research"), path.join(fixture.game, "dist", "staging", STAGING_APP_ID));
      const before = await snapshotTree(fixture.game);
      await assert.rejects(
        () => buildAdventureIslandPwaStaging({ gameRoot: fixture.game, frameworkRoot: fixture.framework }),
        /symlinked staging path|protected/,
      );
      assert.deepEqual(await snapshotTree(fixture.game), before, "nothing may be created or deleted through the symlink");
      await assert.rejects(
        access(path.join(fixture.framework, "apps", "pwa", "scripts", "stub-args.json")),
        /ENOENT/,
        "the builder (which rm -rf's its output dir) must never run against a symlinked target",
      );
    } finally {
      await rm(fixture.game, { recursive: true, force: true });
    }
  }

  // An ancestor of the staging directory is a symlink into the protected tree.
  {
    const fixture = await makeStagingFixture();
    try {
      await installStubBuilder(fixture.framework);
      await mkdir(path.join(fixture.game, "dist"), { recursive: true });
      await symlink(path.join(fixture.game, "research"), path.join(fixture.game, "dist", "staging"));
      const before = await snapshotTree(fixture.game);
      await assert.rejects(
        () => buildAdventureIslandPwaStaging({ gameRoot: fixture.game, frameworkRoot: fixture.framework }),
        /symlinked staging path|protected/,
      );
      assert.deepEqual(await snapshotTree(fixture.game), before);
      await assert.rejects(
        access(path.join(fixture.framework, "apps", "pwa", "scripts", "stub-args.json")),
        /ENOENT/,
      );
    } finally {
      await rm(fixture.game, { recursive: true, force: true });
    }
  }
});

test("staging refuses a staging directory containing Git-tracked files", async () => {
  const fixture = await makeStagingFixture();
  try {
    await installStubBuilder(fixture.framework);
    const tracked = path.join(fixture.game, "dist", "staging", STAGING_APP_ID, "keep.txt");
    await mkdir(path.dirname(tracked), { recursive: true });
    await writeFile(tracked, "tracked content\n", "utf8");
    runGit(fixture.game, "add", "-f", "dist/staging/adventure-island/keep.txt");
    runGit(fixture.game, "commit", "-q", "-m", "track staging file");
    await assert.rejects(
      () => buildAdventureIslandPwaStaging({ gameRoot: fixture.game, frameworkRoot: fixture.framework }),
      /Git-tracked files/,
    );
    assert.equal(await readText(tracked), "tracked content\n");
    await assert.rejects(access(path.join(fixture.framework, "apps", "pwa", "scripts", "stub-args.json")), /ENOENT/);
  } finally {
    await rm(fixture.game, { recursive: true, force: true });
  }
});

test("staging verifies the builder's real output and fails on divergence", async () => {
  const fixture = await makeStagingFixture();
  const scripts = () => path.join(fixture.framework, "apps", "pwa", "scripts");
  try {
    await installStubBuilder(fixture.framework);
    const build = () => buildAdventureIslandPwaStaging({ gameRoot: fixture.game, frameworkRoot: fixture.framework });

    await writeFile(path.join(scripts(), "stub-mode"), "wrong-appid", "utf8");
    await assert.rejects(build, /generation\.json does not describe the pinned Adventure Island staging product/);

    await writeFile(path.join(scripts(), "stub-mode"), "no-bundleid", "utf8");
    await assert.rejects(build, /missing a valid bundleId/);

    await writeFile(path.join(scripts(), "stub-mode"), "missing-script", "utf8");
    await assert.rejects(build, /missing window\.js/);

    // Recovery: with a faithful builder output the same fixture succeeds.
    await rm(path.join(scripts(), "stub-mode"), { force: true });
    await assert.doesNotReject(build);
  } finally {
    await rm(fixture.game, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Real integration — requires the pinned LoomRealm workspace and generated
// SDK artifacts to be installed/built. CI prepares them and rejects skips.
// ---------------------------------------------------------------------------

const realBuilderPresent = await (async () => {
  try {
    await access(new URL("loom-realm/apps/pwa/scripts/build-bundle.mjs", repoRoot));
    return true;
  } catch {
    return false;
  }
})();

test("real generic-builder integration produces a verifiable staging directory", {
  skip: !realBuilderPresent
    && "requires the pinned LoomRealm generic builder and its generated SDK artifacts; run npm ci and npm run build:bundle inside loom-realm first",
}, async () => {
  const result = await buildAdventureIslandPwaStaging();
  assert.equal(result.appId, STAGING_APP_ID);
  assert.equal(result.basePath, STAGING_BASE_PATH);
  const generation = JSON.parse(await readText(path.join(result.stagingDir, "generation.json")));
  assert.equal(generation.appId, STAGING_APP_ID);
  assert.equal(generation.basePath, STAGING_BASE_PATH);
  for (const artifact of ["index.html", "window.js", "session-worker.js", "worker-runner.js", "service-worker.js"]) {
    await access(path.join(result.stagingDir, artifact));
  }
});

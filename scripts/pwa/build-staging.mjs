#!/usr/bin/env node
/**
 * Adventure Island PWA staging orchestration — Stage 4B-0 (product side).
 *
 * Fail-closed orchestration around LoomRealm's GENERIC PWA bundle builder
 * (upstream apps/pwa/scripts/build-bundle.mjs, verified read-only at
 * 93648192323bf5f57996b7b54cbae641d8a53fdb):
 *
 *   1. Preconditions are verified BEFORE anything is written: the checked-out
 *      LoomRealm HEAD must equal the repository Gitlink (the only trusted
 *      pin; never auto-updated, never downloaaded here), the generic builder
 *      script plus its helpers must actually exist in the submodule, and the
 *      builder's required build artifacts (game-common-controls browser
 *      bundle, esbuild toolchain) must be present. Any missing precondition
 *      exits non-zero with upgrade/build guidance — on the currently pinned
 *      c5217e47 (which has no generic build-bundle.mjs) this ALWAYS fails
 *      and never fabricates a PWA directory.
 *   2. The payload is produced by scripts/pwa/build-installation-bundle.mjs
 *      (deterministic, path-safe, validated against the upstream schema).
 *   3. The REAL generic builder CLI is invoked with pinned arguments
 *      (--app-id adventure-island --base-path /pwa/adventure-island/) and a
 *      single fixed, untracked staging directory
 *      <repo>/dist/staging/adventure-island/ — no CLI override exists. The
 *      generic builder recursively deletes that directory, so the existing
 *      path chain is verified symlink-free, untracked, and outside every
 *      protected tree BEFORE the builder is spawned; this orchestrator
 *      itself never deletes anything.
 *   4. The builder's real outputs are verified: generation.json
 *      (appId/basePath), installation-bundle.json (bundleId + the exact
 *      product payload), index.html and the four runtime scripts. A local
 *      staging build is NOT a Chromium installation or Service-Worker E2E
 *      — those are separate acceptances (Stage 4B proper, maintainer-owned).
 *
 * No production ports, Docker, reverse proxy, or deployment is touched.
 */
import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildAdventureIslandInstallationBundle } from "./build-installation-bundle.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Pinned product identity — never overridable from the command line. */
export const STAGING_APP_ID = "adventure-island";
export const STAGING_BASE_PATH = "/pwa/adventure-island/";

const GENERIC_BUILDER = join("apps", "pwa", "scripts", "build-bundle.mjs");
const GENERIC_BUILDER_HELPERS = Object.freeze([
  join("apps", "pwa", "scripts", "build-identity.mjs"),
  join("apps", "pwa", "scripts", "pwa-bundle-id.mjs"),
]);
const REQUIRED_BUILT_ARTIFACTS = Object.freeze([
  join("game-libs", "game-common-controls", "dist", "browser", "device-input.browser.js"),
]);
const RUNTIME_ARTIFACTS = Object.freeze([
  "index.html",
  "window.js",
  "session-worker.js",
  "worker-runner.js",
  "service-worker.js",
]);
/** Verified upstream revision that provides the generic builder. */
const UPSTREAM_GENERIC_BUILDER_REVISION = "93648192323bf5f57996b7b54cbae641d8a53fdb";

const SENSITIVE_MARKERS = Object.freeze(["research", "CMS079", ".wz", ".raw", "glm-work", "task/"]);

function git(directory, ...args) {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
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

// ---------------------------------------------------------------------------
// Preconditions (all verified before any write)
// ---------------------------------------------------------------------------

/** The repository Gitlink is the only trusted pin; the checkout must match. */
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
        + "the Gitlink is the only trusted pin — update it via a maintainer PR and check the submodule out exactly",
    );
  }
  return checkedOut;
}

async function assertGenericBuilderPresent(framework, builderScript) {
  const facts = await pathFacts(builderScript);
  if (facts === null || !facts.isFile()) {
    throw new Error(
      `the pinned LoomRealm checkout does not contain the generic PWA builder at ${relative(framework, builderScript)}; `
        + `Stage 4B requires a maintainer PR updating the loom-realm Gitlink to a revision with apps/pwa/scripts/build-bundle.mjs `
        + `(verified upstream: ${UPSTREAM_GENERIC_BUILDER_REVISION}); this tool never upgrades or downloads the submodule itself`,
    );
  }
  for (const helper of GENERIC_BUILDER_HELPERS) {
    const helperFacts = await pathFacts(join(framework, helper));
    if (helperFacts === null || !helperFacts.isFile()) {
      throw new Error(`the generic PWA builder is missing its helper ${helper} — the submodule checkout is inconsistent`);
    }
  }
}

async function assertFrameworkBuildArtifacts(framework) {
  for (const artifact of REQUIRED_BUILT_ARTIFACTS) {
    const facts = await pathFacts(join(framework, artifact));
    if (facts === null || !facts.isFile()) {
      throw new Error(
        `required LoomRealm build artifact ${artifact} is missing — run the framework's build `
          + "(`npm install` and the game-libs build) inside the pinned loom-realm checkout first",
      );
    }
  }
  const esbuildLocations = [
    join(framework, "apps", "pwa", "node_modules", "esbuild"),
    join(framework, "node_modules", "esbuild"),
  ];
  if (!esbuildLocations.some((location) => existsSync(join(location, "package.json")))) {
    throw new Error(
      "esbuild is not installed inside the pinned loom-realm checkout (the generic builder bundles its runtime scripts with it) "
        + "— run `npm install` inside loom-realm/ first",
    );
  }
}

/**
 * The generic builder recursively deletes the staging directory, so every
 * EXISTING segment of <repo>/dist/staging/adventure-island must be a real
 * directory (no symlinks anywhere in the chain — a symlink would be deleted
 * through), must contain no Git-tracked files, and must stay out of every
 * protected tree. Missing segments are fine (the builder creates them under
 * the validated chain). Nothing is deleted by this orchestrator itself.
 */
async function assertSafeStagingDirectory(game, stagingDir) {
  const distRoot = join(game, "dist");
  if (!insideDirectory(distRoot, stagingDir)) {
    throw new Error(`internal error: the staging directory must live under <repo>/dist/ (fail closed): ${stagingDir}`);
  }
  const relativeToRepo = relative(game, stagingDir).replaceAll("\\", "/");
  for (const forbidden of ["research/", "glm-work/", "task/", "loom-realm/", ".github/", "apps/", "systems/"]) {
    if (relativeToRepo === forbidden.slice(0, -1) || relativeToRepo.startsWith(forbidden)) {
      throw new Error(`refusing to stage into a protected tree: ${stagingDir}`);
    }
  }
  let tracked;
  try {
    tracked = execFileSync("git", ["-C", game, "ls-files", "--", stagingDir], { encoding: "utf8" }).trim();
  } catch {
    tracked = "";
  }
  if (tracked !== "") {
    throw new Error(`refusing to stage into a directory containing Git-tracked files (the generic builder would delete them): ${stagingDir}`);
  }
  const chain = relative(distRoot, stagingDir).split(sep).filter((segment) => segment !== "" && segment !== "." && segment !== "..");
  let current = distRoot;
  const existingChain = [distRoot];
  for (const segment of chain) {
    current = join(current, segment);
    existingChain.push(current);
  }
  for (const directory of existingChain) {
    const facts = await pathFacts(directory);
    if (facts === null) break; // deeper missing segments are created by the builder under the validated chain
    if (facts.isSymbolicLink()) {
      throw new Error(`refusing to hand a symlinked staging path to the generic builder (it would rm -rf through it): ${directory}`);
    }
    if (!facts.isDirectory()) {
      throw new Error(`the staging path exists but is not a directory: ${directory}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Default payload step: the safe, deterministic product generator. */
async function defaultRunPayloadBuilder({ gameRoot, frameworkRoot, outputFile }) {
  return buildAdventureIslandInstallationBundle({ gameRoot, frameworkRoot, outputFile });
}

/** Default generic-builder step: the real upstream CLI with pinned arguments. */
function defaultRunGenericBuilder({ builderScript, payloadPath, stagingDir }) {
  const result = spawnSync(
    process.execPath,
    [
      builderScript,
      "--bundle", payloadPath,
      "--app-id", STAGING_APP_ID,
      "--base-path", STAGING_BASE_PATH,
      "--output-dir", stagingDir,
    ],
    { cwd: dirname(builderScript), encoding: "utf8" },
  );
  if (result.error !== undefined) {
    throw new Error(`failed to execute the generic PWA builder: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = `${result.stderr}\n${result.stdout}`.trim();
    throw new Error(`the generic PWA builder failed (exit ${result.status}): ${details.slice(-2000)}`);
  }
  return result;
}

/** Verifies the generic builder's REAL outputs against the product inputs. */
async function verifyStagingOutput(stagingDir, payload, payloadPath) {
  const generation = JSON.parse(await readFile(join(stagingDir, "generation.json"), "utf8"));
  if (generation.appId !== STAGING_APP_ID || generation.basePath !== STAGING_BASE_PATH || generation.version !== 1
    || typeof generation.generation !== "string" || generation.generation.length === 0) {
    throw new Error(`generation.json does not describe the pinned Adventure Island staging product: ${JSON.stringify(generation)}`);
  }
  const bundle = JSON.parse(await readFile(join(stagingDir, "installation-bundle.json"), "utf8"));
  if (typeof bundle.bundleId !== "string" || !bundle.bundleId.startsWith("loomrealm-pwa-sha256-")) {
    throw new Error("installation-bundle.json is missing a valid bundleId");
  }
  for (const key of ["formatVersion", "gameEntryText", "launchManifestText", "presentation", "executables", "content"]) {
    if (JSON.stringify(bundle[key]) !== JSON.stringify(payload[key])) {
      throw new Error(`installation-bundle.json diverges from the generated payload at "${key}" (${payloadPath})`);
    }
  }
  const bundleText = JSON.stringify(bundle);
  for (const marker of SENSITIVE_MARKERS) {
    if (bundleText.includes(marker)) {
      throw new Error(`the staging bundle unexpectedly contains "${marker}"`);
    }
  }
  for (const artifact of RUNTIME_ARTIFACTS) {
    const facts = await pathFacts(join(stagingDir, artifact));
    if (facts === null || !facts.isFile()) {
      throw new Error(`the generic builder output is missing ${artifact}`);
    }
  }
  return { generation, bundle };
}

/**
 * Runs the full Stage 4B-0 staging orchestration against a game repository.
 * `builderScript`, `runPayloadBuilder`, and `runGenericBuilder` are injection
 * points for deterministic tests only — the CLI never overrides them.
 */
export async function buildAdventureIslandPwaStaging({
  gameRoot = root,
  frameworkRoot,
  payloadOutputFile,
  builderScript,
  runPayloadBuilder = defaultRunPayloadBuilder,
  runGenericBuilder = defaultRunGenericBuilder,
} = {}) {
  const game = resolveGameRoot(gameRoot);
  const framework = frameworkRoot === undefined ? join(game, "loom-realm") : resolveGameRoot(frameworkRoot);
  const payloadPath = payloadOutputFile === undefined
    ? join(game, "dist", "adventure-island-installation-bundle.json")
    : resolveGameRoot(payloadOutputFile);
  const stagingDir = join(game, "dist", "staging", STAGING_APP_ID);
  const builder = builderScript === undefined ? join(framework, GENERIC_BUILDER) : resolveGameRoot(builderScript);

  // Preconditions — all fail closed before anything is written or deleted.
  const frameworkSha = assertFrameworkPin(game, framework);
  await assertGenericBuilderPresent(framework, builder);
  await assertFrameworkBuildArtifacts(framework);
  await assertSafeStagingDirectory(game, stagingDir);

  // Payload: safe, deterministic, schema-validated product input.
  const payloadSummary = await runPayloadBuilder({ gameRoot: game, frameworkRoot: framework, outputFile: payloadPath });
  const payload = JSON.parse(await readFile(payloadSummary.outputFile ?? payloadPath, "utf8"));

  // Real generic builder with pinned arguments and the fixed staging target.
  await runGenericBuilder({ builderScript: builder, payloadPath: payloadSummary.outputFile ?? payloadPath, stagingDir });

  // Verify the builder's real outputs.
  const verified = await verifyStagingOutput(stagingDir, payload, payloadPath);
  return Object.freeze({
    appId: STAGING_APP_ID,
    basePath: STAGING_BASE_PATH,
    stagingDir,
    payloadOutputFile: payloadSummary.outputFile ?? payloadPath,
    executableCount: payload.executables.length,
    contentCount: payload.content.length,
    bundleId: verified.bundle.bundleId,
    generation: verified.generation.generation,
    frameworkSha,
  });
}

function resolveGameRoot(value) {
  const candidate = String(value);
  if (candidate.length === 0) throw new TypeError("game root must be a non-empty path");
  return isAbsolute(candidate) ? candidate : resolve(candidate);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length > 2) {
    console.error("Usage: node scripts/pwa/build-staging.mjs   (no arguments; app id, base path, and staging directory are pinned)");
    process.exitCode = 2;
  } else {
    try {
      const result = await buildAdventureIslandPwaStaging();
      console.log("Prepared Adventure Island PWA staging via the LoomRealm generic builder");
      console.log(JSON.stringify(result));
    } catch (cause) {
      console.error(`build-staging: ${cause.message}`);
      console.error("Stage 4B-0 fail closed: nothing was written or deleted. A local staging build is not a Chromium/Service-Worker E2E.");
      process.exitCode = 1;
    }
  }
}

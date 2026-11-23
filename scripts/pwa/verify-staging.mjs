#!/usr/bin/env node
/** Record that the generic staging tree came from this commit and the pinned LoomRealm gitlink. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRAMEWORK_PIN = "93648192323bf5f57996b7b54cbae641d8a53fdb";
const root = fileURLToPath(new URL("../../", import.meta.url));

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

function gitBlob(cwd, spec) {
  return execFileSync("git", ["-C", cwd, "show", spec]);
}

export async function verifyStaging({
  gameRoot = root,
  stagingDir = null,
  expectedSha = null,
  writeProvenance = true,
} = {}) {
  const game = resolve(gameRoot);
  const dir = stagingDir ?? join(game, "dist", "staging", "adventure-island");
  const [bundle, generation, serviceWorker] = await Promise.all([
    readFile(join(dir, "installation-bundle.json"), "utf8").then(JSON.parse),
    readFile(join(dir, "generation.json"), "utf8").then(JSON.parse),
    readFile(join(dir, "service-worker.js"), "utf8"),
  ]);
  assert.equal(generation.version, 1);
  assert.equal(generation.appId, "adventure-island");
  assert.equal(generation.basePath, "/pwa/adventure-island/");
  assert.equal(bundle.formatVersion, 1);
  assert.match(bundle.bundleId ?? "", /^loomrealm-pwa-sha256-[0-9a-f]{64}$/);
  assert.deepEqual(bundle.executables.map((entry) => entry.logicalModule).sort(), [
    "subsystems/adventure-map.mjs",
    "subsystems/base.mjs",
  ]);
  for (const entry of bundle.executables) {
    assert.equal(entry.mime, "text/javascript");
    assert.equal(entry.contentVersion, `sha256:${sha256(entry.source)}`);
    assert.doesNotMatch(entry.source, /\bfrom\s*["']@loomrealm(?:-game)?\//u);
  }
  assert.ok(bundle.content.some((entry) => entry.kind === "record"
    && entry.namespace === "struct.AdventureAvatarPlan"
    && entry.key === "bootstrap"));
  assert.equal(serviceWorker.includes("Service-Worker-Allowed"), false);
  for (const name of ["index.html", "window.js", "session-worker.js", "worker-runner.js"]) {
    assert.ok((await readFile(join(dir, name))).length > 0, name);
  }

  const gameSha = git(game, ["rev-parse", "HEAD"]);
  const frameworkSha = git(game, ["rev-parse", "HEAD:loom-realm"]);
  assert.equal(frameworkSha, FRAMEWORK_PIN);
  if (expectedSha) assert.equal(gameSha, expectedSha);
  const record = {
    version: 1,
    repository: "lithdoo-labs/adventure-island",
    gameCommit: gameSha,
    frameworkCommit: frameworkSha,
    gameSha256: sha256(gitBlob(game, "HEAD:game.json")),
    launchSha256: sha256(gitBlob(game, "HEAD:launch.pwa.json")),
    presentationSha256: sha256(gitBlob(game, "HEAD:presentation.json")),
    bundleId: bundle.bundleId,
    contentRecords: bundle.content.length,
    executableCount: bundle.executables.length,
    fsdbRoot: "content/[FSDB]adventure",
  };
  const provenancePath = join(dir, "source-provenance.json");
  try {
    const existing = JSON.parse(await readFile(provenancePath, "utf8"));
    assert.deepEqual(existing, record, "staging provenance does not match this commit");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (!writeProvenance) throw new Error("PWA artifact is missing its provenance record");
    await mkdir(dirname(provenancePath), { recursive: true });
    await writeFile(provenancePath, `${JSON.stringify(record, null, 2)}\n`);
  }
  return record;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyStaging({ expectedSha: process.env.EXPECTED_SHA || null });
  console.log(JSON.stringify(result));
}

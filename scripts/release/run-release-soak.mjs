#!/usr/bin/env node
/**
 * 30-minute release qualification (or shorter bounded cycles).
 *
 * PowerShell example (full qualification):
 *   $env:ADVENTURE_RELEASE_SOAK_MS='1800000'
 *   npm.cmd run release:soak
 *
 * Ordinary bounded dev check (default 6 resize cycles, no duration gate):
 *   node scripts/release/run-release-soak.mjs
 */
import { spawnSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const soakTest = path.join(repoRoot, "test", "pwa-release-soak.e2e.test.mjs");
const runE2e = path.join(repoRoot, "loom-realm", "apps", "pwa", "scripts", "run-e2e.mjs");
const productStaging = path.join(repoRoot, "dist", "staging", "adventure-island");
const frameworkStaging = path.join(
  repoRoot,
  "loom-realm",
  "apps",
  "pwa",
  "dist",
  "staging",
  "pwa",
  "adventure-island",
);

const env = { ...process.env };
if (!env.LOOMREALM_PWA_BASE_PATH) {
  env.LOOMREALM_PWA_BASE_PATH = "/pwa/adventure-island/";
}
if (!env.ADVENTURE_RELEASE_SOAK_MS && !env.ADVENTURE_RELEASE_SOAK_CYCLES) {
  env.ADVENTURE_RELEASE_SOAK_CYCLES = String(6);
}
const qualification = Number(env.ADVENTURE_RELEASE_SOAK_MS ?? 0) > 0
  || Number(env.ADVENTURE_RELEASE_SOAK_CYCLES ?? 0) > 6;

const staging = process.platform === "win32"
  ? spawnSync(
    process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe",
    ["/d", "/s", "/c", "npm.cmd run pwa:staging"],
    { cwd: repoRoot, env, stdio: "inherit", shell: false },
  )
  : spawnSync("npm", ["run", "pwa:staging"], { cwd: repoRoot, env, stdio: "inherit", shell: false });
if (staging.error) throw staging.error;
if (staging.status !== 0) process.exit(staging.status ?? 1);

await rm(frameworkStaging, { recursive: true, force: true });
await mkdir(path.dirname(frameworkStaging), { recursive: true });
await cp(productStaging, frameworkStaging, { recursive: true });

function runPwaTest(testFile) {
  return spawnSync(
    process.execPath,
    [runE2e, "staging", testFile],
    { cwd: repoRoot, env, stdio: "inherit" },
  );
}

if (qualification) {
  const canonicalTest = path.join(repoRoot, "test", "pwa-browser.e2e.test.mjs");
  const canonical = runPwaTest(canonicalTest);
  if (canonical.error) throw canonical.error;
  if (canonical.status !== 0) process.exit(canonical.status ?? 1);
}

const child = runPwaTest(soakTest);
if (child.error) throw child.error;
process.exit(child.status ?? 1);

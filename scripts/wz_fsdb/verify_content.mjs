#!/usr/bin/env node
/**
 * Real Content Service + ContentClient verification over a converted CMS079
 * FSDB (full 16-package database or the avatar subset).
 *
 * Pipeline (all from the PINNED loom-realm submodule):
 *   installation root containing [FSDB]cms
 *     → prepareHostraGame (PREPARE; validates game.json + launch manifest)
 *     → prepareDesktopContentView (trusted Content Index; contentVersion of
 *       EVERY entry = SHA-256 of its body — this is the deep byte check)
 *     → createDesktopContentService (Content HTTP v1, bearer grant)
 *     → createBoundContentClient (record / group / resource)
 *
 * If the target only contains the [FSDB]cms directory, the game entry
 * documents and a stub subsystem are written next to it (outside the
 * database root) so the same converted output can be verified in place — no
 * copying of large databases.
 *
 * Usage:
 *   node scripts/wz_fsdb/verify_content.mjs --fsdb <installation root or [FSDB]cms root> \
 *     [--out <report.json>] [--sound] [--group <namespace>/<key>]
 *
 * Prints counts, identities, versions and classifications only — never asset
 * bytes. --sound additionally reads one resource.音 entry (full database).
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const loomRoot = path.join(repoRoot, "loom-realm");
const require = createRequire(path.join(loomRoot, "package.json"));
const importLoom = async (specifier) =>
  import(pathToFileURL(require.resolve(specifier, { conditions: new Set(["node", "import"]) })).href);

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function args() {
  const parsed = { _: [] };
  for (let index = 2; index < process.argv.length; index += 1) {
    const value = process.argv[index];
    if (value.startsWith("--")) parsed[value.slice(2)] = process.argv[++index] ?? true;
    else parsed._.push(value);
  }
  return parsed;
}

async function ensureInstallation(target) {
  const mode = existsSync(path.join(target, "[FSDB]cms"))
    ? "installation-root"
    : existsSync(path.join(target, "[struct]Look")) || existsSync(path.join(target, "[struct]ZMap")) ? "db-root" : null;
  const parent = mode === "installation-root" ? target : path.dirname(target);
  if (mode === null) throw new Error(`${target} contains neither [FSDB]cms nor converted tables`);
  if (mode === "db-root" && path.basename(target) !== "[FSDB]cms") {
    throw new Error(`database root must be named [FSDB]cms (got ${path.basename(target)})`);
  }
  await mkdir(path.join(parent, "subsystems"), { recursive: true });
  const files = [
    [path.join(parent, "game.json"), JSON.stringify({ formatVersion: 1, subsystems: [{ key: "verify" }], initial: { input: null, subsystem: "verify" } }, null, 2)],
    [path.join(parent, "launch.hostra.json"), JSON.stringify({ formatVersion: 1, subsystems: [{ key: "verify", module: "subsystems/verify.mjs" }] })],
    [path.join(parent, "subsystems", "verify.mjs"), "export default () => ({ frame() {} });\n"],
  ];
  const created = [];
  for (const [file, text] of files) {
    if (!existsSync(file)) {
      await writeFile(file, text, "utf8");
      created.push(path.relative(parent, file));
    }
  }
  return { installationRoot: parent, createdFiles: created };
}

const findings = [];

async function main() {
  const options = args();
  const target = path.resolve(String(options.fsdb ?? ""));
  if (!target) throw new Error("pass --fsdb <installation root or [FSDB]cms root>");
  const { installationRoot, createdFiles } = await ensureInstallation(target);

  const hostra = await importLoom("@loomrealm/game-launcher-hostra");
  const desktop = await importLoom("@loomrealm/desktop");
  const { createBoundContentClient } = await importLoom("@loomrealm/subsystem/host");

  const prepared = await hostra.prepareHostraGame({
    source: { installationRoot },
    runnerPolicy: { helloDeadlineMs: 5_000, frameDeadlineMs: 5_000, terminalCleanupDeadlineMs: 1_000, terminationGraceMs: 100 },
  });
  const view = await desktop.prepareDesktopContentView(prepared);
  const service = await desktop.createDesktopContentService({ view });
  const grant = service.createGrant({
    permissions: ["manifest", "records", "groups", "resources"],
    expiresAtUnixMs: Date.now() + 30 * 60_000,
  });
  const access = service.access(grant);
  const lifetime = new AbortController();
  const content = createBoundContentClient({ origin: access.origin, installationId: access.installationId, token: access.token }, lifetime.signal);

  const report = { installationId: access.installationId, createdFiles, checks: {} };

  // ---- records: the five Looks + ZMap -----------------------------------
  const lookKeys = ["00002000", "00012000", "00020000", "00030000", "01302000"];
  const records = [];
  for (const key of lookKeys) {
    const record = await content.record("struct.Look", key);
    const raw = await fetch(new URL(`/_lr/v1/games/${encodeURIComponent(access.installationId)}/records/${encodeURIComponent("struct.Look")}/${encodeURIComponent(key)}`, access.origin), { headers: { Authorization: `Bearer ${access.token}` } });
    const bytes = Buffer.from(await raw.arrayBuffer());
    const verified = record.contentVersion === sha256(bytes);
    if (!verified) findings.push({ kind: "record-version-mismatch", key });
    records.push({ namespace: "struct.Look", key, contentVersion: record.contentVersion, sha256Match: verified, mime: raw.headers.get("content-type") });
  }
  const zmap = await content.record("struct.ZMap", "order");
  const zmapKeys = Object.keys(zmap.value ?? {});
  report.checks.records = { entries: records, zmap: { contentVersion: zmap.contentVersion, orderLength: zmapKeys.length } };

  // ---- group: a real sample ----------------------------------------------
  let groupCheck = null;
  if (typeof options.group === "string") {
    const [namespace, key] = options.group.split("/");
    const group = await content.group(namespace, key);
    groupCheck = { namespace, key, rows: group.rows.length, contentVersion: group.contentVersion };
  } else if (options.group !== false) {
    // Auto: prefer the documented group.Tile/100000000 sample when present.
    try {
      const group = await content.group("group.Tile", "100000000");
      groupCheck = { namespace: "group.Tile", key: "100000000", rows: group.rows.length, contentVersion: group.contentVersion, choice: "design sample" };
    } catch {
      const response = await fetch(new URL(`/_lr/v1/games/${encodeURIComponent(access.installationId)}/groups/group.Tile/100000000`, access.origin), { headers: { Authorization: `Bearer ${access.token}` } });
      if (response.status !== 404) findings.push({ kind: "group-tile-read-failed", status: response.status });
      groupCheck = { skipped: "group.Tile/100000000 not present in this database (avatar subset)" };
    }
  }
  if (groupCheck?.rows !== undefined) {
    const raw = await fetch(new URL(`/_lr/v1/games/${encodeURIComponent(access.installationId)}/groups/${encodeURIComponent(groupCheck.namespace)}/${encodeURIComponent(groupCheck.key)}`, access.origin), { headers: { Authorization: `Bearer ${access.token}` } });
    const bytes = Buffer.from(await raw.arrayBuffer());
    if (raw.headers.get("content-type")?.split(";")[0] !== "application/x-ndjson") findings.push({ kind: "group-mime-invalid" });
    groupCheck.sha256Match = groupCheck.contentVersion === sha256(bytes);
    if (!groupCheck.sha256Match) findings.push({ kind: "group-version-mismatch" });
  }
  report.checks.group = groupCheck;

  // ---- resources: avatar plan canvases (+ one sound on request) ---------
  const { buildCms079AvatarPlan } = await import(
    pathToFileURL(path.join(repoRoot, "systems", "adventure-island", "cms079-avatar-plan.mjs")).href
  );
  const plan = await buildCms079AvatarPlan(content);
  const planKeys = new Set();
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) for (const layer of frame.layers) planKeys.add(layer.resource.key);
  }
  let pngOk = 0;
  const pngSamples = [];
  for (const key of planKeys) {
    const resource = await content.resource("resource.图", key);
    const mimeEssence = resource.mime?.split(";")[0]?.trim().toLowerCase();
    const versionOk = resource.contentVersion === sha256(Buffer.from(resource.bytes));
    if (mimeEssence !== "image/png" || !versionOk) {
      findings.push({ kind: "resource-invalid", key, mime: resource.mime, versionOk });
    } else {
      pngOk += 1;
      if (pngSamples.length < 5) pngSamples.push({ key, bytes: resource.bytes.length, contentVersion: resource.contentVersion });
    }
  }
  report.checks.resources = { avatarPlanPngs: { requested: planKeys.size, verified: pngOk }, samples: pngSamples, planActions: Object.keys(plan.actions) };

  let soundCheck = null;
  if (options.sound) {
    const soundPath = "Sound/Bgm00/FloralLife".split("/").map(encodeURIComponent).join("/");
    const response = await fetch(new URL(`/_lr/v1/games/${encodeURIComponent(access.installationId)}/resources/${encodeURIComponent("resource.音")}/${soundPath}`, access.origin), { headers: { Authorization: `Bearer ${access.token}` } });
    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer());
      const version = response.headers.get("x-loom-content-version");
      soundCheck = {
        namespace: "resource.音", key: "Sound/Bgm00/FloralLife", bytes: bytes.length,
        mime: response.headers.get("content-type"), contentVersion: version, sha256Match: version === sha256(bytes),
      };
      if (!soundCheck.sha256Match) findings.push({ kind: "sound-version-mismatch" });
    } else {
      soundCheck = { skipped: `Sound/Bgm00/FloralLife HTTP ${response.status}` };
    }
  }
  report.checks.sound = soundCheck;

  // ---- fail-closed probes -------------------------------------------------
  const probes = [];
  const missing = await content.resource("resource.图", "Look/00002000/nonexistent/9/ghost").then(() => ({ unexpected: "resolved" }), (error) => error.code);
  probes.push({ probe: "missing-resource", result: missing });
  const badNamespace = await content.record("struct.Nope", "00002000").then(() => ({ unexpected: "resolved" }), (error) => error.code);
  probes.push({ probe: "unknown-record-namespace", result: badNamespace });
  const unauthorized = await fetch(new URL(`/_lr/v1/games/${encodeURIComponent(access.installationId)}/records/${encodeURIComponent("struct.ZMap")}/order`, access.origin));
  probes.push({ probe: "missing-bearer", httpStatus: unauthorized.status });
  report.checks.failClosed = probes;
  for (const probe of probes) {
    const failed = probe.unexpected === "resolved" || (probe.httpStatus !== undefined && probe.httpStatus !== 401);
    if (failed) findings.push({ kind: "fail-closed-violation", probe });
  }

  report.findings = findings;
  report.verdict = findings.length === 0 ? "PASS" : "FAIL";
  lifetime.abort();
  service.revokeGrant(grant);
  await service.close();

  const text = JSON.stringify(report, null, 2);
  console.log(text);
  if (options.out) await writeFile(path.resolve(String(options.out)), text + "\n", "utf8");
  if (report.verdict !== "PASS") process.exitCode = 1;
}

await main();

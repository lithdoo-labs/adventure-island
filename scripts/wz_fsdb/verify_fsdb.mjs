#!/usr/bin/env node
/**
 * FSDB Well-formed + accounting verification for converted CMS079 databases.
 *
 * Uses the PINNED loom-realm FSDB core (`@loomrealm/fsdb`: openFsdb,
 * listFsdbEntries, openFsdbObject) from the submodule checkout — never a
 * reimplementation. Prints counts and classifications only; asset bytes are
 * never printed.
 *
 * Usage:
 *   node scripts/wz_fsdb/verify_fsdb.mjs --fsdb <[FSDB]cms root> \
 *     [--summary <convert-*.json>] [--deep] [--out <report.json>]
 *
 * --deep additionally re-reads and hashes every struct/group entry (resource
 * bodies are covered by the Content Service PREPARE in verify_content.mjs).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const loomRoot = path.join(repoRoot, "loom-realm");
const require = createRequire(path.join(loomRoot, "package.json"));
const { openFsdb, listFsdbEntries, openFsdbObject } = await import(
  pathToFileURL(require.resolve("@loomrealm/fsdb", { conditions: new Set(["node", "import"]) })).href
);

function args() {
  const parsed = { _: [] };
  for (let index = 2; index < process.argv.length; index += 1) {
    const value = process.argv[index];
    if (value.startsWith("--")) parsed[value.slice(2)] = process.argv[++index] ?? true;
    else parsed._.push(value);
  }
  return parsed;
}

async function readAll(lease) {
  const chunks = [];
  for await (const chunk of lease.stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  await lease.close();
  return bytes;
}

const counts = { struct: 0, extend: 0, group: 0, resource: 0 };
const perTable = {};
const problems = [];

async function main() {
  const options = args();
  const root = path.resolve(String(options.fsdb ?? ""));
  if (!root) throw new Error("pass --fsdb <[FSDB]cms root>");
  let db;
  try {
    db = await openFsdb({ root });
  } catch (error) {
    console.log(JSON.stringify({ wellFormed: "FAIL", error: String(error?.message ?? error) }, null, 2));
    process.exitCode = 1;
    return;
  }
  const entries = listFsdbEntries(db);
  for (const entry of entries) {
    counts[entry.identity.kind] += 1;
    const table = `${entry.identity.kind}.${entry.identity.table}`;
    perTable[table] = (perTable[table] ?? 0) + 1;
  }
  const report = {
    fsdbName: db.name,
    entryCounts: counts,
    perTable: Object.fromEntries(Object.entries(perTable).sort(([a], [b]) => a.localeCompare(b))),
    problems,
  };

  if (options.deep) {
    let checked = 0;
    for (const entry of entries) {
      if (entry.identity.kind === "resource") continue;
      const bytes = await readAll(await openFsdbObject(db, entry.identity, new AbortController().signal));
      const text = bytes.toString("utf8");
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        problems.push({ kind: "bom", identity: entry.identity });
      }
      if (entry.identity.kind === "group") {
        for (const line of text.split("\n")) {
          if (line.trim() === "") continue;
          const parsed = JSON.parse(line);
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            problems.push({ kind: "group-row-not-object", identity: entry.identity });
          }
        }
      }
      checked += 1;
    }
    report.deepStructGroupEntriesChecked = checked;
  }

  if (options.summary) {
    const summary = JSON.parse(await readFile(options.summary, "utf8"));
    const stats = summary.stats ?? {};
    report.converter = {
      scope: summary.scope,
      errors: stats.errors ?? 0,
      struct: stats.struct ?? 0,
      groupFiles: stats.groupFiles ?? 0,
      groupRows: stats.groupRows ?? 0,
      resources: stats.resources ?? 0,
      canvasesOutOfScope: stats.canvasesOutOfScope ?? 0,
      recordsResumed: stats.recordsResumed ?? 0,
      groupsResumed: stats.groupsResumed ?? 0,
      resourceReuse: stats.resourceReuse ?? 0,
      uol: {
        ok: stats.uol_ok ?? 0,
        dangling: stats.uol_dangling ?? 0,
        cycle: stats.uol_cycle ?? 0,
        depth_limit: stats.uol_depth_limit ?? 0,
      },
      keyCollisions: stats.keyCollisions ?? 0,
      rekeyedRecords: stats.rekeyedRecords ?? 0,
      resourceAliases: stats.resourceAliases ?? 0,
      recordAliasCount: summary.recordAliasCount ?? 0,
      recordRemaps: summary.recordRemaps?.length ?? 0,
    };
    const accountedStruct = (stats.struct ?? 0);
    if (accountedStruct !== counts.struct) {
      problems.push({ kind: "struct-count-mismatch", converter: accountedStruct, fsdb: counts.struct });
    }
    if ((stats.groupFiles ?? 0) !== counts.group) {
      problems.push({ kind: "group-count-mismatch", converter: stats.groupFiles ?? 0, fsdb: counts.group });
    }
    if ((stats.resources ?? 0) !== counts.resource) {
      problems.push({ kind: "resource-count-mismatch", converter: stats.resources ?? 0, fsdb: counts.resource });
    }
  }
  await db.close();
  report.wellFormed = problems.some((p) => p.kind === "bom" || p.kind === "group-row-not-object"
    || String(p.kind).endsWith("count-mismatch")) ? "FAIL" : "PASS";
  report.losslessAccounting = options.summary
    ? (problems.length === 0 ? "PASS" : "FAIL")
    : "NOT_CHECKED (pass --summary)";
  const text = JSON.stringify(report, null, 2);
  console.log(text);
  if (options.out) {
    await writeFile(path.resolve(String(options.out)), text + "\n", "utf8");
  }
  if (report.wellFormed !== "PASS" || report.losslessAccounting === "FAIL") process.exitCode = 1;
}

await main();

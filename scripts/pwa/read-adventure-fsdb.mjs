/**
 * Minimal read-only FSDB → Content adapter for the canonical Adventure
 * Island PWA bundle (issue #62).
 *
 * The repository's existing `content/[FSDB]adventure/` library is the ONLY
 * Avatar material source: this helper reads exactly the fixed single-character
 * closure (body/head/face/hair parts, their PartFrame/Resource groups, the
 * shared DrawOrder/LayerSlot records, and the PNG atlas pages those resource
 * rows actually reference), derives the bootstrap AvatarPlanV1 ONCE through
 * the official `buildAdventureAvatarPlan()` adapter, and returns the entries
 * to publish — nothing is generated, re-serialized, or converted from the
 * wider library.
 *
 * FSDB physical path → Content identity (frozen mapping, design §4.1.1):
 *   [struct]avatar.Part/{part}.json        → record  struct.avatar.Part / {part}
 *   [group]avatar.PartFrame/{part}.jsonl   → group   group.avatar.PartFrame / {part}
 *   [group]avatar.Resource/{part}.jsonl    → group   group.avatar.Resource / {part}
 *   [struct]avatar.DrawOrder/avatar.json   → record  struct.avatar.DrawOrder / avatar
 *   [struct]avatar.LayerSlot/avatar.json   → record  struct.avatar.LayerSlot / avatar
 *   [resource]Avatar/{imageKey}.png        → resource resource.Avatar / {imageKey}
 *
 * Plus the DERIVED product record (never written back into the FSDB):
 *   record struct.AdventureAvatarPlan / bootstrap — value IS the AvatarPlanV1.
 *
 * Fail-closed path rules: only the six whitelisted tables above, strict key
 * segment charset (no traversal/metacharacters), the final entry must be a
 * regular file (symlinks rejected), and the realpath must stay inside the
 * FSDB root. Content versions are `sha256:<64 hex>` of the exact bytes that
 * are published — the same bytes the Reader hands to the official adapter.
 */
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildAdventureAvatarPlan } from "../../components/cms-actor/src/adventure-adapter.mjs";
import { measureAvatarPlanDataBytes, validateAvatarPlan } from "../../components/cms-actor/src/avatar-model.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Location of the only Avatar material source, relative to the game root. */
export const ADVENTURE_FSDB_RELATIVE_PATH = "content/[FSDB]adventure";

/** The frozen single-character selection for this slice. */
export const ADVENTURE_PART_KEYS = Object.freeze([
  "avatar.part.body.00002000",
  "avatar.part.head.00012000",
  "avatar.part.face.00020100",
  "avatar.part.hair.00030000",
]);
export const ADVENTURE_EXPRESSION = "default";

/** Identity of the derived bootstrap plan record published by the bundle. */
export const AVATAR_PLAN_NAMESPACE = "struct.AdventureAvatarPlan";
export const AVATAR_PLAN_KEY = "bootstrap";

export const AVATAR_PLAN_DATA_BYTE_LIMIT = 262_144;

const RECORD_MIME = "application/json; charset=utf-8";
const GROUP_MIME = "application/x-ndjson; charset=utf-8";
const PNG_MIME = "image/png";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Whitelisted FSDB tables: Content identity → physical layout. */
const TABLES = Object.freeze({
  "record\0struct.avatar.Part": Object.freeze({ dir: "[struct]avatar.Part", extension: ".json", kind: "record", namespace: "struct.avatar.Part", mime: RECORD_MIME }),
  "record\0struct.avatar.DrawOrder": Object.freeze({ dir: "[struct]avatar.DrawOrder", extension: ".json", kind: "record", namespace: "struct.avatar.DrawOrder", mime: RECORD_MIME }),
  "record\0struct.avatar.LayerSlot": Object.freeze({ dir: "[struct]avatar.LayerSlot", extension: ".json", kind: "record", namespace: "struct.avatar.LayerSlot", mime: RECORD_MIME }),
  "group\0group.avatar.PartFrame": Object.freeze({ dir: "[group]avatar.PartFrame", extension: ".jsonl", kind: "group", namespace: "group.avatar.PartFrame", mime: GROUP_MIME }),
  "group\0group.avatar.Resource": Object.freeze({ dir: "[group]avatar.Resource", extension: ".jsonl", kind: "group", namespace: "group.avatar.Resource", mime: GROUP_MIME }),
  "resource\0resource.Avatar": Object.freeze({ dir: "[resource]Avatar", extension: ".png", kind: "resource", namespace: "resource.Avatar", mime: PNG_MIME }),
});

const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/u;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function tableFor(kind, namespace) {
  const table = TABLES[`${kind}\0${namespace}`];
  if (table === undefined) {
    throw new TypeError(`the adventure FSDB adapter does not serve ${kind} ${namespace}`);
  }
  return table;
}

function assertKeyShape(kind, key) {
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError(`invalid ${kind} key`);
  }
  const segments = key.split("/");
  if (kind !== "resource" && segments.length !== 1) {
    throw new TypeError(`${kind} keys must be flat ("${key}")`);
  }
  for (const segment of segments) {
    if (!KEY_SEGMENT.test(segment)) {
      throw new TypeError(`key segment "${segment}" is not allowed inside the adventure FSDB closure`);
    }
  }
}

function compareEntries(left, right) {
  const keys = ["kind", "namespace", "key"];
  for (const key of keys) {
    const delta = left[key] < right[key] ? -1 : left[key] > right[key] ? 1 : 0;
    if (delta !== 0) return delta;
  }
  return 0;
}

/**
 * Read the canonical single-character Avatar closure from the existing FSDB
 * and derive the bootstrap AvatarPlanV1 through the official adapter.
 *
 * @returns {{
 *   entries: ReadonlyArray<{kind: string, namespace: string, key: string, mime: string, bytes: Buffer}>,
 *   plan: object,
 *   sources: ReadonlyArray<string>,
 * }} canonically sorted entries (including the derived
 * `struct.AdventureAvatarPlan/bootstrap` record), the validated plan, and the
 * game-root-relative physical files that were read.
 */
export async function buildCanonicalAdventureAvatarContent({
  gameRoot = root,
  parts = ADVENTURE_PART_KEYS,
  expression = ADVENTURE_EXPRESSION,
} = {}) {
  const game = resolve(gameRoot);
  const fsdbRoot = join(game, ...ADVENTURE_FSDB_RELATIVE_PATH.split("/"));
  const fsdbReal = await realpath(fsdbRoot);

  const entries = [];
  const byIdentity = new Set();
  const sources = [];

  const track = (kind, namespace, key, mime, bytes, physicalPath) => {
    const identity = `${kind}\0${namespace}\0${key}`;
    if (byIdentity.has(identity)) {
      throw new TypeError(`the adventure closure read duplicate Content identity ${kind} ${namespace}/${key}`);
    }
    byIdentity.add(identity);
    entries.push(Object.freeze({ kind, namespace, key, mime, bytes }));
    sources.push(relative(game, physicalPath).replaceAll("\\", "/"));
  };

  const readTableFile = async (kind, namespace, key) => {
    const table = tableFor(kind, namespace); // whitelist gate
    assertKeyShape(kind, key);
    // Flat keys append the extension to the whole key; resource keys append it
    // to the LAST path segment only (the FSDB layout stores `…/<key>.png`).
    const lexical = kind === "resource"
      ? join(fsdbRoot, table.dir, ...key.split("/").slice(0, -1), `${key.split("/").at(-1)}${table.extension}`)
      : join(fsdbRoot, table.dir, `${key}${table.extension}`);
    const insideFsdb = relative(fsdbRoot, lexical);
    if (insideFsdb === "" || insideFsdb.startsWith("..") || insideFsdb.startsWith("/")) {
      throw new TypeError(`adventure FSDB key "${key}" escapes the library root`);
    }
    const facts = await lstat(lexical).catch(() => null);
    if (facts === null) {
      throw new TypeError(`the adventure FSDB is missing ${relative(game, lexical)} (needed for ${kind} ${namespace}/${key})`);
    }
    if (facts.isSymbolicLink()) {
      throw new TypeError(`refusing to follow a symlink inside the adventure FSDB closure: ${relative(game, lexical)}`);
    }
    if (!facts.isFile()) {
      throw new TypeError(`adventure FSDB entry ${relative(game, lexical)} is not a regular file`);
    }
    const real = await realpath(lexical);
    const realInside = relative(fsdbReal, real);
    if (realInside === "" || realInside.startsWith("..") || realInside.startsWith("/")) {
      throw new TypeError(`adventure FSDB entry ${relative(game, lexical)} resolves outside the library root`);
    }
    const bytes = await readFile(lexical);
    if (kind === "resource" && !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new TypeError(`adventure FSDB resource ${key} is not a PNG`);
    }
    return { bytes, physicalPath: lexical };
  };

  const parseRows = (bytes, label) => {
    const rows = [];
    const text = bytes.toString("utf8");
    for (const [index, line] of text.split(/\r?\n/u).entries()) {
      if (line.trim().length === 0) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch (cause) {
        throw new TypeError(`${label} row ${index + 1} is not valid JSON (${cause.message})`);
      }
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        throw new TypeError(`${label} row ${index + 1} is not a JSON object`);
      }
      rows.push(row);
    }
    return rows;
  };

  /** The official adapter's Content view: every read becomes a published entry. */
  const content = {
    async record(namespace, key) {
      const { bytes, physicalPath } = await readTableFile("record", namespace, key);
      let value;
      try {
        value = JSON.parse(bytes.toString("utf8"));
      } catch (cause) {
        throw new TypeError(`adventure FSDB record ${namespace}/${key} is not valid JSON (${cause.message})`);
      }
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`adventure FSDB record ${namespace}/${key} is not a JSON object`);
      }
      track("record", namespace, key, RECORD_MIME, bytes, physicalPath);
      return Object.freeze({ value, contentVersion: sha256(bytes) });
    },
    async group(namespace, key) {
      const { bytes, physicalPath } = await readTableFile("group", namespace, key);
      const rows = parseRows(bytes, `adventure FSDB group ${namespace}/${key}`);
      if (namespace === "group.avatar.Resource") {
        // Fail-closed closure check: resource names must be unambiguous.
        const names = new Set();
        for (const row of rows) {
          if (typeof row.name !== "string" || row.name.length === 0) {
            throw new TypeError(`adventure FSDB group ${namespace}/${key} has a row without a name`);
          }
          if (names.has(row.name)) {
            throw new TypeError(`adventure FSDB group ${namespace}/${key} declares the resource name "${row.name}" twice`);
          }
          names.add(row.name);
        }
      }
      track("group", namespace, key, GROUP_MIME, bytes, physicalPath);
      return Object.freeze({ rows: Object.freeze(rows), contentVersion: sha256(bytes) });
    },
    async resource(namespace, key) {
      const { bytes, physicalPath } = await readTableFile("resource", namespace, key);
      track("resource", namespace, key, PNG_MIME, bytes, physicalPath);
      return Object.freeze({ bytes, mime: PNG_MIME, contentVersion: sha256(bytes) });
    },
  };

  const plan = await buildAdventureAvatarPlan(content, { parts: [...parts], expression });
  const validated = validateAvatarPlan(plan);
  const planDataBytes = measureAvatarPlanDataBytes(validated);
  if (planDataBytes > AVATAR_PLAN_DATA_BYTE_LIMIT) {
    throw new TypeError(`the derived bootstrap AvatarPlanV1 is ${planDataBytes} bytes, above the frozen RenderNode.data cap`);
  }

  const planBytes = Buffer.from(`${JSON.stringify(validated)}\n`, "utf8");
  entries.push(Object.freeze({
    kind: "record",
    namespace: AVATAR_PLAN_NAMESPACE,
    key: AVATAR_PLAN_KEY,
    mime: RECORD_MIME,
    bytes: planBytes,
  }));
  entries.sort(compareEntries);
  return Object.freeze({
    entries: Object.freeze(entries),
    plan: Object.freeze(validated),
    sources: Object.freeze([...new Set(sources)].sort()),
  });
}

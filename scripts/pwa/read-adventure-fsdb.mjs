/**
 * Read-only closure of the canonical single-character Avatar Content.
 *
 * The source is the existing content/[FSDB]adventure library. This helper
 * publishes only the fixed body/head/face/hair parts, their frame and
 * resource groups, the shared draw-order records, and the PNG pages those
 * resource rows name. It does not scan the library, rewrite FSDB bytes, or
 * invent synthetic parts.
 */
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

export const ADVENTURE_FSDB_DIRECTORY = "content/[FSDB]adventure";
export const CANONICAL_AVATAR_PARTS = Object.freeze([
  "avatar.part.body.00002000",
  "avatar.part.head.00012000",
  "avatar.part.face.00020100",
  "avatar.part.hair.00030000",
]);
export const CANONICAL_AVATAR_EXPRESSION = "default";
export const AVATAR_PLAN_NAMESPACE = "struct.AdventureAvatarPlan";
export const AVATAR_PLAN_KEY = "bootstrap";
export const AVATAR_PLAN_BYTE_LIMIT = 262_144;

const RECORD_MIME = "application/json; charset=utf-8";
const GROUP_MIME = "application/x-ndjson; charset=utf-8";
const PNG_MIME = "image/png";
const PART_NAMESPACE = "struct.avatar.Part";
const FRAME_NAMESPACE = "group.avatar.PartFrame";
const RESOURCE_NAMESPACE = "group.avatar.Resource";
const DRAW_NAMESPACE = "struct.avatar.DrawOrder";
const SLOT_NAMESPACE = "struct.avatar.LayerSlot";
const IMAGE_NAMESPACE = "resource.Avatar";

function fail(message) {
  throw new TypeError(message);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function assertSegment(segment, label) {
  if (typeof segment !== "string" || segment.length === 0 || segment === "." || segment === ".."
    || /[\\/:\0]|\p{Cc}|\p{Cs}/u.test(segment)) {
    fail(`${label} is not a safe FSDB path segment`);
  }
}

function staysInside(rootReal, candidateReal) {
  const rel = relative(rootReal, candidateReal);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

async function readRegularFile(rootReal, absolutePath, label) {
  let facts;
  try {
    facts = await lstat(absolutePath);
  } catch (cause) {
    fail(`${label} is missing (${cause.code ?? cause.message})`);
  }
  if (facts.isSymbolicLink()) fail(`${label} is a symlink and is not readable Avatar Content`);
  if (!facts.isFile()) fail(`${label} is not a regular file`);
  const real = await realpath(absolutePath);
  if (!staysInside(rootReal, real)) fail(`${label} escapes the adventure FSDB root`);
  return readFile(real);
}

function parseJsonObject(bytes, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    fail(`${label} is not JSON (${cause.message})`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be a JSON object`);
  }
  return value;
}

function parseJsonLines(bytes, label) {
  const lines = bytes.toString("utf8").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const rows = [];
  for (const [index, raw] of lines.entries()) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.length === 0) fail(`${label} line ${index + 1} is empty`);
    let row;
    try {
      row = JSON.parse(line);
    } catch (cause) {
      fail(`${label} line ${index + 1} is not JSON (${cause.message})`);
    }
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      fail(`${label} line ${index + 1} must be a JSON object`);
    }
    rows.push(row);
  }
  return rows;
}

function assertImageKey(image, label) {
  if (typeof image !== "string" || image.length === 0 || image.startsWith("/") || image.endsWith("/")) {
    fail(`${label} has an invalid atlas image key`);
  }
  const segments = image.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    fail(`${label} has an unsafe atlas image key`);
  }
  for (const segment of segments) assertSegment(segment, label);
  return segments;
}

/**
 * Load the selected character closure and a Content-shaped reader whose
 * versions are the SHA-256 of the exact bytes that will be published.
 */
export async function readAdventureAvatarClosure(gameRoot) {
  const game = resolve(gameRoot);
  const fsdb = join(game, "content", "[FSDB]adventure");
  let rootFacts;
  try {
    rootFacts = await lstat(fsdb);
  } catch (cause) {
    fail(`adventure FSDB is missing (${cause.code ?? cause.message})`);
  }
  if (rootFacts.isSymbolicLink() || !rootFacts.isDirectory()) {
    fail("adventure FSDB root must be a real directory");
  }
  const gameReal = await realpath(game);
  const rootReal = await realpath(fsdb);
  if (!staysInside(gameReal, rootReal)) fail("adventure FSDB root escapes the game root");

  const entries = [];
  const byIdentity = new Map();
  const remember = (entry) => {
    const identity = `${entry.kind}\0${entry.namespace}\0${entry.key}`;
    if (byIdentity.has(identity)) fail(`duplicate FSDB content identity ${entry.namespace}/${entry.key}`);
    const stored = Object.freeze({ ...entry, contentVersion: sha256(entry.bytes) });
    byIdentity.set(identity, stored);
    entries.push(stored);
  };

  const readMapped = async (parts, label) => {
    for (const part of parts) assertSegment(part, label);
    const absolute = join(fsdb, ...parts);
    const rel = relative(fsdb, absolute);
    if (rel.startsWith("..") || isAbsolute(rel)) fail(`${label} escapes the adventure FSDB root`);
    return readRegularFile(rootReal, absolute, label);
  };

  const shared = [
    [DRAW_NAMESPACE, "[struct]avatar.DrawOrder", "avatar"],
    [SLOT_NAMESPACE, "[struct]avatar.LayerSlot", "avatar"],
  ];
  for (const [namespace, table, key] of shared) {
    const bytes = await readMapped([table, `${key}.json`], `${namespace}/${key}`);
    parseJsonObject(bytes, `${namespace}/${key}`);
    remember({
      kind: "record",
      namespace,
      key,
      mime: RECORD_MIME,
      bytes,
      relativePath: `${ADVENTURE_FSDB_DIRECTORY}/${table}/${key}.json`,
    });
  }

  const imageKeys = new Set();
  for (const part of CANONICAL_AVATAR_PARTS) {
    assertSegment(part, "avatar part");
    const partBytes = await readMapped(["[struct]avatar.Part", `${part}.json`], `${PART_NAMESPACE}/${part}`);
    parseJsonObject(partBytes, `${PART_NAMESPACE}/${part}`);
    remember({
      kind: "record",
      namespace: PART_NAMESPACE,
      key: part,
      mime: RECORD_MIME,
      bytes: partBytes,
      relativePath: `${ADVENTURE_FSDB_DIRECTORY}/[struct]avatar.Part/${part}.json`,
    });

    const frameBytes = await readMapped(["[group]avatar.PartFrame", `${part}.jsonl`], `${FRAME_NAMESPACE}/${part}`);
    const frames = parseJsonLines(frameBytes, `${FRAME_NAMESPACE}/${part}`);
    const seenFrames = new Set();
    for (const row of frames) {
      if (typeof row.action !== "string" || row.action.length === 0) {
        fail(`${FRAME_NAMESPACE}/${part} has a frame without an action`);
      }
      const token = `${row.action}\0${row.frame ?? 0}`;
      if (seenFrames.has(token)) fail(`${FRAME_NAMESPACE}/${part} repeats frame ${row.action}:${row.frame ?? 0}`);
      seenFrames.add(token);
    }
    remember({
      kind: "group",
      namespace: FRAME_NAMESPACE,
      key: part,
      mime: GROUP_MIME,
      bytes: frameBytes,
      relativePath: `${ADVENTURE_FSDB_DIRECTORY}/[group]avatar.PartFrame/${part}.jsonl`,
    });

    const resourceBytes = await readMapped(["[group]avatar.Resource", `${part}.jsonl`], `${RESOURCE_NAMESPACE}/${part}`);
    const resources = parseJsonLines(resourceBytes, `${RESOURCE_NAMESPACE}/${part}`);
    const seenNames = new Set();
    for (const row of resources) {
      if (typeof row.name !== "string" || row.name.length === 0) {
        fail(`${RESOURCE_NAMESPACE}/${part} has a resource row without a name`);
      }
      if (seenNames.has(row.name)) fail(`${RESOURCE_NAMESPACE}/${part} repeats resource name ${row.name}`);
      seenNames.add(row.name);
      assertImageKey(row.image, `${RESOURCE_NAMESPACE}/${part} ${row.name}`);
      imageKeys.add(row.image);
    }
    remember({
      kind: "group",
      namespace: RESOURCE_NAMESPACE,
      key: part,
      mime: GROUP_MIME,
      bytes: resourceBytes,
      relativePath: `${ADVENTURE_FSDB_DIRECTORY}/[group]avatar.Resource/${part}.jsonl`,
    });
  }

  for (const imageKey of [...imageKeys].sort()) {
    const segments = imageKey.split("/");
    const fileName = `${segments.at(-1)}.png`;
    const bytes = await readMapped(
      ["[resource]Avatar", ...segments.slice(0, -1), fileName],
      `${IMAGE_NAMESPACE}/${imageKey}`,
    );
    if (bytes.length < 8 || bytes[0] !== 0x89 || bytes.toString("ascii", 1, 4) !== "PNG") {
      fail(`${IMAGE_NAMESPACE}/${imageKey} is not a PNG`);
    }
    remember({
      kind: "resource",
      namespace: IMAGE_NAMESPACE,
      key: imageKey,
      mime: PNG_MIME,
      bytes,
      relativePath: `${ADVENTURE_FSDB_DIRECTORY}/[resource]Avatar/${imageKey}.png`,
    });
  }

  const requireEntry = (kind, namespace, key) => {
    const entry = byIdentity.get(`${kind}\0${namespace}\0${key}`);
    if (entry === undefined) fail(`${kind} ${namespace}/${key} is outside the selected avatar closure`);
    return entry;
  };
  const reader = Object.freeze({
    async record(namespace, key) {
      const entry = requireEntry("record", namespace, key);
      return { value: parseJsonObject(entry.bytes, `${namespace}/${key}`), contentVersion: entry.contentVersion };
    },
    async group(namespace, key) {
      const entry = requireEntry("group", namespace, key);
      return { rows: parseJsonLines(entry.bytes, `${namespace}/${key}`), contentVersion: entry.contentVersion };
    },
    async resource(namespace, key) {
      const entry = requireEntry("resource", namespace, key);
      return { bytes: entry.bytes, mime: entry.mime, contentVersion: entry.contentVersion };
    },
  });

  return Object.freeze({
    entries: Object.freeze(entries),
    relativeFiles: Object.freeze(entries.map((entry) => entry.relativePath)),
    reader,
  });
}

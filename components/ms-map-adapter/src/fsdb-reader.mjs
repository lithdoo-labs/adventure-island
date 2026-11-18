/**
 * Read MapFacts for one map from content/[FSDB]adventure.
 *
 * Captures JSONL line index as sourceOrder (PRODUCT-DECISION / FSDB-FACT:
 * row order is source order; schema has no explicit sourceOrder field).
 */
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { contentVersionOf } from "./hash.mjs";
import {
  GROUP_NAMES,
  SOURCE_ABSENT,
  SOURCE_EMPTY,
  SOURCE_PRESENT,
  diagnose,
} from "./status.mjs";

const STRUCT_MAP = "[struct]map.Map";
const RESOURCE_MAP = "[resource]Map";

const GROUP_DIRS = Object.freeze({
  back: "[group]map.Back",
  tile: "[group]map.Tile",
  obj: "[group]map.Obj",
  foothold: "[group]map.Foothold",
  portal: "[group]map.Portal",
  rope: "[group]map.Rope",
  seat: "[group]map.Seat",
});

const FRAME_DIRS = Object.freeze({
  back: "[group]map.BackFrame",
  tile: "[group]map.TileFrame",
  obj: "[group]map.ObjFrame",
  helper: "[group]map.HelperFrame",
});

export function defaultAdventureFsdbRoot(gameRoot) {
  return join(resolve(gameRoot), "content", "[FSDB]adventure");
}

async function fileStatus(path) {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return { kind: "absent" };
    }
    return { kind: "file", size: stats.size };
  } catch (error) {
    if (error && error.code === "ENOENT") return { kind: "absent" };
    throw error;
  }
}

function parseJsonl(text, group, mapId) {
  const rows = [];
  const diagnostics = [];
  if (text.length === 0) {
    return { status: SOURCE_EMPTY, rows, diagnostics };
  }
  const lines = text.split(/\r?\n/);
  // Trailing newline yields a final empty segment; ignore only that.
  const last = lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  for (let i = 0; i < last; i += 1) {
    const line = lines[i];
    if (line.trim() === "") {
      diagnostics.push(diagnose("jsonl-blank-line", `blank JSONL line in ${group}`, {
        mapId,
        group,
        sourceOrder: i,
      }));
      continue;
    }
    let value;
    try {
      value = JSON.parse(line);
    } catch (error) {
      diagnostics.push(diagnose("jsonl-parse-error", String(error?.message ?? error), {
        mapId,
        group,
        sourceOrder: i,
      }));
      continue;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      diagnostics.push(diagnose("jsonl-record-invalid", `JSONL row in ${group} must be an object`, {
        mapId,
        group,
        sourceOrder: i,
      }));
      continue;
    }
    // Physical line order is authoritative. An authored field must never be
    // able to spoof provenance or stable identity.
    rows.push(Object.freeze({ ...value, sourceOrder: i }));
  }
  if (rows.length === 0) {
    return { status: SOURCE_EMPTY, rows, diagnostics };
  }
  return { status: SOURCE_PRESENT, rows: Object.freeze(rows), diagnostics };
}

async function readGroupFile(fsdbRoot, dir, mapKey, group, mapId) {
  const path = join(fsdbRoot, dir, `${mapKey}.jsonl`);
  const status = await fileStatus(path);
  if (status.kind === "absent") {
    return {
      status: SOURCE_ABSENT,
      rows: Object.freeze([]),
      diagnostics: Object.freeze([
        diagnose("group-absent", `${group} group file is absent`, { mapId, group, path: `${dir}/${mapKey}.jsonl` }),
      ]),
      bytes: null,
      contentVersion: null,
    };
  }
  const bytes = await readFile(path);
  const parsed = parseJsonl(bytes.toString("utf8"), group, mapId);
  return {
    status: parsed.status,
    rows: Object.freeze(parsed.rows),
    diagnostics: Object.freeze(parsed.diagnostics),
    bytes,
    contentVersion: contentVersionOf(bytes),
  };
}

async function readJsonRecord(fsdbRoot, dir, key) {
  const path = join(fsdbRoot, dir, `${key}.json`);
  const status = await fileStatus(path);
  if (status.kind === "absent") return null;
  const bytes = await readFile(path);
  return {
    value: JSON.parse(bytes.toString("utf8")),
    bytes,
    contentVersion: contentVersionOf(bytes),
  };
}

async function readFrameGroup(fsdbRoot, dir, key, groupName, mapId) {
  const path = join(fsdbRoot, dir, `${key}.jsonl`);
  const status = await fileStatus(path);
  if (status.kind === "absent") {
    return {
      key,
      status: SOURCE_ABSENT,
      rows: Object.freeze([]),
      diagnostics: Object.freeze([
        diagnose("frame-group-absent", `${groupName} frame group absent for ${key}`, {
          mapId,
          group: groupName,
          frameKey: key,
        }),
      ]),
    };
  }
  const bytes = await readFile(path);
  const parsed = parseJsonl(bytes.toString("utf8"), groupName, mapId);
  return {
    key,
    status: parsed.status,
    rows: Object.freeze(parsed.rows),
    diagnostics: Object.freeze(parsed.diagnostics),
    contentVersion: contentVersionOf(bytes),
  };
}

async function resourceExists(fsdbRoot, logicalKey) {
  const path = join(fsdbRoot, RESOURCE_MAP, `${logicalKey}.png`);
  const status = await fileStatus(path);
  if (status.kind === "absent") return null;
  const bytes = await readFile(path);
  return {
    key: logicalKey,
    namespace: "resource.Map",
    contentVersion: contentVersionOf(bytes),
    byteLength: bytes.byteLength,
  };
}

/**
 * @param {{ mapId: string, fsdbRoot?: string, gameRoot?: string }} options
 */
export async function readMapFacts({ mapId, fsdbRoot, gameRoot = process.cwd() }) {
  if (typeof mapId !== "string" || !/^\d+$/.test(mapId)) {
    throw new TypeError(`mapId must be a decimal map number string, got ${mapId}`);
  }
  const root = resolve(fsdbRoot ?? defaultAdventureFsdbRoot(gameRoot));
  const mapKey = `map.${mapId}`;
  const diagnostics = [];

  const mapRecord = await readJsonRecord(root, STRUCT_MAP, mapKey);
  if (!mapRecord) {
    return Object.freeze({
      mapId,
      mapKey,
      fsdbRoot: root,
      status: SOURCE_ABSENT,
      map: null,
      groups: Object.freeze({}),
      frames: Object.freeze({ back: Object.freeze({}), tile: Object.freeze({}), obj: Object.freeze({}), helper: null }),
      resources: Object.freeze(new Map()),
      diagnostics: Object.freeze([
        diagnose("map-absent", `struct.map.Map/${mapKey} is absent`, { mapId, group: "map" }),
      ]),
    });
  }

  const groups = {};
  for (const name of GROUP_NAMES) {
    const loaded = await readGroupFile(root, GROUP_DIRS[name], mapKey, name, mapId);
    groups[name] = Object.freeze({
      status: loaded.status,
      rows: loaded.rows,
      contentVersion: loaded.contentVersion,
    });
    diagnostics.push(...loaded.diagnostics);
    if (loaded.status === SOURCE_EMPTY) {
      diagnostics.push(diagnose("group-empty", `${name} group exists but has no rows`, { mapId, group: name }));
    }
  }

  // Collect definition keys referenced by placements.
  const backKeys = new Set();
  for (const row of groups.back.rows) {
    if (typeof row.bS === "string" && row.bS.length > 0) backKeys.add(`map.back.${row.bS}`);
  }
  const tileSets = new Set();
  const layerTileSet = mapRecord.value.layers ?? {};
  for (const row of groups.tile.rows) {
    const layer = String(row.layer);
    const set = layerTileSet[layer]?.tileSet;
    if (typeof set === "string" && set.length > 0) tileSets.add(`map.tile.${set}`);
    else {
      diagnostics.push(diagnose("tile-tileset-missing", `tile placement has no layer tileSet`, {
        mapId,
        group: "tile",
        sourceOrder: row.sourceOrder,
        layer,
      }));
    }
  }
  const objKeys = new Set();
  for (const row of groups.obj.rows) {
    if (typeof row.oS === "string" && row.oS.length > 0) objKeys.add(`map.obj.${row.oS}`);
  }

  const frames = {
    back: {},
    tile: {},
    obj: {},
    helper: null,
  };

  for (const key of [...backKeys].sort()) {
    const loaded = await readFrameGroup(root, FRAME_DIRS.back, key, "backFrame", mapId);
    frames.back[key] = Object.freeze({ status: loaded.status, rows: loaded.rows });
    diagnostics.push(...loaded.diagnostics);
  }
  for (const key of [...tileSets].sort()) {
    const loaded = await readFrameGroup(root, FRAME_DIRS.tile, key, "tileFrame", mapId);
    frames.tile[key] = Object.freeze({ status: loaded.status, rows: loaded.rows });
    diagnostics.push(...loaded.diagnostics);
  }
  for (const key of [...objKeys].sort()) {
    const loaded = await readFrameGroup(root, FRAME_DIRS.obj, key, "objFrame", mapId);
    frames.obj[key] = Object.freeze({ status: loaded.status, rows: loaded.rows });
    diagnostics.push(...loaded.diagnostics);
  }

  const helper = await readFrameGroup(root, FRAME_DIRS.helper, "map.helper", "helperFrame", mapId);
  frames.helper = Object.freeze({ status: helper.status, rows: helper.rows });
  diagnostics.push(...helper.diagnostics);

  // Resource closure over referenced logical keys (first-frame / static only).
  const resourceKeys = new Set();
  const collectResource = (row) => {
    if (typeof row.resource === "string" && row.resource.length > 0) resourceKeys.add(row.resource);
  };
  for (const table of Object.values(frames.back)) for (const row of table.rows) collectResource(row);
  for (const table of Object.values(frames.tile)) for (const row of table.rows) collectResource(row);
  for (const table of Object.values(frames.obj)) for (const row of table.rows) collectResource(row);
  for (const row of frames.helper.rows) collectResource(row);
  if (typeof mapRecord.value.miniMap?.resource === "string") {
    resourceKeys.add(mapRecord.value.miniMap.resource);
  }

  const resources = new Map();
  for (const key of [...resourceKeys].sort()) {
    const entry = await resourceExists(root, key);
    if (!entry) {
      diagnostics.push(diagnose("resource-missing", `resource.Map/${key} is missing`, {
        mapId,
        group: "resource",
        resourceKey: key,
      }));
      continue;
    }
    resources.set(key, Object.freeze(entry));
  }

  // Optional: enumerate whether resource dir itself is readable (audit only).
  try {
    await readdir(join(root, RESOURCE_MAP));
  } catch (error) {
    diagnostics.push(diagnose("resource-root-unreadable", String(error?.message ?? error), { mapId }));
  }

  return Object.freeze({
    mapId,
    mapKey,
    fsdbRoot: root,
    status: SOURCE_PRESENT,
    map: Object.freeze(mapRecord.value),
    mapContentVersion: mapRecord.contentVersion,
    groups: Object.freeze(groups),
    frames: Object.freeze({
      back: Object.freeze(frames.back),
      tile: Object.freeze(frames.tile),
      obj: Object.freeze(frames.obj),
      helper: frames.helper,
    }),
    resources,
    diagnostics: Object.freeze(diagnostics),
  });
}

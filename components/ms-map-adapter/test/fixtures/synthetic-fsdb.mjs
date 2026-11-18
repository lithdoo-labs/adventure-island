/**
 * Tiny on-disk synthetic FSDB for validator edge cases.
 * Does not use the real adventure library.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = fileURLToPath(new URL(".", import.meta.url));
const BASE = join(here, ".tmp-fsdb");

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

async function writeJson(path, value) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
}

async function writeJsonl(path, rows) {
  await mkdir(join(path, ".."), { recursive: true });
  const text = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
  await writeFile(path, text);
}

export function syntheticRootFor(suiteId) {
  return join(BASE, suiteId);
}

export async function resetSyntheticFsdb(suiteId) {
  const root = syntheticRootFor(suiteId);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  return root;
}

export async function writeSyntheticMap({
  suiteId,
  mapId = "900000001",
  includeSeat = false,
  emptyTile = false,
  omitTile = false,
  malformedTile = false,
  omitTileFrame = false,
  missingResource = false,
  authoredSourceOrder,
  animatedObj = false,
  portals = [
    { pn: "sp", pt: 0, x: 0, y: 0, tm: 999999999, tn: "" },
    { pn: "east00", pt: 2, x: 10, y: 20, tm: 900000002, tn: "west00" },
  ],
} = {}) {
  if (!suiteId) throw new TypeError("suiteId is required to isolate synthetic FSDB roots");
  const root = syntheticRootFor(suiteId);
  await mkdir(root, { recursive: true });
  const mapKey = `map.${mapId}`;
  await writeJson(join(root, "[struct]map.Map", `${mapKey}.json`), {
    mapId,
    info: { version: 10, town: 1, swim: 0 },
    vr: { VRLeft: -100, VRTop: -100, VRRight: 100, VRBottom: 100 },
    layers: { 0: {}, 1: { tileSet: "toy" }, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {} },
  });

  await writeJsonl(join(root, "[group]map.Back", `${mapKey}.jsonl`), [
    { bS: "toy", no: 0, ani: 0, x: 0, y: 0, rx: 0, ry: 0, type: 0, cx: 0, cy: 0, f: 0, a: 255, front: 0 },
  ]);
  await writeJsonl(join(root, "[group]map.BackFrame", "map.back.toy.jsonl"), [
    { kind: "back", no: 0, origin: [0, 0], z: 0, width: 8, height: 8, resource: "back/toy/back/0" },
  ]);

  if (!omitTile) {
    const tilePath = join(root, "[group]map.Tile", `${mapKey}.jsonl`);
    if (malformedTile) {
      await mkdir(join(tilePath, ".."), { recursive: true });
      await writeFile(tilePath, "{not-json}\n");
    } else {
      await writeJsonl(
        tilePath,
        emptyTile ? [] : [{
          layer: "1",
          x: 0,
          y: 0,
          u: "bsc",
          no: 0,
          zM: 0,
          ...(authoredSourceOrder === undefined ? {} : { sourceOrder: authoredSourceOrder }),
        }],
      );
    }
  }
  if (!omitTileFrame) {
    await writeJsonl(join(root, "[group]map.TileFrame", "map.tile.toy.jsonl"), [
      { u: "bsc", no: 0, origin: [0, 0], z: 0, width: 8, height: 8, resource: "tile/toy/bsc/0" },
    ]);
  } else {
    await rm(join(root, "[group]map.TileFrame", "map.tile.toy.jsonl"), { force: true });
  }

  await writeJsonl(join(root, "[group]map.Obj", `${mapKey}.jsonl`), [
    { layer: "1", oS: "toy", l0: "a", l1: "b", l2: "0", x: 4, y: 4, z: 1, f: 0, zM: 0 },
  ]);
  await writeJsonl(join(root, "[group]map.ObjFrame", "map.obj.toy.jsonl"), [
    { l0: "a", l1: "b", l2: "0", frame: "0", delay: 100, origin: [0, 0], z: 0, width: 8, height: 8, resource: "obj/toy/a/b/0/0" },
    ...(animatedObj
      ? [{ l0: "a", l1: "b", l2: "0", frame: "1", delay: 120, origin: [1, 0], z: 0, width: 8, height: 8, resource: "obj/toy/a/b/0/1" }]
      : []),
  ]);

  await writeJsonl(join(root, "[group]map.Foothold", `${mapKey}.jsonl`), [
    { layer: 1, platform: 0, id: 1, x1: 0, y1: 0, x2: 40, y2: 0 },
  ]);
  await writeJsonl(join(root, "[group]map.Portal", `${mapKey}.jsonl`), portals);
  await writeJsonl(join(root, "[group]map.Rope", `${mapKey}.jsonl`), []);
  if (includeSeat) {
    await writeJsonl(join(root, "[group]map.Seat", `${mapKey}.jsonl`), [
      { index: 0, x: 1, y: 2 },
    ]);
  }

  await writeJsonl(join(root, "[group]map.HelperFrame", "map.helper.jsonl"), [
    {
      branch: "portal",
      use: "game",
      name: "pv",
      frame: "0",
      origin: [4, 8],
      width: 8,
      height: 8,
      resource: "helper/portal/game/pv/0",
    },
  ]);

  const resources = [
    "back/toy/back/0",
    "tile/toy/bsc/0",
    "obj/toy/a/b/0/0",
    ...(animatedObj ? ["obj/toy/a/b/0/1"] : []),
    "helper/portal/game/pv/0",
  ];
  for (const key of resources) {
    const path = join(root, "[resource]Map", `${key}.png`);
    if (missingResource && key.startsWith("tile/")) {
      await rm(path, { force: true });
      continue;
    }
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, PNG);
  }

  return {
    mapId,
    fsdbRoot: root,
    pngSha: `sha256:${createHash("sha256").update(PNG).digest("hex")}`,
  };
}

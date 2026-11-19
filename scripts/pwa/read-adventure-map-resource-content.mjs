/**
 * Publish the resource.Map PNG closure required by the static 222000000 Field
 * tree (M3 canonical PWA slice).
 */
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../../components/ms-map-adapter/src/index.mjs";
import { defaultAdventureFsdbRoot } from "../../components/ms-map-adapter/src/fsdb-reader.mjs";
import { FIELD_MAP_222000000 } from "../../components/ms-field/src/field-state.mjs";
import {
  assertExactMapResourceRefSets,
  collectMapResourceRefsFromFieldTree,
} from "./collect-field-plan-map-resources.mjs";

const canonicalRepoRoot = fileURLToPath(new URL("../../", import.meta.url));
const PNG_MIME = "image/png";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/u;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function assertKeyShape(key, label) {
  if (typeof key !== "string" || key.length === 0) throw new TypeError(`${label}: key must be a non-empty string`);
  for (const segment of key.split("/")) {
    if (!KEY_SEGMENT.test(segment)) throw new TypeError(`${label}: invalid key segment "${segment}"`);
  }
}

async function readResourcePng(gameRoot, repoRoot, key) {
  for (const root of [gameRoot, repoRoot]) {
    const fsdbRoot = defaultAdventureFsdbRoot(root);
    const lexical = join(fsdbRoot, "[resource]Map", `${key}.png`);
    try {
      const facts = await lstat(lexical);
      if (facts.isSymbolicLink() || !facts.isFile()) continue;
      const bytes = await readFile(lexical);
      return { bytes, physicalPath: lexical, gameRoot: root };
    } catch {
      // try the next root
    }
  }
  throw new TypeError(`map resource PNG is missing for ${key}`);
}

/**
 * @returns {Promise<{
 *   entries: ReadonlyArray<{kind: string, namespace: string, key: string, mime: string, bytes: Buffer}>,
 *   sources: ReadonlyArray<string>,
 * }>}
 */
export async function buildCanonicalAdventureMapResourceContent({
  gameRoot = canonicalRepoRoot,
  repoRoot = canonicalRepoRoot,
  mapId = FIELD_MAP_222000000,
  fieldPlanRoot,
} = {}) {
  if (fieldPlanRoot === undefined) {
    throw new TypeError("fieldPlanRoot is required to derive the published resource.Map closure");
  }
  const game = resolve(gameRoot);
  const repo = resolve(repoRoot);
  const gameReal = await realpath(game);
  const fsdbRoot = defaultAdventureFsdbRoot(game);
  const fsdbReal = await realpath(fsdbRoot).catch(() => null);
  if (fsdbReal !== null) {
    const insideGame = relative(gameReal, fsdbReal);
    if (insideGame === "" || insideGame.startsWith("..") || insideGame.startsWith(`..${sep}`) || isAbsolute(insideGame)) {
      throw new TypeError("adventure map FSDB must resolve inside the game root");
    }
  }

  const projection = await buildMapProjection({ mapId, gameRoot: repo });
  if (projection.closure.ok !== true) {
    throw new TypeError(`map ${mapId} projection closure is not publishable`);
  }

  const fieldRefs = collectMapResourceRefsFromFieldTree(fieldPlanRoot);
  const adapterRefs = Object.freeze([...projection.scene.resources].sort((left, right) => (
    left.key < right.key ? -1 : left.key > right.key ? 1 : 0
  )));
  assertExactMapResourceRefSets(fieldRefs, adapterRefs, "AdventureFieldPlan tree vs map adapter closure");

  const entries = [];
  const sources = [];

  for (const resource of fieldRefs) {
    const namespace = resource.namespace;
    const key = resource.key;
    assertKeyShape(key, `resource ${namespace}/${key}`);
    const { bytes, physicalPath, gameRoot: resolvedRoot } = await readResourcePng(game, repo, key);
    if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new TypeError(`map resource ${key} is not a PNG`);
    }
    if (sha256(bytes) !== resource.contentVersion) {
      throw new TypeError(
        `map resource ${key} bytes (${sha256(bytes)}) do not match field tree stamp (${resource.contentVersion})`,
      );
    }
    entries.push(Object.freeze({ kind: "resource", namespace, key, mime: PNG_MIME, bytes }));
    sources.push(relative(resolvedRoot === game ? game : repo, physicalPath).replaceAll("\\", "/"));
  }

  entries.sort((left, right) => (
    left.namespace < right.namespace ? -1 : left.namespace > right.namespace ? 1
      : left.key < right.key ? -1 : left.key > right.key ? 1 : 0
  ));
  return Object.freeze({ entries: Object.freeze(entries), sources: Object.freeze(sources) });
}
/**
 * Derive the bootstrap AdventureFieldPlan record for map 222000000 at bundle
 * build time (Node-only FSDB projection — never checked into the PWA worker).
 */
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { projectAdventureMapFieldScene } from "../../systems/adventure-map/field-static-projection.mjs";
import {
  FIELD_PLAN_KEY,
  FIELD_PLAN_NAMESPACE,
  validateFieldPlan,
} from "../../systems/adventure-map/field-plan-model.mjs";
import { buildFootholdCollisionPlan } from "../../systems/adventure-map/foothold-collision-plan-build.mjs";
import { buildRopeCollisionPlan } from "../../systems/adventure-map/rope-collision-plan-build.mjs";
import { SOURCE_ABSENT } from "../../components/ms-map-adapter/src/status.mjs";
import {
  MOVEMENT_CONFIG_KEY,
  MOVEMENT_CONFIG_NAMESPACE,
  validateMovementConfig,
} from "../../systems/adventure-map/movement-config.mjs";
import { buildPortalLogicalIndex } from "../../systems/adventure-map/portal-logical-index.mjs";
import {
  MAP_ENVIRONMENT_NAMESPACE,
  mapEnvironmentRecordKey,
  validateMapEnvironment,
} from "../../systems/adventure-map/map-environment.mjs";
import { assertPublishedExtraMapFieldPlanPublishable } from "../../systems/adventure-map/map-m7-publishability.mjs";
import { FIELD_MAP_222000000 } from "../../components/ms-field/src/field-state.mjs";
import { fieldPlanContentKey } from "../../systems/adventure-map/field-plan-keys.mjs";

/** Maps with independently publishable derived FieldPlans (M6 + M7.1). */
export const PUBLISHED_FIELD_PLAN_MAP_IDS = Object.freeze(["222000000", "222000001", "230030200"]);

const canonicalRepoRoot = fileURLToPath(new URL("../../", import.meta.url));
const RECORD_MIME = "application/json; charset=utf-8";
export const FIELD_PLAN_DEFAULT_VIEWPORT = Object.freeze({ width: 800, height: 600 });

export { FIELD_PLAN_KEY, FIELD_PLAN_NAMESPACE };

async function readMovementConfig(gameRoot) {
  const game = resolve(gameRoot);
  const gameReal = await realpath(game);
  const contentDirectory = join(game, "content");
  const fsdbRoot = join(contentDirectory, "[FSDB]adventure");
  const tableDirectory = join(fsdbRoot, "[struct]physics.Default");
  for (const directory of [contentDirectory, fsdbRoot, tableDirectory]) {
    const directoryFacts = await lstat(directory);
    if (directoryFacts.isSymbolicLink() || !directoryFacts.isDirectory()) {
      throw new TypeError(`physics FSDB directory ${relative(game, directory)} must be a real directory`);
    }
    const directoryReal = await realpath(directory);
    const directoryInside = relative(gameReal, directoryReal);
    if (directoryInside === "" || directoryInside === ".."
      || directoryInside.startsWith(`..${sep}`) || isAbsolute(directoryInside)) {
      throw new TypeError(`physics FSDB directory ${relative(game, directory)} resolves outside the game root`);
    }
  }
  const physicalPath = join(tableDirectory, `${MOVEMENT_CONFIG_KEY}.json`);
  const facts = await lstat(physicalPath);
  if (facts.isSymbolicLink() || !facts.isFile()) {
    throw new TypeError("the physics FSDB record must be a regular non-symlink file");
  }
  const physicalReal = await realpath(physicalPath);
  const inside = relative(gameReal, physicalReal);
  if (inside === "" || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    throw new TypeError("the physics FSDB record resolves outside the game root");
  }
  const bytes = await readFile(physicalPath);
  const physics = JSON.parse(bytes.toString("utf8"));
  const movementConfig = validateMovementConfig(Object.freeze({
    formatVersion: 1,
    source: Object.freeze({
      namespace: MOVEMENT_CONFIG_NAMESPACE,
      key: MOVEMENT_CONFIG_KEY,
      contentVersion: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    }),
    walkSpeed: Number(physics.walkSpeed),
    gravityAcc: Number(physics.gravityAcc),
    fallSpeed: Number(physics.fallSpeed),
    jumpSpeed: Number(physics.jumpSpeed),
    swimForce: Number(physics.swimForce),
    swimSpeed: Number(physics.swimSpeed),
    swimSpeedDec: Number(physics.swimSpeedDec),
  }));
  return Object.freeze({
    movementConfig,
    source: relative(game, physicalPath).replaceAll("\\", "/"),
  });
}

async function readMapEnvironment(gameRoot, mapId) {
  const game = resolve(gameRoot);
  const gameReal = await realpath(game);
  const contentDirectory = join(game, "content");
  const fsdbRoot = join(contentDirectory, "[FSDB]adventure");
  const tableDirectory = join(fsdbRoot, "[struct]map.Map");
  for (const directory of [contentDirectory, fsdbRoot, tableDirectory]) {
    const directoryFacts = await lstat(directory);
    if (directoryFacts.isSymbolicLink() || !directoryFacts.isDirectory()) {
      throw new TypeError(`map FSDB directory ${relative(game, directory)} must be a real directory`);
    }
    const directoryReal = await realpath(directory);
    const directoryInside = relative(gameReal, directoryReal);
    if (directoryInside === "" || directoryInside === ".."
      || directoryInside.startsWith(`..${sep}`) || isAbsolute(directoryInside)) {
      throw new TypeError(`map FSDB directory ${relative(game, directory)} resolves outside the game root`);
    }
  }
  const physicalPath = join(tableDirectory, `${mapEnvironmentRecordKey(mapId)}.json`);
  const facts = await lstat(physicalPath);
  if (facts.isSymbolicLink() || !facts.isFile()) {
    throw new TypeError("the map FSDB record must be a regular non-symlink file");
  }
  const physicalReal = await realpath(physicalPath);
  const inside = relative(gameReal, physicalReal);
  if (inside === "" || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    throw new TypeError("the map FSDB record resolves outside the game root");
  }
  const bytes = await readFile(physicalPath);
  const record = JSON.parse(bytes.toString("utf8"));
  const swim = record?.info?.swim;
  if (swim !== 0 && swim !== 1) {
    throw new TypeError(`map ${mapId} info.swim must be exactly 0 or 1`);
  }
  return Object.freeze({
    mapEnvironment: validateMapEnvironment(Object.freeze({
      formatVersion: 1,
      mapId,
      swim,
      source: Object.freeze({
        namespace: MAP_ENVIRONMENT_NAMESPACE,
        key: mapEnvironmentRecordKey(mapId),
        contentVersion: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      }),
    })),
    source: relative(game, physicalPath).replaceAll("\\", "/"),
  });
}

/**
 * @returns {Promise<{
 *   entries: ReadonlyArray<{kind: string, namespace: string, key: string, mime: string, bytes: Buffer}>,
 *   plan: object,
 *   sources: ReadonlyArray<string>,
 * }>}
 */
export async function buildCanonicalAdventureFieldPlanContent({
  gameRoot = canonicalRepoRoot,
  repoRoot = canonicalRepoRoot,
  viewport = FIELD_PLAN_DEFAULT_VIEWPORT,
  mapId,
} = {}) {
  const physics = await readMovementConfig(gameRoot);
  const resolvedForEnv = mapId ?? FIELD_MAP_222000000;
  const mapEnvironmentBundle = await readMapEnvironment(gameRoot, resolvedForEnv);
  const projection = await projectAdventureMapFieldScene({
    gameRoot: repoRoot,
    viewport,
    mapId,
  });
  if (resolvedForEnv !== projection.fieldState.mapId) {
    throw new TypeError("map environment mapId does not match projected fieldState.mapId");
  }
  if (resolvedForEnv !== FIELD_MAP_222000000) {
    assertPublishedExtraMapFieldPlanPublishable(resolvedForEnv, projection.map);
  }
  const effectiveBounds = projection.map?.scene?.bounds?.effectiveBounds
    ?? projection.root?.data?.bounds?.effectiveBounds;
  if (effectiveBounds === undefined || effectiveBounds === null) {
    throw new TypeError("map projection did not yield effectiveBounds for the bootstrap FieldPlan");
  }
  const footholdCollisionPlan = buildFootholdCollisionPlan(projection.map.scene.footholds);
  const ropeGroup = projection.map.facts.groups.rope;
  const ropeGroupStatus = projection.map.scene.groupStatus.rope;
  const ropeGroupFileKey = `map.${resolvedForEnv}.jsonl`;
  const ropeCollisionPlan = buildRopeCollisionPlan(
    resolvedForEnv,
    projection.map.scene.ropes,
    ropeGroupStatus,
    Object.freeze({
      groupFileKey: ropeGroupFileKey,
      contentVersion: ropeGroupStatus === SOURCE_ABSENT ? null : ropeGroup?.contentVersion ?? null,
    }),
  );
  const resolvedMapId = projection.fieldState.mapId;
  const publishedTargets = new Set(PUBLISHED_FIELD_PLAN_MAP_IDS);
  const portalLogicalIndex = buildPortalLogicalIndex(
    resolvedMapId,
    projection.map.scene.portals,
    publishedTargets,
  );
  const plan = validateFieldPlan(Object.freeze({
    mapId: resolvedMapId,
    hash: projection.hash,
    mapProjectionHash: projection.map.projection.hash,
    effectiveBounds,
    fieldState: projection.fieldState,
    footholdCollisionPlan,
    ropeCollisionPlan,
    movementConfig: physics.movementConfig,
    mapEnvironment: mapEnvironmentBundle.mapEnvironment,
    portalLogicalIndex,
    sceneEpoch: 0,
    root: projection.root,
  }));
  const recordKey = fieldPlanContentKey(resolvedMapId ?? mapId ?? FIELD_MAP_222000000);
  const bytes = Buffer.from(JSON.stringify(plan), "utf8");
  return Object.freeze({
    entries: Object.freeze([Object.freeze({
      kind: "record",
      namespace: FIELD_PLAN_NAMESPACE,
      key: recordKey,
      mime: RECORD_MIME,
      bytes,
    })]),
    plan,
    sources: Object.freeze([physics.source, mapEnvironmentBundle.source]),
  });
}

/**
 * Build validated FieldPlans for every published map id.
 */
export async function buildAllCanonicalAdventureFieldPlans(options = {}) {
  const plans = [];
  const entries = [];
  const sources = [];
  for (const mapId of PUBLISHED_FIELD_PLAN_MAP_IDS) {
    const built = await buildCanonicalAdventureFieldPlanContent({ ...options, mapId });
    plans.push(built.plan);
    for (const entry of built.entries) entries.push(entry);
    for (const source of built.sources) sources.push(source);
  }
  return Object.freeze({
    plans: Object.freeze(plans),
    entries: Object.freeze(entries),
    sources: Object.freeze([...new Set(sources)]),
  });
}

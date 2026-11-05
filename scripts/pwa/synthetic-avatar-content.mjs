/**
 * Canonical synthetic Avatar Content for the Adventure Island PWA
 * installation bundle — PR-B (cms-actor × canonical PWA integration).
 *
 * Everything here is GENERATED: deterministic solid-color Canvas PNGs, the
 * minimal synthetic `[struct]Look` / `[struct]ZMap` records that describe
 * them, and nothing else. No original WZ, extracted PNG, audio, FSDB export
 * or user asset ever enters the repository through this module. The geometry,
 * colors and per-frame markers intentionally mirror the cms-actor component's
 * synthetic test fixture (components/cms-actor/test/synthetic-fsdb.mjs), and
 * test/pwa-bundle.test.mjs pins that equivalence byte-for-byte for every
 * shared identity, so the canonical Content cannot drift from the component
 * fixture that validates the renderer.
 *
 * The generated set is minimal by design: exactly the stand1 / walk1 / jump
 * locomotion the PR-B closed loop needs (issue #48):
 *   - records: struct.ZMap/order plus one struct.Look record per part
 *     (body / head / face / hair / weapon), each canvas stamped with the
 *     exact contentVersion (sha256) of the PNG it references;
 *   - resources: one PNG per (part, action, frame) actually referenced by
 *     those records (hair `walk1` is a UOL back to `default`, like the real
 *     hair records; the face has a single `default` expression).
 *
 * Pure and side-effect free: same inputs → byte-identical entries, so
 * `npm run pwa:bundle` stays byte-deterministic.
 */
import { createHash } from "node:crypto";

import { validateAvatarPlan, measureAvatarPlanDataBytes } from "../../components/cms-actor/src/avatar-model.mjs";
import { paintCanvas } from "../../components/cms-actor/test/png.mjs";
import {
  CANVAS_SPECS,
  COLORS,
  FRAME_MARKERS,
  IMAGE_NAMESPACE,
  PRESENTATION_NAMESPACE,
  SYNTHETIC_ZMAP,
} from "../../components/cms-actor/test/synthetic-fsdb.mjs";
import { buildAvatarPlan } from "../../components/cms-actor/test/look-adapter.mjs";

/** Canonical image Content namespace (the synthetic `[resource]图` table). */
export { IMAGE_NAMESPACE };

/** Content namespace of the classic presentation script (resource table). */
export const PRESENTATION_SCRIPT_NAMESPACE = PRESENTATION_NAMESPACE;
/** Logical Content key of the cms-actor classic IIFE inside that namespace. */
export const PRESENTATION_SCRIPT_KEY = "cms-actor/cms-actor.browser.js";
/** Physical artifact (PR-A build) published under that identity. */
export const PRESENTATION_SCRIPT_PATH = "components/cms-actor/browser/cms-actor.browser.js";

export const ZMAP_NAMESPACE = "struct.ZMap";
export const LOOK_NAMESPACE = "struct.Look";
/** Synthetic look ids, mirroring the component fixture's LOOK_IDS. */
export const LOOK_RECORD_KEYS = Object.freeze({
  body: "00002000",
  head: "00012000",
  face: "00020000",
  hair: "00030000",
  weapon: "01302000",
});
const ISLOT = Object.freeze({ body: "Bd", head: "Hd", face: "Fc", hair: "Hr", weapon: "Wp" });

/** Exactly the locomotion actions the canonical PWA closed loop exercises. */
export const CANONICAL_AVATAR_ACTIONS = Object.freeze([
  Object.freeze({ name: "stand1", frames: 2, delay: 500 }),
  Object.freeze({ name: "walk1", frames: 4, delay: 180 }),
  Object.freeze({ name: "jump", frames: 1, delay: 200 }),
]);

const RECORD_MIME = "application/json; charset=utf-8";
const SCRIPT_MIME = "text/javascript; charset=utf-8";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const recordBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

// --- PNG painting (mirrors the component fixture for the canonical subset) ---

function solid(color, spec) {
  return paintCanvas(spec.width, spec.height, () => color);
}

function bodyPng(action, frameIndex) {
  const { width, height } = CANVAS_SPECS.body;
  const marker = FRAME_MARKERS[action][frameIndex];
  return paintCanvas(width, height, (x, y) => (y >= height - 2 ? marker : COLORS.body));
}

/** Hair keeps the transparent window over the face, like the component fixture. */
function hairPng() {
  const { width, height } = CANVAS_SPECS.hair;
  return paintCanvas(width, height, (x, y) => (
    x >= 6 && x < 18 && y >= 3 && y < 13 ? [0, 0, 0, 0] : COLORS.hair
  ));
}

function pngFor(kind, action, frameIndex) {
  const spec = CANVAS_SPECS[kind];
  if (kind === "body") return bodyPng(action, frameIndex);
  if (kind === "hair") return hairPng();
  if (kind === "head") return solid(COLORS.head, spec);
  if (kind === "face") return solid(COLORS.face, spec);
  if (kind === "weapon") return solid(COLORS.weapon, spec);
  throw new Error(`unknown canvas kind ${kind}`);
}

// --- Deterministic entry ordering -------------------------------------------

function compareEntries(left, right) {
  const keys = ["kind", "namespace", "key"];
  for (const key of keys) {
    const delta = left[key] < right[key] ? -1 : left[key] > right[key] ? 1 : 0;
    if (delta !== 0) return delta;
  }
  return 0;
}

/**
 * Build the canonical synthetic Content entry set (records + PNGs).
 *
 * @returns {{
 *   entries: ReadonlyArray<{kind: "record"|"group"|"resource", namespace: string, key: string, mime: string, bytes: Buffer}>,
 *   index: Map<string, {bytes: Buffer, mime: string, contentVersion: string}>,
 *   looks: Record<string, object>,
 *   zOrder: string[],
 * }}
 * `index` is keyed `${namespace}\0${key}` — the same shape the component's
 * look-adapter consumes. Entries are canonically sorted (kind, namespace,
 * key) so the published bundle is byte-deterministic.
 */
export function buildCanonicalSyntheticAvatarContent() {
  const entries = [];
  const index = new Map();
  const add = (kind, namespace, key, mime, bytes) => {
    entries.push(Object.freeze({ kind, namespace, key, mime, bytes }));
    index.set(`${namespace}\0${key}`, Object.freeze({ bytes, mime, contentVersion: sha256(bytes) }));
  };

  // [struct]ZMap — the synthetic zmap order record.
  add("record", ZMAP_NAMESPACE, "order", RECORD_MIME, recordBytes({ order: [...SYNTHETIC_ZMAP] }));

  // [struct]Look + [resource]图 — one record per part, PNGs per referenced frame.
  const looks = {};
  for (const [kind, id] of Object.entries(LOOK_RECORD_KEYS)) {
    const record = { info: { islot: ISLOT[kind] }, actions: {} };
    const actionNames = kind === "face"
      ? ["default"]
      : kind === "hair"
        ? ["default", ...CANONICAL_AVATAR_ACTIONS.map(({ name }) => name)]
        : CANONICAL_AVATAR_ACTIONS.map(({ name }) => name);
    for (const actionName of actionNames) {
      const canonical = CANONICAL_AVATAR_ACTIONS.find(({ name }) => name === actionName);
      if (kind === "hair" && actionName === "walk1") {
        // Real hair walk frames are UOLs back to `default`; the game-side
        // adapter resolves them, so no separate PNG exists for walk1.
        record.actions.walk1 = { uol: "default" };
        continue;
      }
      const frameCount = kind === "body" ? canonical.frames : 1;
      const frames = [];
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const spec = CANVAS_SPECS[kind];
        const resourceKey = `Look/${id}/${actionName}/${frameIndex}/${kind}`;
        const bytes = pngFor(kind, actionName, frameIndex);
        add("resource", IMAGE_NAMESPACE, resourceKey, "image/png", bytes);
        const canvas = {
          name: kind,
          resource: resourceKey,
          contentVersion: sha256(bytes),
          origin: [...spec.origin],
          z: spec.z,
          width: spec.width,
          height: spec.height,
          map: Object.fromEntries(Object.entries(spec.map).map(([anchor, point]) => [anchor, [...point]])),
        };
        const frame = { canvases: [canvas] };
        if (kind === "body") {
          frame.delay = canonical.delay;
          frame.face = 1;
        }
        frames.push(frame);
      }
      record.actions[actionName] = { frames };
    }
    looks[kind] = record;
    add("record", LOOK_NAMESPACE, id, RECORD_MIME, recordBytes(record));
  }

  entries.sort(compareEntries);
  return Object.freeze({
    entries: Object.freeze(entries),
    index,
    looks,
    zOrder: [...SYNTHETIC_ZMAP],
  });
}

/**
 * Rehydrate the generator's view from PUBLISHED payload Content entries
 * ({kind, namespace, key, mime, encoding:"base64", body}): the record values,
 * the image identity→version index, and the AvatarPlanV1 derivable from them
 * through the component's reference look-adapter.
 *
 * Both the bundle builder (as a build-time consistency proof) and the PR-B
 * browser fixture (as the projected plan) consume the published entries
 * through this single function, so what gets validated is exactly what ships.
 */
export function contentEntriesToParts(entries) {
  if (!Array.isArray(entries)) throw new TypeError("content entries must be an array");
  const images = new Map();
  const records = new Map();
  for (const [position, entry] of entries.entries()) {
    const label = `content[${position}]`;
    if (entry === null || typeof entry !== "object") throw new TypeError(`${label} must be an object`);
    if (typeof entry.kind !== "string" || !["record", "group", "resource"].includes(entry.kind)) {
      throw new TypeError(`${label}: invalid Content kind`);
    }
    if (entry.encoding !== "base64" || typeof entry.body !== "string") {
      throw new TypeError(`${label}: Content body must be base64 text`);
    }
    const bytes = Buffer.from(entry.body, "base64");
    if (bytes.toString("base64") !== entry.body) {
      throw new TypeError(`${label}: Content body is not canonical base64`);
    }
    const identity = `${entry.kind}\0${entry.namespace}\0${entry.key}`;
    if (entry.kind === "resource") {
      if (images.has(identity)) throw new TypeError(`duplicate Content identity ${entry.namespace}/${entry.key}`);
      images.set(identity, Object.freeze({ bytes, mime: entry.mime, contentVersion: sha256(bytes) }));
    } else if (entry.kind === "record") {
      let value;
      try {
        value = JSON.parse(bytes.toString("utf8"));
      } catch (cause) {
        throw new TypeError(`${label}: record body is not JSON (${cause.message})`);
      }
      records.set(`${entry.namespace}\0${entry.key}`, Object.freeze({ value, contentVersion: sha256(bytes) }));
    } else {
      throw new TypeError(`${label}: groups are not part of the canonical synthetic Content set`);
    }
  }

  const zmap = records.get(`${ZMAP_NAMESPACE}\0order`);
  if (zmap === undefined || !Array.isArray(zmap.value?.order)) {
    throw new TypeError("canonical Content is missing the struct.ZMap/order record");
  }
  const looks = {};
  for (const [kind, id] of Object.entries(LOOK_RECORD_KEYS)) {
    const record = records.get(`${LOOK_NAMESPACE}\0${id}`);
    if (record === undefined) throw new TypeError(`canonical Content is missing the struct.Look/${id} record`);
    looks[kind] = record.value;
  }
  return Object.freeze({
    zmap: zmap.value,
    zmapContentVersion: zmap.contentVersion,
    looks,
    records: Object.freeze(Object.fromEntries(records)),
    images,
    imageIndex: new Map([...images].map(([identity, entry]) => [identity.split("\0").slice(1).join("\0"), entry])),
    zOrder: zmap.value.order,
  });
}

/** Derive (and validate) the AvatarPlanV1 the published Content describes. */
export function deriveCanonicalAvatarPlan(parts) {
  const plan = validateAvatarPlan(buildAvatarPlan(parts.looks, parts.zOrder, parts.imageIndex));
  const bytes = measureAvatarPlanDataBytes(plan);
  if (bytes > 262_144) {
    throw new TypeError(`derived AvatarPlanV1 is ${bytes} bytes, exceeding the frozen RenderNode.data cap`);
  }
  return plan;
}

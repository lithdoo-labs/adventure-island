/**
 * Synthetic CMS 079-style FSDB for cms-actor browser integration tests.
 *
 * Everything here is generated: no original WZ, PNG or audio ever enters the
 * repository. The physical layout follows content/DESIGN.md ([struct]T with
 * .info.meta JSON Schemas, [resource]T with .desc.meta, UTF-8 without BOM,
 * resource logical key = physical path minus the last extension).
 *
 * The body geometry intentionally mirrors the reverse-engineered 079 walk1
 * canvas (27×32 body, origin (19,32), navel (-6,-20), neck (-4,-32)) so the
 * synthetic plan exercises the same anchor chain as the real paper doll.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { paintCanvas } from "./png.mjs";

export const IMAGE_NAMESPACE = "resource.图";
export const PRESENTATION_NAMESPACE = "resource.Presentation";
export const COLORS = Object.freeze({
  body: [61, 148, 96, 255],
  head: [231, 191, 150, 255],
  face: [43, 43, 51, 255],
  hair: [85, 58, 46, 255],
  weapon: [200, 215, 231, 255],
});

/** Per-frame marker colors painted across the body canvas bottom rows. */
export const FRAME_MARKERS = Object.freeze({
  stand1: [[240, 180, 60, 255], [210, 120, 50, 255]],
  walk1: [[200, 60, 60, 255], [60, 200, 60, 255], [60, 60, 200, 255], [220, 220, 80, 255]],
  jump: [[130, 80, 200, 255]],
  brandish1: [[20, 20, 20, 255], [90, 90, 30, 255], [30, 90, 90, 255]],
  stressSpin: Array.from({ length: 48 }, (_, index) => [(40 + index * 5) % 256, (255 - index * 5) % 256, 128, 255]),
});

const ACTIONS = Object.freeze({
  stand1: { frames: 2, delay: 500 },
  walk1: { frames: 4, delay: 180 },
  jump: { frames: 1, delay: 200 },
  brandish1: { frames: 3, delay: 120 },
  stressSpin: { frames: 48, delay: 70 },
});

/** Canvas geometry; anchors are WZ `map` vectors relative to `origin`. */
export const CANVAS_SPECS = Object.freeze({
  body: { width: 27, height: 32, origin: [19, 32], z: "body", map: { navel: [-6, -20], neck: [-4, -32], hand: [6, -14] } },
  head: { width: 24, height: 24, origin: [12, 12], z: "head", map: { neck: [-4, -10], brow: [0, -7] } },
  face: { width: 12, height: 10, origin: [6, 5], z: "face", map: { brow: [0, -5] } },
  hair: { width: 24, height: 18, origin: [12, 9], z: "hair", map: { brow: [0, -8] } },
  weapon: { width: 16, height: 28, origin: [8, 22], z: "weaponOverGlove", map: { hand: [-3, -17] } },
});

/** Front-to-back painting order, the synthetic equivalent of zmap.img. */
export const SYNTHETIC_ZMAP = Object.freeze(["weaponOverGlove", "hair", "face", "head", "body"]);

const LOOK_IDS = Object.freeze({
  body: "00002000",
  head: "00012000",
  face: "00020000",
  hair: "00030000",
  weapon: "01302000",
});

function solid(color, width, height) {
  return paintCanvas(width, height, () => color);
}

function bodyPng(frameMarker) {
  const { width, height } = CANVAS_SPECS.body;
  return paintCanvas(width, height, (x, y) => (y >= height - 2 ? frameMarker : COLORS.body));
}

/** Hair keeps a transparent window where the face canvas shows through. */
function hairPng() {
  const { width, height } = CANVAS_SPECS.hair;
  // Face occupies scene x[-6,6) y[-29,-19); hair spans x[-12,12) y[-32,-14),
  // so the hole is hair-local x[6,18) y[3,13).
  return paintCanvas(width, height, (x, y) => (
    x >= 6 && x < 18 && y >= 3 && y < 13 ? [0, 0, 0, 0] : COLORS.hair
  ));
}

function pngFor(kind, action, frameIndex) {
  const spec = CANVAS_SPECS[kind];
  if (kind === "body") return bodyPng(FRAME_MARKERS[action][frameIndex]);
  if (kind === "hair") return hairPng();
  if (kind === "head") return solid(COLORS.head, spec.width, spec.height);
  if (kind === "face") return solid(COLORS.face, spec.width, spec.height);
  if (kind === "weapon") return solid(COLORS.weapon, spec.width, spec.height);
  throw new Error(`unknown canvas kind ${kind}`);
}

function structRecord(body) {
  return `${JSON.stringify(body, null, 2)}\n`;
}

const LOOK_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["info", "actions"],
  properties: {
    info: { type: "object", properties: { islot: { type: "string" } }, required: ["islot"] },
    actions: { type: "object" },
  },
  additionalProperties: true,
});

/**
 * Generate the synthetic FSDB plus the trusted Content index.
 *
 * @param {string} fsdbRoot directory that will contain `[FSDB]cms`
 * @param {{ scriptBytes: Buffer }} parts the checked-in classic script bytes
 */
export function generateSyntheticFsdb(fsdbRoot, { scriptBytes }) {
  const dbRoot = path.join(fsdbRoot, "[FSDB]cms");
  rmSync(fsdbRoot, { recursive: true, force: true });
  const index = new Map(); // `${namespace}\0${key}` -> { bytes, mime, contentVersion }
  const version = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

  const writeFile = (relative, bytes) => {
    const target = path.join(dbRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  };

  // ---- [struct]ZMap ------------------------------------------------------
  writeFile(path.join("[struct]ZMap", ".info.meta"), structRecord({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: ["order"],
    properties: { order: { type: "array", items: { type: "string" } } },
    additionalProperties: false,
  }));
  writeFile(path.join("[struct]ZMap", "order.json"), structRecord({ order: [...SYNTHETIC_ZMAP] }));

  // ---- [struct]Look + [resource]图 ---------------------------------------
  writeFile(path.join("[struct]Look", ".info.meta"), structRecord(LOOK_SCHEMA));
  const imageDesc = [
    "# [resource]图\n",
    "\n",
    "Synthetic Canvas PNGs for the cms-actor integration fixture. Keys mirror\n",
    "the WZ path `Look/{编号}/{动作}/{帧}/{画布}`; the last extension (png) is\n",
    "not part of the logical Content key. Generated at test time; contains no\n",
    "original game assets.\n",
  ].join("");
  writeFile(path.join("[resource]图", ".desc.meta"), imageDesc);

  const weaponActions = ["stand1", "walk1", "jump", "brandish1"]; // weapon lacks stressSpin on purpose
  const faceExpressions = ["default"]; // expression names, not locomotion
  const looks = {};
  for (const [kind, id] of Object.entries(LOOK_IDS)) {
    const record = { info: { islot: kind === "body" ? "Bd" : kind === "head" ? "Hd" : kind === "face" ? "Fc" : kind === "hair" ? "Hr" : "Wp" }, actions: {} };
    const actionNames = kind === "face" ? faceExpressions : Object.keys(ACTIONS);
    if (kind === "hair") {
      // Real hair records carry a `default` action that other actions
      // reference back to via UOL; generate it before the loop consumers.
      const canvasSpec = CANVAS_SPECS.hair;
      const resourceKey = `Look/${id}/default/0/hair`;
      const bytes = hairPng();
      writeFile(path.join("[resource]图", `${resourceKey}.png`), bytes);
      index.set(`${IMAGE_NAMESPACE}\0${resourceKey}`, { bytes, mime: "image/png", contentVersion: version(bytes) });
      record.actions.default = { frames: [{
        canvases: [{
          name: "hair",
          resource: resourceKey,
          origin: [...canvasSpec.origin],
          z: canvasSpec.z,
          width: canvasSpec.width,
          height: canvasSpec.height,
          map: Object.fromEntries(Object.entries(canvasSpec.map).map(([anchor, point]) => [anchor, [...point]])),
        }],
      }] };
    }
    for (const actionName of actionNames) {
      const spec = ACTIONS[actionName] ?? { frames: 1, delay: 0 };
      if (kind === "weapon" && !weaponActions.includes(actionName)) continue;
      if (kind === "hair" && actionName === "walk1") {
        // UOL back to `default`, like real hair walk frames.
        record.actions.walk1 = { uol: "default" };
        continue;
      }
      const frameCount = kind === "body" ? spec.frames : 1;
      const frames = [];
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const canvasSpec = CANVAS_SPECS[kind];
        const resourceKey = `Look/${id}/${actionName}/${frameIndex}/${kind}`;
        const bytes = pngFor(kind, actionName, frameIndex);
        writeFile(path.join("[resource]图", `${resourceKey}.png`), bytes);
        index.set(`${IMAGE_NAMESPACE}\0${resourceKey}`, { bytes, mime: "image/png", contentVersion: version(bytes) });
        const frame = {
          canvases: [{
            name: kind,
            resource: resourceKey,
            origin: [...canvasSpec.origin],
            z: canvasSpec.z,
            width: canvasSpec.width,
            height: canvasSpec.height,
            map: Object.fromEntries(Object.entries(canvasSpec.map).map(([anchor, point]) => [anchor, [...point]])),
          }],
        };
        if (kind === "body") {
          frame.delay = spec.delay;
          frame.face = 1;
        }
        frames.push(frame);
      }
      record.actions[actionName] = { frames };
    }
    looks[kind] = record;
    writeFile(path.join("[struct]Look", `${id}.json`), structRecord(record));
  }

  // ---- [resource]Presentation --------------------------------------------
  writeFile(path.join("[resource]Presentation", ".desc.meta"), [
    "# [resource]Presentation\n",
    "\n",
    "Browser presentation artifacts. `cms-actor/cms-actor.browser.js.js` holds\n",
    "the classic-script build; the physical double extension yields logical\n",
    "key `cms-actor/cms-actor.browser.js`. MIME essence: text/javascript.\n",
  ].join(""));
  writeFile(path.join("[resource]Presentation", "cms-actor", "cms-actor.browser.js.js"), scriptBytes);
  const scriptKey = "cms-actor/cms-actor.browser.js";
  index.set(`${PRESENTATION_NAMESPACE}\0${scriptKey}`, {
    bytes: scriptBytes,
    mime: "text/javascript; charset=utf-8",
    contentVersion: version(scriptBytes),
  });

  return {
    dbRoot,
    index,
    looks,
    lookIds: LOOK_IDS,
    readStruct: (table, key) => JSON.parse(readFileSync(path.join(dbRoot, `[struct]${table}`, `${key}.json`), "utf8")),
  };
}

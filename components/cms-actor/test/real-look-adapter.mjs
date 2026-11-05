/**
 * Real-asset Look adapter: struct.Look records produced by scripts/wz_fsdb
 * from a real CMS 079 client -> bounded, renderer-ready AvatarPlanV1.
 *
 * Handles the actual converter output shape:
 *  - body actions carry numbered frames; a frame may be a REFERENCE frame
 *    ({action, frame, delay}) whose canvases live in the referenced action
 *    (e.g. brandish1 -> swingOF/stabOF); parts follow the referenced
 *    action+frame per DESIGN.md;
 *  - head/weapon actions carry numbered frames (UOLs already resolved
 *    inline by the converter, e.g. head walk1 -> front/head);
 *  - face `default` and hair actions carry canvases directly at the action
 *    level; hairShade carries one canvas per skin index (skin 0 -> "0");
 *  - zOrder is the real zmap.img order filtered to the z names the plan
 *    actually uses (the plan is a render plan, not the full zmap table).
 */
import { validateAvatarPlan } from "../src/avatar-model.mjs";

const IMAGE_NAMESPACE = "resource.图";
const NON_LOOP_ACTIONS = new Set(["jump", "brandish1", "stressSpin"]);

function isCanvas(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    typeof value.resource === "string" && Number.isInteger(value.width) && Number.isInteger(value.height);
}

function isFrameReference(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    typeof value.action === "string" && Number.isInteger(value.frame);
}

function numericFrameKeys(node) {
  return Object.keys(node).filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
}

/** Canvas entries of one part at (action, frameIndex); follows reference frames. */
function canvasesAt(record, actionName, frameIndex, depth = 0) {
  const node = record?.[actionName];
  if (!node || typeof node !== "object") return [];
  let frame = node;
  const frames = numericFrameKeys(node);
  if (frames.length > 0) {
    const clamped = Math.min(frameIndex, frames.length - 1);
    frame = node[frames[clamped]];
  }
  if (isFrameReference(frame)) {
    if (depth >= 8) throw new Error(`reference chain too deep at ${actionName}`);
    return canvasesAt(record, frame.action, frame.frame, depth + 1);
  }
  const entries = [];
  for (const [key, value] of Object.entries(frame)) {
    if (isCanvas(value)) entries.push({ id: key, canvas: value });
    else if (value && typeof value === "object" && !Array.isArray(value) && isCanvas(value["0"])) {
      // hairShade-style skin block: use the skin-0 canvas.
      entries.push({ id: key, canvas: value["0"] });
    }
  }
  return entries;
}

function layerOf({ id, canvas }, index) {
  const entry = index.get(`${IMAGE_NAMESPACE}\0${canvas.resource}`);
  if (!entry) throw new Error(`real FSDB index is missing ${canvas.resource}`);
  return {
    id,
    z: canvas.z,
    resource: { namespace: IMAGE_NAMESPACE, key: canvas.resource, contentVersion: entry.contentVersion },
    width: canvas.width,
    height: canvas.height,
    origin: [...canvas.origin],
    anchors: Object.fromEntries(Object.entries(canvas.map ?? {}).map(([anchor, point]) => [anchor, [...point]])),
  };
}

/**
 * @param {{ body: object, head: object, face: object, hair: object, weapon: object }} looks
 * @param {string[]} zmapOrder full zmap.img order (front-to-back)
 * @param {Map<string,{contentVersion: string}>} index Content index for resource.图
 * @param {{ actions?: string[], expression?: string }} options action whitelist
 */
export function buildRealAvatarPlan(looks, zmapOrder, index, { actions = ["stand1", "walk1", "jump", "brandish1"], expression = "default" } = {}) {
  const usedZ = new Set();
  const planActions = {};
  for (const actionName of actions) {
    const bodyNode = looks.body[actionName];
    if (!bodyNode) throw new Error(`body action missing: ${actionName}`);
    const frameKeys = numericFrameKeys(bodyNode);
    if (frameKeys.length === 0) throw new Error(`body action has no numbered frames: ${actionName}`);
    const frames = [];
    for (const [position, key] of frameKeys.entries()) {
      const bodyFrame = bodyNode[key];
      const canvasAction = isFrameReference(bodyFrame) ? bodyFrame.action : actionName;
      const canvasIndex = isFrameReference(bodyFrame) ? bodyFrame.frame : position;

      const entries = [
        ...canvasesAt(looks.body, canvasAction, canvasIndex),
        ...canvasesAt(looks.head, canvasAction, canvasIndex),
        ...canvasesAt(looks.hair, canvasAction, canvasIndex),
        ...(bodyFrame.face === 0 ? [] : canvasesAt(looks.face, expression, 0)),
        ...canvasesAt(looks.weapon, canvasAction, canvasIndex),
      ];
      const bodyFirst = [...entries].sort((left, right) => (right.id === "body" ? 1 : 0) - (left.id === "body" ? 1 : 0));
      const layers = bodyFirst.map((entry) => layerOf(entry, index));
      for (const layer of layers) usedZ.add(layer.z);
      frames.push({
        delay: bodyFrame.delay ?? 0,
        move: Array.isArray(bodyFrame.move) ? [...bodyFrame.move] : [0, 0],
        flip: Boolean(bodyFrame.flip),
        layers,
      });
    }
    planActions[actionName] = { loop: !NON_LOOP_ACTIONS.has(actionName), frames };
  }
  const zOrder = zmapOrder.filter((z) => usedZ.has(z));
  if (zOrder.length !== usedZ.size) throw new Error("some canvas z names are absent from zmap order");

  const weaponInfo = looks.weapon?.info ?? {};
  const plan = {
    formatVersion: 1,
    zOrder,
    locomotionActions: {
      stand: `stand${weaponInfo.stand ?? 1}`,
      walk: `walk${weaponInfo.walk ?? 1}`,
      jump: "jump",
    },
    actions: planActions,
  };
  return validateAvatarPlan(plan);
}

/** Read the converter's struct.Look/ZMap records from a converted FSDB root. */
export async function readRealRecords(fsdbRoot, readJson) {
  const looks = {
    body: await readJson(fsdbRoot, "Look", "00002000"),
    head: await readJson(fsdbRoot, "Look", "00012000"),
    face: await readJson(fsdbRoot, "Look", "00020000"),
    hair: await readJson(fsdbRoot, "Look", "00030000"),
    weapon: await readJson(fsdbRoot, "Look", "01302000"),
  };
  const zmap = await readJson(fsdbRoot, "ZMap", "order");
  return { looks, zmapOrder: Object.keys(zmap) };
}

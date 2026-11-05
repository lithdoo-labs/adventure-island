/**
 * Production CMS079 AvatarPlan adapter (game side).
 *
 * Builds a bounded, renderer-ready AvatarPlanV1 from REAL converted CMS 079
 * content through the pinned LoomRealm ContentClient — never from filesystem
 * paths, private Content Indexes or hand-built maps:
 *
 *  - `record()` reads the five struct.Look entries (body 00002000, head
 *    00012000, face 00020000, hair 00030000, weapon 01302000) and
 *    struct.ZMap/order;
 *  - body frames may be REFERENCE frames ({action, frame}) whose canvases
 *    live in the referenced action (brandish1 -> swingOF/stabOF); head, hair
 *    and weapon follow the same canvas action+frame; the face plays the
 *    expression at frame 0 unless the body frame hides it (face === 0);
 *  - hairShade-style skin blocks contribute their skin-0 canvas;
 *  - only the canvases the plan references are collected, and every one is
 *    read once through `resource()`: the adapter verifies MIME essence
 *    `image/png`, `contentVersion` equal to the body's SHA-256 and byte
 *    length, then stamps that exact version into the plan;
 *  - the result is validated by the frozen `validateAvatarPlan` bounds.
 *
 * The plan contains logical identities only: namespace, key, contentVersion.
 * No physical paths, URLs, bearer tokens, WZ nodes or Content Index data.
 * Unverified islot/vslot occlusion is out of scope: this adapter serves the
 * validated body/head/face/hair/01302000 sample the closure covers.
 */
import { validateAvatarPlan } from "../../components/cms-actor/src/avatar-model.mjs";

export const IMAGE_NAMESPACE = "resource.图";
export const LOOK_NAMESPACE = "struct.Look";
export const ZMAP_NAMESPACE = "struct.ZMap";
export const CMS079_LOOK_KEYS = Object.freeze({
  body: "00002000",
  head: "00012000",
  face: "00020000",
  hair: "00030000",
  weapon: "01302000",
});
export const NON_LOOP_ACTIONS = new Set(["jump", "brandish1", "stressSpin"]);
export const DEFAULT_AVATAR_ACTIONS = Object.freeze(["stand1", "walk1", "jump", "brandish1"]);

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
export function canvasesAt(record, actionName, frameIndex, depth = 0) {
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

/** Resource keys the plan for `actions` will reference (no Content reads). */
export function collectAvatarResourceKeys(looks, { actions = DEFAULT_AVATAR_ACTIONS, expression = "default" } = {}) {
  const keys = new Set();
  for (const actionName of actions) {
    const bodyNode = looks.body[actionName];
    if (!bodyNode) throw new Error(`body action missing: ${actionName}`);
    const frameKeys = numericFrameKeys(bodyNode);
    if (frameKeys.length === 0) throw new Error(`body action has no numbered frames: ${actionName}`);
    for (const [position, key] of frameKeys.entries()) {
      const bodyFrame = bodyNode[key];
      const canvasAction = isFrameReference(bodyFrame) ? bodyFrame.action : actionName;
      const canvasIndex = isFrameReference(bodyFrame) ? bodyFrame.frame : position;
      for (const part of ["body", "head", "hair", "weapon"]) {
        for (const { canvas } of canvasesAt(looks[part], canvasAction, canvasIndex)) {
          keys.add(canvas.resource);
        }
      }
      if (bodyFrame.face !== 0) {
        for (const { canvas } of canvasesAt(looks.face, expression, 0)) keys.add(canvas.resource);
      }
    }
  }
  return keys;
}

/** Verify one image resource read and return its trusted contentVersion. */
async function verifiedImageVersion(content, key) {
  const resource = await content.resource(IMAGE_NAMESPACE, key);
  if (resource.mime?.split(";")[0]?.trim().toLowerCase() !== "image/png") {
    throw new Error(`avatar canvas ${key} is not image/png (got ${resource.mime})`);
  }
  const digest = `sha256:${Array.from(new Uint8Array(
    await crypto.subtle.digest("SHA-256", resource.bytes),
  )).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  if (resource.contentVersion !== digest) {
    throw new Error(`avatar canvas ${key} contentVersion ${resource.contentVersion} != body sha256 ${digest}`);
  }
  return { contentVersion: resource.contentVersion, bytes: resource.bytes.length };
}

/**
 * Read the five real Look records and the ZMap order through ContentClient.
 *
 * @param {import("../../loom-realm/packages/subsystem/src/content.js").ContentClient} content
 */
export async function readCms079LookRecords(content) {
  const reads = Object.fromEntries(
    await Promise.all(Object.entries(CMS079_LOOK_KEYS).map(async ([part, key]) => {
      const record = await content.record(LOOK_NAMESPACE, key);
      if (!record?.value || typeof record.value !== "object") {
        throw new Error(`struct.Look/${key} did not return an object`);
      }
      return [part, record.value];
    })),
  );
  const zmap = await content.record(ZMAP_NAMESPACE, "order");
  const order = zmap?.value && typeof zmap.value === "object" ? zmap.value : null;
  if (!order) throw new Error("struct.ZMap/order did not return an object");
  return { looks: reads, zmapOrder: Object.keys(order) };
}

/**
 * Build the bounded AvatarPlanV1 from real Content reads.
 *
 * @param {import("../../loom-realm/packages/subsystem/src/content.js").ContentClient} content
 * @param {{ actions?: string[], expression?: string }} [options]
 */
export async function buildCms079AvatarPlan(content, { actions = DEFAULT_AVATAR_ACTIONS, expression = "default" } = {}) {
  const { looks, zmapOrder } = await readCms079LookRecords(content);
  const keys = collectAvatarResourceKeys(looks, { actions, expression });
  if (keys.size === 0) throw new Error("no avatar canvases referenced");
  const versions = new Map();
  await Promise.all([...keys].map(async (key) => {
    versions.set(key, await verifiedImageVersion(content, key));
  }));

  const usedZ = new Set();
  const planActions = {};
  for (const actionName of actions) {
    const bodyNode = looks.body[actionName];
    const frameKeys = numericFrameKeys(bodyNode);
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
      const layers = bodyFirst.map(({ id, canvas }) => {
        const version = versions.get(canvas.resource);
        if (!version) throw new Error(`plan canvas ${canvas.resource} was not verified through ContentClient`);
        return {
          id,
          z: canvas.z,
          resource: { namespace: IMAGE_NAMESPACE, key: canvas.resource, contentVersion: version.contentVersion },
          width: canvas.width,
          height: canvas.height,
          origin: [...canvas.origin],
          anchors: Object.fromEntries(Object.entries(canvas.map ?? {}).map(([anchor, point]) => [anchor, [...point]])),
        };
      });
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

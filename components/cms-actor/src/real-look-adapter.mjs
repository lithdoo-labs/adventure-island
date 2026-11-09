/**
 * Production adapter: CMS079 Look / ZMap records from ContentClient
 * become one bounded AvatarPlanV1.
 *
 * The converter stores WZ nodes as JSON. Body actions such as brandish1
 * point at another action with `{action, frame}` instead of embedding a
 * canvas. Equipment follows that resolved action. ZMap is read in full;
 * the plan keeps only the z names this actor actually paints, in ZMap order.
 * Client slot occlusion is derived from explicit item islot/vslot metadata
 * and the full smap table. Missing or malformed metadata is a hard error;
 * this adapter never silently falls back to drawing every equipment canvas.
 */
import { validateAvatarPlan } from "./avatar-model.mjs";

export const IMAGE_NAMESPACE = "resource.图";
const REQUIRED_ACTIONS = Object.freeze(["stand1", "walk1", "jump", "brandish1"]);
const NON_LOOP = new Set(["jump", "brandish1"]);
const VERSION = /^sha256:[0-9a-f]{64}$/;

function assert(condition, message) {
  if (!condition) throw new TypeError(`CMS079 AvatarPlan: ${message}`);
}

function numericKeys(node) {
  return Object.keys(node).filter((key) => /^\d+$/.test(key)).sort((left, right) => Number(left) - Number(right));
}

function isCanvas(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && typeof value.resource === "string"
    && typeof value.z === "string"
    && Array.isArray(value.origin);
}

/** ZMap record key order is the client paint order, front to back. */
export function zNamesFromRecord(record) {
  assert(record && typeof record === "object" && !Array.isArray(record), "ZMap order must be an object");
  const names = Object.keys(record);
  assert(names.length > 0, "ZMap order is empty");
  assert(new Set(names).size === names.length, "ZMap order contains a duplicate name");
  return names;
}

function resolveConcrete(look, actionName, frameIndex, seen = new Set()) {
  const action = look?.[actionName];
  if (!action || typeof action !== "object" || Array.isArray(action)) return null;
  const frame = action[String(frameIndex)];
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) return null;
  if (frame.uol === true && frame.resolved === false) {
    throw new TypeError(`CMS079 AvatarPlan: unresolved UOL ${actionName}/${frameIndex} (${frame.status})`);
  }
  if (typeof frame.action === "string" && Number.isInteger(frame.frame)) {
    const token = `${actionName}#${frameIndex}`;
    assert(!seen.has(token), `action cycle at ${token}`);
    seen.add(token);
    const target = resolveConcrete(look, frame.action, frame.frame, seen);
    assert(target, `dangling action ${actionName}/${frameIndex} -> ${frame.action}/${frame.frame}`);
    return { ...target, delay: frame.delay ?? target.delay };
  }
  return { actionName, frameIndex, node: frame, delay: frame.delay };
}

function partConcrete(look, actionName, frameIndex) {
  const direct = resolveConcrete(look, actionName, frameIndex);
  if (direct) return direct;
  const action = look?.[actionName];
  if (!action || typeof action !== "object" || Array.isArray(action)) return null;
  const keys = numericKeys(action);
  if (keys.length === 0) {
    // CMS079 Face/00020000 default is one canvas, not a numbered frame.
    if (frameIndex === 0 && Object.values(action).some(isCanvas)) {
      return { actionName, frameIndex: 0, node: action, delay: action.delay };
    }
    return null;
  }
  const clamped = Number(keys[Math.min(frameIndex, keys.length - 1)]);
  return resolveConcrete(look, actionName, clamped);
}

function pair(value, label) {
  assert(Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === "number" && Number.isFinite(part)), `${label} must be a finite pair`);
  return [value[0], value[1]];
}

function slotTokens(value, label) {
  assert(typeof value === "string", `${label} must be a string`);
  assert(value.length % 2 === 0, `${label} must contain two-character slot tokens`);
  return value.match(/[\s\S]{2}/g) ?? [];
}

/**
 * Reconstruct the audited portion of CMS079 slot-occlusion metadata.
 * zOrder must be the full zmap.img key order (including two-character slots),
 * front-to-back. The client assigns -1, -2, ... in that order.
 */
export function deriveOcclusionFields({ z, islot, vslot, zOrder, smap }) {
  assert(typeof z === "string" && z.length > 0, "canvas z is required for occlusion");
  assert(Array.isArray(zOrder) && zOrder.length > 0, "full zmap order is required for occlusion");
  assert(zOrder.every((name) => typeof name === "string" && name.length > 0), "zmap order entries must be non-empty strings");
  assert(new Set(zOrder).size === zOrder.length, "zmap order contains duplicate names");
  assert(smap && typeof smap === "object" && !Array.isArray(smap), "smap record is required");

  const zValues = new Map(zOrder.map((name, index) => [name, -index - 1]));
  const occupied = slotTokens(islot, "islot");
  const visible = slotTokens(vslot, "vslot");
  assert(occupied.length > 0 || visible.length === 0, "islot is empty while vslot is non-empty");

  let priority = -2147483647; // signed form of the client's 0x80000001 sentinel
  for (const token of occupied) {
    assert(zValues.has(token), `islot slot ${token} is absent from zmap`);
    priority = Math.max(priority, zValues.get(token));
  }

  assert(Object.prototype.hasOwnProperty.call(smap, z), `smap has no entry for canvas z ${z}`);
  const covered = new Set(slotTokens(smap[z], `smap[${z}]`));
  return { priority, tag: visible.filter((token) => covered.has(token)) };
}

function layerFromCanvas(id, canvas, versions, partSlots, zOrder, smap) {
  assert(typeof id === "string" && id.length > 0, "layer id is empty");
  const version = versions.get(canvas.resource);
  assert(typeof version === "string" && VERSION.test(version), `missing contentVersion for ${canvas.resource}`);
  const origin = pair(canvas.origin, `${id}.origin`);
  assert(Number.isInteger(canvas.width) && canvas.width > 0, `${id}.width`);
  assert(Number.isInteger(canvas.height) && canvas.height > 0, `${id}.height`);
  const anchors = {};
  if (canvas.map && typeof canvas.map === "object" && !Array.isArray(canvas.map)) {
    for (const [name, point] of Object.entries(canvas.map)) {
      if (!Array.isArray(point)) continue;
      anchors[name] = pair(point, `${id}.anchors.${name}`);
    }
  }
  assert(Object.keys(anchors).length <= 8, `${id} has more than 8 anchors`);
  const occlusion = canvas.z === "face"
    ? {}
    : deriveOcclusionFields({
      z: canvas.z,
      islot: partSlots?.islot,
      vslot: partSlots?.vslot,
      zOrder,
      smap,
    });
  return {
    id,
    z: canvas.z,
    resource: { namespace: IMAGE_NAMESPACE, key: canvas.resource, contentVersion: version },
    width: canvas.width,
    height: canvas.height,
    origin,
    ...(Object.keys(anchors).length > 0 ? { anchors } : {}),
    ...occlusion,
  };
}

function bodyLayers(node, versions, occlusion) {
  const layers = [];
  const body = node.body;
  assert(isCanvas(body), "body frame has no body canvas");
  layers.push(layerFromCanvas("body", body, versions, occlusion.slotMetadata.body, occlusion.zOrder, occlusion.smap));
  for (const [name, value] of Object.entries(node)) {
    if (name === "body" || !isCanvas(value)) continue;
    assert(name !== "body", "duplicate body canvas");
    layers.push(layerFromCanvas(name, value, versions, occlusion.slotMetadata.body, occlusion.zOrder, occlusion.smap));
  }
  return layers;
}

function equipLayers(partName, node, versions, occlusion) {
  const layers = [];
  for (const [name, value] of Object.entries(node)) {
    if (!isCanvas(value)) continue;
    const id = name === partName ? partName : `${partName}:${name}`;
    assert(id !== "body", `${id} collides with the body layer`);
    layers.push(layerFromCanvas(id, value, versions, occlusion.slotMetadata[partName], occlusion.zOrder, occlusion.smap));
  }
  return layers;
}

/**
 * @param {object} input
 * @param {object} input.body struct.Look 00002000
 * @param {object} input.head struct.Look 00012000
 * @param {object} input.face struct.Look 00020000
 * @param {object} input.hair struct.Look 00030000
 * @param {object} input.weapon struct.Look 01302000
 * @param {string[]} input.zOrder full ZMap name order, including slot tokens
 * @param {Record<string, {islot: string, vslot: string}>} input.slotMetadata per-part item info
 * @param {Record<string, string>} input.smap smap.img values keyed by canvas z name
 * @param {Map<string, string>} input.versions resource key -> sha256 contentVersion from ContentClient
 * @param {string} [input.expression]
 */
export function buildProductionAvatarPlan({
  body,
  head,
  face,
  hair,
  weapon,
  zOrder,
  slotMetadata,
  smap,
  versions,
  expression = "default",
}) {
  assert(body && head && face && hair && weapon, "five Look records are required");
  assert(versions instanceof Map, "versions must be a Map from ContentClient");
  assert(Array.isArray(zOrder) && zOrder.length > 0, "full zOrder is required");
  assert(slotMetadata && typeof slotMetadata === "object" && !Array.isArray(slotMetadata), "slotMetadata from CMS item info is required");
  assert(smap && typeof smap === "object" && !Array.isArray(smap), "smap.img record is required");
  const occlusion = { zOrder, slotMetadata, smap };
  const standSuffix = Number.isInteger(weapon.info?.stand) ? weapon.info.stand : 1;
  const walkSuffix = Number.isInteger(weapon.info?.walk) ? weapon.info.walk : 1;
  const actionNames = new Set(REQUIRED_ACTIONS);
  actionNames.add(`stand${standSuffix}`);
  actionNames.add(`walk${walkSuffix}`);

  const actions = {};
  const usedZ = new Set();
  for (const actionName of actionNames) {
    const sample = body[actionName];
    assert(sample && typeof sample === "object", `body is missing ${actionName}`);
    const frameKeys = numericKeys(sample);
    assert(frameKeys.length > 0, `${actionName} has no frames`);
    const frames = [];
    for (const key of frameKeys) {
      const concrete = resolveConcrete(body, actionName, Number(key));
      assert(concrete, `${actionName}/${key} did not resolve`);
      const layers = bodyLayers(concrete.node, versions, occlusion);
      const headNode = partConcrete(head, concrete.actionName, concrete.frameIndex);
      if (headNode) layers.push(...equipLayers("head", headNode.node, versions, occlusion));
      if (concrete.node.face !== 0) {
        const expressionNode = partConcrete(face, expression, 0) ?? partConcrete(face, concrete.actionName, concrete.frameIndex);
        assert(expressionNode, `face is missing ${expression}`);
        layers.push(...equipLayers("face", expressionNode.node, versions, occlusion));
      }
      const hairNode = partConcrete(hair, concrete.actionName, concrete.frameIndex);
      if (hairNode) layers.push(...equipLayers("hair", hairNode.node, versions, occlusion));
      const weaponNode = partConcrete(weapon, concrete.actionName, concrete.frameIndex);
      if (weaponNode) layers.push(...equipLayers("weapon", weaponNode.node, versions, occlusion));
      for (const layer of layers) usedZ.add(layer.z);
      const frame = { layers };
      if (typeof concrete.delay === "number") frame.delay = concrete.delay;
      if (Array.isArray(concrete.node.move)) frame.move = pair(concrete.node.move, `${actionName}.move`);
      if (typeof concrete.node.flip === "boolean") frame.flip = concrete.node.flip;
      frames.push(frame);
    }
    actions[actionName] = { loop: !NON_LOOP.has(actionName), frames };
  }

  const projected = zOrder.filter((name) => usedZ.has(name));
  for (const name of usedZ) assert(projected.includes(name), `z ${name} is not in ZMap order`);
  const plan = {
    formatVersion: 1,
    zOrder: projected,
    locomotionActions: {
      stand: `stand${standSuffix}`,
      walk: `walk${walkSuffix}`,
      jump: "jump",
    },
    actions,
  };
  return validateAvatarPlan(plan);
}

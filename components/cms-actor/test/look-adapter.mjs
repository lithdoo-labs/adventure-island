/**
 * Game-side reference adapter: synthetic `[struct]Look` records + zmap order
 * -> bounded, renderer-ready AvatarPlanV1.
 *
 * This is the layer the DESIGN doc assigns to the runtime adapter: resolve
 * UOL references, clamp per-part frame numbers to the body timeline, apply
 * the weapon info's locomotion suffixes, drop parts that lack an action, and
 * stamp every canvas with its trusted Content identity + version. The Web
 * Component never performs any of these lookups.
 */
import {
  IMAGE_NAMESPACE,
} from "./synthetic-fsdb.mjs";

function resolveUol(actions, name, seen = new Set()) {
  const node = actions[name];
  if (node === undefined) return null;
  if (node.uol === undefined) return node;
  if (seen.has(name)) throw new Error(`UOL cycle at ${name}`);
  seen.add(name);
  return resolveUol(actions, node.uol, seen);
}

function layerFor(canvas, index) {
  const entry = index.get(`${IMAGE_NAMESPACE}\0${canvas.resource}`);
  if (!entry) throw new Error(`synthetic Content index is missing ${canvas.resource}`);
  return {
    id: canvas.name,
    z: canvas.z,
    resource: {
      namespace: IMAGE_NAMESPACE,
      key: canvas.resource,
      contentVersion: entry.contentVersion,
    },
    width: canvas.width,
    height: canvas.height,
    origin: [...canvas.origin],
    anchors: Object.fromEntries(Object.entries(canvas.map ?? {}).map(([anchor, point]) => [anchor, [...point]])),
  };
}

/**
 * @param {{ body: any, head: any, face: any, hair: any, weapon: any }} looks parsed struct.Look records
 * @param {string[]} zOrder front-to-back zmap order
 * @param {Map<string, {contentVersion: string}>} index trusted Content index
 * @param {{ expression?: string }} options
 */
export function buildAvatarPlan(looks, zOrder, index, { expression = "default" } = {}) {
  const parts = [
    looks.body,
    looks.head,
    looks.hair,
    looks.face,
    looks.weapon,
  ];
  // One-shot / hold actions do not loop; locomotion cycles do (DESIGN.md).
  const NON_LOOP_ACTIONS = new Set(["jump", "brandish1", "stressSpin"]);
  const actions = {};
  for (const [actionName, bodyAction] of Object.entries(looks.body.actions)) {
    const frames = [];
    for (let frameIndex = 0; frameIndex < bodyAction.frames.length; frameIndex += 1) {
      const bodyFrame = bodyAction.frames[frameIndex];
      const layers = [layerFor(bodyFrame.canvases[0], index)];
      for (const part of parts.slice(1)) {
        if (part === looks.face && bodyFrame.face === 0) continue; // body frame hides the face
        const partAction = resolveUol(part.actions, part === looks.face ? expression : actionName);
        if (!partAction?.frames?.length) continue; // part lacks this action: not drawn this frame
        const clamped = partAction.frames[Math.min(frameIndex, partAction.frames.length - 1)];
        layers.push(layerFor(clamped.canvases[0], index));
      }
      frames.push({
        delay: bodyFrame.delay ?? 0,
        move: bodyFrame.move ? [...bodyFrame.move] : [0, 0],
        flip: Boolean(bodyFrame.flip),
        layers,
      });
    }
    actions[actionName] = { loop: !NON_LOOP_ACTIONS.has(actionName), frames };
  }
  const weaponInfo = looks.weapon?.info ?? {};
  const standSuffix = weaponInfo.stand ?? 1;
  const walkSuffix = weaponInfo.walk ?? 1;
  const plan = {
    formatVersion: 1,
    zOrder: [...zOrder],
    locomotionActions: {
      stand: `stand${standSuffix}`,
      walk: `walk${walkSuffix}`,
      jump: "jump",
    },
    actions,
  };
  return plan;
}

/** Mutate one resource version in a plan (test knob for conflict paths). */
export function withResourceVersion(plan, key, contentVersion) {
  const clone = structuredClone(plan);
  for (const action of Object.values(clone.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) {
        if (layer.resource.key === key) layer.resource.contentVersion = contentVersion;
      }
    }
  }
  return clone;
}

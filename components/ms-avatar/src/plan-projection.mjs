/**
 * Project validated AvatarPlanV1 (build-time / adapter only — not wire ABI)
 * into ms-avatar + ms-action RenderNode children.
 */
import { resolveActionName, validateAvatarPlan } from "../../cms-actor/src/avatar-model.mjs";
import { validateAvatarRenderData } from "./avatar-render-data.mjs";
import { validateActionClip } from "./action-clip.mjs";

function resourcePageId(resource) {
  return `${resource.namespace}/${resource.key}@${resource.contentVersion}`;
}

function delayToDurationMs(delay) {
  if (delay === undefined) return 0;
  if (typeof delay === "number" && Number.isFinite(delay) && delay >= 0) return Math.round(delay);
  return 0;
}

function ensurePage(layer, pages) {
  const pageId = resourcePageId(layer.resource);
  const dims = layer.source
    ? { width: layer.source.x + layer.source.w, height: layer.source.y + layer.source.h }
    : { width: layer.width, height: layer.height };
  const existing = pages[pageId];
  if (!existing) {
    pages[pageId] = Object.freeze({
      resource: Object.freeze({ ...layer.resource }),
      width: dims.width,
      height: dims.height,
    });
  } else {
    pages[pageId] = Object.freeze({
      ...existing,
      width: Math.max(existing.width, dims.width),
      height: Math.max(existing.height, dims.height),
    });
  }
  return pageId;
}

function registerSprite(layer, pages, items, spriteId) {
  const pageId = ensurePage(layer, pages);
  items[spriteId] = Object.freeze({
    page: pageId,
    source: layer.source
      ? Object.freeze({ x: layer.source.x, y: layer.source.y, w: layer.source.w, h: layer.source.h })
      : Object.freeze({ x: 0, y: 0, w: layer.width, h: layer.height }),
  });
  return spriteId;
}

function planLayerToClipLayer(layer, spriteId) {
  const out = {
    id: layer.id,
    sprite: spriteId,
    z: layer.z,
    origin: [...layer.origin],
  };
  if (layer.anchors && Object.keys(layer.anchors).length > 0) out.anchors = { ...layer.anchors };
  if (Number.isInteger(layer.priority) && Array.isArray(layer.tag)) {
    out.priority = layer.priority;
    out.tag = [...layer.tag];
  }
  return out;
}

function buildCatalog(plan) {
  const pages = {};
  const items = {};
  const registerFrames = (frames, actionName) => {
    frames.forEach((frame, frameIndex) => {
      for (const layer of frame.layers) {
        const spriteId = `${layer.id}.${actionName}.${frameIndex}`;
        registerSprite(layer, pages, items, spriteId);
      }
    });
  };
  for (const [actionName, action] of Object.entries(plan.actions)) registerFrames(action.frames, actionName);
  if (plan.expression?.frames) registerFrames(plan.expression.frames, plan.expression.name ?? "expression");
  return { pages, items };
}

/**
 * @param {object} avatarPlan validated AvatarPlanV1
 * @param {object} [opts]
 */
export function projectAvatarFromPlan(avatarPlan, opts = {}) {
  const plan = validateAvatarPlan(avatarPlan);
  const { pages, items } = buildCatalog(plan);
  const locomotion = opts.locomotion ?? "stand";
  const facing = opts.facing === "left" ? "left" : "right";
  const expressionName = opts.expression ?? plan.expression?.name ?? "default";
  const actionName = opts.action ?? resolveActionName(plan, locomotion) ?? "stand1";

  const expressions = {};
  if (plan.expression) {
    expressions[plan.expression.name] = {
      frames: plan.expression.frames.map((frame, frameIndex) => ({
        durationMs: delayToDurationMs(frame.delay),
        layers: frame.layers.map((layer) => planLayerToClipLayer(
          layer,
          `${layer.id}.${plan.expression.name}.${frameIndex}`,
        )),
      })),
    };
  }
  if (!expressions.default) {
    expressions.default = { frames: [{ durationMs: 0, layers: [] }] };
  }

  const parentData = validateAvatarRenderData({
    appearance: { zOrder: [...plan.zOrder] },
    sprites: { pages, items },
    expressions,
  });

  const actionChildren = Object.entries(plan.actions).map(([name, action]) => {
    const clip = validateActionClip({
      playback: { mode: action.loop ? "loop" : "hold" },
      frames: action.frames.map((frame, frameIndex) => ({
        durationMs: delayToDurationMs(frame.delay),
        ...(frame.move ? { move: [...frame.move] } : {}),
        ...(frame.rotate ? { rotate: frame.rotate } : {}),
        ...(frame.flip ? { flip: true } : {}),
        ...(frame.showFace === false ? { showFace: false } : {}),
        layers: frame.layers.map((layer) => planLayerToClipLayer(
          layer,
          `${layer.id}.${name}.${frameIndex}`,
        )),
      })),
    });
    return Object.freeze({
      key: opts.actionKeyPrefix ? `${opts.actionKeyPrefix}:${name}` : `avatar:action:${name}`,
      tag: "ms-action",
      attrs: Object.freeze({ name }),
      data: Object.freeze({ clip }),
      children: Object.freeze([]),
    });
  });

  return Object.freeze({
    key: opts.avatarKey ?? "avatar:player",
    tag: "ms-avatar",
    attrs: Object.freeze({
      action: actionName,
      facing,
      expression: expressions[expressionName] ? expressionName : "default",
      "one-shot-enabled": "true",
      "frame-index": "0",
      "elapsed-ms": "0",
    }),
    data: parentData,
    children: Object.freeze(actionChildren),
  });
}
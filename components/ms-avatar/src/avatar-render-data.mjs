import { AVATAR_RENDER_LIMITS } from "./limits.mjs";
import { validateActionClip } from "./action-clip.mjs";

const AVATAR_CONTENT_VERSION = /^sha256:[0-9a-f]{64}$/;

function measureCompactJson(value, budget) {
  let total = 0;
  const visit = (node) => {
    if (node === null) return (total += 4);
    switch (typeof node) {
      case "boolean": return (total += node ? 4 : 5);
      case "number": return (total += String(node).length);
      case "string": return (total += new TextEncoder().encode(JSON.stringify(node)).length);
      case "object": {
        if (Array.isArray(node)) {
          total += 1;
          for (let i = 0; i < node.length; i += 1) {
            if (i > 0) total += 1;
            visit(node[i]);
            if (total > budget) throw new RangeError("budget exceeded");
          }
          return (total += 1);
        }
        total += 1;
        for (const key of Object.keys(node)) {
          if (Object.keys(node).indexOf(key) > 0) total += 1;
          visit(key);
          total += 1;
          visit(node[key]);
          if (total > budget) throw new RangeError("budget exceeded");
        }
        return (total += 1);
      }
      default: throw new TypeError("unexpected type");
    }
  };
  visit(value);
  return total;
}

function validIdentifier(value) {
  return typeof value === "string" && value.length > 0
    && value.length <= AVATAR_RENDER_LIMITS.maxIdentifierLength;
}

export function validateAvatarRenderData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new TypeError("ms-avatar data must be an object");
  for (const key of Object.keys(data)) {
    if (key !== "appearance" && key !== "sprites" && key !== "expressions") {
      throw new TypeError(`ms-avatar data field ${key} is not allowed`);
    }
  }
  const appearance = data.appearance;
  if (!appearance || typeof appearance !== "object" || Array.isArray(appearance)) {
    throw new TypeError("ms-avatar data.appearance is required");
  }
  const zOrder = appearance.zOrder;
  if (!Array.isArray(zOrder) || zOrder.length === 0) throw new TypeError("appearance.zOrder must be non-empty");
  if (!zOrder.every(validIdentifier)) throw new TypeError("appearance.zOrder entries must be bounded non-empty strings");
  if (new Set(zOrder).size !== zOrder.length) throw new TypeError("appearance.zOrder entries must be unique");
  const sprites = data.sprites;
  if (!sprites || typeof sprites !== "object" || Array.isArray(sprites)) throw new TypeError("sprites is required");
  const pages = sprites.pages;
  const items = sprites.items;
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) throw new TypeError("sprites.pages is required");
  if (!items || typeof items !== "object" || Array.isArray(items)) throw new TypeError("sprites.items is required");
  if (Object.keys(items).length > AVATAR_RENDER_LIMITS.maxSpriteItems) throw new TypeError("sprites.items exceeds budget");
  if (Object.keys(pages).length > AVATAR_RENDER_LIMITS.maxSpritePages) throw new TypeError("sprites.pages exceeds budget");
  for (const [pageId, page] of Object.entries(pages)) {
    if (!validIdentifier(pageId) || !page?.resource
      || !validIdentifier(page.resource.namespace) || !validIdentifier(page.resource.key)) {
      throw new TypeError(`sprites.pages.${pageId}.resource is invalid`);
    }
    if (!AVATAR_CONTENT_VERSION.test(page.resource.contentVersion ?? "")) {
      throw new TypeError(`sprites.pages.${pageId}.resource.contentVersion is invalid`);
    }
    if (!Number.isInteger(page.width) || !Number.isInteger(page.height) || page.width <= 0 || page.height <= 0) {
      throw new TypeError(`sprites.pages.${pageId} dimensions are invalid`);
    }
    if (page.width > AVATAR_RENDER_LIMITS.maxPageWidth
      || page.height > AVATAR_RENDER_LIMITS.maxPageHeight
      || page.width * page.height > AVATAR_RENDER_LIMITS.maxPagePixels) {
      throw new TypeError(`sprites.pages.${pageId} exceeds decoded page budget`);
    }
  }
  for (const [itemId, item] of Object.entries(items)) {
    if (!validIdentifier(itemId) || !validIdentifier(item?.page) || !pages[item.page]) {
      throw new TypeError(`sprites.items.${itemId} references missing page`);
    }
    const source = item.source;
    if (!source || !Number.isInteger(source.x) || !Number.isInteger(source.y) || source.x < 0 || source.y < 0
      || !Number.isInteger(source.w) || !Number.isInteger(source.h) || source.w <= 0 || source.h <= 0) {
      throw new TypeError(`sprites.items.${itemId}.source is invalid`);
    }
    const page = pages[item.page];
    if (source.x + source.w > page.width || source.y + source.h > page.height) {
      throw new TypeError(`sprites.items.${itemId}.source exceeds page bounds`);
    }
  }
  const expressions = data.expressions;
  if (!expressions || typeof expressions !== "object" || Array.isArray(expressions)) throw new TypeError("expressions is required");
  if (!expressions.default) throw new TypeError("expressions.default is required");
  for (const [name, expression] of Object.entries(expressions)) {
    if (!validIdentifier(name)) throw new TypeError("expression names must be bounded non-empty strings");
    if (!Array.isArray(expression.frames) || expression.frames.length === 0) {
      throw new TypeError(`expressions.${name}.frames must be non-empty`);
    }
    if (expression.frames.length > AVATAR_RENDER_LIMITS.maxExpressionFrames) {
      throw new TypeError(`expressions.${name} exceeds frame budget`);
    }
    for (const [frameIndex, frame] of expression.frames.entries()) {
      if (!Number.isInteger(frame.durationMs) || frame.durationMs < 0) {
        throw new TypeError(`expressions.${name}.frames[${frameIndex}].durationMs is invalid`);
      }
      if (!Array.isArray(frame.layers)) throw new TypeError(`expressions.${name}.frames[${frameIndex}].layers must be an array`);
      for (const layer of frame.layers) {
        if (typeof layer.sprite !== "string" || !items[layer.sprite]) {
          throw new TypeError(`expressions layer sprite ${layer.sprite} is missing`);
        }
        if (!zOrder.includes(layer.z)) throw new TypeError(`expression layer z ${layer.z} is not in zOrder`);
      }
    }
  }
  if (measureCompactJson(data, AVATAR_RENDER_LIMITS.maxParentDataBytes) > AVATAR_RENDER_LIMITS.maxParentDataBytes) {
    throw new TypeError("ms-avatar parent data exceeds byte budget");
  }
  return data;
}

export function validateMsActionData(data, zOrder, spriteItems) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new TypeError("ms-action data must be an object");
  if (Object.keys(data).length !== 1 || !data.clip) throw new TypeError("ms-action data must contain only clip");
  const clip = validateActionClip(data.clip);
  if (measureCompactJson(data, AVATAR_RENDER_LIMITS.maxActionDataBytes) > AVATAR_RENDER_LIMITS.maxActionDataBytes) {
    throw new TypeError("ms-action data exceeds byte budget");
  }
  for (const frame of clip.frames) {
    for (const layer of frame.layers) {
      if (!zOrder.includes(layer.z)) throw new TypeError(`clip layer z ${layer.z} is not in parent zOrder`);
      if (!spriteItems[layer.sprite]) throw new TypeError(`clip layer sprite ${layer.sprite} is missing from parent catalog`);
    }
  }
  return data;
}

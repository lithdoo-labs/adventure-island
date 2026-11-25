import {
  FIELD_CANVAS_LIMITS,
  FIELD_INPUT_LIMITS,
  MS_ACTION_TAG,
  MS_AVATAR_TAG,
  FIELD_SCENE_CHILD_TAGS,
} from "./limits.mjs";
import { validateAvatarRenderData, validateMsActionData } from "../../ms-avatar/src/avatar-render-data.mjs";
import { AVATAR_RENDER_LIMITS } from "../../ms-avatar/src/limits.mjs";

const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const RANK = /^[1-9][0-9]*$/;
const MAP_ID = /^(?:0|[1-9][0-9]*)$/;
const CONTENT_VERSION = /^sha256:[0-9a-f]{64}$/;
const SCENE_ATTRS = Object.freeze(["camera-x", "camera-y", "visible"]);
const BATCH_ATTRS = Object.freeze(["stack-rank", "visible"]);
const WORLD_ATTRS = Object.freeze(["stack-rank", "visible", "world-x", "world-y"]);
const BACK_ATTRS = Object.freeze(["stack-rank", "visible", "view-x", "view-y"]);
const MARKER_ATTRS = Object.freeze([]);
const AVATAR_ATTRS = Object.freeze([
  "action",
  "facing",
  "expression",
  "one-shot-enabled",
  "frame-index",
  "elapsed-ms",
]);
const ACTION_ATTRS = Object.freeze(["name"]);

function invalid(code, path, detail) {
  return Object.freeze({ ok: false, code, path, detail });
}

function valid(value) {
  return Object.freeze({ ok: true, value });
}

function plainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function idString(value, path) {
  if (typeof value !== "string" || value.length === 0 || value.length > FIELD_INPUT_LIMITS.maxIdLength) {
    return invalid("INPUT_INVALID", path, "must be a non-empty bounded string");
  }
  if (value === "__proto__" || value === "constructor" || value === "prototype") {
    return invalid("INPUT_INVALID", path, "must not use a reserved key");
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) return invalid("INPUT_INVALID", path, "must not contain control characters");
  return valid(value);
}

function finiteDecimal(value, path) {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    return invalid("INPUT_INVALID", path, "must be a non-exponent finite decimal string");
  }
  const number = Number(value);
  if (!Number.isFinite(number) || Object.is(number, -0) || Math.abs(number) > FIELD_INPUT_LIMITS.maxCoordinate) {
    return invalid("INPUT_INVALID", path, "must be a finite coordinate inside the spike range");
  }
  return valid(number);
}

function visibleValue(value, path) {
  if (value !== "true" && value !== "false") return invalid("INPUT_INVALID", path, "must be true or false");
  return valid(value === "true");
}

function nonNegativeDecimalInteger(value, path, max) {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) {
    return invalid("INPUT_INVALID", path, "must be a canonical decimal integer string");
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > max) {
    return invalid("INPUT_INVALID", path, "must be an in-range safe integer");
  }
  return valid(number);
}

function stackRank(value, path) {
  if (typeof value !== "string" || !RANK.test(value)) {
    return invalid("INPUT_INVALID", path, "must be a canonical positive decimal integer");
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > FIELD_INPUT_LIMITS.stackRankMax) {
    return invalid("INPUT_INVALID", path, "must be inside the CSS integer stack range");
  }
  return valid(number);
}

function exactAttrs(attrs, names) {
  if (!plainObject(attrs)) return invalid("INPUT_INVALID", "attrs", "must be a plain object");
  if (!sameKeys(attrs, names)) return invalid("INPUT_INVALID", "attrs", "must contain exactly the declared attributes");
  for (const name of names) {
    if (typeof attrs[name] !== "string") return invalid("INPUT_INVALID", `attrs.${name}`, "must be a string");
  }
  return valid(attrs);
}

function safeInteger(value, path, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    return invalid("INPUT_INVALID", path, "must be an in-range safe integer");
  }
  return valid(value);
}

function finiteNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value) || Object.is(value, -0) || Math.abs(value) > FIELD_INPUT_LIMITS.maxCoordinate) {
    return invalid("INPUT_INVALID", path, "must be a finite number inside the spike range");
  }
  return valid(value);
}

function resourceSegment(value, hierarchy, path) {
  if (typeof value !== "string" || value.length === 0 || value === "." || value === ".." || value.length > 256) {
    return invalid("INPUT_INVALID", path, "must be a content segment");
  }
  if (/[\\\0]|\p{Cc}|\p{Cs}/u.test(value) || value.startsWith("/") || value.endsWith("/") || value.startsWith("\\\\")) {
    return invalid("INPUT_INVALID", path, "must not be a path or URL");
  }
  if (!hierarchy && value.includes("/")) return invalid("INPUT_INVALID", path, "namespace cannot contain a slash");
  if (/^[A-Za-z]:/.test(value) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
    return invalid("INPUT_INVALID", path, "must not be a URL or drive path");
  }
  if (value.split("/").some((part) => part.length === 0 || part === "." || part === "..")) {
    return invalid("INPUT_INVALID", path, "must not contain empty or relative segments");
  }
  return valid(value);
}

function resourceRef(value, path) {
  if (!plainObject(value) || !sameKeys(value, ["contentVersion", "key", "namespace"])) {
    return invalid("INPUT_INVALID", path, "ResourceRef must contain namespace, key, and contentVersion");
  }
  const namespace = resourceSegment(value.namespace, false, `${path}.namespace`);
  if (!namespace.ok) return namespace;
  const key = resourceSegment(value.key, true, `${path}.key`);
  if (!key.ok) return key;
  if (typeof value.contentVersion !== "string" || !CONTENT_VERSION.test(value.contentVersion)) {
    return invalid("INPUT_INVALID", `${path}.contentVersion`, "must be sha256 and 64 lowercase hex digits");
  }
  return valid({ namespace: namespace.value, key: key.value, contentVersion: value.contentVersion });
}

function sourceRect(value, path) {
  if (!plainObject(value) || !sameKeys(value, ["h", "w", "x", "y"])) {
    return invalid("INPUT_INVALID", path, "source rect must contain x, y, w, h");
  }
  const x = safeInteger(value.x, `${path}.x`, { min: 0 });
  if (!x.ok) return x;
  const y = safeInteger(value.y, `${path}.y`, { min: 0 });
  if (!y.ok) return y;
  const w = safeInteger(value.w, `${path}.w`, { min: 1, max: FIELD_CANVAS_LIMITS.maxCanvasWidth });
  if (!w.ok) return w;
  const h = safeInteger(value.h, `${path}.h`, { min: 1, max: FIELD_CANVAS_LIMITS.maxCanvasHeight });
  if (!h.ok) return h;
  return valid({ x: x.value, y: y.value, w: w.value, h: h.value });
}

export function placementDestRect(placement, item) {
  const [originX, originY] = item.origin;
  const left = placement.flip ? placement.x - (item.source.w - originX) : placement.x - originX;
  const top = placement.y - originY;
  return { x: left, y: top, w: item.source.w, h: item.source.h };
}

function rectInside(bounds, rect) {
  return rect.x >= bounds.x && rect.y >= bounds.y
    && rect.x + rect.w <= bounds.x + bounds.w
    && rect.y + rect.h <= bounds.y + bounds.h;
}

export function validateSceneAttrs(attrs) {
  const exact = exactAttrs(attrs, SCENE_ATTRS);
  if (!exact.ok) return exact;
  const cameraX = finiteDecimal(attrs["camera-x"], "attrs.camera-x");
  if (!cameraX.ok) return cameraX;
  const cameraY = finiteDecimal(attrs["camera-y"], "attrs.camera-y");
  if (!cameraY.ok) return cameraY;
  const visible = visibleValue(attrs.visible, "attrs.visible");
  if (!visible.ok) return visible;
  return valid({ cameraX: cameraX.value, cameraY: cameraY.value, visible: visible.value });
}

export function validateSceneData(data) {
  if (!plainObject(data) || typeof data.mapId !== "string" || data.pixelSnap !== "round") {
    return invalid("INPUT_INVALID", "data", "scene data must contain mapId and pixelSnap");
  }
  if (!MAP_ID.test(data.mapId) || data.mapId.length > FIELD_INPUT_LIMITS.maxMapIdLength) {
    return invalid("INPUT_INVALID", "data.mapId", "must be a canonical decimal id");
  }
  if (data.bounds !== undefined && !plainObject(data.bounds)) {
    return invalid("INPUT_INVALID", "data.bounds", "bounds must be a plain object when present");
  }
  return valid({ mapId: data.mapId, pixelSnap: "round", bounds: data.bounds });
}

export function validateBatchAttrs(attrs) {
  const exact = exactAttrs(attrs, BATCH_ATTRS);
  if (!exact.ok) return exact;
  const rank = stackRank(attrs["stack-rank"], "attrs.stack-rank");
  if (!rank.ok) return rank;
  const visible = visibleValue(attrs.visible, "attrs.visible");
  if (!visible.ok) return visible;
  return valid({ stackRank: rank.value, visible: visible.value });
}

export function validateBatchData(data) {
  if (!plainObject(data)
    || typeof data.batchId !== "string"
    || !plainObject(data.bounds)
    || !plainObject(data.sprites)
    || !Array.isArray(data.placements)) {
    return invalid("INPUT_INVALID", "data", "batch data must contain batchId, bounds, sprites, and placements");
  }
  const batchId = idString(data.batchId, "data.batchId");
  if (!batchId.ok) return batchId;
  if (!plainObject(data.bounds) || !sameKeys(data.bounds, ["h", "w", "x", "y"])) {
    return invalid("INPUT_INVALID", "data.bounds", "bounds must contain x, y, w, h");
  }
  const x = safeInteger(data.bounds.x, "data.bounds.x");
  if (!x.ok) return x;
  const y = safeInteger(data.bounds.y, "data.bounds.y");
  if (!y.ok) return y;
  const w = safeInteger(data.bounds.w, "data.bounds.w", { min: 1 });
  if (!w.ok) return w;
  const h = safeInteger(data.bounds.h, "data.bounds.h", { min: 1 });
  if (!h.ok) return h;
  if (
    w.value > FIELD_CANVAS_LIMITS.maxCanvasWidth
    || h.value > FIELD_CANVAS_LIMITS.maxCanvasHeight
    || w.value * h.value > FIELD_CANVAS_LIMITS.maxCanvasPixels
  ) {
    return invalid("RESOURCE_LIMIT", "data.bounds", "canvas pixel budget exceeded");
  }
  const bounds = { x: x.value, y: y.value, w: w.value, h: h.value };
  if (!plainObject(data.sprites) || !sameKeys(data.sprites, ["items", "pages"])) {
    return invalid("INPUT_INVALID", "data.sprites", "sprites must contain pages and items");
  }
  if (!plainObject(data.sprites.pages) || !plainObject(data.sprites.items) || !Array.isArray(data.placements)) {
    return invalid("INPUT_INVALID", "data.sprites", "pages, items, and placements have the wrong shape");
  }
  const pageNames = Object.keys(data.sprites.pages);
  const itemNames = Object.keys(data.sprites.items);
  if (pageNames.length === 0 || pageNames.length > FIELD_INPUT_LIMITS.maxPages) {
    return invalid("INPUT_INVALID", "data.sprites.pages", "page count is outside the spike budget");
  }
  if (itemNames.length === 0 || itemNames.length > FIELD_INPUT_LIMITS.maxItems) {
    return invalid("INPUT_INVALID", "data.sprites.items", "item count is outside the spike budget");
  }
  if (data.placements.length === 0 || data.placements.length > FIELD_INPUT_LIMITS.maxPlacements) {
    return invalid("INPUT_INVALID", "data.placements", "placement count is outside the spike budget");
  }
  const pages = Object.create(null);
  for (const name of pageNames) {
    const named = idString(name, "data.sprites.pages");
    if (!named.ok) return named;
    const page = data.sprites.pages[name];
    if (!plainObject(page) || !sameKeys(page, ["height", "resource", "width"])) {
      return invalid("INPUT_INVALID", `data.sprites.pages.${name}`, "page must contain resource, width, and height");
    }
    const resource = resourceRef(page.resource, `data.sprites.pages.${name}.resource`);
    if (!resource.ok) return resource;
    const width = safeInteger(page.width, `data.sprites.pages.${name}.width`, { min: 1, max: FIELD_CANVAS_LIMITS.maxCanvasWidth });
    if (!width.ok) return width;
    const height = safeInteger(page.height, `data.sprites.pages.${name}.height`, { min: 1, max: FIELD_CANVAS_LIMITS.maxCanvasHeight });
    if (!height.ok) return height;
    pages[name] = { resource: resource.value, width: width.value, height: height.value };
  }
  const items = Object.create(null);
  for (const name of itemNames) {
    const named = idString(name, "data.sprites.items");
    if (!named.ok) return named;
    const item = data.sprites.items[name];
    if (!plainObject(item) || !sameKeys(item, ["origin", "page", "source"])) {
      return invalid("INPUT_INVALID", `data.sprites.items.${name}`, "item must contain page, source, and origin");
    }
    if (typeof item.page !== "string" || pages[item.page] === undefined) {
      return invalid("INPUT_INVALID", `data.sprites.items.${name}.page`, "page is missing");
    }
    const source = sourceRect(item.source, `data.sprites.items.${name}.source`);
    if (!source.ok) return source;
    const page = pages[item.page];
    if (source.value.x + source.value.w > page.width || source.value.y + source.value.h > page.height) {
      return invalid("INPUT_INVALID", `data.sprites.items.${name}.source`, "source rect leaves the page");
    }
    if (!Array.isArray(item.origin) || item.origin.length !== 2) {
      return invalid("INPUT_INVALID", `data.sprites.items.${name}.origin`, "origin must be a pair");
    }
    const originX = safeInteger(item.origin[0], `data.sprites.items.${name}.origin[0]`);
    if (!originX.ok) return originX;
    const originY = safeInteger(item.origin[1], `data.sprites.items.${name}.origin[1]`);
    if (!originY.ok) return originY;
    items[name] = { page: item.page, source: source.value, origin: [originX.value, originY.value] };
  }
  const placements = [];
  const seenIds = new Set();
  let previous = null;
  for (let index = 0; index < data.placements.length; index += 1) {
    const placement = data.placements[index];
    const path = `data.placements[${index}]`;
    if (!plainObject(placement)
      || typeof placement.placementId !== "string"
      || typeof placement.kind !== "string"
      || typeof placement.sprite !== "string"
      || typeof placement.x !== "number"
      || typeof placement.y !== "number"
      || typeof placement.flip !== "boolean"
      || typeof placement.opacity !== "number"
      || !plainObject(placement.order)) {
      return invalid("INPUT_INVALID", path, "placement fields are not the declared set");
    }
    const placementId = idString(placement.placementId, `${path}.placementId`);
    if (!placementId.ok) return placementId;
    if (seenIds.has(placementId.value)) return invalid("INPUT_INVALID", `${path}.placementId`, "duplicate placement id");
    seenIds.add(placementId.value);
    if (placement.kind !== "tile" && placement.kind !== "obj") {
      return invalid("INPUT_INVALID", `${path}.kind`, "kind must be tile or obj");
    }
    if (typeof placement.sprite !== "string" || items[placement.sprite] === undefined) {
      return invalid("INPUT_INVALID", `${path}.sprite`, "sprite is missing");
    }
    const px = finiteNumber(placement.x, `${path}.x`);
    if (!px.ok) return px;
    const py = finiteNumber(placement.y, `${path}.y`);
    if (!py.ok) return py;
    if (typeof placement.flip !== "boolean") return invalid("INPUT_INVALID", `${path}.flip`, "flip must be boolean");
    const opacity = safeInteger(placement.opacity, `${path}.opacity`, { min: 0, max: 255 });
    if (!opacity.ok) return opacity;
    if (!plainObject(placement.order) || !sameKeys(placement.order, ["depth", "tieOrder"])) {
      return invalid("INPUT_INVALID", `${path}.order`, "order must contain depth and tieOrder");
    }
    const depth = safeInteger(placement.order.depth, `${path}.order.depth`);
    if (!depth.ok) return depth;
    const tieRaw = placement.order.tieOrder;
    const tieOrder = typeof tieRaw === "number"
      ? safeInteger(tieRaw, `${path}.order.tieOrder`)
      : (typeof tieRaw === "string" && /^-?(?:0|[1-9][0-9]*)$/.test(tieRaw)
        ? valid(Number(tieRaw))
        : invalid("INPUT_INVALID", `${path}.order.tieOrder`, "tieOrder must be an integer or decimal string"));
    if (!tieOrder.ok) return tieOrder;
    if (previous !== null) {
      const increasing = depth.value > previous.depth || (depth.value === previous.depth && tieOrder.value > previous.tieOrder);
      if (!increasing) return invalid("DEPTH_PLAN_INVALID", `${path}.order`, "placements must be strictly ordered");
    }
    previous = { depth: depth.value, tieOrder: tieOrder.value };
    const normalized = {
      placementId: placementId.value,
      kind: placement.kind,
      sprite: placement.sprite,
      x: px.value,
      y: py.value,
      flip: placement.flip,
      opacity: opacity.value,
      order: { depth: depth.value, tieOrder: tieOrder.value },
    };
    const dest = placementDestRect(normalized, items[placement.sprite]);
    if (!rectInside(bounds, dest)) return invalid("INPUT_INVALID", path, "placement draws outside batch bounds");
    placements.push(normalized);
  }
  return valid({ batchId: batchId.value, bounds, pages, items, placements });
}

export function validateWorldAttrs(attrs) {
  const exact = exactAttrs(attrs, WORLD_ATTRS);
  if (!exact.ok) return exact;
  const worldX = finiteDecimal(attrs["world-x"], "attrs.world-x");
  if (!worldX.ok) return worldX;
  const worldY = finiteDecimal(attrs["world-y"], "attrs.world-y");
  if (!worldY.ok) return worldY;
  const rank = stackRank(attrs["stack-rank"], "attrs.stack-rank");
  if (!rank.ok) return rank;
  const visible = visibleValue(attrs.visible, "attrs.visible");
  if (!visible.ok) return visible;
  return valid({ worldX: worldX.value, worldY: worldY.value, stackRank: rank.value, visible: visible.value });
}

export function validateWorldData(data) {
  if (!plainObject(data) || typeof data.actorVisualId !== "string" || data.anchor !== "feet") {
    return invalid("INPUT_INVALID", "data", "world item data must contain actorVisualId and anchor");
  }
  const actorVisualId = idString(data.actorVisualId, "data.actorVisualId");
  if (!actorVisualId.ok) return actorVisualId;
  return valid({ actorVisualId: actorVisualId.value, anchor: "feet" });
}

export function validateMarkerAttrs(attrs) {
  return exactAttrs(attrs, MARKER_ATTRS);
}

export function validateBackAttrs(attrs) {
  const exact = exactAttrs(attrs, BACK_ATTRS);
  if (!exact.ok) return exact;
  const stack = stackRank(exact.value["stack-rank"], "attrs.stack-rank");
  if (!stack.ok) return stack;
  const visible = visibleValue(exact.value.visible, "attrs.visible");
  if (!visible.ok) return visible;
  const viewX = finiteDecimal(exact.value["view-x"], "attrs.view-x");
  if (!viewX.ok) return viewX;
  const viewY = finiteDecimal(exact.value["view-y"], "attrs.view-y");
  if (!viewY.ok) return viewY;
  return valid({
    stackRank: stack.value,
    visible: visible.value,
    viewX: viewX.value,
    viewY: viewY.value,
  });
}

function validatedImageRegion(image, path) {
  if (!plainObject(image) || !sameKeys(image, ["pageHeight", "pageWidth", "resource", "source"])) {
    return invalid("INPUT_INVALID", path, "image must contain resource, pageWidth, pageHeight, and source");
  }
  const resource = resourceRef(image.resource, `${path}.resource`);
  if (!resource.ok) return resource;
  const pageW = safeInteger(image.pageWidth, `${path}.pageWidth`, { min: 1, max: FIELD_CANVAS_LIMITS.maxCanvasWidth });
  if (!pageW.ok) return pageW;
  const pageH = safeInteger(image.pageHeight, `${path}.pageHeight`, { min: 1, max: FIELD_CANVAS_LIMITS.maxCanvasHeight });
  if (!pageH.ok) return pageH;
  const source = sourceRect(image.source, `${path}.source`);
  if (!source.ok) return source;
  if (source.value.x + source.value.w > pageW.value || source.value.y + source.value.h > pageH.value) {
    return invalid("INPUT_INVALID", `${path}.source`, "source rect leaves the page");
  }
  if (source.value.w * source.value.h > FIELD_CANVAS_LIMITS.maxCanvasPixels) {
    return invalid("RESOURCE_LIMIT", path, "standalone paint pixel budget exceeded");
  }
  return valid({
    resource: resource.value,
    pageWidth: pageW.value,
    pageHeight: pageH.value,
    source: source.value,
  });
}

function imageRegion(data, path) {
  if (!plainObject(data) || !plainObject(data.image)) {
    return invalid("INPUT_INVALID", `${path}.image`, "image must be present");
  }
  const parsed = validatedImageRegion(data.image, `${path}.image`);
  if (!parsed.ok) return parsed;
  if (parsed.value.pageWidth * parsed.value.pageHeight > FIELD_CANVAS_LIMITS.maxCanvasPixels) {
    return invalid("RESOURCE_LIMIT", `${path}.image`, "back pixel budget exceeded");
  }
  return valid({
    resource: parsed.value.resource,
    pageWidth: parsed.value.pageWidth,
    pageHeight: parsed.value.pageHeight,
  });
}

function validateDrawHints(draw, path) {
  if (!plainObject(draw) || !sameKeys(draw, ["flip", "opacity", "origin"])) {
    return invalid("INPUT_INVALID", path, "draw must contain origin, flip, and opacity");
  }
  if (!Array.isArray(draw.origin) || draw.origin.length !== 2) {
    return invalid("INPUT_INVALID", `${path}.origin`, "origin must be a pair");
  }
  const originX = safeInteger(draw.origin[0], `${path}.origin[0]`);
  if (!originX.ok) return originX;
  const originY = safeInteger(draw.origin[1], `${path}.origin[1]`);
  if (!originY.ok) return originY;
  if (typeof draw.flip !== "boolean") return invalid("INPUT_INVALID", `${path}.flip`, "flip must be boolean");
  const opacity = safeInteger(draw.opacity, `${path}.opacity`, { min: 0, max: 255 });
  if (!opacity.ok) return opacity;
  return valid({ origin: [originX.value, originY.value], flip: draw.flip, opacity: opacity.value });
}

const HIDDEN_PORTAL_CLIPS = Object.freeze(["portalStart", "portalContinue", "portalExit"]);

function validatePortalFrameList(frames, path, { min, max }) {
  if (!Array.isArray(frames) || frames.length < min || frames.length > max) {
    return invalid("INPUT_INVALID", path, "portal frame count is outside the field budget");
  }
  const validated = [];
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const framePath = `${path}[${index}]`;
    if (!plainObject(frame) || !plainObject(frame.image) || !plainObject(frame.draw)) {
      return invalid("INPUT_INVALID", framePath, "frame must contain image and draw");
    }
    const image = validatedImageRegion(frame.image, `${framePath}.image`);
    if (!image.ok) return image;
    const draw = validateDrawHints(frame.draw, `${framePath}.draw`);
    if (!draw.ok) return draw;
    const frameNo = safeInteger(frame.frame ?? index, `${framePath}.frame`, { min: 0 });
    if (!frameNo.ok) return frameNo;
    const delay = safeInteger(frame.delay ?? 0, `${framePath}.delay`, { min: 0 });
    if (!delay.ok) return delay;
    validated.push(Object.freeze({
      frame: frameNo.value,
      delay: delay.value,
      image: image.value,
      draw: draw.value,
    }));
  }
  return valid(validated);
}

function validatePortalLoopData(data) {
  return validatePortalFrameList(data.frames, "data.frames", {
    min: 2,
    max: FIELD_INPUT_LIMITS.maxObjectFrames,
  });
}

function validatePortalSequenceData(data) {
  if (!plainObject(data.clips) || !sameKeys(data.clips, HIDDEN_PORTAL_CLIPS)) {
    return invalid("INPUT_INVALID", "data.clips", "hidden portal clips must be portalStart, portalContinue, and portalExit");
  }
  const clips = {};
  let count = 0;
  for (const name of HIDDEN_PORTAL_CLIPS) {
    const frames = validatePortalFrameList(data.clips[name], `data.clips.${name}`, {
      min: 1,
      max: FIELD_INPUT_LIMITS.maxObjectFrames,
    });
    if (!frames.ok) return frames;
    clips[name] = frames.value;
    count += frames.value.length;
  }
  const flat = validatePortalFrameList(data.frames, "data.frames", {
    min: count,
    max: count,
  });
  if (!flat.ok) return flat;
  return valid({
    clips: Object.freeze(clips),
    frames: flat.value,
  });
}

export function validatePortalVisualData(data) {
  if (!plainObject(data) || typeof data.visualId !== "string" || (data.phase !== "static" && data.phase !== "loop" && data.phase !== "sequence")) {
    return invalid("INPUT_INVALID", "data", "portal data must contain visualId and phase");
  }
  if (data.phase === "sequence") {
    const visualId = idString(data.visualId, "data.visualId");
    if (!visualId.ok) return visualId;
    const sequence = validatePortalSequenceData(data);
    if (!sequence.ok) return sequence;
    if (!plainObject(data.provenance) || !Number.isFinite(data.provenance.sortKey)) {
      return invalid("INPUT_INVALID", "data.provenance.sortKey", "portal provenance sortKey must be finite");
    }
    return valid({
      visualId: visualId.value,
      phase: "sequence",
      clips: sequence.value.clips,
      frames: sequence.value.frames,
      sortKey: data.provenance.sortKey,
    });
  }
  if (data.phase === "loop") {
    const visualId = idString(data.visualId, "data.visualId");
    if (!visualId.ok) return visualId;
    const frames = validatePortalLoopData(data);
    if (!frames.ok) return frames;
    if (!plainObject(data.provenance) || !Number.isFinite(data.provenance.sortKey)) {
      return invalid("INPUT_INVALID", "data.provenance.sortKey", "portal provenance sortKey must be finite");
    }
    return valid({
      visualId: visualId.value,
      phase: "loop",
      frames: frames.value,
      sortKey: data.provenance.sortKey,
    });
  }
  if (!plainObject(data.image)) {
    return invalid("INPUT_INVALID", "data", "portal data must contain visualId, phase, image, and draw");
  }
  const visualId = idString(data.visualId, "data.visualId");
  if (!visualId.ok) return visualId;
  const image = validatedImageRegion(data.image, "data.image");
  if (!image.ok) return image;
  const draw = validateDrawHints(data.draw, "data.draw");
  if (!draw.ok) return draw;
  if (!plainObject(data.provenance) || !Number.isFinite(data.provenance.sortKey)) {
    return invalid("INPUT_INVALID", "data.provenance.sortKey", "portal provenance sortKey must be finite");
  }
  return valid({
    visualId: visualId.value,
    phase: "static",
    image: image.value,
    draw: draw.value,
    sortKey: data.provenance.sortKey,
  });
}

export function validateMapObjectData(data) {
  if (!plainObject(data) || typeof data.placementId !== "string" || data.mode !== "local-animation" || !Array.isArray(data.frames)) {
    return invalid("INPUT_INVALID", "data", "map object data must contain placementId, mode, frames");
  }
  if (data.frames.length < 1 || data.frames.length > FIELD_INPUT_LIMITS.maxObjectFrames) {
    return invalid("INPUT_INVALID", "data.frames", "map object frame count is outside the field budget");
  }
  const placementId = idString(data.placementId, "data.placementId");
  if (!placementId.ok) return placementId;
  const frames = [];
  for (let index = 0; index < data.frames.length; index += 1) {
    const frame = data.frames[index];
    const path = `data.frames[${index}]`;
    if (!plainObject(frame) || !plainObject(frame.image) || !plainObject(frame.draw)) {
      return invalid("INPUT_INVALID", path, "frame must contain image and draw");
    }
    const image = validatedImageRegion(frame.image, `${path}.image`);
    if (!image.ok) return image;
    const draw = validateDrawHints(frame.draw, `${path}.draw`);
    if (!draw.ok) return draw;
    const frameNo = safeInteger(frame.frame ?? index, `${path}.frame`, { min: 0 });
    if (!frameNo.ok) return frameNo;
    const delay = safeInteger(frame.delay ?? 0, `${path}.delay`, { min: 0 });
    if (!delay.ok) return delay;
    frames.push(Object.freeze({
      frame: frameNo.value,
      delay: delay.value,
      image: image.value,
      draw: draw.value,
    }));
  }
  if (!plainObject(data.provenance) || !Number.isFinite(data.provenance.sortKey)) {
    return invalid("INPUT_INVALID", "data.provenance.sortKey", "map object provenance sortKey must be finite");
  }
  const layout = validateMapObjectLayout(data.layout, "data.layout");
  if (!layout.ok) return layout;
  let source = null;
  if (data.source !== undefined && data.source !== null) {
    if (!plainObject(data.source) || !sameKeys(data.source, ["cx", "cy", "flow", "rx"])) {
      return invalid("INPUT_INVALID", "data.source", "map object source must be a plain object");
    }
    const flow = safeInteger(data.source.flow, "data.source.flow", { min: 1, max: 1 });
    if (!flow.ok) return flow;
    const rx = finiteNumber(data.source.rx, "data.source.rx");
    if (!rx.ok || rx.value === 0) {
      return invalid("INPUT_INVALID", "data.source.rx", "flow rx must be finite and non-zero");
    }
    const cx = safeInteger(data.source.cx, "data.source.cx");
    if (!cx.ok) return cx;
    const cy = safeInteger(data.source.cy, "data.source.cy");
    if (!cy.ok) return cy;
    source = Object.freeze({
      flow: flow.value,
      rx: rx.value,
      cx: cx.value,
      cy: cy.value,
    });
  }
  return valid({
    placementId: placementId.value,
    mode: "local-animation",
    frames,
    layout: layout.value,
    source,
    sortKey: data.provenance.sortKey,
  });
}

function validateMapObjectLayout(layout, path = "data.layout") {
  if (layout === undefined || layout === null) return valid(null);
  if (!plainObject(layout)) return invalid("INPUT_INVALID", path, "layout must be a plain object");
  const anchorKeys = ["anchorOffsetX", "anchorOffsetY"];
  if (!anchorKeys.every((key) => Object.prototype.hasOwnProperty.call(layout, key))) {
    return invalid("INPUT_INVALID", path, "Obj flow layout must contain both anchor offsets");
  }
  const base = {};
  for (const [key, value] of Object.entries(layout)) {
    if (!anchorKeys.includes(key)) base[key] = value;
  }
  const validated = validateBackLayout(base, path);
  if (!validated.ok) return validated;
  const anchorOffsetX = finiteNumber(layout.anchorOffsetX, `${path}.anchorOffsetX`);
  if (!anchorOffsetX.ok) return anchorOffsetX;
  const anchorOffsetY = finiteNumber(layout.anchorOffsetY, `${path}.anchorOffsetY`);
  if (!anchorOffsetY.ok) return anchorOffsetY;
  return valid(Object.freeze({
    ...validated.value,
    anchorOffsetX: anchorOffsetX.value,
    anchorOffsetY: anchorOffsetY.value,
  }));
}

function validateBackLayout(layout, path = "data.layout") {
  if (layout === undefined || layout === null) return valid(null);
  if (!plainObject(layout)) return invalid("INPUT_INVALID", path, "layout must be a plain object");
  const keys = [
    "canvasHeight", "canvasWidth", "frameHeight", "frameWidth", "kind",
    "parallaxRx", "parallaxRy", "pinToViewportX", "pinToViewportY", "scroll", "tileHorizontal",
    "viewportHeight", "viewportWidth",
    "tileOriginX", "tileOriginY", "tileStepX", "tileStepY", "tileVertical",
    "worldLeft", "worldTop",
  ];
  if (!sameKeys(layout, keys)) {
    return invalid("INPUT_INVALID", path, "layout fields must match the candidate Back layout schema");
  }
  const kinds = new Set([
    "static-type0", "tile-horizontal", "tile-vertical", "tile-both", "scroll-horizontal",
    "flow-horizontal", "flow-vertical",
  ]);
  if (!kinds.has(layout.kind)) {
    return invalid("INPUT_INVALID", `${path}.kind`, "layout.kind is not supported");
  }
  for (const key of ["worldLeft", "worldTop", "tileOriginX", "tileOriginY"]) {
    if (!Number.isFinite(layout[key]) || Math.abs(layout[key]) > FIELD_INPUT_LIMITS.maxCoordinate) {
      return invalid("INPUT_INVALID", `${path}.${key}`, `${key} must be a bounded finite coordinate`);
    }
  }
  for (const key of ["canvasWidth", "frameWidth", "tileStepX"]) {
    const number = safeInteger(layout[key], `${path}.${key}`, {
      min: key === "tileStepX" ? 0 : 1,
      max: FIELD_CANVAS_LIMITS.maxCanvasWidth,
    });
    if (!number.ok) return number;
  }
  for (const key of ["canvasHeight", "frameHeight", "tileStepY"]) {
    const number = safeInteger(layout[key], `${path}.${key}`, {
      min: key === "tileStepY" ? 0 : 1,
      max: FIELD_CANVAS_LIMITS.maxCanvasHeight,
    });
    if (!number.ok) return number;
  }
  if (layout.canvasWidth * layout.canvasHeight > FIELD_CANVAS_LIMITS.maxCanvasPixels) {
    return invalid("RESOURCE_LIMIT", path, "layout Canvas exceeds the local pixel budget");
  }
  for (const key of ["parallaxRx", "parallaxRy"]) {
    if (layout[key] !== null) {
      const rate = safeInteger(layout[key], `${path}.${key}`, {
        min: -FIELD_INPUT_LIMITS.maxCoordinate,
        max: FIELD_INPUT_LIMITS.maxCoordinate,
      });
      if (!rate.ok) return rate;
    }
  }
  const viewportWidth = safeInteger(layout.viewportWidth, `${path}.viewportWidth`, {
    min: 1,
    max: FIELD_CANVAS_LIMITS.maxCanvasWidth,
  });
  if (!viewportWidth.ok) return viewportWidth;
  const viewportHeight = safeInteger(layout.viewportHeight, `${path}.viewportHeight`, {
    min: layout.parallaxRy === null ? 0 : 1,
    max: FIELD_CANVAS_LIMITS.maxCanvasHeight,
  });
  if (!viewportHeight.ok) return viewportHeight;
  for (const key of ["pinToViewportX", "pinToViewportY", "tileHorizontal", "tileVertical"]) {
    if (typeof layout[key] !== "boolean") {
      return invalid("INPUT_INVALID", `${path}.${key}`, `${key} must be boolean`);
    }
  }
  if (layout.tileHorizontal !== (layout.tileStepX > 0)
    || layout.tileVertical !== (layout.tileStepY > 0)
    || layout.pinToViewportX !== layout.tileHorizontal
    || layout.pinToViewportY !== layout.tileVertical) {
    return invalid("INPUT_INVALID", path, "repeat, pin, and non-zero step flags must agree");
  }
  if (layout.scroll !== null) {
    if (!plainObject(layout.scroll) || !sameKeys(layout.scroll, ["pixelsPerMs"])
      || !Number.isFinite(layout.scroll.pixelsPerMs)
      || layout.scroll.pixelsPerMs === 0
      || Math.abs(layout.scroll.pixelsPerMs) > 1) {
      return invalid("INPUT_INVALID", `${path}.scroll`, "scroll must be null or a bounded non-zero pixelsPerMs value");
    }
  }
  return valid(layout);
}

export function validateBackData(data) {
  if (!plainObject(data)) return invalid("INPUT_INVALID", "data", "back data must be a plain object");
  const placementId = idString(data.placementId, "data.placementId");
  if (!placementId.ok) return placementId;
  const layout = validateBackLayout(data.layout);
  if (!layout.ok) return layout;
  if (!plainObject(data.provenance) || !Number.isFinite(data.provenance.sortKey)) {
    return invalid("INPUT_INVALID", "data.provenance.sortKey", "back provenance sortKey must be finite");
  }
  const sortKey = data.provenance.sortKey;
  if (data.mode === "local-animation") {
    if (!Array.isArray(data.frames)) {
      return invalid("INPUT_INVALID", "data.frames", "animated back data must carry frames");
    }
    if (data.frames.length < 2 || data.frames.length > FIELD_INPUT_LIMITS.maxObjectFrames) {
      return invalid("INPUT_INVALID", "data.frames", "animated back frame count is outside the field budget");
    }
    if (data.image !== undefined || data.draw !== undefined) {
      return invalid("INPUT_INVALID", "data", "animated back data must not mix top-level image/draw with frames");
    }
    const frames = [];
    for (let index = 0; index < data.frames.length; index += 1) {
      const frame = data.frames[index];
      const path = `data.frames[${index}]`;
      if (!plainObject(frame) || !plainObject(frame.image) || !plainObject(frame.draw)) {
        return invalid("INPUT_INVALID", path, "frame must contain image and draw");
      }
      const image = validatedImageRegion(frame.image, `${path}.image`);
      if (!image.ok) return image;
      const draw = validateDrawHints(frame.draw, `${path}.draw`);
      if (!draw.ok) return draw;
      const frameNo = safeInteger(frame.frame ?? index, `${path}.frame`, { min: 0 });
      if (!frameNo.ok) return frameNo;
      let delay = null;
      if (frame.delay !== null && frame.delay !== undefined) {
        const checkedDelay = safeInteger(frame.delay, `${path}.delay`, { min: 0 });
        if (!checkedDelay.ok) return checkedDelay;
        delay = checkedDelay.value;
      }
      if (!Array.isArray(frame.offset) || frame.offset.length !== 2) {
        return invalid("INPUT_INVALID", `${path}.offset`, "animated Back frame offset must be a two-item array");
      }
      const offsetX = safeInteger(frame.offset[0], `${path}.offset[0]`, { min: 0, max: FIELD_CANVAS_LIMITS.maxCanvasWidth });
      if (!offsetX.ok) return offsetX;
      const offsetY = safeInteger(frame.offset[1], `${path}.offset[1]`, { min: 0, max: FIELD_CANVAS_LIMITS.maxCanvasHeight });
      if (!offsetY.ok) return offsetY;
      frames.push(Object.freeze({
        frame: frameNo.value,
        delay,
        image: image.value,
        offset: Object.freeze([offsetX.value, offsetY.value]),
        draw: draw.value,
      }));
      if (index > 0 && frames[index - 1].frame >= frameNo.value) {
        return invalid("INPUT_INVALID", `${path}.frame`, "animated Back frames must be strictly ordered");
      }
    }
    if (!layout.value) {
      return invalid("INPUT_INVALID", "data.layout", "animated Back requires a stable local animation surface");
    }
    for (let index = 0; index < frames.length; index += 1) {
      const item = frames[index];
      if (item.offset[0] + item.image.pageWidth > layout.value.frameWidth
        || item.offset[1] + item.image.pageHeight > layout.value.frameHeight) {
        return invalid("INPUT_INVALID", `data.frames[${index}].offset`, "animated Back frame must fit its stable local surface");
      }
    }
    return valid(Object.freeze({
      placementId: placementId.value,
      mode: "local-animation",
      frames,
      layout: layout.value,
      sortKey,
    }));
  }
  if (data.frames !== undefined || data.mode !== undefined) {
    return invalid("INPUT_INVALID", "data", "static back data must not declare animation mode or frames");
  }
  const image = imageRegion(data, "data");
  if (!image.ok) return image;
  const draw = validateDrawHints(data.draw, "data.draw");
  if (!draw.ok) return draw;
  if (layout.value && (layout.value.frameWidth !== image.value.pageWidth
    || layout.value.frameHeight !== image.value.pageHeight)) {
    return invalid("INPUT_INVALID", "data.layout", "layout frame dimensions must match the declared resource page");
  }
  return valid({ placementId: placementId.value, image: image.value, draw: draw.value, layout: layout.value, sortKey });
}

export function validateAvatarAttrs(attrs) {
  if (!plainObject(attrs) || !sameKeys(attrs, AVATAR_ATTRS)) {
    return invalid("INPUT_INVALID", "attrs", "ms-avatar attrs must include action, facing, expression, clock, and one-shot-enabled");
  }
  if (typeof attrs.action !== "string" || attrs.action.length === 0) {
    return invalid("INPUT_INVALID", "attrs.action", "action must be non-empty");
  }
  if (attrs.facing !== "left" && attrs.facing !== "right") {
    return invalid("INPUT_INVALID", "attrs.facing", "facing must be left or right");
  }
  if (typeof attrs.expression !== "string" || attrs.expression.length === 0) {
    return invalid("INPUT_INVALID", "attrs.expression", "expression must be non-empty");
  }
  if (attrs["one-shot-enabled"] !== "true" && attrs["one-shot-enabled"] !== "false") {
    return invalid("INPUT_INVALID", "attrs.one-shot-enabled", "one-shot-enabled must be true or false");
  }
  const frameIndex = nonNegativeDecimalInteger(attrs["frame-index"], "attrs.frame-index", 1_000_000);
  if (!frameIndex.ok) return frameIndex;
  const elapsedMs = nonNegativeDecimalInteger(attrs["elapsed-ms"], "attrs.elapsed-ms", 86_400_000);
  if (!elapsedMs.ok) return elapsedMs;
  return valid({ ...attrs });
}

export function validateAvatarData(data) {
  try {
    return valid(validateAvatarRenderData(data));
  } catch (cause) {
    return invalid("APPEARANCE_INVALID", "data", cause instanceof Error ? cause.message : String(cause));
  }
}

export function validateMarkerData(data) {
  if (!plainObject(data) || !sameKeys(data, ["color", "height", "localX", "localY", "markerId", "width"])) {
    return invalid("INPUT_INVALID", "data", "marker data must contain markerId, width, height, color, localX, and localY");
  }
  const markerId = idString(data.markerId, "data.markerId");
  if (!markerId.ok) return markerId;
  const width = safeInteger(data.width, "data.width", { min: 1, max: FIELD_CANVAS_LIMITS.maxCanvasWidth });
  if (!width.ok) return width;
  const height = safeInteger(data.height, "data.height", { min: 1, max: FIELD_CANVAS_LIMITS.maxCanvasHeight });
  if (!height.ok) return height;
  if (width.value * height.value > FIELD_CANVAS_LIMITS.maxCanvasPixels) {
    return invalid("RESOURCE_LIMIT", "data", "marker pixel budget exceeded");
  }
  if (!plainObject(data.color) || !sameKeys(data.color, ["a", "b", "g", "r"])) {
    return invalid("INPUT_INVALID", "data.color", "color must contain r, g, b, a");
  }
  const channels = ["r", "g", "b", "a"];
  const color = {};
  for (const channel of channels) {
    const parsed = safeInteger(data.color[channel], `data.color.${channel}`, { min: 0, max: 255 });
    if (!parsed.ok) return parsed;
    color[channel] = parsed.value;
  }
  const localX = safeInteger(data.localX, "data.localX");
  if (!localX.ok) return localX;
  const localY = safeInteger(data.localY, "data.localY");
  if (!localY.ok) return localY;
  return valid({
    markerId: markerId.value,
    width: width.value,
    height: height.value,
    color,
    localX: localX.value,
    localY: localY.value,
  });
}

function nodeShape(node) {
  if (!plainObject(node) || !sameKeys(node, ["attrs", "children", "data", "key", "tag"])) {
    return invalid("INPUT_INVALID", "node", "RenderNode must contain key, tag, attrs, data, and children");
  }
  const key = idString(node.key, "key");
  if (!key.ok) return key;
  if (typeof node.tag !== "string") return invalid("INPUT_INVALID", "tag", "tag must be a string");
  if (!Array.isArray(node.children)) return invalid("INPUT_INVALID", "children", "children must be an array");
  return valid(node);
}

function validatePaintUnitChild(child, { keys, ranks, placements, actors }) {
  if (child.tag === "ms-map-back") {
    const attrs = validateBackAttrs(child.attrs);
    if (!attrs.ok) return attrs;
    const data = validateBackData(child.data);
    if (!data.ok) return data;
    if (child.children.length !== 0) return invalid("INPUT_INVALID", "children", "back children must be empty");
    if (ranks.has(attrs.value.stackRank)) return invalid("DEPTH_PLAN_INVALID", "attrs.stack-rank", "stack-rank must be unique");
    ranks.add(attrs.value.stackRank);
    return valid(null);
  }
  if (child.tag === "ms-map-batch") {
    const attrs = validateBatchAttrs(child.attrs);
    if (!attrs.ok) return attrs;
    const data = validateBatchData(child.data);
    if (!data.ok) return data;
    if (child.children.length !== 0) return invalid("INPUT_INVALID", "children", "batch children must be empty");
    if (ranks.has(attrs.value.stackRank)) return invalid("DEPTH_PLAN_INVALID", "attrs.stack-rank", "stack-rank must be unique");
    ranks.add(attrs.value.stackRank);
    for (const placement of data.value.placements) {
      if (placements.has(placement.placementId)) return invalid("INPUT_INVALID", "placementId", "placement belongs to more than one batch");
      placements.add(placement.placementId);
    }
    return valid(null);
  }
  if (child.tag === "ms-map-object") {
    const attrs = validateWorldAttrs(child.attrs);
    if (!attrs.ok) return attrs;
    const data = validateMapObjectData(child.data);
    if (!data.ok) return data;
    if (child.children.length !== 0) return invalid("INPUT_INVALID", "children", "standalone paint unit children must be empty");
    if (ranks.has(attrs.value.stackRank)) return invalid("DEPTH_PLAN_INVALID", "attrs.stack-rank", "stack-rank must be unique");
    ranks.add(attrs.value.stackRank);
    return valid(null);
  }
  if (child.tag === "ms-portal-visual") {
    const attrs = validateWorldAttrs(child.attrs);
    if (!attrs.ok) return attrs;
    const data = validatePortalVisualData(child.data);
    if (!data.ok) return data;
    if (child.children.length !== 0) return invalid("INPUT_INVALID", "children", "standalone paint unit children must be empty");
    if (ranks.has(attrs.value.stackRank)) return invalid("DEPTH_PLAN_INVALID", "attrs.stack-rank", "stack-rank must be unique");
    ranks.add(attrs.value.stackRank);
    return valid(null);
  }
  if (child.tag === "ms-world-item") {
    const attrs = validateWorldAttrs(child.attrs);
    if (!attrs.ok) return attrs;
    const data = validateWorldData(child.data);
    if (!data.ok) return data;
    if (ranks.has(attrs.value.stackRank)) return invalid("DEPTH_PLAN_INVALID", "attrs.stack-rank", "stack-rank must be unique");
    ranks.add(attrs.value.stackRank);
    if (actors.has(data.value.actorVisualId)) return invalid("INPUT_INVALID", "data.actorVisualId", "duplicate actor presentation id");
    actors.add(data.value.actorVisualId);
    if (child.children.length !== 1) return invalid("INPUT_INVALID", "children", "world item must contain exactly one ms-avatar");
    const avatar = child.children[0];
    const avatarShape = nodeShape(avatar);
    if (!avatarShape.ok) return avatarShape;
    if (avatar.tag !== MS_AVATAR_TAG) return invalid("INPUT_INVALID", "tag", "ms-avatar child is required");
    if (keys.has(avatar.key)) return invalid("INPUT_INVALID", "key", "duplicate render key");
    keys.add(avatar.key);
    const avatarAttrs = validateAvatarAttrs(avatar.attrs);
    if (!avatarAttrs.ok) return avatarAttrs;
    const avatarData = validateAvatarData(avatar.data);
    if (!avatarData.ok) return avatarData;
    if (avatar.children.length === 0 || avatar.children.length > AVATAR_RENDER_LIMITS.maxActionChildren) {
      return invalid("RESOURCE_LIMIT", "children", "ms-avatar action child count is outside the budget");
    }
    const actionNames = new Set();
    for (const actionNode of avatar.children) {
      const actionShape = nodeShape(actionNode);
      if (!actionShape.ok) return actionShape;
      if (actionNode.tag !== MS_ACTION_TAG) return invalid("INPUT_INVALID", "tag", "ms-avatar children must be ms-action");
      if (keys.has(actionNode.key)) return invalid("INPUT_INVALID", "key", "duplicate render key");
      keys.add(actionNode.key);
      if (!sameKeys(actionNode.attrs, ACTION_ATTRS)) return invalid("INPUT_INVALID", "attrs", "ms-action attrs must contain name");
      if (typeof actionNode.attrs.name !== "string" || actionNode.attrs.name.length === 0
        || actionNode.attrs.name.length > AVATAR_RENDER_LIMITS.maxIdentifierLength) {
        return invalid("INPUT_INVALID", "attrs.name", "ms-action name must be a bounded non-empty string");
      }
      if (actionNames.has(actionNode.attrs.name)) return invalid("DUPLICATE_ACTION", "attrs.name", "duplicate action name");
      actionNames.add(actionNode.attrs.name);
      try {
        validateMsActionData(actionNode.data, avatarData.value.appearance.zOrder, avatarData.value.sprites.items);
      } catch (cause) {
        return invalid("ACTION_INVALID", "data.clip", cause instanceof Error ? cause.message : String(cause));
      }
      if (actionNode.children.length !== 0) return invalid("INPUT_INVALID", "children", "ms-action children must be empty");
    }
    if (!actionNames.has(avatarAttrs.value.action)) {
      return invalid("ACTION_MISSING", "attrs.action", "retained action must name a child clip");
    }
    const activeAction = avatar.children.find((node) => node.attrs.name === avatarAttrs.value.action);
    if (avatarAttrs.value["frame-index"] >= activeAction.data.clip.frames.length) {
      return invalid("INPUT_INVALID", "attrs.frame-index", "frame-index exceeds the retained action clip");
    }
    return valid(null);
  }
  return invalid("UNSUPPORTED_CAPABILITY", "tag", "child tag is outside the M3 field");
}

export function validateFieldTree(node) {
  const root = nodeShape(node);
  if (!root.ok) return root;
  if (node.tag !== "ms-scene-view") return invalid("INPUT_INVALID", "tag", "field root must be ms-scene-view");
  const sceneAttrs = validateSceneAttrs(node.attrs);
  if (!sceneAttrs.ok) return sceneAttrs;
  const sceneData = validateSceneData(node.data);
  if (!sceneData.ok) return sceneData;
  const ranks = new Set();
  const keys = new Set([node.key]);
  const actors = new Set();
  const placements = new Set();
  for (const child of node.children) {
    const shape = nodeShape(child);
    if (!shape.ok) return shape;
    if (keys.has(child.key)) return invalid("INPUT_INVALID", "key", "duplicate render key");
    keys.add(child.key);
    if (!FIELD_SCENE_CHILD_TAGS.includes(child.tag)) {
      return invalid("UNSUPPORTED_CAPABILITY", "tag", "child tag is outside the M3 field");
    }
    const unit = validatePaintUnitChild(child, { keys, ranks, placements, actors });
    if (!unit.ok) return unit;
  }
  const ordered = node.children.map((child) => Number(child.attrs["stack-rank"]));
  if (!ordered.every((rank, index) => rank === index + 1)) {
    return invalid("DEPTH_PLAN_INVALID", "attrs.stack-rank", "stack-ranks must be contiguous from 1");
  }
  return valid({ mapId: sceneData.value.mapId, paintUnits: node.children.length });
}

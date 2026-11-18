import { SPIKE_CANVAS_LIMITS, SPIKE_INPUT_LIMITS, SPIKE_MARKER_TAG, SPIKE_SCENE_CHILD_TAGS } from "./limits.mjs";

const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const RANK = /^[1-9][0-9]*$/;
const MAP_ID = /^(?:0|[1-9][0-9]*)$/;
const CONTENT_VERSION = /^sha256:[0-9a-f]{64}$/;
const SCENE_ATTRS = Object.freeze(["camera-x", "camera-y", "visible"]);
const BATCH_ATTRS = Object.freeze(["stack-rank", "visible"]);
const WORLD_ATTRS = Object.freeze(["stack-rank", "visible", "world-x", "world-y"]);
const MARKER_ATTRS = Object.freeze([]);

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
  if (typeof value !== "string" || value.length === 0 || value.length > SPIKE_INPUT_LIMITS.maxIdLength) {
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
  if (!Number.isFinite(number) || Object.is(number, -0) || Math.abs(number) > SPIKE_INPUT_LIMITS.maxCoordinate) {
    return invalid("INPUT_INVALID", path, "must be a finite coordinate inside the spike range");
  }
  return valid(number);
}

function visibleValue(value, path) {
  if (value !== "true" && value !== "false") return invalid("INPUT_INVALID", path, "must be true or false");
  return valid(value === "true");
}

function stackRank(value, path) {
  if (typeof value !== "string" || !RANK.test(value)) {
    return invalid("INPUT_INVALID", path, "must be a canonical positive decimal integer");
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > SPIKE_INPUT_LIMITS.stackRankMax) {
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
  if (typeof value !== "number" || !Number.isFinite(value) || Object.is(value, -0) || Math.abs(value) > SPIKE_INPUT_LIMITS.maxCoordinate) {
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
  const w = safeInteger(value.w, `${path}.w`, { min: 1, max: SPIKE_CANVAS_LIMITS.maxCanvasWidth });
  if (!w.ok) return w;
  const h = safeInteger(value.h, `${path}.h`, { min: 1, max: SPIKE_CANVAS_LIMITS.maxCanvasHeight });
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
  if (!plainObject(data) || !sameKeys(data, ["mapId", "pixelSnap"])) {
    return invalid("INPUT_INVALID", "data", "scene data must contain mapId and pixelSnap");
  }
  if (typeof data.mapId !== "string" || !MAP_ID.test(data.mapId) || data.mapId.length > SPIKE_INPUT_LIMITS.maxMapIdLength) {
    return invalid("INPUT_INVALID", "data.mapId", "must be a canonical decimal id");
  }
  if (data.pixelSnap !== "round") return invalid("INPUT_INVALID", "data.pixelSnap", "spike only accepts round");
  return valid({ mapId: data.mapId, pixelSnap: "round" });
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
  if (!plainObject(data) || !sameKeys(data, ["batchId", "bounds", "placements", "sprites"])) {
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
    w.value > SPIKE_CANVAS_LIMITS.maxCanvasWidth
    || h.value > SPIKE_CANVAS_LIMITS.maxCanvasHeight
    || w.value * h.value > SPIKE_CANVAS_LIMITS.maxCanvasPixels
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
  if (pageNames.length === 0 || pageNames.length > SPIKE_INPUT_LIMITS.maxPages) {
    return invalid("INPUT_INVALID", "data.sprites.pages", "page count is outside the spike budget");
  }
  if (itemNames.length === 0 || itemNames.length > SPIKE_INPUT_LIMITS.maxItems) {
    return invalid("INPUT_INVALID", "data.sprites.items", "item count is outside the spike budget");
  }
  if (data.placements.length === 0 || data.placements.length > SPIKE_INPUT_LIMITS.maxPlacements) {
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
    const width = safeInteger(page.width, `data.sprites.pages.${name}.width`, { min: 1, max: SPIKE_CANVAS_LIMITS.maxCanvasWidth });
    if (!width.ok) return width;
    const height = safeInteger(page.height, `data.sprites.pages.${name}.height`, { min: 1, max: SPIKE_CANVAS_LIMITS.maxCanvasHeight });
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
    if (!plainObject(placement) || !sameKeys(placement, ["flip", "kind", "opacity", "order", "placementId", "sprite", "x", "y"])) {
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
    const tieOrder = safeInteger(placement.order.tieOrder, `${path}.order.tieOrder`);
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
  if (!plainObject(data) || !sameKeys(data, ["actorVisualId", "anchor"])) {
    return invalid("INPUT_INVALID", "data", "world item data must contain actorVisualId and anchor");
  }
  const actorVisualId = idString(data.actorVisualId, "data.actorVisualId");
  if (!actorVisualId.ok) return actorVisualId;
  if (data.anchor !== "feet") return invalid("INPUT_INVALID", "data.anchor", "spike only accepts feet");
  return valid({ actorVisualId: actorVisualId.value, anchor: "feet" });
}

export function validateMarkerAttrs(attrs) {
  return exactAttrs(attrs, MARKER_ATTRS);
}

export function validateMarkerData(data) {
  if (!plainObject(data) || !sameKeys(data, ["color", "height", "localX", "localY", "markerId", "width"])) {
    return invalid("INPUT_INVALID", "data", "marker data must contain markerId, width, height, color, localX, and localY");
  }
  const markerId = idString(data.markerId, "data.markerId");
  if (!markerId.ok) return markerId;
  const width = safeInteger(data.width, "data.width", { min: 1, max: SPIKE_CANVAS_LIMITS.maxCanvasWidth });
  if (!width.ok) return width;
  const height = safeInteger(data.height, "data.height", { min: 1, max: SPIKE_CANVAS_LIMITS.maxCanvasHeight });
  if (!height.ok) return height;
  if (width.value * height.value > SPIKE_CANVAS_LIMITS.maxCanvasPixels) {
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

export function validateSpikeTree(node) {
  const root = nodeShape(node);
  if (!root.ok) return root;
  if (node.tag !== "ms-scene-view") return invalid("INPUT_INVALID", "tag", "spike root must be ms-scene-view");
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
    if (!SPIKE_SCENE_CHILD_TAGS.includes(child.tag)) {
      return invalid("UNSUPPORTED_CAPABILITY", "tag", "child tag is outside the M1 spike");
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
      continue;
    }
    const attrs = validateWorldAttrs(child.attrs);
    if (!attrs.ok) return attrs;
    const data = validateWorldData(child.data);
    if (!data.ok) return data;
    if (ranks.has(attrs.value.stackRank)) return invalid("DEPTH_PLAN_INVALID", "attrs.stack-rank", "stack-rank must be unique");
    ranks.add(attrs.value.stackRank);
    if (actors.has(data.value.actorVisualId)) return invalid("INPUT_INVALID", "data.actorVisualId", "duplicate actor presentation id");
    actors.add(data.value.actorVisualId);
    if (child.children.length !== 1) return invalid("INPUT_INVALID", "children", "spike world item must contain one synthetic marker");
    const marker = child.children[0];
    const markerShape = nodeShape(marker);
    if (!markerShape.ok) return markerShape;
    if (marker.tag !== SPIKE_MARKER_TAG) return invalid("INPUT_INVALID", "tag", "spike marker tag is required");
    if (keys.has(marker.key)) return invalid("INPUT_INVALID", "key", "duplicate render key");
    keys.add(marker.key);
    const markerAttrs = validateMarkerAttrs(marker.attrs);
    if (!markerAttrs.ok) return markerAttrs;
    const markerData = validateMarkerData(marker.data);
    if (!markerData.ok) return markerData;
    if (marker.children.length !== 0) return invalid("INPUT_INVALID", "children", "marker children must be empty");
  }
  return valid({ mapId: sceneData.value.mapId, paintUnits: node.children.length });
}

import { horizontalScreenAnchor } from "../../ms-map-adapter/src/back-layout.mjs";
import { hiddenPortalClipAfterFinish, hiddenPortalClipForDesire } from "./portal-sequence.mjs";
import { FIELD_CANVAS_LIMITS } from "./limits.mjs";
import { readSharedResource } from "./resource-read-pool.mjs";
import {
  placementDestRect,
  validateBackAttrs,
  validateBackData,
  validateBatchAttrs,
  validateBatchData,
  validateMapObjectData,
  validatePortalVisualData,
  validateSceneAttrs,
  validateSceneData,
  validateWorldAttrs,
  validateWorldData,
} from "./validate.mjs";

const SpikeHTMLElement = globalThis.HTMLElement ?? class {};

function cssPx(number) {
  if (Object.is(number, -0) || number === 0) return "0px";
  return `${number}px`;
}

function assignStyleProperty(style, name, value) {
  if (style.getPropertyValue(name) === value) return;
  if (value === "") style.removeProperty(name);
  else style.setProperty(name, value);
}

function hostStyleRule(styleElement) {
  const sheet = styleElement?.sheet;
  if (!sheet) return null;
  for (const rule of sheet.cssRules) {
    if (rule.selectorText === ":host") return rule;
  }
  return null;
}

function writeHostPlacement(styleElement, shown, box, leftKey, topKey, sized) {
  const rule = hostStyleRule(styleElement);
  if (!rule) return;
  const style = rule.style;
  assignStyleProperty(style, "left", cssPx(box[leftKey]));
  assignStyleProperty(style, "top", cssPx(box[topKey]));
  if (sized) {
    assignStyleProperty(style, "width", cssPx(box.w));
    assignStyleProperty(style, "height", cssPx(box.h));
  }
  assignStyleProperty(style, "z-index", String(box.stackRank));
  assignStyleProperty(style, "visibility", shown ? "" : "hidden");
}

const HOST_STATIC_BATCH = `
  :host {
    position:absolute; margin:0; padding:0; border:0; background:transparent; pointer-events:auto;
    left:0px; top:0px; width:0px; height:0px; z-index:1; visibility:hidden;
  }
  canvas { position:absolute; margin:0; image-rendering:pixelated; }
`;

const HOST_STATIC_CANVAS = `
  :host {
    position:absolute; margin:0; padding:0; border:0; background:transparent; pointer-events:none;
    left:0px; top:0px; width:0px; height:0px; z-index:1; visibility:hidden;
  }
  canvas { display:block; image-rendering:pixelated; }
`;

const HOST_STATIC_BACK = `
  :host {
    position:absolute; margin:0; padding:0; border:0; background:transparent; pointer-events:none;
    overflow:hidden;
    left:0px; top:0px; width:0px; height:0px; z-index:1; visibility:hidden;
  }
  canvas { display:block; image-rendering:pixelated; transform-origin:0 0; }
`;

const HOST_STATIC_SCENE = `
  :host { display:block; position:absolute; inset:0; margin:0; visibility:hidden; }
  .viewport { position:absolute; inset:0; overflow:hidden; }
  .world-plane {
    position:absolute; left:0; top:0; width:0; height:0; transform-origin:0 0;
    --ms-scene-camera-x:0px; --ms-scene-camera-y:0px;
    transform:translate(calc(-1 * var(--ms-scene-camera-x)), calc(-1 * var(--ms-scene-camera-y)));
  }
`;

const HOST_STATIC_WORLD = `
  :host {
    position:absolute; width:0; height:0; margin:0; padding:0; border:0;
    left:0px; top:0px; z-index:1; visibility:hidden;
  }
`;

function snap(number) {
  const rounded = Math.round(number);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function readDeclaredAttrs(element) {
  const observed = element.constructor.observedAttributes ?? [];
  const names = typeof element.getAttributeNames === "function" ? element.getAttributeNames() : [];
  if (names.length !== observed.length || names.some((name) => !observed.includes(name))) {
    return { ok: false, code: "INPUT_INVALID", path: "attrs", detail: "host attributes must match the declared set" };
  }
  const attrs = {};
  for (const name of observed) attrs[name] = element.getAttribute(name);
  return { ok: true, value: attrs };
}

function deviceRatio() {
  const value = globalThis.devicePixelRatio || 1;
  if (!Number.isFinite(value) || value <= 0 || value > FIELD_CANVAS_LIMITS.maxDevicePixelRatio) return null;
  return value;
}

/**
 * The stage keeps its fill scale. Field canvases are copied on the logical
 * pixel grid so that scale is the only resample. When the fill scale already
 * lands on a whole device pixel, paint at that integer instead and skip the resample.
 */
export function viewportPaintRatio(element) {
  const screen = deviceRatio();
  if (screen === null) return null;
  const diag = element.closest?.("ms-viewport-frame")?.diagnostics?.();
  if (!diag || !Number.isFinite(diag.scaleX) || !Number.isFinite(diag.scaleY)) return screen;
  const pixelsX = diag.scaleX * screen;
  const pixelsY = diag.scaleY * screen;
  const wholeX = Math.round(pixelsX);
  const wholeY = Math.round(pixelsY);
  if (wholeX >= 1
    && wholeX === wholeY
    && wholeX <= FIELD_CANVAS_LIMITS.maxDevicePixelRatio
    && Math.abs(pixelsX - wholeX) < 1e-4
    && Math.abs(pixelsY - wholeY) < 1e-4) {
    return wholeX;
  }
  return 1;
}

function failureCode(error) {
  if (error?.code === "CONTENT_NOT_FOUND") return "RESOURCE_MISSING";
  if (error?.code === "CONTENT_CONFLICT") return "CONTENT_IDENTITY_MISMATCH";
  if (error?.code === "CONTENT_CANCELLED" || error?.name === "AbortError") return "STALE_RENDER_RESULT";
  if (error?.code === "RESOURCE_LIMIT") return "RESOURCE_LIMIT";
  return "IMAGE_INVALID";
}

function deviceCanvasFitsBudget(width, height) {
  return width >= 1
    && height >= 1
    && width <= FIELD_CANVAS_LIMITS.maxCanvasWidth
    && height <= FIELD_CANVAS_LIMITS.maxCanvasHeight
    && width * height <= FIELD_CANVAS_LIMITS.maxCanvasPixels;
}

/**
 * Split a batch's CSS bounds into abutting slices whose device canvases fit
 * the field budget. Placement coordinates stay in batch space; each slice
 * only changes which canvas clips them.
 */
export function batchCanvasTiles(width, height, ratio) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > FIELD_CANVAS_LIMITS.maxDevicePixelRatio) return null;
  const limit = FIELD_CANVAS_LIMITS;
  const maxW = Math.max(1, Math.floor(limit.maxCanvasWidth / ratio));
  const maxH = Math.max(1, Math.floor(limit.maxCanvasHeight / ratio));
  const tiles = [];
  for (let y = 0; y < height; y += maxH) {
    const tileH = Math.min(maxH, height - y);
    const deviceH = Math.round(tileH * ratio);
    let x = 0;
    while (x < width) {
      let tileW = Math.min(maxW, width - x);
      let deviceW = Math.round(tileW * ratio);
      while (tileW > 1 && deviceW * deviceH > limit.maxCanvasPixels) {
        tileW -= 1;
        deviceW = Math.round(tileW * ratio);
      }
      if (!deviceCanvasFitsBudget(deviceW, deviceH)) return null;
      tiles.push({ x, y, w: tileW, h: tileH, deviceW, deviceH });
      x += tileW;
    }
  }
  return tiles;
}

/** Extra logical pixels drawn past each batch sprite so neighboring canvases overlap under the stage scale. */
export const TILE_EDGE_BLEED_PX = 1;

/**
 * Grow a batch slice by `bleed` logical pixels on every side. The slice grid
 * itself stays abutted; only the canvas extends. Drop the pad when the padded
 * device canvas would pass the field budget.
 */
export function batchSliceSurface(tile, ratio, bleed = TILE_EDGE_BLEED_PX) {
  if (!tile || !Number.isFinite(ratio) || ratio <= 0) return null;
  const requested = Number.isInteger(bleed) && bleed > 0 ? bleed : 0;
  for (let pad = requested; pad >= 0; pad -= 1) {
    const deviceW = Math.round((tile.w + pad * 2) * ratio);
    const deviceH = Math.round((tile.h + pad * 2) * ratio);
    if (!deviceCanvasFitsBudget(deviceW, deviceH)) continue;
    return {
      pad,
      deviceW,
      deviceH,
      x: tile.x - pad,
      y: tile.y - pad,
      w: tile.w + pad * 2,
      h: tile.h + pad * 2,
    };
  }
  return null;
}

function paintBatchPlacement(context, bitmap, placement, item, originX, originY, bleed = 0) {
  const dest = placementDestRect(placement, item);
  const pad = Number.isInteger(bleed) && bleed > 0 ? bleed : 0;
  const localX = dest.x - originX - pad;
  const localY = dest.y - originY - pad;
  const destW = dest.w + pad * 2;
  const destH = dest.h + pad * 2;
  context.save();
  context.globalAlpha = placement.opacity / 255;
  if (placement.flip) {
    context.translate(localX + destW, localY);
    context.scale(-1, 1);
    context.drawImage(bitmap, item.source.x, item.source.y, item.source.w, item.source.h, 0, 0, destW, destH);
  } else {
    context.drawImage(
      bitmap,
      item.source.x,
      item.source.y,
      item.source.w,
      item.source.h,
      localX,
      localY,
      destW,
      destH,
    );
  }
  context.restore();
}

function backContentSignature(data) {
  if (data?.mode === "local-animation") {
    const { placementId, front, source, presentation, mode, frames } = data;
    return JSON.stringify({ placementId, front, source, presentation, mode, frames });
  }
  const { placementId, front, source, presentation, image, draw } = data;
  return JSON.stringify({ placementId, front, source, presentation, image, draw });
}

function backLayoutSignature(data) {
  return JSON.stringify(data?.layout ?? null);
}

function mapObjectContentSignature(validated) {
  const { placementId, mode, frames, source, provenance } = validated;
  return JSON.stringify({ placementId, mode, frames, source, provenance });
}

function mapObjectLayoutSignature(validated) {
  return JSON.stringify(validated.layout ?? null);
}

class SpikeElement extends SpikeHTMLElement {
  constructor() {
    super();
    this._context = null;
    this._data = undefined;
    this._attrsSeen = false;
    this._connected = false;
    this._scheduled = false;
    this._state = "pending";
    this._code = null;
    this._detail = "";
    this._paintCommits = 0;
    this._clearCommits = 0;
    this._resourceReads = 0;
    this._epoch = 0;
    this._lifetime = 0;
    this._desiredVisible = false;
    this._style = null;
    if (typeof this.attachShadow === "function") this._installShadow();
  }

  receiveRenderContext(context) {
    this._context = context ?? null;
  }

  receiveRenderData(data) {
    this._data = data;
    this._applyInput();
  }

  attributeChangedCallback(_name, oldValue, newValue) {
    this._attrsSeen = true;
    if (oldValue === newValue) return;
    this._scheduleApply();
  }

  connectedCallback() {
    this._connected = true;
    this._lifetime += 1;
    if (this._attrsSeen || this._data !== undefined) this._applyInput();
  }

  disconnectedCallback() {
    this._connected = false;
    this._epoch += 1;
    this._abort?.abort();
    this._abort = null;
    this._loadingSignature = null;
    const token = this._lifetime;
    queueMicrotask(() => {
      if (this.isConnected || token !== this._lifetime) return;
      this._releaseSurface();
      this._state = "pending";
      this._code = null;
      this._detail = "";
    });
  }

  diagnostics() {
    return Object.freeze({
      state: this._state,
      code: this._code,
      detail: this._detail,
      paintCommits: this._paintCommits,
      clearCommits: this._clearCommits,
      resourceReads: this._resourceReads,
      visible: this._desiredVisible,
    });
  }

  _scheduleApply() {
    if (this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      if (!this.isConnected) return;
      this._applyInput();
    });
  }

  _failInput(result) {
    this._epoch += 1;
    this._abort?.abort();
    this._abort = null;
    this._loadingSignature = null;
    this._paintedSignature = null;
    this._state = "invalid";
    this._code = result.code;
    this._detail = `${result.path}: ${result.detail}`;
    this._desiredVisible = false;
    this._clearCanvas();
    this._writeHost(false);
  }

  _installShadow() {}

  _applyInput() {}

  _writeHost() {}

  _clearCanvas() {}

  _releaseSurface() {
    this._clearCanvas();
    this._paintedSignature = null;
    this._loadingSignature = null;
  }
}

export class MsSceneView extends SpikeElement {
  static get observedAttributes() {
    return ["camera-x", "camera-y", "visible"];
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    this._viewport = document.createElement("div");
    this._viewport.className = "viewport";
    this._plane = document.createElement("div");
    this._plane.className = "world-plane";
    const slot = document.createElement("slot");
    this._plane.append(slot);
    this._viewport.append(this._plane);
    shadow.append(this._style, this._viewport);
    this._style.textContent = HOST_STATIC_SCENE;
    this._writeHost(false);
  }

  _writeHost(shown) {
    this._desiredVisible = shown;
    const rule = hostStyleRule(this._style);
    if (!rule) return;
    assignStyleProperty(rule.style, "visibility", shown ? "" : "hidden");
  }

  _applyInput() {
    if (!this._style || !this._attrsSeen) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    const attrs = validateSceneAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const data = validateSceneData(this._data);
    if (!data.ok) return this._failInput(data);
    const cameraX = snap(attrs.value.cameraX);
    const cameraY = snap(attrs.value.cameraY);
    assignStyleProperty(this._plane.style, "--ms-scene-camera-x", cssPx(cameraX));
    assignStyleProperty(this._plane.style, "--ms-scene-camera-y", cssPx(cameraY));
    this._state = "ready";
    this._code = null;
    this._detail = "";
    this._writeHost(attrs.value.visible);
  }
}

export class MsMapBatch extends SpikeElement {
  static get observedAttributes() {
    return ["stack-rank", "visible"];
  }

  constructor() {
    super();
    this._abort = null;
    this._paintedData = null;
    this._loadingData = null;
  }

  _failInput(result) {
    this._paintedData = null;
    this._loadingData = null;
    super._failInput(result);
  }

  _releaseSurface() {
    this._paintedData = null;
    this._loadingData = null;
    super._releaseSurface();
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    this._surfaces = [];
    this._canvas = document.createElement("canvas");
    this._canvas.setAttribute("aria-hidden", "true");
    this._surfaces.push(this._canvas);
    shadow.append(this._style, this._canvas);
    this._style.textContent = HOST_STATIC_BATCH;
    this._writeHost(false, { x: 0, y: 0, w: 0, h: 0, stackRank: 1 });
  }

  _syncSurfaces(count) {
    const shadow = this._style.getRootNode();
    while (this._surfaces.length < count) {
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      shadow.append(canvas);
      this._surfaces.push(canvas);
    }
    while (this._surfaces.length > count) this._surfaces.pop().remove();
    this._canvas = this._surfaces[0] ?? null;
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    writeHostPlacement(this._style, shown, box, "x", "y", true);
  }

  _clearCanvas() {
    for (const canvas of this._surfaces ?? []) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this._clearCommits += 1;
  }

  _applyInput() {
    if (!this._canvas || !this._attrsSeen) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    const attrs = validateBatchAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const source = this._data;
    if (this._state === "ready" && source === this._paintedData && this._box) {
      this._writeHost(attrs.value.visible, { ...this._box, stackRank: attrs.value.stackRank });
      return;
    }
    if (this._state === "loading" && source === this._loadingData && this._box) {
      this._writeHost(false, { ...this._box, stackRank: attrs.value.stackRank });
      return;
    }
    const data = validateBatchData(source);
    if (!data.ok) return this._failInput(data);
    const box = { ...data.value.bounds, stackRank: attrs.value.stackRank };
    this._writeHost(false, box);
    this._loadingData = source;
    this._epoch += 1;
    const epoch = this._epoch;
    this._abort?.abort();
    const controller = new AbortController();
    this._abort = controller;
    this._state = "loading";
    this._code = null;
    this._detail = "";
    this._clearCanvas();
    void this._paint(data.value, source, epoch, controller, attrs.value.visible);
  }

  async _paint(data, source, epoch, controller, visible) {
    const bitmaps = [];
    try {
      if (this._context?.resources?.resource === undefined) {
        throw Object.assign(new Error("missing resource client"), { code: "CONTENT_UNAVAILABLE" });
      }
      const decoded = new Map();
      for (const [pageId, page] of Object.entries(data.pages)) {
        this._resourceReads += 1;
        const resource = await readSharedResource(
          this._context.resources,
          page.resource.namespace,
          page.resource.key,
          page.resource.contentVersion,
          controller.signal,
        );
        if (epoch !== this._epoch) return;
        if (resource.contentVersion !== page.resource.contentVersion) {
          throw Object.assign(new Error("content version mismatch"), { code: "CONTENT_CONFLICT" });
        }
        const mime = String(resource.mime).split(";")[0].trim().toLowerCase();
        if (mime !== "image/png") throw Object.assign(new Error("page mime is not image/png"), { code: "CONTENT_INVALID" });
        const bitmap = await createImageBitmap(new Blob([resource.bytes], { type: mime }));
        bitmaps.push(bitmap);
        if (epoch !== this._epoch) return;
        if (bitmap.width !== page.width || bitmap.height !== page.height) {
          throw Object.assign(new Error("decoded page size mismatch"), { code: "CONTENT_INVALID" });
        }
        decoded.set(pageId, bitmap);
      }
      const ratio = viewportPaintRatio(this);
      if (ratio === null) {
        this._failPaint(epoch, "RESOURCE_LIMIT", "device pixel ratio is outside the spike budget");
        return;
      }
      const tiles = batchCanvasTiles(data.bounds.w, data.bounds.h, ratio);
      if (!tiles) {
        this._failPaint(epoch, "RESOURCE_LIMIT", "device canvas budget exceeded");
        return;
      }
      const slices = tiles.map((tile) => {
        const surface = batchSliceSurface(tile, ratio);
        if (!surface) return null;
        const offscreen = document.createElement("canvas");
        offscreen.width = surface.deviceW;
        offscreen.height = surface.deviceH;
        const context = offscreen.getContext("2d");
        context.setTransform(ratio, 0, 0, ratio, surface.pad * ratio, surface.pad * ratio);
        context.imageSmoothingEnabled = false;
        const originX = data.bounds.x + tile.x;
        const originY = data.bounds.y + tile.y;
        for (const placement of data.placements) {
          const item = data.items[placement.sprite];
          paintBatchPlacement(context, decoded.get(item.page), placement, item, originX, originY, surface.pad);
        }
        return { surface, offscreen };
      });
      if (slices.some((slice) => slice === null)) {
        this._failPaint(epoch, "RESOURCE_LIMIT", "device canvas budget exceeded");
        return;
      }
      if (epoch !== this._epoch) return;
      this._syncSurfaces(slices.length);
      for (let index = 0; index < slices.length; index += 1) {
        const { surface, offscreen } = slices[index];
        const canvas = this._surfaces[index];
        canvas.width = surface.deviceW;
        canvas.height = surface.deviceH;
        canvas.style.left = cssPx(surface.x);
        canvas.style.top = cssPx(surface.y);
        canvas.style.width = cssPx(surface.w);
        canvas.style.height = cssPx(surface.h);
        const visible = canvas.getContext("2d");
        visible.imageSmoothingEnabled = false;
        visible.drawImage(offscreen, 0, 0);
      }
      this._paintCommits += 1;
      this._paintedData = source;
      this._loadingData = null;
      this._state = "ready";
      this._code = null;
      this._detail = "";
      const currentAttrs = validateBatchAttrs(readDeclaredAttrs(this).value ?? {});
      const shown = currentAttrs.ok ? currentAttrs.value.visible : visible;
      const stackRank = currentAttrs.ok ? currentAttrs.value.stackRank : this._box.stackRank;
      this._writeHost(shown, { ...data.bounds, stackRank });
    } catch (error) {
      if (epoch !== this._epoch || !this.isConnected) return;
      const code = failureCode(error);
      if (code === "STALE_RENDER_RESULT") return;
      this._failPaint(epoch, code, error?.message ?? code);
    } finally {
      for (const bitmap of bitmaps) bitmap.close?.();
      if (this._abort === controller) this._abort = null;
    }
  }

  _failPaint(epoch, code, detail) {
    if (epoch !== this._epoch) return;
    this._paintedData = null;
    this._loadingData = null;
    this._state = code === "INPUT_INVALID" || code === "DEPTH_PLAN_INVALID" ? "invalid" : "failed";
    this._code = code;
    this._detail = detail;
    this._clearCanvas();
    this._writeHost(false, this._box);
  }
}

function repeatPhase(anchor, step) {
  const mod = ((anchor % step) + step) % step;
  return mod === 0 ? 0 : mod - step;
}

function originPhase(origin, step) {
  if (!(step > 0)) return 0;
  return -(((origin % step) + step) % step);
}

function backTileStep(layout, axis) {
  if (!layout) return 0;
  if (axis === "x") {
    if (!layout.tileHorizontal) return 0;
    const step = layout.tileStepX > 0 ? layout.tileStepX : layout.frameWidth;
    return step > 0 ? step : 0;
  }
  if (!layout.tileVertical) return 0;
  const step = layout.tileStepY > 0 ? layout.tileStepY : layout.frameHeight;
  return step > 0 ? step : 0;
}

/**
 * Tiled backs stay on the viewport-sized surface. One extra tile would let
 * the bitmap slide instead of repainting, but on the resolved 1028×720 water
 * map those tiles add about 2M pixels and the M7.1 total ceiling only has
 * about 0.6M of slack.
 */
export function chooseBackCanvas(layout, fallbackW, fallbackH, ratio) {
  const baseW = layout?.canvasWidth ?? fallbackW;
  const baseH = layout?.canvasHeight ?? fallbackH;
  if (!Number.isFinite(baseW) || !Number.isFinite(baseH) || baseW <= 0 || baseH <= 0) return null;
  const deviceW = Math.round(baseW * ratio);
  const deviceH = Math.round(baseH * ratio);
  if (!deviceCanvasFitsBudget(deviceW, deviceH)) return null;
  return { w: baseW, h: baseH, deviceW, deviceH, externalPhase: false };
}

function paintBackTiles(context, bitmap, image, layout, draw, offset = [0, 0], scrollOffsetX = 0, screenAnchorX = null, surface = null) {
  const source = image?.source ?? {
    x: 0,
    y: 0,
    w: layout?.frameWidth ?? image?.pageWidth ?? 0,
    h: layout?.frameHeight ?? image?.pageHeight ?? 0,
  };
  if (!layout) {
    context.clearRect(0, 0, source.w, source.h);
    const opacity = Number.isInteger(draw?.opacity) ? draw.opacity : 255;
    context.globalAlpha = opacity / 255;
    if (draw?.flip) {
      context.save();
      context.translate(source.w, 0);
      context.scale(-1, 1);
      context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
      context.restore();
    } else {
      context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
    }
    context.globalAlpha = 1;
    return;
  }
  const frameW = layout.frameWidth;
  const frameH = layout.frameHeight;
  const canvasW = surface?.w ?? layout.canvasWidth;
  const canvasH = surface?.h ?? layout.canvasHeight;
  const stepX = layout.tileStepX > 0 ? layout.tileStepX : frameW;
  const stepY = layout.tileStepY > 0 ? layout.tileStepY : frameH;
  context.clearRect(0, 0, canvasW, canvasH);
  const opacity = Number.isInteger(draw?.opacity) ? draw.opacity : 255;
  context.globalAlpha = opacity / 255;
  const originX = Number.isFinite(layout.tileOriginX) ? layout.tileOriginX : 0;
  const originY = Number.isFinite(layout.tileOriginY) ? layout.tileOriginY : 0;
  const horiz = Boolean(layout.tileHorizontal);
  const vert = Boolean(layout.tileVertical);
  const phaseX = surface
    ? 0
    : (Number.isFinite(screenAnchorX)
      ? repeatPhase(screenAnchorX, stepX)
      : originPhase(originX + scrollOffsetX, stepX));
  const phaseY = surface ? 0 : originPhase(originY, stepY);
  const yEnd = vert ? (surface ? canvasH : canvasH + stepY) : frameH;
  const xEnd = horiz ? (surface ? canvasW : canvasW + stepX) : frameW;
  const yStep = vert ? stepY : frameH;
  const xStep = horiz ? stepX : frameW;
  const [offsetX, offsetY] = offset;
  const bleedX = horiz ? TILE_EDGE_BLEED_PX : 0;
  const bleedY = vert ? TILE_EDGE_BLEED_PX : 0;
  const drawW = source.w + bleedX * 2;
  const drawH = source.h + bleedY * 2;
  for (let y = vert ? phaseY : 0; y < yEnd; y += yStep) {
    for (let x = horiz ? phaseX : 0; x < xEnd; x += xStep) {
      const drawX = x + offsetX - bleedX;
      const drawY = y + offsetY - bleedY;
      if (draw?.flip) {
        context.save();
        context.translate(drawX + drawW, drawY);
        context.scale(-1, 1);
        context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, drawW, drawH);
        context.restore();
      } else {
        context.drawImage(bitmap, source.x, source.y, source.w, source.h, drawX, drawY, drawW, drawH);
      }
    }
  }
  context.globalAlpha = 1;
}

function mapObjectCycleDurationMs(frames) {
  if (!Array.isArray(frames) || frames.length <= 1) return 0;
  let sum = 0;
  for (const frame of frames) {
    const delay = Number(frame?.delay ?? 0);
    if (Number.isFinite(delay) && delay > 0) sum += delay;
  }
  return sum;
}

function clipDelayMs(frame) {
  const delay = Number(frame?.delay ?? 0);
  return Number.isFinite(delay) && delay > 0 ? delay : 0;
}

function clipDurationMs(frames) {
  let sum = 0;
  for (const frame of frames ?? []) sum += clipDelayMs(frame);
  return sum;
}

function clipFrameIndex(frames, elapsedMs, loop) {
  const duration = clipDurationMs(frames);
  if (duration <= 0) return 0;
  let cursor = loop ? elapsedMs % duration : Math.min(elapsedMs, Math.max(0, duration - 1));
  for (let index = 0; index < frames.length; index += 1) {
    const delay = clipDelayMs(frames[index]);
    if (delay <= 0) continue;
    if (cursor < delay) return index;
    cursor -= delay;
  }
  return Math.max(0, frames.length - 1);
}

function mapObjectFrameIndex(frames, elapsedMs) {
  const duration = mapObjectCycleDurationMs(frames);
  if (duration <= 0) return 0;
  let cursor = elapsedMs % duration;
  for (let index = 0; index < frames.length; index += 1) {
    const delay = Number(frames[index]?.delay ?? 0);
    if (!Number.isFinite(delay) || delay <= 0) continue;
    if (cursor < delay) return index;
    cursor -= delay;
  }
  return frames.length - 1;
}

function mapObjectFramesToDecode(validated) {
  const frames = validated?.frames ?? [];
  if (validated?.layout || mapObjectCycleDurationMs(frames) > 0) return frames;
  return frames.slice(0, 1);
}

function paintMapObjectFrame(context, bitmap, image, draw, layout, scrollOffsetX = 0) {
  const source = image.source;
  const frameW = layout?.frameWidth ?? source.w;
  const frameH = layout?.frameHeight ?? source.h;
  if (!layout) {
    context.clearRect(0, 0, source.w, source.h);
    const opacity = Number.isInteger(draw?.opacity) ? draw.opacity : 255;
    context.globalAlpha = opacity / 255;
    if (draw?.flip) {
      context.save();
      context.translate(source.w, 0);
      context.scale(-1, 1);
      context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
      context.restore();
    } else {
      context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
    }
    context.globalAlpha = 1;
    return;
  }
  const canvasW = layout.canvasWidth;
  const canvasH = layout.canvasHeight;
  const stepX = layout.tileStepX > 0 ? layout.tileStepX : frameW;
  const stepY = layout.tileStepY > 0 ? layout.tileStepY : frameH;
  context.clearRect(0, 0, canvasW, canvasH);
  const opacity = Number.isInteger(draw?.opacity) ? draw.opacity : 255;
  context.globalAlpha = opacity / 255;
  const originX = Number.isFinite(layout.tileOriginX) ? layout.tileOriginX : 0;
  const originY = Number.isFinite(layout.tileOriginY) ? layout.tileOriginY : 0;
  const anchorOffsetX = Number.isFinite(layout.anchorOffsetX) ? layout.anchorOffsetX : 0;
  const anchorOffsetY = Number.isFinite(layout.anchorOffsetY) ? layout.anchorOffsetY : 0;
  const phaseX = -((((originX + scrollOffsetX) % stepX) + stepX) % stepX);
  const phaseY = -(((originY % stepY) + stepY) % stepY);
  const horiz = Boolean(layout.tileHorizontal);
  const vert = Boolean(layout.tileVertical);
  const yEnd = vert ? canvasH + stepY : frameH;
  const xEnd = horiz ? canvasW + stepX : frameW;
  const yStep = vert ? stepY : frameH;
  const xStep = horiz ? stepX : frameW;
  for (let y = vert ? phaseY : 0; y < yEnd; y += yStep) {
    for (let x = horiz ? phaseX : 0; x < xEnd; x += xStep) {
      const drawX = x + anchorOffsetX - (draw?.flip ? source.w - draw.origin[0] : draw.origin[0]);
      const drawY = y + anchorOffsetY - draw.origin[1];
      if (draw?.flip) {
        context.save();
        context.translate(drawX + source.w, drawY);
        context.scale(-1, 1);
        context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
        context.restore();
      } else {
        context.drawImage(bitmap, source.x, source.y, source.w, source.h, drawX, drawY, source.w, source.h);
      }
    }
  }
  context.globalAlpha = 1;
}

export class MsMapBack extends SpikeElement {
  static get observedAttributes() {
    return ["stack-rank", "visible", "view-x", "view-y"];
  }

  constructor() {
    super();
    this._abort = null;
    this._paintedSignature = null;
    this._paintedData = null;
    this._loadingSignature = null;
    this._sourceBitmap = null;
    this._frameBitmaps = [];
    this._validated = null;
    this._displayFrame = 0;
    this._presentationStart = 0;
    this._animFrame = null;
    this._scrollOffsetX = 0;
    this._scrollLastTs = null;
    this._scrollPixel = 0;
    this._animationPaints = 0;
    this._contentSignature = null;
    this._layoutSignature = null;
    this._externalPhase = false;
    this._phaseTransform = "";
    this._canvasCssW = 0;
    this._canvasCssH = 0;
    this._paintRatioObserver = null;
    this._paintRatioFrame = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._watchPaintRatio();
  }

  disconnectedCallback() {
    this._paintRatioObserver?.disconnect();
    this._paintRatioObserver = null;
    this._paintRatioFrame = null;
    super.disconnectedCallback();
  }

  _watchPaintRatio() {
    const frame = this.closest?.("ms-viewport-frame");
    if (!frame || frame === this._paintRatioFrame || typeof ResizeObserver !== "function") return;
    this._paintRatioObserver?.disconnect();
    this._paintRatioFrame = frame;
    this._paintRatioObserver = new ResizeObserver(() => {
      if (this._state === "ready") this._redrawBack(false);
    });
    this._paintRatioObserver.observe(frame);
  }

  diagnostics() {
    return Object.freeze({
      ...super.diagnostics(),
      animationPaints: this._animationPaints,
    });
  }

  _stopAnim() {
    if (this._animFrame !== null) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    this._scrollLastTs = null;
  }

  _releaseBitmaps() {
    this._sourceBitmap?.close?.();
    this._sourceBitmap = null;
    for (const bitmap of this._frameBitmaps) bitmap?.close?.();
    this._frameBitmaps = [];
  }

  _hasLastGoodPaint() {
    if (this._paintCommits <= 0 || this._contentSignature === null) return false;
    if (this._validated?.mode === "local-animation") return this._frameBitmaps.length > 0;
    return this._sourceBitmap !== null;
  }

  _failInput(result) {
    this._stopAnim();
    this._releaseBitmaps();
    this._validated = null;
    this._paintedData = null;
    super._failInput(result);
  }

  _releaseSurface() {
    this._stopAnim();
    this._releaseBitmaps();
    this._validated = null;
    this._displayFrame = 0;
    this._scrollOffsetX = 0;
    this._scrollPixel = 0;
    super._releaseSurface();
  }

  _hostBox(attrs, validated) {
    const layout = validated.layout;
    if (layout) {
      return {
        viewX: attrs.viewX,
        viewY: attrs.viewY,
        stackRank: attrs.stackRank,
        w: layout.canvasWidth,
        h: layout.canvasHeight,
      };
    }
    const frame = validated.mode === "local-animation"
      ? validated.frames[0]
      : { image: validated.image };
    const image = frame.image;
    return {
      viewX: attrs.viewX,
      viewY: attrs.viewY,
      stackRank: attrs.stackRank,
      w: image.pageWidth,
      h: image.pageHeight,
    };
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    this._canvas = document.createElement("canvas");
    this._canvas.setAttribute("aria-hidden", "true");
    shadow.append(this._style, this._canvas);
    this._style.textContent = HOST_STATIC_BACK;
    this._writeHost(false, { viewX: 0, viewY: 0, stackRank: 1, w: 0, h: 0 });
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    writeHostPlacement(this._style, shown, box, "viewX", "viewY", true);
  }

  _clearCanvas() {
    if (!this._canvas) return;
    this._canvas.width = 0;
    this._canvas.height = 0;
    this._canvas.style.transform = "";
    this._phaseTransform = "";
    this._externalPhase = false;
    this._clearCommits += 1;
  }

  _sizeBackCanvas(layout, fallbackW, fallbackH, ratio) {
    const chosen = chooseBackCanvas(layout, fallbackW, fallbackH, ratio);
    if (!chosen) return false;
    this._externalPhase = chosen.externalPhase;
    this._canvasCssW = chosen.w;
    this._canvasCssH = chosen.h;
    this._canvas.width = chosen.deviceW;
    this._canvas.height = chosen.deviceH;
    this._canvas.style.width = cssPx(chosen.w);
    this._canvas.style.height = cssPx(chosen.h);
    return true;
  }

  _applyInput() {
    if (!this._canvas || !this._attrsSeen) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    const attrs = validateBackAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    if (this._state === "ready" && this._data === this._paintedData && this._validated && this._hasLastGoodPaint()) {
      const box = this._hostBox(attrs.value, this._validated);
      this._writeHost(attrs.value.visible, box);
      this._syncAnimLoop();
      this._followBackPhase();
      return;
    }
    const data = validateBackData(this._data);
    if (!data.ok) return this._failInput(data);
    const validated = data.value;
    const contentSignature = backContentSignature(this._data);
    const layoutSignature = backLayoutSignature(this._data);
    const box = this._hostBox(attrs.value, validated);
    const hasLastGood = this._hasLastGoodPaint();
    if (hasLastGood && contentSignature === this._paintedSignature && this._state === "ready") {
      this._paintedData = this._data;
      if (layoutSignature !== this._layoutSignature) {
        this._relayoutViewportSurface(attrs.value.visible, box, validated);
        this._contentSignature = contentSignature;
        this._layoutSignature = layoutSignature;
        return;
      }
      this._writeHost(attrs.value.visible, box);
      this._syncAnimLoop();
      this._followBackPhase();
      return;
    }
    if (contentSignature === this._loadingSignature) return;
    this._stopAnim();
    if (!hasLastGood) this._writeHost(false, box);
    this._loadingSignature = contentSignature;
    this._epoch += 1;
    const epoch = this._epoch;
    this._abort?.abort();
    const controller = new AbortController();
    this._abort = controller;
    this._state = "loading";
    this._code = null;
    this._detail = "";
    if (!hasLastGood) {
      this._releaseBitmaps();
      this._clearCanvas();
    }
    if (validated.mode === "local-animation") {
      void this._loadFrames(validated, contentSignature, epoch, controller, attrs.value.visible, box);
      return;
    }
    void this._paintStatic(validated, contentSignature, epoch, controller, attrs.value.visible, box);
  }

  _relayoutViewportSurface(visible, box, validated) {
    const layout = validated.layout;
    const hasBitmap = validated.mode === "local-animation"
      ? this._frameBitmaps.length > 0
      : this._sourceBitmap !== null;
    if (!this._canvas || !hasBitmap) return;
    const ratio = viewportPaintRatio(this);
    if (ratio === null) {
      this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "device pixel ratio is outside the field budget" });
      return;
    }
    const frame = validated.mode === "local-animation"
      ? validated.frames[this._displayFrame] ?? validated.frames[0]
      : { image: validated.image, draw: validated.draw };
    if (!this._sizeBackCanvas(layout, frame.image.pageWidth, frame.image.pageHeight, ratio)) {
      this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "Back canvas budget exceeded" });
      return;
    }
    // The running callback closes over layout/draw. Restart it so the next
    // animation paint cannot restore stale viewport geometry after relayout.
    this._stopAnim();
    this._validated = validated;
    this._redrawBack(false);
    this._writeHost(visible, box);
    this._syncAnimLoop();
  }

  _currentFrame() {
    if (this._validated?.mode === "local-animation") {
      return this._validated.frames[this._displayFrame] ?? this._validated.frames[0];
    }
    return {
      image: this._validated?.image ?? this._data?.image,
      draw: this._validated?.draw ?? this._data?.draw,
    };
  }

  _currentBitmap() {
    if (this._validated?.mode === "local-animation") {
      return this._frameBitmaps[this._displayFrame] ?? this._frameBitmaps[0];
    }
    return this._sourceBitmap;
  }

  _horizontalAnchor() {
    const layout = this._validated?.layout ?? this._data?.layout ?? null;
    const cameraX = Number(this.getAttribute("view-x"));
    return horizontalScreenAnchor(layout, cameraX, Math.trunc(this._scrollOffsetX));
  }

  /**
   * The host stays pinned by view-x/view-y. The world plane already translates
   * by the camera, so the tile phase is only a canvas translate inside the
   * clipped host. Horizontal phase follows the screen anchor (including type-4
   * scroll). Vertical phase is the authored origin, which the camera does not
   * change.
   */
  _syncBackPhase() {
    if (!this._canvas) return;
    if (!this._externalPhase) {
      if (this._phaseTransform !== "") {
        this._canvas.style.transform = "";
        this._phaseTransform = "";
      }
      return;
    }
    const layout = this._validated?.layout ?? null;
    const stepX = backTileStep(layout, "x");
    const stepY = backTileStep(layout, "y");
    const anchor = this._horizontalAnchor();
    const phaseX = stepX > 0 && Number.isFinite(anchor) ? repeatPhase(anchor, stepX) : 0;
    const originY = Number.isFinite(layout?.tileOriginY) ? layout.tileOriginY : 0;
    const phaseY = stepY > 0 ? originPhase(originY, stepY) : 0;
    const next = `translate(${cssPx(phaseX)}, ${cssPx(phaseY)})`;
    if (this._phaseTransform === next) return;
    this._canvas.style.transform = next;
    this._phaseTransform = next;
  }

  _followBackPhase() {
    if (this._externalPhase) {
      this._syncBackPhase();
      return;
    }
    if (this._horizontalAnchor() !== this._paintedAnchorX) this._redrawBack(false);
  }

  _redrawBack(countCommit = true) {
    const bitmap = this._currentBitmap();
    if (!this._canvas || !bitmap) return;
    const ratio = viewportPaintRatio(this);
    if (ratio === null) return;
    const frame = this._currentFrame();
    const layout = this._validated?.layout ?? this._data?.layout ?? null;
    const pageW = frame.image?.pageWidth ?? frame.image?.source?.w ?? 0;
    const pageH = frame.image?.pageHeight ?? frame.image?.source?.h ?? 0;
    const chosen = chooseBackCanvas(layout, pageW, pageH, ratio);
    if (!chosen) return;
    if (this._canvas.width !== chosen.deviceW || this._canvas.height !== chosen.deviceH) {
      this._sizeBackCanvas(layout, pageW, pageH, ratio);
    }
    const context = this._canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    const anchor = this._horizontalAnchor();
    this._paintedAnchorX = anchor;
    const surface = this._externalPhase ? { w: this._canvasCssW, h: this._canvasCssH } : null;
    paintBackTiles(
      context,
      bitmap,
      frame.image,
      layout,
      frame.draw,
      frame.offset,
      !surface && anchor === null ? this._scrollOffsetX : 0,
      surface ? null : anchor,
      surface,
    );
    this._syncBackPhase();
    if (countCommit) this._paintCommits += 1;
  }

  _syncAnimLoop() {
    const validated = this._validated;
    const layout = validated?.layout;
    const scroll = layout?.scroll?.pixelsPerMs;
    const animate = validated?.mode === "local-animation"
      && (validated.frames?.length ?? 0) > 1
      && mapObjectCycleDurationMs(validated.frames) > 0;
    if (!scroll && !animate) {
      this._stopAnim();
      return;
    }
    if (this._animFrame !== null) return;
    const tick = (ts) => {
      if (!this.isConnected || this._state !== "ready") {
        this._stopAnim();
        return;
      }
      let dirty = false;
      let advanced = false;
      if (scroll) {
        if (this._scrollLastTs !== null) {
          const delta = ts - this._scrollLastTs;
          this._scrollOffsetX += scroll * delta;
          const pixel = Math.trunc(this._scrollOffsetX);
          if (pixel !== this._scrollPixel) {
            this._scrollPixel = pixel;
            if (this._externalPhase) this._syncBackPhase();
            else dirty = true;
            advanced = true;
          }
        }
        this._scrollLastTs = ts;
      }
      if (animate) {
        const elapsed = ts - this._presentationStart;
        const nextFrame = mapObjectFrameIndex(validated.frames, elapsed);
        if (nextFrame !== this._displayFrame) {
          this._displayFrame = nextFrame;
          const declared = readDeclaredAttrs(this);
          if (declared.ok) {
            const attrs = validateBackAttrs(declared.value);
            if (attrs.ok) {
              this._writeHost(attrs.value.visible, this._hostBox(attrs.value, validated));
            }
          }
          dirty = true;
          advanced = true;
        }
      }
      if (dirty) this._redrawBack(false);
      if (advanced) this._animationPaints += 1;
      this._animFrame = requestAnimationFrame(tick);
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  async _loadFrames(validated, signature, epoch, controller, visible, box) {
    const ratio = viewportPaintRatio(this);
    const bitmaps = [];
    let pendingBitmap = null;
    let adopted = false;
    try {
      if (this._context?.resources?.resource === undefined) {
        throw Object.assign(new Error("missing resource client"), { code: "CONTENT_UNAVAILABLE" });
      }
      if (ratio === null) {
        throw Object.assign(new Error("device pixel ratio is outside the field budget"), { code: "RESOURCE_LIMIT" });
      }
      for (const frame of validated.frames) {
        if (epoch !== this._epoch) return;
        this._resourceReads += 1;
        const image = frame.image;
        const resource = await readSharedResource(
          this._context.resources,
          image.resource.namespace,
          image.resource.key,
          image.resource.contentVersion,
          controller.signal,
        );
        if (epoch !== this._epoch) return;
        const mime = String(resource.mime).split(";")[0].trim().toLowerCase();
        if (mime !== "image/png") throw Object.assign(new Error("page mime is not image/png"), { code: "CONTENT_INVALID" });
        pendingBitmap = await createImageBitmap(new Blob([resource.bytes], { type: mime }));
        if (epoch !== this._epoch) return;
        if (pendingBitmap.width !== image.pageWidth || pendingBitmap.height !== image.pageHeight) {
          throw Object.assign(new Error("decoded Back dimensions do not match the declared resource page"), { code: "CONTENT_INVALID" });
        }
        bitmaps.push(pendingBitmap);
        pendingBitmap = null;
      }
      if (epoch !== this._epoch || !this.isConnected) return;
      const declared = readDeclaredAttrs(this);
      if (!declared.ok) return this._failInput(declared);
      const attrs = validateBackAttrs(declared.value);
      if (!attrs.ok) return this._failInput(attrs);
      const latest = validateBackData(this._data);
      if (!latest.ok) return this._failInput(latest);
      if (backContentSignature(this._data) !== signature) return;
      validated = latest.value;
      visible = attrs.value.visible;
      box = this._hostBox(attrs.value, validated);
      const layout = validated.layout;
      const frame = validated.frames[0];
      if (!this._sizeBackCanvas(layout, frame.image.pageWidth, frame.image.pageHeight, ratio)) {
        throw Object.assign(new Error("Back canvas budget exceeded"), { code: "RESOURCE_LIMIT" });
      }
      this._releaseBitmaps();
      this._frameBitmaps = bitmaps;
      adopted = true;
      this._validated = validated;
      this._displayFrame = 0;
      this._presentationStart = performance.now();
      this._scrollOffsetX = 0;
      this._scrollPixel = 0;
      this._redrawBack();
      this._paintedSignature = signature;
      this._paintedData = this._data;
      this._contentSignature = backContentSignature(this._data);
      this._layoutSignature = backLayoutSignature(this._data);
      this._loadingSignature = null;
      this._state = "ready";
      this._writeHost(visible, box);
      this._syncAnimLoop();
    } catch (error) {
      if (epoch !== this._epoch || !this.isConnected) return;
      const code = failureCode(error);
      if (code === "STALE_RENDER_RESULT") return;
      this._failPaint(epoch, code, error?.message ?? code);
    } finally {
      pendingBitmap?.close?.();
      if (!adopted) {
        for (const bitmap of bitmaps) bitmap?.close?.();
      }
      if (this._abort === controller) this._abort = null;
    }
  }

  async _paintStatic(validated, signature, epoch, controller, visible, box) {
    const image = validated.image;
    let bitmap;
    try {
      if (this._context?.resources?.resource === undefined) {
        throw Object.assign(new Error("missing resource client"), { code: "CONTENT_UNAVAILABLE" });
      }
      this._resourceReads += 1;
      const resource = await readSharedResource(
        this._context.resources,
        image.resource.namespace,
        image.resource.key,
        image.resource.contentVersion,
        controller.signal,
      );
      if (epoch !== this._epoch) return;
      const mime = String(resource.mime).split(";")[0].trim().toLowerCase();
      if (mime !== "image/png") throw Object.assign(new Error("page mime is not image/png"), { code: "CONTENT_INVALID" });
      bitmap = await createImageBitmap(new Blob([resource.bytes], { type: mime }));
      if (epoch !== this._epoch || !this.isConnected) return;
      if (bitmap.width !== image.pageWidth || bitmap.height !== image.pageHeight) {
        throw Object.assign(new Error("decoded Back dimensions do not match the declared resource page"), { code: "CONTENT_INVALID" });
      }
      const declared = readDeclaredAttrs(this);
      if (!declared.ok) return this._failInput(declared);
      const attrs = validateBackAttrs(declared.value);
      if (!attrs.ok) return this._failInput(attrs);
      const latest = validateBackData(this._data);
      if (!latest.ok) return this._failInput(latest);
      if (backContentSignature(this._data) !== signature) return;
      const ratio = viewportPaintRatio(this);
      if (ratio === null) return this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "device pixel ratio is outside the field budget" });
      validated = latest.value;
      const layout = validated.layout;
      const latestBox = this._hostBox(attrs.value, validated);
      if (epoch !== this._epoch || !this.isConnected) return;
      if (!this._sizeBackCanvas(layout, validated.image.pageWidth, validated.image.pageHeight, ratio)) {
        return this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "Back canvas budget exceeded" });
      }
      this._releaseBitmaps();
      this._sourceBitmap = bitmap;
      bitmap = null;
      this._validated = validated;
      this._scrollOffsetX = 0;
      this._scrollPixel = 0;
      this._redrawBack();
      this._paintedSignature = signature;
      this._paintedData = this._data;
      this._contentSignature = backContentSignature(this._data);
      this._layoutSignature = backLayoutSignature(this._data);
      this._loadingSignature = null;
      this._state = "ready";
      this._writeHost(attrs.value.visible, latestBox);
      this._syncAnimLoop();
    } catch (error) {
      if (epoch !== this._epoch || !this.isConnected) return;
      const code = failureCode(error);
      if (code === "STALE_RENDER_RESULT") return;
      this._failPaint(epoch, code, error?.message ?? code);
    } finally {
      bitmap?.close?.();
      if (this._abort === controller) this._abort = null;
    }
  }

  _failPaint(epoch, code, detail) {
    if (epoch !== this._epoch) return;
    this._loadingSignature = null;
    const hasLastGood = this._hasLastGoodPaint();
    this._state = code === "INPUT_INVALID" || code === "DEPTH_PLAN_INVALID" ? "invalid" : "failed";
    this._code = code;
    this._detail = detail;
    if (!hasLastGood) {
      this._paintedSignature = null;
      this._paintedData = null;
      this._clearCanvas();
      this._writeHost(false, this._box ?? { viewX: 0, viewY: 0, stackRank: 1, w: 0, h: 0 });
      return;
    }
    this._writeHost(this._desiredVisible, this._box);
  }
}

function standaloneHostBox(attrs, image, draw) {
  const [originX, originY] = draw.origin;
  const { w, h } = image.source;
  const worldX = draw.flip ? attrs.worldX - (w - originX) : attrs.worldX - originX;
  const worldY = attrs.worldY - originY;
  return { worldX, worldY, stackRank: attrs.stackRank, w, h };
}

/** Shared static first-frame hosts for adapter standalone paint units. */
class MsStandalonePaintUnit extends SpikeElement {
  static get observedAttributes() {
    return ["world-x", "world-y", "stack-rank", "visible"];
  }

  constructor() {
    super();
    this._abort = null;
    this._paintedSignature = null;
    this._loadingSignature = null;
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    this._canvas = document.createElement("canvas");
    this._canvas.setAttribute("aria-hidden", "true");
    shadow.append(this._style, this._canvas);
    this._style.textContent = HOST_STATIC_CANVAS;
    this._writeHost(false, { worldX: 0, worldY: 0, stackRank: 1, w: 0, h: 0 });
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    writeHostPlacement(this._style, shown, box, "worldX", "worldY", true);
  }

  _clearCanvas() {
    if (!this._canvas) return;
    this._canvas.width = 0;
    this._canvas.height = 0;
    this._clearCommits += 1;
  }

  _firstPaintFrame(_validated) {
    throw new Error("subclass must implement _firstPaintFrame");
  }

  _validatePaintData(_data) {
    throw new Error("subclass must implement _validatePaintData");
  }

  _hasLastGoodPaint() {
    return this._paintCommits > 0 && this._paintedSignature !== null;
  }

  _applyInput() {
    if (!this._canvas || !this._attrsSeen) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    const attrs = validateWorldAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const data = this._validatePaintData(this._data);
    if (!data.ok) return this._failInput(data);
    const { image, draw } = this._firstPaintFrame(data.value);
    const box = standaloneHostBox(attrs.value, image, draw);
    const signature = JSON.stringify({ data: data.value, attrs: declared.value });
    const hasLastGood = this._hasLastGoodPaint();
    if (signature === this._paintedSignature && this._state === "ready") {
      this._writeHost(attrs.value.visible, box);
      return;
    }
    if (!hasLastGood) {
      this._writeHost(false, box);
      this._box = box;
    }
    if (signature === this._loadingSignature) return;
    this._loadingSignature = signature;
    this._epoch += 1;
    const epoch = this._epoch;
    this._abort?.abort();
    const controller = new AbortController();
    this._abort = controller;
    this._state = "loading";
    this._code = null;
    this._detail = "";
    if (!hasLastGood) this._clearCanvas();
    void this._paint(image, draw, signature, epoch, controller, attrs.value.visible, box);
  }

  async _paint(image, draw, signature, epoch, controller, visible, box) {
    let bitmap;
    try {
      if (this._context?.resources?.resource === undefined) {
        throw Object.assign(new Error("missing resource client"), { code: "CONTENT_UNAVAILABLE" });
      }
      this._resourceReads += 1;
      const resource = await readSharedResource(
        this._context.resources,
        image.resource.namespace,
        image.resource.key,
        image.resource.contentVersion,
        controller.signal,
      );
      if (epoch !== this._epoch) return;
      if (resource.contentVersion !== image.resource.contentVersion) {
        throw Object.assign(new Error("content version mismatch"), { code: "CONTENT_CONFLICT" });
      }
      const mime = String(resource.mime).split(";")[0].trim().toLowerCase();
      if (mime !== "image/png") throw Object.assign(new Error("page mime is not image/png"), { code: "CONTENT_INVALID" });
      bitmap = await createImageBitmap(new Blob([resource.bytes], { type: mime }));
      if (epoch !== this._epoch) return;
      const ratio = viewportPaintRatio(this);
      if (ratio === null) {
        this._failPaint(epoch, "RESOURCE_LIMIT", "device pixel ratio is outside the field budget", signature);
        return;
      }
      const { source } = image;
      const deviceW = Math.round(source.w * ratio);
      const deviceH = Math.round(source.h * ratio);
      if (
        deviceW < 1 || deviceH < 1
        || deviceW > FIELD_CANVAS_LIMITS.maxCanvasWidth
        || deviceH > FIELD_CANVAS_LIMITS.maxCanvasHeight
        || deviceW * deviceH > FIELD_CANVAS_LIMITS.maxCanvasPixels
      ) {
        this._failPaint(epoch, "RESOURCE_LIMIT", "standalone canvas budget exceeded", signature);
        return;
      }
      const offscreen = document.createElement("canvas");
      offscreen.width = deviceW;
      offscreen.height = deviceH;
      const context = offscreen.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
      context.globalAlpha = draw.opacity / 255;
      if (draw.flip) {
        context.translate(source.w, 0);
        context.scale(-1, 1);
        context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
      } else {
        context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
      }
      if (epoch !== this._epoch) return;
      this._canvas.width = deviceW;
      this._canvas.height = deviceH;
      this._canvas.style.width = cssPx(source.w);
      this._canvas.style.height = cssPx(source.h);
      this._canvas.getContext("2d").drawImage(offscreen, 0, 0);
      this._paintCommits += 1;
      this._paintedSignature = signature;
      this._loadingSignature = null;
      this._state = "ready";
      this._code = null;
      this._detail = "";
      this._box = box;
      this._writeHost(visible, box);
    } catch (error) {
      if (epoch !== this._epoch || !this.isConnected) return;
      const code = failureCode(error);
      if (code === "STALE_RENDER_RESULT") return;
      this._failPaint(epoch, code, error?.message ?? code, signature);
    } finally {
      bitmap?.close?.();
      if (this._abort === controller) this._abort = null;
    }
  }

  _failPaint(epoch, code, detail, _attemptedSignature) {
    if (epoch !== this._epoch) return;
    this._loadingSignature = null;
    const hasLastGood = this._hasLastGoodPaint();
    this._state = code === "INPUT_INVALID" || code === "DEPTH_PLAN_INVALID" ? "invalid" : "failed";
    this._code = code;
    this._detail = detail;
    if (!hasLastGood) {
      this._paintedSignature = null;
      this._clearCanvas();
      this._writeHost(false, this._box ?? { worldX: 0, worldY: 0, stackRank: 1, w: 0, h: 0 });
      return;
    }
    this._writeHost(this._desiredVisible, this._box);
  }
}

class MsMapObject extends SpikeElement {
  static get observedAttributes() {
    return ["world-x", "world-y", "stack-rank", "visible"];
  }

  constructor() {
    super();
    this._abort = null;
    this._paintedSignature = null;
    this._loadingSignature = null;
    this._validated = null;
    this._frameBitmaps = [];
    this._presentationStart = 0;
    this._animFrame = null;
    this._scrollOffsetX = 0;
    this._scrollLastTs = null;
    this._scrollPixel = 0;
    this._animationPaints = 0;
    this._displayFrame = 0;
    this._contentSignature = null;
    this._layoutSignature = null;
  }

  diagnostics() {
    return Object.freeze({
      ...super.diagnostics(),
      animationPaints: this._animationPaints,
    });
  }

  _stopAnim() {
    if (this._animFrame !== null) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    this._scrollLastTs = null;
  }

  _releaseBitmaps() {
    for (const bitmap of this._frameBitmaps) bitmap?.close?.();
    this._frameBitmaps = [];
  }

  _hasLastGoodPaint() {
    return this._paintCommits > 0
      && this._contentSignature !== null
      && this._frameBitmaps.length > 0;
  }

  _failInput(result) {
    this._stopAnim();
    this._releaseBitmaps();
    super._failInput(result);
  }

  _releaseSurface() {
    this._stopAnim();
    this._releaseBitmaps();
    this._scrollOffsetX = 0;
    this._scrollPixel = 0;
    this._displayFrame = 0;
    super._releaseSurface();
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    this._canvas = document.createElement("canvas");
    this._canvas.setAttribute("aria-hidden", "true");
    shadow.append(this._style, this._canvas);
    this._style.textContent = HOST_STATIC_CANVAS;
    this._writeHost(false, { worldX: 0, worldY: 0, stackRank: 1, w: 0, h: 0 });
  }

  _hostBox(attrs, validated, frameIndex = 0) {
    const frame = validated.frames[frameIndex] ?? validated.frames[0];
    const layout = validated.layout;
    if (layout) {
      return {
        worldX: attrs.worldX,
        worldY: attrs.worldY,
        stackRank: attrs.stackRank,
        w: layout.canvasWidth,
        h: layout.canvasHeight,
      };
    }
    const [originX, originY] = frame.draw.origin;
    const { w, h } = frame.image.source;
    const worldX = frame.draw.flip ? attrs.worldX - (w - originX) : attrs.worldX - originX;
    const worldY = attrs.worldY - originY;
    return { worldX, worldY, stackRank: attrs.stackRank, w, h };
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    writeHostPlacement(this._style, shown, box, "worldX", "worldY", true);
  }

  _clearCanvas() {
    if (!this._canvas) return;
    this._canvas.width = 0;
    this._canvas.height = 0;
    this._clearCommits += 1;
  }

  _applyInput() {
    if (!this._canvas || !this._attrsSeen) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    const attrs = validateWorldAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const data = validateMapObjectData(this._data);
    if (!data.ok) return this._failInput(data);
    const validated = data.value;
    const contentSignature = mapObjectContentSignature(validated);
    const layoutSignature = mapObjectLayoutSignature(validated);
    const box = this._hostBox(attrs.value, validated, this._displayFrame);
    const hasLastGood = this._hasLastGoodPaint();
    if (hasLastGood && contentSignature === this._paintedSignature && this._state === "ready") {
      if (layoutSignature !== this._layoutSignature) {
        this._relayoutViewportSurface(attrs.value.visible, box, validated);
        this._contentSignature = contentSignature;
        this._layoutSignature = layoutSignature;
        return;
      }
      this._writeHost(attrs.value.visible, box);
      this._syncAnimLoop();
      return;
    }
    const keepBitmaps = contentSignature === this._paintedSignature && this._state === "ready";
    if (keepBitmaps) {
      this._writeHost(attrs.value.visible, box);
      this._syncAnimLoop();
      return;
    }
    if (contentSignature === this._loadingSignature) return;
    this._stopAnim();
    if (!hasLastGood) this._writeHost(false, box);
    this._loadingSignature = contentSignature;
    this._epoch += 1;
    const epoch = this._epoch;
    this._abort?.abort();
    const controller = new AbortController();
    this._abort = controller;
    this._state = "loading";
    this._code = null;
    this._detail = "";
    if (!hasLastGood) {
      this._releaseBitmaps();
      this._clearCanvas();
    }
    void this._loadFrames(validated, contentSignature, epoch, controller, attrs.value.visible, box);
  }

  _relayoutViewportSurface(visible, box, validated) {
    if (!this._canvas || this._frameBitmaps.length === 0) return;
    const layout = validated.layout;
    const frame = validated.frames[this._displayFrame] ?? validated.frames[0];
    const ratio = viewportPaintRatio(this);
    if (ratio === null) {
      this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "device pixel ratio is outside the field budget" });
      return;
    }
    const canvasW = layout?.canvasWidth ?? frame.image.source.w;
    const canvasH = layout?.canvasHeight ?? frame.image.source.h;
    const deviceW = Math.round(canvasW * ratio);
    const deviceH = Math.round(canvasH * ratio);
    if (!deviceCanvasFitsBudget(deviceW, deviceH)) {
      this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "map object canvas budget exceeded" });
      return;
    }
    // Animation callbacks capture the prior scroll/layout values.
    this._stopAnim();
    this._canvas.width = deviceW;
    this._canvas.height = deviceH;
    this._canvas.style.width = cssPx(canvasW);
    this._canvas.style.height = cssPx(canvasH);
    this._validated = validated;
    this._redrawFrame();
    this._writeHost(visible, box);
    this._syncAnimLoop();
  }

  _fitUnlaidFrameCanvas(frame) {
    if (!this._canvas || !frame || this._validated?.layout) return;
    const canvasW = frame.image.source.w;
    const canvasH = frame.image.source.h;
    if (this._canvas.style.width === cssPx(canvasW) && this._canvas.style.height === cssPx(canvasH)) return;
    const ratio = viewportPaintRatio(this);
    if (ratio === null) return;
    const deviceW = Math.round(canvasW * ratio);
    const deviceH = Math.round(canvasH * ratio);
    if (!deviceCanvasFitsBudget(deviceW, deviceH)) return;
    this._canvas.width = deviceW;
    this._canvas.height = deviceH;
    this._canvas.style.width = cssPx(canvasW);
    this._canvas.style.height = cssPx(canvasH);
  }

  _syncAnimLoop() {
    const layout = this._validated?.layout;
    const animate = (this._validated?.frames?.length ?? 0) > 1
      && mapObjectCycleDurationMs(this._validated.frames) > 0;
    const scroll = layout?.scroll?.pixelsPerMs;
    if (!animate && !scroll) {
      this._stopAnim();
      return;
    }
    if (this._animFrame !== null) return;
    const tick = (ts) => {
      if (!this.isConnected || this._state !== "ready") {
        this._stopAnim();
        return;
      }
      let dirty = false;
      if (scroll) {
        if (this._scrollLastTs !== null) {
          const delta = ts - this._scrollLastTs;
          this._scrollOffsetX += scroll * delta;
          const pixel = Math.trunc(this._scrollOffsetX);
          if (pixel !== this._scrollPixel) {
            this._scrollPixel = pixel;
            dirty = true;
          }
        }
        this._scrollLastTs = ts;
      }
      if (animate) {
        const elapsed = ts - this._presentationStart;
        const nextFrame = mapObjectFrameIndex(this._validated.frames, elapsed);
        if (nextFrame !== this._displayFrame) {
          this._displayFrame = nextFrame;
          const declared = readDeclaredAttrs(this);
          if (declared.ok) {
            const attrs = validateWorldAttrs(declared.value);
            if (attrs.ok) this._writeHost(attrs.value.visible, this._hostBox(attrs.value, this._validated, nextFrame));
          }
          this._fitUnlaidFrameCanvas(this._validated.frames[nextFrame]);
          dirty = true;
        } else if (dirty) {
          // keep host geometry stable when only scroll moves
        }
      }
      if (dirty) {
        this._redrawFrame(false);
        this._animationPaints += 1;
      }
      this._animFrame = requestAnimationFrame(tick);
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  _redrawFrame(countCommit = true) {
    if (!this._canvas || !this._validated) return;
    const bitmap = this._frameBitmaps[this._displayFrame];
    if (!bitmap) return;
    const frame = this._validated.frames[this._displayFrame];
    const context = this._canvas.getContext("2d");
    const ratio = viewportPaintRatio(this);
    if (ratio === null) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    paintMapObjectFrame(
      context,
      bitmap,
      frame.image,
      frame.draw,
      this._validated.layout,
      this._scrollOffsetX,
    );
    if (countCommit) this._paintCommits += 1;
  }

  async _loadFrames(validated, signature, epoch, controller, visible, box) {
    const ratio = viewportPaintRatio(this);
    const bitmaps = [];
    let pendingBitmap = null;
    let adopted = false;
    try {
      if (this._context?.resources?.resource === undefined) {
        throw Object.assign(new Error("missing resource client"), { code: "CONTENT_UNAVAILABLE" });
      }
      if (ratio === null) {
        throw Object.assign(new Error("device pixel ratio is outside the field budget"), { code: "RESOURCE_LIMIT" });
      }
      const framesToLoad = mapObjectFramesToDecode(validated);
      for (const frame of framesToLoad) {
        if (epoch !== this._epoch) return;
        this._resourceReads += 1;
        const image = frame.image;
        const resource = await readSharedResource(
          this._context.resources,
          image.resource.namespace,
          image.resource.key,
          image.resource.contentVersion,
          controller.signal,
        );
        if (epoch !== this._epoch) return;
        if (resource.contentVersion !== image.resource.contentVersion) {
          throw Object.assign(new Error("content version mismatch"), { code: "CONTENT_CONFLICT" });
        }
        const mime = String(resource.mime).split(";")[0].trim().toLowerCase();
        if (mime !== "image/png") throw Object.assign(new Error("page mime is not image/png"), { code: "CONTENT_INVALID" });
        pendingBitmap = await createImageBitmap(new Blob([resource.bytes], { type: mime }));
        if (epoch !== this._epoch) return;
        if (pendingBitmap.width !== image.pageWidth || pendingBitmap.height !== image.pageHeight) {
          throw Object.assign(new Error("decoded dimensions do not match the declared resource page"), { code: "CONTENT_INVALID" });
        }
        bitmaps.push(pendingBitmap);
        pendingBitmap = null;
      }
      if (epoch !== this._epoch || !this.isConnected) return;
      const declared = readDeclaredAttrs(this);
      if (!declared.ok) return this._failInput(declared);
      const attrs = validateWorldAttrs(declared.value);
      if (!attrs.ok) return this._failInput(attrs);
      const latest = validateMapObjectData(this._data);
      if (!latest.ok) return this._failInput(latest);
      if (mapObjectContentSignature(latest.value) !== signature) return;
      validated = latest.value;
      visible = attrs.value.visible;
      box = this._hostBox(attrs.value, validated, 0);
      const layout = validated.layout;
      const frame = validated.frames[0];
      const canvasW = layout?.canvasWidth ?? frame.image.source.w;
      const canvasH = layout?.canvasHeight ?? frame.image.source.h;
      const deviceW = Math.round(canvasW * ratio);
      const deviceH = Math.round(canvasH * ratio);
      if (!deviceCanvasFitsBudget(deviceW, deviceH)) {
        throw Object.assign(new Error("map object canvas budget exceeded"), { code: "RESOURCE_LIMIT" });
      }
      this._canvas.width = deviceW;
      this._canvas.height = deviceH;
      this._canvas.style.width = cssPx(canvasW);
      this._canvas.style.height = cssPx(canvasH);
      const context = this._canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
      this._releaseBitmaps();
      this._frameBitmaps = bitmaps;
      adopted = true;
      this._validated = validated;
      this._displayFrame = 0;
      this._presentationStart = performance.now();
      this._scrollOffsetX = 0;
      this._scrollPixel = 0;
      this._redrawFrame();
      this._paintedSignature = signature;
      this._contentSignature = mapObjectContentSignature(validated);
      this._layoutSignature = mapObjectLayoutSignature(validated);
      this._loadingSignature = null;
      this._state = "ready";
      this._writeHost(visible, box);
      this._syncAnimLoop();
    } catch (error) {
      if (epoch !== this._epoch || !this.isConnected) return;
      const code = failureCode(error);
      if (code === "STALE_RENDER_RESULT") return;
      this._failPaint(epoch, code, error?.message ?? code);
    } finally {
      pendingBitmap?.close?.();
      if (!adopted) {
        for (const bitmap of bitmaps) bitmap?.close?.();
      }
      if (this._abort === controller) this._abort = null;
    }
  }

  _failPaint(epoch, code, detail) {
    if (epoch !== this._epoch) return;
    this._loadingSignature = null;
    const hasLastGood = this._hasLastGoodPaint();
    this._state = code === "INPUT_INVALID" || code === "DEPTH_PLAN_INVALID" ? "invalid" : "failed";
    this._code = code;
    this._detail = detail;
    if (!hasLastGood) {
      this._paintedSignature = null;
      this._clearCanvas();
      this._writeHost(false, this._box ?? { worldX: 0, worldY: 0, stackRank: 1, w: 0, h: 0 });
      return;
    }
    this._writeHost(this._desiredVisible, this._box);
  }
}

class MsPortalVisual extends MsStandalonePaintUnit {
  constructor() {
    super();
    this._frameBitmaps = [];
    this._presentationStart = 0;
    this._animFrame = null;
    this._displayFrame = 0;
    this._validated = null;
    this._animationPaints = 0;
    this._clipName = "hidden";
    this._clipStartedAt = 0;
    this._revealDesired = null;
    this._clipSpans = null;
  }

  diagnostics() {
    return Object.freeze({
      ...super.diagnostics(),
      animationPaints: this._animationPaints,
    });
  }

  _validatePaintData(data) {
    return validatePortalVisualData(data);
  }

  _firstPaintFrame(validated) {
    if (validated.phase === "loop") {
      const frame = validated.frames[0];
      return { image: frame.image, draw: frame.draw };
    }
    if (validated.phase === "sequence") {
      const frame = validated.clips.portalContinue[0];
      return { image: frame.image, draw: frame.draw };
    }
    return { image: validated.image, draw: validated.draw };
  }

  _stopPortalAnim() {
    if (this._animFrame !== null) cancelAnimationFrame(this._animFrame);
    this._animFrame = null;
  }

  _releasePortalBitmaps() {
    for (const bitmap of this._frameBitmaps) bitmap?.close?.();
    this._frameBitmaps = [];
    this._validated = null;
    this._displayFrame = 0;
    this._clipName = "hidden";
    this._clipSpans = null;
    this._revealDesired = null;
  }

  _failInput(result) {
    this._stopPortalAnim();
    this._releasePortalBitmaps();
    super._failInput(result);
  }

  _releaseSurface() {
    this._stopPortalAnim();
    this._releasePortalBitmaps();
    super._releaseSurface();
  }

  _applyInput() {
    if (this._data?.phase === "loop") {
      this._applyLoopInput();
      return;
    }
    if (this._data?.phase === "sequence") {
      this._applySequenceInput();
      return;
    }
    this._stopPortalAnim();
    this._releasePortalBitmaps();
    super._applyInput();
  }

  _applyLoopInput() {
    if (!this._canvas || !this._attrsSeen) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    const attrs = validateWorldAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const data = validatePortalVisualData(this._data);
    if (!data.ok) return this._failInput(data);
    const validated = data.value;
    const signature = JSON.stringify(validated);
    const box = standaloneHostBox(
      attrs.value,
      validated.frames[this._displayFrame].image,
      validated.frames[this._displayFrame].draw,
    );
    if (
      this._state === "ready"
      && signature === this._paintedSignature
      && this._frameBitmaps.length === validated.frames.length
    ) {
      this._validated = validated;
      this._writeHost(attrs.value.visible, box);
      this._syncPortalLoop();
      return;
    }
    if (signature === this._loadingSignature) return;
    this._stopPortalAnim();
    if (!this._hasLastGoodPaint()) this._writeHost(false, box);
    this._loadingSignature = signature;
    this._epoch += 1;
    const epoch = this._epoch;
    this._abort?.abort();
    const controller = new AbortController();
    this._abort = controller;
    this._state = "loading";
    this._code = null;
    this._detail = "";
    if (!this._hasLastGoodPaint()) {
      this._releasePortalBitmaps();
      this._clearCanvas();
    }
    void this._loadPortalFrames(validated, signature, epoch, controller, attrs.value.visible, box);
  }

  _syncPortalLoop() {
    const frames = this._validated?.frames;
    if (!frames || mapObjectCycleDurationMs(frames) <= 0) {
      this._stopPortalAnim();
      return;
    }
    if (this._animFrame !== null) return;
    const tick = (ts) => {
      if (!this.isConnected || this._state !== "ready" || this._validated?.phase !== "loop") {
        this._stopPortalAnim();
        return;
      }
      const nextFrame = mapObjectFrameIndex(this._validated.frames, ts - this._presentationStart);
      if (nextFrame !== this._displayFrame) {
        this._displayFrame = nextFrame;
        const frame = this._validated.frames[nextFrame];
        const declared = readDeclaredAttrs(this);
        if (declared.ok) {
          const attrs = validateWorldAttrs(declared.value);
          if (attrs.ok) {
            this._writeHost(attrs.value.visible, standaloneHostBox(attrs.value, frame.image, frame.draw));
          }
        }
        this._fitPortalFrame(frame);
        this._redrawPortalFrame(false);
        this._animationPaints += 1;
      }
      this._animFrame = requestAnimationFrame(tick);
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  _fitPortalFrame(frame) {
    if (!this._canvas || !frame) return;
    const canvasW = frame.image.source.w;
    const canvasH = frame.image.source.h;
    if (this._canvas.style.width === cssPx(canvasW) && this._canvas.style.height === cssPx(canvasH)) return;
    const ratio = viewportPaintRatio(this);
    if (ratio === null) return;
    const deviceW = Math.round(canvasW * ratio);
    const deviceH = Math.round(canvasH * ratio);
    if (!deviceCanvasFitsBudget(deviceW, deviceH)) return;
    this._canvas.width = deviceW;
    this._canvas.height = deviceH;
    this._canvas.style.width = cssPx(canvasW);
    this._canvas.style.height = cssPx(canvasH);
  }

  _redrawPortalFrame(countCommit = true) {
    if (!this._canvas || !this._validated) return;
    const bitmap = this._frameBitmaps[this._displayFrame];
    const frame = this._validated.frames[this._displayFrame];
    if (!bitmap || !frame) return;
    const ratio = viewportPaintRatio(this);
    if (ratio === null) return;
    const context = this._canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, frame.image.source.w, frame.image.source.h);
    context.globalAlpha = frame.draw.opacity / 255;
    if (frame.draw.flip) {
      context.translate(frame.image.source.w, 0);
      context.scale(-1, 1);
    }
    const { source } = frame.image;
    context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
    context.setTransform(1, 0, 0, 1, 0, 0);
    if (countCommit) this._paintCommits += 1;
  }

  async _loadPortalFrames(validated, signature, epoch, controller, visible, box) {
    const ratio = viewportPaintRatio(this);
    const bitmaps = [];
    let pendingBitmap = null;
    let adopted = false;
    try {
      if (this._context?.resources?.resource === undefined) {
        throw Object.assign(new Error("missing resource client"), { code: "CONTENT_UNAVAILABLE" });
      }
      if (ratio === null) {
        throw Object.assign(new Error("device pixel ratio is outside the field budget"), { code: "RESOURCE_LIMIT" });
      }
      for (const frame of validated.frames) {
        if (epoch !== this._epoch) return;
        this._resourceReads += 1;
        const image = frame.image;
        const resource = await readSharedResource(
          this._context.resources,
          image.resource.namespace,
          image.resource.key,
          image.resource.contentVersion,
          controller.signal,
        );
        if (epoch !== this._epoch) return;
        if (resource.contentVersion !== image.resource.contentVersion) {
          throw Object.assign(new Error("content version mismatch"), { code: "CONTENT_CONFLICT" });
        }
        const mime = String(resource.mime).split(";")[0].trim().toLowerCase();
        if (mime !== "image/png") throw Object.assign(new Error("page mime is not image/png"), { code: "CONTENT_INVALID" });
        pendingBitmap = await createImageBitmap(new Blob([resource.bytes], { type: mime }));
        if (epoch !== this._epoch) return;
        if (pendingBitmap.width !== image.pageWidth || pendingBitmap.height !== image.pageHeight) {
          throw Object.assign(new Error("decoded dimensions do not match the declared resource page"), { code: "CONTENT_INVALID" });
        }
        bitmaps.push(pendingBitmap);
        pendingBitmap = null;
      }
      if (epoch !== this._epoch || !this.isConnected) return;
      const frame = validated.frames[0];
      const deviceW = Math.round(frame.image.source.w * ratio);
      const deviceH = Math.round(frame.image.source.h * ratio);
      if (!deviceCanvasFitsBudget(deviceW, deviceH)) {
        throw Object.assign(new Error("portal canvas budget exceeded"), { code: "RESOURCE_LIMIT" });
      }
      this._canvas.width = deviceW;
      this._canvas.height = deviceH;
      this._canvas.style.width = cssPx(frame.image.source.w);
      this._canvas.style.height = cssPx(frame.image.source.h);
      this._releasePortalBitmaps();
      this._frameBitmaps = bitmaps;
      adopted = true;
      this._validated = validated;
      this._displayFrame = 0;
      this._presentationStart = performance.now();
      this._redrawPortalFrame();
      this._paintedSignature = signature;
      this._loadingSignature = null;
      this._state = "ready";
      this._code = null;
      this._detail = "";
      this._box = box;
      this._writeHost(visible, box);
      this._syncPortalLoop();
    } catch (error) {
      if (epoch !== this._epoch || !this.isConnected) return;
      const code = failureCode(error);
      if (code === "STALE_RENDER_RESULT") return;
      this._failPaint(epoch, code, error?.message ?? code, signature);
    } finally {
      pendingBitmap?.close?.();
      if (!adopted) {
        for (const bitmap of bitmaps) bitmap?.close?.();
      }
      if (this._abort === controller) this._abort = null;
    }
  }

  _sequenceAttrs() {
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return null;
    const attrs = validateWorldAttrs(declared.value);
    if (!attrs.ok) return null;
    return attrs.value;
  }

  _sequenceFrame(clip, index) {
    const frames = this._validated?.clips?.[clip];
    const span = this._clipSpans?.[clip];
    if (!frames || !span) return null;
    const frame = frames[index];
    const bitmap = this._frameBitmaps[span[0] + index];
    if (!frame || !bitmap) return null;
    return { frame, bitmap };
  }

  _paintSequenceFrame(clip, index, { shown, countCommit, countAnimation }) {
    const current = this._sequenceFrame(clip, index);
    const attrs = this._sequenceAttrs();
    if (!current || !attrs) return;
    const box = standaloneHostBox(attrs, current.frame.image, current.frame.draw);
    this._displayFrame = index;
    this._fitPortalFrame(current.frame);
    const ratio = viewportPaintRatio(this);
    if (!this._canvas || ratio === null) return;
    const context = this._canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, current.frame.image.source.w, current.frame.image.source.h);
    context.globalAlpha = current.frame.draw.opacity / 255;
    const { source } = current.frame.image;
    context.drawImage(current.bitmap, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
    context.setTransform(1, 0, 0, 1, 0, 0);
    if (countCommit) this._paintCommits += 1;
    if (countAnimation) this._animationPaints += 1;
    this._box = box;
    this._writeHost(shown, box);
  }

  _beginSequenceClip(clip) {
    this._clipName = clip;
    this._clipStartedAt = performance.now();
    this._paintSequenceFrame(clip, 0, { shown: true, countCommit: false, countAnimation: false });
    this._ensureSequenceClock();
  }

  _syncSequenceReveal(desired) {
    const next = hiddenPortalClipForDesire(this._clipName, desired);
    this._revealDesired = desired;
    if (next === "hidden") {
      this._clipName = "hidden";
      this._stopPortalAnim();
      this._paintSequenceFrame("portalContinue", 0, {
        shown: false,
        countCommit: this._paintCommits === 0,
        countAnimation: false,
      });
      return;
    }
    if (next !== this._clipName) this._beginSequenceClip(next);
  }

  _ensureSequenceClock() {
    if (this._animFrame !== null) return;
    const tick = (ts) => {
      if (!this.isConnected || this._state !== "ready" || this._validated?.phase !== "sequence") {
        this._stopPortalAnim();
        return;
      }
      const clip = this._clipName;
      if (clip === "hidden") {
        this._stopPortalAnim();
        return;
      }
      const frames = this._validated.clips[clip];
      const elapsed = ts - this._clipStartedAt;
      const loop = clip === "portalContinue";
      if (!loop && elapsed >= clipDurationMs(frames)) {
        const finished = hiddenPortalClipAfterFinish(clip, this._revealDesired);
        if (finished === "hidden") {
          this._clipName = "hidden";
          this._stopPortalAnim();
          this._paintSequenceFrame("portalContinue", 0, {
            shown: false,
            countCommit: false,
            countAnimation: false,
          });
          return;
        }
        this._beginSequenceClip(finished);
        this._animFrame = requestAnimationFrame(tick);
        return;
      }
      const nextFrame = clipFrameIndex(frames, elapsed, loop);
      if (nextFrame !== this._displayFrame) {
        this._paintSequenceFrame(clip, nextFrame, { shown: true, countCommit: false, countAnimation: true });
      }
      this._animFrame = requestAnimationFrame(tick);
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  _applySequenceInput() {
    if (!this._canvas || !this._attrsSeen) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    const attrs = validateWorldAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const data = validatePortalVisualData(this._data);
    if (!data.ok) return this._failInput(data);
    const validated = data.value;
    const signature = JSON.stringify(validated);
    const resting = validated.clips.portalContinue[0];
    const box = standaloneHostBox(attrs.value, resting.image, resting.draw);
    if (
      this._state === "ready"
      && signature === this._paintedSignature
      && this._frameBitmaps.length === validated.frames.length
    ) {
      this._validated = validated;
      this._syncSequenceReveal(attrs.value.visible);
      return;
    }
    if (signature === this._loadingSignature) return;
    this._stopPortalAnim();
    if (!this._hasLastGoodPaint()) this._writeHost(false, box);
    this._loadingSignature = signature;
    this._epoch += 1;
    const epoch = this._epoch;
    this._abort?.abort();
    const controller = new AbortController();
    this._abort = controller;
    this._state = "loading";
    this._code = null;
    this._detail = "";
    if (!this._hasLastGoodPaint()) {
      this._releasePortalBitmaps();
      this._clearCanvas();
    }
    void this._loadSequenceFrames(validated, signature, epoch, controller, attrs.value.visible, box);
  }

  async _loadSequenceFrames(validated, signature, epoch, controller, visible, box) {
    const ratio = viewportPaintRatio(this);
    const bitmaps = [];
    let pendingBitmap = null;
    let adopted = false;
    const order = ["portalStart", "portalContinue", "portalExit"];
    try {
      if (this._context?.resources?.resource === undefined) {
        throw Object.assign(new Error("missing resource client"), { code: "CONTENT_UNAVAILABLE" });
      }
      if (ratio === null) {
        throw Object.assign(new Error("device pixel ratio is outside the field budget"), { code: "RESOURCE_LIMIT" });
      }
      const spans = {};
      let cursor = 0;
      for (const clip of order) {
        const frames = validated.clips[clip];
        spans[clip] = [cursor, cursor + frames.length];
        cursor += frames.length;
        for (const frame of frames) {
          if (epoch !== this._epoch) return;
          this._resourceReads += 1;
          const image = frame.image;
          const resource = await readSharedResource(
            this._context.resources,
            image.resource.namespace,
            image.resource.key,
            image.resource.contentVersion,
            controller.signal,
          );
          if (epoch !== this._epoch) return;
          if (resource.contentVersion !== image.resource.contentVersion) {
            throw Object.assign(new Error("content version mismatch"), { code: "CONTENT_CONFLICT" });
          }
          const mime = String(resource.mime).split(";")[0].trim().toLowerCase();
          if (mime !== "image/png") throw Object.assign(new Error("page mime is not image/png"), { code: "CONTENT_INVALID" });
          pendingBitmap = await createImageBitmap(new Blob([resource.bytes], { type: mime }));
          if (epoch !== this._epoch) return;
          if (pendingBitmap.width !== image.pageWidth || pendingBitmap.height !== image.pageHeight) {
            throw Object.assign(new Error("decoded dimensions do not match the declared resource page"), { code: "CONTENT_INVALID" });
          }
          bitmaps.push(pendingBitmap);
          pendingBitmap = null;
        }
      }
      if (epoch !== this._epoch || !this.isConnected) return;
      const resting = validated.clips.portalContinue[0];
      const deviceW = Math.round(resting.image.source.w * ratio);
      const deviceH = Math.round(resting.image.source.h * ratio);
      if (!deviceCanvasFitsBudget(deviceW, deviceH)) {
        throw Object.assign(new Error("portal canvas budget exceeded"), { code: "RESOURCE_LIMIT" });
      }
      this._canvas.width = deviceW;
      this._canvas.height = deviceH;
      this._canvas.style.width = cssPx(resting.image.source.w);
      this._canvas.style.height = cssPx(resting.image.source.h);
      this._releasePortalBitmaps();
      this._frameBitmaps = bitmaps;
      this._clipSpans = spans;
      adopted = true;
      this._validated = validated;
      this._clipName = "hidden";
      this._revealDesired = null;
      this._paintedSignature = signature;
      this._loadingSignature = null;
      this._state = "ready";
      this._code = null;
      this._detail = "";
      this._box = box;
      this._syncSequenceReveal(visible);
    } catch (error) {
      if (epoch !== this._epoch || !this.isConnected) return;
      const code = failureCode(error);
      if (code === "STALE_RENDER_RESULT") return;
      this._failPaint(epoch, code, error?.message ?? code, signature);
    } finally {
      pendingBitmap?.close?.();
      if (!adopted) {
        for (const bitmap of bitmaps) bitmap?.close?.();
      }
      if (this._abort === controller) this._abort = null;
    }
  }
}

export class MsWorldItem extends SpikeElement {
  static get observedAttributes() {
    return ["world-x", "world-y", "stack-rank", "visible"];
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    shadow.append(this._style, document.createElement("slot"));
    this._style.textContent = HOST_STATIC_WORLD;
    this._writeHost(false, { worldX: 0, worldY: 0, stackRank: 1 });
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    writeHostPlacement(this._style, shown, box, "worldX", "worldY", false);
  }

  _applyInput() {
    if (!this._style || !this._attrsSeen) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    const attrs = validateWorldAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const data = validateWorldData(this._data);
    if (!data.ok) return this._failInput(data);
    this._state = "ready";
    this._code = null;
    this._detail = "";
    this._writeHost(attrs.value.visible, attrs.value);
  }
}

function defineFieldElements() {
  if (typeof customElements === "undefined") return;
  const entries = [
    ["ms-scene-view", MsSceneView],
    ["ms-map-back", MsMapBack],
    ["ms-map-batch", MsMapBatch],
    ["ms-map-object", MsMapObject],
    ["ms-portal-visual", MsPortalVisual],
    ["ms-world-item", MsWorldItem],
  ];
  for (const [tag, constructor] of entries) {
    if (customElements.get(tag) === undefined) customElements.define(tag, constructor);
  }
}

defineFieldElements();

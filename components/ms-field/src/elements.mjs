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

function failureCode(error) {
  if (error?.code === "CONTENT_NOT_FOUND") return "RESOURCE_MISSING";
  if (error?.code === "CONTENT_CONFLICT") return "CONTENT_IDENTITY_MISMATCH";
  if (error?.code === "CONTENT_CANCELLED" || error?.name === "AbortError") return "STALE_RENDER_RESULT";
  return "IMAGE_INVALID";
}

function deviceCanvasFitsBudget(width, height) {
  return width >= 1
    && height >= 1
    && width <= FIELD_CANVAS_LIMITS.maxCanvasWidth
    && height <= FIELD_CANVAS_LIMITS.maxCanvasHeight
    && width * height <= FIELD_CANVAS_LIMITS.maxCanvasPixels;
}

function backContentSignature(data) {
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

  attributeChangedCallback() {
    this._attrsSeen = true;
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
    this._writeHost(false);
  }

  _writeHost(shown) {
    this._desiredVisible = shown;
    if (!this._style) return;
    this._style.textContent = `
      :host { display:block; position:absolute; inset:0; margin:0; ${shown ? "" : "visibility:hidden;"} }
      .viewport { position:absolute; inset:0; overflow:hidden; }
      .world-plane {
        position:absolute; left:0; top:0; width:0; height:0; transform-origin:0 0;
        --ms-scene-camera-x:0px; --ms-scene-camera-y:0px;
        transform:translate(calc(-1 * var(--ms-scene-camera-x)), calc(-1 * var(--ms-scene-camera-y)));
      }
    `;
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
    this._plane.style.setProperty("--ms-scene-camera-x", cssPx(cameraX));
    this._plane.style.setProperty("--ms-scene-camera-y", cssPx(cameraY));
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
    this._paintedSignature = null;
    this._loadingSignature = null;
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    this._canvas = document.createElement("canvas");
    this._canvas.setAttribute("aria-hidden", "true");
    shadow.append(this._style, this._canvas);
    this._writeHost(false, { x: 0, y: 0, w: 0, h: 0, stackRank: 1 });
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    this._style.textContent = `
      :host {
        position:absolute; margin:0; padding:0; border:0; background:transparent; pointer-events:auto;
        left:${cssPx(box.x)}; top:${cssPx(box.y)}; width:${cssPx(box.w)}; height:${cssPx(box.h)};
        z-index:${box.stackRank}; ${shown ? "" : "visibility:hidden;"}
      }
      canvas { display:block; image-rendering:pixelated; }
    `;
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
    const attrs = validateBatchAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const data = validateBatchData(this._data);
    if (!data.ok) return this._failInput(data);
    const box = { ...data.value.bounds, stackRank: attrs.value.stackRank };
    const signature = JSON.stringify(data.value);
    if (signature === this._paintedSignature && this._state === "ready") {
      this._writeHost(attrs.value.visible, box);
      return;
    }
    this._writeHost(false, box);
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
    this._clearCanvas();
    void this._paint(data.value, signature, epoch, controller, attrs.value.visible);
  }

  async _paint(data, signature, epoch, controller, visible) {
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
      const ratio = deviceRatio();
      if (ratio === null) {
        this._failPaint(epoch, "RESOURCE_LIMIT", "device pixel ratio is outside the spike budget");
        return;
      }
      const deviceW = Math.round(data.bounds.w * ratio);
      const deviceH = Math.round(data.bounds.h * ratio);
      if (
        deviceW < 1 || deviceH < 1
        || deviceW > FIELD_CANVAS_LIMITS.maxCanvasWidth
        || deviceH > FIELD_CANVAS_LIMITS.maxCanvasHeight
        || deviceW * deviceH > FIELD_CANVAS_LIMITS.maxCanvasPixels
      ) {
        this._failPaint(epoch, "RESOURCE_LIMIT", "device canvas budget exceeded");
        return;
      }
      const offscreen = document.createElement("canvas");
      offscreen.width = deviceW;
      offscreen.height = deviceH;
      const context = offscreen.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
      for (const placement of data.placements) {
        const item = data.items[placement.sprite];
        const bitmap = decoded.get(item.page);
        const dest = placementDestRect(placement, item);
        context.save();
        context.globalAlpha = placement.opacity / 255;
        if (placement.flip) {
          context.translate(dest.x - data.bounds.x + dest.w, dest.y - data.bounds.y);
          context.scale(-1, 1);
          context.drawImage(bitmap, item.source.x, item.source.y, item.source.w, item.source.h, 0, 0, dest.w, dest.h);
        } else {
          context.drawImage(
            bitmap,
            item.source.x,
            item.source.y,
            item.source.w,
            item.source.h,
            dest.x - data.bounds.x,
            dest.y - data.bounds.y,
            dest.w,
            dest.h,
          );
        }
        context.restore();
      }
      if (epoch !== this._epoch) return;
      this._canvas.width = deviceW;
      this._canvas.height = deviceH;
      this._canvas.style.width = cssPx(data.bounds.w);
      this._canvas.style.height = cssPx(data.bounds.h);
      this._canvas.getContext("2d").drawImage(offscreen, 0, 0);
      this._paintCommits += 1;
      this._paintedSignature = signature;
      this._loadingSignature = null;
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
    this._paintedSignature = null;
    this._loadingSignature = null;
    this._state = code === "INPUT_INVALID" || code === "DEPTH_PLAN_INVALID" ? "invalid" : "failed";
    this._code = code;
    this._detail = detail;
    this._clearCanvas();
    this._writeHost(false, this._box);
  }
}

function paintBackTiles(context, bitmap, image, layout, draw, scrollOffsetX = 0) {
  if (!layout) {
    context.drawImage(bitmap, 0, 0);
    return;
  }
  const frameW = layout.frameWidth;
  const frameH = layout.frameHeight;
  const canvasW = layout.canvasWidth;
  const canvasH = layout.canvasHeight;
  const stepX = layout.tileStepX > 0 ? layout.tileStepX : frameW;
  const stepY = layout.tileStepY > 0 ? layout.tileStepY : frameH;
  context.clearRect(0, 0, canvasW, canvasH);
  const opacity = Number.isInteger(draw?.opacity) ? draw.opacity : 255;
  context.globalAlpha = opacity / 255;
  const originX = Number.isFinite(layout.tileOriginX) ? layout.tileOriginX : 0;
  const originY = Number.isFinite(layout.tileOriginY) ? layout.tileOriginY : 0;
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
      if (draw?.flip) {
        context.save();
        context.translate(x + frameW, y);
        context.scale(-1, 1);
        context.drawImage(bitmap, 0, 0, frameW, frameH, 0, 0, frameW, frameH);
        context.restore();
      } else {
        context.drawImage(bitmap, 0, 0, frameW, frameH, x, y, frameW, frameH);
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
    this._loadingSignature = null;
    this._sourceBitmap = null;
    this._scrollFrame = null;
    this._scrollOffsetX = 0;
    this._scrollLastTs = null;
    this._scrollPixel = 0;
    this._animationPaints = 0;
    this._contentSignature = null;
    this._layoutSignature = null;
  }

  diagnostics() {
    return Object.freeze({
      ...super.diagnostics(),
      animationPaints: this._animationPaints,
    });
  }

  _stopScroll() {
    if (this._scrollFrame !== null) {
      cancelAnimationFrame(this._scrollFrame);
      this._scrollFrame = null;
    }
    this._scrollLastTs = null;
  }

  _failInput(result) {
    this._stopScroll();
    this._sourceBitmap?.close?.();
    this._sourceBitmap = null;
    super._failInput(result);
  }

  _releaseSurface() {
    this._stopScroll();
    this._sourceBitmap?.close?.();
    this._sourceBitmap = null;
    this._scrollOffsetX = 0;
    this._scrollPixel = 0;
    super._releaseSurface();
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    this._canvas = document.createElement("canvas");
    this._canvas.setAttribute("aria-hidden", "true");
    shadow.append(this._style, this._canvas);
    this._writeHost(false, { viewX: 0, viewY: 0, stackRank: 1, w: 0, h: 0 });
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    this._style.textContent = `
      :host {
        position:absolute; margin:0; padding:0; border:0; background:transparent; pointer-events:none;
        left:${cssPx(box.viewX)}; top:${cssPx(box.viewY)}; width:${cssPx(box.w)}; height:${cssPx(box.h)};
        z-index:${box.stackRank}; ${shown ? "" : "visibility:hidden;"}
      }
      canvas { display:block; image-rendering:pixelated; }
    `;
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
    const attrs = validateBackAttrs(declared.value);
    if (!attrs.ok) return this._failInput(attrs);
    if (this._data === undefined) return;
    const data = validateBackData(this._data);
    if (!data.ok) return this._failInput(data);
    const image = this._data.image;
    const layout = this._data.layout ?? null;
    const box = {
      viewX: attrs.value.viewX,
      viewY: attrs.value.viewY,
      stackRank: attrs.value.stackRank,
      w: layout?.canvasWidth ?? image.pageWidth,
      h: layout?.canvasHeight ?? image.pageHeight,
    };
    const contentSignature = backContentSignature(this._data);
    const layoutSignature = backLayoutSignature(this._data);
    const contentReady = this._paintCommits > 0
      && this._paintedSignature === contentSignature
      && this._sourceBitmap !== null
      && this._state === "ready";
    if (contentReady) {
      if (layoutSignature !== this._layoutSignature) {
        this._relayoutViewportSurface(attrs.value.visible, box, this._data.layout, this._data.draw);
        this._contentSignature = contentSignature;
        this._layoutSignature = layoutSignature;
        return;
      }
      this._writeHost(attrs.value.visible, box);
      this._syncScrollLoop(this._data?.layout, this._data?.draw);
      return;
    }
    this._stopScroll();
    this._writeHost(false, box);
    if (contentSignature === this._loadingSignature) return;
    this._loadingSignature = contentSignature;
    this._epoch += 1;
    const epoch = this._epoch;
    this._abort?.abort();
    const controller = new AbortController();
    this._abort = controller;
    this._state = "loading";
    void this._paint(image, contentSignature, epoch, controller, attrs.value.visible, box);
  }

  _relayoutViewportSurface(visible, box, layout, draw) {
    if (!this._canvas || !this._sourceBitmap) return;
    const image = this._data?.image;
    if (!image) return;
    const ratio = deviceRatio();
    if (ratio === null) {
      this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "device pixel ratio is outside the field budget" });
      return;
    }
    const canvasWidth = layout?.canvasWidth ?? image.pageWidth;
    const canvasHeight = layout?.canvasHeight ?? image.pageHeight;
    const deviceW = Math.round(canvasWidth * ratio);
    const deviceH = Math.round(canvasHeight * ratio);
    if (!deviceCanvasFitsBudget(deviceW, deviceH)) {
      this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "Back canvas budget exceeded" });
      return;
    }
    // The running callback closes over layout/draw. Restart it so the next
    // animation paint cannot restore stale viewport geometry after relayout.
    this._stopScroll();
    this._canvas.width = deviceW;
    this._canvas.height = deviceH;
    this._canvas.style.width = cssPx(canvasWidth);
    this._canvas.style.height = cssPx(canvasHeight);
    this._redrawTiles(image, layout, draw);
    this._writeHost(visible, box);
    this._syncScrollLoop(layout, draw);
  }

  _redrawTiles(image, layout, draw, countCommit = true) {
    if (!this._canvas || !this._sourceBitmap) return;
    const ratio = deviceRatio();
    if (ratio === null) return;
    const context = this._canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    paintBackTiles(context, this._sourceBitmap, image, layout, draw, this._scrollOffsetX);
    if (countCommit) this._paintCommits += 1;
  }

  _syncScrollLoop(layout, draw) {
    if (!layout?.scroll?.pixelsPerMs || !this._sourceBitmap) {
      this._stopScroll();
      return;
    }
    if (this._scrollFrame !== null) return;
    const image = this._data?.image;
    const tick = (ts) => {
      if (!this.isConnected || this._state !== "ready") {
        this._stopScroll();
        return;
      }
      if (this._scrollLastTs !== null) {
        const delta = ts - this._scrollLastTs;
        this._scrollOffsetX += layout.scroll.pixelsPerMs * delta;
        const pixel = Math.trunc(this._scrollOffsetX);
        if (pixel !== this._scrollPixel) {
          this._scrollPixel = pixel;
          this._redrawTiles(image, layout, draw, false);
          this._animationPaints += 1;
        }
      }
      this._scrollLastTs = ts;
      this._scrollFrame = requestAnimationFrame(tick);
    };
    this._scrollFrame = requestAnimationFrame(tick);
  }

  async _paint(image, signature, epoch, controller, visible, box) {
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
      const ratio = deviceRatio();
      if (ratio === null) return this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "device pixel ratio is outside the field budget" });
      const latestImage = this._data.image;
      const layout = this._data?.layout ?? null;
      const draw = this._data?.draw ?? null;
      const canvasWidth = layout?.canvasWidth ?? latestImage.pageWidth;
      const canvasHeight = layout?.canvasHeight ?? latestImage.pageHeight;
      const deviceW = Math.round(canvasWidth * ratio);
      const deviceH = Math.round(canvasHeight * ratio);
      if (!deviceCanvasFitsBudget(deviceW, deviceH)) {
        return this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "Back canvas budget exceeded" });
      }
      const latestBox = {
        viewX: attrs.value.viewX,
        viewY: attrs.value.viewY,
        stackRank: attrs.value.stackRank,
        w: canvasWidth,
        h: canvasHeight,
      };
      if (epoch !== this._epoch || !this.isConnected) return;
      this._canvas.width = deviceW;
      this._canvas.height = deviceH;
      this._canvas.style.width = cssPx(canvasWidth);
      this._canvas.style.height = cssPx(canvasHeight);
      this._sourceBitmap?.close?.();
      this._sourceBitmap = bitmap;
      bitmap = null;
      this._scrollOffsetX = 0;
      this._scrollPixel = 0;
      this._redrawTiles(latestImage, layout, draw);
      this._paintedSignature = signature;
      this._contentSignature = backContentSignature(this._data);
      this._layoutSignature = backLayoutSignature(this._data);
      this._loadingSignature = null;
      this._state = "ready";
      this._writeHost(attrs.value.visible, latestBox);
      this._syncScrollLoop(layout, draw);
    } catch (error) {
      if (epoch !== this._epoch || !this.isConnected) return;
      const code = failureCode(error);
      if (code === "STALE_RENDER_RESULT") return;
      this._failInput({ code, path: "resource", detail: error?.message ?? code });
    } finally {
      bitmap?.close?.();
      if (this._abort === controller) this._abort = null;
    }
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
    this._writeHost(false, { worldX: 0, worldY: 0, stackRank: 1, w: 0, h: 0 });
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    this._style.textContent = `
      :host {
        position:absolute; margin:0; padding:0; border:0; background:transparent; pointer-events:none;
        left:${cssPx(box.worldX)}; top:${cssPx(box.worldY)}; width:${cssPx(box.w)}; height:${cssPx(box.h)};
        z-index:${box.stackRank}; ${shown ? "" : "visibility:hidden;"}
      }
      canvas { display:block; image-rendering:pixelated; }
    `;
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
      const ratio = deviceRatio();
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
    this._style.textContent = `
      :host {
        position:absolute; margin:0; padding:0; border:0; background:transparent; pointer-events:none;
        left:${cssPx(box.worldX)}; top:${cssPx(box.worldY)}; width:${cssPx(box.w)}; height:${cssPx(box.h)};
        z-index:${box.stackRank}; ${shown ? "" : "visibility:hidden;"}
      }
      canvas { display:block; image-rendering:pixelated; }
    `;
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
    const ratio = deviceRatio();
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

  _syncAnimLoop() {
    const layout = this._validated?.layout;
    const animate = Boolean(layout)
      && (this._validated?.frames?.length ?? 0) > 1
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
    const ratio = deviceRatio();
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
    const ratio = deviceRatio();
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
      const framesToLoad = validated.layout ? validated.frames : validated.frames.slice(0, 1);
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
  _validatePaintData(data) {
    return validatePortalVisualData(data);
  }

  _firstPaintFrame(validated) {
    return { image: validated.image, draw: validated.draw };
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
    this._writeHost(false, { worldX: 0, worldY: 0, stackRank: 1 });
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    this._style.textContent = `
      :host {
        position:absolute; width:0; height:0; margin:0; padding:0; border:0;
        left:${cssPx(box.worldX)}; top:${cssPx(box.worldY)}; z-index:${box.stackRank};
        ${shown ? "" : "visibility:hidden;"}
      }
    `;
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

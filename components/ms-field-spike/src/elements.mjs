import { SPIKE_CANVAS_LIMITS } from "./limits.mjs";
import {
  placementDestRect,
  validateBatchAttrs,
  validateBatchData,
  validateMarkerAttrs,
  validateMarkerData,
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
  if (!Number.isFinite(value) || value <= 0 || value > SPIKE_CANVAS_LIMITS.maxDevicePixelRatio) return null;
  return value;
}

function failureCode(error) {
  if (error?.code === "CONTENT_NOT_FOUND") return "RESOURCE_MISSING";
  if (error?.code === "CONTENT_CONFLICT") return "CONTENT_IDENTITY_MISMATCH";
  if (error?.code === "CONTENT_CANCELLED" || error?.name === "AbortError") return "STALE_RENDER_RESULT";
  return "IMAGE_INVALID";
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
        const resource = await this._context.resources.resource(
          page.resource.namespace,
          page.resource.key,
          page.resource.contentVersion,
          { signal: controller.signal },
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
        || deviceW > SPIKE_CANVAS_LIMITS.maxCanvasWidth
        || deviceH > SPIKE_CANVAS_LIMITS.maxCanvasHeight
        || deviceW * deviceH > SPIKE_CANVAS_LIMITS.maxCanvasPixels
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

export class MsSyntheticMarker extends SpikeElement {
  static get observedAttributes() {
    return [];
  }

  constructor() {
    super();
    this._paintedSignature = null;
  }

  _installShadow() {
    const shadow = this.attachShadow({ mode: "open" });
    this._style = document.createElement("style");
    this._canvas = document.createElement("canvas");
    this._canvas.setAttribute("aria-hidden", "true");
    shadow.append(this._style, this._canvas);
    this._writeHost(false, { localX: 0, localY: 0, width: 0, height: 0 });
  }

  _writeHost(shown, box = this._box) {
    this._desiredVisible = shown;
    this._box = box;
    if (!this._style || !box) return;
    this._style.textContent = `
      :host {
        position:absolute; margin:0; padding:0; border:0; background:transparent; pointer-events:auto;
        left:${cssPx(box.localX)}; top:${cssPx(box.localY)}; width:${cssPx(box.width)}; height:${cssPx(box.height)};
        ${shown ? "" : "visibility:hidden;"}
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
    if (!this._canvas) return;
    const declared = readDeclaredAttrs(this);
    if (!declared.ok) return this._failInput(declared);
    if (this._data === undefined) return;
    const data = validateMarkerData(this._data);
    if (!data.ok) return this._failInput(data);
    const signature = JSON.stringify(data.value);
    const box = data.value;
    if (signature === this._paintedSignature && this._state === "ready") {
      this._writeHost(true, box);
      return;
    }
    const ratio = deviceRatio();
    if (ratio === null) return this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "device pixel ratio is outside the spike budget" });
    const deviceW = Math.round(box.width * ratio);
    const deviceH = Math.round(box.height * ratio);
    if (deviceW * deviceH > SPIKE_CANVAS_LIMITS.maxCanvasPixels) {
      return this._failInput({ code: "RESOURCE_LIMIT", path: "canvas", detail: "marker pixel budget exceeded" });
    }
    const offscreen = document.createElement("canvas");
    offscreen.width = deviceW;
    offscreen.height = deviceH;
    const context = offscreen.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    const { r, g, b, a } = box.color;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    context.fillRect(0, 0, box.width, box.height);
    this._canvas.width = deviceW;
    this._canvas.height = deviceH;
    this._canvas.style.width = cssPx(box.width);
    this._canvas.style.height = cssPx(box.height);
    this._canvas.getContext("2d").drawImage(offscreen, 0, 0);
    this._paintCommits += 1;
    this._paintedSignature = signature;
    this._state = "ready";
    this._code = null;
    this._detail = "";
    this._writeHost(true, box);
  }
}

function defineSpikeElements() {
  if (typeof customElements === "undefined") return;
  const entries = [
    ["ms-scene-view", MsSceneView],
    ["ms-map-batch", MsMapBatch],
    ["ms-world-item", MsWorldItem],
    ["ms-synthetic-marker", MsSyntheticMarker],
  ];
  for (const [tag, constructor] of entries) {
    if (customElements.get(tag) === undefined) customElements.define(tag, constructor);
  }
}

defineSpikeElements();

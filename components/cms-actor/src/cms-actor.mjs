import {
  AVATAR_PLAN_LIMITS,
  formatSkippedLayers,
  frameDuration,
  layoutFrame,
  mirrorBounds,
  resolveActionName,
  validateAvatarPlan,
} from "./avatar-model.mjs";

const HTMLElementBase = globalThis.HTMLElement ?? class {};
const OBSERVED_ATTRIBUTES = ["x", "y", "locomotion", "facing", "skin", "face", "hair", "expression", "equips"];

/**
 * Hard capacity bound for the CACHEABLE decoded-bitmap set (LRU).
 *
 * Budget model (two tiers, both bounded):
 *  - cacheable tier: completed decode, currently unused by a paint. Strictly
 *    LRU-bounded by BOTH entry count and decoded bytes below. A completed
 *    insert enforces the bound before returning; the bound can therefore
 *    only be exceeded transiently by the working-set tier below.
 *  - working-set tier: entries that are decoding or pinned by an in-flight
 *    paint. Never evicted mid-use. Bounded by plan validation instead:
 *    <= 32 layers per frame and <= maxDecodedFrameBytes decoded bytes per
 *    frame (see AVATAR_PLAN_LIMITS), so the working set can never blow the
 *    budget by an unbounded amount and never bypasses it permanently.
 * A bitmap larger than maxBytes on its own is rejected at plan validation;
 * defensively it would be treated as uncacheable working set, never cached.
 */
export const BITMAP_CACHE_LIMITS = Object.freeze({
  maxEntries: 64,
  maxBytes: AVATAR_PLAN_LIMITS.maxDecodedFrameBytes,
});

/**
 * CMS 079 paper-doll renderer.
 * Game code resolves WZ/UOL/aliases and projects an AvatarPlanV1 into
 * RenderNode.data.avatarPlan. This element only lays out and paints that plan.
 */
export class CmsActor extends HTMLElementBase {
  static get observedAttributes() {
    return OBSERVED_ATTRIBUTES;
  }

  constructor() {
    super();
    this._context = null;
    this._plan = null;
    this._resourceCache = new Map();
    this._cacheBytes = 0;        // decoded bytes of cacheable (in-map, counted) entries
    this._loadingCount = 0;      // entries whose fetch/decode is still in flight
    this._pendingCloseCount = 0; // evicted entries whose bitmap is still pinned
    this._pendingCloseBytes = 0;
    this._abortController = null;
    this._paintEpoch = 0;
    this._paintPending = false;
    this._animationHandle = 0;
    this._lastTick = null;
    this._elapsed = 0;
    this._frameIndex = 0;
    this._activeActionName = null;
    this._oneShotAction = null;
    this._connected = false;

    if (typeof this.attachShadow === "function") {
      const shadow = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `
        :host { display:block; position:absolute; width:0; height:0; overflow:visible; pointer-events:none; }
        canvas { display:block; position:absolute; image-rendering:pixelated; image-rendering:crisp-edges; overflow:visible; }
      `;
      this._canvas = document.createElement("canvas");
      this._canvas.setAttribute("aria-hidden", "true");
      shadow.append(style, this._canvas);
    }
  }

  connectedCallback() {
    this._connected = true;
    if (!this._abortController || this._abortController.signal.aborted) {
      this._abortController = new AbortController();
    }
    this._syncPosition();
    this._requestPaint();
  }

  disconnectedCallback() {
    this._connected = false;
    this._paintEpoch += 1;
    this._paintPending = false;
    if (this._animationHandle) cancelAnimationFrame(this._animationHandle);
    this._animationHandle = 0;
    this._lastTick = null;
    this._abortController?.abort();
    this._abortController = null;
    this._disposeCache();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "x" || name === "y") {
      // Coordinates move the host element; do not repaint the same sprite.
      this._syncPosition();
      return;
    }
    if ((name === "locomotion" || name === "facing") && this._connected) this._requestPaint();
    // skin/face/hair/equips are selectors for the game-side adapter. Their
    // resolved appearance arrives in the next retained avatarPlan update.
  }

  /** Called by LoomRealm before the first managed insertion. */
  receiveRenderContext(context) {
    if (this._context && this._context !== context) return;
    this._context = context;
    this._requestPaint();
  }

  /** Receives the full retained RenderNode.data object. */
  receiveRenderData(data) {
    try {
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new TypeError("RenderNode.data must be an object carrying avatarPlan");
      }
      const candidate = data.avatarPlan;
      if (candidate === undefined || candidate === null) {
        throw new TypeError("avatarPlan is required in RenderNode.data");
      }
      this._plan = validateAvatarPlan(candidate);
      this._pruneResourceCache(this._plan);
      this.removeAttribute("data-render-error");
      this._activeActionName = null;
      this._frameIndex = 0;
      this._elapsed = 0;
      this._oneShotAction = null;
      this._requestPaint();
    } catch (error) {
      this._paintEpoch += 1;
      this._paintPending = false;
      this._plan = null;
      this._clearCanvas();
      this.setAttribute("data-render-error", error instanceof Error ? error.message : "Invalid avatar plan");
      this.setAttribute("data-render-state", "invalid");
      this._stopAnimation();
    }
  }

  /** Receives one-shot, transient Render Events; they are never retained in data. */
  receiveRenderEvent(event) {
    if (event?.name !== "action" || typeof event.data?.action !== "string") return;
    const actionName = event.data.action;
    if (!this._plan?.actions?.[actionName]) return;
    this._oneShotAction = actionName;
    this._activeActionName = actionName;
    this._frameIndex = 0;
    this._elapsed = 0;
    this._lastTick = null;
    this._requestPaint();
  }

  /**
   * Test/diagnostic surface (not part of the LoomRealm ABI). Reports the
   * current render state, animation position and bitmap-cache occupancy so
   * capacity and leak assertions do not need to poke private fields.
   * `entries`/`bytes` cover the CACHEABLE tier only; decoding bitmaps and
   * evicted-but-still-pinned bitmaps are reported separately.
   */
  diagnostics() {
    return Object.freeze({
      state: this.getAttribute("data-render-state"),
      action: this.getAttribute("data-action"),
      frameIndex: this._frameIndex,
      paintPending: this._paintPending,
      oneShotAction: this._oneShotAction,
      contextInjected: this._context !== null,
      cache: Object.freeze({
        entries: Math.max(0, this._resourceCache.size - this._loadingCount),
        loading: Math.max(0, this._loadingCount),
        bytes: this._cacheBytes,
        pendingClose: this._pendingCloseCount,
        pendingCloseBytes: this._pendingCloseBytes,
        maxEntries: BITMAP_CACHE_LIMITS.maxEntries,
        maxBytes: BITMAP_CACHE_LIMITS.maxBytes,
      }),
    });
  }

  _syncPosition() {
    if (!this.style) return;
    const x = this._readNumberAttribute("x", 0);
    const y = this._readNumberAttribute("y", 0);
    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
  }

  _readNumberAttribute(name, fallback) {
    const raw = this.getAttribute?.(name);
    if (raw === null || raw === undefined || raw.trim() === "") return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  _resolveActiveAction() {
    if (this._oneShotAction && this._plan?.actions?.[this._oneShotAction]) return this._oneShotAction;
    return resolveActionName(this._plan, this.getAttribute?.("locomotion") ?? "stand");
  }

  _syncActionState() {
    const next = this._resolveActiveAction();
    if (next !== this._activeActionName) {
      this._activeActionName = next;
      this._frameIndex = 0;
      this._elapsed = 0;
      this._lastTick = null;
    }
    return next;
  }

  _currentFrame() {
    const actionName = this._syncActionState();
    const action = actionName ? this._plan?.actions?.[actionName] : null;
    if (!action?.frames?.length) return null;
    this._frameIndex = Math.min(this._frameIndex, action.frames.length - 1);
    return { actionName, action, frame: action.frames[this._frameIndex] };
  }

  _requestPaint() {
    this._syncPosition();
    if (!this._connected || !this._canvas) return;
    const current = this._currentFrame();
    if (!this._context || !current) {
      this._paintEpoch += 1;
      this._paintPending = false;
      this._clearCanvas();
      this._stopAnimation();
      return;
    }
    // Pause the animation clock while a new frame is being prepared/painted.
    this._lastTick = null;
    // `_paintFrame` owns its error handling (including synchronous throws
    // from cache lookups); the safety net only fires if that handling itself
    // fails, so no rejection can ever escape unhandled.
    this._paintFrame(current).catch((error) => {
      this._paintPending = false;
      this._clearCanvas();
      this.setAttribute("data-render-state", "error");
      this.setAttribute("data-render-error", error instanceof Error ? error.message : String(error));
      this._stopAnimation();
    });
  }

  async _paintFrame(current) {
    const epoch = ++this._paintEpoch;
    this._paintPending = true;
    const { actionName, frame } = current;
    let entries = [];
    try {
      // Inside the try on purpose: `_getBitmapEntry` can throw synchronously
      // (e.g. a cross-plan dimension conflict on a cache hit) and that must
      // land in this error handling, not become an unhandled rejection.
      entries = frame.layers.map((layer) => this._getBitmapEntry(layer));
      const bitmaps = await Promise.all(entries.map((entry) => entry.promise));
      // A newer paint round, a data update or a disconnect invalidates this
      // round: stale results must never overwrite the newer action.
      if (!this._connected || epoch !== this._paintEpoch) {
        for (const entry of entries) this._unpinEntry(entry);
        return;
      }
      const layersWithBitmaps = frame.layers.map((layer, index) => ({ layer, bitmap: bitmaps[index] }));
      try {
        this._drawFrame(frame, layersWithBitmaps);
      } finally {
        for (const entry of entries) this._unpinEntry(entry);
      }
      this.setAttribute("data-render-state", "ready");
      this.removeAttribute("data-render-error");
      this.setAttribute("data-action", actionName);
      this.setAttribute("data-frame", String(this._frameIndex));
      this._paintPending = false;
      // The clock remains paused while painting; the first RAF after this
      // completion establishes a fresh timestamp before accumulating delay.
      this._ensureAnimationLoop(current.action, frame);
    } catch (error) {
      for (const entry of entries) this._unpinEntry(entry);
      if (!this._connected || epoch !== this._paintEpoch) return;
      this._paintPending = false;
      this._clearCanvas();
      this.setAttribute("data-render-state", "error");
      this.setAttribute("data-render-error", error instanceof Error ? error.message : "Unable to load avatar resources");
      this._stopAnimation();
    }
  }

  _resourceKey(resource) {
    return `${resource.namespace}\u0000${resource.key}\u0000${resource.contentVersion}`;
  }

  /** Release entries the current plan no longer references. */
  _pruneResourceCache(plan) {
    const used = new Set();
    for (const action of Object.values(plan.actions)) {
      for (const frame of action.frames) {
        for (const layer of frame.layers) used.add(this._resourceKey(layer.resource));
      }
    }
    for (const [key, entry] of [...this._resourceCache]) {
      if (used.has(key)) continue;
      this._evictEntry(key, entry);
    }
  }

  _disposeCache() {
    for (const [key, entry] of [...this._resourceCache]) this._evictEntry(key, entry);
  }

  _evictEntry(key, entry) {
    this._resourceCache.delete(key);
    entry.evicted = true;
    // Accounting moves at eviction time so `_cacheBytes` is always exactly
    // the cacheable tier, even when the close is deferred by a pin.
    if (entry.inCacheBytes) {
      entry.inCacheBytes = false;
      this._cacheBytes -= entry.byteSize;
      if (this._cacheBytes < 0) this._cacheBytes = 0;
      entry.inPendingBytes = true;
      this._pendingCloseCount += 1;
      this._pendingCloseBytes += entry.byteSize;
    }
    if (entry.pins > 0) return; // still painting; close on last unpin
    this._closeEntry(entry);
  }

  _closeEntry(entry) {
    if (entry.closed) return;
    entry.closed = true;
    entry.bitmap?.close?.();
    if (entry.inPendingBytes) {
      entry.inPendingBytes = false;
      this._pendingCloseCount -= 1;
      this._pendingCloseBytes -= entry.byteSize;
      if (this._pendingCloseCount < 0) this._pendingCloseCount = 0;
      if (this._pendingCloseBytes < 0) this._pendingCloseBytes = 0;
    }
  }

  _pinEntry(entry) {
    entry.pins += 1;
  }

  _unpinEntry(entry) {
    if (entry.pins > 0) entry.pins -= 1;
    if (entry.pins === 0 && entry.evicted && !entry.closed) this._closeEntry(entry);
  }

  /** Enforce the hard cacheable-tier bound after a completed insert. */
  _enforceCacheBound(latestKey) {
    let guard = 0;
    while (this._resourceCache.size - this._loadingCount > BITMAP_CACHE_LIMITS.maxEntries || this._cacheBytes > BITMAP_CACHE_LIMITS.maxBytes) {
      if (guard++ > 10_000) break;
      let victimKey = null;
      let pinnedVictimKey = null;
      for (const [key, entry] of this._resourceCache) {
        if (key === latestKey) continue;
        // Decoding entries are working set, never victims.
        if (entry.bitmap === null) continue;
        if (entry.pins > 0) {
          // Prefer unpinned victims (immediate byte relief); keep the oldest
          // pinned one as a fallback so the entry bound still holds.
          if (pinnedVictimKey === null) pinnedVictimKey = key;
          continue;
        }
        victimKey = key;
        break;
      }
      if (victimKey === null) victimKey = pinnedVictimKey;
      if (victimKey === null) break;
      this._evictEntry(victimKey, this._resourceCache.get(victimKey));
    }
  }

  _getBitmapEntry(layer) {
    const resource = layer.resource;
    const cacheKey = this._resourceKey(resource);
    const cached = this._resourceCache.get(cacheKey);
    if (cached) {
      // Cross-plan dimension consistency: the same Content identity must
      // decode to the same pixels it did before. A new plan declaring
      // different dimensions for a cached identity is rejected with a
      // locatable error instead of silently painting a stretched bitmap.
      if (cached.bitmap !== null && (cached.width !== layer.width || cached.height !== layer.height)) {
        throw new Error(`CONTENT_INVALID ${resource.namespace}/${resource.key} declares ${layer.width}x${layer.height} but the cached decode of the same identity and version is ${cached.width}x${cached.height}`);
      }
      // Refresh LRU recency.
      this._resourceCache.delete(cacheKey);
      this._resourceCache.set(cacheKey, cached);
      this._pinEntry(cached);
      return cached;
    }

    const controller = this._abortController ?? new AbortController();
    const entry = {
      bitmap: null, promise: null, pins: 0, evicted: false, closed: false,
      byteSize: 0, width: 0, height: 0, inCacheBytes: false, inPendingBytes: false,
    };
    this._pinEntry(entry);
    this._loadingCount += 1;
    entry.promise = this._context.resources.resource(
      resource.namespace,
      resource.key,
      resource.contentVersion,
      { signal: controller.signal },
    ).then(async (resolved) => {
      if (resolved.contentVersion !== resource.contentVersion) {
        throw new Error(`CONTENT_CONFLICT ${resource.namespace}/${resource.key} expected ${resource.contentVersion} but received ${resolved.contentVersion}`);
      }
      if (typeof resolved.mime !== "string" || !resolved.mime.split(";")[0].trim().toLowerCase().startsWith("image/")) {
        throw new Error(`CONTENT_INVALID ${resource.namespace}/${resource.key} is not an image (mime ${resolved.mime})`);
      }
      if (typeof createImageBitmap !== "function") throw new Error("createImageBitmap is not available in this browser");
      const bitmap = await createImageBitmap(new Blob([resolved.bytes], { type: resolved.mime }));
      if (bitmap.width !== layer.width || bitmap.height !== layer.height) {
        bitmap.close?.();
        throw new Error(`CONTENT_INVALID ${resource.namespace}/${resource.key} decoded to ${bitmap.width}x${bitmap.height} but the plan declares ${layer.width}x${layer.height}`);
      }
      if (!this._connected || controller.signal.aborted || this._resourceCache.get(cacheKey) !== entry) {
        bitmap.close?.();
        throw new DOMException("Avatar resource load cancelled or superseded", "AbortError");
      }
      entry.bitmap = bitmap;
      entry.width = bitmap.width;
      entry.height = bitmap.height;
      entry.byteSize = bitmap.width * bitmap.height * 4;
      this._loadingCount -= 1;
      if (entry.byteSize > BITMAP_CACHE_LIMITS.maxBytes) {
        // Plan validation rejects oversized canvases; if one still reaches
        // here it stays working set only — never cached, closed after paint.
        this._resourceCache.delete(cacheKey);
        entry.evicted = true;
        entry.inPendingBytes = true;
        this._pendingCloseCount += 1;
        this._pendingCloseBytes += entry.byteSize;
      } else {
        entry.inCacheBytes = true;
        this._cacheBytes += entry.byteSize;
        this._enforceCacheBound(cacheKey);
      }
      return bitmap;
    }).catch((error) => {
      if (!entry.closed && entry.bitmap === null) this._loadingCount -= 1;
      if (this._resourceCache.get(cacheKey) === entry) this._resourceCache.delete(cacheKey);
      if (entry.inCacheBytes) {
        entry.inCacheBytes = false;
        this._cacheBytes -= entry.byteSize;
      }
      // Surface PresentationResourceClient error codes with the full logical
      // identity so failures are locatable from the host attributes alone.
      if (error && typeof error.code === "string") {
        throw new Error(`${error.code} ${resource.namespace}/${resource.key} (expected ${resource.contentVersion})`, { cause: error });
      }
      throw error;
    });
    this._resourceCache.set(cacheKey, entry);
    return entry;
  }

  _drawFrame(frame, layersWithBitmaps) {
    const canvas = this._canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable for cms-actor");
    const facingLeft = this.getAttribute("facing") === "left";
    const mirror = Boolean(facingLeft) !== Boolean(frame.flip);
    const mirrorPivotX = frame.move?.[0] ?? 0;
    const layout = layoutFrame(frame, this._plan.zOrder, 0, 0);
    const drawItems = layout.drawOrder
      .map((item) => {
        const entry = layersWithBitmaps.find((candidate) => candidate.layer === item.layer);
        return entry ? { ...item, bitmap: entry.bitmap } : null;
      })
      .filter(Boolean);

    if (drawItems.length === 0) {
      this._clearCanvas();
      return;
    }

    const rects = drawItems.map((item) => mirror
      ? mirrorBounds(item, mirrorPivotX)
      : { left: item.left, right: item.left + item.width, top: item.top, bottom: item.top + item.height });
    const minX = Math.floor(Math.min(...rects.map((rect) => rect.left)));
    const maxX = Math.ceil(Math.max(...rects.map((rect) => rect.right)));
    const minY = Math.floor(Math.min(...rects.map((rect) => rect.top)));
    const maxY = Math.ceil(Math.max(...rects.map((rect) => rect.bottom)));
    const cssWidth = Math.max(1, maxX - minX);
    const cssHeight = Math.max(1, maxY - minY);
    const dpr = Math.max(1, Number(globalThis.devicePixelRatio) || 1);

    canvas.width = Math.ceil(cssWidth * dpr);
    canvas.height = Math.ceil(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.style.left = `${minX}px`;
    canvas.style.top = `${minY}px`;
    context.imageSmoothingEnabled = false;
    const translateX = mirror ? (2 * mirrorPivotX - minX) * dpr : -minX * dpr;
    context.setTransform(dpr, 0, 0, dpr, translateX, -minY * dpr);
    if (mirror) {
      context.scale(-1, 1);
      // Chromium/Skia rasterizes a negative-scale drawImage one device pixel
      // below the analytic mirror (destination rect rounds toward lower X).
      // Compensate so flipped texels land exactly on 2*pivot - x.
      context.translate(-1, 0);
    }

    for (const item of drawItems) {
      context.drawImage(item.bitmap, item.left, item.top, item.width, item.height);
    }
    if (layout.skipped.length > 0) this.setAttribute("data-skipped-layers", formatSkippedLayers(layout.skipped));
    else this.removeAttribute("data-skipped-layers");
  }

  _ensureAnimationLoop(action, frame) {
    const canAdvance = frameDuration(frame) > 0
      && (this._oneShotAction !== null || (action.loop && action.frames.length > 1));
    if (!canAdvance) {
      this._stopAnimation();
      return;
    }
    if (!this._animationHandle) {
      this._animationHandle = requestAnimationFrame((time) => this._tick(time));
    }
  }

  _tick(time) {
    this._animationHandle = 0;
    if (!this._connected || !this._plan || this._paintPending) return;
    const current = this._currentFrame();
    if (!current) return;
    if (this._lastTick === null) {
      this._lastTick = time;
      this._ensureAnimationLoop(current.action, current.frame);
      return;
    }
    const delta = Math.min(250, Math.max(0, time - this._lastTick));
    this._lastTick = time;
    this._elapsed += delta;

    let frame = current.frame;
    let duration = frameDuration(frame);
    let changed = false;
    let safety = 0;
    while (duration > 0 && this._elapsed >= duration && safety < 32) {
      this._elapsed -= duration;
      const isLast = this._frameIndex >= current.action.frames.length - 1;
      if (isLast && this._oneShotAction) {
        this._oneShotAction = null;
        this._activeActionName = null;
        this._frameIndex = 0;
        this._elapsed = 0;
        changed = true;
        break;
      }
      if (isLast && !current.action.loop) {
        this._frameIndex = current.action.frames.length - 1;
        this._elapsed = 0;
        this._stopAnimation();
        return;
      }
      this._frameIndex = isLast ? 0 : this._frameIndex + 1;
      frame = current.action.frames[this._frameIndex];
      duration = frameDuration(frame);
      changed = true;
      safety += 1;
      if (duration === 0) break;
    }

    if (changed) {
      this._lastTick = null;
      this._requestPaint();
    } else {
      this._ensureAnimationLoop(current.action, current.frame);
    }
  }
  _stopAnimation() {
    if (this._animationHandle) cancelAnimationFrame(this._animationHandle);
    this._animationHandle = 0;
    this._lastTick = null;
  }

  _clearCanvas() {
    if (!this._canvas) return;
    const context = this._canvas.getContext?.("2d");
    context?.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._canvas.width = 1;
    this._canvas.height = 1;
    this._canvas.style.width = "1px";
    this._canvas.style.height = "1px";
    this._canvas.style.left = "0px";
    this._canvas.style.top = "0px";
  }
}

if (globalThis.customElements && !customElements.get("cms-actor")) {
  customElements.define("cms-actor", CmsActor);
}

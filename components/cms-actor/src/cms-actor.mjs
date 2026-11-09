import {
  formatSkippedLayers,
  frameDuration,
  frameHolds,
  compareDrawOrder,
  layoutFrame,
  occludedLayers,
  placeAnchoredLayers,
  resolveActionName,
  rotatePoint,
  validateAvatarPlan,
} from "./avatar-model.mjs";

function actionSignature(action) {
  if (!action) return "";
  return JSON.stringify(action.frames.map((frame) => ({
    delay: frame.delay ?? null,
    move: frame.move ?? null,
    flip: Boolean(frame.flip),
    rotate: frame.rotate ?? 0,
    showFace: frame.showFace !== false,
    layers: frame.layers.map((layer) => [
      layer.id,
      layer.z,
      layer.resource.namespace,
      layer.resource.key,
      layer.resource.contentVersion,
      layer.width,
      layer.height,
      layer.source ?? null,
      layer.origin,
      layer.priority ?? null,
      layer.tag ?? null,
    ]),
  })));
}

function expressionSignature(expression) {
  if (!expression) return "";
  return JSON.stringify({
    name: expression.name,
    frames: (expression.frames ?? []).map((frame) => ({
      delay: frame.delay ?? null,
      layers: (frame.layers ?? []).map((layer) => [
        layer.id,
        layer.resource.key,
        layer.resource.contentVersion,
        layer.width,
        layer.height,
        layer.source ?? null,
        layer.priority ?? null,
        layer.tag ?? null,
      ]),
    })),
  });
}

const HTMLElementBase = globalThis.HTMLElement ?? class {};
const OBSERVED_ATTRIBUTES = ["x", "y", "locomotion", "facing", "skin", "face", "hair", "expression", "equips"];

/**
 * Reuse up to 64 decoded atlas pages via LRU, without an image-byte budget.
 * Cropped sprite dimensions do not describe the memory used by whole pages.
 * Loading/decoding cancellation, pins and concurrent slots remain separate.
 */
export const BITMAP_CACHE_LIMITS = Object.freeze({
  maxEntries: 64,
});

/**
 * Independent final compositing-canvas allocation guard for extreme anchors
 * and devicePixelRatio. Not an atlas-image decode memory budget.
 */
export const COMPOSITE_CANVAS_LIMITS = Object.freeze({
  maxDevicePixelRatio: 8,
  maxDeviceWidth: 8_192,
  maxDeviceHeight: 8_192,
  maxDevicePixels: 3_145_728,
});

/**
 * Hard cap for concurrently-running bitmap decodes.
 *
 * `createImageBitmap` cannot be cancelled once started, so fetch
 * cancellation alone cannot bound decode work: a stream of plan
 * replacements whose responses all arrive could otherwise start unbounded
 * decodes. Every decode passes a pre-decode abort/identity gate; at most
 * this many decodes run at once; further decodes wait in an abort-aware
 * queue whose jobs are discarded (never started) as soon as their entry is
 * evicted by a newer plan or a disconnect. The queue length is bounded by
 * the plan's validated resource set, not treated as a memory budget: byte
 * bounds come from AvatarPlanV1 (data + per-frame decoded bytes) upstream.
 */
export const MAX_CONCURRENT_DECODES = 8;

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
    this._decodeActive = 0;      // createImageBitmap decodes currently running
    this._decodeQueue = [];      // decode jobs waiting for a slot (abort-aware)
    this._abortController = null;
    this._paintEpoch = 0;
    this._paintPending = false;
    this._paintScheduled = false; // a coalesced paint round is queued
    this._paintRequests = 0;      // _requestPaint calls (pre-coalescing)
    this._paintRounds = 0;        // paint rounds actually started
    this._animationHandle = 0;
    this._lastTick = null;
    this._elapsed = 0;
    this._frameIndex = 0;
    this._activeActionName = null;
    this._oneShotAction = null;
    this._pendingAction = null;
    this._fallbackAction = null;
    this._rememberedAction = null;
    this._rememberedBodyKey = null;
    this._expressionFrameIndex = 0;
    this._expressionElapsed = 0;
    this._expressionSignature = "";
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
    if (name === "locomotion") this._fallbackAction = null;
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
      const plan = validateAvatarPlan(candidate);
      const previous = this._plan;
      this._plan = plan;
      this._pruneResourceCache(plan);
      this.removeAttribute("data-render-error");
      this._adoptPlan(previous);
      this._settleZeroDelay();
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
    if (event?.name !== "action" || typeof event.data?.action !== "string" || event.data.action.length === 0) return;
    const actionName = event.data.action;
    if (!this._plan?.actions?.[actionName]) {
      this._pendingAction = actionName;
      return;
    }
    this._pendingAction = null;
    this._fallbackAction = null;
    this._oneShotAction = actionName;
    this._activeActionName = actionName;
    this._frameIndex = 0;
    this._elapsed = 0;
    this._lastTick = null;
    this._rememberPlayed(actionName);
    this._settleZeroDelay();
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
      paintRequests: this._paintRequests,
      paintRounds: this._paintRounds,
      oneShotAction: this._oneShotAction,
      pendingAction: this._pendingAction,
      fallbackAction: this._fallbackAction,
      rememberedAction: this._rememberedAction,
      rememberedBodyKey: this._rememberedBodyKey,
      expressionFrame: this._expressionFrameIndex,
      contextInjected: this._context !== null,
      decode: Object.freeze({
        active: this._decodeActive,
        queued: this._decodeQueue.length,
        maxConcurrent: MAX_CONCURRENT_DECODES,
      }),
      cache: Object.freeze({
        entries: Math.max(0, this._resourceCache.size - this._loadingCount),
        loading: Math.max(0, this._loadingCount),
        bytes: this._cacheBytes,
        pendingClose: this._pendingCloseCount,
        pendingCloseBytes: this._pendingCloseBytes,
        maxEntries: BITMAP_CACHE_LIMITS.maxEntries,
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
    if (this._fallbackAction && this._plan?.actions?.[this._fallbackAction]) return this._fallbackAction;
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
    this._rememberPlayed(next);
    return next;
  }

  _rememberPlayed(actionName) {
    if (!actionName || !this._plan?.bodyKey || !this._plan.actions?.[actionName]) return;
    this._rememberedBodyKey = this._plan.bodyKey;
    this._rememberedAction = actionName;
  }

  _standActionName(plan = this._plan) {
    const named = plan?.locomotionActions?.stand;
    if (named && plan.actions?.[named]) return named;
    return resolveActionName(plan, "stand");
  }

  /**
   * Apply the plan/event handshake from the adventure adapter contract.
   * A pending action name is consumed by this plan only. An in-progress
   * one-shot survives a plan replacement when its frame list is unchanged.
   * A bodyKey change forgets the previous body's pose.
   */
  _adoptPlan(previous) {
    const plan = this._plan;
    const pending = this._pendingAction;
    this._pendingAction = null;
    const bodyChanged = Boolean(previous?.bodyKey) && plan.bodyKey !== previous.bodyKey;
    if (bodyChanged) {
      this._rememberedAction = null;
      this._rememberedBodyKey = null;
      this._oneShotAction = null;
      this._fallbackAction = null;
    }
    const previousOneShot = bodyChanged ? null : this._oneShotAction;
    const previousFrame = this._frameIndex;
    const previousElapsed = this._elapsed;
    const previousActive = this._activeActionName;

    const assign = (actionName, keepClock) => {
      this._activeActionName = actionName;
      if (keepClock && actionName && plan.actions[actionName]) {
        this._frameIndex = Math.min(previousFrame, plan.actions[actionName].frames.length - 1);
        this._elapsed = previousElapsed;
      } else {
        this._frameIndex = 0;
        this._elapsed = 0;
      }
      this._lastTick = null;
    };
    const sameFrames = (name) => Boolean(previous?.actions?.[name])
      && actionSignature(previous.actions[name]) === actionSignature(plan.actions[name]);

    if (pending && plan.actions[pending]) {
      this._fallbackAction = null;
      this._oneShotAction = pending;
      assign(pending, false);
    } else if (pending) {
      const remembered = !bodyChanged && plan.bodyKey && this._rememberedBodyKey === plan.bodyKey
        ? this._rememberedAction
        : null;
      const stand = this._standActionName(plan);
      const walk = plan.locomotionActions?.walk;
      const jump = plan.locomotionActions?.jump;
      if (remembered && plan.actions[remembered]) {
        const locomotion = remembered === stand || remembered === walk || remembered === jump;
        this._fallbackAction = null;
        if (locomotion) {
          this._oneShotAction = null;
          assign(remembered, previousActive === remembered && sameFrames(remembered));
        } else {
          this._oneShotAction = remembered;
          assign(remembered, sameFrames(remembered));
        }
      } else if (plan.bodyKey) {
        this._oneShotAction = null;
        this._fallbackAction = stand;
        assign(stand, false);
      } else {
        this._oneShotAction = null;
        this._fallbackAction = null;
        assign(this._resolveActiveAction(), false);
      }
    } else if (!bodyChanged && previousOneShot && plan.actions[previousOneShot]) {
      this._fallbackAction = null;
      this._oneShotAction = previousOneShot;
      assign(previousOneShot, sameFrames(previousOneShot));
    } else {
      this._oneShotAction = null;
      this._fallbackAction = null;
      const next = this._resolveActiveAction();
      assign(next, !bodyChanged && previousActive === next && sameFrames(next));
    }

    const signature = expressionSignature(plan.expression);
    if (signature !== this._expressionSignature) {
      this._expressionFrameIndex = 0;
      this._expressionElapsed = 0;
      this._expressionSignature = signature;
    } else if (plan.expression?.frames?.length) {
      this._expressionFrameIndex = Math.min(this._expressionFrameIndex, plan.expression.frames.length - 1);
    }
    this._rememberPlayed(this._activeActionName);
  }

  _expressionLayersFor(frame) {
    if (frame?.showFace === false) return [];
    const expression = this._plan?.expression;
    if (!expression?.frames?.length) return [];
    const index = Math.min(this._expressionFrameIndex, expression.frames.length - 1);
    this._expressionFrameIndex = index;
    return expression.frames[index].layers ?? [];
  }

  /** Skip zero-duration frames before they are held. A one-shot's last zero frame ends it. */
  _settleZeroDelay() {
    let safety = 0;
    while (this._plan && safety < 32) {
      safety += 1;
      const current = this._currentFrame();
      if (!current || frameHolds(current.frame) || frameDuration(current.frame) > 0) return;
      const last = current.action.frames.length - 1;
      const isLast = this._frameIndex >= last;
      if (isLast && this._oneShotAction) {
        this._oneShotAction = null;
        this._activeActionName = null;
        this._frameIndex = 0;
        this._elapsed = 0;
        this._lastTick = null;
        continue;
      }
      if (isLast && !current.action.loop) return;
      this._frameIndex = isLast ? 0 : this._frameIndex + 1;
      this._elapsed = 0;
    }
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
    this._paintRequests += 1;
    if (this._paintScheduled) return;
    // Coalesce the burst: attribute/data/event updates from one projection
    // reconcile arrive back-to-back in the same task; they only need ONE
    // paint round reading the merged final state. Bumping the epoch here
    // invalidates any in-flight round immediately, exactly like the
    // synchronous paints this replaces.
    this._paintScheduled = true;
    this._paintEpoch += 1;
    queueMicrotask(() => {
      this._paintScheduled = false;
      if (!this._connected || !this._canvas) return;
      this._settleZeroDelay();
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
    });
  }

  async _paintFrame(current) {
    const epoch = ++this._paintEpoch;
    this._paintPending = true;
    this._paintRounds += 1;
    const { actionName, frame } = current;
    const entries = [];
    try {
      // Acquire one by one: `_getBitmapEntry` can throw synchronously (e.g. a
      // cross-plan dimension conflict on a cache hit) partway through the
      // frame, and every pin acquired before the throw must still be
      // released — the finally below is the single release path for every
      // outcome (sync throw, stale discard, draw failure, success).
      const expressionLayers = this._expressionLayersFor(frame);
      const layers = [...frame.layers, ...expressionLayers];
      for (const layer of layers) entries.push(this._getBitmapEntry(layer));
      const bitmaps = await Promise.all(entries.map((entry) => entry.promise));
      // One cold atlas page can satisfy several layers before the decode
      // finishes. Validate every requested crop, not only the first layer
      // that started the shared resource read.
      for (let index = 0; index < layers.length; index += 1) {
        const layer = layers[index];
        const bitmap = bitmaps[index];
        if (!this._bitmapCoversLayer(layer, bitmap.width, bitmap.height)) {
          throw new Error("CONTENT_INVALID " + layer.resource.namespace + "/" + layer.resource.key
            + " crop " + JSON.stringify(layer.source ?? null) + " outside decoded page "
            + bitmap.width + "x" + bitmap.height);
        }
      }
      // A newer paint round, a data update or a disconnect invalidates this
      // round: stale results must never overwrite the newer action.
      if (!this._connected || epoch !== this._paintEpoch) return;
      this._drawFrame(frame, layers.map((layer, index) => ({ layer, bitmap: bitmaps[index] })), expressionLayers);
      this.setAttribute("data-render-state", "ready");
      this.removeAttribute("data-render-error");
      this.setAttribute("data-action", actionName);
      this.setAttribute("data-frame", String(this._frameIndex));
      if (this._plan.expression) this.setAttribute("data-expression-frame", String(this._expressionFrameIndex));
      else this.removeAttribute("data-expression-frame");
      this._paintPending = false;
      // The clock remains paused while painting; the first RAF after this
      // completion establishes a fresh timestamp before accumulating delay.
      this._ensureAnimationLoop(current.action, frame);
    } catch (error) {
      if (!this._connected || epoch !== this._paintEpoch) return;
      this._paintPending = false;
      this._clearCanvas();
      this.setAttribute("data-render-state", "error");
      this.setAttribute("data-render-error", error instanceof Error ? error.message : "Unable to load avatar resources");
      this._stopAnimation();
    } finally {
      for (const entry of entries) this._unpinEntry(entry);
    }
  }

  _resourceKey(resource) {
    return `${resource.namespace}\u0000${resource.key}\u0000${resource.contentVersion}`;
  }

  /** Release entries the current plan no longer references. */
  _pruneResourceCache(plan) {
    const used = new Set();
    const collect = (frames) => {
      for (const frame of frames ?? []) {
        for (const layer of frame.layers ?? []) used.add(this._resourceKey(layer.resource));
      }
    };
    for (const action of Object.values(plan.actions)) collect(action.frames);
    collect(plan.expression?.frames);
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
    // A stale plan (or disconnect) no longer wants this identity: cancel an
    // in-flight read NOW so delayed responses cannot accumulate unbounded
    // loading/pinned/pending-close work behind the cacheable-tier bound.
    // Entries still referenced by the latest plan are never evicted (pruning
    // keeps them; the LRU bound only picks completed entries), so this never
    // cancels a live plan's read. Completed bitmaps have no read to cancel
    // and keep the deferred-close-on-unpin semantics.
    if (entry.bitmap === null && !entry.controller.signal.aborted) entry.controller.abort();
    // A queued (not yet started) decode for this entry must never start.
    entry.decodeJob?.cancel();
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

  /** Abort/identity gate evaluated before EVERY decode start. */
  _assertDecodeStillWanted(cacheKey, entry, controller) {
    if (!this._connected || controller.signal.aborted || entry.evicted || entry.closed
      || this._resourceCache.get(cacheKey) !== entry) {
      throw new DOMException("Avatar resource decode cancelled or superseded", "AbortError");
    }
  }

  /**
   * Acquire one of the bounded decode slots. When all slots are busy the job
   * queues; a queued job is spliced out and rejected (never started) as soon
   * as its entry is evicted — see `entry.decodeJob` cancellation in
   * `_evictEntry`.
   */
  _acquireDecodeSlot(entry) {
    if (this._decodeActive < MAX_CONCURRENT_DECODES) {
      this._decodeActive += 1;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const job = {
        started: false,
        start: () => {
          if (job.started) return;
          job.started = true;
          this._decodeActive += 1;
          resolve();
        },
        cancel: () => {
          if (job.started) return;
          job.started = true;
          const index = this._decodeQueue.indexOf(job);
          if (index !== -1) this._decodeQueue.splice(index, 1);
          reject(new DOMException("Avatar decode cancelled while queued", "AbortError"));
        },
      };
      entry.decodeJob = job;
      this._decodeQueue.push(job);
    });
  }

  /** Release a decode slot and hand it to the next queued job. */
  _releaseDecodeSlot() {
    this._decodeActive -= 1;
    while (this._decodeActive < MAX_CONCURRENT_DECODES && this._decodeQueue.length > 0) {
      this._decodeQueue.shift().start();
    }
  }

  /**
   * Run one bounded, guarded decode: acquire a slot (abort-aware queue),
   * re-check staleness once the slot is granted (the queue wait may have
   * straddled a plan replacement), then call the platform API. Decodes
   * themselves cannot be cancelled; the post-decode check in the caller
   * closes and discards bitmaps whose entry was superseded mid-decode.
   */
  async _decodeBitmap(cacheKey, entry, controller, blob) {
    await this._acquireDecodeSlot(entry);
    try {
      this._assertDecodeStillWanted(cacheKey, entry, controller);
      return await createImageBitmap(blob);
    } finally {
      this._releaseDecodeSlot();
    }
  }

  /** Enforce only the LRU entry-count policy after a completed insert. */
  _enforceCacheBound(latestKey) {
    let guard = 0;
    while (this._resourceCache.size - this._loadingCount > BITMAP_CACHE_LIMITS.maxEntries) {
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
      if (cached.bitmap !== null && !this._bitmapCoversLayer(layer, cached.width, cached.height)) {
        throw new Error(`CONTENT_INVALID ${resource.namespace}/${resource.key} declares ${layer.width}x${layer.height} but the cached decode of the same identity and version is ${cached.width}x${cached.height}`);
      }
      // Refresh LRU recency.
      this._resourceCache.delete(cacheKey);
      this._resourceCache.set(cacheKey, cached);
      this._pinEntry(cached);
      return cached;
    }

    // Per-entry controller: evicting a still-decoding entry (stale plan or
    // disconnect) cancels exactly this read without touching reads that the
    // latest plan still needs.
    const controller = new AbortController();
    const entry = {
      bitmap: null, promise: null, pins: 0, evicted: false, closed: false,
      byteSize: 0, width: 0, height: 0, inCacheBytes: false, inPendingBytes: false,
      controller, decodeJob: null,
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
      // Pre-decode gate: the fetch has resolved, but the plan may have been
      // replaced while the bytes were in flight (or while queued below) —
      // never hand a superseded entry to the unabortable decode API.
      this._assertDecodeStillWanted(cacheKey, entry, controller);
      const bitmap = await this._decodeBitmap(cacheKey, entry, controller, new Blob([resolved.bytes], { type: resolved.mime }));
      if (!this._bitmapCoversLayer(layer, bitmap.width, bitmap.height)) {
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
      entry.inCacheBytes = true;
      this._cacheBytes += entry.byteSize;
      this._enforceCacheBound(cacheKey);
      return bitmap;
    }).catch((error) => {
      // Single-shot loading decrement: the success path decrements exactly
      // when it assigns `entry.bitmap`, and a bitmap never returns to null,
      // so "bitmap still null" is the precise not-yet-settled condition.
      // It must NOT also require !entry.closed: a stale decode can reject
      // long after eviction already closed the (still-loading) entry.
      if (entry.bitmap === null) this._loadingCount -= 1;
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

  _bitmapCoversLayer(layer, bitmapWidth, bitmapHeight) {
    if (layer.source) {
      const source = layer.source;
      return source.x >= 0 && source.y >= 0
        && source.x + source.w <= bitmapWidth
        && source.y + source.h <= bitmapHeight;
    }
    return bitmapWidth === layer.width && bitmapHeight === layer.height;
  }

  _drawFrame(frame, layersWithBitmaps, expressionLayers = []) {
    const canvas = this._canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable for cms-actor");
    const facingLeft = this.getAttribute("facing") === "left";
    const mirror = Boolean(facingLeft) !== Boolean(frame.flip);
    const mirrorPivotX = frame.move?.[0] ?? 0;
    const layout = layoutFrame(frame, this._plan.zOrder, 0, 0);
    const base = { x: frame.move?.[0] ?? 0, y: frame.move?.[1] ?? 0 };
    const placedExpression = expressionLayers.length
      ? placeAnchoredLayers(expressionLayers, layout.anchors, base)
      : { positioned: [], skipped: [] };
    for (const item of placedExpression.positioned) item.index += frame.layers.length;
    const orderIndex = new Map(this._plan.zOrder.map((z, index) => [z, index]));
    const positioned = [...layout.positioned, ...placedExpression.positioned].sort((a, b) => compareDrawOrder(a, b, orderIndex));
    const hidden = occludedLayers(positioned, this._plan.zOrder);
    const drawItems = positioned
      .filter((item) => !hidden.has(item.layer))
      .map((item) => {
        const entry = layersWithBitmaps.find((candidate) => candidate.layer === item.layer);
        return entry ? { ...item, bitmap: entry.bitmap } : null;
      })
      .filter(Boolean);
    const skipped = [...layout.skipped, ...placedExpression.skipped];

    if (drawItems.length === 0) {
      this._clearCanvas();
      if (skipped.length > 0) this.setAttribute("data-skipped-layers", formatSkippedLayers(skipped));
      else this.removeAttribute("data-skipped-layers");
      return;
    }

    const bodyItem = layout.positioned.find((item) => item.layer.id === "body") ?? layout.positioned[0];
    const originX = bodyItem?.originX ?? mirrorPivotX;
    const originY = bodyItem?.originY ?? (frame.move?.[1] ?? 0);
    const rotate = frame.rotate;
    const rects = drawItems.map((item) => {
      const corners = [
        [item.left, item.top],
        [item.left + item.width, item.top],
        [item.left + item.width, item.top + item.height],
        [item.left, item.top + item.height],
      ].map(([x, y]) => rotate ? rotatePoint(x, y, originX, originY, rotate) : [x, y]);
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (const [x, y] of corners) {
        const mirroredX = mirror ? (2 * mirrorPivotX - x) : x;
        if (mirroredX < left) left = mirroredX;
        if (mirroredX > right) right = mirroredX;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
      return { left, right, top, bottom };
    });
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let rightmost = drawItems[0];
    let lowest = drawItems[0];
    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects[index];
      if (rect.left < minX) minX = rect.left;
      if (rect.right > maxX) { maxX = rect.right; rightmost = drawItems[index]; }
      if (rect.top < minY) minY = rect.top;
      if (rect.bottom > maxY) { maxY = rect.bottom; lowest = drawItems[index]; }
    }
    minX = Math.floor(minX);
    maxX = Math.ceil(maxX);
    minY = Math.floor(minY);
    maxY = Math.ceil(maxY);
    const cssWidth = Math.max(1, maxX - minX);
    const cssHeight = Math.max(1, maxY - minY);
    // devicePixelRatio is environmental (about:flags, zoom, embedded hosts)
    // and can be absurd; clamp it so no host can scale the backing store
    // past the budget below.
    const rawDpr = Number(globalThis.devicePixelRatio);
    const dpr = Number.isFinite(rawDpr) && rawDpr > 1
      ? Math.min(rawDpr, COMPOSITE_CANVAS_LIMITS.maxDevicePixelRatio)
      : 1;

    // Plan validation bounds each SOURCE bitmap, but ±100,000 anchors/origins
    // can still separate valid layers enormously. Reject before the first
    // canvas dimension assignment, or the browser would attempt the huge
    // allocation itself.
    const deviceWidth = Math.ceil(cssWidth * dpr);
    const deviceHeight = Math.ceil(cssHeight * dpr);
    if (deviceWidth > COMPOSITE_CANVAS_LIMITS.maxDeviceWidth
      || deviceHeight > COMPOSITE_CANVAS_LIMITS.maxDeviceHeight
      || deviceWidth * deviceHeight > COMPOSITE_CANVAS_LIMITS.maxDevicePixels) {
      throw new Error(`COMPOSITE_TOO_LARGE composite canvas ${cssWidth}x${cssHeight} CSS px (${deviceWidth}x${deviceHeight} device px at dpr ${dpr}) exceeds the ${COMPOSITE_CANVAS_LIMITS.maxDeviceWidth}/${COMPOSITE_CANVAS_LIMITS.maxDeviceHeight}/${COMPOSITE_CANVAS_LIMITS.maxDevicePixels} composite budget; farthest layers: ${rightmost.layer.id} at x ${Math.round(maxX)}, ${lowest.layer.id} at y ${Math.round(maxY)}`);
    }

    // Reuse the backing store across animation frames: assigning
    // canvas.width/height (even the same value) resets the bitmap, which is
    // wasted work in the steady-animation hot path. Resize only when the
    // device dimensions actually change; otherwise clear explicitly so the
    // previous frame never bleeds through.
    const resized = canvas.width !== deviceWidth || canvas.height !== deviceHeight;
    if (resized) {
      canvas.width = deviceWidth;
      canvas.height = deviceHeight;
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.style.left = `${minX}px`;
    canvas.style.top = `${minY}px`;
    context.imageSmoothingEnabled = false;
    if (!resized) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, deviceWidth, deviceHeight);
    }
    const translateX = mirror ? (2 * mirrorPivotX - minX) * dpr : -minX * dpr;
    context.setTransform(dpr, 0, 0, dpr, translateX, -minY * dpr);
    if (mirror) {
      context.scale(-1, 1);
      // Chromium/Skia rasterizes a negative-scale drawImage one device pixel
      // below the analytic mirror (destination rect rounds toward lower X).
      // Compensate so flipped texels land exactly on 2*pivot - x.
      context.translate(-1, 0);
    }
    if (rotate) {
      context.translate(originX, originY);
      context.rotate(rotate * Math.PI / 180);
      context.translate(-originX, -originY);
    }

    for (const item of drawItems) {
      const source = item.layer.source;
      if (source) {
        context.drawImage(item.bitmap, source.x, source.y, source.w, source.h, item.left, item.top, item.width, item.height);
      } else {
        context.drawImage(item.bitmap, item.left, item.top, item.width, item.height);
      }
    }
    if (skipped.length > 0) this.setAttribute("data-skipped-layers", formatSkippedLayers(skipped));
    else this.removeAttribute("data-skipped-layers");
  }

  _expressionCanAdvance() {
    const frames = this._plan?.expression?.frames;
    if (!frames || frames.length < 2) return false;
    const frame = frames[Math.min(this._expressionFrameIndex, frames.length - 1)];
    return frame?.delay !== undefined;
  }

  _ensureAnimationLoop(action, frame) {
    const duration = frameDuration(frame);
    const holds = frameHolds(frame);
    const zeroSkips = !holds && duration === 0 && (
      this._frameIndex < action.frames.length - 1 || action.loop || this._oneShotAction
    );
    const timed = duration > 0 && (this._oneShotAction !== null || (action.loop && action.frames.length > 1));
    if (!zeroSkips && !timed && !this._expressionCanAdvance()) {
      this._stopAnimation();
      return;
    }
    if (!this._animationHandle && typeof requestAnimationFrame === "function") {
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
    this._expressionElapsed += delta;

    let frame = current.frame;
    let changed = false;
    let safety = 0;
    while (safety < 32) {
      if (frameHolds(frame)) break;
      const duration = frameDuration(frame);
      const isLast = this._frameIndex >= current.action.frames.length - 1;
      const terminalHold = isLast && !this._oneShotAction && !current.action.loop;
      if (terminalHold && duration === 0) break;
      if (duration > 0 && this._elapsed < duration) break;
      if (duration > 0) this._elapsed -= duration;
      if (isLast && this._oneShotAction) {
        this._oneShotAction = null;
        this._activeActionName = null;
        this._frameIndex = 0;
        this._elapsed = 0;
        changed = true;
        break;
      }
      if (terminalHold) {
        this._frameIndex = current.action.frames.length - 1;
        this._elapsed = 0;
        this._stopAnimation();
        break;
      }
      this._frameIndex = isLast ? 0 : this._frameIndex + 1;
      const next = this._currentFrame();
      if (!next) break;
      frame = next.frame;
      changed = true;
      safety += 1;
    }
    if (this._advanceExpression()) changed = true;

    if (changed) {
      this._lastTick = null;
      this._requestPaint();
    } else {
      this._ensureAnimationLoop(current.action, current.frame);
    }
  }

  _advanceExpression() {
    const frames = this._plan?.expression?.frames;
    if (!frames || frames.length < 2) return false;
    let changed = false;
    let safety = 0;
    while (safety < 32) {
      const index = Math.min(this._expressionFrameIndex, frames.length - 1);
      this._expressionFrameIndex = index;
      const frame = frames[index];
      if (frame.delay === undefined) break;
      const duration = frameDuration(frame);
      if (duration > 0 && this._expressionElapsed < duration) break;
      if (duration > 0) this._expressionElapsed -= duration;
      this._expressionFrameIndex = (index + 1) % frames.length;
      changed = true;
      safety += 1;
      const next = frames[this._expressionFrameIndex];
      if (next.delay === undefined) break;
      if (frameDuration(next) > 0 && this._expressionElapsed < frameDuration(next)) break;
    }
    return changed;
  }

  _stopAnimation() {
    if (this._animationHandle && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this._animationHandle);
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

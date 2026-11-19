/**
 * Adventure Map Subsystem — static Field scene (M3) on the unified Controls
 * channel provided by Base's `game-controls-input`.
 *
 * Scope:
 *   - read the published bootstrap FieldPlan record once per Frame;
 *   - project `ms-scene-view` for map `222000000` with unified depth order;
 *   - keep the pinned Controls consumer attached for canonical PWA wiring
 *     (locomotion is not yet projected — static M3);
 *   - clamp `camera-x` / `camera-y` on viewport changes;
 *   - release Controls consumer, Viewport subscription, and RenderDomain on
 *     cancel, failure, or mid-initialization errors.
 */
import { ContentReadError, cancelled, defineSubsystem, failed } from "@loomrealm/subsystem";
import { createControlsConsumer } from "@loomrealm-game/common-controls/subsystem";
import { cameraForViewport } from "../../components/ms-field/src/camera.mjs";
import {
  FIELD_PLAN_KEY,
  FIELD_PLAN_NAMESPACE,
} from "./field-plan-model.mjs";
import {
  FIELD_SCENE_ROOT_KEY,
  projectAdventureMapFieldSceneFromPlan,
} from "./field-scene-runtime.mjs";

/** Logical Subsystem key this module implements (game.json / launch.*.json). */
export const ADVENTURE_MAP_SUBSYSTEM_KEY = "adventure-map";

export { FIELD_PLAN_KEY, FIELD_PLAN_NAMESPACE, FIELD_SCENE_ROOT_KEY };

/** Stable RenderNode key of the Field scene root. */
export const ADVENTURE_FIELD_SCENE_ROOT_KEY = FIELD_SCENE_ROOT_KEY;

/** Legacy alias retained for runtime contract tests that grep node keys. */
export const ADVENTURE_PLAYER_NODE_KEY = "player:adventure";

/** Content identity of the derived bootstrap FieldPlan record. */
export const FIELD_PLAN_RECORD_NAMESPACE = FIELD_PLAN_NAMESPACE;
export const FIELD_PLAN_RECORD_KEY = FIELD_PLAN_KEY;

/** Frame-failure codes (stable, greppable, part of the slice contract). */
export const ADVENTURE_FAILURE_CODES = Object.freeze({
  fieldContentUnavailable: "ADVENTURE_FIELD_CONTENT_UNAVAILABLE",
  initFailed: "ADVENTURE_MAP_INIT_FAILED",
  inputProjectionFailed: "ADVENTURE_INPUT_PROJECTION_FAILED",
  viewportProjectionFailed: "ADVENTURE_VIEWPORT_PROJECTION_FAILED",
  unexpectedExit: "ADVENTURE_MAP_UNEXPECTED_EXIT",
});

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function failureMessage(code, cause) {
  const detail = cause instanceof Error ? cause.message : cause === undefined ? "" : String(cause);
  return detail.length === 0 ? code : `${code}: ${detail}`;
}

function contentErrorCode(cause) {
  if (cause !== null && typeof cause === "object"
    && (cause instanceof ContentReadError || cause.name === "ContentReadError")
    && typeof cause.code === "string" && cause.code.startsWith("CONTENT_")) {
    return cause.code;
  }
  return null;
}

function createAbortWait(signal) {
  let onAbort = null;
  const promise = new Promise((resolve) => {
    if (signal.aborted) {
      resolve(true);
      return;
    }
    onAbort = () => resolve(true);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  return {
    promise,
    dispose() {
      if (onAbort !== null) {
        signal.removeEventListener("abort", onAbort);
        onAbort = null;
      }
    },
  };
}

export default defineSubsystem((scope) => ({
  async frame(frame) {
    let bootstrap;
    try {
      bootstrap = await scope.content.record(FIELD_PLAN_NAMESPACE, FIELD_PLAN_KEY, { signal: frame.signal });
    } catch (cause) {
      const code = contentErrorCode(cause);
      if (frame.signal.aborted || code === "CONTENT_CANCELLED") return cancelled();
      if (code !== null) {
        return failed({ code: ADVENTURE_FAILURE_CODES.fieldContentUnavailable, message: failureMessage(code, cause) });
      }
      return failed({ code: ADVENTURE_FAILURE_CODES.initFailed, message: failureMessage("field plan record read failed", cause) });
    }
    if (frame.signal.aborted) return cancelled();

    let closed = false;
    let fatalCode = null;
    let resolveFatal = null;
    const fatalPromise = new Promise((resolve) => { resolveFatal = resolve; });
    const applySafely = (work, code = ADVENTURE_FAILURE_CODES.inputProjectionFailed) => {
      if (closed || fatalCode !== null) return;
      try {
        work();
      } catch {
        fatalCode = code;
        resolveFatal();
      }
    };

    let domain = null;
    let unsubscribeViewport = null;
    let consumer = null;
    let projection = null;
    let cameraX = null;
    let cameraY = null;

    const abortWait = createAbortWait(frame.signal);

    try {
      projection = projectAdventureMapFieldSceneFromPlan(bootstrap.value, scope.viewport.current);
      if (frame.signal.aborted) return cancelled();

      cameraX = projection.root.attrs["camera-x"];
      cameraY = projection.root.attrs["camera-y"];

      domain = scope.createRenderDomain({
        zIndex: 0,
        roots: [projection.root],
      });

      const projectCamera = () => {
        const size = scope.viewport.current;
        if (size === null || typeof size !== "object") return;
        const { width, height } = size;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
        const cam = cameraForViewport(
          projection.fieldState.player,
          size,
          { effectiveBounds: projection.effectiveBounds },
        );
        const nextX = decimalAttr(cam.cameraX);
        const nextY = decimalAttr(cam.cameraY);
        const changed = {};
        if (nextX !== cameraX) changed["camera-x"] = nextX;
        if (nextY !== cameraY) changed["camera-y"] = nextY;
        if (Object.keys(changed).length === 0) return;
        domain.update({ nodes: [{ key: FIELD_SCENE_ROOT_KEY, attrs: { set: changed } }] });
        cameraX = nextX;
        cameraY = nextY;
      };

      unsubscribeViewport = scope.viewport.subscribe(
        () => applySafely(projectCamera, ADVENTURE_FAILURE_CODES.viewportProjectionFailed),
      );
      applySafely(projectCamera, ADVENTURE_FAILURE_CODES.viewportProjectionFailed);

      consumer = createControlsConsumer(scope.presentationEvents, frame, {
        onState() {},
        onEvent() {},
      });

      await Promise.race([abortWait.promise, fatalPromise]);
      if (frame.signal.aborted) return cancelled();
      return failed({ code: fatalCode ?? ADVENTURE_FAILURE_CODES.unexpectedExit });
    } catch (cause) {
      if (frame.signal.aborted) return cancelled();
      return failed({
        code: ADVENTURE_FAILURE_CODES.initFailed,
        message: failureMessage("field scene initialization failed", cause),
      });
    } finally {
      closed = true;
      abortWait.dispose();
      consumer?.close();
      unsubscribeViewport?.();
      domain?.close();
    }
  },
}));
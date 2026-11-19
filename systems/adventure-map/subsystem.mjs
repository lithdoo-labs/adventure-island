/**
 * Adventure Map Subsystem — static Field scene (M3) on the unified Controls
 * channel provided by Base's `game-controls-input`.
 *
 * Scope:
 *   - read the published bootstrap FieldPlan record once per Frame;
 *   - project `ms-scene-view` for map `222000000` with unified depth order;
 *   - keep the pinned Controls consumer attached for canonical PWA wiring
 *     (locomotion/facing projected to ms-avatar attrs — M4 presentation only);
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
import {
  findAvatarActionClip,
  PLAYER_AVATAR_KEY,
  projectAvatarLocomotionAttrs,
} from "./avatar-locomotion.mjs";
import { presentationTimingAttrs } from "../../components/ms-avatar/src/presentation-attrs.mjs";
import { nextClipBoundaryMs } from "../../components/ms-avatar/src/presentation-timing.mjs";

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
    let heldButtons = [];
    let avatarFacing = null;
    let avatarAction = null;
    let avatarElapsedMs = 0;
    let avatarProjectedElapsed = "0";
    let avatarProjectedFrame = "0";
    let avatarClockLast = null;
    let avatarClockHandle = null;
    let avatarNode = null;

    const abortWait = createAbortWait(frame.signal);

    try {
      projection = projectAdventureMapFieldSceneFromPlan(bootstrap.value, scope.viewport.current);
      if (frame.signal.aborted) return cancelled();

      cameraX = projection.root.attrs["camera-x"];
      cameraY = projection.root.attrs["camera-y"];
      avatarNode = projection.root.children
        .find((child) => child.key === ADVENTURE_PLAYER_NODE_KEY)
        ?.children?.[0] ?? null;
      avatarFacing = avatarNode?.attrs?.facing ?? "right";
      avatarAction = avatarNode?.attrs?.action ?? "stand1";
      avatarProjectedElapsed = avatarNode?.attrs?.["elapsed-ms"] ?? "0";
      avatarProjectedFrame = avatarNode?.attrs?.["frame-index"] ?? "0";

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

      const projectAvatarPresentation = (timingState) => {
        const attrs = projectAvatarLocomotionAttrs(heldButtons, projection.fieldState, timingState);
        const changed = {};
        for (const key of ["action", "facing", "frame-index", "elapsed-ms"]) {
          if (attrs[key] === undefined) continue;
          const current = key === "action" ? avatarAction
            : key === "facing" ? avatarFacing
              : key === "frame-index" ? avatarProjectedFrame
                : avatarProjectedElapsed;
          if (attrs[key] !== current) changed[key] = attrs[key];
        }
        if (attrs.action !== undefined) avatarAction = attrs.action;
        if (attrs.facing !== undefined) avatarFacing = attrs.facing;
        if (attrs["frame-index"] !== undefined) avatarProjectedFrame = attrs["frame-index"];
        if (attrs["elapsed-ms"] !== undefined) avatarProjectedElapsed = attrs["elapsed-ms"];
        if (Object.keys(changed).length === 0) return;
        domain.update({ nodes: [{ key: PLAYER_AVATAR_KEY, attrs: { set: changed } }] });
      };

      const clearAvatarClock = () => {
        if (avatarClockHandle !== null) globalThis.clearTimeout(avatarClockHandle);
        avatarClockHandle = null;
      };

      const scheduleAvatarClock = () => {
        clearAvatarClock();
        if (closed || fatalCode !== null || domain === null) return;
        const clip = findAvatarActionClip(avatarNode, avatarAction);
        if (!clip) return;
        const delay = nextClipBoundaryMs(clip, avatarElapsedMs);
        if (delay === null) return;
        if (avatarClockLast === null) avatarClockLast = Date.now();
        avatarClockHandle = globalThis.setTimeout(tickAvatarClock, delay);
      };

      const projectAvatar = () => {
        const nextAction = projectAvatarLocomotionAttrs(heldButtons, projection.fieldState).action;
        if (nextAction !== avatarAction) {
          avatarElapsedMs = 0;
          avatarClockLast = null;
        }
        projectAvatarPresentation({
          clip: findAvatarActionClip(avatarNode, nextAction),
          elapsedMs: avatarElapsedMs,
        });
        scheduleAvatarClock();
      };

      function tickAvatarClock() {
        avatarClockHandle = null;
        if (closed || fatalCode !== null || domain === null) return;
        const time = Date.now();
        if (avatarClockLast === null) avatarClockLast = time;
        const delta = Math.max(1, time - avatarClockLast);
        avatarClockLast = time;
        avatarElapsedMs += delta;
        const clip = findAvatarActionClip(avatarNode, avatarAction);
        const timing = clip
          ? presentationTimingAttrs(clip, avatarElapsedMs)
          : { "frame-index": "0", "elapsed-ms": String(Math.floor(avatarElapsedMs)) };
        if (timing["elapsed-ms"] !== avatarProjectedElapsed || timing["frame-index"] !== avatarProjectedFrame) {
          projectAvatarPresentation({ clip, elapsedMs: avatarElapsedMs });
        }
        scheduleAvatarClock();
      }

      consumer = createControlsConsumer(scope.presentationEvents, frame, {
        onState(state) {
          applySafely(() => {
            heldButtons = Array.isArray(state?.down) ? [...state.down] : [];
            projectAvatar();
          });
        },
        onEvent() {},
      });
      projectAvatar();

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
      if (avatarClockHandle !== null) globalThis.clearTimeout(avatarClockHandle);
      avatarClockHandle = null;
      domain?.close();
    }
  },
}));

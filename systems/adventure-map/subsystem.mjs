/**
 * Adventure Map Subsystem — the single Top Active Frame consumer of the
 * unified Controls channel provided by Base's `game-controls-input`.
 *
 * Scope of this vertical slice (see docs/implementation/
 * 2026-11-06-base-adventure-map-actor-slice-draft.md):
 *   - read the published bootstrap AvatarPlan Record (`struct.AdventureAvatarPlan`
 *     / `bootstrap`) once per Frame through the real Content API;
 *   - project exactly ONE `cms-actor` centered in the current Viewport;
 *   - map the directional Controls state to locomotion/facing attrs:
 *       null → stand (keep facing), left/right → walk + facing,
 *       up → jump (keep facing), down → stand (keep facing);
 *   - release every resource (Controls consumer, Viewport subscription,
 *     RenderDomain) on cancel, failure, or mid-initialization errors.
 *
 * There is NO world movement, physics, gravity, camera, or game state here:
 * direction changes only update the minimal string attrs. The directional
 * state machine and the Controls channel consumer are the pinned LoomRealm
 * implementations — this file never re-implements held-key tracking.
 */
import { ContentReadError, cancelled, defineSubsystem, failed } from "@loomrealm/subsystem";
import {
  createControlsConsumer,
  createDirectionalControlsTracker,
} from "@loomrealm-game/common-controls/subsystem";

/** Logical Subsystem key this module implements (game.json / launch.*.json). */
export const ADVENTURE_MAP_SUBSYSTEM_KEY = "adventure-map";

/** Content identity of the derived bootstrap AvatarPlan record. */
export const AVATAR_PLAN_NAMESPACE = "struct.AdventureAvatarPlan";
export const AVATAR_PLAN_KEY = "bootstrap";

/** Stable RenderNode key of the single actor (never reused for new nodes). */
export const ADVENTURE_PLAYER_NODE_KEY = "adventure-player";

/** Frame-failure codes (stable, greppable, part of the slice contract). */
export const ADVENTURE_FAILURE_CODES = Object.freeze({
  avatarContentUnavailable: "ADVENTURE_AVATAR_CONTENT_UNAVAILABLE",
  initFailed: "ADVENTURE_MAP_INIT_FAILED",
  inputProjectionFailed: "ADVENTURE_INPUT_PROJECTION_FAILED",
  viewportProjectionFailed: "ADVENTURE_VIEWPORT_PROJECTION_FAILED",
  unexpectedExit: "ADVENTURE_MAP_UNEXPECTED_EXIT",
});

/**
 * Demo-policy direction → locomotion mapping (facing only changes for
 * left/right; `up` plays the one-shot jump, `down` stands). This table does
 * NOT extend cms-actor's public locomotion vocabulary.
 */
const LOCOMOTION_BY_DIRECTION = Object.freeze({
  left: "walk",
  right: "walk",
  up: "jump",
  down: "stand",
});

/**
 * Tentative visual offset so the body origin (near the feet) places the
 * visible character center: the actor's x/y is the body origin, not the
 * sprite center. Adjust against the real FSDB character if needed.
 */
const VIEWPORT_CENTER_Y_OFFSET = 16;

/**
 * ContentReadError originates in the Runtime Content client, which may use a
 * different module instance from this bundled executable. Recognize either
 * the imported class or its stable cross-bundle name/code shape. Do not
 * reclassify unrelated initialization errors just because their code begins
 * with "CONTENT_".
 */
function contentErrorCode(cause) {
  if (cause !== null && typeof cause === "object"
    && (cause instanceof ContentReadError || cause.name === "ContentReadError")
    && typeof cause.code === "string" && cause.code.startsWith("CONTENT_")) {
    return cause.code;
  }
  return null;
}

/** Centered body-origin position for a Viewport size (strings for attrs). */
function centeredPosition(size) {
  if (size === null || typeof size !== "object") return null;
  const { width, height } = size;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return {
    x: String(Math.round(width / 2)),
    y: String(Math.round(height / 2 + VIEWPORT_CENTER_Y_OFFSET)),
  };
}

/**
 * A cancellable abort wait: resolves when `signal` aborts (including when it
 * was already aborted), and `dispose()` removes the listener after the race
 * completes so no permanent pending Promise or leaked subscription remains.
 */
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

function failureMessage(code, cause) {
  const detail = cause instanceof Error ? cause.message : cause === undefined ? "" : String(cause);
  return detail.length === 0 ? code : `${code}: ${detail}`;
}

export default defineSubsystem((scope) => ({
  async frame(frame) {
    // 1. Read the bootstrap AvatarPlan Record (fail-closed mapping).
    let bootstrap;
    try {
      bootstrap = await scope.content.record(AVATAR_PLAN_NAMESPACE, AVATAR_PLAN_KEY, { signal: frame.signal });
    } catch (cause) {
      const code = contentErrorCode(cause);
      if (frame.signal.aborted || code === "CONTENT_CANCELLED") return cancelled();
      if (code !== null) {
        return failed({ code: ADVENTURE_FAILURE_CODES.avatarContentUnavailable, message: failureMessage(code, cause) });
      }
      return failed({ code: ADVENTURE_FAILURE_CODES.initFailed, message: failureMessage("record read failed", cause) });
    }
    if (frame.signal.aborted) return cancelled();

    // 2. Frame-local fatal gate. It MUST exist before the Controls consumer is
    //    created: `createControlsConsumer` synchronously delivers an initial
    //    empty `onState` before returning, and the pinned consumer isolates
    //    (swallows) sync exceptions and async rejections from handlers — a
    //    projection failure must instead wake the Frame below.
    let closed = false;
    let fatalCode = null;
    let resolveFatal = null;
    const fatalPromise = new Promise((resolve) => { resolveFatal = resolve; });
    const applySafely = (work, code = ADVENTURE_FAILURE_CODES.inputProjectionFailed) => {
      if (closed || fatalCode !== null) return;
      try {
        work(); // synchronous projection only — never returns a Promise
      } catch {
        fatalCode = code;
        resolveFatal();
      }
    };

    // Nullable so mid-initialization throws still clean up in `finally`.
    let domain = null;
    let unsubscribeViewport = null;
    let consumer = null;
    const directions = createDirectionalControlsTracker();
    let locomotion = "stand";
    let facing = "right";
    let position = centeredPosition(scope.viewport.current) ?? { x: "0", y: "0" };

    const abortWait = createAbortWait(frame.signal);

    try {
      domain = scope.createRenderDomain({
        zIndex: 0,
        roots: [{
          key: ADVENTURE_PLAYER_NODE_KEY,
          tag: "cms-actor",
          attrs: { x: position.x, y: position.y, locomotion, facing },
          data: { avatarPlan: bootstrap.value },
          children: [],
        }],
      });

      const projectPosition = () => {
        const next = centeredPosition(scope.viewport.current);
        if (next === null) return;
        const changed = {};
        if (next.x !== position.x) changed.x = next.x;
        if (next.y !== position.y) changed.y = next.y;
        if (Object.keys(changed).length === 0) return;
        domain.update({ nodes: [{ key: ADVENTURE_PLAYER_NODE_KEY, attrs: { set: changed } }] });
        // Commit cached attrs only after the projection succeeds.
        position = next;
      };
      unsubscribeViewport = scope.viewport.subscribe(
        () => applySafely(projectPosition, ADVENTURE_FAILURE_CODES.viewportProjectionFailed),
      );
      // The subscription alone must not swallow an already-available size.
      applySafely(projectPosition, ADVENTURE_FAILURE_CODES.viewportProjectionFailed);

      const projectDirection = () => {
        const direction = directions.direction;
        const nextLocomotion = direction === null ? "stand" : LOCOMOTION_BY_DIRECTION[direction];
        const changed = {};
        if (nextLocomotion !== locomotion) changed.locomotion = nextLocomotion;
        if ((direction === "left" || direction === "right") && facing !== direction) changed.facing = direction;
        if (Object.keys(changed).length === 0) return;
        domain.update({ nodes: [{ key: ADVENTURE_PLAYER_NODE_KEY, attrs: { set: changed } }] });
        if (changed.locomotion !== undefined) locomotion = changed.locomotion;
        if (changed.facing !== undefined) facing = changed.facing;
      };

      consumer = createControlsConsumer(scope.presentationEvents, frame, {
        onState(state) {
          applySafely(() => {
            directions.acceptState(state);
            projectDirection();
          });
        },
        onEvent(event) {
          applySafely(() => {
            directions.acceptEvent(event);
            projectDirection();
          });
        },
      });

      // 3. Stay active until cancelled or fatally failed — no natural end.
      await Promise.race([abortWait.promise, fatalPromise]);
      if (frame.signal.aborted) return cancelled();
      return failed({ code: fatalCode ?? ADVENTURE_FAILURE_CODES.unexpectedExit });
    } catch (cause) {
      if (frame.signal.aborted) return cancelled();
      return failed({ code: ADVENTURE_FAILURE_CODES.initFailed, message: failureMessage("initialization failed", cause) });
    } finally {
      closed = true;
      abortWait.dispose();
      consumer?.close();
      unsubscribeViewport?.();
      directions.reset();
      domain?.close();
    }
  },
}));

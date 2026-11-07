// Canonical Adventure Map for the first runtime slice.
//
// The Frame reads one published AvatarPlan, projects a single cms-actor, and
// maps the fixed LoomRealm directional tracker onto locomotion / facing.
// There is no world position, physics tick, or held-key state machine here.
import { ContentReadError, cancelled, defineSubsystem, failed } from "@loomrealm/subsystem";
import {
  createControlsConsumer,
  createDirectionalControlsTracker,
} from "@loomrealm-game/common-controls/subsystem";

const ACTOR_KEY = "adventure-player";
const PLAN_NAMESPACE = "struct.AdventureAvatarPlan";
const PLAN_KEY = "bootstrap";

function contentReadCode(error) {
  if (error instanceof ContentReadError) return error.code;
  // The published executable bundles its own copy of ContentReadError, while
  // the host client throws the runtime's copy. The name and code are the
  // stable contract across that boundary.
  if (error !== null && typeof error === "object" && error.name === "ContentReadError" && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

function contentOutcome(error, signal) {
  if (signal.aborted) return cancelled();
  const code = contentReadCode(error);
  if (code === "CONTENT_CANCELLED") return cancelled();
  if (code !== null) return failed({ code: "ADVENTURE_AVATAR_CONTENT_UNAVAILABLE" });
  return failed({ code: "ADVENTURE_MAP_INIT_FAILED" });
}

function viewportPoint(size) {
  if (size === null || typeof size !== "object") return null;
  const { width, height } = size;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return {
    x: String(Math.round(width / 2)),
    y: String(Math.round(height / 2 + 16)),
  };
}

function poseFor(direction, facing) {
  if (direction === "left") return { locomotion: "walk", facing: "left" };
  if (direction === "right") return { locomotion: "walk", facing: "right" };
  if (direction === "up") return { locomotion: "jump", facing };
  if (direction === "down") return { locomotion: "stand", facing };
  return { locomotion: "stand", facing };
}

function waitForAbort(signal) {
  let cancel = () => {};
  const promise = new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => resolve();
    signal.addEventListener("abort", onAbort, { once: true });
    cancel = () => signal.removeEventListener("abort", onAbort);
    if (signal.aborted) resolve();
  });
  return { promise, cancel };
}

export default defineSubsystem((scope) => ({
  async frame(frame) {
    let record;
    try {
      record = await scope.content.record(PLAN_NAMESPACE, PLAN_KEY, { signal: frame.signal });
    } catch (error) {
      return contentOutcome(error, frame.signal);
    }
    if (frame.signal.aborted) return cancelled();

    let closed = false;
    let fatalCode = null;
    let resolveFatal = () => {};
    const fatalPromise = new Promise((resolve) => {
      resolveFatal = resolve;
    });
    let consumer = null;
    let unsubscribeViewport = null;
    let domain = null;
    let directions = null;
    let removeAbort = () => {};
    const shown = { locomotion: "stand", facing: "right", x: null, y: null };

    function applySafely(work, code = "ADVENTURE_INPUT_PROJECTION_FAILED") {
      if (closed || fatalCode !== null) return;
      try {
        work();
      } catch {
        fatalCode = code;
        resolveFatal();
      }
    }

    function publish(changed) {
      if (Object.keys(changed).length === 0) return;
      domain.update({ nodes: [{ key: ACTOR_KEY, attrs: { set: changed } }] });
    }

    function applyDirection(direction) {
      const next = poseFor(direction, shown.facing);
      const changed = {};
      if (next.locomotion !== shown.locomotion) {
        shown.locomotion = next.locomotion;
        changed.locomotion = next.locomotion;
      }
      if (next.facing !== shown.facing) {
        shown.facing = next.facing;
        changed.facing = next.facing;
      }
      publish(changed);
    }

    function applyViewport(size) {
      const point = viewportPoint(size);
      if (point === null) return;
      const changed = {};
      if (point.x !== shown.x) {
        shown.x = point.x;
        changed.x = point.x;
      }
      if (point.y !== shown.y) {
        shown.y = point.y;
        changed.y = point.y;
      }
      publish(changed);
    }

    try {
      const initial = viewportPoint(scope.viewport.current) ?? { x: "0", y: "0" };
      shown.x = initial.x;
      shown.y = initial.y;
      domain = scope.createRenderDomain({
        zIndex: 0,
        roots: [{
          key: ACTOR_KEY,
          tag: "cms-actor",
          attrs: {
            x: shown.x,
            y: shown.y,
            locomotion: shown.locomotion,
            facing: shown.facing,
          },
          data: { avatarPlan: record.value },
          children: [],
        }],
      });
      unsubscribeViewport = scope.viewport.subscribe((size) => {
        applySafely(() => applyViewport(size), "ADVENTURE_VIEWPORT_PROJECTION_FAILED");
      });
      applySafely(() => applyViewport(scope.viewport.current), "ADVENTURE_VIEWPORT_PROJECTION_FAILED");
      if (fatalCode !== null) return failed({ code: fatalCode });

      directions = createDirectionalControlsTracker();
      consumer = createControlsConsumer(scope.presentationEvents, frame, {
        onState(state) {
          applySafely(() => {
            directions.acceptState(state);
            applyDirection(directions.direction);
          });
        },
        onEvent(event) {
          applySafely(() => {
            directions.acceptEvent(event);
            applyDirection(directions.direction);
          });
        },
      });
      if (fatalCode !== null) return failed({ code: fatalCode });

      const abort = waitForAbort(frame.signal);
      removeAbort = abort.cancel;
      await Promise.race([abort.promise, fatalPromise]);
      if (frame.signal.aborted) return cancelled();
      return failed({ code: fatalCode ?? "ADVENTURE_MAP_UNEXPECTED_EXIT" });
    } catch (error) {
      return contentOutcome(error, frame.signal);
    } finally {
      closed = true;
      removeAbort();
      consumer?.close();
      unsubscribeViewport?.();
      directions?.reset();
      domain?.close();
    }
  },
}));

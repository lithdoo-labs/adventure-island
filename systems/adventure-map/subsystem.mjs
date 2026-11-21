/**
 * Adventure Map Subsystem — authoritative Movement + Camera (M5) on the unified
 * Controls channel provided by Base's `game-controls-input`.
 */
import { ContentReadError, cancelled, defineSubsystem, failed } from "@loomrealm/subsystem";
import { createControlsConsumer } from "@loomrealm-game/common-controls/subsystem";
import {
  FIELD_PLAN_KEY,
  FIELD_PLAN_NAMESPACE,
} from "./field-plan-model.mjs";
import {
  FIELD_SCENE_ROOT_KEY,
  projectAdventureMapFieldSceneFromPlan,
} from "./field-scene-runtime.mjs";
import {
  controlsUpEdgeFromEvent,
  movementIntentAfterPortal,
  movementIntentFromHeldForState,
} from "./portal-controls.mjs";
import {
  bootstrapPortalState,
  contentErrorCode as portalContentErrorCode,
  evaluatePortalOnUpEdge,
  idlePortalTravelAfterFailedPrepare,
  prepareCrossMapPortalCommit,
} from "./portal-runtime-bridge.mjs";
import {
  findAvatarActionClip,
  PLAYER_AVATAR_KEY,
  PLAYER_WORLD_ITEM_KEY,
  projectAvatarLocomotionAttrs,
  projectPlayerWorldAttrs,
} from "./avatar-locomotion.mjs";
import { projectBackCameraUpdates } from "./back-view-projection.mjs";
import { projectObjFlowCameraUpdates } from "./obj-flow-view-projection.mjs";
import { applyProjectionPatches } from "./render-node-patches.mjs";
import { projectViewportRelayoutUpdates } from "./viewport-view-projection.mjs";
import { assertViewportRelayoutEnvelope } from "../../components/ms-map-adapter/src/viewport-envelope.mjs";
import {
  logicalViewportFromResolutionEvent,
  logicalViewportFromScreen,
  VIEWPORT_RESOLUTION_CHANNEL,
  wrapSceneWithViewportFrame,
} from "./viewport-frame.mjs";
import { presentationTimingAttrs } from "../../components/ms-avatar/src/presentation-attrs.mjs";
import { nextClipBoundaryMs } from "../../components/ms-avatar/src/presentation-timing.mjs";
import { movementIntentFromHeld } from "./movement-intent.mjs";
import {
  applyCrossMapPortalRenderReplace,
  authorityAfterCrossMapReplace,
} from "./portal-cross-map-commit.mjs";
import { applyMovementToFieldState } from "./movement-sim.mjs";
import {
  createMovementStateForMap,
  stepMovementForMap,
} from "./movement-step.mjs";
import { validateFootholdCollisionPlan } from "./foothold-collision-plan.mjs";
import { validateRopeCollisionPlan } from "./rope-collision-plan.mjs";
import { planSchedulerDrain } from "./simulation-scheduler.mjs";
import { validateMovementConfig } from "./movement-config.mjs";
import {
  projectInitialMovementRoot,
  projectPlayerDepthUpdate,
} from "./movement-render-projection.mjs";
import { applyCameraToFieldState } from "./camera-state.mjs";

/** Logical Subsystem key this module implements (game.json / launch.*.json). */
export const ADVENTURE_MAP_SUBSYSTEM_KEY = "adventure-map";

export { FIELD_PLAN_KEY, FIELD_PLAN_NAMESPACE, FIELD_SCENE_ROOT_KEY };

export const ADVENTURE_FIELD_SCENE_ROOT_KEY = FIELD_SCENE_ROOT_KEY;
export const ADVENTURE_PLAYER_NODE_KEY = PLAYER_WORLD_ITEM_KEY;

export const FIELD_PLAN_RECORD_NAMESPACE = FIELD_PLAN_NAMESPACE;
export const FIELD_PLAN_RECORD_KEY = FIELD_PLAN_KEY;

export const ADVENTURE_FAILURE_CODES = Object.freeze({
  fieldContentUnavailable: "ADVENTURE_FIELD_CONTENT_UNAVAILABLE",
  initFailed: "ADVENTURE_MAP_INIT_FAILED",
  inputProjectionFailed: "ADVENTURE_INPUT_PROJECTION_FAILED",
  simulationFailed: "ADVENTURE_SIMULATION_FAILED",
  viewportProjectionFailed: "ADVENTURE_VIEWPORT_PROJECTION_FAILED",
  portalSceneReplaceFailed: "ADVENTURE_PORTAL_SCENE_REPLACE_FAILED",
  unexpectedExit: "ADVENTURE_MAP_UNEXPECTED_EXIT",
});

const WALL_CLOCK_POLL_MS = 4;

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
    let activePlan = null;
    let portalIndex = null;
    let sceneEpoch = 0;
    let sceneRootKey = FIELD_SCENE_ROOT_KEY;
    let portalPrepareGeneration = 0;
    let portalPrepareAbort = null;
    let heldButtons = [];
    let activeRenderChildren = null;
    let projection = null;
    let fieldState = null;
    let movementState = null;
    let footholdCollisionPlan = null;
    let ropeCollisionPlan = null;
    let movementConfig = null;
    let cameraX = null;
    let cameraY = null;
    let projectedWorldX = null;
    let projectedWorldY = null;
    let movementIntent = movementIntentFromHeld([]);
    let jumpLatch = false;
    let avatarAction = null;
    let avatarFacing = null;
    let avatarElapsedMs = 0;
    let avatarProjectedElapsed = "0";
    let avatarProjectedFrame = "0";
    let avatarClockLast = null;
    let avatarClockHandle = null;
    let avatarNode = null;
    let simAccumulatorMs = 0;
    let wallClockHandle = null;
    let wallClockLast = null;
    let currentRanks = null;
    let projectedLayer = null;
    let projectedPlatform = null;
    let schedulerDiscardedTicks = 0;
    let projectedViewportWidth = null;
    let projectedViewportHeight = null;
    let logicalViewport = logicalViewportFromScreen(scope.viewport.current);
    let closeResolutionEvents = () => {};

    const abortWait = createAbortWait(frame.signal);

    try {
      const portalBootstrap = bootstrapPortalState(bootstrap.value);
      activePlan = portalBootstrap.activePlan;
      portalIndex = portalBootstrap.portalIndex;
      sceneEpoch = portalBootstrap.sceneEpoch;
      sceneRootKey = portalBootstrap.sceneRootKey;
      projection = projectAdventureMapFieldSceneFromPlan(activePlan, logicalViewport);
      if (!activePlan.footholdCollisionPlan) {
        throw new TypeError("AdventureFieldPlan requires footholdCollisionPlan for Movement");
      }
      if (!activePlan.ropeCollisionPlan) {
        throw new TypeError("AdventureFieldPlan requires ropeCollisionPlan for Movement");
      }
      footholdCollisionPlan = validateFootholdCollisionPlan(activePlan.footholdCollisionPlan);
      ropeCollisionPlan = validateRopeCollisionPlan(activePlan.ropeCollisionPlan);
      movementConfig = validateMovementConfig(activePlan.movementConfig);
      if (frame.signal.aborted) return cancelled();

      movementState = createMovementStateForMap({
        mapEnvironment: activePlan.mapEnvironment,
        worldX: projection.fieldState.player.worldX,
        worldY: projection.fieldState.player.worldY,
        facing: projection.fieldState.player.facing ?? "right",
        layer: projection.fieldState.player.layer ?? 0,
        platform: projection.fieldState.player.zM ?? 0,
        segments: footholdCollisionPlan.segments,
      });
      fieldState = applyMovementToFieldState(projection.fieldState, movementState);

      const initialCamera = applyCameraToFieldState(
        fieldState,
        logicalViewport,
        activePlan,
      );
      fieldState = initialCamera.fieldState;
      const cam0 = initialCamera.camera;
      cameraX = decimalAttr(cam0.cameraX);
      cameraY = decimalAttr(cam0.cameraY);
      if (logicalViewport) {
        projectedViewportWidth = logicalViewport.width;
        projectedViewportHeight = logicalViewport.height;
      }
      projectedWorldX = decimalAttr(fieldState.player.worldX);
      projectedWorldY = decimalAttr(fieldState.player.worldY);

      const renderRoot = projectInitialMovementRoot(projection.root, fieldState, cam0);
      activeRenderChildren = renderRoot.children;
      currentRanks = new Map(renderRoot.children.map((child) => [child.key, child.attrs["stack-rank"]]));
      projectedLayer = fieldState.player.layer;
      projectedPlatform = fieldState.player.zM;

      avatarNode = renderRoot.children
        .find((child) => child.key === ADVENTURE_PLAYER_NODE_KEY)
        ?.children?.[0] ?? null;
      const avatarAttrs = projectAvatarLocomotionAttrs(fieldState);
      avatarFacing = avatarAttrs.facing;
      avatarAction = avatarAttrs.action;
      avatarProjectedElapsed = avatarAttrs["elapsed-ms"];
      avatarProjectedFrame = avatarAttrs["frame-index"];

      domain = scope.createRenderDomain({
        zIndex: 0,
        roots: [wrapSceneWithViewportFrame(renderRoot)],
      });

      const diffAttrs = (next, current, keys) => {
        const changed = {};
        for (const key of keys) {
          if (next[key] === undefined) continue;
          if (next[key] !== current[key]) changed[key] = next[key];
        }
        return changed;
      };

      const adoptLogicalViewport = (size) => {
        if (size === null) return;
        if (logicalViewport !== null
          && size.width === logicalViewport.width
          && size.height === logicalViewport.height) return;
        logicalViewport = size;
        projectCamera();
      };

      const projectCamera = () => {
        const size = logicalViewport;
        if (size === null || typeof size !== "object") return;
        const { width, height } = size;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
        assertViewportRelayoutEnvelope(size);
        const viewportChanged = width !== projectedViewportWidth || height !== projectedViewportHeight;
        const cameraProjection = applyCameraToFieldState(fieldState, size, activePlan);
        fieldState = cameraProjection.fieldState;
        const cam = cameraProjection.camera;
        const nextX = decimalAttr(cam.cameraX);
        const nextY = decimalAttr(cam.cameraY);
        const nodes = [];
        const sceneChanged = diffAttrs({ "camera-x": nextX, "camera-y": nextY }, { "camera-x": cameraX, "camera-y": cameraY }, ["camera-x", "camera-y"]);
        if (Object.keys(sceneChanged).length > 0) {
          nodes.push({ key: sceneRootKey, attrs: { set: sceneChanged } });
          cameraX = nextX;
          cameraY = nextY;
        }
        let relayoutChildren = activeRenderChildren;
        if (viewportChanged) {
          const relayoutNodes = projectViewportRelayoutUpdates(activeRenderChildren, size, cam);
          for (const node of relayoutNodes) nodes.push(node);
          if (relayoutNodes.length > 0) {
            relayoutChildren = applyProjectionPatches(activeRenderChildren, relayoutNodes);
          }
          projectedViewportWidth = width;
          projectedViewportHeight = height;
        }
        const backNodes = projectBackCameraUpdates(relayoutChildren, cam);
        for (const node of backNodes) nodes.push(node);
        const objFlowNodes = projectObjFlowCameraUpdates(relayoutChildren, cam);
        for (const node of objFlowNodes) nodes.push(node);
        const attrOnlyPatches = [...backNodes, ...objFlowNodes];
        if (attrOnlyPatches.length > 0) {
          activeRenderChildren = applyProjectionPatches(relayoutChildren, attrOnlyPatches);
        } else if (relayoutChildren !== activeRenderChildren) {
          activeRenderChildren = relayoutChildren;
        }
        if (nodes.length === 0) return;
        domain.update({ nodes });
      };

      const projectWorldPosition = () => {
        const next = projectPlayerWorldAttrs(fieldState.player);
        const changed = diffAttrs(next, { "world-x": projectedWorldX, "world-y": projectedWorldY }, ["world-x", "world-y"]);
        if (Object.keys(changed).length === 0) return;
        domain.update({ nodes: [{ key: PLAYER_WORLD_ITEM_KEY, attrs: { set: changed } }] });
        projectedWorldX = next["world-x"];
        projectedWorldY = next["world-y"];
      };

      const projectPlayerDepth = () => {
        if (fieldState.player.layer === projectedLayer
          && fieldState.player.zM === projectedPlatform) return;
        const depth = projectPlayerDepthUpdate(activeRenderChildren, fieldState.player, currentRanks);
        if (depth.nodes.length > 0) domain.update({ nodes: depth.nodes });
        currentRanks = depth.nextRanks;
        projectedLayer = fieldState.player.layer;
        projectedPlatform = fieldState.player.zM;
      };

      const projectAvatarPresentation = (timingState) => {
        const attrs = projectAvatarLocomotionAttrs(fieldState, timingState);
        const changed = diffAttrs(attrs, {
          action: avatarAction,
          facing: avatarFacing,
          "frame-index": avatarProjectedFrame,
          "elapsed-ms": avatarProjectedElapsed,
        }, ["action", "facing", "frame-index", "elapsed-ms"]);
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

      const syncAvatarOnActionChange = () => {
        const nextAction = projectAvatarLocomotionAttrs(fieldState).action;
        const actionChanged = nextAction !== avatarAction;
        if (actionChanged) {
          avatarElapsedMs = 0;
          avatarClockLast = null;
        }
        projectAvatarPresentation({
          clip: findAvatarActionClip(avatarNode, nextAction),
          elapsedMs: avatarElapsedMs,
        });
        // Simulation runs every 20ms. Restarting an existing timer here would
        // starve every action frame whose duration is longer than one tick.
        if (actionChanged || avatarClockHandle === null) scheduleAvatarClock();
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

      const runSimulationTicks = (count) => {
        for (let index = 0; index < count; index += 1) {
          const jumpPressed = jumpLatch;
          if (jumpPressed) jumpLatch = false;
          movementState = stepMovementForMap(
            movementState,
            movementIntent,
            footholdCollisionPlan,
            ropeCollisionPlan,
            movementConfig,
            activePlan.mapEnvironment,
            { jumpPressed },
          );
          fieldState = applyMovementToFieldState(fieldState, movementState);
        }
        projectWorldPosition();
        projectPlayerDepth();
        projectCamera();
        syncAvatarOnActionChange();
      };

      const drainSimulation = (elapsedMs) => {
        const plan = planSchedulerDrain(elapsedMs, simAccumulatorMs);
        simAccumulatorMs = plan.nextAccumulatorMs;
        if (plan.diagnostic) {
          schedulerDiscardedTicks += plan.diagnostic.discardedTicks;
          try {
            globalThis.console?.warn?.(
              `[adventure-map] ${plan.diagnostic.code}`,
              Object.freeze({
                discardedTicks: plan.diagnostic.discardedTicks,
                totalDiscardedTicks: schedulerDiscardedTicks,
              }),
            );
          } catch {
            // Diagnostics are best-effort and never become simulation fate.
          }
        }
        if (plan.ticksToRun > 0) runSimulationTicks(plan.ticksToRun);
      };

      const viewportSize = () => logicalViewport;

      const applySameMapPortalCommit = (commit) => {
        fieldState = commit.fieldState;
        movementState = commit.movementState;
        projectWorldPosition();
        projectPlayerDepth();
        projectCamera();
        syncAvatarOnActionChange();
      };

      const cancelPortalPrepare = () => {
        if (portalPrepareAbort !== null) {
          portalPrepareAbort.abort();
          portalPrepareAbort = null;
        }
      };

      const applyCrossMapPortalCommit = (commit) => {
        // Build every value that can fail before replacing the live Render tree.
        // After replace succeeds, the remaining assignments are the atomic
        // authority commit and must not re-run projection or validation.
        const next = authorityAfterCrossMapReplace(commit);
        const renderRoot = next.renderRoot;
        const nextRanks = new Map(renderRoot.children.map((child) => [child.key, child.attrs["stack-rank"]]));
        const nextAvatarNode = renderRoot.children
          .find((child) => child.key === PLAYER_WORLD_ITEM_KEY)
          ?.children?.[0] ?? null;
        const nextCameraX = decimalAttr(next.camera.cameraX);
        const nextCameraY = decimalAttr(next.camera.cameraY);
        const nextWorldX = decimalAttr(next.fieldState.player.worldX);
        const nextWorldY = decimalAttr(next.fieldState.player.worldY);
        const avatarAttrs = projectAvatarLocomotionAttrs(next.fieldState);
        const nextMovementIntent = movementIntentAfterPortal(heldButtons, false);

        applyCrossMapPortalRenderReplace(commit, domain);

        activePlan = next.activePlan;
        projection = next.projection;
        footholdCollisionPlan = next.footholdCollisionPlan;
        ropeCollisionPlan = next.ropeCollisionPlan;
        movementConfig = next.movementConfig;
        portalIndex = next.portalIndex;
        fieldState = next.fieldState;
        movementState = next.movementState;
        sceneEpoch = next.sceneEpoch;
        sceneRootKey = next.sceneRootKey;
        activeRenderChildren = next.activeRenderChildren;
        const committedViewport = viewportSize();
        if (committedViewport && typeof committedViewport === "object") {
          projectedViewportWidth = committedViewport.width;
          projectedViewportHeight = committedViewport.height;
        } else {
          projectedViewportWidth = null;
          projectedViewportHeight = null;
        }
        currentRanks = nextRanks;
        projectedLayer = fieldState.player.layer;
        projectedPlatform = fieldState.player.zM;
        avatarNode = nextAvatarNode;
        cameraX = nextCameraX;
        cameraY = nextCameraY;
        projectedWorldX = nextWorldX;
        projectedWorldY = nextWorldY;
        avatarFacing = avatarAttrs.facing;
        avatarAction = avatarAttrs.action;
        avatarProjectedElapsed = avatarAttrs["elapsed-ms"];
        avatarProjectedFrame = avatarAttrs["frame-index"];
        avatarElapsedMs = 0;
        avatarClockLast = null;
        simAccumulatorMs = 0;
        movementIntent = nextMovementIntent;
        clearAvatarClock();
        scheduleAvatarClock();
      };

      const startCrossMapPortalPrepare = (cross) => {
        cancelPortalPrepare();
        fieldState = cross.fieldState;
        portalPrepareGeneration += 1;
        const generation = portalPrepareGeneration;
        const travelToken = cross.travelToken;
        const abortController = new AbortController();
        portalPrepareAbort = abortController;
        const onFrameAbort = () => abortController.abort();
        frame.signal.addEventListener("abort", onFrameAbort, { once: true });
        void (async () => {
          try {
            const prepared = await prepareCrossMapPortalCommit({
              scope,
              signal: abortController.signal,
              sourcePlan: activePlan,
              fieldState,
              movementState,
              sourcePortal: cross.sourcePortal,
              viewport: viewportSize(),
              travelToken,
              sceneEpoch,
            });
            if (closed || fatalCode !== null || frame.signal.aborted) return;
            if (generation !== portalPrepareGeneration) return;
            if (travelToken !== fieldState.portalTravel?.activeToken) return;
            if (!prepared.ok) {
              applySafely(() => {
                fieldState = idlePortalTravelAfterFailedPrepare(fieldState);
              });
              return;
            }
            applySafely(() => {
              try {
                applyCrossMapPortalCommit(prepared.commit);
              } catch (cause) {
                // replace failed before the authority commit. Preserve the
                // current source-map movement state and only clear travel.
                fieldState = idlePortalTravelAfterFailedPrepare(fieldState);
                throw cause;
              }
            }, ADVENTURE_FAILURE_CODES.portalSceneReplaceFailed);
          } catch (cause) {
            if (closed || fatalCode !== null || frame.signal.aborted) return;
            if (generation !== portalPrepareGeneration) return;
            if (travelToken !== fieldState.portalTravel?.activeToken) return;
            if (portalContentErrorCode(cause) === "CONTENT_CANCELLED" || abortController.signal.aborted) {
              applySafely(() => {
                fieldState = idlePortalTravelAfterFailedPrepare(fieldState);
              });
              return;
            }
            applySafely(() => {
              fieldState = idlePortalTravelAfterFailedPrepare(fieldState);
            });
          } finally {
            frame.signal.removeEventListener("abort", onFrameAbort);
            if (portalPrepareAbort === abortController) portalPrepareAbort = null;
          }
        })();
      };

      const tryPortalTravel = (upEdge) => {
        if (!upEdge) return false;
        const decision = evaluatePortalOnUpEdge({
          activePlan,
          portalIndex,
          fieldState,
          movementState,
          viewport: viewportSize(),
        });
        if (decision.type === "none") return false;
        if (decision.type === "same-map") {
          applySameMapPortalCommit(decision.commit);
          return true;
        }
        startCrossMapPortalPrepare(decision);
        return true;
      };

      const onWallClock = () => {
        if (closed || fatalCode !== null) return;
        const now = Date.now();
        const elapsed = wallClockLast === null ? WALL_CLOCK_POLL_MS : Math.max(0, now - wallClockLast);
        wallClockLast = now;
        applySafely(() => drainSimulation(elapsed), ADVENTURE_FAILURE_CODES.simulationFailed);
      };

      wallClockLast = Date.now();
      wallClockHandle = globalThis.setInterval(onWallClock, WALL_CLOCK_POLL_MS);

      unsubscribeViewport = scope.viewport.subscribe(
        () => applySafely(
          () => adoptLogicalViewport(logicalViewportFromScreen(scope.viewport.current)),
          ADVENTURE_FAILURE_CODES.viewportProjectionFailed,
        ),
      );
      const resolutionSubscription = await scope.events.subscribe(
        [VIEWPORT_RESOLUTION_CHANNEL],
        (event) => applySafely(
          () => adoptLogicalViewport(logicalViewportFromResolutionEvent(event)),
          ADVENTURE_FAILURE_CODES.viewportProjectionFailed,
        ),
      );
      closeResolutionEvents = () => resolutionSubscription?.close?.();

      consumer = createControlsConsumer(scope.presentationEvents, frame, {
        onState(state) {
          applySafely(() => {
            const down = Array.isArray(state?.down) ? state.down : [];
            heldButtons = [...down];
            const nextIntent = movementIntentFromHeldForState(down);
            if (nextIntent.jump && !movementIntent.jump) jumpLatch = true;
            movementIntent = nextIntent;
          });
        },
        onEvent(event) {
          applySafely(() => {
            const upEdge = controlsUpEdgeFromEvent(event);
            const portalConsumed = tryPortalTravel(upEdge);
            if (portalConsumed) {
              jumpLatch = false;
              movementIntent = movementIntentAfterPortal(heldButtons, true);
              return;
            }
            if (upEdge) {
              if (movementState.mode === "climb") {
                // Up is the climb axis while attached. The state publication
                // already carries it; do not reinterpret the matching event
                // as the land jump edge and detach from the rope.
                jumpLatch = false;
                movementIntent = movementIntentFromHeldForState(heldButtons);
                return;
              }
              const nextIntent = movementIntentFromHeld(heldButtons);
              if (nextIntent.jump && !movementIntent.jump) jumpLatch = true;
              movementIntent = nextIntent;
            }
          });
        },
      });

      syncAvatarOnActionChange();
      projectWorldPosition();
      projectCamera();

      await Promise.race([abortWait.promise, fatalPromise]);
      if (frame.signal.aborted) return cancelled();
      return failed({
        code: fatalCode ?? ADVENTURE_FAILURE_CODES.unexpectedExit,
        message: failureMessage(fatalCode ?? ADVENTURE_FAILURE_CODES.unexpectedExit),
      });
    } catch (cause) {
      if (frame.signal.aborted) return cancelled();
      return failed({
        code: ADVENTURE_FAILURE_CODES.initFailed,
        message: failureMessage("field scene initialization failed", cause),
      });
    } finally {
      closed = true;
      if (portalPrepareAbort !== null) {
        portalPrepareAbort.abort();
        portalPrepareAbort = null;
      }
      abortWait.dispose();
      if (wallClockHandle !== null) globalThis.clearInterval(wallClockHandle);
      wallClockHandle = null;
      consumer?.close();
      unsubscribeViewport?.();
      closeResolutionEvents();
      if (avatarClockHandle !== null) globalThis.clearTimeout(avatarClockHandle);
      avatarClockHandle = null;
      domain?.close();
    }
  },
}));

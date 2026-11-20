import { ContentReadError } from "@loomrealm/subsystem";
import { validateFieldPlan, FIELD_PLAN_NAMESPACE } from "./field-plan-model.mjs";
import { fieldPlanRecordKeyForMap } from "./field-plan-keys.mjs";
import { sceneRootKeyFromPlan } from "./field-scene-runtime.mjs";
import { selectPortalTriggerCandidate } from "./portal-trigger.mjs";
import { resolveTravelTarget } from "./portal-target-resolve.mjs";
import {
  nextPortalTravelToken,
  planCrossMapPortalCommit,
  planSameMapPortalCommit,
} from "./portal-transaction.mjs";

function contentErrorCode(cause) {
  if (cause !== null && typeof cause === "object"
    && (cause instanceof ContentReadError || cause.name === "ContentReadError")
    && typeof cause.code === "string" && cause.code.startsWith("CONTENT_")) {
    return cause.code;
  }
  return null;
}

export function bootstrapPortalState(bootstrapValue) {
  return Object.freeze({
    activePlan: bootstrapValue,
    portalIndex: bootstrapValue.portalLogicalIndex,
    sceneEpoch: bootstrapValue.sceneEpoch ?? 0,
    sceneRootKey: sceneRootKeyFromPlan(bootstrapValue),
  });
}

/**
 * @returns {{ type: "none" } | { type: "same-map", commit: object } | { type: "cross-map", sourcePortal: object, travelToken: number, fieldState: object }}
 */
export function evaluatePortalOnUpEdge({
  activePlan,
  portalIndex,
  fieldState,
  movementState,
  viewport,
}) {
  if (fieldState.portalTravel?.phase === "preparing") {
    return Object.freeze({ type: "none" });
  }
  const candidate = selectPortalTriggerCandidate(portalIndex, fieldState.player, true);
  if (!candidate) return Object.freeze({ type: "none" });

  const travelToken = nextPortalTravelToken(fieldState.portalTravel);
  const sameMap = String(candidate.targetMap) === activePlan.mapId;

  if (sameMap) {
    const resolution = resolveTravelTarget(candidate, portalIndex);
    if (!resolution.ok) return Object.freeze({ type: "none" });
    const commit = planSameMapPortalCommit({
      activePlan,
      fieldState,
      movementState,
      sourcePortal: candidate,
      targetPortal: resolution.portal,
      viewport,
      travelToken,
    });
    return Object.freeze({ type: "same-map", commit });
  }

  const nextFieldState = Object.freeze({
    ...fieldState,
    portalTravel: Object.freeze({
      ...fieldState.portalTravel,
      phase: "preparing",
      activeToken: travelToken,
    }),
  });
  return Object.freeze({
    type: "cross-map",
    sourcePortal: candidate,
    travelToken,
    fieldState: nextFieldState,
    targetMapId: String(candidate.targetMap),
  });
}

export async function prepareCrossMapPortalCommit({
  scope,
  signal,
  sourcePlan,
  fieldState,
  movementState,
  sourcePortal,
  viewport,
  travelToken,
  sceneEpoch,
}) {
  const targetMapId = String(sourcePortal.targetMap);
  const content = scope.content ?? scope;
  let record;
  try {
    record = await content.record(
      FIELD_PLAN_NAMESPACE,
      fieldPlanRecordKeyForMap(targetMapId),
      { signal },
    );
  } catch (cause) {
    if (signal.aborted || contentErrorCode(cause) === "CONTENT_CANCELLED") {
      return Object.freeze({ ok: false, code: "PORTAL_PREPARE_CANCELLED" });
    }
    throw cause;
  }
  if (signal.aborted) return Object.freeze({ ok: false, code: "PORTAL_PREPARE_CANCELLED" });
  const targetPlan = validateFieldPlan(record.value);
  if (targetPlan.mapId !== targetMapId) {
    return Object.freeze({ ok: false, code: "PORTAL_PREPARE_MAP_MISMATCH" });
  }
  const resolution = resolveTravelTarget(sourcePortal, targetPlan.portalLogicalIndex);
  if (!resolution.ok) return Object.freeze({ ok: false, code: resolution.code });
  const nextEpoch = (sceneEpoch ?? 0) + 1;
  const commit = planCrossMapPortalCommit({
    sourcePlan,
    targetPlan,
    fieldState,
    movementState,
    sourcePortal,
    targetPortal: resolution.portal,
    viewport,
    travelToken,
    nextSceneEpoch: nextEpoch,
  });
  return Object.freeze({ ok: true, commit, travelToken });
}

export function idlePortalTravelAfterFailedPrepare(fieldState) {
  return Object.freeze({
    ...fieldState,
    portalTravel: Object.freeze({
      ...fieldState.portalTravel,
      phase: "idle",
    }),
  });
}

export { contentErrorCode };
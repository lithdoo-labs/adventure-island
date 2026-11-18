/**
 * Content validator helpers — distinguish missing/empty groups,
 * missing resources, and no-visual portals without running DOM/Canvas.
 */
import {
  NO_VISUAL_PORTAL,
  RESOURCE_MISSING,
  SOURCE_ABSENT,
  SOURCE_EMPTY,
  SOURCE_PRESENT,
  VISUAL_PORTAL,
} from "./status.mjs";

export function summarizeGroupStatus(sceneOrFacts) {
  const groups = sceneOrFacts.groupStatus
    ?? Object.fromEntries(
      Object.entries(sceneOrFacts.groups ?? {}).map(([name, group]) => [name, group.status]),
    );
  return Object.freeze({ ...groups });
}

export function listDiagnosticsByCode(diagnostics, code) {
  return diagnostics.filter((item) => item.code === code);
}

export function validateContentClosure(scene) {
  const groupStatus = summarizeGroupStatus(scene);
  const missingResources = listDiagnosticsByCode(scene.diagnostics, RESOURCE_MISSING);
  const noVisualPortals = scene.portals.filter((p) => p.visualStatus === NO_VISUAL_PORTAL);
  const visualPortals = scene.portals.filter((p) => p.visualStatus === VISUAL_PORTAL);
  const absentGroups = Object.entries(groupStatus)
    .filter(([, status]) => status === SOURCE_ABSENT)
    .map(([name]) => name);
  const emptyGroups = Object.entries(groupStatus)
    .filter(([, status]) => status === SOURCE_EMPTY)
    .map(([name]) => name);
  const presentGroups = Object.entries(groupStatus)
    .filter(([, status]) => status === SOURCE_PRESENT)
    .map(([name]) => name);

  const fatalCodes = new Set([
    "map-absent",
    "jsonl-blank-line",
    "jsonl-parse-error",
    "jsonl-record-invalid",
    "resource-root-unreadable",
    "bounds-unavailable",
  ]);
  const fatalDiagnostics = scene.diagnostics.filter((item) => fatalCodes.has(item.code));
  const unresolvedDrawables = scene.drawables.filter((item) => !item.resolved && !item.unsupported);

  const ok = scene.status === SOURCE_PRESENT
    && missingResources.length === 0
    && fatalDiagnostics.length === 0
    && unresolvedDrawables.length === 0;

  return Object.freeze({
    mapId: scene.mapId,
    ok,
    groupStatus,
    presentGroups: Object.freeze(presentGroups),
    emptyGroups: Object.freeze(emptyGroups),
    absentGroups: Object.freeze(absentGroups),
    missingResources: Object.freeze(missingResources),
    fatalDiagnostics: Object.freeze(fatalDiagnostics),
    unresolvedDrawables: Object.freeze(unresolvedDrawables),
    noVisualPortals: Object.freeze(noVisualPortals),
    visualPortals: Object.freeze(visualPortals),
    drawableCount: scene.drawables.length,
    resolvedDrawableCount: scene.drawables.filter((d) => d.resolved).length,
  });
}

export function assertTraceable(drawable) {
  if (typeof drawable.mapId !== "string") throw new Error("drawable missing mapId");
  if (typeof drawable.sourceGroup !== "string") throw new Error("drawable missing sourceGroup");
  if (!Number.isInteger(drawable.sourceOrder) || drawable.sourceOrder < 0) {
    throw new Error(`drawable ${drawable.stableId} missing sourceOrder`);
  }
  if (typeof drawable.stableId !== "string" || !drawable.stableId.includes(String(drawable.sourceOrder))) {
    throw new Error(`drawable ${drawable.stableId} identity does not embed sourceOrder`);
  }
}

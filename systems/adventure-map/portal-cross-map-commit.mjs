/**
 * Cross-map render replace must succeed before any authority variables commit.
 */

/**
 * @param {object} commit planCrossMapPortalCommit result
 * @param {{ replace: (state: object) => void }} domain
 */
export function applyCrossMapPortalRenderReplace(commit, domain) {
  if (commit === null || typeof commit !== "object" || !commit.renderRoot) {
    throw new TypeError("cross-map commit must carry renderRoot");
  }
  domain.replace({ zIndex: 0, roots: [commit.renderRoot] });
}

/**
 * After a successful replace, derive the authority snapshot to install in Subsystem.
 * @param {object} commit
 */
export function authorityAfterCrossMapReplace(commit) {
  return Object.freeze({
    activePlan: commit.activePlan,
    projection: commit.projection,
    footholdCollisionPlan: commit.activePlan.footholdCollisionPlan,
    ropeCollisionPlan: commit.activePlan.ropeCollisionPlan,
    movementConfig: commit.activePlan.movementConfig,
    portalIndex: commit.activePlan.portalLogicalIndex,
    fieldState: commit.fieldState,
    movementState: commit.movementState,
    sceneEpoch: commit.sceneEpoch,
    sceneRootKey: commit.sceneRootKey,
    renderRoot: commit.renderRoot,
    activeRenderChildren: commit.renderRoot.children,
    camera: commit.camera,
  });
}
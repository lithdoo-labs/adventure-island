/** LoomRealm consumed-key safety: suffix static scene keys on cross-map replace. */

const PLAYER_PRESERVED_KEYS = new Set([
  "player:adventure",
  "player:adventure:avatar",
]);

/**
 * @param {object} root ms-scene-view RenderNode
 * @param {number} sceneEpoch 0 = initial publication keys, >0 adds `:e{n}` suffix
 */
export function applySceneEpochToRenderRoot(root, sceneEpoch) {
  if (!Number.isInteger(sceneEpoch) || sceneEpoch < 0) {
    throw new TypeError("sceneEpoch must be a non-negative integer");
  }
  if (sceneEpoch === 0) return root;
  const suffix = `:e${sceneEpoch}`;

  function visit(node) {
    const preserve = PLAYER_PRESERVED_KEYS.has(node.key);
    const key = preserve ? node.key : `${node.key}${suffix}`;
    const children = Array.isArray(node.children)
      ? Object.freeze(node.children.map((child) => visit(child)))
      : node.children;
  return Object.freeze({
      ...node,
      key,
      children,
    });
  }

  return visit(root);
}
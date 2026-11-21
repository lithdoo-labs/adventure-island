/**
 * Apply projection patches to the Subsystem's in-memory Render children mirror.
 */
export function applyProjectionPatches(children, patches) {
  if (!Array.isArray(children) || patches.length === 0) return children;
  const indexByKey = new Map(children.map((child, index) => [child.key, index]));
  let changed = false;
  const next = children.slice();
  for (const patch of patches) {
    const index = indexByKey.get(patch.key);
    if (index === undefined) continue;
    const child = next[index];
    let attrs = child.attrs;
    if (patch.attrs?.set && typeof patch.attrs.set === "object") {
      attrs = Object.freeze({ ...attrs, ...patch.attrs.set });
      changed = true;
    }
    let data = child.data;
    if (patch.data?.set && typeof patch.data.set === "object") {
      data = Object.freeze({ ...data, ...patch.data.set });
      changed = true;
    }
    if (attrs !== child.attrs || data !== child.data) {
      next[index] = Object.freeze({ ...child, attrs, data });
    }
  }
  return changed ? Object.freeze(next) : children;
}
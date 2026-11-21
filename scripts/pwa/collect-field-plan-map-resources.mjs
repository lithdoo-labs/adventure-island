/**
 * Recursively collect logical resource.Map references from a bootstrap
 * AdventureFieldPlan RenderNode tree (M3 canonical PWA closure).
 */

function resourceIdentity(resource) {
  return `${resource.namespace}\0${resource.key}`;
}

function noteResource(resource, sink) {
  if (resource === null || resource === undefined || typeof resource !== "object") return;
  if (resource.namespace !== "resource.Map" || typeof resource.key !== "string" || resource.key.length === 0) return;
  if (typeof resource.contentVersion !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(resource.contentVersion)) {
    throw new TypeError(`invalid resource.Map stamp on ${resource.key}`);
  }
  const identity = resourceIdentity(resource);
  const existing = sink.get(identity);
  if (existing !== undefined && existing.contentVersion !== resource.contentVersion) {
    throw new TypeError(
      `contradicting contentVersion for resource.Map/${resource.key}: ${existing.contentVersion} vs ${resource.contentVersion}`,
    );
  }
  sink.set(identity, Object.freeze({
    namespace: resource.namespace,
    key: resource.key,
    contentVersion: resource.contentVersion,
  }));
}

function walkRenderNode(node, sink) {
  if (node === null || node === undefined || typeof node !== "object") return;
  const data = node.data;
  if (data !== null && data !== undefined && typeof data === "object") {
    if (data.image?.resource) noteResource(data.image.resource, sink);
    const pages = data.sprites?.pages;
    if (pages !== null && pages !== undefined && typeof pages === "object") {
      for (const page of Object.values(pages)) {
        if (page?.resource) noteResource(page.resource, sink);
      }
    }
    if (Array.isArray(data.frames)) {
      for (const frame of data.frames) {
        if (frame?.image?.resource) noteResource(frame.image.resource, sink);
      }
    }
  }
  for (const child of node.children ?? []) walkRenderNode(child, sink);
}

/**
 * @param {object} fieldPlanRoot ms-scene-view RenderNode from AdventureFieldPlan
 * @param {ReadonlyArray<object>} [extraRoots] additional FieldPlan roots to union
 * @returns {ReadonlyArray<{namespace: string, key: string, contentVersion: string}>}
 */
export function collectMapResourceRefsFromFieldTree(fieldPlanRoot, extraRoots = []) {
  if (fieldPlanRoot === null || fieldPlanRoot === undefined || typeof fieldPlanRoot !== "object") {
    throw new TypeError("fieldPlanRoot must be a RenderNode object");
  }
  const sink = new Map();
  walkRenderNode(fieldPlanRoot, sink);
  for (const extra of extraRoots) walkRenderNode(extra, sink);
  return Object.freeze([...sink.values()].sort((left, right) => (
    left.key < right.key ? -1 : left.key > right.key ? 1 : 0
  )));
}

/**
 * @param {ReadonlyArray<{namespace: string, key: string, contentVersion: string}>} left
 * @param {ReadonlyArray<{namespace: string, key: string, contentVersion: string}>} right
 */
export function assertExactMapResourceRefSets(left, right, label) {
  const keys = (list) => list.map((entry) => entry.key).sort();
  const leftKeys = keys(left);
  const rightKeys = keys(right);
  if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) {
    throw new TypeError(
      `${label}: resource.Map key sets differ (field tree ${leftKeys.length} vs comparator ${rightKeys.length})`,
    );
  }
  const rightByKey = new Map(right.map((entry) => [entry.key, entry]));
  for (const entry of left) {
    const other = rightByKey.get(entry.key);
    if (other === undefined || other.contentVersion !== entry.contentVersion) {
      throw new TypeError(`${label}: resource.Map/${entry.key} stamp mismatch against comparator`);
    }
  }
}

/**
 * M7.1 water map: painted FieldPlan tree is a strict subset of adapter closure
 * (unsupported Back type1–4 / Obj flow visuals are omitted from the tree).
 */
export function assertFieldTreeMapResourcesSubsetOfAdapter(left, right, label) {
  const rightByKey = new Map(right.map((entry) => [entry.key, entry]));
  for (const entry of left) {
    const other = rightByKey.get(entry.key);
    if (other === undefined || other.contentVersion !== entry.contentVersion) {
      throw new TypeError(`${label}: field tree resource.Map/${entry.key} is missing or mismatched in adapter closure`);
    }
  }
}

function collectNestedMapResources(value, sink, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (value.namespace === "resource.Map" && typeof value.key === "string") {
    noteResource(value, sink);
  }
  if (Array.isArray(value)) {
    for (const child of value) collectNestedMapResources(child, sink, seen);
    return;
  }
  for (const child of Object.values(value)) collectNestedMapResources(child, sink, seen);
}

/**
 * M7.5 water map: FieldPlan tree carries the full adapter map resource closure.
 */
export function assertM7WaterMapResourceBoundary(left, right, scene, label) {
  assertExactMapResourceRefSets(left, right, `${label}: field tree vs adapter closure`);
  if (left.length !== 183 || right.length !== 183) {
    throw new TypeError(`${label}: audited water resource counts drifted (field tree ${left.length}, adapter ${right.length})`);
  }
  const unsupported = (scene?.diagnostics ?? []).filter((item) => item.code === "UNSUPPORTED");
  if (unsupported.length > 0) {
    throw new TypeError(`${label}: water FieldPlan must not hide unsupported diagnostics (${unsupported.length})`);
  }
}

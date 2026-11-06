import { validateAvatarPlan } from "./avatar-model.mjs";

/**
 * Project an AvatarPlanV1 from the self-designed paper-doll tables.
 *
 * The component never opens the FSDB. Callers pass part keys, an expression
 * name and an optional one-shot action. `content.resource` is called without
 * a version argument; the returned `contentVersion` is copied onto each layer.
 */

const IMAGE_NAMESPACE = "resource.Avatar";
const EXPRESSION_KINDS = new Set(["face", "faceAcc"]);

// Input parts are a set of equipped items, not a layout dependency order.
// Body establishes neck; head establishes brow; hair needs brow. Resolve
// anchor dependencies first, then use a stable key order for all other parts.
// Final front/back drawing is independently controlled by avatar.DrawOrder.
const ANCHOR_DEPENDENCY_ORDER = Object.freeze({ body: 0, head: 1, hair: 2 });
function comparePlacementOrder(left, right) {
  const a = ANCHOR_DEPENDENCY_ORDER[left.part.kind] ?? 3;
  const b = ANCHOR_DEPENDENCY_ORDER[right.part.kind] ?? 3;
  if (a !== b) return a - b;
  return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function skinIndex(part) {
  const itemId = Number(part.itemId);
  if (!Number.isInteger(itemId)) return null;
  if (part.kind === "body") return itemId - 2000;
  if (part.kind === "head") return itemId - 12000;
  return null;
}

function stanceOf(part) {
  const stance = part.stance;
  if (!stance || typeof stance !== "object" || Array.isArray(stance)) return null;
  if (!Number.isInteger(stance.stand) || !Number.isInteger(stance.walk)) {
    throw new TypeError(`part ${part.itemId ?? part.kind} declares an incomplete stance`);
  }
  return { stand: stance.stand, walk: stance.walk };
}

function rowsFor(part, action) {
  return part.rows
    .filter((row) => row.action === action)
    .sort((left, right) => (left.frame ?? 0) - (right.frame ?? 0));
}

function exactRow(part, action, frameNumber) {
  return rowsFor(part, action).find((row) => (row.frame ?? 0) === frameNumber) ?? null;
}

function rowAt(part, action, frameNumber) {
  const rows = rowsFor(part, action);
  if (rows.length === 0) return null;
  return rows.find((row) => (row.frame ?? 0) === frameNumber) ?? rows[rows.length - 1];
}

function resolveRow(part, row, seen) {
  const token = `${row.action}:${row.frame ?? 0}`;
  if (seen.has(token)) throw new TypeError(`redirect cycle at ${part.key} ${token}`);
  seen.add(token);
  let followed = { action: row.action, frame: row.frame ?? 0 };
  let layers = [];
  if (row.redirect) {
    const target = exactRow(part, row.redirect.action, row.redirect.frame);
    if (!target) {
      throw new TypeError(`dangling redirect ${part.key} ${token} -> ${row.redirect.action}:${row.redirect.frame}`);
    }
    const inner = resolveRow(part, target, seen);
    followed = inner.followed;
    layers = inner.layers;
  }
  return { followed, layers: [...layers, ...(row.layers ?? [])], source: row };
}

function expandVariants(layers, skin) {
  const skinKey = String(skin);
  const expanded = [];
  for (const layer of layers) {
    const variants = layer.variants && typeof layer.variants === "object" && !Array.isArray(layer.variants)
      ? layer.variants
      : null;
    const chosen = variants?.[skinKey];
    expanded.push({
      name: layer.name,
      z: chosen?.z ?? layer.z,
      resource: chosen?.resource ?? layer.resource,
      origin: chosen?.origin ?? layer.origin,
      anchors: chosen?.anchors ?? layer.anchors ?? {},
    });
    if (!variants) continue;
    for (const [key, variant] of Object.entries(variants)) {
      if (/^\d+$/.test(key)) continue;
      expanded.push({
        name: key,
        z: variant.z ?? layer.z,
        resource: variant.resource,
        origin: variant.origin ?? layer.origin,
        anchors: variant.anchors ?? {},
      });
    }
  }
  return expanded;
}

function hidesWhole(part, others) {
  const occupies = asList(part.part.occupies);
  return others.some((other) => {
    if (other === part) return false;
    const covers = asList(other.part.covers);
    const otherHides = occupies.some((slot) => covers.includes(slot));
    if (!otherHides) return false;
    const partCovers = asList(part.part.covers);
    const partHidesOther = asList(other.part.occupies).some((slot) => partCovers.includes(slot));
    if (partHidesOther && partCovers.length >= covers.length) return false;
    return true;
  });
}

function layerHidden(owner, z, others, layerSlots) {
  const slots = asList(layerSlots[z]);
  if (slots.length !== 1) return false;
  return others.some((other) => other !== owner && asList(other.part.covers).includes(slots[0]));
}

function assignIds(kind, layers) {
  const used = new Set();
  return layers.map((layer, index) => {
    let id;
    if (kind === "body") id = index === 0 ? "body" : String(layer.name);
    else id = layers.length === 1 ? kind : `${kind}:${layer.name}`;
    if (used.has(id)) id = `${id}:${index}`;
    used.add(id);
    return { ...layer, id };
  });
}

function copyPoint(point, label) {
  if (!Array.isArray(point) || point.length !== 2 || point.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new TypeError(`${label} must be a finite pair`);
  }
  return [point[0], point[1]];
}

async function loadPart(content, key) {
  const [record, frames, resources] = await Promise.all([
    content.record("struct.avatar.Part", key),
    content.group("group.avatar.PartFrame", key),
    content.group("group.avatar.Resource", key),
  ]);
  const byName = new Map();
  for (const row of resources.rows ?? []) byName.set(row.name, row);
  return { key, part: record.value, rows: frames.rows ?? [], resources: byName };
}

/**
 * @param {{ record: Function, group: Function, resource: Function }} content
 * @param {{ parts: string[], expression?: string, action?: string }} input
 */
export async function buildAdventureAvatarPlan(content, input) {
  const parts = input?.parts;
  const expressionName = input?.expression ?? "default";
  const requestedAction = input?.action;
  if (!Array.isArray(parts) || parts.length === 0 || parts.some((key) => typeof key !== "string" || key.length === 0)) {
    throw new TypeError("parts must be a non-empty list of part keys");
  }
  if (new Set(parts).size !== parts.length) throw new TypeError("duplicate part key");

  const [drawOrderRecord, layerSlotRecord, loaded] = await Promise.all([
    content.record("struct.avatar.DrawOrder", "avatar"),
    content.record("struct.avatar.LayerSlot", "avatar"),
    Promise.all(parts.map((key) => loadPart(content, key))),
  ]);
  const frontToBack = drawOrderRecord.value?.frontToBack;
  const layerSlots = layerSlotRecord.value;
  if (!Array.isArray(frontToBack) || frontToBack.length === 0) throw new TypeError("DrawOrder.frontToBack is missing");
  if (!layerSlots || typeof layerSlots !== "object") throw new TypeError("LayerSlot avatar record is missing");

  const bodies = loaded.filter((part) => part.part.kind === "body");
  const heads = loaded.filter((part) => part.part.kind === "head");
  const faces = loaded.filter((part) => part.part.kind === "face");
  const hairs = loaded.filter((part) => part.part.kind === "hair");
  if (bodies.length !== 1) throw new TypeError("projection requires exactly one body");
  if (heads.length !== 1) throw new TypeError("projection requires exactly one head");
  if (faces.length > 1) throw new TypeError("projection accepts at most one face");
  if (hairs.length > 1) throw new TypeError("projection accepts at most one hair");
  const body = bodies[0];
  const head = heads[0];
  const bodySkin = skinIndex(body.part);
  const headSkin = skinIndex(head.part);
  if (bodySkin === null || headSkin === null || bodySkin !== headSkin || bodySkin < 0) {
    throw new TypeError(`body ${body.key} and head ${head.key} use different skin suffixes`);
  }

  const stanceParts = [];
  for (const part of loaded) {
    const stance = stanceOf(part.part);
    if (stance) stanceParts.push({ part, stance });
  }
  if (stanceParts.length > 1) {
    throw new TypeError(`more than one part declares stance: ${stanceParts.map((entry) => entry.part.key).join(", ")}`);
  }
  const suffix = stanceParts.length === 1 ? stanceParts[0].stance : { stand: 1, walk: 1 };
  const standName = `stand${suffix.stand}`;
  const walkName = `walk${suffix.walk}`;
  const actionNames = [standName, walkName, "jump"];
  if (typeof requestedAction === "string" && requestedAction.length > 0
    && !actionNames.includes(requestedAction)
    && rowsFor(body, requestedAction).length > 0) {
    actionNames.push(requestedAction);
  }
  for (const name of [standName, walkName, "jump"]) {
    if (rowsFor(body, name).length === 0) throw new TypeError(`body ${body.key} has no ${name} frames`);
  }

  const hidden = new Set(loaded.filter((part) => hidesWhole(part, loaded)));
  const visible = loaded.filter((part) => !hidden.has(part)).sort(comparePlacementOrder);
  const versions = new Map();
  const versionFor = async (image) => {
    if (!versions.has(image)) {
      const loadedResource = await content.resource(IMAGE_NAMESPACE, image);
      if (!loadedResource || typeof loadedResource.contentVersion !== "string") {
        throw new TypeError(`resource.Avatar/${image} did not return contentVersion`);
      }
      versions.set(image, loadedResource.contentVersion);
    }
    return versions.get(image);
  };

  const emit = async (owner, rawLayers) => {
    const expanded = expandVariants(rawLayers, bodySkin).filter((layer) => !layerHidden(owner, layer.z, visible, layerSlots));
    const identified = assignIds(owner.part.kind, expanded);
    const planLayers = [];
    for (const layer of identified) {
      const row = owner.resources.get(layer.resource);
      if (!row) throw new TypeError(`${owner.key} is missing resource ${layer.resource}`);
      if (!Number.isInteger(row.x) || !Number.isInteger(row.y) || !Number.isInteger(row.w) || !Number.isInteger(row.h) || row.w <= 0 || row.h <= 0) {
        throw new TypeError(`${owner.key} resource ${layer.resource} has an invalid atlas rect`);
      }
      const contentVersion = await versionFor(row.image);
      const anchors = {};
      for (const [name, point] of Object.entries(layer.anchors ?? {})) anchors[name] = copyPoint(point, `${layer.resource}.${name}`);
      planLayers.push({
        id: layer.id,
        z: layer.z,
        resource: { namespace: IMAGE_NAMESPACE, key: row.image, contentVersion },
        source: { x: row.x, y: row.y, w: row.w, h: row.h },
        width: row.w,
        height: row.h,
        origin: copyPoint(layer.origin, layer.resource),
        anchors,
      });
    }
    return planLayers;
  };

  const usedZ = new Set();
  const remember = (layers) => {
    for (const layer of layers) usedZ.add(layer.z);
  };

  const actions = {};
  for (const actionName of actionNames) {
    const frames = [];
    for (const row of rowsFor(body, actionName)) {
      const resolved = resolveRow(body, row, new Set());
      let layers = await emit(body, resolved.layers);
      if (layers.length === 0 || layers[0].id !== "body") {
        throw new TypeError(`${body.key} ${actionName} frame ${row.frame ?? 0} does not start with the body canvas`);
      }
      for (const part of visible) {
        if (part === body || EXPRESSION_KINDS.has(part.part.kind)) continue;
        const partRow = rowAt(part, resolved.followed.action, resolved.followed.frame);
        if (!partRow) continue;
        const partResolved = resolveRow(part, partRow, new Set());
        const partLayers = await emit(part, partResolved.layers);
        layers = layers.concat(partLayers);
      }
      const seen = new Set();
      layers = layers.map((layer, index) => {
        if (!seen.has(layer.id)) {
          seen.add(layer.id);
          return layer;
        }
        const id = `${layer.id}:${index}`;
        seen.add(id);
        return { ...layer, id };
      });
      remember(layers);
      const frame = { showFace: row.showFace !== false, layers };
      if (typeof row.delay === "number" && Number.isFinite(row.delay)) frame.delay = Math.abs(row.delay);
      if (Array.isArray(row.move)) frame.move = copyPoint(row.move, `${actionName}.move`);
      if (row.flip === true) frame.flip = true;
      if (row.rotate !== undefined) frame.rotate = row.rotate;
      frames.push(frame);
    }
    actions[actionName] = {
      loop: actionName === standName || actionName === walkName,
      frames,
    };
  }

  const plan = {
    formatVersion: 1,
    bodyKey: body.key,
    zOrder: [],
    locomotionActions: { stand: standName, walk: walkName, jump: "jump" },
    actions,
  };

  const face = faces.find((part) => !hidden.has(part)) ?? null;
  if (face) {
    let faceRows = rowsFor(face, expressionName);
    let resolvedName = expressionName;
    if (faceRows.length === 0) {
      faceRows = rowsFor(face, "default");
      resolvedName = "default";
    }
    if (faceRows.length === 0) throw new TypeError(`face ${face.key} has no ${expressionName} or default frames`);
    const accessories = visible.filter((part) => part.part.kind === "faceAcc");
    const frames = [];
    for (let index = 0; index < faceRows.length; index += 1) {
      const row = faceRows[index];
      const resolved = resolveRow(face, row, new Set());
      let layers = await emit(face, resolved.layers);
      for (const accessory of accessories) {
        const named = rowsFor(accessory, resolvedName);
        const list = named.length > 0 ? named : rowsFor(accessory, "default");
        if (list.length === 0) continue;
        const accessoryRow = list[Math.min(index, list.length - 1)];
        const accessoryResolved = resolveRow(accessory, accessoryRow, new Set());
        layers = layers.concat(await emit(accessory, accessoryResolved.layers));
      }
      if (layers.length === 0) continue;
      remember(layers);
      const frame = { layers };
      if (typeof row.delay === "number" && Number.isFinite(row.delay)) frame.delay = Math.abs(row.delay);
      frames.push(frame);
    }
    if (frames.length > 0) plan.expression = { name: resolvedName, frames };
  }

  const missing = [...usedZ].filter((z) => !frontToBack.includes(z));
  if (missing.length > 0) throw new TypeError(`z names missing from DrawOrder: ${missing.join(", ")}`);
  plan.zOrder = frontToBack.filter((z) => usedZ.has(z));
  if (plan.zOrder.length === 0) throw new TypeError("projection produced an empty zOrder");
  if (plan.zOrder.length > 64) throw new TypeError(`projection uses ${plan.zOrder.length} z names, above the 64 entry cap`);

  return validateAvatarPlan(plan);
}

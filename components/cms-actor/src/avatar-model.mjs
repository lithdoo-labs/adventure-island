export const ANCHOR_PRIORITY = Object.freeze([
  "navel",
  "neck",
  "hand",
  "brow",
  "handMove",
]);

const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;

/**
 * Hard bounds for AvatarPlanV1.
 *
 * Render Update v1 caps serialized `RenderNode.data` at 262,144 compact
 * UTF-8 bytes. The plan is one actor's *currently needed* actions only —
 * never a catalogue of every character, equipment, action and frame. These
 * structural bounds plus the byte budget keep any accepted plan inside the
 * frozen Render protocol envelope.
 */
export const AVATAR_PLAN_LIMITS = Object.freeze({
  /** Frozen Render Update v1 `RenderNode.data` compact byte cap. */
  maxDataBytes: 262_144,
  /**
   * Decoded-byte budget for one frame's canvases (and for any single
   * canvas). This is the component's working-set policy: the decoded-bitmap
   * cache hard-caps at the same value, so a frame can always be painted
   * without the working set bypassing the cache budget.
   */
  maxDecodedFrameBytes: 12 * 1024 * 1024,
  maxZOrderEntries: 64,
  maxActions: 32,
  maxActionNameBytes: 64,
  maxFramesPerAction: 128,
  maxLayersPerFrame: 32,
  maxLayerIdBytes: 64,
  maxAnchorsPerLayer: 8,
  maxAnchorNameBytes: 32,
  maxResourceNamespaceBytes: 64,
  maxResourceKeyBytes: 256,
  maxResourceKeySegments: 32,
  maxDimensionPixels: 4096,
  maxDelayMs: 600_000,
  maxCoordinate: 100_000,
});

const LOCOMOTION_STATES = Object.freeze(["stand", "walk", "jump"]);

function isFinitePair(value) {
  return Array.isArray(value)
    && value.length === 2
    && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

function assert(condition, message) {
  if (!condition) throw new TypeError(`Invalid AvatarPlanV1: ${message}`);
}

function boundedInteger(value, part) {
  return Number.isInteger(value) && value > 0 && value <= part;
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).length;
}

function validResourceKey(key, label) {
  assert(typeof key === "string" && key.length > 0, `${label} must be a non-empty string`);
  assert(utf8Bytes(key) <= AVATAR_PLAN_LIMITS.maxResourceKeyBytes, `${label} exceeds ${AVATAR_PLAN_LIMITS.maxResourceKeyBytes} UTF-8 bytes`);
  assert(!key.startsWith("/") && !key.endsWith("/"), `${label} must not start or end with "/"`);
  const segments = key.split("/");
  assert(segments.length <= AVATAR_PLAN_LIMITS.maxResourceKeySegments, `${label} must have at most ${AVATAR_PLAN_LIMITS.maxResourceKeySegments} segments`);
  for (const segment of segments) {
    assert(segment.length > 0 && segment !== "." && segment !== "..", `${label} contains an empty, "." or ".." segment`);
  }
}

/**
 * A missing delay holds the frame. `delay: 0` is a real duration: the frame
 * is drawn and left immediately. Callers must not treat those two as the same
 * "stop the clock" signal.
 */
export function frameHolds(frame) {
  return frame?.delay === undefined;
}

/** Clockwise quarter-turns around a point. Canvas +Y is down, so +90° is clockwise. */
export function rotatePoint(x, y, originX, originY, degrees) {
  const dx = x - originX;
  const dy = y - originY;
  const turns = ((Math.round(degrees) % 360) + 360) % 360;
  if (turns === 90) return [originX - dy, originY + dx];
  if (turns === 180) return [originX - dx, originY - dy];
  if (turns === 270) return [originX + dy, originY - dx];
  return [x, y];
}

function validatePlanLayer(layer, label, plan, declaredDimensions) {
  assert(layer && typeof layer === "object" && !Array.isArray(layer), `${label} must be an object`);
  assert(typeof layer.id === "string" && layer.id.length > 0, `${label}.id must be non-empty`);
  assert(utf8Bytes(layer.id) <= AVATAR_PLAN_LIMITS.maxLayerIdBytes, `${label}.id exceeds ${AVATAR_PLAN_LIMITS.maxLayerIdBytes} UTF-8 bytes`);
  assert(typeof layer.z === "string" && plan.zOrder.includes(layer.z), `${label}.z must appear in zOrder`);
  assert(boundedInteger(layer.width, AVATAR_PLAN_LIMITS.maxDimensionPixels), `${label}.width must be a positive integer up to ${AVATAR_PLAN_LIMITS.maxDimensionPixels}`);
  assert(boundedInteger(layer.height, AVATAR_PLAN_LIMITS.maxDimensionPixels), `${label}.height must be a positive integer up to ${AVATAR_PLAN_LIMITS.maxDimensionPixels}`);
  assert(layer.width * layer.height * 4 <= AVATAR_PLAN_LIMITS.maxDecodedFrameBytes, `${label} decodes to ${layer.width * layer.height * 4} bytes, exceeding the ${AVATAR_PLAN_LIMITS.maxDecodedFrameBytes}-byte canvas budget`);
  assert(isFinitePair(layer.origin), `${label}.origin must be a finite pair`);
  assert(layer.origin.every((part) => Math.abs(part) <= AVATAR_PLAN_LIMITS.maxCoordinate), `${label}.origin exceeds the coordinate bound`);
  assert(layer.resource && typeof layer.resource === "object", `${label}.resource is required`);
  assert(typeof layer.resource.namespace === "string" && layer.resource.namespace.length > 0, `${label}.resource.namespace is required`);
  assert(utf8Bytes(layer.resource.namespace) <= AVATAR_PLAN_LIMITS.maxResourceNamespaceBytes, `${label}.resource.namespace exceeds ${AVATAR_PLAN_LIMITS.maxResourceNamespaceBytes} UTF-8 bytes`);
  assert(!layer.resource.namespace.includes("/"), `${label}.resource.namespace must be a single Content namespace`);
  validResourceKey(layer.resource.key, `${label}.resource.key`);
  assert(typeof layer.resource.contentVersion === "string" && CONTENT_VERSION_PATTERN.test(layer.resource.contentVersion), `${label}.resource.contentVersion must be sha256:<64 lowercase hex>`);
  if (layer.anchors !== undefined) {
    assert(layer.anchors && typeof layer.anchors === "object" && !Array.isArray(layer.anchors), `${label}.anchors must be an object`);
    const anchorNames = Object.keys(layer.anchors);
    assert(anchorNames.length <= AVATAR_PLAN_LIMITS.maxAnchorsPerLayer, `${label}.anchors must have at most ${AVATAR_PLAN_LIMITS.maxAnchorsPerLayer} entries`);
    for (const [anchorName, point] of Object.entries(layer.anchors)) {
      assert(anchorName.length > 0, `${label}.anchors keys must be non-empty`);
      assert(utf8Bytes(anchorName) <= AVATAR_PLAN_LIMITS.maxAnchorNameBytes, `${label}.anchors.${anchorName} exceeds ${AVATAR_PLAN_LIMITS.maxAnchorNameBytes} UTF-8 bytes`);
      assert(isFinitePair(point), `${label}.anchors.${anchorName} must be a finite pair`);
      assert(point.every((part) => Math.abs(part) <= AVATAR_PLAN_LIMITS.maxCoordinate), `${label}.anchors.${anchorName} exceeds the coordinate bound`);
    }
  }
  if (layer.source !== undefined) {
    const source = layer.source;
    assert(source && typeof source === "object" && !Array.isArray(source), `${label}.source must be an object`);
    for (const key of ["x", "y", "w", "h"]) {
      assert(Number.isInteger(source[key]) && source[key] >= 0, `${label}.source.${key} must be a non-negative integer`);
    }
    assert(source.w === layer.width && source.h === layer.height, `${label}.source.w/h must equal width/height`);
  }

  const identity = `${layer.resource.namespace}\u0000${layer.resource.key}\u0000${layer.resource.contentVersion}`;
  const dimensions = `${layer.width}x${layer.height}`;
  const previous = declaredDimensions.get(identity);
  if (layer.source) {
    if (previous !== undefined && previous !== "page") {
      throw new TypeError(`Invalid AvatarPlanV1: ${label} declares a source rect for ${layer.resource.namespace}/${layer.resource.key} but an earlier layer declared ${previous}`);
    }
    declaredDimensions.set(identity, "page");
  } else if (previous === "page") {
    throw new TypeError(`Invalid AvatarPlanV1: ${label} declares ${dimensions} for ${layer.resource.namespace}/${layer.resource.key} but an earlier layer declared a source rect for that page`);
  } else if (previous !== undefined && previous !== dimensions) {
    throw new TypeError(`Invalid AvatarPlanV1: ${label} declares ${dimensions} for ${layer.resource.namespace}/${layer.resource.key} but an earlier layer declared ${previous}`);
  } else {
    declaredDimensions.set(identity, dimensions);
  }
  return layer.width * layer.height * 4;
}

/** Validate the renderer-ready, WZ-independent paper-doll plan. */
export function validateAvatarPlan(plan) {
  assert(plan && typeof plan === "object" && !Array.isArray(plan), "plan must be an object");
  assert(plan.formatVersion === 1, "formatVersion must be 1");
  assert(Array.isArray(plan.zOrder) && plan.zOrder.length > 0, "zOrder must be a non-empty array");
  assert(plan.zOrder.length <= AVATAR_PLAN_LIMITS.maxZOrderEntries, `zOrder must have at most ${AVATAR_PLAN_LIMITS.maxZOrderEntries} entries`);
  assert(plan.zOrder.every((z) => typeof z === "string" && z.length > 0), "zOrder entries must be non-empty strings");
  assert(new Set(plan.zOrder).size === plan.zOrder.length, "zOrder entries must be unique");
  assert(plan.actions && typeof plan.actions === "object" && !Array.isArray(plan.actions), "actions must be an object");
  const actionNames = Object.keys(plan.actions);
  assert(actionNames.length > 0, "actions must not be empty");
  assert(actionNames.length <= AVATAR_PLAN_LIMITS.maxActions, `actions must have at most ${AVATAR_PLAN_LIMITS.maxActions} entries`);
  if (plan.locomotionActions !== undefined) {
    assert(plan.locomotionActions && typeof plan.locomotionActions === "object" && !Array.isArray(plan.locomotionActions), "locomotionActions must be an object");
    for (const [state, actionName] of Object.entries(plan.locomotionActions)) {
      assert(LOCOMOTION_STATES.includes(state), `unsupported locomotionActions state: ${state}`);
      assert(typeof actionName === "string" && plan.actions[actionName], `locomotionActions.${state} must name an existing action`);
    }
  }
  if (plan.bodyKey !== undefined) {
    assert(typeof plan.bodyKey === "string" && plan.bodyKey.length > 0, "bodyKey must be a non-empty string");
    assert(utf8Bytes(plan.bodyKey) <= 200, "bodyKey exceeds 200 UTF-8 bytes");
  }

  // A resource without `source` is the whole bitmap, so every such layer must
  // agree on width/height. A resource with `source` is an atlas page: many
  // sprite sizes may share that page, and the page is decoded once.
  const declaredDimensions = new Map();
  let maxFrameBytes = 0;

  for (const [actionName, action] of Object.entries(plan.actions)) {
    assert(utf8Bytes(actionName) <= AVATAR_PLAN_LIMITS.maxActionNameBytes, `action names must be at most ${AVATAR_PLAN_LIMITS.maxActionNameBytes} UTF-8 bytes`);
    assert(action && typeof action === "object" && !Array.isArray(action), `${actionName} must be an object`);
    assert(typeof action.loop === "boolean", `${actionName}.loop must be boolean`);
    assert(Array.isArray(action.frames) && action.frames.length > 0, `${actionName}.frames must be non-empty`);
    assert(action.frames.length <= AVATAR_PLAN_LIMITS.maxFramesPerAction, `${actionName}.frames must have at most ${AVATAR_PLAN_LIMITS.maxFramesPerAction} entries`);

    for (const [frameIndex, frame] of action.frames.entries()) {
      const frameLabel = `${actionName}.frames[${frameIndex}]`;
      assert(frame && typeof frame === "object" && !Array.isArray(frame), `${frameLabel} must be an object`);
      if (frame.delay !== undefined) {
        assert(typeof frame.delay === "number" && Number.isFinite(frame.delay), `${frameLabel}.delay must be finite`);
        assert(Math.abs(frame.delay) <= AVATAR_PLAN_LIMITS.maxDelayMs, `${frameLabel}.delay magnitude must not exceed ${AVATAR_PLAN_LIMITS.maxDelayMs}ms`);
      }
      if (frame.move !== undefined) {
        assert(isFinitePair(frame.move), `${frameLabel}.move must be a finite pair`);
        assert(frame.move.every((part) => Math.abs(part) <= AVATAR_PLAN_LIMITS.maxCoordinate), `${frameLabel}.move exceeds the coordinate bound`);
      }
      if (frame.flip !== undefined) assert(typeof frame.flip === "boolean", `${frameLabel}.flip must be boolean`);
      if (frame.showFace !== undefined) assert(typeof frame.showFace === "boolean", `${frameLabel}.showFace must be boolean`);
      if (frame.rotate !== undefined) assert(frame.rotate === 90 || frame.rotate === 180 || frame.rotate === 270, `${frameLabel}.rotate must be 90, 180 or 270`);
      assert(Array.isArray(frame.layers) && frame.layers.length > 0, `${frameLabel}.layers must be non-empty`);
      assert(frame.layers.length <= AVATAR_PLAN_LIMITS.maxLayersPerFrame, `${frameLabel}.layers must have at most ${AVATAR_PLAN_LIMITS.maxLayersPerFrame} entries`);
      assert(frame.layers[0]?.id === "body", `${frameLabel}.layers[0] must be the body layer`);
      assert(new Set(frame.layers.map((layer) => layer?.id)).size === frame.layers.length, `${frameLabel}.layer ids must be unique`);
      let frameDecodedBytes = 0;

      for (const [layerIndex, layer] of frame.layers.entries()) {
        frameDecodedBytes += validatePlanLayer(layer, `${frameLabel}.layers[${layerIndex}]`, plan, declaredDimensions);
      }
      assert(frameDecodedBytes <= AVATAR_PLAN_LIMITS.maxDecodedFrameBytes, `${frameLabel} decodes to ${frameDecodedBytes} bytes across its layers, exceeding the ${AVATAR_PLAN_LIMITS.maxDecodedFrameBytes}-byte frame budget`);
      if (frameDecodedBytes > maxFrameBytes) maxFrameBytes = frameDecodedBytes;
    }
  }

  let maxExpressionBytes = 0;
  if (plan.expression !== undefined) {
    const expression = plan.expression;
    assert(expression && typeof expression === "object" && !Array.isArray(expression), "expression must be an object");
    assert(typeof expression.name === "string" && expression.name.length > 0, "expression.name must be a non-empty string");
    assert(utf8Bytes(expression.name) <= AVATAR_PLAN_LIMITS.maxActionNameBytes, `expression.name must be at most ${AVATAR_PLAN_LIMITS.maxActionNameBytes} UTF-8 bytes`);
    assert(Array.isArray(expression.frames) && expression.frames.length > 0, "expression.frames must be non-empty");
    assert(expression.frames.length <= AVATAR_PLAN_LIMITS.maxFramesPerAction, `expression.frames must have at most ${AVATAR_PLAN_LIMITS.maxFramesPerAction} entries`);
    for (const [frameIndex, frame] of expression.frames.entries()) {
      const frameLabel = `expression.frames[${frameIndex}]`;
      assert(frame && typeof frame === "object" && !Array.isArray(frame), `${frameLabel} must be an object`);
      if (frame.delay !== undefined) {
        assert(typeof frame.delay === "number" && Number.isFinite(frame.delay), `${frameLabel}.delay must be finite`);
        assert(Math.abs(frame.delay) <= AVATAR_PLAN_LIMITS.maxDelayMs, `${frameLabel}.delay magnitude must not exceed ${AVATAR_PLAN_LIMITS.maxDelayMs}ms`);
      }
      assert(Array.isArray(frame.layers) && frame.layers.length > 0, `${frameLabel}.layers must be non-empty`);
      assert(frame.layers.length <= AVATAR_PLAN_LIMITS.maxLayersPerFrame, `${frameLabel}.layers must have at most ${AVATAR_PLAN_LIMITS.maxLayersPerFrame} entries`);
      assert(new Set(frame.layers.map((layer) => layer?.id)).size === frame.layers.length, `${frameLabel}.layer ids must be unique`);
      let frameDecodedBytes = 0;
      for (const [layerIndex, layer] of frame.layers.entries()) {
        frameDecodedBytes += validatePlanLayer(layer, `${frameLabel}.layers[${layerIndex}]`, plan, declaredDimensions);
      }
      assert(frameDecodedBytes <= AVATAR_PLAN_LIMITS.maxDecodedFrameBytes, `${frameLabel} decodes to ${frameDecodedBytes} bytes across its layers, exceeding the ${AVATAR_PLAN_LIMITS.maxDecodedFrameBytes}-byte frame budget`);
      if (frameDecodedBytes > maxExpressionBytes) maxExpressionBytes = frameDecodedBytes;
    }
  }
  const paintedBytes = maxFrameBytes + maxExpressionBytes;
  assert(paintedBytes <= AVATAR_PLAN_LIMITS.maxDecodedFrameBytes, `a body frame plus the expression track decodes to ${paintedBytes} bytes, exceeding the ${AVATAR_PLAN_LIMITS.maxDecodedFrameBytes}-byte frame budget`);

  let dataBytes;
  try {
    dataBytes = measureAvatarPlanDataBytes(plan);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new TypeError(`Invalid AvatarPlanV1: serialized RenderNode.data exceeds the frozen Render Update v1 cap of ${AVATAR_PLAN_LIMITS.maxDataBytes} bytes`);
    }
    throw error;
  }
  assert(dataBytes <= AVATAR_PLAN_LIMITS.maxDataBytes, `serialized RenderNode.data is ${dataBytes} bytes, exceeding the frozen Render Update v1 cap of ${AVATAR_PLAN_LIMITS.maxDataBytes}`);
  return plan;
}

/**
 * Bounded compact-JSON byte measurement. Throws a RangeError as soon as the
 * running total passes `budget`, so an oversized plan is rejected without
 * first materializing an unbounded serialized string.
 */
export function measureCompactJsonBytes(value, budget = AVATAR_PLAN_LIMITS.maxDataBytes) {
  let total = 0;
  const exceed = () => {
    throw new RangeError(`compact JSON exceeds the ${budget}-byte budget`);
  };
  const add = (count) => {
    total += count;
    if (total > budget) exceed();
  };
  const visit = (node) => {
    if (node === null) return add(4);
    switch (typeof node) {
      case "boolean": return add(node ? 4 : 5);
      case "number": {
        if (!Number.isFinite(node)) throw new TypeError("compact JSON measurement requires finite numbers");
        return add(String(node).length);
      }
      case "string": {
        // JSON.stringify includes the surrounding quotes and any escapes;
        // the result is bounded because validated plan strings are bounded.
        return add(new TextEncoder().encode(JSON.stringify(node)).length);
      }
      case "object": {
        if (Array.isArray(node)) {
          add(1);
          for (let index = 0; index < node.length; index += 1) {
            if (index > 0) add(1);
            visit(node[index]);
          }
          return add(1);
        }
        add(1);
        const keys = Object.keys(node);
        for (let index = 0; index < keys.length; index += 1) {
          if (index > 0) add(1);
          visit(keys[index]);
          add(1);
          visit(node[keys[index]]);
        }
        return add(1);
      }
      default: throw new TypeError(`compact JSON measurement cannot handle ${typeof node}`);
    }
  };
  visit(value);
  return total;
}

/** Compact byte size of the full `RenderNode.data` object `{ avatarPlan }`. */
export function measureAvatarPlanDataBytes(plan) {
  // '{"avatarPlan":' (14 bytes) + plan + '}' (1 byte)
  return 15 + measureCompactJsonBytes(plan, AVATAR_PLAN_LIMITS.maxDataBytes);
}

/** Map the small runtime vocabulary to the concrete WZ action name. */
export function resolveActionName(plan, locomotion = "stand") {
  const defaults = { stand: "stand1", walk: "walk1", jump: "jump" };
  const requested = plan?.locomotionActions?.[locomotion] ?? defaults[locomotion] ?? locomotion;
  if (plan?.actions?.[requested]) return requested;
  if (plan?.actions?.stand1) return "stand1";
  return Object.keys(plan?.actions ?? {})[0] ?? null;
}

export function frameDuration(frame) {
  const delay = frame?.delay;
  return typeof delay === "number" && Number.isFinite(delay) ? Math.abs(delay) : 0;
}

/**
 * Resolve WZ map anchors into actor-origin-relative canvas positions.
 * frame.layers is intentionally in anchor dependency order (body, head,
 * face/hair, then attached equipment); z-order is applied only afterwards.
 * Skipped layers report the anchor names that could not be matched, so the
 * caller can surface a locatable diagnostic instead of a silent gap.
 */
export function layoutFrame(frame, zOrder, x = 0, y = 0) {
  const knownAnchors = new Map();
  const positioned = [];
  const skipped = [];
  const moveX = frame.move?.[0] ?? 0;
  const moveY = frame.move?.[1] ?? 0;
  const base = { x: x + moveX, y: y + moveY };

  for (const [index, layer] of frame.layers.entries()) {
    let originX = base.x;
    let originY = base.y;
    let matchedAnchor = null;

    if (index > 0 && layer.anchors) {
      const wanted = Object.keys(layer.anchors);
      for (const name of ANCHOR_PRIORITY) {
        const local = layer.anchors[name];
        const global = knownAnchors.get(name);
        if (local && global) {
          originX = global[0] - local[0];
          originY = global[1] - local[1];
          matchedAnchor = name;
          break;
        }
      }
      if (wanted.length > 0 && matchedAnchor === null) {
        skipped.push({ id: layer.id, anchors: wanted });
        continue;
      }
    }

    const item = {
      layer,
      index,
      originX,
      originY,
      left: originX - layer.origin[0],
      top: originY - layer.origin[1],
      width: layer.width,
      height: layer.height,
      matchedAnchor,
    };
    positioned.push(item);

    for (const [name, local] of Object.entries(layer.anchors ?? {})) {
      if (!knownAnchors.has(name)) knownAnchors.set(name, [originX + local[0], originY + local[1]]);
    }
  }

  const orderIndex = new Map(zOrder.map((z, index) => [z, index]));
  // zOrder is front-to-back, so paint in reverse: back first, front last.
  const drawOrder = [...positioned].sort((a, b) => {
    const zDelta = orderIndex.get(b.layer.z) - orderIndex.get(a.layer.z);
    return zDelta || a.index - b.index;
  });

  return { positioned, drawOrder, skipped, anchors: knownAnchors };
}

/**
 * Place expression layers onto anchors already established by `layoutFrame`.
 * These layers do not publish new anchors and are not laid out as their own body.
 */
export function placeAnchoredLayers(layers, knownAnchors, base = { x: 0, y: 0 }) {
  const positioned = [];
  const skipped = [];
  layers.forEach((layer, index) => {
    let originX = base.x;
    let originY = base.y;
    let matchedAnchor = null;
    if (layer.anchors) {
      const wanted = Object.keys(layer.anchors);
      for (const name of ANCHOR_PRIORITY) {
        const local = layer.anchors[name];
        const global = knownAnchors.get(name);
        if (local && global) {
          originX = global[0] - local[0];
          originY = global[1] - local[1];
          matchedAnchor = name;
          break;
        }
      }
      if (wanted.length > 0 && matchedAnchor === null) {
        skipped.push({ id: layer.id, anchors: wanted });
        return;
      }
    }
    positioned.push({
      layer,
      index,
      originX,
      originY,
      left: originX - layer.origin[0],
      top: originY - layer.origin[1],
      width: layer.width,
      height: layer.height,
      matchedAnchor,
    });
  });
  return { positioned, skipped };
}

/** Format skipped-layer diagnostics as `layerId[needs=anchorA+anchorB]`. */
export function formatSkippedLayers(skipped) {
  return skipped.map((entry) => `${entry.id}[needs=${entry.anchors.join("+")}]`).join(",");
}

/** Bounding box after reflecting one positioned image around the body origin. */
export function mirrorBounds(item, pivotX = 0) {
  return {
    left: 2 * pivotX - (item.left + item.width),
    right: 2 * pivotX - item.left,
    top: item.top,
    bottom: item.top + item.height,
  };
}

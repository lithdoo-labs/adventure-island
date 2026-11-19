/**
 * Measured M4 canonical 222000000 + avatar budgets (generous over Windows dev baselines).
 * Values are enforcement ceilings for tests, not product SLAs.
 */
import { FIELD_CANVAS_LIMITS } from "../src/limits.mjs";

/** Observed Node projection: 297 map paint units + 1 ms-avatar Canvas. */
export const MEASURED_CANVAS_COUNT = 298;

/**
 * FieldPlan / published map resource closure (all resource refs reachable from RenderNode data).
 * Matches PWA `collectMapResourceRefsFromFieldTree` walk semantics (Node, 2026-11-19).
 */
export const MEASURED_FIELD_PLAN_RESOURCE_CLOSURE = 171;

/**
 * Underlying Content reads for static first-frame painting on the full 298-host scene.
 * Smaller than the closure because batch nodes ship extra sprite pages not painted on frame 0.
 * Measured after all visual hosts reach `ready` with `resourceActive === 0` (Chromium, 2026-11-19).
 */
/** Static first-frame resource identities from projection walk (Node). */
export const MEASURED_FIRST_FRAME_PAINT_RESOURCE_IDENTITIES = 150;

/** Underlying client Content reads after full canonical Chromium first paint. */
export const MEASURED_FIRST_FRAME_UNDERLYING_READS = 150;

/** @deprecated Use {@link MEASURED_FIELD_PLAN_RESOURCE_CLOSURE}. */
export const MEASURED_UNIQUE_CONTENT_READS = MEASURED_FIELD_PLAN_RESOURCE_CLOSURE;

/** Largest local Canvas edge at devicePixelRatio 1 from projection bounds. */
export const MEASURED_MAX_CANVAS_WIDTH = 1890;
export const MEASURED_MAX_CANVAS_HEIGHT = 573;
export const MEASURED_MAX_LOCAL_CANVAS_PIXELS = 680_208;

/** Sum of local width×height across every visual Canvas host at DPR 1 (excludes ms-avatar — runtime-sized). */
export const MEASURED_TOTAL_LOCAL_PIXELS = 19_335_752;

/** ms-field presentation code caps in-flight underlying reads (PWA rejects above 32). */
export const RESOURCE_READ_CONCURRENCY = 8;
export const PWA_CONTENT_CONCURRENCY_LIMIT = 32;

export const CANONICAL_FIELD_BUDGETS = Object.freeze({
  maxVisualCanvases: 310,
  maxCanvasWidth: FIELD_CANVAS_LIMITS.maxCanvasWidth,
  maxCanvasHeight: FIELD_CANVAS_LIMITS.maxCanvasHeight,
  maxLocalCanvasPixels: FIELD_CANVAS_LIMITS.maxCanvasPixels,
  maxTotalLocalPixels: 24_000_000,
  maxFieldPlanResourceClosure: 190,
  maxFirstFrameUnderlyingReads: 170,
  maxReadConcurrency: RESOURCE_READ_CONCURRENCY,
  belowPwaContentLimit: PWA_CONTENT_CONCURRENCY_LIMIT,
  maxReadyMs: 240_000,
  maxProjectionMs: 12_000,
});

const VISUAL_TAGS = new Set([
  "ms-map-batch",
  "ms-map-back",
  "ms-map-object",
  "ms-portal-visual",
  "ms-avatar",
]);

export function expectedLocalCanvasSize(node) {
  if (node.tag === "ms-map-batch" && node.data?.bounds) {
    return { width: node.data.bounds.w, height: node.data.bounds.h };
  }
  const image = node.data?.image;
  if ((node.tag === "ms-map-back" || node.tag === "ms-portal-visual") && image?.source) {
    return { width: image.source.w, height: image.source.h };
  }
  if (node.tag === "ms-map-object" && node.data?.frames?.[0]?.image?.source) {
    const source = node.data.frames[0].image.source;
    return { width: source.w, height: source.h };
  }
  if (node.tag === "ms-avatar") {
    return null;
  }
  return null;
}

export function walkVisualPaintUnits(root, sink = []) {
  const visit = (node) => {
    if (VISUAL_TAGS.has(node.tag)) sink.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return sink;
}

/** Full FieldPlan resource closure (all declared RenderNode resource refs). */
export function collectFieldPlanResourceClosure(root) {
  const identities = new Set();
  const visit = (node) => {
    const image = node.data?.image;
    if (image?.resource) {
      const { namespace, key, contentVersion } = image.resource;
      identities.add(`${namespace}\0${key}\0${contentVersion}`);
    }
    const pages = node.data?.sprites?.pages;
    if (pages) {
      for (const page of Object.values(pages)) {
        if (page?.resource) {
          const { namespace, key, contentVersion } = page.resource;
          identities.add(`${namespace}\0${key}\0${contentVersion}`);
        }
      }
    }
    const frames = node.data?.frames;
    if (Array.isArray(frames)) {
      for (const frame of frames) {
        if (frame?.image?.resource) {
          const { namespace, key, contentVersion } = frame.image.resource;
          identities.add(`${namespace}\0${key}\0${contentVersion}`);
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return identities;
}

/** @deprecated Use {@link collectFieldPlanResourceClosure}. */
export const collectResourceIdentities = collectFieldPlanResourceClosure;

/**
 * Resources the static first frame actually paints (frame-0 Obj/Portal/Back,
 * batch placement sprites only — not every page in batch closures).
 */
export function collectFirstFramePaintResourceIdentities(root) {
  const identities = new Set();
  const add = (resource) => {
    identities.add(`${resource.namespace}\0${resource.key}\0${resource.contentVersion}`);
  };
  const visit = (node) => {
    if (node.tag === "ms-map-back" || node.tag === "ms-portal-visual") {
      if (node.data?.image?.resource) add(node.data.image.resource);
    } else if (node.tag === "ms-map-object") {
      const frame = node.data?.frames?.[0];
      if (frame?.image?.resource) add(frame.image.resource);
    } else if (node.tag === "ms-map-batch" && node.data?.sprites) {
      for (const placement of node.data.placements) {
        const item = node.data.sprites.items[placement.sprite];
        const page = item ? node.data.sprites.pages[item.page] : null;
        if (page?.resource) add(page.resource);
      }
    } else if (node.tag === "ms-avatar") {
      const action = node.attrs?.action;
      const actionNode = (node.children ?? []).find((child) => child.tag === "ms-action" && child.attrs?.name === action);
      const frame = actionNode?.data?.clip?.frames?.[0];
      const catalog = node.data?.sprites;
      if (frame && catalog?.items && catalog?.pages) {
        const layers = [...(frame.layers ?? [])];
        if (frame.showFace !== false) {
          const expression = node.data?.expressions?.[node.attrs?.expression]
            ?? node.data?.expressions?.default;
          layers.push(...(expression?.frames?.[0]?.layers ?? []));
        }
        for (const layer of layers) {
          const item = catalog.items[layer.sprite];
          const page = item ? catalog.pages[item.page] : null;
          if (page?.resource) add(page.resource);
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return identities;
}

export function summarizeProjectionCanvasBudget(root) {
  const units = walkVisualPaintUnits(root);
  let maxWidth = 0;
  let maxHeight = 0;
  let maxLocalCanvasPixels = 0;
  let totalLocalPixels = 0;
  for (const unit of units) {
    const size = expectedLocalCanvasSize(unit);
    if (!size) {
      if (unit.tag !== "ms-avatar") throw new Error(`missing local canvas size for ${unit.tag}:${unit.key}`);
      continue;
    }
    maxWidth = Math.max(maxWidth, size.width);
    maxHeight = Math.max(maxHeight, size.height);
    const pixels = size.width * size.height;
    maxLocalCanvasPixels = Math.max(maxLocalCanvasPixels, pixels);
    totalLocalPixels += pixels;
  }
  const closure = collectFieldPlanResourceClosure(root);
  const firstFrame = collectFirstFramePaintResourceIdentities(root);
  return Object.freeze({
    canvasCount: units.length,
    maxWidth,
    maxHeight,
    maxLocalCanvasPixels,
    totalLocalPixels,
    fieldPlanResourceClosure: closure.size,
    firstFramePaintResources: firstFrame.size,
  });
}

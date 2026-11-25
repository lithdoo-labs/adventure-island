/**
 * PaintUnitPlan[] → RenderNode candidate tree + projection hash.
 *
 * Candidate only — does not approve ms-* ABI. No WZ/FSDB paths leak into
 * RenderNode data; resources use {namespace,key,contentVersion}.
 */
import { layoutBackView } from "./back-layout.mjs";
import { layoutObjFlowView } from "./obj-flow.mjs";
import { projectionHash } from "./hash.mjs";

function decimalAttr(value) {
  if (!Number.isFinite(value)) throw new TypeError(`non-finite attr value ${value}`);
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function imageRegion(frame) {
  if (!frame?.resource) return null;
  return Object.freeze({
    resource: frame.resource,
    pageWidth: frame.width,
    pageHeight: frame.height,
    source: Object.freeze({ x: 0, y: 0, w: frame.width, h: frame.height }),
  });
}

function backAnimationEnvelope(frames, flip) {
  const boxes = frames.map((frame) => {
    const [originX, originY] = frame.origin ?? [0, 0];
    const left = flip ? -(frame.width - originX) : -originX;
    const top = -originY;
    return { left, top, right: left + frame.width, bottom: top + frame.height };
  });
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return Object.freeze({
    left,
    top,
    width: right - left,
    height: bottom - top,
    offsets: Object.freeze(boxes.map((box) => Object.freeze([box.left - left, box.top - top]))),
  });
}

function projectBack(plan, projectionContext) {
  const d = plan.drawable;
  const frame = d.frames[0];
  const type = Number(d.placement.type);
  const multiFrame = d.frames.length > 1;
  const flip = Boolean(d.flip);
  const envelope = multiFrame ? backAnimationEnvelope(d.frames, flip) : null;
  const frameWidth = envelope?.width ?? frame?.width ?? 0;
  const frameHeight = envelope?.height ?? frame?.height ?? 0;
  const layoutBounds = envelope
    ? Object.freeze({
      x: d.worldX + envelope.left,
      y: d.worldY + envelope.top,
      width: envelope.width,
      height: envelope.height,
    })
    : d.bounds;
  const laidOut = layoutBounds && frameWidth > 0 && frameHeight > 0
    ? layoutBackView({
      type,
      bounds: layoutBounds,
      placement: d.placement,
      frameWidth,
      frameHeight,
      cameraX: projectionContext.cameraX,
      cameraY: projectionContext.cameraY,
      viewport: projectionContext.viewport,
    })
    : {
      viewX: d.worldX,
      viewY: d.worldY,
      canvasWidth: frameWidth,
      canvasHeight: frameHeight,
      layout: null,
    };
  // Resource page dimensions describe the decoded Content identity. The local
  // repeated surface is a separate layout concern and must never rewrite them.
  const image = imageRegion(frame);
  const frames = multiFrame
    ? Object.freeze(d.frames.map((item, index) => Object.freeze({
      frame: Number.isFinite(item.frame) ? item.frame : index,
      delay: Number.isFinite(item.delay) ? item.delay : null,
      image: imageRegion(item),
      offset: envelope.offsets[index],
      draw: Object.freeze({
        origin: item.origin ?? [0, 0],
        flip,
        opacity: d.opacity ?? 255,
      }),
    })))
    : null;
  return Object.freeze({
    key: plan.stableId,
    tag: "ms-map-back",
    attrs: Object.freeze({
      "stack-rank": String(plan.stackRank),
      visible: "true",
      "view-x": decimalAttr(laidOut.viewX),
      "view-y": decimalAttr(laidOut.viewY),
    }),
    data: Object.freeze({
      placementId: d.stableId,
      front: Boolean(d.front),
      source: Object.freeze({
        type: d.placement.type,
        rx: d.placement.rx,
        ry: d.placement.ry,
        cx: d.placement.cx,
        cy: d.placement.cy,
      }),
      presentation: d.presentation,
      layout: laidOut.layout,
      ...(multiFrame
        ? Object.freeze({
          mode: "local-animation",
          frames,
        })
        : Object.freeze({
          image,
          draw: Object.freeze({
            origin: frame?.origin ?? [0, 0],
            flip,
            opacity: d.opacity ?? 255,
          }),
        })),
      provenance: Object.freeze({
        mapId: d.mapId,
        group: d.sourceGroup,
        sourceOrder: d.sourceOrder,
        sortKey: d.sortKey,
        sortKeySource: d.sortKeySource,
      }),
    }),
    children: Object.freeze([]),
  });
}

function projectPortalFrame(item, index) {
  return Object.freeze({
    frame: Number.isFinite(Number(item.frame)) ? Number(item.frame) : index,
    delay: Number.isFinite(item.delay) ? item.delay : 0,
    image: imageRegion(item),
    draw: Object.freeze({
      origin: item.origin ?? [0, 0],
      flip: false,
      opacity: 255,
    }),
  });
}

function projectPortalFrames(frames) {
  return Object.freeze((frames ?? []).map((item, index) => projectPortalFrame(item, index)));
}

function projectPortal(plan) {
  const d = plan.drawable;
  const frame = d.frames[0];
  const provenance = Object.freeze({
    mapId: d.mapId,
    group: d.sourceGroup,
    sourceOrder: d.sourceOrder,
    portalStableId: d.portalStableId,
    visualName: d.visualName,
    sortKey: d.sortKey,
    sortKeySource: d.sortKeySource,
  });
  let data;
  let visible = "true";
  if (d.presentation === "sequence") {
    const portalStart = projectPortalFrames(d.clips?.portalStart);
    const portalContinue = projectPortalFrames(d.clips?.portalContinue);
    const portalExit = projectPortalFrames(d.clips?.portalExit);
    visible = "false";
    data = Object.freeze({
      visualId: d.stableId,
      phase: "sequence",
      clips: Object.freeze({ portalStart, portalContinue, portalExit }),
      frames: Object.freeze([...portalStart, ...portalContinue, ...portalExit]),
      provenance,
    });
  } else if (d.presentation === "loop") {
    data = Object.freeze({
      visualId: d.stableId,
      phase: "loop",
      frames: projectPortalFrames(d.frames),
      provenance,
    });
  } else {
    data = Object.freeze({
      visualId: d.stableId,
      phase: "static",
      image: imageRegion(frame),
      draw: Object.freeze({
        origin: frame?.origin ?? [0, 0],
        flip: false,
        opacity: 255,
      }),
      provenance,
    });
  }
  return Object.freeze({
    key: plan.stableId,
    tag: "ms-portal-visual",
    attrs: Object.freeze({
      "world-x": decimalAttr(d.worldX),
      "world-y": decimalAttr(d.worldY),
      "stack-rank": String(plan.stackRank),
      visible,
    }),
    data,
    children: Object.freeze([]),
  });
}

function projectMapObject(plan, projectionContext) {
  const d = plan.drawable;
  const frames = Object.freeze(d.frames.map((frame, index) => Object.freeze({
    frame: Number.isFinite(frame.frame) ? frame.frame : index,
    delay: Number.isFinite(frame.delay) ? frame.delay : 0,
    image: imageRegion(frame),
    draw: Object.freeze({
      origin: frame.origin ?? [0, 0],
      flip: Boolean(d.flip),
      opacity: d.opacity ?? 255,
    }),
  })));
  const firstFrame = d.frames[0];
  const frameWidth = firstFrame?.width ?? 0;
  const frameHeight = firstFrame?.height ?? 0;
  const laidOut = d.flowPlacement && d.bounds && frameWidth > 0 && frameHeight > 0
    ? layoutObjFlowView({
      bounds: d.bounds,
      placement: d.flowPlacement,
      frameWidth,
      frameHeight,
      anchorOffsetX: d.worldX - d.bounds.x,
      anchorOffsetY: d.worldY - d.bounds.y,
      cameraX: projectionContext.cameraX,
      cameraY: projectionContext.cameraY,
      viewport: projectionContext.viewport,
    })
    : { worldX: d.worldX, worldY: d.worldY, layout: null };
  return Object.freeze({
    key: plan.stableId,
    tag: "ms-map-object",
    attrs: Object.freeze({
      "world-x": decimalAttr(laidOut.worldX),
      "world-y": decimalAttr(laidOut.worldY),
      "stack-rank": String(plan.stackRank),
      visible: "true",
    }),
    data: Object.freeze({
      placementId: d.stableId,
      mode: "local-animation",
      frames,
      layout: laidOut.layout,
      source: d.flowPlacement,
      provenance: Object.freeze({
        mapId: d.mapId,
        group: d.sourceGroup,
        sourceOrder: d.sourceOrder,
        sortKey: d.sortKey,
        sortKeySource: d.sortKeySource,
      }),
    }),
    children: Object.freeze([]),
  });
}

function projectBatch(plan) {
  const pages = {};
  const items = {};
  const placements = [];

  for (const placement of plan.placements) {
    const frame = placement.frames[0];
    if (!frame?.resource) continue;
    const pageId = frame.resource.key;
    if (!pages[pageId]) {
      pages[pageId] = Object.freeze({
        resource: frame.resource,
        width: frame.width,
        height: frame.height,
      });
    }
    const itemId = placement.placementId;
    items[itemId] = Object.freeze({
      page: pageId,
      source: Object.freeze({ x: 0, y: 0, w: frame.width, h: frame.height }),
      origin: frame.origin ?? [0, 0],
    });
    placements.push(Object.freeze({
      placementId: placement.placementId,
      kind: placement.kind,
      sprite: itemId,
      x: placement.worldX,
      y: placement.worldY,
      flip: Boolean(placement.flip),
      opacity: placement.opacity ?? 255,
      order: Object.freeze({
        depth: placement.sortKey,
        tieOrder: placement.tieKey,
      }),
      provenance: Object.freeze({
        mapId: plan.mapId,
        group: placement.sourceGroup,
        sourceOrder: placement.sourceOrder,
      }),
    }));
  }

  return Object.freeze({
    key: plan.stableId,
    tag: "ms-map-batch",
    attrs: Object.freeze({
      "stack-rank": String(plan.stackRank),
      visible: "true",
    }),
    data: Object.freeze({
      batchId: plan.stableId,
      bounds: plan.bounds,
      depthInterval: plan.depthInterval,
      sprites: Object.freeze({
        pages: Object.freeze(pages),
        items: Object.freeze(items),
      }),
      placements: Object.freeze(placements),
    }),
    children: Object.freeze([]),
  });
}

export function projectRenderTree(scene, paintUnits, { cameraX = 0, cameraY = 0, viewport } = {}) {
  const projectionContext = { cameraX, cameraY, viewport };
  const children = paintUnits.map((plan) => {
    if (plan.kind === "ms-map-back") return projectBack(plan, projectionContext);
    if (plan.kind === "ms-portal-visual") return projectPortal(plan);
    if (plan.kind === "ms-map-object") return projectMapObject(plan, projectionContext);
    if (plan.kind === "ms-map-batch") return projectBatch(plan);
    throw new Error(`unknown paint unit kind ${plan.kind}`);
  });

  const root = Object.freeze({
    key: `scene:map${scene.mapId}`,
    tag: "ms-scene-view",
    attrs: Object.freeze({
      "camera-x": decimalAttr(cameraX),
      "camera-y": decimalAttr(cameraY),
      visible: "true",
    }),
    data: Object.freeze({
      mapId: scene.mapId,
      bounds: scene.bounds,
      pixelSnap: "round",
    }),
    children: Object.freeze(children),
  });

  const hashInput = Object.freeze({
    mapId: scene.mapId,
    bounds: scene.bounds,
    groupStatus: scene.groupStatus,
    portals: scene.portals.map((p) => Object.freeze({
      stableId: p.stableId,
      sourceOrder: p.sourceOrder,
      pn: p.pn,
      pt: p.pt,
      tm: p.tm,
      tn: p.tn,
      visualStatus: p.visualStatus,
    })),
    ordered: paintUnits.map((plan) => Object.freeze({
      kind: plan.kind,
      stableId: plan.stableId,
      stackRank: plan.stackRank,
      sortKey: plan.sortKey,
      tieKey: plan.tieKey,
      placementIds: plan.placements
        ? plan.placements.map((p) => p.placementId)
        : [plan.drawable.stableId],
    })),
    resources: scene.resources,
    tree: root,
  });

  return Object.freeze({
    root,
    paintUnits,
    hash: projectionHash(hashInput),
    hashInput,
  });
}

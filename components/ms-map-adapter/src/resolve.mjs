/**
 * MapFacts → ResolvedMapScene
 *
 * Associates placements with frames/resources, assigns stable identities,
 * and records missing/unsupported/no-visual diagnostics.
 */
import { resolveBounds } from "./bounds.mjs";
import {
  avatarSortKey,
  backSortKey,
  objSortKey,
  portalVisualSortKey,
  tileSortKey,
} from "./depth.mjs";
import {
  backLayoutUnsupportedMessage,
  backPresentation,
} from "./back-layout.mjs";
import { objFlowUnsupportedMessage } from "./obj-flow.mjs";
import {
  NO_VISUAL_PORTAL,
  RESOURCE_MISSING,
  SOURCE_ABSENT,
  SOURCE_EMPTY,
  SOURCE_PRESENT,
  UNSUPPORTED,
  VISUAL_PORTAL,
  diagnose,
  portalVisualName,
} from "./status.mjs";

function resourceRef(resources, logicalKey) {
  const entry = resources.get(logicalKey);
  if (!entry) return null;
  return Object.freeze({
    namespace: entry.namespace,
    key: entry.key,
    contentVersion: entry.contentVersion,
  });
}

/**
 * File order paints later backs in front. Folkvillage lists the distant lake
 * after the nearer meadow, so that opaque water cuts the hills. Draw the lake
 * just before the first nearer sheet; every other back keeps its file index.
 */
function backDepthIndex(row, rows) {
  if (row.bS !== "folkvillige" || Number(row.no) !== 2 || Number(row.ry) !== -30) {
    return row.sourceOrder;
  }
  const nearer = rows.filter((other) => (
    other.sourceOrder < row.sourceOrder && Number(other.ry) < Number(row.ry)
  ));
  if (nearer.length === 0) return row.sourceOrder;
  return Math.min(...nearer.map((other) => other.sourceOrder)) - 1;
}

function worldBoundsFrom(origin, width, height, x, y, flip) {
  const ox = origin?.[0] ?? 0;
  const oy = origin?.[1] ?? 0;
  // Flip mirrors around the placement anchor (x,y), not the top-left.
  const left = flip ? x - (width - ox) : x - ox;
  const top = y - oy;
  return Object.freeze({ x: left, y: top, width, height });
}

function findBackFrames(frames, bS, no, ani) {
  const table = frames.back[`map.back.${bS}`];
  if (!table || table.status !== SOURCE_PRESENT) return { table, framesFor: [] };
  if (!ani) {
    const frame = table.rows.find((row) => row.kind === "back" && Number(row.no) === Number(no)) ?? null;
    return { table, framesFor: frame ? [frame] : [] };
  }
  const framesFor = table.rows
    .filter((row) => row.kind === "ani" && Number(row.no) === Number(no))
    .slice()
    .sort((a, b) => Number(a.frame ?? 0) - Number(b.frame ?? 0));
  return { table, framesFor };
}

function findTileFrame(frames, tileSet, u, no) {
  const table = frames.tile[`map.tile.${tileSet}`];
  if (!table || table.status !== SOURCE_PRESENT) return { table, frame: null };
  const frame = table.rows.find((row) => row.u === u && Number(row.no) === Number(no)) ?? null;
  return { table, frame };
}

function findObjFrames(frames, oS, l0, l1, l2) {
  const table = frames.obj[`map.obj.${oS}`];
  if (!table || table.status !== SOURCE_PRESENT) return { table, framesFor: [] };
  const framesFor = table.rows
    .filter((row) => row.l0 === l0 && row.l1 === l1 && row.l2 === l2)
    .slice()
    .sort((a, b) => Number(a.frame ?? 0) - Number(b.frame ?? 0));
  return { table, framesFor };
}

function findHelperFrames(helper, name) {
  if (!helper || helper.status !== SOURCE_PRESENT) return [];
  return helper.rows
    .filter((row) => row.branch === "portal" && row.use === "game" && row.name === name)
    .slice()
    .sort((a, b) => String(a.frame).localeCompare(String(b.frame), "en"));
}

function stablePlacementId(mapId, group, sourceOrder) {
  return `${group}:map${mapId}:${sourceOrder}`;
}

/**
 * @param {object} facts from readMapFacts
 */
export function resolveMapScene(facts) {
  const mapId = facts.mapId;
  const diagnostics = [...facts.diagnostics];
  if (facts.status !== SOURCE_PRESENT || !facts.map) {
    return Object.freeze({
      mapId,
      status: facts.status,
      bounds: null,
      drawables: Object.freeze([]),
      portals: Object.freeze([]),
      footholds: Object.freeze([]),
      ropes: Object.freeze([]),
      seats: Object.freeze([]),
      insertionPoints: Object.freeze([]),
      resources: Object.freeze([]),
      diagnostics: Object.freeze(diagnostics),
      groupStatus: Object.freeze({}),
    });
  }

  const groupStatus = {};
  for (const [name, group] of Object.entries(facts.groups)) {
    groupStatus[name] = group.status;
  }

  const { bounds, diagnostics: boundDiagnostics } = resolveBounds(
    facts.map,
    facts.groups.foothold.rows,
    mapId,
  );
  diagnostics.push(...boundDiagnostics);

  const drawables = [];
  const resourcesUsed = new Map();

  // --- Back ---
  for (const row of facts.groups.back.rows) {
    const stableId = stablePlacementId(mapId, "back", row.sourceOrder);
    const front = Number(row.front) !== 0;
    const type = Number(row.type);
    const animated = Number(row.ani) !== 0;
    const { framesFor } = findBackFrames(facts.frames, row.bS, row.no, animated);
    const frame = framesFor[0] ?? null;
    const sortKey = backSortKey(backDepthIndex(row, facts.groups.back.rows), front);
    const base = {
      stableId,
      sourceKind: "back",
      sourceGroup: "back",
      sourceOrder: row.sourceOrder,
      mapId,
      worldX: row.x,
      worldY: row.y,
      sortKey,
      tieKey: row.sourceOrder,
      sortKeySource: "OPENMS-REFERENCE",
      front,
      updateClass: framesFor.length > 1 ? "local-animation" : "camera-relative",
      placement: Object.freeze({
        bS: row.bS,
        no: row.no,
        ani: row.ani,
        type,
        rx: row.rx,
        ry: row.ry,
        cx: row.cx,
        cy: row.cy,
        f: row.f,
        a: row.a,
        front: row.front,
      }),
    };

    const unsupportedLayout = backLayoutUnsupportedMessage(type);
    if (unsupportedLayout) {
      diagnostics.push(diagnose(UNSUPPORTED, unsupportedLayout, {
        mapId,
        group: "back",
        sourceOrder: row.sourceOrder,
        stableId,
      }));
    }

    if (!frame) {
      diagnostics.push(diagnose("back-frame-missing", `no BackFrame for ${row.bS}/${row.no}`, {
        mapId,
        group: "back",
        sourceOrder: row.sourceOrder,
        stableId,
      }));
      drawables.push(Object.freeze({
        ...base,
        resolved: false,
        frames: Object.freeze([]),
        bounds: null,
        resource: null,
      }));
      continue;
    }

    const flip = Number(row.f) !== 0;
    const opacity = Number.isInteger(row.a) ? row.a : 255;
    const resolvedFrames = Object.freeze(framesFor.map((item, index) => Object.freeze({
      frame: Number.isFinite(item.frame) ? Number(item.frame) : index,
      origin: Object.freeze([...(item.origin ?? [0, 0])]),
      width: item.width,
      height: item.height,
      z: item.z,
      delay: item.delay,
      resource: resourceRef(facts.resources, item.resource),
    })));
    for (let index = 0; index < resolvedFrames.length; index += 1) {
      const item = resolvedFrames[index];
      if (item.resource) {
        resourcesUsed.set(item.resource.key, item.resource);
      } else {
        diagnostics.push(diagnose(RESOURCE_MISSING, `missing back resource ${framesFor[index].resource}`, {
          mapId,
          group: "back",
          sourceOrder: row.sourceOrder,
          stableId,
          resourceKey: framesFor[index].resource,
          frame: item.frame,
        }));
      }
    }
    const resource = resolvedFrames[0].resource;

    drawables.push(Object.freeze({
      ...base,
      resolved: resolvedFrames.every((item) => Boolean(item.resource)),
      presentation: backPresentation(type),
      frames: resolvedFrames,
      bounds: resource
        ? worldBoundsFrom(frame.origin, frame.width, frame.height, row.x, row.y, flip)
        : null,
      flip,
      opacity,
      resource,
    }));
  }

  // --- Tile ---
  for (const row of facts.groups.tile.rows) {
    const stableId = stablePlacementId(mapId, "tile", row.sourceOrder);
    const layer = Number(row.layer);
    const tileSet = facts.map.layers?.[String(row.layer)]?.tileSet;
    const { frame } = tileSet
      ? findTileFrame(facts.frames, tileSet, row.u, row.no)
      : { frame: null };

    if (!frame) {
      diagnostics.push(diagnose("tile-frame-missing", `no TileFrame for ${tileSet}/${row.u}/${row.no}`, {
        mapId,
        group: "tile",
        sourceOrder: row.sourceOrder,
        stableId,
      }));
      drawables.push(Object.freeze({
        stableId,
        sourceKind: "tile",
        sourceGroup: "tile",
        sourceOrder: row.sourceOrder,
        mapId,
        worldX: row.x,
        worldY: row.y,
        sortKey: 0,
        tieKey: row.sourceOrder,
        sortKeySource: "CMS079-PROVEN",
        updateClass: "static",
        resolved: false,
        frames: Object.freeze([]),
        bounds: null,
        resource: null,
        placement: Object.freeze({
          layer: row.layer,
          x: row.x,
          y: row.y,
          u: row.u,
          no: row.no,
          zM: row.zM,
          tileSet: tileSet ?? null,
        }),
      }));
      continue;
    }

    if (!Number.isFinite(frame.z)) {
      diagnostics.push(diagnose("tile-canvas-z-absent", `TileFrame missing canvas z`, {
        mapId,
        group: "tile",
        sourceOrder: row.sourceOrder,
        stableId,
        tileSet,
        u: row.u,
        no: row.no,
      }));
      drawables.push(Object.freeze({
        stableId,
        sourceKind: "tile",
        sourceGroup: "tile",
        sourceOrder: row.sourceOrder,
        mapId,
        worldX: row.x,
        worldY: row.y,
        sortKey: 0,
        tieKey: row.sourceOrder,
        sortKeySource: "CMS079-PROVEN",
        updateClass: "static",
        resolved: false,
        frames: Object.freeze([]),
        bounds: null,
        resource: null,
        placement: Object.freeze({
          layer: row.layer,
          x: row.x,
          y: row.y,
          u: row.u,
          no: row.no,
          zM: row.zM,
          tileSet,
        }),
      }));
      continue;
    }

    const resource = resourceRef(facts.resources, frame.resource);
    if (!resource) {
      diagnostics.push(diagnose(RESOURCE_MISSING, `missing tile resource ${frame.resource}`, {
        mapId,
        group: "tile",
        sourceOrder: row.sourceOrder,
        stableId,
        resourceKey: frame.resource,
      }));
    } else {
      resourcesUsed.set(resource.key, resource);
    }

    const sortKey = tileSortKey(frame.z, layer, Number(row.zM));
    const resolvedFrame = Object.freeze({
      origin: Object.freeze([...(frame.origin ?? [0, 0])]),
      width: frame.width,
      height: frame.height,
      z: frame.z,
      resource,
    });

    drawables.push(Object.freeze({
      stableId,
      sourceKind: "tile",
      sourceGroup: "tile",
      sourceOrder: row.sourceOrder,
      mapId,
      worldX: row.x,
      worldY: row.y,
      sortKey,
      tieKey: row.sourceOrder,
      sortKeySource: "CMS079-PROVEN",
      updateClass: "static",
      layer,
      zM: Number(row.zM),
      canvasZ: frame.z,
      resolved: Boolean(resource),
      frames: Object.freeze([resolvedFrame]),
      bounds: resource
        ? worldBoundsFrom(frame.origin, frame.width, frame.height, row.x, row.y, false)
        : null,
      flip: false,
      opacity: 255,
      resource,
      placement: Object.freeze({
        layer: row.layer,
        x: row.x,
        y: row.y,
        u: row.u,
        no: row.no,
        zM: row.zM,
        tileSet,
      }),
    }));
  }

  // --- Obj ---
  for (const row of facts.groups.obj.rows) {
    const stableId = stablePlacementId(mapId, "obj", row.sourceOrder);
    const layer = Number(row.layer);
    const hasFlow = Object.prototype.hasOwnProperty.call(row, "flow");
    const rValue = row.r;
    const rUnsupported = rValue !== undefined && Number(rValue) !== 0;
    const flowUnsupportedMessage = hasFlow ? objFlowUnsupportedMessage(row) : null;
    if (rUnsupported) {
      diagnostics.push(diagnose(UNSUPPORTED, "obj visual field unsupported (r)", {
        mapId,
        group: "obj",
        sourceOrder: row.sourceOrder,
        stableId,
        r: row.r,
      }));
    } else if (flowUnsupportedMessage) {
      diagnostics.push(diagnose(UNSUPPORTED, flowUnsupportedMessage, {
        mapId,
        group: "obj",
        sourceOrder: row.sourceOrder,
        stableId,
        flow: row.flow,
        rx: row.rx,
        cx: row.cx,
        cy: row.cy,
      }));
    }

    const { framesFor } = findObjFrames(facts.frames, row.oS, row.l0, row.l1, row.l2);
    const frame = framesFor[0] ?? null;
    if (!frame) {
      diagnostics.push(diagnose("obj-frame-missing", `no ObjFrame for ${row.oS}/${row.l0}/${row.l1}/${row.l2}`, {
        mapId,
        group: "obj",
        sourceOrder: row.sourceOrder,
        stableId,
      }));
      drawables.push(Object.freeze({
        stableId,
        sourceKind: "obj",
        sourceGroup: "obj",
        sourceOrder: row.sourceOrder,
        mapId,
        worldX: row.x,
        worldY: row.y,
        sortKey: objSortKey(layer, Number(row.z)),
        tieKey: row.sourceOrder,
        sortKeySource: "CMS079-PROVEN",
        updateClass: "static",
        resolved: false,
        frames: Object.freeze([]),
        bounds: null,
        resource: null,
        placement: Object.freeze({
          layer: row.layer,
          oS: row.oS,
          l0: row.l0,
          l1: row.l1,
          l2: row.l2,
          x: row.x,
          y: row.y,
          z: row.z,
          f: row.f,
          zM: row.zM,
        }),
      }));
      continue;
    }

    const resource = resourceRef(facts.resources, frame.resource);
    if (!resource) {
      diagnostics.push(diagnose(RESOURCE_MISSING, `missing obj resource ${frame.resource}`, {
        mapId,
        group: "obj",
        sourceOrder: row.sourceOrder,
        stableId,
        resourceKey: frame.resource,
      }));
    } else {
      resourcesUsed.set(resource.key, resource);
    }

    const flip = Number(row.f) !== 0;
    const sortKey = objSortKey(layer, Number(row.z));
    const multiFrame = framesFor.length > 1;
    const flowEnabled = hasFlow && Number(row.flow) !== 0;
    const flowSupported = flowEnabled && !flowUnsupportedMessage && !rUnsupported;
    const resolvedFrames = Object.freeze(framesFor.map((item) => Object.freeze({
      frame: Number(item.frame ?? 0),
      origin: Object.freeze([...(item.origin ?? [0, 0])]),
      width: item.width,
      height: item.height,
      z: item.z,
      delay: item.delay,
      resource: resourceRef(facts.resources, item.resource),
    })));
    for (const item of resolvedFrames) {
      if (item.resource) resourcesUsed.set(item.resource.key, item.resource);
    }

    drawables.push(Object.freeze({
      stableId,
      sourceKind: "obj",
      sourceGroup: "obj",
      sourceOrder: row.sourceOrder,
      mapId,
      worldX: row.x,
      worldY: row.y,
      sortKey,
      tieKey: row.sourceOrder,
      sortKeySource: "CMS079-PROVEN",
      updateClass: multiFrame || flowSupported ? "local-animation" : "static",
      layer,
      z: Number(row.z),
      zM: row.zM === undefined ? null : Number(row.zM),
      resolved: Boolean(resource) && !rUnsupported && (!flowEnabled || flowSupported),
      unsupported: rUnsupported || (flowEnabled && !flowSupported),
      flowPlacement: flowSupported ? Object.freeze({
        flow: Number(row.flow),
        rx: row.rx === undefined ? null : Number(row.rx),
        cx: row.cx === undefined ? 0 : Number(row.cx),
        cy: row.cy === undefined ? 0 : Number(row.cy),
      }) : null,
      frames: resolvedFrames,
      bounds: resource
        ? worldBoundsFrom(frame.origin, frame.width, frame.height, row.x, row.y, flip)
        : null,
      flip,
      opacity: 255,
      resource,
      placement: Object.freeze({
        layer: row.layer,
        oS: row.oS,
        l0: row.l0,
        l1: row.l1,
        l2: row.l2,
        x: row.x,
        y: row.y,
        z: row.z,
        f: row.f,
        zM: row.zM,
      }),
    }));
  }

  // --- Portals (logic + optional visual drawable) ---
  const portals = [];
  for (const row of facts.groups.portal.rows) {
    const stableId = stablePlacementId(mapId, "portal", row.sourceOrder);
    const pt = Number(row.pt);
    const visualName = portalVisualName(pt);
    const visualStatus = visualName ? VISUAL_PORTAL : NO_VISUAL_PORTAL;
    const helperFrames = visualName ? findHelperFrames(facts.frames.helper, visualName) : [];
    const first = helperFrames[0] ?? null;
    let resource = null;
    if (visualName && !first) {
      diagnostics.push(diagnose("portal-helper-frame-missing", `no HelperFrame for portal/${visualName}`, {
        mapId,
        group: "portal",
        sourceOrder: row.sourceOrder,
        stableId,
        visualName,
      }));
    }
    if (first) {
      resource = resourceRef(facts.resources, first.resource);
      if (!resource) {
        diagnostics.push(diagnose(RESOURCE_MISSING, `missing portal resource ${first.resource}`, {
          mapId,
          group: "portal",
          sourceOrder: row.sourceOrder,
          stableId,
          resourceKey: first.resource,
        }));
      } else {
        resourcesUsed.set(resource.key, resource);
      }
    }

    const portal = Object.freeze({
      stableId,
      sourceOrder: row.sourceOrder,
      mapId,
      pn: row.pn,
      pt,
      x: row.x,
      y: row.y,
      tm: row.tm,
      tn: row.tn,
      visualStatus,
      visualName,
      script: row.script,
      image: row.image,
    });
    portals.push(portal);

    if (visualStatus === NO_VISUAL_PORTAL) {
      diagnostics.push(diagnose(NO_VISUAL_PORTAL, `portal pt=${pt} has no artwork branch`, {
        mapId,
        group: "portal",
        sourceOrder: row.sourceOrder,
        stableId,
        pn: row.pn,
        pt,
      }));
      continue;
    }

    // Visual portals become drawables; phase animation beyond first frame is deferred.
    const sortKey = portalVisualSortKey(row.sourceOrder);
    drawables.push(Object.freeze({
      stableId: `${stableId}:visual`,
      sourceKind: "portal-visual",
      sourceGroup: "portal",
      sourceOrder: row.sourceOrder,
      mapId,
      worldX: row.x,
      worldY: row.y,
      sortKey,
      tieKey: row.sourceOrder,
      sortKeySource: "PRODUCT-DECISION",
      updateClass: helperFrames.length > 1 ? "local-animation" : "static",
      resolved: Boolean(resource),
      presentation: "static-first-frame",
      visualName,
      portalStableId: stableId,
      frames: first
        ? Object.freeze([Object.freeze({
          origin: Object.freeze([...(first.origin ?? [0, 0])]),
          width: first.width,
          height: first.height,
          resource,
          frame: first.frame,
        })])
        : Object.freeze([]),
      bounds: resource && first
        ? worldBoundsFrom(first.origin, first.width, first.height, row.x, row.y, false)
        : null,
      flip: false,
      opacity: 255,
      resource,
      placement: Object.freeze({
        pn: row.pn,
        pt,
        x: row.x,
        y: row.y,
        tm: row.tm,
        tn: row.tn,
      }),
    }));
  }

  // --- Foothold / Rope / Seat (logic only) ---
  const footholds = Object.freeze(facts.groups.foothold.rows.map((row) => Object.freeze({
    stableId: stablePlacementId(mapId, "foothold", row.sourceOrder),
    sourceOrder: row.sourceOrder,
    layer: row.layer,
    platform: row.platform,
    id: row.id,
    x1: row.x1,
    y1: row.y1,
    x2: row.x2,
    y2: row.y2,
    prev: row.prev,
    next: row.next,
    force: row.force,
    forbidFallDown: row.forbidFallDown,
  })));

  const ropes = Object.freeze(facts.groups.rope.rows.map((row) => Object.freeze({
    ...row,
    stableId: stablePlacementId(mapId, "rope", row.sourceOrder),
    sourceOrder: row.sourceOrder,
  })));

  const seats = Object.freeze(facts.groups.seat.rows.map((row) => Object.freeze({
    ...row,
    stableId: stablePlacementId(mapId, "seat", row.sourceOrder),
    sourceOrder: row.sourceOrder,
  })));

  // Reachable avatar insertion keys from foothold layer/platform pairs.
  const pairKeys = new Set();
  const insertionPoints = [];
  for (const fh of footholds) {
    const token = `${Number(fh.layer)}:${Number(fh.platform)}`;
    if (pairKeys.has(token)) continue;
    pairKeys.add(token);
    const layer = Number(fh.layer);
    const zM = Number(fh.platform);
    insertionPoints.push(Object.freeze({
      layer,
      zM,
      flag0: avatarSortKey(layer, zM, 0),
      flag1: avatarSortKey(layer, zM, 1),
    }));
  }
  insertionPoints.sort((a, b) => (a.flag0 - b.flag0) || (a.layer - b.layer) || (a.zM - b.zM));

  if (facts.groups.seat.status === SOURCE_ABSENT) {
    diagnostics.push(diagnose(SOURCE_ABSENT, "seat group absent for map", { mapId, group: "seat" }));
  } else if (facts.groups.seat.status === SOURCE_EMPTY) {
    diagnostics.push(diagnose(SOURCE_EMPTY, "seat group empty for map", { mapId, group: "seat" }));
  }

  return Object.freeze({
    mapId,
    status: SOURCE_PRESENT,
    map: facts.map,
    bounds,
    drawables: Object.freeze(drawables),
    portals: Object.freeze(portals),
    footholds,
    ropes,
    seats,
    insertionPoints: Object.freeze(insertionPoints),
    resources: Object.freeze([...resourcesUsed.values()].sort((a, b) => (a.key < b.key ? -1 : 1))),
    diagnostics: Object.freeze(diagnostics),
    groupStatus: Object.freeze(groupStatus),
  });
}

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildMapProjection } from "../src/index.mjs";
import {
  layoutObjFlowView,
  objFlowUnsupportedMessage,
} from "../src/obj-flow.mjs";
import { resetSyntheticFsdb, writeSyntheticMap } from "./fixtures/synthetic-fsdb.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SUITE = "obj-flow";

test("objFlowUnsupportedMessage fail-closes unknown flow modes", () => {
  assert.equal(objFlowUnsupportedMessage({ flow: 0 }), null);
  assert.equal(objFlowUnsupportedMessage({ flow: 1, rx: 10 }), null);
  assert.match(objFlowUnsupportedMessage({ flow: 2, rx: 1 }), /not implemented/u);
  assert.match(objFlowUnsupportedMessage({ flow: 1 }), /rx/u);
});

test("230030200 flow placements project ms-map-object hosts with bounded layout", async () => {
  const projection = await buildMapProjection({
    mapId: "230030200",
    gameRoot: repoRoot,
    viewport: { width: 1000, height: 700 },
  });
  const flowNodes = projection.projection.root.children.filter(
    (node) => node.tag === "ms-map-object" && node.data?.source?.flow === 1,
  );
  assert.equal(flowNodes.length, 11);
  for (const node of flowNodes) {
    assert.equal(node.data.layout.kind, "flow-horizontal");
    assert.equal(node.data.layout.canvasWidth, 1000);
    assert.ok(node.data.frames.length >= 4);
    assert.equal(node.data.layout.frameWidth, node.data.frames[0].image.pageWidth);
    assert.ok(node.data.layout.scroll?.pixelsPerMs);
  }
});

test("synthetic animated Obj without flow stays a non-tiled ms-map-object", async () => {
  const fsdbRoot = await resetSyntheticFsdb(SUITE);
  await writeSyntheticMap({ suiteId: SUITE, mapId: "900000012", animatedObj: true });
  const projection = await buildMapProjection({ mapId: "900000012", fsdbRoot });
  const objectNode = projection.projection.root.children.find((node) => node.tag === "ms-map-object");
  assert.ok(objectNode);
  assert.equal(objectNode.data.layout, null);
  assert.equal(objectNode.data.frames.length, 2);
});

test("layoutObjFlowView uses frame width when cx is zero", () => {
  const laidOut = layoutObjFlowView({
    bounds: { x: 10, y: 20, width: 32, height: 32 },
    placement: { flow: 1, rx: -8, cx: 0, cy: 0 },
    frameWidth: 32,
    frameHeight: 32,
    anchorOffsetX: 16,
    anchorOffsetY: 16,
    cameraX: 5,
    cameraY: 0,
    viewport: { width: 1000, height: 700 },
  });
  assert.equal(laidOut.layout.tileStepX, 32);
  assert.equal(laidOut.layout.anchorOffsetX, 16);
  assert.equal(laidOut.layout.anchorOffsetY, 16);
  assert.equal(laidOut.worldX, 5);
  assert.equal(laidOut.canvasWidth, 1000);
});

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFieldProjection } from "../src/field-project.mjs";
import { presentationViewFromStore } from "../src/store-bridge.mjs";

const storeUrl = pathToFileURL(path.resolve(
  import.meta.dirname,
  "../../../loom-realm/packages/renderer/dist/internal/render-store.js",
));

test("RendererRenderStore snapshot carries inserted player and camera attrs", async () => {
  const { RendererRenderStore } = await import(storeUrl);
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const projection = await buildFieldProjection({ gameRoot: repoRoot, paintUnitCap: 6, viewport: { width: 64, height: 64 } });
  const store = new RendererRenderStore(8);
  const identity = { sessionId: "session-field", subsystemKey: "field" };
  store.beginCarrier();
  assert.equal(store.onDomains({ type: "render.domains", domains: ["field"] }).kind, "accepted");
  assert.equal(store.onSnapshot({
    type: "render.snapshot",
    domainId: "field",
    revision: 1,
    zIndex: 0,
    roots: [projection.root],
  }).kind, "accepted");
  const view = presentationViewFromStore(store, identity);
  assert.equal(view.subsystems[0].eligible, true);
  const root = view.subsystems[0].domains[0].roots[0];
  assert.ok(root.children.some((child) => child.key === "player:adventure"));
  assert.equal(root.attrs["camera-x"], projection.root.attrs["camera-x"]);
  assert.equal(store.onPatch({
    type: "render.patch",
    domainId: "field",
    baseRevision: 1,
    revision: 2,
    ops: [{
      op: "update",
      key: "player:adventure",
      attrs: { set: { "world-x": "-80" } },
    }],
  }).kind, "accepted");
});
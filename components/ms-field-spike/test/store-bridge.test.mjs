import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createSpikeTree } from "../src/fixture.mjs";
import { presentationViewFromStore } from "../src/store-bridge.mjs";

const storeUrl = pathToFileURL(path.resolve(
  import.meta.dirname,
  "../../../loom-realm/packages/renderer/dist/internal/render-store.js",
));

test("RendererRenderStore facts are the only presentation view", async () => {
  const { RendererRenderStore } = await import(storeUrl);
  const store = new RendererRenderStore(4);
  const identity = { sessionId: "session-spike", subsystemKey: "field" };
  store.beginCarrier();
  assert.equal(store.onDomains({ type: "render.domains", domains: ["field"] }).kind, "accepted");
  assert.equal(presentationViewFromStore(store, identity).subsystems[0].eligible, false);

  const scene = createSpikeTree();
  assert.equal(store.onSnapshot({
    type: "render.snapshot",
    domainId: "field",
    revision: 1,
    zIndex: 2,
    roots: [scene],
  }).kind, "accepted");
  const view = presentationViewFromStore(store, identity);
  assert.equal(view.sessionId, "session-spike");
  assert.equal(view.subsystems[0].eligible, true);
  assert.equal(view.subsystems[0].generation, 4);
  assert.equal(view.subsystems[0].domains[0].zIndex, 2);
  assert.equal(view.subsystems[0].domains[0].roots[0], store.readPresentationFacts().domains[0].roots[0]);
  assert.deepEqual(view.subsystems[0].domains[0].roots[0].children.map((child) => child.key), [
    "batch:back",
    "actor-host:spike",
    "batch:front",
  ]);

  assert.equal(store.onPatch({
    type: "render.patch",
    domainId: "field",
    baseRevision: 1,
    revision: 2,
    ops: [{ op: "update", key: "scene:spike", attrs: { set: { "camera-x": "6", "camera-y": "6" } } }],
  }).kind, "accepted");
  assert.equal(store.readPresentationFacts().domains[0].roots[0].attrs["camera-x"], "6");
  assert.equal(store.readPresentationFacts().domains[0].roots[0].children[0].data.batchId, "back");

  const before = JSON.stringify(store.readPresentationFacts());
  const rejected = store.onPatch({
    type: "render.patch",
    domainId: "field",
    baseRevision: 1,
    revision: 2,
    ops: [{ op: "update", key: "scene:spike", attrs: { set: { "camera-x": "9" } } }],
  });
  assert.equal(rejected.kind, "protocol-fatal");
  assert.equal(JSON.stringify(store.readPresentationFacts()), before);
});

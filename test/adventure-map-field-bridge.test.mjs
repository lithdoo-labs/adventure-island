// M3 Field projection bridge and Frame integration for adventure-map.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateFieldTree } from "../components/ms-field/src/validate.mjs";
import { buildCanonicalAdventureFieldPlanContent } from "../scripts/pwa/read-adventure-field-plan.mjs";
import { projectAdventureMapFieldScene } from "../systems/adventure-map/field-static-projection.mjs";
import {
  FIELD_SCENE_ROOT_KEY,
  projectAdventureMapFieldSceneFromPlan,
} from "../systems/adventure-map/field-scene-runtime.mjs";
import { FIELD_PLAN_KEY, FIELD_PLAN_NAMESPACE } from "../systems/adventure-map/field-plan-model.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("adventure-map field bridge projects full 222000000 static scene", async () => {
  const projection = await projectAdventureMapFieldScene({
    gameRoot: repoRoot,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(validateFieldTree(projection.root).ok, true);
  assert.equal(projection.root.children.length, projection.map.paintUnits.length + 1);
  assert.equal(projection.root.tag, "ms-scene-view");
  assert.ok(projection.root.children.some((child) => child.key === "player:adventure"));
});

test("bundle-derived AdventureFieldPlan/bootstrap reprojects through the browser-safe runtime", async () => {
  const { plan } = await buildCanonicalAdventureFieldPlanContent({ gameRoot: repoRoot });
  const projection = projectAdventureMapFieldSceneFromPlan(plan, { width: 800, height: 600 });
  assert.equal(validateFieldTree(projection.root).ok, true);
  assert.equal(projection.root.key, FIELD_SCENE_ROOT_KEY);
  assert.equal(projection.fromContent, true);
  assert.equal(projection.root.attrs["camera-x"], "-492");
  assert.equal(projection.root.attrs["camera-y"], "-390");
});

test("adventure-map subsystem reads FieldPlan via scope.content.record", async () => {
  const source = await readFile(path.join(repoRoot, "systems/adventure-map/subsystem.mjs"), "utf8");
  assert.match(source, /ms-scene-view/);
  assert.match(source, /scope\.content\.record/);
  assert.match(source, /FIELD_PLAN_NAMESPACE/);
  assert.match(source, new RegExp(FIELD_PLAN_KEY));
  assert.match(source, /projectAdventureMapFieldSceneFromPlan/);
  assert.match(source, /FIELD_SCENE_ROOT_KEY/);
  assert.doesNotMatch(source, /field-scene-baseline/);
  assert.doesNotMatch(source, /tag:\s*"cms-actor"/);
});
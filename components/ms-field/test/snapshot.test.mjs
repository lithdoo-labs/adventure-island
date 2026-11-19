import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildFieldProjection } from "../src/field-project.mjs";
import { validateFieldTree } from "../src/validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..", "..");

test("222000000 field tree validates and keeps adapter sibling order", async () => {
  const projection = await buildFieldProjection({
    gameRoot: repoRoot,
    paintUnitCap: 12,
    viewport: { width: 96, height: 96 },
  });
  assert.equal(validateFieldTree(projection.root).ok, true);
  assert.equal(projection.root.data.mapId, "222000000");
  assert.equal(projection.root.children.length, 13);
});

test("field presentation is registered on the canonical PWA path", async () => {
  const presentation = await readFile(path.join(repoRoot, "presentation.json"), "utf8");
  assert.match(presentation, /ms-field\/ms-field\.browser\.js/);
  const elements = await readFile(path.join(root, "src", "elements.mjs"), "utf8");
  assert.equal(/adventure-map\/subsystem/i.test(elements), false);
});
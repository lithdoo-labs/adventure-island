// Headless validation for the canonical root presentation manifest
// (PWA migration 3A; issue #62 registers TWO classic scripts: the pinned
// common-controls IIFE first — it defines the `game-controls-input` element
// Base projects — and the cms-actor IIFE second).
//
// Deterministic base layer: presentation.json is a valid Web Presentation
// Config V1 as allowed by the pinned loom-realm submodule
// (93648192323bf5f57996b7b54cbae641d8a53fdb,
// packages/renderer/src/internal/web-presentation-config.ts,
// validateWebPresentationConfigV1): an exact
// { formatVersion, scripts, styles } object whose entries are exact
// { namespace, key } Content resource references. The application declares
// exactly two scripts, in order:
//   resource.Presentation/controls/device-input.browser.js
//   resource.Presentation/cms-actor/cms-actor.browser.js
// (apps/pwa/src/renderer-host.ts prefixes `resource.` onto the declared
// namespace when fetching bootstrap scripts from the installation Content).
//
// Optional deep layer (auto-enabled when the checked-out loom-realm submodule
// has been built): the real pinned validator accepts the document.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);
const loomRealmRoot = new URL("loom-realm/", repoRoot);

const EXPECTED_PRESENTATION = Object.freeze({
  formatVersion: 1,
  styles: Object.freeze([]),
  scripts: Object.freeze([
    Object.freeze({ namespace: "Presentation", key: "controls/device-input.browser.js" }),
    Object.freeze({ namespace: "Presentation", key: "cms-actor/cms-actor.browser.js" }),
  ]),
});

const readText = (url) => readFile(url, "utf8");

// ---------------------------------------------------------------------------
// Structural validation mirroring the pinned LoomRealm rules
// ---------------------------------------------------------------------------

function exactObjectKeys(value, expected, label) {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expected].sort(),
    `${label} has an invalid shape`,
  );
  return value;
}

/** Mirrors segment() (renderer/src/internal/web-presentation-config.ts). */
function validSegment(value, hierarchy) {
  if (typeof value !== "string" || value.length === 0 || value === "." || value === "..") return false;
  if (/[\\\0]|\p{Cc}|\p{Cs}/u.test(value)) return false;
  if (!hierarchy && value.includes("/")) return false;
  if (value.startsWith("/") || value.endsWith("/")) return false;
  if (value.split("/").some((part) => part.length === 0 || part === "." || part === "..")) return false;
  if (/^[A-Za-z]:/.test(value) || value.startsWith("\\\\")) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  return true;
}

/** Mirrors refs() + validateWebPresentationConfigV1. */
function validatePresentationStructural(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    assert.fail(`${label}: not valid JSON (${cause.message})`);
  }
  const record = exactObjectKeys(value, ["formatVersion", "scripts", "styles"], `${label}: Web Presentation Config`);
  assert.equal(record.formatVersion, 1, `${label}: unsupported Web Presentation Config formatVersion`);

  const normalize = (list, listLabel) => {
    assert.ok(Array.isArray(list), `${label}: ${listLabel} must be an array`);
    const seen = new Set();
    return Object.freeze(list.map((candidate, index) => {
      const ref = exactObjectKeys(candidate, ["namespace", "key"], `${label}: ${listLabel}[${index}]`);
      assert.ok(validSegment(ref.namespace, false), `${label}: invalid ${listLabel}[${index}] namespace`);
      assert.ok(validSegment(ref.key, true), `${label}: invalid ${listLabel}[${index}] key`);
      const identity = JSON.stringify([ref.namespace, ref.key]);
      assert.ok(!seen.has(identity), `${label}: duplicate ${listLabel} resource`);
      seen.add(identity);
      return Object.freeze({ namespace: ref.namespace, key: ref.key });
    }));
  };
  return Object.freeze({
    formatVersion: 1,
    styles: normalize(record.styles, "styles"),
    scripts: normalize(record.scripts, "scripts"),
  });
}

// ---------------------------------------------------------------------------
// Deterministic base validation
// ---------------------------------------------------------------------------

test("the root presentation manifest registers the Controls and cms-actor classic scripts in order", async () => {
  const presentation = validatePresentationStructural(
    await readText(new URL("presentation.json", repoRoot)),
    "presentation.json (root)",
  );
  assert.deepEqual(presentation, EXPECTED_PRESENTATION);
  assert.equal(presentation.styles.length, 0, "the application declares no styles");
  assert.deepEqual(
    presentation.scripts,
    [
      { namespace: "Presentation", key: "controls/device-input.browser.js" },
      { namespace: "Presentation", key: "cms-actor/cms-actor.browser.js" },
    ],
    "Controls must be declared BEFORE cms-actor (it defines the projected game-controls-input element)",
  );

  // Both declared scripts must resolve, through the pinned PWA hosting
  // convention (`resource.<namespace>`, renderer-host.ts), to real classic
  // artifacts — regular files that are NOT ES modules.
  const controlsArtifact = await readFile(
    new URL("loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js", repoRoot),
    "utf8",
  ).catch(() => null);
  if (controlsArtifact !== null) {
    assert.ok(controlsArtifact.length > 0, "the pinned common-controls browser artifact must be non-empty");
    assert.doesNotMatch(controlsArtifact, /(^|\n)\s*(import|export)\s*[({"'\s]/u, "the Controls artifact must be a classic script, not an ES module");
  }
  // When the framework build has not run yet, the artifact is allowed to be
  // absent locally — CI builds it before pwa:bundle and the bundle builder
  // fails closed when it is missing.

  const artifact = await readText(new URL("components/cms-actor/browser/cms-actor.browser.js", repoRoot));
  assert.ok(artifact.length > 0, "components/cms-actor/browser/cms-actor.browser.js must exist");
  assert.doesNotMatch(artifact, /(^|\n)\s*(import|export)\s*[({"'\s]/u, "the published entry must be a classic script, not an ES module");
  assert.match(artifact, /customElements\.define\("cms-actor"/u, "the published entry must register the cms-actor element");
});

test("the mirrored Web Presentation Config rules reject malformed documents", () => {
  // Calibrate the mirror above against representative invalid documents so a
  // future drift of the pinned validator surfaces as a failing assertion.
  const valid = JSON.stringify({
    formatVersion: 1,
    styles: [{ namespace: "Presentation", key: "page.css" }],
    scripts: [{ namespace: "Presentation", key: "ui/page.browser.js" }],
  });
  assert.deepEqual(
    validatePresentationStructural(valid, "calibration"),
    { formatVersion: 1, styles: [{ namespace: "Presentation", key: "page.css" }], scripts: [{ namespace: "Presentation", key: "ui/page.browser.js" }] },
  );

  const invalid = new Map([
    ["unsupported formatVersion", JSON.stringify({ formatVersion: 2, styles: [], scripts: [] })],
    ["unknown top-level key", JSON.stringify({ formatVersion: 1, styles: [], scripts: [], extra: 1 })],
    ["missing top-level key", JSON.stringify({ formatVersion: 1, styles: [] })],
    ["styles is not an array", JSON.stringify({ formatVersion: 1, styles: {}, scripts: [] })],
    ["ref with extra field", JSON.stringify({ formatVersion: 1, styles: [{ namespace: "P", key: "a.css", mime: "text/css" }], scripts: [] })],
    ["namespace with hierarchy", JSON.stringify({ formatVersion: 1, styles: [{ namespace: "P/x", key: "a.css" }], scripts: [] })],
    ["key with traversal segment", JSON.stringify({ formatVersion: 1, styles: [{ namespace: "P", key: "../a.css" }], scripts: [] })],
    ["absolute key", JSON.stringify({ formatVersion: 1, styles: [{ namespace: "P", key: "/a.css" }], scripts: [] })],
    ["scheme-like namespace", JSON.stringify({ formatVersion: 1, styles: [{ namespace: "https:", key: "a.css" }], scripts: [] })],
    ["duplicate resource", JSON.stringify({
      formatVersion: 1,
      styles: [
        { namespace: "Presentation", key: "a.css" },
        { namespace: "Presentation", key: "a.css" },
      ],
      scripts: [],
    })],
  ]);
  for (const [label, document] of invalid) {
    assert.throws(
      () => validatePresentationStructural(document, label),
      { name: "AssertionError" },
      `mirror must reject: ${label}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Optional deep validation through the real pinned LoomRealm APIs
// ---------------------------------------------------------------------------

async function tryImportLoomRealmPackage(packagePath) {
  try {
    return await import(new URL(packagePath, loomRealmRoot).href);
  } catch {
    // The submodule is either not built or its workspace dependencies are not
    // installed. The deterministic base layer above still fully applies.
    return null;
  }
}

// validateWebPresentationConfigV1 is an internal module of @loomrealm/renderer
// (not re-exported by the package index), so it is imported from its dist
// file, the same way the smoke suite imports the Hostra manifest parser.
const rendererConfig = await tryImportLoomRealmPackage("packages/renderer/dist/internal/web-presentation-config.js");

test("the built LoomRealm renderer validator accepts the root presentation manifest", {
  skip: !rendererConfig && "loom-realm packages are not built; run `npm install && npm run build:packages` inside loom-realm/ to enable deep validation",
}, async () => {
  const presentation = JSON.parse(await readText(new URL("presentation.json", repoRoot)));
  assert.deepEqual(
    rendererConfig.validateWebPresentationConfigV1(presentation),
    EXPECTED_PRESENTATION,
  );
  assert.throws(
    () => rendererConfig.validateWebPresentationConfigV1({ formatVersion: 1, styles: [], scripts: [] , extra: true }),
    TypeError,
  );
});

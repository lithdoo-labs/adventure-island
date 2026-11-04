import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(componentRoot, "..", "..");
const loomRealmRoot = path.join(repoRoot, "loom-realm");

async function importLoomRealmInternal(module) {
  const { pathToFileURL } = await import("node:url");
  return import(pathToFileURL(path.join(loomRealmRoot, "packages", "renderer", "dist", "internal", `${module}.js`)).href);
}

test("checked-in classic-script artifact is byte-identical to a fresh bundle", () => {
  const build = path.join(componentRoot, "scripts", "build.mjs");
  execFileSync(process.execPath, [build, "--check"], { cwd: componentRoot, stdio: "pipe" });
});

test("classic entry registers cms-actor and carries no module syntax", async () => {
  const source = await readFile(path.join(componentRoot, "browser", "cms-actor.browser.js"), "utf8");
  assert.match(source, /customElements\.define\("cms-actor"/);
  assert.doesNotMatch(source, /(^|\n)\s*(import|export)\s[{"'\s(]/);
  assert.match(source, /^\/\*! cms-actor browser entry \(classic script; no module loader\)\./);
});

test("presentation.json is a valid Web Presentation Config v1 declaration", async () => {
  const { validateWebPresentationConfigV1 } = await importLoomRealmInternal("web-presentation-config");
  const config = JSON.parse(await readFile(path.join(componentRoot, "presentation.json"), "utf8"));
  const validated = validateWebPresentationConfigV1(config);
  assert.equal(validated.formatVersion, 1);
  assert.deepEqual(validated.styles, []);
  assert.deepEqual(validated.scripts, [
    { namespace: "resource.Presentation", key: "cms-actor/cms-actor.browser.js" },
  ]);
});

test("prepareWebPresentationV1 resolves the script ref with frozen MIME essence and version", async () => {
  const { prepareWebPresentationV1 } = await importLoomRealmInternal("web-presentation-config");
  const { createHash } = await import("node:crypto");
  const config = JSON.parse(await readFile(path.join(componentRoot, "presentation.json"), "utf8"));
  const scriptBytes = await readFile(path.join(componentRoot, "browser", "cms-actor.browser.js"));
  const contentVersion = `sha256:${createHash("sha256").update(scriptBytes).digest("hex")}`;
  const prepared = await prepareWebPresentationV1(config, async (ref) => {
    assert.deepEqual(ref, { namespace: "resource.Presentation", key: "cms-actor/cms-actor.browser.js" });
    return { contentVersion, mime: "text/javascript; charset=utf-8", browserSource: "http://127.0.0.1:1/presentation/cms-actor/cms-actor.browser.js" };
  });
  assert.equal(prepared.styles.length, 0);
  assert.equal(prepared.scripts.length, 1);
  assert.equal(prepared.scripts[0].contentVersion, contentVersion);
  assert.equal(prepared.scripts[0].mime, "text/javascript; charset=utf-8");
});

test("prepareWebPresentationV1 rejects the script ref with a wrong MIME essence", async () => {
  const { prepareWebPresentationV1 } = await importLoomRealmInternal("web-presentation-config");
  const config = JSON.parse(await readFile(path.join(componentRoot, "presentation.json"), "utf8"));
  await assert.rejects(
    () => prepareWebPresentationV1(config, async () => ({
      contentVersion: `sha256:${"0".repeat(64)}`,
      mime: "application/javascript",
      browserSource: "http://127.0.0.1:1/x.js",
    })),
    /Invalid prepared bootstrap resource/,
  );
});

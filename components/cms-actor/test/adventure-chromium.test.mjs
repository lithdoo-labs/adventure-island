/**
 * Closed loop for the adventure paper-doll library: project both equipment
 * sets through the adapter, then paint them with the real cms-actor element.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAdventureAvatarPlan } from "../src/adventure-adapter.mjs";
import {
  actorView,
  componentRoot,
  launchChromium,
  openBootstrappedPage,
  preparePresentation,
  repoRoot,
  startContentServer,
  waitFor,
} from "./harness.mjs";

const libraryRoot = path.join(repoRoot, "content", "[FSDB]adventure");
const INSTALLATION_ID = "cms-actor-adventure";
const BEARER = "Bearer cms-actor-adventure";
const IDENTITY = {
  sessionId: "session-adventure",
  subsystemKey: "avatar",
  generation: 1,
  domainId: "field",
  targetKey: "player-1",
};

const BODY = "avatar.part.body.00002000";
const HEAD = "avatar.part.head.00012000";
const SET_A = [
  BODY, HEAD,
  "avatar.part.face.00020100", "avatar.part.hair.00030000",
  "avatar.equip.cap.01000000", "avatar.equip.coat.01040002", "avatar.equip.pants.01062001",
  "avatar.equip.shoes.01070000", "avatar.equip.glove.01082002", "avatar.equip.shield.01092003",
  "avatar.equip.weapon.01302000",
];
const SET_B = [
  BODY, HEAD,
  "avatar.part.face.00020401", "avatar.part.hair.00030027",
  "avatar.equip.cap.01000001", "avatar.equip.longcoat.01050002",
  "avatar.equip.shoes.01070000", "avatar.equip.glove.01082002",
  "avatar.equip.weapon.01422000",
];

function openLibrary() {
  const files = new Map();
  const read = async (namespace, key, extension) => {
    const kind = namespace.slice(0, namespace.indexOf("."));
    const name = namespace.slice(kind.length + 1);
    return readFile(path.join(libraryRoot, `[${kind}]${name}`, `${key}${extension}`));
  };
  return {
    files,
    async record(namespace, key) {
      return { value: JSON.parse((await read(namespace, key, ".json")).toString("utf8")), contentVersion: "record" };
    },
    async group(namespace, key) {
      const rows = (await read(namespace, key, ".jsonl")).toString("utf8").split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
      return { rows, contentVersion: "group" };
    },
    async resource(namespace, key) {
      const kind = namespace.slice(0, namespace.indexOf("."));
      const name = namespace.slice(kind.length + 1);
      const bytes = await readFile(path.join(libraryRoot, `[${kind}]${name}`, `${key}.png`));
      const contentVersion = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      files.set(`${namespace}\0${key}`, { bytes, mime: "image/png", contentVersion });
      return { bytes, mime: "image/png", contentVersion };
    },
  };
}

test("both adventure outfits paint from resource.Avatar atlases", { timeout: 90_000 }, async (t) => {
  const content = openLibrary();
  const sword = await buildAdventureAvatarPlan(content, { parts: SET_A, expression: "blink" });
  const hammer = await buildAdventureAvatarPlan(content, { parts: SET_B, expression: "blink" });
  const scriptBytes = await readFile(path.join(componentRoot, "browser", "cms-actor.browser.js"));
  const index = new Map(content.files);
  index.set("resource.Presentation\0cms-actor/cms-actor.browser.js", {
    bytes: scriptBytes,
    mime: "text/javascript",
    contentVersion: `sha256:${createHash("sha256").update(scriptBytes).digest("hex")}`,
  });

  const server = await startContentServer({
    index,
    scriptBytes,
    scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
    installationId: INSTALLATION_ID,
    bearer: BEARER,
  });
  t.after(() => server.close());
  const prepared = await preparePresentation({
    origin: server.origin,
    index,
    configPath: path.join(componentRoot, "presentation.json"),
    scriptPath: "/presentation/cms-actor/cms-actor.browser.js",
  });
  const chromium = await launchChromium();
  t.after(() => chromium.close());
  const page = await openBootstrappedPage(t, {
    chromium,
    origin: server.origin,
    prepared,
    installationId: INSTALLATION_ID,
    bearer: BEARER,
  });

  const view = (plan, locomotion) => actorView(IDENTITY, {
    plan,
    attrs: { locomotion, skin: "0", face: "00020100", hair: "00030000", expression: "blink" },
  });
  await page.evaluate((next) => window.__applyView(next), view(sword, "stand"));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "sword outfit ready");
  await waitFor(page, () => window.__actor()?.getAttribute("data-action") === "stand1", "sword outfit stands");
  const swordPixels = await page.evaluate(() => {
    const canvas = window.__canvas();
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] > 0) opaque += 1;
    return { opaque, cssWidth: Number.parseFloat(canvas.style.width), cssHeight: Number.parseFloat(canvas.style.height) };
  });
  assert.ok(swordPixels.opaque > 40, `sword outfit must paint pixels, saw ${swordPixels.opaque}`);
  assert.ok(swordPixels.cssWidth < 400 && swordPixels.cssHeight < 400, "atlas pages must be cropped to the sprite");
  const bodyKey = sword.actions.stand1.frames[0].layers[0].resource.key;
  const bodyFetches = await page.evaluate((key) => window.__resourceCalls.filter((call) => call.key === key).length, bodyKey);
  assert.equal(bodyFetches, 1, "one atlas page is fetched once");

  await page.evaluate((next) => window.__applyView(next), view(hammer, "walk"));
  await waitFor(page, () => window.__actor()?.getAttribute("data-action") === "walk2", "hammer outfit walks");
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "hammer outfit ready");
  const hammerPixels = await page.evaluate(() => {
    const canvas = window.__canvas();
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] > 0) opaque += 1;
    return opaque;
  });
  assert.ok(hammerPixels > 40, `hammer outfit must paint pixels, saw ${hammerPixels}`);
  assert.deepEqual(await page.evaluate(() => window.__pageErrors ?? []), []);
});

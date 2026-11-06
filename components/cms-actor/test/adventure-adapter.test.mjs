import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAdventureAvatarPlan } from "../src/adventure-adapter.mjs";
import { measureAvatarPlanDataBytes } from "../src/avatar-model.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const libraryRoot = path.join(repoRoot, "content", "[FSDB]adventure");

const BODY = "avatar.part.body.00002000";
const HEAD = "avatar.part.head.00012000";
const SET_A = [
  BODY,
  HEAD,
  "avatar.part.face.00020100",
  "avatar.part.hair.00030000",
  "avatar.equip.cap.01000000",
  "avatar.equip.coat.01040002",
  "avatar.equip.pants.01062001",
  "avatar.equip.shoes.01070000",
  "avatar.equip.glove.01082002",
  "avatar.equip.shield.01092003",
  "avatar.equip.weapon.01302000",
];
const SET_B = [
  BODY,
  HEAD,
  "avatar.part.face.00020401",
  "avatar.part.hair.00030027",
  "avatar.equip.cap.01000001",
  "avatar.equip.longcoat.01050002",
  "avatar.equip.shoes.01070000",
  "avatar.equip.glove.01082002",
  "avatar.equip.weapon.01422000",
];

function openLibrary() {
  const calls = [];
  const files = new Map();
  const read = async (namespace, key, extension) => {
    const kind = namespace.slice(0, namespace.indexOf("."));
    const name = namespace.slice(kind.length + 1);
    const file = path.join(libraryRoot, `[${kind}]${name}`, `${key}${extension}`);
    return readFile(file);
  };
  return {
    calls,
    files,
    async record(namespace, key) {
      const bytes = await read(namespace, key, ".json");
      return { value: JSON.parse(bytes.toString("utf8")), contentVersion: "record" };
    },
    async group(namespace, key) {
      const bytes = await read(namespace, key, ".jsonl");
      const rows = bytes.toString("utf8").split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
      return { rows, contentVersion: "group" };
    },
    async resource(namespace, key, ...extra) {
      calls.push({ namespace, key, extra: extra.length });
      const kind = namespace.slice(0, namespace.indexOf("."));
      const name = namespace.slice(kind.length + 1);
      const file = path.join(libraryRoot, `[${kind}]${name}`, `${key}.png`);
      const bytes = await readFile(file);
      const contentVersion = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      files.set(`${namespace}\0${key}`, { bytes, mime: "image/png", contentVersion });
      return { bytes, mime: "image/png", contentVersion };
    },
  };
}

function layerIds(plan, action, frame = 0) {
  return plan.actions[action].frames[frame].layers.map((layer) => layer.id);
}

function isSubsequence(order, full) {
  let cursor = 0;
  for (const name of order) {
    const found = full.indexOf(name, cursor);
    if (found < 0) return false;
    cursor = found + 1;
  }
  return true;
}

test("projects the one-hand set onto stand1/walk1 and crops the body atlas", async () => {
  const content = openLibrary();
  const plan = await buildAdventureAvatarPlan(content, { parts: SET_A, expression: "blink", action: "brandish1" });
  assert.equal(plan.bodyKey, BODY);
  assert.deepEqual(Object.keys(plan.actions).sort(), ["brandish1", "jump", "stand1", "walk1"]);
  assert.equal(plan.locomotionActions.stand, "stand1");
  assert.equal(plan.locomotionActions.walk, "walk1");
  assert.equal(plan.actions.stand1.loop, true);
  assert.equal(plan.actions.jump.loop, false);
  assert.ok(plan.zOrder.length <= 64);
  const order = JSON.parse(await readFile(path.join(libraryRoot, "[struct]avatar.DrawOrder", "avatar.json"), "utf8"));
  assert.equal(isSubsequence(plan.zOrder, order.frontToBack), true);

  const body = plan.actions.walk1.frames[0].layers[0];
  assert.equal(body.id, "body");
  assert.deepEqual(body.source, { x: 295, y: 198, w: 27, h: 32 });
  assert.deepEqual(body.origin, [19, 32]);
  assert.equal(body.resource.namespace, "resource.Avatar");
  assert.equal(body.resource.key, "part/body/00002000/0");
  assert.match(body.resource.contentVersion, /^sha256:[0-9a-f]{64}$/);
  const page = content.files.get("resource.Avatar\0part/body/00002000/0").bytes;
  assert.ok(page.readUInt32BE(16) > 27 && page.readUInt32BE(20) > 32);
  assert.equal(content.calls.filter((call) => call.key === "part/body/00002000/0").length, 1);
  assert.equal(content.calls.every((call) => call.extra === 0), true);

  const ids = layerIds(plan, "stand1");
  assert.equal(ids.includes("hair:hairOverHead"), false);
  assert.equal(ids.includes("hair:hair"), true);
  assert.equal(ids.some((id) => id.startsWith("coat")), true);
  assert.equal(ids.some((id) => id.startsWith("pants")), true);
  assert.equal(ids.some((id) => id.startsWith("shield")), true);
  assert.equal(plan.actions.stand1.frames[0].layers.some((layer) => layer.id === "face" || layer.z === "face"), false);
  assert.equal(plan.expression.name, "blink");
  assert.ok(plan.expression.frames.length > 1);
  assert.equal(plan.expression.frames[0].layers[0].id, "face");
  assert.ok(plan.expression.frames[0].delay > 0);
  assert.ok(measureAvatarPlanDataBytes(plan) <= 262_144);
});

test("projects the two-hand set onto stand2/walk2 and can carry swingO1 or eburster", async () => {
  const swing = await buildAdventureAvatarPlan(openLibrary(), { parts: SET_B, expression: "default", action: "swingO1" });
  assert.deepEqual(Object.keys(swing.actions).sort(), ["jump", "stand2", "swingO1", "walk2"]);
  const standIds = layerIds(swing, "stand2");
  assert.equal(standIds.some((id) => id.startsWith("longcoat")), true);
  assert.equal(standIds.some((id) => id.startsWith("coat") || id.startsWith("pants") || id.startsWith("shield")), false);

  const burst = await buildAdventureAvatarPlan(openLibrary(), { parts: SET_B, action: "eburster" });
  const burstFrame = burst.actions.eburster.frames[4];
  assert.equal(burstFrame.layers[0].id, "body");
  assert.equal(burstFrame.layers.some((layer) => layer.id === "006"), true);
  assert.equal(burstFrame.layers[0].z === "0", false);

  const triple = await buildAdventureAvatarPlan(openLibrary(), { parts: SET_A, action: "fullSwingTriple" });
  const tripleFrame = triple.actions.fullSwingTriple.frames[0];
  assert.equal(tripleFrame.rotate, 90);
  assert.deepEqual(tripleFrame.move, [-84, -85]);
  assert.ok(measureAvatarPlanDataBytes(swing) <= 262_144);
  assert.ok(measureAvatarPlanDataBytes(burst) <= 262_144);
  assert.ok(measureAvatarPlanDataBytes(triple) <= 262_144);
});

test("omits a missing action, rejects two stances, a skin mismatch, and defaults to stand1", async () => {
  const missing = await buildAdventureAvatarPlan(openLibrary(), { parts: SET_A, action: "not-a-real-pose" });
  assert.equal(missing.actions["not-a-real-pose"], undefined);
  assert.ok(missing.actions.stand1);

  const bare = await buildAdventureAvatarPlan(openLibrary(), {
    parts: [BODY, HEAD, "avatar.part.face.00020100", "avatar.part.hair.00030000", "avatar.equip.shoes.01070000"],
  });
  assert.ok(bare.actions.stand1);
  assert.ok(bare.actions.walk1);
  assert.equal(bare.locomotionActions.stand, "stand1");

  await assert.rejects(
    () => buildAdventureAvatarPlan(openLibrary(), {
      parts: [...SET_A, "avatar.equip.weapon.01422000"],
    }),
    /more than one part declares stance/,
  );
  await assert.rejects(
    () => buildAdventureAvatarPlan(openLibrary(), {
      parts: ["avatar.part.body.00002001", HEAD, "avatar.part.face.00020100"],
    }),
    /different skin suffixes/,
  );
});

test("a longcoat hides the coat and pants, and a hammer hides a shield worn with it", async () => {
  const robed = await buildAdventureAvatarPlan(openLibrary(), {
    parts: [
      ...SET_B,
      "avatar.equip.coat.01040002",
      "avatar.equip.pants.01062001",
    ],
  });
  const robeIds = layerIds(robed, "stand2");
  assert.equal(robeIds.some((id) => id.startsWith("longcoat")), true);
  assert.equal(robeIds.some((id) => id.startsWith("coat")), false);
  assert.equal(robeIds.some((id) => id.startsWith("pants")), false);

  const library = openLibrary();
  const hammer = await buildAdventureAvatarPlan({
    ...library,
    async group(namespace, key) {
      const result = await library.group(namespace, key);
      if (key !== "avatar.equip.shield.01092003") return result;
      const copies = result.rows
        .filter((row) => row.action === "stand1")
        .map((row) => ({ ...row, action: "stand2" }));
      return { ...result, rows: [...result.rows, ...copies] };
    },
  }, {
    parts: [
      BODY,
      HEAD,
      "avatar.part.face.00020100",
      "avatar.part.hair.00030000",
      "avatar.equip.shield.01092003",
      "avatar.equip.weapon.01422000",
    ],
  });
  const hammerIds = layerIds(hammer, "stand2");
  assert.equal(hammerIds.some((id) => id.startsWith("weapon")), true);
  assert.equal(hammerIds.some((id) => id.startsWith("shield")), false);
});

test("ladder frames keep showFace false and do not bake the face into the body", async () => {
  const plan = await buildAdventureAvatarPlan(openLibrary(), { parts: SET_A, action: "ladder", expression: "blink" });
  assert.equal(plan.actions.ladder.frames[0].showFace, false);
  assert.equal(plan.actions.ladder.frames[0].layers.some((layer) => layer.z === "face"), false);
  assert.equal(plan.expression.name, "blink");
});

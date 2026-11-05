/**
 * Production CMS079 AvatarPlan adapter against a fake ContentClient serving
 * REAL-converter-shaped records (numbered frames, frame references, resolved
 * UOLs, hairShade skin blocks). No Chromium, no real assets: this pins the
 * adapter's plan-building behavior for CI; the real-data acceptance lives in
 * components/cms-actor/test/real-assets.local.test.mjs.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { paintCanvas } from "../../../components/cms-actor/test/png.mjs";
import { validateAvatarPlan } from "../../../components/cms-actor/src/avatar-model.mjs";
import {
  buildCms079AvatarPlan,
  canvasesAt,
  collectAvatarResourceKeys,
  readCms079LookRecords,
  CMS079_LOOK_KEYS,
} from "../cms079-avatar-plan.mjs";

const ZMAP = ["weaponOverGlove", "hairOverHead", "face", "head", "hair", "arm", "body"];

function canvas(id, key, { width = 12, height = 12, z = "body", map = {} } = {}) {
  return { [id]: { resource: `Look/00002000/${key}`, width, height, origin: [6, 6], z, map } };
}

function recordsFixture() {
  const body = {
    info: {},
    stand1: {
      "0": { delay: 500, face: 1, ...canvas("body", "stand1/0/body"), ...canvas("arm", "stand1/0/arm", { z: "arm" }) },
      "1": { delay: 500, face: 1, ...canvas("body", "stand1/1/body") },
    },
    walk1: {
      "0": { delay: 180, face: 1, ...canvas("body", "walk1/0/body") },
      "1": { delay: 180, face: 1, ...canvas("body", "walk1/1/body") },
    },
    jump: { "0": { delay: 200, face: 1, ...canvas("body", "jump/0/body") } },
    brandish1: { "0": { action: "swingOF", frame: 1, delay: 120 } },
    swingOF: { "0": { ...canvas("body", "swingOF/0/body") }, "1": { ...canvas("body", "swingOF/1/body") } },
  };
  const head = {
    walk1: { "0": { ...canvas("head", "front/head", { z: "head", map: { neck: [-4, -10] } }) } },
    swingOF: { "1": { ...canvas("head", "swingOF/1/head", { z: "head" }) } },
  };
  const hair = {
    hairShade: { "0": { hairShade: { "0": { resource: "Look/00002000/hairShade/0/0", width: 8, height: 8, origin: [4, 4], z: "hair", map: {} } } } },
    walk1: { "0": { hairShade: { "0": { resource: "Look/00002000/hairShade/0/0", width: 8, height: 8, origin: [4, 4], z: "hair", map: {} } } } },
  };
  const face = { default: { ...canvas("face", "default/face", { z: "face" }) } };
  const weapon = {
    info: { walk: 1, stand: 1 },
    walk1: { "0": { ...canvas("weapon", "walk1/0/weapon", { z: "weaponOverGlove", map: { hand: [2, -8] } }) } },
    stand1: { "0": { ...canvas("weapon", "stand1/0/weapon", { z: "weaponOverGlove" }) } },
    jump: { "0": { ...canvas("weapon", "jump/0/weapon", { z: "weaponOverGlove" }) } },
    swingOF: { "1": { ...canvas("weapon", "swingOF/1/weapon", { z: "weaponOverGlove" }) } },
  };
  return { body, head, hair, face, weapon };
}

function fakeContentClient(records) {
  const images = new Map();
  for (const part of Object.keys(CMS079_LOOK_KEYS)) {
    const walk = (node) => {
      for (const value of Object.values(node ?? {})) {
        if (value && typeof value === "object") {
          if (typeof value.resource === "string" && Number.isInteger(value.width)) {
            if (!images.has(value.resource)) {
              const bytes = paintCanvas(value.width, value.height, () => [200, 40, 40, 255]);
              images.set(value.resource, bytes);
            }
          } else {
            walk(value);
          }
        }
      }
    };
    walk(records[part]);
  }
  const version = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const calls = [];
  return {
    calls,
    images,
    async record(namespace, key) {
      calls.push(["record", namespace, key]);
      if (namespace === "struct.Look") {
        const part = Object.entries(CMS079_LOOK_KEYS).find(([, lookKey]) => lookKey === key)?.[0];
        if (!part) throw Object.assign(new Error("not found"), { code: "CONTENT_NOT_FOUND" });
        return { value: records[part], contentVersion: version(Buffer.from(JSON.stringify(records[part]))) };
      }
      if (namespace === "struct.ZMap" && key === "order") {
        const value = Object.fromEntries(ZMAP.map((z) => [z, 0]));
        return { value, contentVersion: version(Buffer.from(JSON.stringify(value))) };
      }
      throw Object.assign(new Error("not found"), { code: "CONTENT_NOT_FOUND" });
    },
    async group() {
      throw Object.assign(new Error("not found"), { code: "CONTENT_NOT_FOUND" });
    },
    async resource(namespace, key) {
      calls.push(["resource", namespace, key]);
      const bytes = namespace === "resource.图" ? images.get(key) : undefined;
      if (!bytes) throw Object.assign(new Error("not found"), { code: "CONTENT_NOT_FOUND" });
      return { bytes, mime: "image/png", contentVersion: version(bytes) };
    },
  };
}

test("canvasesAt follows frame references and picks skin-0 of shade blocks", () => {
  const records = recordsFixture();
  assert.deepEqual(
    canvasesAt(records.body, "brandish1", 0).map(({ id }) => id),
    ["body"],
  );
  assert.equal(canvasesAt(records.body, "brandish1", 0)[0].canvas.resource, "Look/00002000/swingOF/1/body");
  const shade = canvasesAt(records.hair, "walk1", 0);
  assert.equal(shade[0].canvas.resource, "Look/00002000/hairShade/0/0");
  assert.deepEqual(canvasesAt(records.body, "missing", 0), []);
});

test("collectAvatarResourceKeys gathers exactly the canvases the plan draws", () => {
  const records = recordsFixture();
  const keys = collectAvatarResourceKeys(records);
  assert.ok(keys.has("Look/00002000/swingOF/1/body"), "brandish1 reference frame canvas");
  assert.ok(keys.has("Look/00002000/swingOF/1/head"), "head follows the canvas action");
  assert.ok(keys.has("Look/00002000/swingOF/1/weapon"), "weapon follows the canvas action");
  assert.ok(keys.has("Look/00002000/default/face"), "expression canvas");
  assert.ok(keys.has("Look/00002000/stand1/0/arm"));
  assert.ok(keys.has("Look/00002000/front/head"), "UOL-resolved head canvas via walk1");
  assert.ok(keys.has("Look/00002000/hairShade/0/0"), "skin-0 hairShade canvas");
  assert.ok(!keys.has("Look/00002000/swingOF/0/body"), "unused frame of a referenced action stays out");
  assert.deepEqual([...keys].sort(), [
    "Look/00002000/default/face",
    "Look/00002000/front/head",
    "Look/00002000/hairShade/0/0",
    "Look/00002000/jump/0/body",
    "Look/00002000/jump/0/weapon",
    "Look/00002000/stand1/0/arm",
    "Look/00002000/stand1/0/body",
    "Look/00002000/stand1/0/weapon",
    "Look/00002000/stand1/1/body",
    "Look/00002000/swingOF/1/body",
    "Look/00002000/swingOF/1/head",
    "Look/00002000/swingOF/1/weapon",
    "Look/00002000/walk1/0/body",
    "Look/00002000/walk1/0/weapon",
    "Look/00002000/walk1/1/body",
  ]);
});

test("collectAvatarResourceKeys fails closed on missing body actions", () => {
  const records = recordsFixture();
  assert.throws(() => collectAvatarResourceKeys(records, { actions: ["fly"] }), /body action missing: fly/);
});

test("buildCms079AvatarPlan reads records, verifies every PNG and builds a bounded plan", async () => {
  const records = recordsFixture();
  const content = fakeContentClient(records);
  const { looks, zmapOrder } = await readCms079LookRecords(content);
  assert.equal(zmapOrder.length, ZMAP.length);
  assert.equal(looks.body.walk1["0"].delay, 180);

  const plan = await buildCms079AvatarPlan(content);
  assert.deepEqual(Object.keys(plan.actions), ["stand1", "walk1", "jump", "brandish1"]);
  assert.deepEqual(plan.locomotionActions, { stand: "stand1", walk: "walk1", jump: "jump" });
  assert.ok(plan.zOrder.every((z) => ZMAP.includes(z)));
  const first = plan.actions.walk1.frames[0];
  assert.equal(first.layers[0].id, "body");
  const weapon = first.layers.at(-1);
  assert.deepEqual(weapon.anchors.hand, [2, -8]);

  const resourceCalls = content.calls.filter(([kind]) => kind === "resource");
  assert.ok(resourceCalls.length >= 13, "every plan canvas was read through resource()");
  for (const frame of plan.actions.walk1.frames) {
    for (const layer of frame.layers) {
      assert.match(layer.resource.contentVersion, /^sha256:[0-9a-f]{64}$/);
      const read = content.images.get(layer.resource.key);
      assert.equal(layer.resource.contentVersion, `sha256:${createHash("sha256").update(read).digest("hex")}`);
    }
  }
  assert.ok(validateAvatarPlan(plan) === plan);
});

test("buildCms079AvatarPlan rejects a wrong-MIME or tampered-version resource", async () => {
  const records = recordsFixture();
  const good = fakeContentClient(records);
  const plan = await buildCms079AvatarPlan(good);

  const badMime = fakeContentClient(records);
  const original = badMime.resource.bind(badMime);
  badMime.resource = async (namespace, key) => {
    const result = await original(namespace, key);
    return { ...result, mime: "image/webp" };
  };
  await assert.rejects(() => buildCms079AvatarPlan(badMime), /not image\/png/);

  const badVersion = fakeContentClient(records);
  const originalTwo = badVersion.resource.bind(badVersion);
  badVersion.resource = async (namespace, key) => {
    const result = await originalTwo(namespace, key);
    return { ...result, contentVersion: `sha256:${"0".repeat(64)}` };
  };
  await assert.rejects(() => buildCms079AvatarPlan(badVersion), /contentVersion/);
  assert.ok(plan.formatVersion === 1);
});

test("missing canvas resources fail closed instead of being skipped", async () => {
  const records = recordsFixture();
  const content = fakeContentClient(records);
  const someKey = [...content.images.keys()][0];
  content.images.delete(someKey);
  await assert.rejects(() => buildCms079AvatarPlan(content), (error) => error.code === "CONTENT_NOT_FOUND");
});

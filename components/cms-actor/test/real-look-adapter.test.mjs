import assert from "node:assert/strict";
import test from "node:test";
import { buildProductionAvatarPlan, zNamesFromRecord } from "../src/real-look-adapter.mjs";

function canvas(resource, z, origin, map, width = 4, height = 4) {
  return { resource, z, origin, map, width, height, format: 1 };
}

function versionsFor(keys) {
  const versions = new Map();
  let index = 0;
  for (const key of keys) {
    versions.set(key, `sha256:${index.toString(16).padStart(64, "0")}`);
    index += 1;
  }
  return versions;
}

const zOrder = [
  "handOverHair", "armOverHair", "hairOverHead", "hair", "face", "head",
  "arm", "weapon", "body",
];

test("brandish action links resolve onto swingOF canvases and keep ZMap order", () => {
  const body = {
    info: { islot: "Bd" },
    stand1: { 0: { body: canvas("Look/body/stand", "body", [16, 31], { neck: [-4, -32], navel: [-8, -21] }), arm: canvas("Look/body/arm", "arm", [5, 9], { navel: [-13, -1], hand: [-1, 5] }), face: 1, delay: 500 } },
    walk1: { 0: { body: canvas("Look/body/walk", "body", [19, 32], { neck: [-4, -32], navel: [-6, -20] }), face: 1, delay: 180 } },
    jump: { 0: { body: canvas("Look/body/jump", "body", [22, 30], { navel: [-5, -18] }), face: 0, delay: 200 } },
    brandish1: { 0: { action: "swingOF", frame: 0, delay: -120 } },
    swingOF: { 0: { body: canvas("Look/body/swing", "body", [20, 30], { navel: [-6, -18] }), arm: canvas("Look/body/swing-arm", "arm", [6, 8], { hand: [0, 4] }), face: 1, delay: 120 } },
  };
  const head = { stand1: { 0: { head: canvas("Look/head/stand", "head", [10, 10], { neck: [0, 0] }) } }, walk1: { 0: { head: canvas("Look/head/walk", "head", [10, 10], { neck: [0, 0] }) } }, swingOF: { 0: { head: canvas("Look/head/swing", "head", [10, 10], { neck: [0, 0], brow: [0, -8] }) } }, jump: { 0: { head: canvas("Look/head/jump", "head", [10, 10], { neck: [0, 0] }) } } };
  const face = { default: { 0: { face: canvas("Look/face/default", "face", [8, 8], { brow: [0, 0] }) } } };
  const hair = { stand1: { 0: { hair: canvas("Look/hair/stand", "hair", [12, 12], { brow: [1, 1] }) } }, walk1: { 0: { hair: canvas("Look/hair/walk", "hair", [12, 12], { brow: [1, 1] }) } }, swingOF: { 0: { hair: canvas("Look/hair/swing", "hair", [12, 12], { brow: [1, 1] }) } }, jump: { 0: { hair: canvas("Look/hair/jump", "hair", [12, 12], { brow: [1, 1] }) } } };
  const weapon = {
    info: { stand: 1, walk: 1 },
    stand1: { 0: { weapon: canvas("Look/weapon/stand", "weapon", [4, 12], { hand: [0, 0] }) } },
    walk1: { 0: { weapon: canvas("Look/weapon/walk", "weapon", [4, 12], { hand: [0, 0] }) } },
    swingOF: { 0: { weapon: canvas("Look/weapon/swing", "weapon", [4, 12], { hand: [0, 0] }) } },
  };
  const keys = [];
  for (const look of [body, head, face, hair, weapon]) {
    for (const action of Object.values(look)) {
      if (!action || typeof action !== "object") continue;
      for (const frame of Object.values(action)) {
        if (!frame || typeof frame !== "object") continue;
        for (const value of Object.values(frame)) {
          if (value && typeof value.resource === "string") keys.push(value.resource);
        }
      }
    }
  }
  const plan = buildProductionAvatarPlan({
    body, head, face, hair, weapon, zOrder, versions: versionsFor(keys),
  });
  assert.deepEqual(Object.keys(plan.actions).sort(), ["brandish1", "jump", "stand1", "walk1"]);
  assert.equal(plan.actions.brandish1.loop, false);
  assert.equal(plan.actions.stand1.loop, true);
  assert.equal(plan.actions.brandish1.frames[0].delay, -120);
  assert.equal(plan.actions.brandish1.frames[0].layers[0].resource.key, "Look/body/swing");
  assert.equal(plan.actions.jump.frames[0].layers.some((layer) => layer.id === "face"), false);
  assert.equal(plan.actions.stand1.frames[0].layers.some((layer) => layer.id === "face"), true);
  const used = new Set();
  for (const action of Object.values(plan.actions)) {
    for (const frame of action.frames) for (const layer of frame.layers) used.add(layer.z);
  }
  assert.deepEqual(plan.zOrder, zOrder.filter((name) => used.has(name)));
  assert.ok(plan.zOrder.indexOf("hair") < plan.zOrder.indexOf("body"));
  assert.deepEqual(zNamesFromRecord({ cap: null, body: null }), ["cap", "body"]);
});

test("an unframed face default canvas is frame 0", () => {
  const body = {
    stand1: { 0: { body: canvas("Look/body/stand", "body", [16, 31], { navel: [0, 0] }), face: 1, delay: 500 } },
    walk1: { 0: { body: canvas("Look/body/walk", "body", [16, 31], { navel: [0, 0] }), face: 1, delay: 180 } },
    jump: { 0: { body: canvas("Look/body/jump", "body", [16, 31], { navel: [0, 0] }), face: 0, delay: 200 } },
    brandish1: { 0: { action: "swingOF", frame: 0, delay: 120 } },
    swingOF: { 0: { body: canvas("Look/body/swing", "body", [16, 31], { navel: [0, 0] }), face: 1, delay: 120 } },
  };
  const face = { default: { face: canvas("Look/face/default", "face", [8, 8], { brow: [0, 0] }) } };
  const plan = buildProductionAvatarPlan({
    body,
    head: {},
    face,
    hair: {},
    weapon: { info: { stand: 1, walk: 1 } },
    zOrder,
    versions: versionsFor(["Look/body/stand", "Look/body/walk", "Look/body/jump", "Look/body/swing", "Look/face/default"]),
  });
  const standFace = plan.actions.stand1.frames[0].layers.find((layer) => layer.id === "face");
  assert.equal(standFace.resource.key, "Look/face/default");
  assert.equal(plan.actions.jump.frames[0].layers.some((layer) => layer.id === "face"), false);
});

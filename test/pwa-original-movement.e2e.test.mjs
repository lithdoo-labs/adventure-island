import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const requireFromFramework = createRequire(new URL("../loom-realm/apps/pwa/package.json", import.meta.url));
const { chromium } = requireFromFramework("playwright");

function poseScript() {
  const player = document.querySelector("ms-world-item");
  const avatar = document.querySelector("ms-avatar");
  return {
    x: Number(player?.getAttribute("world-x")),
    y: Number(player?.getAttribute("world-y")),
    action: avatar?.getAttribute("action") ?? null,
  };
}

test("original land movement: prone, drop-through, held jump, and air steering", { timeout: 120_000 }, async () => {
  const url = process.env.LOOMREALM_PWA_URL;
  assert.ok(url?.endsWith("/pwa/adventure-island/"), "staging URL is required");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const state = document.documentElement.dataset.loomrealmProduct;
      return state === "ready" || state === "failed";
    }, null, { timeout: 45_000 });
    const product = await page.evaluate(() => document.documentElement.dataset.loomrealmProduct);
    assert.equal(product, "ready");
    await page.waitForFunction(() => {
      const avatar = document.querySelector("ms-avatar");
      const player = document.querySelector("ms-world-item");
      return avatar?.getAttribute("action") === "stand1"
        && Number(player?.getAttribute("world-y")) === 243;
    }, null, { timeout: 20_000 });

    const scrollBefore = await page.evaluate(() => [...document.querySelectorAll("ms-map-back")].map((host) => ({
      rate: host._data?.layout?.scroll?.pixelsPerMs ?? host._validated?.layout?.scroll?.pixelsPerMs ?? 0,
      offset: host._scrollOffsetX ?? 0,
    })));
    assert.ok(scrollBefore.some((row) => Math.abs(row.rate) >= 0.02), "a village cloud must use the 100px scroll period");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    const scrollAfter = await page.evaluate(() => [...document.querySelectorAll("ms-map-back")].map((host) => host._scrollOffsetX ?? 0));
    const cloudTravel = Math.max(...scrollBefore.map((row, index) => Math.abs(scrollAfter[index] - row.offset)));
    assert.ok(cloudTravel >= 4, `type 4 clouds moved ${cloudTravel}px in 500ms`);

    const origin = await page.evaluate(poseScript);
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(() => document.querySelector("ms-avatar")?.getAttribute("action") === "prone", null, { timeout: 5_000 });
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
    const crouched = await page.evaluate(poseScript);
    assert.equal(crouched.action, "prone");
    assert.ok(Math.abs(crouched.x - origin.x) < 1, `prone drifted in x to ${crouched.x}`);
    assert.equal(crouched.y, 243);
    await page.keyboard.up("ArrowDown");
    await page.waitForFunction(() => document.querySelector("ms-avatar")?.getAttribute("action") === "stand1", null, { timeout: 5_000 });

    await page.keyboard.down("ArrowLeft");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 80)));
    await page.keyboard.down("KeyZ");
    await page.waitForFunction(() => Number(document.querySelector("ms-world-item")?.getAttribute("world-y")) < 230, null, { timeout: 5_000 });
    const airborne = await page.evaluate(poseScript);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowRight");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 80)));
    const steered = await page.evaluate(poseScript);
    assert.ok(steered.y < 243, "the opposite key was sampled while still airborne");
    assert.ok(steered.x < airborne.x, `air steering reversed x from ${airborne.x} to ${steered.x}`);
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("KeyZ");
    await page.waitForFunction(() => {
      const avatar = document.querySelector("ms-avatar");
      const player = document.querySelector("ms-world-item");
      return avatar?.getAttribute("action") === "stand1"
        && Number(player?.getAttribute("world-y")) === 243;
    }, null, { timeout: 5_000 });
    await page.waitForFunction(() => {
      const x = Number(document.querySelector("ms-world-item")?.getAttribute("world-x"));
      return new Promise((resolve) => {
        setTimeout(() => {
          const next = Number(document.querySelector("ms-world-item")?.getAttribute("world-x"));
          resolve(Math.abs(next - x) < 0.2);
        }, 120);
      });
    }, null, { timeout: 5_000 });

    const beforeHop = await page.evaluate(poseScript);
    await page.keyboard.down("KeyZ");
    const hop = await page.evaluate(async () => {
      const read = () => Number(document.querySelector("ms-world-item")?.getAttribute("world-y"));
      const ground = read();
      let left = false;
      let landed = false;
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const y = read();
        if (!left && y < ground - 8) left = true;
        else if (left && !landed && y >= ground - 1) landed = true;
        else if (landed && y < ground - 8) return { hoppedAgain: true, y, ground };
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return { hoppedAgain: false, y: read(), ground, left, landed };
    });
    assert.equal(hop.hoppedAgain, true, `held jump did not hop again ${JSON.stringify(hop)}`);
    await page.keyboard.up("KeyZ");
    await page.waitForFunction(() => {
      const avatar = document.querySelector("ms-avatar");
      return avatar?.getAttribute("action") === "stand1"
        && Number(document.querySelector("ms-world-item")?.getAttribute("world-y")) === 243;
    }, null, { timeout: 5_000 });

    await page.keyboard.down("ArrowDown");
    await page.keyboard.down("KeyZ");
    await page.waitForFunction(() => Number(document.querySelector("ms-world-item")?.getAttribute("world-y")) === 333, null, { timeout: 5_000 });
    const dropped = await page.evaluate(poseScript);
    assert.equal(dropped.y, 333);
    assert.ok(dropped.y > beforeHop.y, "drop-through moved onto the lower foothold");
    await page.keyboard.up("KeyZ");
    await page.keyboard.up("ArrowDown");
  } finally {
    await browser.close();
  }
});

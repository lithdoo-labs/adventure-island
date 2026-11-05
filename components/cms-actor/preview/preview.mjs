// The classic entry ../browser/cms-actor.browser.js is loaded by index.html
// and registers the `cms-actor` element; this harness only drives it.
const stage = document.querySelector("#stage");
const status = document.querySelector("#status");
const assets = new Map();

function drawFixture(canvas, kind, phase = 0) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  if (kind === "body") {
    context.fillStyle = "#5a9c6b";
    context.fillRect(6, 9, 12, 15);
    context.fillStyle = "#38634c";
    context.fillRect(7, 23, 5, 8 + (phase % 2));
    context.fillRect(13, 23, 5, 8 + ((phase + 1) % 2));
    context.fillStyle = "#e4c19b";
    context.fillRect(3 + (phase % 2), 11, 4, 12);
    context.fillRect(17 - (phase % 2), 11, 4, 12);
  } else if (kind === "head") {
    context.fillStyle = "#e7bf96";
    context.fillRect(4, 2, 16, 18);
    context.fillRect(7, 0, 10, 22);
  } else if (kind === "face") {
    context.fillStyle = "#292633";
    context.fillRect(2, 3, 2, 2);
    context.fillRect(8, 3, 2, 2);
    context.fillStyle = "#9b4d53";
    context.fillRect(4, 7, 4, 1);
  } else if (kind === "hair") {
    context.fillStyle = "#553a2e";
    context.fillRect(2, 1, 20, 7);
    context.fillRect(1, 4, 5, 12);
    context.fillRect(17, 4, 6, 10);
    context.fillStyle = "#76503b";
    context.fillRect(7, 2, 8, 3);
  } else if (kind === "cap") {
    context.fillStyle = "#c54e58";
    context.fillRect(3, 2, 18, 7);
    context.fillRect(1, 8, 22, 3);
    context.fillStyle = "#f2d78a";
    context.fillRect(10, 3, 4, 4);
  } else if (kind === "weapon") {
    context.fillStyle = "#c8d7e7";
    context.fillRect(7, 0, 4, 19);
    context.fillStyle = "#8c9bb1";
    context.fillRect(4, 3, 10, 3);
    context.fillStyle = "#9d6944";
    context.fillRect(8, 19, 3, 7);
    context.fillStyle = "#e6bd74";
    context.fillRect(5, 24, 9, 3);
  }
}

async function toPngBytes(canvas) {
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Unable to create synthetic PNG")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function registerAsset(key, kind, width, height, phase = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  drawFixture(canvas, kind, phase);
  const bytes = await toPngBytes(canvas);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const version = `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  assets.set(key, { bytes, mime: "image/png", contentVersion: version });
  return { namespace: "fixture", key, contentVersion: version };
}

const zOrder = ["cap", "hair", "weaponOverGlove", "face", "head", "body"];
const definitions = {
  body: { z: "body", width: 24, height: 32, origin: [12, 32], anchors: { neck: [-4, -32], navel: [-6, -20], hand: [5, -18] } },
  head: { z: "head", width: 24, height: 24, origin: [12, 12], anchors: { neck: [-4, -10], brow: [0, -7] } },
  face: { z: "face", width: 12, height: 10, origin: [6, 5], anchors: { brow: [0, -5] } },
  hair: { z: "hair", width: 24, height: 18, origin: [12, 9], anchors: { brow: [0, -8] } },
  cap: { z: "cap", width: 24, height: 12, origin: [12, 7], anchors: { brow: [0, -10] } },
  weapon: { z: "weaponOverGlove", width: 16, height: 28, origin: [8, 22], anchors: { hand: [-3, -17] } },
};

async function buildFrame(actionName, index, delay, options = {}) {
  const layerKinds = ["body", "head", "face", "hair", "weapon", "cap"];
  const layers = [];
  for (const kind of layerKinds) {
    const definition = definitions[kind];
    const key = `synthetic/${kind}/${actionName}/${index}`;
    const resource = await registerAsset(key, kind, definition.width, definition.height, index);
    layers.push({ id: kind, z: definition.z, resource, width: definition.width, height: definition.height, origin: definition.origin, anchors: definition.anchors });
  }
  return { delay, move: options.move ?? [0, 0], flip: options.flip ?? false, layers };
}

async function main() {
  const actions = {};
  actions.stand1 = { loop: true, frames: [await buildFrame("stand1", 0, 500), await buildFrame("stand1", 1, 500)] };
  actions.walk1 = { loop: true, frames: [] };
  for (let index = 0; index < 4; index += 1) actions.walk1.frames.push(await buildFrame("walk1", index, 180, { move: [index % 2, 0] }));
  actions.jump = { loop: false, frames: [await buildFrame("jump", 0, 200, { move: [0, -5] })] };
  actions.brandish1 = { loop: false, frames: [
    await buildFrame("brandish1", 0, 120, { flip: false }),
    await buildFrame("brandish1", 1, 120, { flip: true }),
    await buildFrame("brandish1", 2, 180, { flip: false }),
  ] };
  const plan = { formatVersion: 1, zOrder, locomotionActions: { stand: "stand1", walk: "walk1", jump: "jump" }, actions };
  const resourceClient = {
    async resource(namespace, key, expectedContentVersion, { signal } = {}) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const asset = assets.get(key);
      if (!asset || namespace !== "fixture") throw new Error(`Synthetic resource not found: ${namespace}/${key}`);
      if (asset.contentVersion !== expectedContentVersion) throw new Error(`Synthetic content version mismatch: ${key}`);
      return { bytes: asset.bytes, mime: asset.mime, contentVersion: asset.contentVersion };
    },
  };

  const actor = document.createElement("cms-actor");
  actor.setAttribute("x", "320");
  actor.setAttribute("y", "256");
  actor.setAttribute("locomotion", "stand");
  actor.setAttribute("facing", "right");
  actor.setAttribute("skin", "0");
  actor.receiveRenderData({ avatarPlan: plan });
  actor.receiveRenderContext({ resources: resourceClient, emitCustomEvent() {} });
  stage.append(actor);

  document.querySelectorAll("[data-locomotion]").forEach((button) => button.addEventListener("click", () => actor.setAttribute("locomotion", button.dataset.locomotion)));
  document.querySelector("#left").addEventListener("click", () => actor.setAttribute("facing", "left"));
  document.querySelector("#right").addEventListener("click", () => actor.setAttribute("facing", "right"));
  document.querySelector("#action").addEventListener("click", () => actor.receiveRenderEvent({ name: "action", data: { action: "brandish1" } }));
  document.querySelector("#move-left").addEventListener("click", () => actor.setAttribute("x", String(Number(actor.getAttribute("x")) - 12)));
  document.querySelector("#move-right").addEventListener("click", () => actor.setAttribute("x", String(Number(actor.getAttribute("x")) + 12)));

  const observer = new MutationObserver(() => {
    status.textContent = `动作：${actor.getAttribute("data-action") ?? "加载中"} · 帧：${actor.getAttribute("data-frame") ?? "-"} · 状态：${actor.getAttribute("data-render-state") ?? "loading"}${actor.getAttribute("data-render-error") ? ` · ${actor.getAttribute("data-render-error")}` : ""}`;
  });
  observer.observe(actor, { attributes: true, attributeFilter: ["data-action", "data-frame", "data-render-state", "data-render-error"] });
  status.textContent = "合成素材已准备，正在加载人物。";
}

main().catch((error) => {
  status.textContent = `预览初始化失败：${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
});

/**
 * Shared Chromium closed-loop harness for cms-actor tests.
 *
 * Serves a Content-HTTP-v1-shaped endpoint over an in-memory index, serves
 * the loom-realm renderer dist internals plus the classic component script,
 * launches real Chromium through playwright (resolved from the loom-realm
 * submodule), and drives the formal `bootstrapWebPresentation()` path with a
 * real `WebProjector`.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

export const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(componentRoot, "..", "..");
export const loomRoot = path.join(repoRoot, "loom-realm");
export const rendererDistInternal = path.join(loomRoot, "packages", "renderer", "dist", "internal");

export function importRendererInternal(module) {
  const file = path.join(rendererDistInternal, `${module}.js`);
  if (!existsSync(file)) {
    assert.fail(`loom-realm renderer dist is missing ${module}.js — run: npm install && npm run build -w @loomrealm/renderer (inside loom-realm/)`);
  }
  return import(pathToFileURL(file).href);
}

export function executablePath() {
  return [
    process.env.LOOMREALM_CHROMIUM_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean).find(existsSync);
}

export async function launchChromium() {
  const require = createRequire(path.join(loomRoot, "package.json"));
  const playwrightUrl = pathToFileURL(require.resolve("playwright")).href;
  const playwrightModule = await import(playwrightUrl);
  const chromiumApi = playwrightModule.chromium ?? playwrightModule.default?.chromium;
  if (!chromiumApi) assert.fail("playwright could not be resolved from loom-realm/node_modules");
  const executable = executablePath();
  return chromiumApi.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
}

/**
 * @param {object} options
 * @param {Map<string, {bytes: Buffer, mime: string, contentVersion: string}>} options.index
 *   `${namespace}\0${key}` -> resource entry
 * @param {Buffer} options.scriptBytes classic script artifact bytes
 * @param {string} options.scriptPath URL path the script is served at
 * @param {string} options.installationId
 * @param {string} options.bearer full Authorization header value
 */
export function startContentServer({ index, scriptBytes, scriptPath, installationId, bearer }) {
  const state = {
    delays: new Map(), // `${ns}/${key}` -> ms
    active: 0,
    requestLog: [],
  };
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/") {
        response.setHeader("content-type", "text/html");
        response.end("<!doctype html><html><head></head><body style=\"margin:0\"></body></html>");
        return;
      }
      if (url.pathname.startsWith("/packages/renderer/dist/internal/") && url.pathname.endsWith(".js")) {
        const leaf = path.basename(url.pathname);
        try {
          response.setHeader("content-type", "text/javascript");
          response.end(await readFile(path.join(rendererDistInternal, leaf)));
        } catch {
          response.statusCode = 404;
          response.end();
        }
        return;
      }
      if (url.pathname === scriptPath) {
        response.setHeader("content-type", "text/javascript");
        response.end(scriptBytes);
        return;
      }
      const resourcePrefix = `/_lr/v1/games/${installationId}/resources/`;
      if (url.pathname.startsWith(resourcePrefix)) {
        if (request.headers.authorization !== bearer) { response.statusCode = 401; response.end(); return; }
        const segments = url.pathname.slice(resourcePrefix.length).split("/").map((part) => decodeURIComponent(part));
        const namespace = segments.shift();
        const key = segments.join("/");
        const entry = index.get(`${namespace}\0${key}`);
        state.requestLog.push(`${namespace}/${key}`);
        state.active += 1;
        response.on("close", () => { state.active -= 1; });
        if (!entry) { response.statusCode = 404; response.end(); return; }
        const delay = state.delays.get(`${namespace}/${key}`) ?? 0;
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        response.setHeader("content-type", entry.mime);
        response.setHeader("x-loom-content-version", entry.contentVersion);
        response.setHeader("etag", `"${entry.contentVersion}"`);
        response.end(entry.bytes);
        return;
      }
      response.statusCode = 404;
      response.end();
    } catch (cause) {
      response.statusCode = 500;
      response.end(String(cause));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        state,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

export async function preparePresentation({ origin, index, configPath, scriptPath }) {
  const { prepareWebPresentationV1 } = await importRendererInternal("web-presentation-config");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  return prepareWebPresentationV1(config, async (ref) => {
    const entry = index.get(`${ref.namespace}\0${ref.key}`);
    if (!entry) throw new Error(`missing presentation artifact ${ref.namespace}/${ref.key}`);
    return { contentVersion: entry.contentVersion, mime: entry.mime, browserSource: `${origin}${scriptPath}` };
  });
}

export async function openBootstrappedPage(t, { chromium, origin, prepared, installationId, bearer, deviceScaleFactor = 1 }) {
  const page = await chromium.newPage({ viewport: { width: 480, height: 360 }, deviceScaleFactor });
  // Surface unhandled page errors to tests (e.g. promise rejections that
  // must never escape the component's error handling).
  page.__pageErrors = [];
  page.on("pageerror", (error) => page.__pageErrors.push(String(error?.message ?? error)));
  if (process.env.CMS_ACTOR_DEBUG) {
    page.on("console", (message) => console.log(`[page ${message.type()}]`, message.text().slice(0, 400)));
    page.on("response", (response) => { if (response.status() >= 400) console.log(`[page http ${response.status()}]`, response.url().slice(-100)); });
  }
  t.after(() => page.close().catch(() => {}));
  await page.goto(origin);
  await page.evaluate(async ({ origin: pageOrigin, prepared: pagePrepared, installationId: id, bearer: header, debug }) => {
    const { bootstrapWebPresentation } = await import(`${pageOrigin}/packages/renderer/dist/internal/web-presentation-bootstrap.js`);
    const { createRendererResourceClient } = await import(`${pageOrigin}/packages/renderer/dist/internal/resource-client.js`);
    const { WebProjector } = await import(`${pageOrigin}/packages/renderer/dist/internal/web-projector.js`);
    const lifetime = new AbortController();
    // The server option carries the full Authorization header; the renderer
    // client wants the bare token.
    const token = String(header).replace(/^Bearer\s+/, "");
    const inner = createRendererResourceClient({ origin: pageOrigin, installationId: id, token }, lifetime.signal);
    window.__resourceCalls = [];
    window.__presentationFailures = [];
    const resourceClient = {
      async resource(namespace, key, expectedContentVersion, signal) {
        const record = { namespace, key, expectedContentVersion, aborted: false };
        window.__resourceCalls.push(record);
        signal?.addEventListener("abort", () => { record.aborted = true; }, { once: true });
        return inner.resource(namespace, key, expectedContentVersion, signal).catch((error) => {
          if (debug) console.log("underlying fail", key, error?.name, error?.code, String(error?.message ?? error));
          throw error;
        });
      },
    };
    await bootstrapWebPresentation(window, pagePrepared, () => {
      const projector = new WebProjector({
        document,
        resourceClient,
        reportFailure: (cause) => window.__presentationFailures.push(String(cause)),
      });
      window.__applyView = (view) => projector.reevaluate({ read: () => view });
      window.__emitEvent = (event) => projector.deliverRenderEvent(event);
      window.__actor = () => document.querySelector("cms-actor");
      window.__canvas = () => document.querySelector("cms-actor")?.shadowRoot?.querySelector("canvas");
      window.__sample = (sx, sy) => {
        const canvas = window.__canvas();
        if (!canvas) return null;
        const dpr = window.devicePixelRatio || 1;
        const left = Number.parseFloat(canvas.style.left) || 0;
        const top = Number.parseFloat(canvas.style.top) || 0;
        const x = Math.round((sx - left) * dpr);
        const y = Math.round((sy - top) * dpr);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
        const pixel = canvas.getContext("2d").getImageData(x, y, 1, 1).data;
        return [pixel[0], pixel[1], pixel[2]];
      };
      window.__pixel = (sx, sy) => {
        const canvas = window.__canvas();
        if (!canvas) return null;
        const dpr = window.devicePixelRatio || 1;
        const left = Number.parseFloat(canvas.style.left) || 0;
        const top = Number.parseFloat(canvas.style.top) || 0;
        const x = Math.round((sx - left) * dpr);
        const y = Math.round((sy - top) * dpr);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
        const pixel = canvas.getContext("2d").getImageData(x, y, 1, 1).data;
        return [pixel[0], pixel[1], pixel[2], pixel[3]];
      };
      window.__opaqueCount = (x, y, w, h) => {
        const canvas = window.__canvas();
        if (!canvas) return null;
        const dpr = window.devicePixelRatio || 1;
        const left = Number.parseFloat(canvas.style.left) || 0;
        const top = Number.parseFloat(canvas.style.top) || 0;
        const sx = Math.round((x - left) * dpr);
        const sy = Math.round((y - top) * dpr);
        const x0 = Math.max(0, sx);
        const y0 = Math.max(0, sy);
        const x1 = Math.min(canvas.width, Math.round(sx + w * dpr));
        const y1 = Math.min(canvas.height, Math.round(sy + h * dpr));
        if (x1 <= x0 || y1 <= y0) return null;
        const data = canvas.getContext("2d").getImageData(x0, y0, x1 - x0, y1 - y0).data;
        let opaque = 0;
        for (let index = 3; index < data.length; index += 4) if (data[index] > 0) opaque += 1;
        return opaque;
      };
      window.__snapshot = () => {
        const canvas = window.__canvas();
        if (!canvas) return null;
        const dpr = window.devicePixelRatio || 1;
        const left = Number.parseFloat(canvas.style.left) || 0;
        const top = Number.parseFloat(canvas.style.top) || 0;
        const context = canvas.getContext("2d");
        const data = context.getImageData(0, 0, canvas.width, canvas.height);
        let hash = 0;
        for (let index = 0; index < data.data.length; index += 4) {
          hash = (Math.imul(31, hash) + data.data[index] + data.data[index + 3]) | 0;
        }
        return { left, top, dpr, width: canvas.width, height: canvas.height, cssWidth: canvas.width / dpr, cssHeight: canvas.height / dpr, hash };
      };
      window.__teardown = () => { projector.teardown(); lifetime.abort(); };
    });
  }, { origin, prepared, installationId, bearer, debug: Boolean(process.env.CMS_ACTOR_DEBUG) });
  return page;
}

export async function waitFor(page, predicate, label, timeout = 8_000, arg) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await page.evaluate(predicate, arg);
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Timed out waiting for ${label}; last observation: ${JSON.stringify(last)}`);
}

export const waitPixel = (page, point, color, label, timeout = 8_000) =>
  waitFor(page, ({ x, y, expected }) => {
    const actual = window.__sample(x, y);
    return actual !== null && actual.every((channel, index) => channel === expected[index]);
  }, label, timeout, { x: point[0], y: point[1], expected: color.slice(0, 3) });

export const waitFrame = (page, frame, label, timeout = 8_000) =>
  waitFor(page, (expected) => window.__actor()?.getAttribute("data-frame") === expected, label, timeout, String(frame));

export const waitAction = (page, action, label, timeout = 8_000) =>
  waitFor(page, (expected) => window.__actor()?.getAttribute("data-action") === expected, label, timeout, action);

export function actorView({ sessionId, subsystemKey, generation, domainId, targetKey }, { attrs = {}, plan, withActor = true } = {}) {
  return {
    sessionId,
    subsystems: [{
      subsystemKey,
      generation,
      eligible: true,
      domains: [{
        domainId,
        zIndex: 0,
        roots: withActor ? [{
          key: targetKey,
          tag: "cms-actor",
          attrs: {
            x: "0",
            y: "0",
            locomotion: "stand",
            facing: "right",
            skin: "0",
            face: "00020000",
            hair: "00030000",
            expression: "default",
            equips: "",
            ...attrs,
          },
          data: { avatarPlan: plan },
          children: [],
        }] : [],
      }],
    }],
  };
}

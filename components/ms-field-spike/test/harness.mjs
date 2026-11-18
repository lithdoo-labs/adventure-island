import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { paintCanvas } from "../../cms-actor/test/png.mjs";
import { launchChromium, preparePresentation, rendererDistInternal, waitFor } from "../../cms-actor/test/harness.mjs";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererDist = path.resolve(rendererDistInternal, "..");
export const SCRIPT_PATH = "/presentation/ms-field-spike/ms-field-spike.browser.js";
export const INSTALLATION_ID = "ms-field-spike";
export const BEARER = "Bearer spike-token";

export function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function solidPng(width, height, color) {
  return paintCanvas(width, height, () => color);
}

export async function startSpikeServer({ index, scriptBytes }) {
  const state = { delays: new Map(), requestLog: [] };
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/") {
        response.setHeader("content-type", "text/html");
        response.end("<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#ff00ff}</style></head><body></body></html>");
        return;
      }
      if (url.pathname.startsWith("/packages/renderer/dist/") && url.pathname.endsWith(".js")) {
        const relative = decodeURIComponent(url.pathname.slice("/packages/renderer/dist/".length));
        const file = path.resolve(rendererDist, relative);
        const fromRoot = path.relative(rendererDist, file);
        if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot) || !existsSync(file)) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader("content-type", "text/javascript");
        response.end(await readFile(file));
        return;
      }
      if (url.pathname === "/spike/store-bridge.mjs") {
        response.setHeader("content-type", "text/javascript");
        response.end(await readFile(path.join(componentRoot, "src", "store-bridge.mjs")));
        return;
      }
      if (url.pathname === SCRIPT_PATH) {
        response.setHeader("content-type", "text/javascript");
        response.end(scriptBytes);
        return;
      }
      const resourcePrefix = `/_lr/v1/games/${INSTALLATION_ID}/resources/`;
      if (url.pathname.startsWith(resourcePrefix)) {
        if (request.headers.authorization !== BEARER) {
          response.statusCode = 401;
          response.end();
          return;
        }
        const segments = url.pathname.slice(resourcePrefix.length).split("/").map((part) => decodeURIComponent(part));
        const namespace = segments.shift();
        const key = segments.join("/");
        const entry = index.get(`${namespace}\0${key}`);
        state.requestLog.push(`${namespace}/${key}`);
        if (!entry) {
          response.statusCode = 404;
          response.end();
          return;
        }
        const delay = state.delays.get(`${namespace}/${key}`) ?? 0;
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        if (response.destroyed) return;
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

export async function openSpikePage(t, { chromium, origin, prepared }) {
  const page = await chromium.newPage({ viewport: { width: 96, height: 96 }, deviceScaleFactor: 1 });
  page.__pageErrors = [];
  page.on("pageerror", (error) => page.__pageErrors.push(String(error?.message ?? error)));
  t.after(() => page.close().catch(() => {}));
  await page.goto(origin);
  await page.evaluate(async ({ origin: pageOrigin, prepared: pagePrepared, installationId, bearer }) => {
    const { bootstrapWebPresentation } = await import(`${pageOrigin}/packages/renderer/dist/internal/web-presentation-bootstrap.js`);
    const { createRendererResourceClient } = await import(`${pageOrigin}/packages/renderer/dist/internal/resource-client.js`);
    const { WebProjector } = await import(`${pageOrigin}/packages/renderer/dist/internal/web-projector.js`);
    const { RendererRenderStore } = await import(`${pageOrigin}/packages/renderer/dist/internal/render-store.js`);
    const { createSpikeProjection } = await import(`${pageOrigin}/spike/store-bridge.mjs`);
    const lifetime = new AbortController();
    const token = String(bearer).replace(/^Bearer\s+/, "");
    const inner = createRendererResourceClient({ origin: pageOrigin, installationId, token }, lifetime.signal);
    window.__resourceCalls = [];
    window.__presentationFailures = [];
    const resourceClient = {
      async resource(namespace, key, expectedContentVersion, signal) {
        const record = { namespace, key, expectedContentVersion, aborted: false };
        window.__resourceCalls.push(record);
        signal?.addEventListener("abort", () => { record.aborted = true; }, { once: true });
        return inner.resource(namespace, key, expectedContentVersion, signal);
      },
    };
    await bootstrapWebPresentation(window, pagePrepared, () => {
      const projector = new WebProjector({
        document,
        resourceClient,
        reportFailure: (cause) => window.__presentationFailures.push(String(cause?.message ?? cause)),
      });
      const projection = createSpikeProjection({
        store: new RendererRenderStore(1),
        projector,
        sessionId: "session-spike",
        subsystemKey: "field",
        domainId: "field",
      });
      window.__open = (roots) => projection.open(roots);
      window.__replace = (roots) => projection.replace(roots);
      window.__update = (ops) => projection.update(ops);
      window.__revision = () => projection.revision;
      window.__teardown = () => {
        projector.teardown();
        lifetime.abort();
      };
    });
  }, { origin, prepared, installationId: INSTALLATION_ID, bearer: BEARER });
  assert.deepEqual(page.__pageErrors, []);
  return page;
}

export { assert, launchChromium, preparePresentation, waitFor };

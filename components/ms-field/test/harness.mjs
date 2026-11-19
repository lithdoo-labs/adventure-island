import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium, preparePresentation, rendererDistInternal, waitFor } from "../../cms-actor/test/harness.mjs";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererDist = path.resolve(rendererDistInternal, "..");
export const SCRIPT_PATH = "/presentation/ms-field/ms-field.browser.js";
export const INSTALLATION_ID = "ms-field";
export const BEARER = "Bearer field-token";

export { launchChromium, preparePresentation, waitFor };

/** Full canonical 222000000 static scene: 297 map paint units + avatar slot. */
export const CANONICAL_VISUAL_HOST_COUNT = 298;

/**
 * Wait until every visual host is ready and the resource client has drained.
 * Does not require the full FieldPlan closure to be fetched — only first-frame reads.
 */
export async function waitForFullCanonicalFieldReady(page, {
  hostCount = CANONICAL_VISUAL_HOST_COUNT,
  timeout = 240_000,
} = {}) {
  await waitFor(page, (expectedHosts) => {
    const scene = document.querySelector("ms-scene-view");
    if (scene?.diagnostics().state !== "ready") return false;
    const hosts = [
      ...document.querySelectorAll("ms-map-back, ms-map-batch, ms-map-object, ms-portal-visual, ms-m3-avatar-slot"),
    ];
    if (hosts.length !== expectedHosts) return false;
    if (!hosts.every((host) => host.diagnostics().state === "ready")) return false;
    return (window.__resourceActive ?? 0) === 0;
  }, "full field scene ready", timeout, hostCount);
}

export async function startFieldServer({ index, scriptBytes, resourceDelayMs = new Map() }) {
  const metrics = {
    totalContentReads: 0,
    maxConcurrentContentReads: 0,
    activeContentReads: 0,
    statusCounts: new Map(),
  };
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
      if (url.pathname === "/field/store-bridge.mjs") {
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
        const identity = `${namespace}\0${key}`;
        const entry = index.get(identity);
        metrics.totalContentReads += 1;
        metrics.activeContentReads += 1;
        metrics.maxConcurrentContentReads = Math.max(metrics.maxConcurrentContentReads, metrics.activeContentReads);
        const finish = () => {
          metrics.activeContentReads -= 1;
        };
        try {
          if (!entry) {
            metrics.statusCounts.set(404, (metrics.statusCounts.get(404) ?? 0) + 1);
            response.statusCode = 404;
            response.end();
            return;
          }
          const delay = resourceDelayMs.get(identity) ?? 0;
          if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
          metrics.statusCounts.set(200, (metrics.statusCounts.get(200) ?? 0) + 1);
          response.setHeader("content-type", entry.mime);
          response.setHeader("x-loom-content-version", entry.contentVersion);
          response.setHeader("etag", `"${entry.contentVersion}"`);
          response.end(entry.bytes);
        } finally {
          finish();
        }
        return;
      }
      response.statusCode = 404;
      response.end();
    } catch {
      response.statusCode = 500;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    metrics,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

export async function openFieldPage(t, { chromium, origin, prepared, installationId, bearer, viewport = { width: 96, height: 96 } }) {
  const page = await chromium.newPage({ viewport, deviceScaleFactor: 1 });
  page.__pageErrors = [];
  page.on("pageerror", (error) => page.__pageErrors.push(String(error?.message ?? error)));
  t.after(() => page.close().catch(() => {}));
  await page.goto(origin);
  await page.evaluate(async ({ origin: pageOrigin, prepared: pagePrepared, installationId: pageInstallationId, bearer: pageBearer }) => {
    const { bootstrapWebPresentation } = await import(`${pageOrigin}/packages/renderer/dist/internal/web-presentation-bootstrap.js`);
    const { createRendererResourceClient } = await import(`${pageOrigin}/packages/renderer/dist/internal/resource-client.js`);
    const { WebProjector } = await import(`${pageOrigin}/packages/renderer/dist/internal/web-projector.js`);
    const { RendererRenderStore } = await import(`${pageOrigin}/packages/renderer/dist/internal/render-store.js`);
    const { createSpikeProjection } = await import(`${pageOrigin}/field/store-bridge.mjs`);
    const lifetime = new AbortController();
    const token = String(pageBearer).replace(/^Bearer\s+/, "");
    const inner = createRendererResourceClient({ origin: pageOrigin, installationId: pageInstallationId, token }, lifetime.signal);
    window.__resourceCalls = [];
    window.__resourceActive = 0;
    window.__resourceMaxActive = 0;
    window.__presentationFailures = [];
    const resourceClient = {
      async resource(namespace, key, expectedContentVersion, signal) {
        const record = { namespace, key, expectedContentVersion, aborted: false };
        window.__resourceCalls.push(record);
        window.__resourceActive += 1;
        window.__resourceMaxActive = Math.max(window.__resourceMaxActive, window.__resourceActive);
        signal?.addEventListener("abort", () => { record.aborted = true; }, { once: true });
        try {
          return await inner.resource(namespace, key, expectedContentVersion, signal);
        } finally {
          window.__resourceActive -= 1;
        }
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
        sessionId: "session-field",
        subsystemKey: "field",
        domainId: "field",
      });
      window.__open = (roots) => projection.open(Array.isArray(roots) ? roots : [roots]);
      window.__replace = (roots) => projection.replace(Array.isArray(roots) ? roots : [roots]);
      window.__update = (ops) => projection.update(ops);
      window.__teardown = () => {
        projector.teardown();
        lifetime.abort();
      };
    });
  }, { origin, prepared, installationId, bearer });
  assert.deepEqual(page.__pageErrors, []);
  return page;
}
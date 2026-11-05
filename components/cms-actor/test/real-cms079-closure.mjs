/**
 * Real CMS079 closure: ContentClient against the desktop content service,
 * a production AvatarPlan, then Chromium through bootstrapWebPresentation,
 * WebProjector and PresentationResourceClient.
 *
 * The desktop content service does not send CORS headers, so the page is
 * served on a loopback origin that proxies resource GETs to that service
 * unchanged. Versions and bodies are the service's.
 *
 * Usage:
 *   node components/cms-actor/test/real-cms079-closure.mjs --fsdb <[FSDB]cms> --out <report.json>
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProductionAvatarPlan, zNamesFromRecord } from "../src/real-look-adapter.mjs";
import { actorView, launchChromium, waitAction, waitFor } from "./harness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const loomRoot = path.join(repoRoot, "loom-realm");
const componentRoot = path.resolve(here, "..");
const LOOKS = [
  ["00002000", "Bd", "body"],
  ["00012000", "Hd", "head"],
  ["00020000", "Fc", "face"],
  ["00030000", "Hr", "hair"],
  ["01302000", "Wp", "weapon"],
];
const SESSION = {
  sessionId: "session-cms079",
  subsystemKey: "avatar",
  generation: 1,
  domainId: "field",
  targetKey: "player-1",
};

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function importDist(relative) {
  return import(pathToFileURL(path.join(loomRoot, relative)).href);
}

async function ensureInstallation(root) {
  await mkdir(path.join(root, "subsystems"), { recursive: true });
  const game = path.join(root, "game.json");
  const manifest = path.join(root, "launch.hostra.json");
  const module = path.join(root, "subsystems", "world.mjs");
  await writeFile(game, `${JSON.stringify({
    formatVersion: 1,
    subsystems: [{ key: "world" }],
    initial: { subsystem: "world", input: null },
  }, null, 2)}\n`);
  await writeFile(manifest, `${JSON.stringify({
    formatVersion: 1,
    subsystems: [{ key: "world", module: "subsystems/world.mjs" }],
  }, null, 2)}\n`);
  await writeFile(module, "export default () => ({ frame() {} });\n");
}

function proxyResource(request, response, targetOrigin) {
  const target = new URL(request.url, targetOrigin);
  const headers = {};
  if (request.headers.authorization) headers.authorization = request.headers.authorization;
  const proxied = http.request(target, { method: "GET", headers }, (upstream) => {
    response.statusCode = upstream.statusCode ?? 502;
    for (const name of ["content-type", "x-loom-content-version", "etag", "content-length"]) {
      const value = upstream.headers[name];
      if (value !== undefined) response.setHeader(name, value);
    }
    upstream.pipe(response);
  });
  proxied.once("error", (error) => {
    response.statusCode = 502;
    response.end(String(error));
  });
  proxied.end();
}

function startPageServer({ scriptBytes, targetOrigin, installationId }) {
  const rendererDist = path.join(loomRoot, "packages", "renderer", "dist", "internal");
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (url.pathname === "/") {
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end("<!doctype html><html><head></head><body style=\"margin:0\"></body></html>");
        return;
      }
      if (url.pathname.startsWith("/packages/renderer/dist/internal/") && url.pathname.endsWith(".js")) {
        response.setHeader("content-type", "text/javascript");
        response.end(await readFile(path.join(rendererDist, path.basename(url.pathname))));
        return;
      }
      if (url.pathname === "/presentation/cms-actor/cms-actor.browser.js") {
        response.setHeader("content-type", "text/javascript");
        response.end(scriptBytes);
        return;
      }
      const prefix = `/_lr/v1/games/${encodeURIComponent(installationId)}/`;
      if (url.pathname.startsWith(prefix)) {
        proxyResource(request, response, targetOrigin);
        return;
      }
      response.statusCode = 404;
      response.end();
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

async function main() {
  const fsdb = path.resolve(arg("--fsdb", "E:\\cms079-pr1-work\\fsdb-all\\[FSDB]cms"));
  const out = path.resolve(arg("--out", "E:\\cms079-pr1-work\\reports\\content-avatar.json"));
  const installationRoot = path.dirname(fsdb);
  await ensureInstallation(installationRoot);
  const { prepareHostraGame } = await importDist("packages/game-launcher-hostra/dist/index.js");
  const { createDesktopContentService, prepareDesktopContentView } = await importDist("apps/desktop/dist/index.js");
  const { createBoundContentClient } = await importDist("packages/subsystem/dist/host/index.js");
  const { ContentReadError } = await importDist("packages/subsystem/dist/content.js");
  const { createRendererResourceClient, RendererResourceError } = await importDist("packages/renderer/dist/internal/resource-client.js");
  const { prepareWebPresentationV1 } = await importDist("packages/renderer/dist/internal/web-presentation-config.js");

  console.log("prepare installation", installationRoot);
  const preparedGame = await prepareHostraGame({
    source: { installationRoot },
    runnerPolicy: { helloDeadlineMs: 5_000, frameDeadlineMs: 5_000, terminalCleanupDeadlineMs: 1_000, terminationGraceMs: 100 },
  });
  console.log("index content view");
  const view = await prepareDesktopContentView(preparedGame);
  const service = await createDesktopContentService({ view });
  const grant = service.createGrant({
    permissions: ["manifest", "records", "groups", "resources"],
    expiresAtUnixMs: Date.now() + 30 * 60_000,
  });
  const access = service.access(grant);
  const lifetime = new AbortController();
  const content = createBoundContentClient(access, lifetime.signal);
  const evidence = { looks: {}, resources: {}, closed: {} };

  try {
    const zmap = await content.record("struct.ZMap", "order");
    const zOrder = zNamesFromRecord(zmap.value);
    assert.equal(zOrder.length, 149);
    assert.ok(zOrder.includes("body") && zOrder.includes("weapon"));
    evidence.zMap = { contentVersion: zmap.contentVersion, count: zOrder.length, first: zOrder[0], last: zOrder.at(-1) };

    const looks = {};
    for (const [key, islot, role] of LOOKS) {
      const record = await content.record("struct.Look", key);
      assert.equal(record.value.info.islot, islot);
      assert.match(record.contentVersion, /^sha256:[0-9a-f]{64}$/);
      looks[role] = record.value;
      evidence.looks[key] = { role, contentVersion: record.contentVersion, islot };
    }

    const tiles = await content.group("group.Tile", "100000000");
    assert.ok(tiles.rows.length > 0);
    assert.match(tiles.contentVersion, /^sha256:[0-9a-f]{64}$/);
    evidence.group = { namespace: "group.Tile", key: "100000000", rows: tiles.rows.length, contentVersion: tiles.contentVersion };

    const sound = await content.resource("resource.音", "Sound/Bgm00/FloralLife");
    assert.equal(sound.mime, "audio/mpeg");
    assert.equal(sound.bytes.byteLength, 1_376_392);
    assert.equal(sha256(sound.bytes), sound.contentVersion);
    assert.equal(sound.contentVersion, "sha256:c19f549e33dfba0b470e21e26fa018b87e161a5ef2caa37c78c1f0bdb17a5c3e");
    evidence.resources.sound = { key: "Sound/Bgm00/FloralLife", mime: sound.mime, bytes: sound.bytes.byteLength, contentVersion: sound.contentVersion };

    const versions = new Map();
    let plan;
    for (;;) {
      try {
        plan = buildProductionAvatarPlan({ ...looks, zOrder, versions });
        break;
      } catch (error) {
        const match = /^CMS079 AvatarPlan: missing contentVersion for (\S+)$/.exec(error.message);
        if (!match) throw error;
        const key = match[1];
        const resource = await content.resource("resource.图", key);
        assert.equal(resource.mime, "image/png");
        assert.equal(sha256(resource.bytes), resource.contentVersion);
        assert.equal(resource.bytes[0], 0x89);
        versions.set(key, resource.contentVersion);
      }
    }
    const bodyLayer = plan.actions.stand1.frames[0].layers[0];
    assert.equal(bodyLayer.id, "body");
    assert.equal(bodyLayer.resource.key, "Look/00002000/stand1/0/body");
    for (const name of ["stand1", "walk1", "jump", "brandish1"]) assert.ok(plan.actions[name], name);
    assert.equal(plan.actions.brandish1.loop, false);
    assert.equal(plan.actions.stand1.loop, true);
    evidence.plan = {
      actions: Object.fromEntries(Object.entries(plan.actions).map(([name, action]) => [name, action.frames.length])),
      zOrder: plan.zOrder,
      resources: versions.size,
      body: bodyLayer.resource,
    };

    await assert.rejects(() => content.record("struct.Look", "missing-look"), (error) => error instanceof ContentReadError && error.code === "CONTENT_NOT_FOUND");
    const denied = service.createGrant({ permissions: ["records"], expiresAtUnixMs: Date.now() + 60_000 });
    const deniedClient = createBoundContentClient(service.access(denied), lifetime.signal);
    await assert.rejects(() => deniedClient.resource("resource.图", bodyLayer.resource.key), (error) => error instanceof ContentReadError && error.code === "CONTENT_UNAVAILABLE");
    const renderer = createRendererResourceClient({
      origin: access.origin,
      installationId: access.installationId,
      token: access.token,
    }, lifetime.signal);
    await assert.rejects(
      () => renderer.resource("resource.图", bodyLayer.resource.key, `sha256:${"0".repeat(64)}`),
      (error) => error instanceof RendererResourceError && error.code === "conflict",
    );
    await assert.rejects(
      () => renderer.resource("resource.图", "missing/resource", bodyLayer.resource.contentVersion),
      (error) => error instanceof RendererResourceError && error.code === "not-found",
    );
    evidence.closed = { missingRecord: "CONTENT_NOT_FOUND", deniedResource: "CONTENT_UNAVAILABLE", wrongVersion: "conflict", missingResource: "not-found" };

    const scriptBytes = await readFile(path.join(componentRoot, "browser", "cms-actor.browser.js"));
    const scriptVersion = sha256(scriptBytes);
    const pageServer = await startPageServer({ scriptBytes, targetOrigin: access.origin, installationId: access.installationId });
    const presentation = await prepareWebPresentationV1(JSON.parse(await readFile(path.join(componentRoot, "presentation.json"), "utf8")), async () => ({
      contentVersion: scriptVersion,
      mime: "text/javascript",
      browserSource: `${pageServer.origin}/presentation/cms-actor/cms-actor.browser.js`,
    }));
    const chromium = await launchChromium();
    const page = await chromium.newPage({ viewport: { width: 480, height: 360 }, deviceScaleFactor: 1 });
    page.on("pageerror", (error) => console.log("pageerror", error));
    try {
      await page.goto(pageServer.origin);
      await page.evaluate(async ({ origin, prepared, installationId, token }) => {
        const { bootstrapWebPresentation } = await import(`${origin}/packages/renderer/dist/internal/web-presentation-bootstrap.js`);
        const { createRendererResourceClient } = await import(`${origin}/packages/renderer/dist/internal/resource-client.js`);
        const { WebProjector } = await import(`${origin}/packages/renderer/dist/internal/web-projector.js`);
        const lifetime = new AbortController();
        const inner = createRendererResourceClient({ origin, installationId, token }, lifetime.signal);
        window.__resourceCalls = [];
        window.__presentationFailures = [];
        const resourceClient = {
          async resource(namespace, key, expectedContentVersion, signal) {
            window.__resourceCalls.push({ namespace, key, expectedContentVersion });
            return inner.resource(namespace, key, expectedContentVersion, signal);
          },
        };
        await bootstrapWebPresentation(window, prepared, () => {
          const projector = new WebProjector({
            document,
            resourceClient,
            reportFailure: (cause) => window.__presentationFailures.push(String(cause)),
          });
          window.__applyView = (view) => projector.reevaluate({ read: () => view });
          window.__emitEvent = (event) => projector.deliverRenderEvent(event);
          window.__actor = () => document.querySelector("cms-actor");
          window.__canvas = () => document.querySelector("cms-actor")?.shadowRoot?.querySelector("canvas");
          window.__opaque = () => {
            const canvas = window.__canvas();
            if (!canvas || canvas.width === 0 || canvas.height === 0) return 0;
            const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
            let opaque = 0;
            for (let index = 3; index < data.length; index += 4) if (data[index] > 0) opaque += 1;
            return opaque;
          };
          window.__hash = () => {
            const canvas = window.__canvas();
            if (!canvas || canvas.width === 0) return 0;
            const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
            let hash = 0;
            for (let index = 0; index < data.length; index += 16) hash = (Math.imul(31, hash) + data[index] + data[index + 3]) | 0;
            return hash;
          };
        });
      }, {
        origin: pageServer.origin,
        prepared: presentation,
        installationId: access.installationId,
        token: access.token,
      });
      const view = actorView(SESSION, { plan });
      await page.evaluate((next) => window.__applyView(next), view);
      await waitAction(page, "stand1", "real stand1");
      const stand = await waitFor(page, () => window.__opaque() > 0, "stand pixels");
      assert.equal(stand, true);
      const rightHash = await page.evaluate(() => window.__hash());
      await page.evaluate((next) => window.__applyView(next), actorView(SESSION, { plan, attrs: { facing: "left" } }));
      await waitAction(page, "stand1", "mirrored stand");
      const leftHash = await waitFor(page, (previous) => {
        const hash = window.__hash();
        return hash !== 0 && hash !== previous ? hash : 0;
      }, "mirror changes the bitmap", 8_000, rightHash);
      await page.evaluate((next) => window.__applyView(next), actorView(SESSION, { plan, attrs: { locomotion: "walk", facing: "right" } }));
      await waitAction(page, "walk1", "real walk1");
      await page.evaluate((next) => window.__applyView(next), actorView(SESSION, { plan, attrs: { locomotion: "jump" } }));
      await waitAction(page, "jump", "real jump");
      await page.evaluate((next) => {
        window.__applyView(next);
        window.__emitEvent({
          sessionId: "session-cms079",
          subsystemKey: "avatar",
          generation: 1,
          domainId: "field",
          targetKey: "player-1",
          name: "action",
          data: { action: "brandish1" },
        });
      }, actorView(SESSION, { plan, attrs: { locomotion: "stand" } }));
      await waitAction(page, "brandish1", "real brandish1");
      const calls = await page.evaluate(() => window.__resourceCalls);
      const failures = await page.evaluate(() => window.__presentationFailures);
      assert.equal(failures.length, 0, failures.join("\n"));
      const bodyCall = calls.find((call) => call.key === bodyLayer.resource.key);
      assert.ok(bodyCall, "body resource was requested");
      assert.equal(bodyCall.namespace, "resource.图");
      assert.equal(bodyCall.expectedContentVersion, bodyLayer.resource.contentVersion);
      evidence.chromium = {
        standOpaque: true,
        actions: ["stand1", "walk1", "jump", "brandish1"],
        mirrorHash: { right: rightHash, left: leftHash },
        resourceCalls: calls.length,
        failures: failures.length,
      };
    } finally {
      await page.close().catch(() => {});
      await chromium.close().catch(() => {});
      await pageServer.close();
    }
  } finally {
    lifetime.abort();
    await service.close();
    await view.close();
  }

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log("CONTENT_AVATAR_OK", out);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { launchChromium } from "../../cms-actor/test/harness.mjs";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = Object.freeze({
  "/layout.mjs": path.join(componentRoot, "src", "layout.mjs"),
  "/element.mjs": path.join(componentRoot, "src", "element.mjs"),
});

function startServer() {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/") {
      response.setHeader("content-type", "text/html");
      response.end(`<!doctype html><html><head>
        <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111}</style>
        </head><body>
        <ms-viewport-frame>
          <div id="scene" style="position:absolute;inset:0;background:#2a6"></div>
        </ms-viewport-frame>
        <script type="module" src="/element.mjs"></script>
      </body></html>`);
      return;
    }
    const file = sources[url.pathname];
    if (!file) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("content-type", "text/javascript");
    response.end(await readFile(file));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function nearly(actual, expected, tolerance = 1) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

let chromium;

before(async () => {
  chromium = await launchChromium();
});

after(async () => {
  await chromium?.close().catch(() => {});
});

test("ms-viewport-frame fills the screen, scales, and emits a resolution only when it changes", { timeout: 60_000 }, async () => {
  const server = await startServer();
  const context = await chromium.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  try {
    await page.goto(server.origin);
    await page.waitForFunction(() => customElements.get("ms-viewport-frame") !== undefined);
    await page.waitForFunction(() => document.querySelector("ms-viewport-frame")?.diagnostics().state === "ready");

    const initial = await page.evaluate(() => {
      const host = document.querySelector("ms-viewport-frame");
      const stage = host.shadowRoot.querySelector(".stage");
      const rect = stage.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const scene = document.getElementById("scene").getBoundingClientRect();
      return {
        diagnostics: host.diagnostics(),
        host: { width: hostRect.width, height: hostRect.height },
        stage: { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
        scene: { width: scene.width, height: scene.height, x: scene.x, y: scene.y },
        sceneParentIsSlot: document.getElementById("scene").assignedSlot !== null,
      };
    });
    assert.equal(initial.diagnostics.mode, "uniform");
    assert.equal(initial.diagnostics.width, 960);
    assert.equal(initial.diagnostics.height, 720);
    assert.equal(initial.diagnostics.scaleX, initial.diagnostics.scaleY);
    nearly(initial.host.width, 800);
    nearly(initial.host.height, 600);
    nearly(initial.stage.width, 800);
    nearly(initial.stage.height, 600);
    nearly(initial.stage.x, 0);
    nearly(initial.stage.y, 0);
    nearly(initial.scene.width, 800);
    nearly(initial.scene.height, 600);
    nearly(initial.scene.x, 0);
    nearly(initial.scene.y, 0);
    assert.equal(initial.sceneParentIsSlot, true);

    await page.evaluate(() => {
      const host = document.querySelector("ms-viewport-frame");
      window.__viewportEvents = [];
      host.receiveRenderContext({
        emitCustomEvent(name, data, options) {
          window.__viewportEvents.push({ name, data, options });
        },
      });
    });
    const firstEvent = await page.evaluate(() => window.__viewportEvents);
    assert.deepEqual(firstEvent, [{
      name: "viewport.resolution",
      data: { width: 960, height: 720 },
      options: { broadcast: false, channel: "viewport.resolution" },
    }]);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => document.querySelector("ms-viewport-frame").diagnostics().width === 1280);
    const hd = await page.evaluate(() => {
      const host = document.querySelector("ms-viewport-frame");
      const rect = host.shadowRoot.querySelector(".stage").getBoundingClientRect();
      return { diagnostics: host.diagnostics(), stage: { width: rect.width, height: rect.height }, events: window.__viewportEvents };
    });
    assert.equal(hd.diagnostics.mode, "uniform");
    assert.equal(hd.diagnostics.height, 720);
    assert.equal(hd.diagnostics.scaleX, 1.5);
    nearly(hd.stage.width, 1920);
    nearly(hd.stage.height, 1080);
    assert.equal(hd.events.length, 2);
    assert.deepEqual(hd.events[1].data, { width: 1280, height: 720 });

    await page.setViewportSize({ width: 400, height: 900 });
    await page.waitForFunction(() => document.querySelector("ms-viewport-frame").diagnostics().mode === "cover");
    const cover = await page.evaluate(() => {
      const host = document.querySelector("ms-viewport-frame");
      const rect = host.shadowRoot.querySelector(".stage").getBoundingClientRect();
      return { diagnostics: host.diagnostics(), stage: { width: rect.width, height: rect.height }, events: window.__viewportEvents };
    });
    assert.equal(cover.diagnostics.width, 1280);
    assert.equal(cover.diagnostics.height, 480);
    assert.notEqual(cover.diagnostics.scaleX, cover.diagnostics.scaleY);
    nearly(cover.stage.width, 400);
    nearly(cover.stage.height, 900);
    assert.deepEqual(cover.events.at(-1).data, { width: 1280, height: 480 });
    const eventCount = cover.events.length;

    await page.setViewportSize({ width: 220, height: 1100 });
    await page.waitForFunction(() => {
      const host = document.querySelector("ms-viewport-frame");
      return host.diagnostics().screenWidth === host.clientWidth && host.clientWidth === 220;
    });
    const repeated = await page.evaluate(() => {
      const host = document.querySelector("ms-viewport-frame");
      return { diagnostics: host.diagnostics(), events: window.__viewportEvents.length };
    });
    assert.equal(repeated.diagnostics.width, 1280);
    assert.equal(repeated.diagnostics.height, 480);
    assert.equal(repeated.events, eventCount);

    await page.evaluate(() => document.querySelector("ms-viewport-frame").setAttribute("max-width", "10"));
    await page.waitForFunction(() => document.querySelector("ms-viewport-frame").diagnostics().state === "invalid");
    const invalid = await page.evaluate(() => {
      const host = document.querySelector("ms-viewport-frame");
      const stage = host.shadowRoot.querySelector(".stage");
      return { state: host.diagnostics().state, hidden: stage.hidden, events: window.__viewportEvents.length };
    });
    assert.equal(invalid.state, "invalid");
    assert.equal(invalid.hidden, true);
    assert.equal(invalid.events, eventCount);

    await page.evaluate(() => {
      const host = document.querySelector("ms-viewport-frame");
      let failed = false;
      try {
        host.receiveRenderContext(null);
      } catch (error) {
        failed = error instanceof TypeError;
      }
      return failed;
    }).then((failed) => assert.equal(failed, true));
  } finally {
    await context.close();
    await server.close();
  }
});

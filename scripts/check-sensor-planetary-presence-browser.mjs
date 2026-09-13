import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

// Keep the old CLI's executable/output arguments; use only an owned mock server.
const [, executablePath = "C:/Program Files/Google/Chrome/Application/chrome.exe", outputArgument] = process.argv.slice(2);
const output = path.resolve(outputArgument || "artifacts/sensor-planetary-presence");
fs.mkdirSync(output, { recursive: true });
const port = 4498;
const baseUrl = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["scripts/serve-sensor-platform-qa.mjs", String(port)], {
  windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
let browser;
const report = { status: "running", fixture: "Isolated mock API; not live observations", checks: [], errors: [] };

async function assertNoPresence(page) {
  assert.equal(await page.locator(".sensor-belonging, .sensor-presence-node").count(), 0);
  assert.doesNotMatch(await page.locator("#map").innerText(), /YOU · SENSING|もっと探る|YOU ARE .*FIELD/u);
  assert.equal(await page.locator(".sensor-sense-field").getAttribute("data-presence"), null);
}

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Mock server startup timed out")), 10000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error("Mock server exited: " + code)); });
    server.stdout.on("data", data => {
      if (data.toString().includes("sensor qa " + baseUrl)) { clearTimeout(timeout); resolve(); }
    });
  });
  browser = await chromium.launch({ executablePath, headless: true });
  for (const options of [
    { width: 1440, height: 900, motion: "no-preference" },
    { width: 390, height: 844, motion: "reduce" },
    { width: 320, height: 568, motion: "reduce" },
    { width: 1440, height: 900, motion: "reduce", owned: true },
    { width: 1024, height: 768, motion: "reduce", fallback: true },
  ]) {
    await fetch(baseUrl + "/__qa/reset", { method: "POST" });
    if (options.owned) {
      await fetch(baseUrl + "/api/auth/trial", { method: "POST" });
      await fetch(baseUrl + "/api/web/v1/devices/pairing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "ベランダ環境センサー" }),
      });
    }
    const context = await browser.newContext({
      viewport: { width: options.width, height: options.height },
      reducedMotion: options.motion, hasTouch: options.width < 760,
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.addInitScript(({ fallback }) => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (fallback && this.classList.contains("sensor-sense-field") && /webgl/.test(type)) return null;
        return original.call(this, type, ...args);
      };
      // Capture actual GPU inputs without adding QA state to production code.
      const locations = new WeakMap();
      const getLocation = WebGLRenderingContext.prototype.getUniformLocation;
      const setUniform = WebGLRenderingContext.prototype.uniform4fv;
      WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
        const location = getLocation.call(this, program, name);
        if (location) locations.set(location, name);
        return location;
      };
      WebGLRenderingContext.prototype.uniform4fv = function (location, values) {
        if (this.canvas.classList.contains("sensor-sense-field")) {
          window.__fieldUniforms ||= {};
          window.__fieldUniforms[locations.get(location)] = Array.from(values);
        }
        return setUniform.call(this, location, values);
      };
      document.addEventListener("DOMContentLoaded", () => {
        const map = document.querySelector("#public-sensor-map");
        map.addEventListener("gaia:sensor-field", event => { window.__fieldNodes = event.detail.nodes; });
        map.addEventListener("gaia:sensor-focus", event => {
          window.__selectedOrigin = window.__fieldNodes?.find(node => node.id === event.detail.sensorId);
        });
      });
    }, { fallback: Boolean(options.fallback) });
    const sessionReady = page.waitForResponse(response => response.url().endsWith("/api/web/v1/social") && response.ok());
    await page.goto(baseUrl + "/sensors/?authenticated=1#map", { waitUntil: "domcontentloaded" });
    await sessionReady;
    const field = page.locator(".sensor-sense-field");
    await field.waitFor({ state: "visible" });
    await page.locator(".sensor-map-marker").first().waitFor({ state: "visible" });
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("sensor", { restoreFocus: false }));
    await page.waitForTimeout(700);
    await assertNoPresence(page);
    assert.equal(await field.getAttribute("data-renderer"), options.fallback ? "2d" : "webgl");
    assert.equal(await field.getAttribute("data-motion"), options.motion === "reduce" ? "static" : "ambient");
    assert(Number(await field.getAttribute("data-render-pixels")) <= 905_000);

    await page.locator(".sensor-map-card-close").click();
    await page.locator("#public-sensor-detail").waitFor({ state: "hidden" });
    const marker = page.locator('.sensor-map-marker[data-sensor-id="sensor_browserqa"]');
    // Resolve this fixture's co-located sensor through the actual observation list.
    await page.locator("#public-map-search-open").click();
    await page.locator("#public-sensor-query").fill("ベランダ");
    const sensorChoice = page.locator('.sensor-public-card[data-sensor-id="sensor_browserqa"]');
    const beforePulse = Number(await field.getAttribute("data-pulse-count"));
    if (options.width < 760) await sensorChoice.tap(); else await sensorChoice.click();
    await page.waitForFunction(before => Number(document.querySelector(".sensor-sense-field").dataset.pulseCount) > before, beforePulse);
    assert.equal(await marker.getAttribute("aria-current"), "true");
    assert(await page.locator("#public-sensor-detail").isVisible());
    if (!options.fallback) {
      const gpu = await page.evaluate(() => ({
        pulse: window.__fieldUniforms.u_pulse,
        nodes: window.__fieldUniforms.u_nodes,
        target: window.__selectedOrigin,
      }));
      assert(gpu.target, "Selected sensor must have field coordinates");
      assert(Math.abs(gpu.pulse[0] - gpu.target.x) < 0.001);
      assert(Math.abs(gpu.pulse[1] - (1 - gpu.target.y)) < 0.001);
      assert(gpu.nodes.some((value, index) => index % 4 === 3 && value === 1), "Selected-node GPU glow missing");
    }
    await page.locator(".sensor-like-trigger").click();
    await page.waitForFunction(() => document.querySelector(".sensor-like-trigger").getAttribute("aria-pressed") === "true");
    await assertNoPresence(page);
    const pulseAfterSelection = Number(await field.getAttribute("data-pulse-count"));
    // Old identity/presence events and an empty-map touch must not create a fake node or pulse.
    await page.locator("#public-sensor-map").evaluate(map => {
      map.dispatchEvent(new CustomEvent("gaia:sensor-identity", { detail: { deviceCount: 2, onlineCount: 1 } }));
      map.dispatchEvent(new CustomEvent("gaia:sensor-presence", { detail: { phase: "responding", sensorId: "sensor_browserqa" } }));
      map.dispatchEvent(new PointerEvent("pointerdown", { clientX: 50, clientY: 200 }));
      map.dispatchEvent(new PointerEvent("pointerup", { clientX: 50, clientY: 200 }));
    });
    assert.equal(Number(await field.getAttribute("data-pulse-count")), pulseAfterSelection);
    await assertNoPresence(page);
    const ownedLink = page.locator('.sensor-topbar a[data-nav="devices"]');
    assert.equal(await ownedLink.getAttribute("href"), "#devices");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, options.width + (options.owned ? "-owned" : options.fallback ? "-fallback" : "") + ".png") });
    report.checks.push({ ...options, sensorSelectionPulse: "passed", artificialPresence: "absent", likes: "passed" });
    console.log("PASS " + JSON.stringify(report.checks.at(-1)));
    await context.close();
  }
  // Reuse layout/selection/search/zoom checks against this test's own fixture server.
  await fetch(baseUrl + "/__qa/reset", { method: "POST" });
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/check-sensor-map-reference-browser.mjs"], {
      windowsHide: true, stdio: "inherit", env: { ...process.env, SENSOR_QA_URL: baseUrl },
    });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error("Map layout regression failed: " + code)));
  });
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  server.kill();
}

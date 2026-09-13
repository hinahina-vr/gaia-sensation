import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "assets/guide-previews");
const evidence = path.resolve("artifacts/guide-preview-refresh");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
const report = { status: "running", capturedAt: new Date().toISOString(), viewport: { width: 1440, height: 810 }, captures: [], errors: [] };
// The local static preview has no sensor API. Use the real, anonymous public
// responses with the current local UI; never invent sensor readings for art.
const publicResponses = new Map();
for (const endpoint of ["measurement-types", "sensors"]) {
  const response = await fetch(`https://gaia-senseware.pages.dev/api/public/v1/${endpoint}`);
  assert(response.ok, `Public sensor ${endpoint}: ${response.status}`);
  publicResponses.set(endpoint, await response.text());
}
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const name of ["map", "sensor", "character", "sound"]) {
    const context = await browser.newContext({ viewport: report.viewport, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    if (name === "sensor") {
      await context.route(`${base}/api/public/v1/**`, route => {
        const endpoint = new URL(route.request().url()).pathname.split("/").at(-1);
        const body = publicResponses.get(endpoint);
        return body ? route.fulfill({ contentType: "application/json", body }) : route.continue();
      });
      await context.route(`${base}/api/web/v1/session`, route => route.fulfill({ status: 401, json: { error: "Authentication required" } }));
    }
    const page = await context.newPage();
    console.log(`Opening current ${name}`);
    page.on("pageerror", error => report.errors.push(`${name}: ${error.message}`));
    const routePath = { map: "/#world-15", sensor: "/sensors/#map", character: "/#character", sound: "/#sound" }[name];
    await page.goto(new URL(routePath, base).href, { waitUntil: "domcontentloaded" });
    if (name === "map") {
      await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
        && document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false"
        && document.querySelector("#japan-layer")?.classList.contains("has-integrated-map-light"));
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      await page.waitForFunction(() => globalThis.GaiaMapPlayback?.getState().ready);
      await page.waitForTimeout(900);
    } else if (name === "sensor") {
      await page.waitForFunction(() => document.documentElement.dataset.sensorView === "map"
        && document.querySelectorAll("#public-sensor-map .sensor-map-marker").length > 0);
      await page.waitForTimeout(800);
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("sensor", { restoreFocus: false }));
      await page.waitForFunction(() => !document.querySelector('#gaia-mode-entry-guide') || document.querySelector('#gaia-mode-entry-guide').hidden);
    } else if (name === "character") {
      await page.waitForFunction(() => document.querySelector("#character-book-layer")?.classList.contains("is-open")
        && document.querySelector("#character-book-layer")?.getAttribute("aria-hidden") === "false"
        && document.querySelector("#character-book-image")?.complete
        && document.querySelector("#character-book-webgl")?.dataset.webglRendered === "true"
        && document.querySelectorAll("[data-character-expression]").length === 4);
    } else {
      await page.waitForFunction(() => document.querySelector("#sound-layer")?.classList.contains("is-open")
        && !["", "pending"].includes(document.querySelector("#sound-visualizer")?.dataset.renderer || "pending"));
      await page.waitForTimeout(600);
    }
    await page.waitForFunction(() => !document.querySelector("#gaia-boot") || document.querySelector("#gaia-boot").hidden);
    await page.waitForTimeout(120);
    await page.evaluate(async () => {
      const visibleImages = Array.from(document.images).filter(image => {
        const rect = image.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
          && rect.top < innerHeight && rect.left < innerWidth;
      });
      await Promise.race([
        Promise.all([document.fonts.ready, ...visibleImages.map(image => image.decode().catch(() => {}))]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Visible preview assets did not settle")), 8000)),
      ]);
    });
    const filename = path.join(output, `${name}.jpg`);
    await page.screenshot({ path: filename, type: "jpeg", quality: 88, animations: "disabled" });
    const bytes = fs.readFileSync(filename);
    assert(bytes.length > 30000, `${name}: capture is unexpectedly blank`);
    report.captures.push({ name, route: routePath, filename, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
      publicData: name === "sensor" ? { source: "https://gaia-senseware.pages.dev/api/public/v1/sensors", sensorCount: JSON.parse(publicResponses.get("sensors")).sensors.length } : undefined });
    console.log(`Captured current ${name}: ${bytes.length} bytes`);
    fs.writeFileSync(path.join(evidence, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(evidence, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

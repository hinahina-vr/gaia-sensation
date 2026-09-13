import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { fireSequence, inverseFireEase, FIRE_REVEAL_EDGE } from "../src/exploration/fire-ignition.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/fire-columns");
fs.mkdirSync(output, { recursive: true });
const source = JSON.parse(fs.readFileSync("data/firms-active-fire-snapshot.json", "utf8"));
const points = [[130, 6, 100], [148, -10, 42.5], [140, 24, 80]].map(([lon, lat, frp], index) => ({
  ...source.points[index], id: `fire-column-${index}`, lon, lat, frp, confidence: 96,
}));
const fixture = { ...source, points, summary: { ...source.summary, displayed: 3, detected: 3, maxFrp: 100 } };
for (const value of [0, .001, .1, .5, .85, 1]) {
  const t = inverseFireEase(value);
  assert(Math.abs(t * t * (3 - 2 * t) - value) < 1e-6);
}
assert(fireSequence(1262, 1263) + FIRE_REVEAL_EDGE <= 1, "Final marker must finish its reveal at 100%");
const report = { status: "running", cases: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const [width, height, reduced, dense] of [[1440, 900, false, false], [3840, 2088, false, false],
    [390, 844, false, false], [390, 844, true, false], [3840, 2088, false, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 720,
      reducedMotion: reduced ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      // One-shot GPU pixel probe, after the column draw, never a production hook.
      const draw = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function(...args) {
        draw.apply(this, args);
        const probe = globalThis.__fireProbe;
        if (!probe || this.canvas.id !== "gaia-firms-canvas" || args[0] !== this.POINTS
          || Number(this.canvas.dataset.firmsActiveColumns) !== args[2] || args[2] === 0) return;
        const ratio = this.canvas.width / this.canvas.getBoundingClientRect().width;
        const size = innerWidth >= 2400 ? 1.6 : innerWidth < 720 ? .85 : 1;
        const x = Math.max(0, Math.round((probe.x - 24 * size) * ratio));
        const y = Math.max(0, Math.round(this.canvas.height - (probe.y - 18 * size) * ratio));
        const w = Math.min(this.canvas.width - x, Math.round(48 * size * ratio));
        const h = Math.min(this.canvas.height - y, Math.round(100 * size * ratio));
        const pixels = new Uint8Array(w * h * 4);
        this.readPixels(x, y, w, h, this.RGBA, this.UNSIGNED_BYTE, pixels);
        let firePixels = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 60 && pixels[i] > pixels[i + 2] * 1.6) firePixels++;
        globalThis.__firePixels = { firePixels, glError: this.getError(), area: w * h };
        globalThis.__fireProbe = null;
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await context.route("**/firms-active-fire-snapshot.json", route => route.fulfill({ json: dense ? source : fixture }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (/shader error|VALIDATE_STATUS|INVALID_OPERATION|shader-error/i.test(message.text())) report.errors.push(message.text()); });
    await page.goto(`${base}/?preview=fire-columns#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !!globalThis.GaiaFirmsExhibit);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
      document.querySelector("[data-firms-exhibit]").click();
    });
    await page.waitForFunction(() => document.querySelector("#gaia-firms-canvas").dataset.firmsIgnition === "one-shot-fire-column");
    if (width < 720) await page.evaluate(() => globalThis.GaiaMapObservationAdapter.focusEarthLocation({ lon: 138, lat: 0, zoom: 1, durationMs: 0 }));
    const canvas = page.locator("#gaia-firms-canvas");
    const scan = () => canvas.evaluate(el => ({ ...el.dataset, pixels: el.width * el.height, events: getComputedStyle(el).pointerEvents }));
    const project = async point => page.evaluate(p => {
      const r = document.querySelector("#japan-map").getBoundingClientRect();
      const d = document.querySelector("#japan-overlay").dataset;
      const scale = (r.width >= 901 ? r.width / 360 : Math.max(r.width / 360, r.height / 180)) * (Number(d.earthZoom) || 1);
      return { x: r.left + (r.width - scale * 360) / 2 + +d.earthOffsetX + ((p.lon - Number(d.earthCenterLongitude) + 540) % 360) * scale,
        y: r.top + (r.height - scale * 180) / 2 + +d.earthOffsetY + (90 - p.lat) * scale };
    }, point);
    const click = async point => {
      const p = await project(point);
      if (width < 720) await page.touchscreen.tap(p.x, p.y);
      else await page.mouse.click(p.x, p.y);
    };
    if (reduced) {
      await page.waitForFunction(() => document.querySelector("#gaia-firms-canvas").dataset.firmsPlaybackPhase === "complete");
      assert.equal((await scan()).firmsActiveColumns, "0");
    } else {
      await page.waitForFunction(() => Number(document.querySelector("#gaia-firms-canvas").dataset.firmsActiveColumns) > 0);
      if (dense) await page.waitForTimeout(7000);
      else {
        await page.waitForTimeout(240);
        await page.evaluate(p => { globalThis.__fireProbe = p; }, await project(points[0]));
        await page.waitForFunction(() => !!globalThis.__firePixels);
        const pixels = await page.evaluate(() => globalThis.__firePixels);
        assert.equal(pixels.glError, 0);
        assert(pixels.firePixels > 15, `A visible flame must extend upward above the base point: ${JSON.stringify(pixels)}`);
      }
    }
    const visible = await scan();
    assert(visible.pixels <= 1603000 && Number(visible.firmsActiveColumns) <= Number(visible.firmsColumnLimit));
    assert.equal(visible.events, "none");
    const stem = `${width}-${reduced ? "reduced" : dense ? "dense" : "ignition"}`;
    await page.screenshot({ path: path.join(output, `${stem}.png`) });
    if (!dense) {
      await click(points[0]);
      await page.locator("#japan-poi-card").waitFor({ state: "visible" });
      assert.match(await page.locator("#japan-poi-meta").textContent(), /100\.0 MW/);
      await page.locator("#japan-poi-close").click();
      if (!reduced) {
        await page.waitForTimeout(1850);
        assert.equal((await scan()).firmsActiveColumns, "0", "An ignition must expire, not repeat on settled POIs");
        await page.locator("[data-firms-play]").click();
        await page.waitForTimeout(80);
        const paused = Number((await scan()).firmsPlaybackProgress);
        await page.waitForTimeout(160);
        assert.equal(Number((await scan()).firmsPlaybackProgress), paused);
        await page.locator("[data-firms-play]").click();
        await page.waitForTimeout(160);
        assert(Math.abs(Number((await scan()).firmsPlaybackProgress) - paused) < .02, "Resume must preserve eased timeline position");
      }
      await page.locator("[data-firms-progress]").evaluate(el => { el.value = "1000"; el.dispatchEvent(new Event("input", { bubbles: true })); });
      await page.waitForTimeout(100);
      assert.equal((await scan()).firmsActiveColumns, "0", "Scrubbing must not burst every fire simultaneously");
      const last = await project(points[2]);
      assert.equal(await page.evaluate(p => globalThis.GaiaFirmsExhibit.findPoiAt(p.x, p.y, "touch")?.index, last), 2);
      await page.locator("#japan-mode-list .map-mode-button").first().evaluate(el => el.click());
      assert.equal(await canvas.isVisible(), false);
      const finalFrame = (await scan()).firmsFrame;
      await page.waitForTimeout(150);
      assert.equal((await scan()).firmsFrame, finalFrame, "Leaving mode 26 must stop its renderer");
    }
    report.cases.push({ width, height, reduced, dense, visible });
    console.log(`PASS ${stem}: ignition, GPU/point budget and lifecycle`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

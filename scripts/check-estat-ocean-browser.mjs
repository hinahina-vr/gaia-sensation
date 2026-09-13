import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const widths = (process.argv[3] || "1440,3840,390").split(",").map(Number);
const indices = (process.argv[4] || "0,1,2,3,4,5,6,7,8,9").split(",").map(Number);
const reduced = process.argv.includes("--reduced");
const fallback = process.argv.includes("--fallback");
const lifecycle = process.argv.includes("--lifecycle");
const output = path.resolve(`artifacts/estat-ocean/${widths.join("-")}${reduced ? "-reduced" : ""}${fallback ? "-fallback" : ""}${lifecycle ? "-lifecycle" : ""}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : 900 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    await context.addInitScript(({ fallback }) => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
        if (fallback && this.id === "gaia-estat-atmosphere-webgl" && kind === "webgl2") return null;
        return getContext.call(this, kind, ...args);
      };
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function(...args) {
        draw.apply(this, args);
        if (this.canvas.id !== "gaia-estat-atmosphere-webgl" || !window.oceanProbe) return;
        window.oceanProbe = false;
        const sample = document.createElement("canvas");
        sample.width = 128;
        sample.height = 72;
        const ctx = sample.getContext("2d");
        ctx.drawImage(this.canvas, 0, 0, 128, 72);
        window.oceanPixels = Array.from(ctx.getImageData(0, 0, 128, 72).data);
        window.oceanError = this.getError();
      };
      const upload = WebGL2RenderingContext.prototype.texImage2D;
      WebGL2RenderingContext.prototype.texImage2D = function(...args) {
        upload.apply(this, args);
        const image = args.at(-1);
        if (this.canvas.id !== "gaia-estat-atmosphere-webgl" || !(image instanceof HTMLCanvasElement) || image.width !== 2048) return;
        const ctx = image.getContext("2d");
        const read = (lon, lat) => ctx.getImageData(Math.floor((lon + 180) / 360 * image.width), Math.floor((90 - lat) / 180 * image.height), 1, 1).data[0];
        window.oceanLandProbe = { japan: read(138, 36), china: read(110, 35), pacific: read(155, 30) };
      };
    }, { fallback });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8") }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) await context.route(`https://${host}/**`, route => route.abort());
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=estat-ocean#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaEstatExhibits);
    await page.evaluate(() => globalThis.GaiaMapObservationAdapter.waitSignalsReady());
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    await page.waitForTimeout(1700);
    const probe = async () => {
      await page.evaluate(() => { window.oceanPixels = null; window.oceanProbe = true; });
      await page.waitForFunction(() => window.oceanPixels !== null);
      assert.equal(await page.evaluate(() => window.oceanError), 0);
      return page.evaluate(() => window.oceanPixels);
    };
    for (const index of indices) {
      await page.evaluate(index => globalThis.GaiaEstatExhibits.select(index), index);
      await page.waitForFunction(index => globalThis.GaiaEstatExhibits.getState().activeIndex === index && !document.querySelector(".gaia-estat-readout").hidden, index);
      const webgl = page.locator("#gaia-estat-atmosphere-webgl");
      if (!fallback) await page.waitForFunction(() => document.querySelector("#gaia-estat-atmosphere-webgl").dataset.estatOceanMask === "ready");
      await page.waitForTimeout(1600);
      const state = await webgl.evaluate(canvas => ({ ...canvas.dataset, pixels: canvas.width * canvas.height, pointerEvents: getComputedStyle(canvas).pointerEvents }));
      assert.equal(state.pointerEvents, "none");
      const check = { width, number: index + 16, reduced, fallback, state };
      report.checks.push(check);
      if (!fallback) {
        assert.equal(state.estatWebglState, "active");
        assert(state.pixels <= (width <= 720 ? 421000 : 1202000));
        const land = await page.evaluate(() => window.oceanLandProbe);
        assert.equal(land.japan, 255);
        assert.equal(land.china, 255);
        assert.equal(land.pacific, 0);
        check.land = land;
        const first = await probe();
        await page.waitForTimeout(1200);
        const second = await probe();
        let delta = 0, lit = 0, energy = 0;
        for (let i = 0; i < first.length; i += 4) {
          delta += Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]);
          energy += first[i] + first[i + 1] + first[i + 2];
          if (Math.max(first[i], first[i + 1], first[i + 2]) > 15) lit++;
        }
        check.delta = delta / (128 * 72 * 3);
        check.litFraction = lit / (128 * 72);
        check.energy = energy / (128 * 72 * 3);
        if (!reduced) assert(check.delta > .25, `MAP ${index + 16}: visible spatial motion, got ${check.delta}`);
        else assert.equal(state.estatOceanTime, "0.000");
        assert(check.litFraction > .03, `MAP ${index + 16}: ocean must be visible`);
      } else assert.equal(state.estatWebglState, "fallback-2d");
      assert.match(await page.locator("[data-estat-caption]").textContent(), /抽象演出.*実測海流/u);
      assert.equal(await page.locator("#japan-title").textContent(), await page.locator("[data-estat-title]").textContent());
      await page.screenshot({ path: path.join(output, `${width}-${index + 16}.png`) });
      // The decorative layer must not intercept selection or change its values.
      await page.evaluate(() => globalThis.GaiaEstatExhibits.selectPrefecture(12));
      assert.equal(await page.locator(".gaia-estat-readout").getAttribute("data-estat-selected-code"), "13");
      await page.evaluate(() => globalThis.GaiaEstatExhibits.setPeriod(1));
      assert.equal(await page.evaluate(() => globalThis.GaiaEstatExhibits.getState().periodIndex), 1);
      console.log(`PASS ${width}: MAP ${index + 16}, motion ${check.delta?.toFixed(2) || "fallback"}`);
    }
    if (lifecycle && !fallback) {
      await page.evaluate(() => {
        const gl = document.querySelector("#gaia-estat-atmosphere-webgl").getContext("webgl2");
        window.oceanLoss = gl.getExtension("WEBGL_lose_context");
        if (!window.oceanLoss) throw new Error("Context-loss extension unavailable");
        window.oceanLoss.loseContext();
      });
      await page.waitForFunction(() => document.querySelector("#gaia-estat-atmosphere-webgl").dataset.estatWebglState === "context-lost");
      await page.waitForTimeout(150);
      await page.evaluate(() => window.oceanLoss.restoreContext());
      await page.waitForFunction(() => {
        const canvas = document.querySelector("#gaia-estat-atmosphere-webgl");
        return canvas.dataset.estatWebglState === "active" && canvas.dataset.estatOceanMask === "ready";
      });
      const restored = await probe();
      assert(restored.some((value, index) => index % 4 < 3 && value > 15));
      report.contextRecovery = "passed";
    }
    await page.evaluate(() => globalThis.GaiaEstatExhibits.deactivate());
    const frames = await page.locator("#gaia-estat-atmosphere-webgl").getAttribute("data-estat-ocean-frame");
    await page.waitForTimeout(200);
    assert.equal(await page.locator("#gaia-estat-atmosphere-webgl").getAttribute("data-estat-ocean-frame"), frames);
    assert.equal(await page.locator("#gaia-estat-atmosphere-webgl").isVisible(), false);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/warm-stat-map");
const widths = (process.argv[4] || "1440,3840,390").split(",").map(Number);
const fallback = process.argv.includes("--fallback");
const series = JSON.parse(fs.readFileSync("data/estat-prefecture-series.json", "utf8"));
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width < 720 ? 844 : 900 }, hasTouch: width < 720 });
    await context.addInitScript(fallback => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      if (fallback) {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
          return this.id === "gaia-estat-atmosphere-webgl" && kind === "webgl2" ? null : getContext.call(this, kind, ...args);
        };
      }
    }, fallback);
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=warm-stat-map#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    await page.waitForTimeout(1000);
    const select = async n => {
      await page.evaluate(n => [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .find(button => button.textContent.trim() === String(n).padStart(2, "0")).click(), n);
      await page.waitForFunction(n => document.querySelector("#japan-mode-number").textContent === String(n).padStart(2, "0"), n);
    };
    const arrow = async selector => page.locator(selector).evaluate(node => {
      const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await select(1);
    const standardArrow = width > 900 ? await arrow('[data-map-dock-mode-step="1"]') : null;
    await select(17);
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.referenceWorldPalette === "warm-sage"
      && document.querySelector("#gaia-estat-canvas").dataset.estatHeatmap === "prefecture-choropleth");
    await page.waitForTimeout(1600);
    const evidence = await page.evaluate(() => {
      const base = document.querySelector("#japan-overlay"), overlay = document.querySelector("#gaia-estat-canvas");
      const rect = base.getBoundingClientRect();
      const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(base.dataset.earthZoom);
      const x0 = (rect.width - 360 * scale) / 2 + Number(base.dataset.earthOffsetX || 0);
      const y0 = (rect.height - 180 * scale) / 2 + Number(base.dataset.earthOffsetY || 0);
      const sample = (canvas, lon, lat) => {
        const x = x0 + ((lon - Number(base.dataset.earthCenterLongitude) + 540) % 360) * scale, y = y0 + (90 - lat) * scale;
        if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) return null;
        return [...canvas.getContext("2d").getImageData(Math.floor(x * canvas.width / rect.width), Math.floor(y * canvas.height / rect.height), 1, 1).data];
      };
      return { palette: base.dataset.referenceWorldPalette, land: sample(base, 116, 38), sea: sample(base, 145, 30),
        overlay: sample(overlay, 116, 38), shade: getComputedStyle(document.querySelector(".japan-map-shade")).opacity,
        background: getComputedStyle(document.querySelector("#japan-map")).backgroundImage,
        field: { ...document.querySelector("#gaia-estat-atmosphere-webgl").dataset } };
    });
    assert.equal(evidence.palette, "warm-sage");
    assert.equal(evidence.shade, "0.12");
    if (evidence.land) {
      assert(evidence.land[1] > 125 && evidence.land[3] > 170, "Continents must have a readable sage fill");
      assert(evidence.overlay[3] < 40, "The statistics canvas must not black out the base geography");
    }
    assert.match(await page.locator("[data-estat-guide]").textContent(), /宿泊者数の多い8県.*実際の移動経路や交流量ではありません/);
    if (!fallback) assert.equal(evidence.field.estatWebglVisual, "continuous-travel-filaments", "Do not silently remove the links the user only asked about");
    else assert.equal(evidence.field.estatWebglState, "fallback-2d");
    if (standardArrow) assert.deepEqual(await arrow('[data-estat-step="1"]'), standardArrow);
    await page.screenshot({ path: path.join(output, `${width}-17.jpg`), type: "jpeg", quality: 88 });
    await page.evaluate(() => { GaiaEstatExhibits.setPeriod(1); GaiaEstatExhibits.selectPrefecture(12); });
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => GaiaEstatExhibits.getState());
    assert.equal(state.selectedIndex, 12); assert.equal(state.periodIndex, 1);
    assert.equal(Number((await page.locator("[data-estat-value]").textContent()).replaceAll(",", "")), series.lodging[state.period][12]);
    // Model selection above verifies values; click the visible selected marker too.
    const marker = page.locator(".gaia-estat-marker.is-selected");
    if (await marker.isVisible()) { if (width < 720) await marker.tap(); else await marker.click(); }
    await select(19);
    await page.waitForTimeout(1000);
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-reference-world-palette"), "warm-sage");
    await select(1);
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.referenceWorldPalette === "default");
    assert.notEqual(await page.locator(".japan-map-shade").evaluate(node => getComputedStyle(node).opacity), "0.12");
    report.checks.push({ width, fallback, ...evidence, sourceValue: series.lodging[state.period][12], defaultPaletteRestored: true });
    console.log(`PASS ${width}px: continent fill, transparent overlay, warm map, source values, navigation and palette reset`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }

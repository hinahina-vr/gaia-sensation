import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/forest-reveal");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let activePage;
try {
  for (const options of [
    { width: 1440 }, { width: 390 }, { width: 1440, slow: true }, { width: 390, reduced: true },
  ]) {
    const label = `${options.width}${options.slow ? "-slow" : ""}${options.reduced ? "-reduced" : ""}`;
    const context = await browser.newContext({
      viewport: { width: options.width, height: options.width < 720 ? 844 : 900 },
      hasTouch: options.width < 720, reducedMotion: options.reduced ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.__forestDraws = [];
      const masks = new WeakSet();
      const put = CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData = function (pixels, ...args) {
        // Recognize the actual processed forest mask, not a diagnostic flag.
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
          if (!data[i + 3]) continue;
          if (data[i] === 24 && data[i + 1] === 230 && data[i + 2] === 126) masks.add(this.canvas);
          break;
        }
        return put.call(this, pixels, ...args);
      };
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
        if (this.canvas.id === "japan-overlay" && masks.has(source)
          && document.querySelector("#japan-mode-number")?.textContent === "08") {
          window.__forestDraws.push({ time: performance.now(), alpha: this.globalAlpha,
            separator: document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning") });
        }
        return draw.call(this, source, ...args);
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    let releaseImage;
    if (options.slow) {
      const gate = new Promise(resolve => { releaseImage = resolve; });
      await context.route("**/modis-land-cover-2023.png", async route => { await gate; await route.continue(); });
    }
    const page = await context.newPage();
    activePage = page;
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=forest-reveal&exhibit=7&live=1#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length >= 30);
    await page.evaluate(async () => { GaiaMapDemo?.stop?.(); await GaiaMapObservationAdapter.waitSignalsReady(); GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }); });
    const select = async number => page.evaluate(number => {
      [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .find(button => button.textContent.trim() === String(number).padStart(2, "0")).click();
    }, number);
    await select(7);
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    if (!options.slow) await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.forestMask === "ready");

    const checkEntry = async (name, rapid = false) => {
      await page.evaluate(() => { window.__forestDraws = []; });
      await select(8);
      if (rapid) {
        await page.waitForTimeout(180); await select(9);
        await page.waitForTimeout(180); await select(8);
      }
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.forestRevealState === "waiting-for-separator");
      assert.equal(await page.evaluate(() => window.__forestDraws.length), 0, `${label}/${name}: forest appeared during separator`);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      if (releaseImage) {
        await page.waitForTimeout(550);
        assert.equal(await page.locator("#japan-overlay").getAttribute("data-forest-reveal-state"), "waiting-for-raster");
        assert.equal(await page.evaluate(() => window.__forestDraws.length), 0);
        releaseImage(); releaseImage = null;
      }
      if (!options.reduced) {
        await page.waitForFunction(() => {
          const alpha = Number(document.querySelector("#japan-overlay").dataset.forestRevealAlpha);
          return alpha > .15 && alpha < .8;
        });
        await page.screenshot({ path: path.join(output, `${label}-${name}-mid.jpg`), type: "jpeg", quality: 85 });
      }
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.forestRevealState === "complete");
      await page.waitForTimeout(80);
      const scan = await page.evaluate(() => {
        const data = document.querySelector("#japan-overlay").dataset;
        return { draws: window.__forestDraws, startedAt: Number(data.forestRevealStartedAt),
          separatorCompletedAt: Number(data.titleSeparatorCompletedAt), progress: Number(data.forestRevealProgress),
          rain: data.forestRainBrazil, mask: data.forestMask };
      });
      assert(scan.draws.length > 0, `${label}/${name}: actual forest raster must draw`);
      assert(scan.draws.every(draw => !draw.separator), `${label}/${name}: no draw may precede separator completion`);
      // RAF's timestamp can predate a timer processed before its callback in a
      // busy frame. Check the actual draw time, not that scheduled frame time.
      assert(scan.draws[0].time >= scan.separatorCompletedAt - 1, `${label}/${name}: fade must start after separator`);
      assert.equal(scan.progress, 1); assert.equal(scan.mask, "ready"); assert.equal(scan.rain, "5.33 mm/日");
      assert(Math.abs(scan.draws.at(-1).alpha - .5) < .001, "Preserve the original final opacity");
      if (!options.reduced) {
        assert(scan.draws[0].alpha < .03, `${label}/${name}: first raster frame must be faint`);
        assert(new Set(scan.draws.map(draw => draw.alpha.toFixed(3))).size >= 10, `${label}/${name}: must fade over multiple frames`);
        for (let i = 1; i < scan.draws.length; i++) assert(scan.draws[i].alpha >= scan.draws[i - 1].alpha - .001, "No flash or opacity reset");
        assert(scan.draws.at(-1).time - scan.startedAt >= 990, "Do not skip the one-second fade");
      }
      await page.screenshot({ path: path.join(output, `${label}-${name}-complete.jpg`), type: "jpeg", quality: 85 });
      report.checks.push({ label, name, ...scan });
    };
    await checkEntry("entry");
    if (!options.slow && !options.reduced) {
      await select(7); await page.waitForTimeout(1700);
      await checkEntry("reentry");
      await select(7); await page.waitForTimeout(1700);
      await checkEntry("rapid", true);
    }
    console.log(`PASS ${label}: separator → forest fade, actual canvas opacity, unchanged rainfall`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  report.lastState = await activePage?.evaluate(() => ({
    title: document.querySelector("#japan-title").textContent,
    layer: document.querySelector("#japan-layer").className,
    data: { ...document.querySelector("#japan-overlay").dataset },
    draws: window.__forestDraws.length,
  })).catch(() => null);
  await activePage?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

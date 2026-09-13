import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { ESTAT_EXHIBITS } from "../src/exploration/estat-exhibit-catalog.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/number-stability");
const series = JSON.parse(fs.readFileSync("data/estat-prefecture-series.json", "utf8"));
const report = { status: "running", checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 900, height: 900 }, { width: 3840, height: 2088 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?mode=25&preview=number-stability#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaEstatExhibits && globalThis.GaiaMapDemo);
    await page.evaluate(() => { GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
    for (const [index, exhibit] of ESTAT_EXHIBITS.entries()) {
      const years = series.periodsBySeries[exhibit.key];
      const values = series[exhibit.key][years.at(-1)];
      const sorted = values.map((value, index) => ({ value, index })).filter(row => Number.isFinite(row.value)).sort((a, b) => a.value - b.value);
      const low = sorted[0].index, high = sorted.at(-1).index;
      await page.evaluate(async ({ index, period, low }) => { await GaiaEstatExhibits.select(index); GaiaEstatExhibits.setPeriod(period); GaiaEstatExhibits.selectPrefecture(low); }, { index, period: years.length - 1, low });
      await page.waitForFunction(() => document.querySelector(".gaia-estat-readout").dataset.estatValueCountState === "settled");
      for (const target of [high, low]) {
        const samples = await page.evaluate(target => new Promise(resolve => {
          const readout = document.querySelector(".gaia-estat-readout");
          const value = readout.querySelector("[data-estat-value]");
          const unit = readout.querySelector("[data-estat-unit]");
          const label = readout.querySelector("[data-estat-value-label]");
          const samples = [];
          GaiaEstatExhibits.selectPrefecture(target);
          const started = performance.now();
          const sample = now => {
            const box = value.getBoundingClientRect(), unitBox = unit.getBoundingClientRect();
            const css = getComputedStyle(value), primary = value.parentElement.getBoundingClientRect();
            samples.push({ state: readout.dataset.estatValueCountState, text: value.textContent,
              y: box.y, height: box.height, unitY: unitBox.y, labelY: label.getBoundingClientRect().y,
              transform: css.transform, filter: css.filter, opacity: css.opacity, animation: css.animationName,
              overlap: box.right > unitBox.left + .5,
              inline: box.bottom > unitBox.top && unitBox.bottom > box.top,
              overflow: Math.max(0, unitBox.right - primary.right, primary.left - box.left),
              pageOverflow: document.documentElement.scrollWidth - innerWidth });
            if (now - started < 900 || readout.dataset.estatValueCountState === "counting") requestAnimationFrame(sample);
            else resolve(samples);
          };
          requestAnimationFrame(sample);
        }), target);
        const key = `${viewport.width}/${exhibit.key}/${target}`;
        assert(samples.some(sample => sample.state === "counting"), `${key}: must exercise real count animation`);
        assert(new Set(samples.map(sample => sample.text)).size > 1, `${key}: value did not update`);
        for (const field of ["y", "height", "unitY", "labelY"]) {
          const spread = Math.max(...samples.map(sample => sample[field])) - Math.min(...samples.map(sample => sample[field]));
          assert(spread <= 1, `${key}: ${field} moved ${spread}px`);
        }
        for (const sample of samples) {
          assert.equal(sample.transform, "none", `${key}: moving transform`);
          assert.equal(sample.filter, "none", `${key}: blur`);
          assert.equal(sample.opacity, "1", `${key}: blinking`);
          assert.equal(sample.animation, "none", `${key}: CSS animation`);
          assert(!sample.overlap && sample.inline && sample.overflow <= 1 && sample.pageOverflow === 0, `${key}: number/unit layout ${JSON.stringify(sample)}`);
        }
        report.checks.push({ width: viewport.width, key: exhibit.key, target, frames: samples.length, status: "passed" });
      }
      if (exhibit.key === "summerHigh" || exhibit.key === "lodging") await page.screenshot({ path: path.join(output, `${viewport.width}-${exhibit.key}.png`) });
    }
    console.log(`PASS ${viewport.width}: all 10 exhibits, rising/falling values, no vertical motion/blur/flicker, inline units`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

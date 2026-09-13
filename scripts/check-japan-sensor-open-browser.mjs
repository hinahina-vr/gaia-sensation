import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { JAPAN_SENSOR_OPEN_EXHIBITS, sensorObservationAppearance } from "../src/exploration/japan-sensor-open-catalog.js";
import { JAPAN_POLLUTION_EXHIBITS } from "../src/exploration/japan-pollution-catalog.js";
import { PRTR_BIOLOGY_EXHIBITS } from "../src/exploration/prtr-biology-catalog.js";
import { formatObservationNumber, concentrationDomain } from "../src/shared/observation-numbers.js";
const pollution = process.env.JAPAN_POLLUTION_QA === "1";
const exhibits = pollution ? JAPAN_POLLUTION_EXHIBITS : JAPAN_SENSOR_OPEN_EXHIBITS;
const totalExhibits = 31 + JAPAN_SENSOR_OPEN_EXHIBITS.length + JAPAN_POLLUTION_EXHIBITS.length + PRTR_BIOLOGY_EXHIBITS.length;

const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || "artifacts/japan-sensor-open-2026-09-09/browser");
const snapshots = new Map(exhibits.map(exhibit => [exhibit.id, JSON.parse(fs.readFileSync(`data/${exhibit.dataFile}`, "utf8"))]));
const files = ["app.js", "index.html", "gaia-mode-loader.js", "map-exhibit-categories.js", "map-mobile-shell.js", "statistics-discovery.js", "statistics-lab.js", "marine-cod-exhibit.css",
  "src/exploration/index.js", "src/exploration/map-demo.js", "src/shared/observation-numbers.js", "src/exploration/japan-sensor-open-catalog.js", "src/exploration/japan-pollution-catalog.js", "src/exploration/marine-cod-exhibit.js", ...exhibits.map(item => `data/${item.dataFile}`)];
const report = { status: "running", baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  environment: "Local installed Chrome; original MOE/JMA/NIES snapshots. Desktop and touch emulation, not physical phones or production. External live requests blocked. Failure/delay routes are identified synthetic transport tests, not synthetic measurement data. Saved views are localStorage only. No external AI request or data export is performed.",
  sha256: Object.fromEntries(files.map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])), checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const idle = async () => {
  // Selection schedules viewport fitting after the mobile shell's next layout.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle"
    && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
};
const boot = async (width, height, entry = Number(exhibits[0].number), routeSetup) => {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 900, hasTouch: width <= 900, reducedMotion: "reduce" });
  await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
  await context.route("https://**", route => route.abort());
  if (routeSetup) await routeSetup(context);
  page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /TypeError:|ReferenceError:|SyntaxError:/.test(message.text())) report.errors.push(message.text()); });
  await page.goto(`${base}/?exhibit=${entry}&japan-sensor-qa=1#world`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(count => globalThis.GaiaMarineCod && globalThis.GaiaMapDemo && globalThis.GaiaMapCategories?.buttons().length === count, totalExhibits);
  await page.evaluate(() => GaiaMapDemo.stop());
  return context;
};
const ready = async exhibit => {
  await page.waitForFunction(id => GaiaMarineCod.getState().id === id && GaiaMarineCod.getState().count > 0
    && !document.querySelector("[data-cod-controls]").disabled, exhibit.id);
  await idle();
};
const navigate = async exhibit => {
  await page.evaluate(number => GaiaMapCategories.buttons().find(item => Number(item.textContent) === number).click(), Number(exhibit.number));
  await ready(exhibit);
};
const pick = async row => {
  await page.locator("[data-cod-prefecture]").selectOption(row.prefCode);
  await page.locator("[data-cod-station]").selectOption(row.id);
  await idle();
};
const action = async (mobile, kind) => {
  if (mobile) {
    await page.locator('[data-mobile-sheet="tools"]').click();
    await page.getByRole("button", { name: kind === "source" ? "データの出典" : "統計分析", exact: true }).last().click();
  } else await page.locator(`[data-cod-${kind}]`).click();
};
const projected = row => page.evaluate(row => {
  const rect = document.querySelector("#japan-map").getBoundingClientRect(), d = document.querySelector("#japan-overlay").dataset;
  const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(d.earthZoom);
  return { x: rect.left + (rect.width - 360 * scale) / 2 + Number(d.earthOffsetX) + ((row.lon - 150 + 540) % 360) * scale,
    y: rect.top + (rect.height - 180 * scale) / 2 + Number(d.earthOffsetY) + (90 - row.lat) * scale };
}, row);
try {
  const sizes = process.env.JAPAN_SENSOR_VIEWPORTS?.split(",").map(size => size.split("x").map(Number)) || [[1440, 900], [390, 844], [320, 568], [844, 390]];
  for (const [width, height] of sizes) {
    const mobile = width <= 900, context = await boot(width, height);
    await ready(exhibits[0]);
    assert.equal(await page.locator('.map-mode-button[aria-current="true"]').textContent(), exhibits[0].number, "Direct URL works on cold startup");
    if (mobile) {
      await page.locator('[data-mobile-sheet="exhibits"]').click();
      for (const exhibit of exhibits) assert(await page.getByRole("button", { name: `${exhibit.number} ${exhibit.shortTitle}`, exact: true }).count(), `Mobile catalogue title ${exhibit.number}`);
      await page.screenshot({ path: path.join(output, `${width}-collection.png`) });
      await page.locator("[data-mobile-sheet-close]").click();
    }
    for (const exhibit of exhibits) {
      await navigate(exhibit);
      const data = snapshots.get(exhibit.id), latest = data.periods.at(-1);
      const row = latest.stations.find(item => item.id === "47662") || latest.stations.find(item => item.measurement.quality === "measured");
      assert.equal(await page.locator("#japan-mode-title").textContent(), exhibit.shortTitle);
      assert.equal(await page.locator("#japan-description").textContent(), exhibit.subtitle);
      assert((await page.locator("[data-cod-status]").textContent()).includes(`${data.periods[0].year}–${latest.year}`));
      assert.equal(await page.locator("[data-cod-year]").getAttribute("min"), String(data.periods[0].year));
      assert.equal(await page.locator("[data-cod-year]").getAttribute("max"), String(latest.year));
      assert.equal(await page.locator("#gaia-marine-cod-canvas").getAttribute("data-cod-point-count"), String(latest.stations.length));
      await pick(row);
      assert.equal(await page.locator("[data-cod-value]").innerText(), `${row.measurement.text} ${exhibit.unit}`);
      await page.waitForFunction(color => getComputedStyle(document.querySelector("[data-cod-value]")).color === color, sensorObservationAppearance(exhibit, row.measurement.value).color);
      if (exhibit.measurementKey === "ph") assert.match(await page.locator("[data-cod-secondary]").textContent(), /年度最大値/);
      if (exhibit.measurementKey === "solar_irradiance") assert.match(await page.locator("[data-cod-secondary]").textContent(), /13\.9 MJ\/m²/);
      for (const period of data.periods) {
        await page.locator("[data-cod-year]").focus(); await page.keyboard.press("Home");
        for (let y = data.periods[0].year; y < period.year; y++) await page.keyboard.press("ArrowRight");
        const observed = period.stations.find(item => item.id === row.id)?.measurement;
        const expected = !observed ? "—" : `${observed.text}${observed.quality === "missing" ? "" : ` ${exhibit.unit}`}`;
        assert.equal(await page.locator("[data-cod-value]").textContent(), expected);
        assert.equal(await page.locator("[data-cod-period]").textContent(), `${period.year}${exhibit.periodUnit}`);
        assert.equal(await page.evaluate(() => GaiaMarineCod.getState().selectedId), row.id);
      }
      for (const selector of ["[data-cod-prefecture]", "[data-cod-station]", "[data-cod-year]", "[data-cod-play]", "[data-cod-overview]"]) {
        const bounds = await page.locator(selector).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom,
          hit: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }; });
        assert(bounds.hit && bounds.x >= 0 && bounds.right <= width + 1 && bounds.y >= 0 && bounds.bottom <= height + 1, `${width} ${exhibit.number} reachable ${selector}: ${JSON.stringify(bounds)} ${JSON.stringify(await page.evaluate(() => ({ scrollX, scrollY, scrolled: [...document.querySelectorAll('*')].filter(n => n.scrollLeft).map(n => [n.id, n.className, n.scrollLeft]), map: document.querySelector('#japan-map').getBoundingClientRect().toJSON() })))}`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      assert.equal(await page.locator(".experience").evaluate(node => node.scrollLeft), 0, "Focus/year changes cannot scroll the entire map scene sideways");
      const legendClear = await page.locator(".gaia-cod-legend-key").evaluate(node => {
        const missing = node.querySelector(".gaia-cod-missing").getBoundingClientRect();
        return [...node.querySelectorAll(".gaia-cod-scale-ends span")].every(label => {
          const box = label.getBoundingClientRect();
          return missing.bottom <= box.top || missing.top >= box.bottom || missing.right <= box.left || missing.left >= box.right;
        });
      });
      assert(legendClear, `${width} ${exhibit.number}: missing-data explanation does not overlap low/high labels`);
      if (pollution) assert(await page.locator(".gaia-cod-scale-labels").evaluate(node => {
        const labels = [...node.children].map(item => item.getBoundingClientRect());
        const parent = node.closest(".gaia-cod-legend-key").getBoundingClientRect();
        return labels.every((r, i) => r.left >= parent.left && r.right <= parent.right && (!i || r.left >= labels[i - 1].right + 3));
      }), "Trace-concentration legend labels neither overlap nor overflow");
      await page.screenshot({ path: path.join(output, `${width}-${exhibit.number}-selected.png`) });
      // Actual rendered map selection, not a synthetic DOM point.
      const position = await projected(row);
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, position), "japan-map");
      if (mobile) await page.touchscreen.tap(position.x, position.y); else await page.mouse.click(position.x, position.y);
      const picked = await page.evaluate(() => GaiaMarineCod.getState().selectedId);
      assert(latest.stations.some(item => item.id === picked), "Click resolves an actual source station (co-located rows may share a hit)");
      await pick(row);
      if (width === 1440 || width === 390) {
        await action(mobile, "source"); await page.locator("#japan-data-panel").waitFor({ state: "visible" });
        assert.match(await page.locator("#japan-data-panel").innerText(), new RegExp(exhibit.metricLabel));
        assert(await page.locator(`#japan-data-panel a[href*="${new URL(exhibit.source).hostname}"]`).count());
        await page.locator("#japan-data-close").click();
        await action(mobile, "analysis");
        await page.waitForFunction(id => GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().datasetId.startsWith(id), exhibit.id);
        const current = await page.evaluate(() => GaiaMarineCod.getStatisticsDataset());
        await page.waitForFunction(id => document.querySelector("#gaia-statistics-canvas").dataset.analysisDataset === id, current.id);
        assert.equal(current.unit, exhibit.unit); assert.equal(current.yLabel, exhibit.metricLabel);
        assert.equal(current.periodStart, data.periods[0].year); assert.equal(current.periodEnd, latest.year);
        assert(current.title.includes(`${data.periods[0].year}〜${latest.year}`));
        assert.deepEqual(current.rows.map(item => [item.x, item.y]), data.periods.flatMap(period => {
          const value = period.stations.find(item => item.id === row.id)?.measurement.value;
          return Number.isFinite(value) ? [[period.year, value]] : [];
        }));
        assert.equal(Number(await page.locator("#gaia-statistics-canvas").getAttribute("data-point-count")), current.rows.length);
        if (pollution) {
          const chart = page.locator("#gaia-statistics-canvas");
          assert.deepEqual((await chart.getAttribute("data-domain-y")).split(",").map(Number), concentrationDomain(current.rows.map(r => r.value)));
          const ticks = (await chart.getAttribute("data-y-tick-labels")).split(",");
          assert.equal(new Set(ticks).size, 5, "Distinct readable trace-concentration ticks");
          const first = current.rows[0];
          assert((await page.locator(".gaia-statistics-takeaway-evidence").innerText()).includes(formatObservationNumber(first.value, 2)), "Trace value is not rounded to zero in takeaway");
        }
        if ([32, 39, 43, 44, 54, 55, 61, 64].includes(Number(exhibit.number))) await page.screenshot({ path: path.join(output, `${width}-${exhibit.number}-analysis.png`) });
        if (pollution && [44, 55, 64].includes(Number(exhibit.number))) {
          const before = await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount);
          await page.locator("#gaia-statistics-menu-toggle").click();
          const options = page.locator(".gaia-statistics-data-options");
          if (!await options.getAttribute("open").then(value => value !== null)) await options.locator("summary").click();
          await page.locator("#gaia-statistics-view-save").click();
          assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount), before + 1);
          assert((await page.evaluate(() => JSON.parse(localStorage.getItem("gaia-statistics-saved-views:v1")))).some(view => view.datasetId === current.id));
          const saved = await page.locator("#gaia-statistics-saved-view").inputValue();
          await page.locator("#gaia-statistics-record-filter").fill("no-match");
          await page.locator("#gaia-statistics-saved-view").selectOption(saved);
          await page.locator("#gaia-statistics-view-apply").click();
          await page.waitForTimeout(200);
          assert.equal(await page.locator("#gaia-statistics-record-filter").inputValue(), "");
          await page.locator("#gaia-statistics-menu-close").click();
        }
        await page.evaluate(() => GaiaStatisticsLab.close());
      }
      const missing = latest.stations.find(item => item.measurement.quality !== "measured");
      if (missing) {
        await pick(missing);
        assert.equal((await page.evaluate(() => GaiaMarineCod.getStatisticsDataset())).rows.some(item => item.year === latest.year), false);
        await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-cod-value]")).color === "rgb(171, 181, 190)");
      }
      report.checks.push({ width, height, exhibit: exhibit.number, station: row.id, periods: 5, missingTest: !!missing, result: "passed" });
      console.log(`PASS ${width}x${height} / ${exhibit.number}: route, real records, years, colors, map ${mobile ? "tap" : "click"}, controls${width === 1440 || width === 390 ? ", source and analysis" : ""}`);
    }
    // Last/first boundary, return to 31 and older provider families.
    if (!mobile) {
      await page.locator('[data-cod-step="1"]').click(); await idle();
      assert.equal(await page.locator('.map-mode-button[aria-current="true"]').textContent(), pollution ? "01" : "44");
    }
    for (const number of [31, 30, 6, 15, 2, 38]) {
      await page.evaluate(number => GaiaMapCategories.buttons().find(item => Number(item.textContent) === number).click(), number); await idle();
      await page.waitForFunction(number => Number(document.querySelector("#japan-mode-number").textContent) === number, number);
      assert.equal(await page.locator(".gaia-marine-cod-readout").isVisible(), number === 31 || number === 38);
    }
    await context.close();
  }
  // A delayed old request must not repaint the currently selected exhibit.
  const delayed = await boot(1440, 900, Number(exhibits[0].number), async context => {
    await context.route(`**/data/${exhibits[0].dataFile}*`, async route => { await new Promise(resolve => setTimeout(resolve, 1700)); await route.continue(); });
  });
  await navigate(JAPAN_SENSOR_OPEN_EXHIBITS.find(item => item.number === "38")); await page.waitForTimeout(2100);
  assert.equal(await page.evaluate(() => GaiaMarineCod.getState().id), "japan-weather-temperature");
  assert.equal(await page.locator("[data-cod-controls]").isDisabled(), false);
  report.checks.push({ race: `delayed ${exhibits[0].number} cannot replace 38`, result: "passed" }); await delayed.close();
  // Retry a failed transport using unchanged real source values.
  let shouldFail = true;
  const last = exhibits.at(-1), lastData = snapshots.get(last.id);
  const failed = await boot(390, 844, Number(last.number), async context => {
    await context.route(`**/data/${last.dataFile}*`, route => shouldFail ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
  });
  await page.getByText(`読込に失敗しました。展示${last.number}を選び直して再試行してください。`, { exact: true }).waitFor();
  assert(await page.locator("[data-cod-year]").isDisabled()); assert(await page.locator("[data-cod-analysis]").isDisabled());
  shouldFail = false; await navigate(exhibits.at(-1));
  assert.equal(await page.evaluate(() => GaiaMarineCod.getState().count), lastData.periods.at(-1).stations.length);
  await page.locator("[data-cod-play]").click(); await page.waitForFunction(year => GaiaMarineCod.getState().year === year, lastData.periods[0].year, { timeout: 7000 });
  await page.locator("[data-cod-play]").click(); assert.equal(await page.evaluate(() => GaiaMarineCod.getState().playing), false);
  report.checks.push({ recovery: `${last.number} HTTP 503, retry, source station count, automatic year wrap and stop`, result: "passed" }); await failed.close();
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close();
}

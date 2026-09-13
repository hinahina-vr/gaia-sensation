import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/realtime-dock-alignment-2026-09-09/${before ? "before" : "after"}`);
const sizes = process.env.REALTIME_SIZES?.split(",").map(size => size.split("x").map(Number))
  || (before ? [[3771,2100],[1920,1080]] : [[3771,2100],[2560,1440],[1920,1080],[1440,900],[1280,800],[1024,768],[390,844],[320,568],[844,390]]);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", environment: "Local Chrome; synthetic cached atmosphere, not live provider validation", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width,height] of sizes) {
    const context = await browser.newContext({ viewport: { width,height }, reducedMotion: "reduce", hasTouch: width <= 900 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      sessionStorage.setItem("gaia-planet-signals-v3:atmosphere", JSON.stringify({ cachedAt: Date.now(), data: {
        observedAt: new Date().toISOString(), points: [{ lat:35,lon:139,label:"検証地点",windSpeed:7,windDirection:120,pressure:1014,cloud:60,radiation:194 }],
      } }));
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await context.route("**/api/live/v1/firms", route => route.fulfill({ path: "data/firms-active-fire-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?exhibit=5&live=1#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaPlanetSignals && document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(() => { GaiaMapDemo.stop(); GaiaMapCategories.buttons().find(button => Number(button.textContent) === 5).click(); });
    const dock = page.locator(".gaia-planet-signals-readout");
    await dock.locator('[data-realtime-state="live"]').waitFor();
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0,0);
    await page.waitForTimeout(250);
    const layout = await dock.evaluate(node => {
      const fields = {
        chapter: ".gaia-planet-chapter", chapterLabel: ".gaia-planet-chapter > p", chapterValue: "[data-planet-title]",
        status: ".gaia-realtime-status", title: ".gaia-realtime-status h3", state: ".gaia-realtime-state",
        time: ".gaia-realtime-time", timeLabel: "[data-realtime-time-label]", timeValue: "[data-realtime-time]",
        primary: ".gaia-planet-primary", primaryLabel: "[data-planet-primary-label]", primaryValue: "[data-planet-primary]",
        metric: ".gaia-planet-metrics", metricLabel: "[data-planet-secondary-a-label]", metricValue: "[data-planet-secondary-a]",
        actions: ".gaia-map-actions", actionLabel: ".gaia-map-action--source small", actionValue: ".gaia-map-action--source strong",
      };
      const rects = Object.fromEntries(Object.entries(fields).map(([key,selector]) => {
        const element = node.querySelector(selector), r = element.getBoundingClientRect(), css = getComputedStyle(element);
        return [key, { ...r.toJSON(), center: r.y + r.height / 2, font: css.fontSize, lineHeight: css.lineHeight, text: element.textContent, display: css.display }];
      }));
      return { rects, rect: node.getBoundingClientRect().toJSON(), fits: node.scrollWidth <= node.clientWidth + 2 && node.scrollHeight <= node.clientHeight + 2 };
    });
    report.checks.push({ width,height,...layout });
    await page.screenshot({ path: path.join(output,`${width}-full.png`) });
    await dock.screenshot({ path: path.join(output,`${width}-dock.png`) });
    assert(layout.fits, `${width}: readout overflows`);
    if (width >= 1800) {
      const r = layout.rects;
      const identityCenter = (r.title.top + r.state.bottom) / 2;
      const offset = Math.abs(r.time.center - identityCenter);
      if (before) assert(offset > 15, `${width}: staggered timestamp did not reproduce`);
      else assert(offset <= 1, `${width}: timestamp and title block are not centered (${offset}px)`);
    }
    if (!before && width > 900) {
      const r = layout.rects;
      assert(Math.abs(r.chapterLabel.top - r.primaryLabel.top) <= 1, "Exhibit and measurement captions must share a row");
      assert(Math.abs(r.chapterValue.top - r.primaryValue.top) <= 1, "Exhibit and measurement values must share a row");
      assert(Math.abs(r.actionLabel.top - r.primaryLabel.top) <= 1, "Action captions must share the measurement row");
      assert(Math.abs(r.actionValue.top - r.primaryValue.top) <= 1, "Action values must share the measurement row");
      if (width >= 1800) {
        assert(Math.abs(r.timeLabel.top - r.primaryLabel.top) <= 1, "Time and measurement labels must share a row");
        assert(Math.abs(r.timeValue.top - r.primaryValue.top) <= 1, "Time and measurement values must share a row");
      }
      if (width > 1250) {
        assert(Math.abs(r.primaryLabel.top - r.metricLabel.top) <= 1, "Measurement labels must align");
        assert(Math.abs(r.primaryValue.top - r.metricValue.top) <= 1, "Measurement values must align");
      }
      const source = dock.locator(".gaia-map-action--source");
      await source.click();
      await page.waitForFunction(() => document.querySelector("#japan-layer").classList.contains("japan-data-open"));
      await page.locator("#japan-data-close").click();
      await dock.locator('[data-planet-step="-1"]').click();
      await page.waitForFunction(() => document.querySelector("[data-planet-number]")?.textContent === "04");
    }
    await context.close();
    console.log(`PASS ${width}x${height}`);
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? "reproduced" : "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output,"failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output,"report.json"), JSON.stringify(report,null,2));
  await browser.close();
}

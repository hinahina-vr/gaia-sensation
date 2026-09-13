import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const layoutOnly = process.argv.includes("--layout-only");
const output = path.resolve(`artifacts/map-ui-polish-${before ? "before" : layoutOnly ? "layout" : "after"}`);
fs.mkdirSync(output, { recursive: true });
const report = { fixture: "Synthetic public-feed responses; browser UI checks, not live-provider verification", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const [width, height] of (before ? [[390,844]] : [[390,844],[320,568],[844,390],[1440,900],[1920,1080]])) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 900, hasTouch: width <= 900, reducedMotion: "reduce" });
    if (before) for (const file of ["map-mobile-shell.css", "map-mobile-shell.js"]) {
      const body = execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
      await context.route(`**/${file}*`, route => route.fulfill({ body, contentType: file.endsWith("css") ? "text/css" : "text/javascript" }));
    }
    await context.addInitScript(() => {
      for (const version of [3,4,5]) sessionStorage.setItem(`gaia:mode-entry-guide:map:v${version}`, "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
      for (const loader of ["atmosphere", "air"]) sessionStorage.setItem(`gaia-planet-signals-v3:${loader}`, JSON.stringify({ cachedAt: Date.now(), data: {
        observedAt: new Date().toISOString(), points: [{ lat: 35, lon: 139, label: "検証地点", windSpeed: 7.2, windDirection: 124, pressure: 1014, cloud: 36, radiation: 512, pm25: 13.4, aerosol: .27 }],
      } }));
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await context.route("**/api/live/v1/firms", route => route.fulfill({ path: "data/firms-active-fire-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?exhibit=6&live=1#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMobileMap && globalThis.GaiaMapCategories?.buttons().length === 30);
    await page.evaluate(async () => { GaiaMapDemo?.stop(); await GaiaMapObservationAdapter.waitSignalsReady(); await document.fonts.ready; });
    const select = async number => {
      await page.evaluate(n => GaiaMapCategories.buttons().find(b => Number(b.textContent) === n).click(), number);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      await page.waitForTimeout(450);
    };
    await select(6);
    const slider = page.locator(".signal-console-map [data-signal-time]");
    await slider.fill("50"); await slider.dispatchEvent("input");
    await page.waitForTimeout(120);
    const scan = async label => {
      const result = await page.evaluate(() => {
        const visible = el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        return { text: document.querySelector("#japan-layer").innerText,
          arrows: [...document.querySelectorAll("[data-mobile-exhibit-step]")].filter(visible).map(el => el.getBoundingClientRect().toJSON()),
          year: document.querySelector("#co2-timeline-year").textContent,
          years: [...document.querySelectorAll(".map-dock-year, [data-estat-period]")].filter(visible).map(el => el.innerText),
          boxes: [...document.querySelectorAll("#japan-poi-card, .gaia-planet-signals-readout, .signal-console-map, .japan-heading, #map-mobile-toolbar")].filter(visible).map(el => ({ id: el.id || el.className, ...el.getBoundingClientRect().toJSON() })),
        };
      });
      report.checks.push({ width, height, label, ...result });
      await page.screenshot({ path: path.join(output, `${width}-${label}.png`) });
      return result;
    };
    const co2 = await scan("co2");
    if (!before) {
      assert(co2.years.some(text => /2004\s*年/u.test(text)), "Visible CO2 year at slider midpoint");
      if (width <= 900) assert.equal(co2.arrows.length, 2);
      await slider.press("ArrowRight"); await slider.press("ArrowRight");
      assert.notEqual(await page.locator("#co2-timeline-year").textContent(), co2.year);
    }
    await select(24);
    await scan("annual");
    if (!before) assert.match(await page.locator("b[data-estat-period]").innerText(), /^\d{4}年$/u);
    await select(3);
    await page.locator('.gaia-planet-signals-readout [data-realtime-state="live"]').waitFor();
    await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lat: 35, lon: 139, zoom: 1.35, durationMs: 0 }));
    await page.waitForTimeout(350);
    const at = await page.evaluate(() => {
      const rect = document.querySelector("#japan-map").getBoundingClientRect();
      const data = document.querySelector("#japan-overlay").dataset;
      const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * (Number(data.earthZoom) || 1);
      return { x: rect.left + (rect.width - 360 * scale) / 2 + (Number(data.earthOffsetX) || 0) + ((139 - Number(data.earthCenterLongitude) + 540) % 360) * scale,
        y: rect.top + (rect.height - 180 * scale) / 2 + (Number(data.earthOffsetY) || 0) + 55 * scale };
    });
    if (width <= 900) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
    await page.locator("#japan-poi-card").waitFor();
    const poi = await scan("poi");
    if (!before) {
      const card = poi.boxes.find(b => b.id === "japan-poi-card"), dock = poi.boxes.find(b => b.id.includes("planet-signals-readout"));
      const overlap = card.x < dock.right && card.right > dock.x && card.y < dock.bottom && card.bottom > dock.y;
      assert.equal(overlap, false, "POI must not overlap observation dock");
      if (width <= 900) {
        const close = await page.locator("#japan-poi-close").boundingBox();
        const name = await page.locator("#japan-poi-card .japan-poi-name").boundingBox();
        assert(name.x + name.width <= close.x || name.y >= close.y + close.height, "POI title reserves the close button's space");
        assert(await page.locator("#japan-poi-card").evaluate(el => el.scrollWidth <= el.clientWidth + 1), "POI has no horizontal clipping");
      }
      assert(card.y >= 0 && card.bottom <= height);
      await page.locator("#japan-poi-card").evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.locator("#japan-poi-close").click();
      assert.equal(await page.locator("#japan-poi-card").isVisible(), false);
      if (width <= 900 && !layoutOnly) {
        const sequence = width === 390 ? [...Array.from({length:30},(_,i)=>[1,i+1]), ...Array.from({length:30},(_,i)=>[-1,i === 29 ? 30 : 29-i])]
          : [[1,1],[-1,30],[1,1],[1,2],[1,3]];
        await select(30);
        for (const [direction, expected] of sequence) {
          await page.locator(`[data-mobile-exhibit-step="${direction}"]`).tap();
          await page.waitForFunction(n => Number(document.querySelector("#japan-mode-number").textContent) === n, expected);
          await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
        }
      }
    }
    await context.close();
    console.log(`PASS ${width}x${height}${before ? " baseline captured" : ""}`);
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? "reproduced" : "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output,"report.json"), JSON.stringify(report,null,2)); await browser.close(); }

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/population-global");
const requested = process.argv[4]?.split(",");
const signals = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8")).modes.find(m => m.id === "population-tide").signals;
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const viewport of [{ width: 3840, height: 2088 }, { width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740, reduced: true }]) {
    const name = `${viewport.width}${viewport.reduced ? "-reduced" : ""}`;
    if (requested && !requested.includes(name)) continue;
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: viewport.reduced ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      const proto = CanvasRenderingContext2D.prototype, circles = new WeakMap();
      const begin = proto.beginPath, arc = proto.arc, fill = proto.fill, clear = proto.clearRect;
      window.__populationDraws = [];
      proto.beginPath = function(...args) { circles.delete(this); return begin.apply(this, args); };
      proto.arc = function(...args) { circles.set(this, args); return arc.apply(this, args); };
      proto.clearRect = function(...args) { if (this.canvas.id === "japan-overlay") window.__populationDraws = []; return clear.apply(this, args); };
      proto.fill = function(...args) {
        const circle = circles.get(this);
        if (this.canvas.id === "japan-overlay" && this.canvas.dataset.populationEncoding && circle && /^rgba\((155, 191, 205|173, 224, 211),/.test(this.fillStyle)) {
          const t = this.getTransform(), rect = this.canvas.getBoundingClientRect(), scale = rect.width / this.canvas.width;
          window.__populationDraws.push({ x: (circle[0] * t.a + t.e) * scale, y: (circle[1] * t.d + t.f) * scale,
            radius: circle[2] * t.a * scale, alpha: this.globalAlpha });
        }
        return fill.apply(this, args);
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${name}: ${error.message}`));
    await page.goto(`${base}/?preview=population-global#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }); GaiaMapDemo.stop(); document.querySelector('.map-mode-bank [data-map-standard-index="8"]').click(); });
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.plotRevealState === "complete" && document.querySelector("#japan-overlay").dataset.populationEncoding);
    const snapshots = [];
    for (const year of [1967, 2025]) {
      await page.evaluate(year => GaiaMapObservationAdapter.setSignalTime(((year - 1960 + .5) / 66) * 100), year);
      await page.waitForFunction(year => Number(document.querySelector("#japan-overlay").dataset.populationSelectedYear) === year && window.__populationDraws.length > 0, year);
      await page.waitForTimeout(180);
      const scan = await page.evaluate(() => {
        const overlay = document.querySelector("#japan-overlay"), d = overlay.dataset, r = overlay.getBoundingClientRect();
        return { year: Number(d.populationSelectedYear), count: Number(d.populationCircleCount), missing: Number(d.populationMissingCount),
          reference: Number(d.populationAreaReference), referenceRadius: Number(d.populationReferenceRadius),
          selected: d.populationSelectedIso3, radius: Number(d.populationSelectedRadius), selectedX: Number(d.populationSelectedScreenX), selectedY: Number(d.populationSelectedScreenY),
          centerLongitude: Number(d.earthCenterLongitude), width: r.width, height: r.height, rect: { x: r.x, y: r.y }, zoom: Number(d.earthZoom), offsetX: Number(d.earthOffsetX), offsetY: Number(d.earthOffsetY), draws: window.__populationDraws,
          obstacles: [...document.querySelectorAll(".signal-console-map, .map-command-dock, #map-mobile-toolbar, .signal-encoding-legend-dock, #gaia-map-zoom-controls")]
            .filter(node => node.checkVisibility() && getComputedStyle(node).visibility !== "hidden" && Number(getComputedStyle(node).opacity) > 0).map(node => node.getBoundingClientRect().toJSON()),
          card: { x: Number(d.selectionLabelLeftPx), y: Number(d.selectionLabelTopPx), width: Number(d.selectionLabelWidthPx), height: Number(d.selectionLabelHeightPx) } };
      });
      report.latestScan = { viewport: name, ...scan };
      assert.equal(scan.year, year); assert.equal(scan.count, year === 1967 ? 216 : 217); assert.equal(scan.missing, year === 1967 ? 1 : 0);
      assert.equal(scan.reference, 1500000000);
      const row = signals.population.find(row => row.year === year && row.iso3 === "JPN");
      assert(Math.abs(scan.radius - scan.referenceRadius * Math.sqrt(row.population / scan.reference)) < .02);
      const drawn = scan.draws.find(draw => Math.hypot(draw.x - scan.selectedX, draw.y - scan.selectedY) < .1 && Math.abs(draw.radius - scan.radius) < .02);
      assert(drawn && drawn.alpha > .99, `${name}: selected country's actual canvas radius`);
      assert(scan.card.x >= 0 && scan.card.x + scan.card.width <= scan.width + 1, `${name}: selected card outside map`);
      assert(scan.card.y >= 0 && scan.card.y + scan.card.height <= scan.height + 1);
      for (const box of scan.obstacles) {
        const left = scan.card.x + scan.rect.x, top = scan.card.y + scan.rect.y;
        const overlap = Math.max(0, Math.min(left + scan.card.width, box.right) - Math.max(left, box.x)) * Math.max(0, Math.min(top + scan.card.height, box.bottom) - Math.max(top, box.y));
        assert(overlap < 2, `${name}: current readout must avoid controls`);
      }
      if (viewport.width >= 1440) {
        const scale = (scan.width >= 901 ? scan.width / 360 : Math.max(scan.width / 360, scan.height / 180)) * scan.zoom;
        for (const iso3 of ["FRA", "DEU", "ITA", "POL", "UKR", "RUS", "USA", "IND", "CHN", "BRA", "ZAF"]) {
          const row = signals.population.find(row => row.year === year && row.iso3 === iso3);
          const x = (scan.width - 360 * scale) / 2 + scan.offsetX + ((((row.lon - Number(scan.centerLongitude) + 540) % 360) - 180) + 180) * scale;
          const y = (scan.height - 180 * scale) / 2 + scan.offsetY + (90 - row.lat) * scale;
          const radius = scan.referenceRadius * Math.sqrt(row.population / scan.reference);
          if (x < -radius - 12 || x > scan.width + radius + 12 || y < -radius - 12 || y > scan.height + radius + 12) continue;
          assert(scan.draws.some(draw => Math.hypot(draw.x - x, draw.y - y) < .1 && Math.abs(draw.radius - radius) < .02), `${name}: ${iso3} is not drawn at its source position with proportional area`);
        }
      }
      if (viewport.width === 3840) assert(scan.referenceRadius >= 230, "4K bubbles should no longer use 47px maximum");
      snapshots.push(scan);
      await page.screenshot({ path: path.join(output, `${name}-${year}.jpg`), type: "jpeg", quality: 91 });
    }
    assert.equal(snapshots[0].referenceRadius, snapshots[1].referenceRadius);
    const japan = year => signals.population.find(row => row.year === year && row.iso3 === "JPN").population;
    assert(Math.abs((snapshots[1].radius / snapshots[0].radius) ** 2 - japan(2025) / japan(1967)) < .003, "area ratio must match population growth across years");
    {
      const row = signals.population.find(row => row.iso3 === "FRA" && row.year === 2025);
      if (viewport.width < 1440) {
        await page.evaluate(row => GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 2, targetX: .5, targetY: .58, durationMs: 120, label: "population-europe-test" }), row);
        await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
      }
      const scan = await page.evaluate(() => { const overlay = document.querySelector("#japan-overlay"), d = overlay.dataset, r = overlay.getBoundingClientRect();
        return { width: r.width, height: r.height, centerLongitude: Number(d.earthCenterLongitude), rect: { x: r.x, y: r.y }, zoom: Number(d.earthZoom), offsetX: Number(d.earthOffsetX), offsetY: Number(d.earthOffsetY) }; });
      const scale = (scan.width >= 901 ? scan.width / 360 : Math.max(scan.width / 360, scan.height / 180)) * scan.zoom;
      const x = scan.rect.x + (scan.width - 360 * scale) / 2 + scan.offsetX + ((((row.lon - Number(scan.centerLongitude) + 540) % 360) - 180) + 180) * scale;
      const y = scan.rect.y + (scan.height - 180 * scale) / 2 + scan.offsetY + (90 - row.lat) * scale;
      await page.mouse.click(x, y);
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.populationSelectedIso3 === "FRA");
      await page.screenshot({ path: path.join(output, `${name}-france-selected.jpg`), type: "jpeg", quality: 91 });
    }
    await page.evaluate(() => { GaiaMapObservationAdapter.closePoi(); document.querySelector('.map-mode-bank [data-map-standard-index="0"]').click(); });
    await page.waitForFunction(() => !document.querySelector("#japan-overlay").dataset.populationEncoding);
    report.checks.push({ viewport: name, snapshots, exitClean: true });
    await context.close();
    console.log(`PASS ${name}: coverage, canvas area, year comparison, selection, bounds, exit`);
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; await page?.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }

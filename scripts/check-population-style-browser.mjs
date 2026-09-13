import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv.slice(2).find(arg => /^https?:\/\//.test(arg)) || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const widths = (process.argv.find(arg => arg.startsWith("--widths="))?.split("=")[1] || "3840,1440,390,320").split(",").map(Number);
const output = path.resolve(`artifacts/population-style/${before ? "before" : "after"}`);
fs.mkdirSync(output, { recursive: true });
const rows = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8")).modes.find(mode => mode.id === "population-tide").signals.population;
const report = { status: "running", before, checks: [], errors: [], sha256: Object.fromEntries(["app.js", "app-content.js", "map-ui-grid-polish.css", "data/gaia-signals.json", "gaia-mode-loader.js", "index.html"].map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const project = row => page.evaluate(row => {
  const d = document.querySelector("#japan-overlay").dataset, r = document.querySelector("#japan-map").getBoundingClientRect();
  const scale = (r.width >= 901 ? r.width / 360 : Math.max(r.width / 360, r.height / 180)) * Number(d.earthZoom);
  return { x: r.left + r.width / 2 + Number(d.earthOffsetX) + (((row.lon - Number(d.earthCenterLongitude) + 540) % 360) - 180) * scale,
    y: r.top + r.height / 2 + Number(d.earthOffsetY) - row.lat * scale };
}, row);
try {
  for (const width of widths) {
    const height = width >= 2400 ? 2160 : width < 600 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      const proto = CanvasRenderingContext2D.prototype, paths = new WeakMap(), gradients = new WeakMap();
      const methods = Object.fromEntries(["clearRect", "beginPath", "arc", "fill", "stroke", "fillText", "createRadialGradient"].map(name => [name, proto[name]]));
      window.__populationStyle = { circles: [], labels: [] };
      proto.clearRect = function (...args) { if (this.canvas.id === "japan-overlay") window.__populationStyle = { circles: [], labels: [] }; return methods.clearRect.apply(this, args); };
      proto.beginPath = function (...args) { paths.delete(this); return methods.beginPath.apply(this, args); };
      proto.arc = function (...args) { paths.set(this, args); return methods.arc.apply(this, args); };
      proto.createRadialGradient = function (...args) { const gradient = methods.createRadialGradient.apply(this, args); gradients.set(gradient, true); return gradient; };
      for (const method of ["fill", "stroke"]) proto[method] = function (...args) {
        const arc = paths.get(this);
        if (this.canvas.id === "japan-overlay" && arc) {
          const t = this.getTransform(), r = this.canvas.getBoundingClientRect(), ratio = r.width / this.canvas.width;
          const style = method === "fill" ? this.fillStyle : this.strokeStyle;
          window.__populationStyle.circles.push({ method, x: r.left + (arc[0] * t.a + t.e) * ratio, y: r.top + (arc[1] * t.d + t.f) * ratio,
            radius: arc[2] * t.a * ratio, style: gradients.has(style) ? "radial-gradient" : String(style), alpha: this.globalAlpha, shadow: this.shadowBlur, lineWidth: this.lineWidth });
        }
        return methods[method].apply(this, args);
      };
      proto.fillText = function (...args) {
        if (this.canvas.id === "japan-overlay") window.__populationStyle.labels.push({ text: args[0], x: args[1], y: args[2], font: this.font, color: this.fillStyle, shadow: this.shadowBlur, squeezed: args.length > 3 });
        return methods.fillText.apply(this, args);
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?mode=14&preview=population-style#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); await document.fonts.ready;
      GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop();
      document.querySelector('.map-mode-bank [data-map-standard-index="8"]').click();
    });
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.plotRevealState === "complete");
    const yearScans = [];
    for (const year of before ? [1987] : [1987, 1967, 2025]) {
      const india = rows.find(row => row.iso3 === "IND" && row.year === year);
      await page.evaluate(({ year, india, width }) => {
        GaiaMapObservationAdapter.closePoi();
        GaiaMapObservationAdapter.setSignalTime((year - 1960 + .5) / 66 * 100);
        GaiaMapObservationAdapter.focusEarthLocation({ lon: india.lon, lat: india.lat, zoom: width < 600 ? 1 : 2, targetX: .49, targetY: .44, durationMs: 0 });
      }, { year, india, width });
      await page.waitForFunction(year => {
        const d = document.querySelector("#japan-overlay").dataset;
        return d.populationSelectedYear === String(year) && d.viewAnimation === "idle" && window.__populationStyle.circles.length;
      }, year);
      const scan = await page.evaluate(() => ({ d: { ...document.querySelector("#japan-overlay").dataset }, draw: window.__populationStyle,
        accent: getComputedStyle(document.querySelector("#japan-layer")).getPropertyValue("--map-accent-rgb"),
        legend: document.querySelector("[data-signal-encoding-legend]").textContent,
        legendMark: (() => { const style = getComputedStyle(document.querySelector('[data-encoding-mark="heatmap"]')); return { radius: style.borderRadius, background: style.backgroundImage, color: style.backgroundColor }; })(),
        overflow: document.documentElement.scrollWidth - innerWidth }));
      const point = await project(india);
      const expectedRadius = Math.min(240, Math.max(86, width * .065)) * Math.sqrt(india.population / 1_500_000_000);
      const circle = scan.draw.circles.find(circle => circle.method === "fill" && Math.hypot(circle.x - point.x, circle.y - point.y) < .1 && Math.abs(circle.radius - expectedRadius) < .02);
      assert(circle, `${width}/${year}: India's actual Canvas circle must retain source position and area`);
      assert.equal(scan.d.populationCircleCount, String(rows.filter(row => row.year === year).length));
      assert.equal(scan.d.populationMissingCount, String(217 - rows.filter(row => row.year === year).length));
      assert.equal(scan.d.populationAreaReference, "1500000000"); assert.equal(scan.overflow, 0);
      if (before) {
        assert.equal(circle.style, "radial-gradient");
        assert(scan.draw.labels.some(label => label.text === "8.1億" && /Mincho|serif/.test(label.font)));
      } else {
        assert.match(circle.style, /^rgba\(155, 191, 205, /); assert(Math.abs(Number(circle.style.match(/, ([\d.]+)\)$/)[1]) - .065) <= 1 / 255); assert.equal(circle.shadow, 0);
        assert.equal(scan.d.populationVisualStyle, "porcelain-celadon");
        assert.equal(scan.accent.trim(), "173, 224, 211");
        assert.doesNotMatch(scan.legend, /琥珀/);
        assert.equal(scan.legendMark.radius, "50%"); assert.equal(scan.legendMark.background, "none");
        if (width >= 760 && year === 1987) {
          const label = scan.draw.labels.find(label => label.text === "8.1");
          const unit = scan.draw.labels.find(item => item.text === "億" && Math.abs(item.y - label?.y) < 1 && item.x > label?.x);
          assert(label && unit, "The number and smaller unit must both be actually drawn");
          assert.match(label.font, /Segoe UI|Arial|sans-serif/); assert.doesNotMatch(label.font, /Mincho/);
          assert(parseFloat(unit.font.match(/([\d.]+)px/)[1]) < parseFloat(label.font.match(/([\d.]+)px/)[1]));
          assert.equal(label.color, "#e8f1f3"); assert.equal(label.shadow, 0); assert.equal(label.squeezed, false);
        }
      }
      yearScans.push({ width, year, population: india.population, point, circle, referenceRadius: Number(scan.d.populationReferenceRadius) });
      report.checks.push({ width, year, ...scan, point, circle });
      if (year === 1987) {
        await page.screenshot({ path: path.join(output, `${width}-map.png`) });
        const radius = Math.max(expectedRadius + 45, width < 600 ? 100 : 190);
        const x = Math.max(0, point.x - radius), y = Math.max(0, point.y - radius);
        await page.screenshot({ path: path.join(output, `${width}-india.png`), clip: { x, y, width: Math.min(radius * 2, width - x), height: Math.min(radius * 2, height - y) } });
      }
    }
    if (!before) {
      assert(yearScans.every(scan => scan.referenceRadius === yearScans[0].referenceRadius));
      assert(Math.abs((yearScans[2].circle.radius / yearScans[1].circle.radius) ** 2 - yearScans[2].population / yearScans[1].population) < .0001, "Year-to-year area ratios must stay faithful to population");
      // Use real mouse/touch selection and inspect the source detail card.
      const india = rows.find(row => row.iso3 === "IND" && row.year === 2025), point = await project(india);
      if (width < 600) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
      await page.locator("#japan-poi-card").waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.populationSelectedIso3 === "IND");
      assert((await page.locator("#japan-poi-meta").textContent()).includes(india.population.toLocaleString("en-US")));
      const selection = await page.evaluate(() => ({ d: { ...document.querySelector("#japan-overlay").dataset }, draw: window.__populationStyle, capture: GaiaMapObservationAdapter.captureObservation() }));
      const selectedCircle = selection.draw.circles.find(circle => circle.method === "stroke" && Math.hypot(circle.x - point.x, circle.y - point.y) < .1 && Math.abs(circle.radius - Number(selection.d.populationSelectedRadius)) < .02);
      assert(selectedCircle); assert.equal(selectedCircle.shadow, 0); assert.match(selectedCircle.style, /^rgba\(206, 238, 229, /);
      assert.equal(selection.d.selectionLabelBackgroundAlpha, "0.8");
      report.checks.push({ width, workflow: "real map selection -> source detail -> observation capture", selection });
      await page.locator("#japan-poi-close").click();
      await page.evaluate(() => GaiaMapObservationAdapter.selectMode(0));
      await page.waitForFunction(() => !document.querySelector("#japan-overlay").dataset.populationEncoding);
      assert.equal(await page.locator("#japan-overlay").getAttribute("data-population-visual-style"), null);
    }
    console.log(`PASS ${width}: ${before ? "amber glow and Mincho number reproduced" : "muted palette, sans value/unit, unchanged area/data, selection and exit"}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {}); throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

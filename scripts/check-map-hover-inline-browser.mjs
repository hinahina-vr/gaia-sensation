import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv.slice(2).find(arg => /^https?:\/\//.test(arg)) || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const motion = process.argv.includes("--motion");
const output = path.resolve(`artifacts/hover-inline-80/${before ? "before" : motion ? "after-motion" : "after"}`);
const widths = (process.argv.find(arg => arg.startsWith("--widths="))?.split("=")[1] || "1440,3840,901,390,320,568").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", before, checks: [], errors: [], scope: "Local Chrome with bundled source data. Unrelated NOAA network endpoint fixture-isolated; not a production test.",
  sha256: Object.fromEntries(["app.js", "map-ui-grid-polish.css", "gaia-mode-loader.js", "index.html"].map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const height = width === 568 ? 320 : width < 600 ? 844 : width >= 2400 ? 2160 : 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, reducedMotion: motion ? "no-preference" : "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      // Observe actual Canvas draw calls, independently of the app diagnostics.
      const fill = CanvasRenderingContext2D.prototype.fill;
      CanvasRenderingContext2D.prototype.fill = function (...args) {
        if (this.canvas.id === "japan-overlay" && /rgba\(5, 19, 26,/.test(this.fillStyle)) {
          window.__readoutFill = { style: this.fillStyle, alpha: this.globalAlpha, text: [] };
        }
        return fill.apply(this, args);
      };
      const text = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        if (this.canvas.id === "japan-overlay" && window.__readoutFill) {
          window.__readoutFill.text.push({ text: args[0], x: args[1], y: args[2], alpha: this.globalAlpha, style: this.fillStyle, squeezed: args.length > 3 });
        }
        return text.apply(this, args);
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?mode=14&preview=hover-inline#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop();
      [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(button => button.textContent.trim() === "14").click();
    });
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.plotRevealState === "complete");
    await page.evaluate(() => document.fonts.ready);
    for (const year of width >= 900 ? [1999, 1973] : [1999]) {
      const source = await page.evaluate(async year => {
        GaiaMapObservationAdapter.closePoi();
        const snapshot = await GaiaMapObservationAdapter.waitSignalsReady();
        const rows = snapshot.modes.find(mode => mode.id === "population-tide").signals.population;
        const years = [...new Set(rows.map(row => row.year))].sort((a, b) => a - b);
        GaiaMapObservationAdapter.setSignalTime((years.indexOf(year) + .5) / years.length * 100);
        const row = rows.find(row => row.iso3 === (year === 1999 ? "JPN" : "IND") && row.year === year);
        GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 2, targetX: .5, targetY: .43, durationMs: 0 });
        return row;
      }, year);
      await page.waitForFunction(year => {
        const data = document.querySelector("#japan-overlay").dataset;
        return data.populationSelectedYear === String(year) && data.selectionLabelVisible === "true" && data.viewAnimation === "idle";
      }, year);
      if (year === 1999) {
        const scan = await page.evaluate(() => {
          const overlay = document.querySelector("#japan-overlay"), data = overlay.dataset, box = overlay.getBoundingClientRect();
          return { data: { ...data }, lines: JSON.parse(data.selectionLabelLines), draw: window.__readoutFill,
            card: { x: box.left + Number(data.selectionLabelLeftPx), y: box.top + Number(data.selectionLabelTopPx), width: Number(data.selectionLabelWidthPx), height: Number(data.selectionLabelHeightPx) },
            overflow: document.documentElement.scrollWidth - innerWidth, capture: GaiaMapObservationAdapter.captureObservation() };
        });
        assert.equal(scan.data.selectionLabelPrimary, "日本");
        assert(scan.data.selectionLabelSecondary.includes(source.population.toLocaleString("en-US")));
        assert(scan.data.selectionLabelDetail.includes("1999"));
        assert(scan.draw, "Expected actual Canvas observation-card fill");
        assert.equal(scan.draw.style, before ? "rgba(5, 19, 26, 0.95)" : "rgba(5, 19, 26, 0.8)");
        assert.equal(scan.draw.alpha, 1, "Do not fade the entire card and its text");
        const first = [0, 1, 2].map(index => scan.lines.find(line => line.index === index));
        if (!before) {
          assert(first[0].left < first[1].left, "Country and value must be side by side");
          if (width >= 900) assert(first[1].left < first[2].left, "Source/year must form the third column");
          for (const line of scan.lines) assert(line.width <= line.columnWidth + 1, "Column text must fit without horizontal squeezing");
          const drawn = first.map(line => scan.draw.text.find(item => item.text === line.text));
          assert(drawn.every(Boolean));
          assert(drawn[0].x < drawn[1].x, "Actual Canvas drawing must follow the horizontal layout");
          assert(drawn.every(item => item.alpha === 1 && !item.squeezed));
        } else assert.equal(new Set(scan.draw.text.slice(0, scan.lines.length).map(line => line.x)).size, 1, "Reproduce the original vertical label");
        assert(scan.card.x >= 0 && scan.card.x + scan.card.width <= width + 1 && scan.card.y >= 0 && scan.card.y + scan.card.height <= height + 1);
        assert.equal(scan.overflow, 0);
        report.checks.push({ width, year, ...scan });
        await page.screenshot({ path: path.join(output, `${width}-selection-screen.png`) });
        await page.screenshot({ path: path.join(output, `${width}-selection.png`), clip: scan.card });
      } else if (width >= 900) {
        const point = await page.evaluate(row => {
          const d = document.querySelector("#japan-overlay").dataset, r = document.querySelector("#japan-map").getBoundingClientRect();
          const scale = r.width / 360 * Number(d.earthZoom);
          return { x: r.left + r.width / 2 + Number(d.earthOffsetX) + (((row.lon - Number(d.earthCenterLongitude) + 540) % 360) - 180) * scale,
            y: r.top + r.height / 2 + Number(d.earthOffsetY) - row.lat * scale };
        }, source);
        await page.mouse.move(point.x, point.y);
        await page.waitForFunction(() => {
          const preview = document.querySelector("#japan-poi-preview");
          return preview.getAttribute("aria-hidden") === "false" && getComputedStyle(preview).opacity === "1";
        });
        // The existing glint and scale entrance can temporarily enlarge the
        // scrollable visual overflow; inspect the settled card's real bounds.
        await page.locator("#japan-poi-preview").evaluate(async node => {
          await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
        });
        const hover = await page.locator("#japan-poi-preview").evaluate(node => {
          const style = getComputedStyle(node);
          return { rect: node.getBoundingClientRect().toJSON(), background: style.backgroundImage, opacity: style.opacity,
            // The clipped, invisible ::before glint ends beyond the right edge.
            // Check actual text fields rather than counting that decoration.
            fields: ["title", "meta", "action"].map(part => { const el = node.querySelector(`.japan-poi-preview-${part}`); return { text: el.textContent, overflow: el.scrollWidth - el.clientWidth, rect: el.getBoundingClientRect().toJSON() }; }) };
        });
        assert.equal(hover.fields[0].text, "インド");
        assert(hover.fields[1].text.includes(source.population.toLocaleString("en-US")) && hover.fields[1].text.includes("1973"));
        if (before) assert(hover.fields[1].rect.y > hover.fields[0].rect.y, "Reproduce the original stacked hover preview");
        else {
          assert(hover.fields[0].rect.right <= hover.fields[1].rect.left && hover.fields[1].rect.right <= hover.fields[2].rect.left, "Hover columns must be horizontal");
          assert(hover.background.includes("0.8") && !hover.background.includes("0.9"));
          assert.equal(hover.opacity, "1");
        }
        assert(hover.rect.left >= 0 && hover.rect.right <= width + 1 && hover.rect.top >= 0 && hover.rect.bottom <= height + 1, JSON.stringify(hover));
        assert(hover.fields.every(field => field.overflow <= 1 && field.rect.left >= hover.rect.left && field.rect.right <= hover.rect.right && field.rect.top >= hover.rect.top && field.rect.bottom <= hover.rect.bottom), "Visible text must fit the hover card");
        await page.locator("#japan-poi-preview").screenshot({ path: path.join(output, `${width}-hover.png`) });
        await page.screenshot({ path: path.join(output, `${width}-hover-screen.png`) });
        await page.mouse.click(point.x, point.y);
        await page.locator("#japan-poi-card").waitFor({ state: "visible" });
        assert((await page.locator("#japan-poi-meta").textContent()).includes(source.population.toLocaleString("en-US")));
        assert.equal(await page.locator("#japan-poi-preview").getAttribute("aria-hidden"), "true");
        await page.locator("#japan-poi-close").click();
        await page.mouse.move(1, 1);
        assert.equal(await page.locator("#japan-poi-preview").getAttribute("aria-hidden"), "true");
        report.checks.push({ width, year, source, hover, workflow: "hover -> click details -> close -> leave" });
      } else assert.equal(await page.locator("#japan-poi-preview").evaluate(node => getComputedStyle(node).display), "none", "Touch must not show a stuck mouse tooltip");
    }
    if (width < 600) assert.equal(await page.locator("#japan-poi-preview").evaluate(node => getComputedStyle(node).display), "none", "Touch must not show a stuck mouse tooltip");
    console.log(`PASS ${width}: ${before ? "original symptom reproduced" : "80% background, inline fields, source values and interaction"}`);
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

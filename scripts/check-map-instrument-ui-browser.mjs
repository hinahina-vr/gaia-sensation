import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4173";
const output = path.resolve("artifacts/map-instrument-ui");
const baseline = process.argv.includes("--baseline");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results = [], errors = [];
try {
  for (const [width, height] of [[1440, 900], [3840, 2088], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/?mode=2&preview=map-instruments#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelector("#japan-overlay").dataset.quantitativeLegendId === "ocean-current-speed");
    await page.waitForTimeout(600);
    if (!baseline) await page.waitForFunction(() => document.querySelector("#gaia-canvas").dataset.currentWeaveState === "ready", null, { timeout: 30000 });
    const audio = await page.locator("#gaia-audio-dock").evaluate(element => [element, ...element.querySelectorAll("*")].map(el => {
      const c = getComputedStyle(el);
      return { tag: el.tagName, id: el.id, rect: el.getBoundingClientRect().toJSON(), style: Object.fromEntries([
        "width", "height", "border", "borderRadius", "background", "color", "boxShadow", "padding", "fontSize", "transform",
      ].map(key => [key, c[key]])) };
    }));
    const audioPath = path.join(output, `audio-baseline-${width}.json`);
    if (baseline) fs.writeFileSync(audioPath, JSON.stringify(audio, null, 2));
    else assert.deepEqual(audio, JSON.parse(fs.readFileSync(audioPath)), "Volume control geometry and design must remain unchanged");
    const point = await page.evaluate(async () => {
      const mode = (await fetch("/data/gaia-signals.json").then(r => r.json())).modes.find(m => m.id === "blue-circulation");
      const rect = document.querySelector("#japan-map").getBoundingClientRect();
      const d = document.querySelector("#japan-overlay").dataset;
      const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * +d.earthZoom;
      for (const row of mode.signals.currents) {
        const x = rect.left + (rect.width - 360 * scale) / 2 + +d.earthOffsetX + ((row.lon - Number(d.earthCenterLongitude) + 540) % 360) * scale;
        const y = rect.top + (rect.height - 180 * scale) / 2 + +d.earthOffsetY + (90 - row.lat) * scale;
        if (x < 60 || x > innerWidth - 100 || y < 270 || y > innerHeight - 180) continue;
        if (document.elementFromPoint(x, y)?.closest("#japan-map")) return { x, y };
      }
    });
    assert.ok(point, "An uncovered ocean observation is available");
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => !document.querySelector("#japan-poi-card").hidden);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(output, `${baseline ? "before" : "after"}-${width}.png`) });
    const scan = await page.evaluate(() => {
      const card = document.querySelector("#japan-poi-card");
      const legend = document.querySelector("#map-signal-encoding-legend-dock").getBoundingClientRect();
      const d = document.querySelector("#japan-overlay").dataset;
      return { width: innerWidth, card: card.getBoundingClientRect().toJSON(), cardOverflow: card.scrollWidth - card.clientWidth,
        meta: document.querySelector("#japan-poi-meta").textContent, facts: card.querySelectorAll(".japan-poi-fact").length,
        dockTop: document.querySelector(".map-command-dock").getBoundingClientRect().top,
        source: document.querySelector("#japan-poi-source").href, legend: legend.toJSON(),
        scaleLeft: +d.auxiliaryPanelScreenLeft, scaleRight: +d.auxiliaryPanelScreenRight,
        overflow: document.documentElement.scrollWidth - innerWidth,
        zoom: [...document.querySelectorAll("#gaia-map-zoom-controls button")].map(e => ({ svg: !!e.querySelector("svg"), rect: e.getBoundingClientRect().toJSON() })) };
    });
    if (!baseline) {
      assert.ok(scan.facts >= 3 && /m\/s/.test(scan.meta));
      assert.equal(scan.cardOverflow, 0);
      assert.equal(scan.overflow, 0);
      assert.ok(scan.card.x >= 0 && scan.card.right <= width + 1);
      assert.ok(scan.zoom.every(z => z.svg && z.rect.height >= 44 && z.rect.width >= 44));
      assert.match(scan.source, /^https:\/\//);
      if (width > 900) {
        assert.ok(Math.abs(scan.legend.left - scan.scaleLeft) < 2);
        assert.ok(Math.abs(scan.legend.right - scan.scaleRight) < 2);
        assert.ok(scan.card.bottom < scan.dockTop, "POI details must not sit underneath the bottom toolbar");
      }
      await page.locator("#japan-poi-close").click();
      assert.equal(await page.locator("#japan-poi-card").isVisible(), false);
      const zoom = +(await page.locator("#gaia-map-zoom-controls").getAttribute("data-zoom"));
      await page.locator("#gaia-map-zoom-in").focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      assert.ok(+(await page.locator("#gaia-map-zoom-controls").getAttribute("data-zoom")) > zoom);
      await page.locator("#gaia-map-zoom-reset").click();
      await page.waitForTimeout(200);
      assert.ok(+(await page.locator("#gaia-map-zoom-controls").getAttribute("data-zoom")) < zoom);
      await page.locator('[data-gaia-mode-guide-replay="map"]').click();
      await page.locator(".gaia-mode-entry-guide-card").waitFor({ state: "visible" });
    }
    results.push(scan);
    await context.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, baseline ? "before.json" : "report.json"), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ status: "passed", baseline, widths: results.map(r => r.width) }));
} finally { await browser.close(); }

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/movable-legends");
const widths = (process.argv[4] || "1440,3840,390,320").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 2, `${message}: ${actual} vs ${expected}`);
try {
  for (const width of widths) {
    const mobile = width < 901, height = width === 3840 ? 2088 : mobile ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?mode=8&preview=legend-drag#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapLegendDrag && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop();
      GaiaMapObservationAdapter.selectMode(2);
    });
    if (mobile) {
      // Mobile uses its bottom console and reading sheet, not the retired
      // draggable canvas metric card from the desktop layout.
      await page.waitForFunction(() => GaiaMobileMap.isActive() && document.querySelector('#japan-overlay').dataset.plotRevealState === 'complete');
      assert.equal(await page.locator('.map-metric-drag-handle').isVisible(), false);
      await page.locator('[data-mobile-sheet="reading"]').click();
      await page.locator('#map-mobile-sheet').waitFor({ state: 'visible' });
      assert.match(await page.locator('#map-mobile-sheet').innerText(), /降水量/u);
      assert.equal(await page.locator('#map-mobile-sheet .map-mobile-metric-scale').count(), 1);
      await page.screenshot({ path: path.join(output, `${width}-reading.jpg`), type: 'jpeg', quality: 88 });
      await page.locator('[data-mobile-sheet-close]').click();
      await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lon: 135, lat: 20, zoom: 2, durationMs: 0 }));
      await page.waitForTimeout(150);
      const beforePan = await page.locator('#japan-overlay').getAttribute('data-earth-offset-x');
      await page.mouse.move(width * .3, height * .5); await page.mouse.down();
      await page.mouse.move(width * .3 + 35, height * .5 - 25, { steps: 8 }); await page.mouse.up();
      await page.waitForTimeout(150);
      assert.notEqual(await page.locator('#japan-overlay').getAttribute('data-earth-offset-x'), beforePan);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      report.checks.push({ width, layout: 'mobile console and reading sheet; desktop draggable metric hidden', pan: true });
      console.log(`PASS ${width}: mobile metric, reading sheet, map pan and no desktop hit-surface overlap`);
      await context.close();
      continue;
    }
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.quantitativeLegendId === "precipitation"
      && document.querySelector("#japan-overlay").dataset.plotRevealState === "complete"
      && !document.querySelector(".map-metric-drag-handle").hidden);
    const metric = page.locator(".map-metric-drag-handle");
    const legend = page.locator("#map-signal-encoding-legend-dock");
    const camera = () => page.locator("#japan-overlay").evaluate(node => ({ x: node.dataset.earthOffsetX, y: node.dataset.earthOffsetY, zoom: node.dataset.earthZoom }));
    const read = () => page.locator("#japan-overlay").evaluate(node => ({ value: node.dataset.quantitativeLegendCurrent,
      x: Number(node.dataset.auxiliaryPanelScreenLeft), y: Number(node.dataset.auxiliaryPanelScreenTop),
      width: Number(node.dataset.auxiliaryPanelScreenRight) - Number(node.dataset.auxiliaryPanelScreenLeft),
      height: Number(node.dataset.auxiliaryPanelScreenBottom) - Number(node.dataset.auxiliaryPanelScreenTop) }));
    const drag = async (target, dx, dy, touch = false) => {
      const box = await target.boundingBox(), x = box.x + 28, y = box.y + 22;
      if (touch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * step / 12, y: y + dy * step / 12 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
      }
      await page.waitForTimeout(180);
    };
    const initialCamera = await camera(), initialMetric = await read();
    if (mobile) await page.locator("#map-mobile-legend-toggle").click();
    await legend.waitFor({ state: "visible" });
    const initialLegend = await legend.boundingBox();
    const dx = mobile ? 0 : -250, dy = mobile ? 110 : 150;
    await drag(legend, dx, dy, mobile);
    const movedLegend = await legend.boundingBox();
    close(movedLegend.x, initialLegend.x + dx, "legend drag x");
    close(movedLegend.y, initialLegend.y + dy, "legend drag y");
    assert.deepEqual(await camera(), initialCamera, "Legend drag must not pan the map");
    if (!mobile) {
      const guide = page.locator('[data-gaia-mode-guide-replay="map"]');
      assert.equal(await guide.evaluate(node => node.parentElement.id), "map-signal-encoding-legend-dock");
      await guide.click();
      assert.equal(await page.evaluate(() => GaiaModeEntryGuide.getState().active), true);
      await page.evaluate(() => GaiaModeEntryGuide.close("map", { restoreFocus: false }));
    } else {
      await page.locator("#map-mobile-legend-toggle").click();
      await page.waitForFunction(y => Math.abs(Number(document.querySelector("#japan-overlay").dataset.auxiliaryPanelScreenTop) - y) < 2, initialMetric.y);
    }
    const metricBefore = await metric.boundingBox();
    await drag(metric, mobile ? -35 : -240, mobile ? 130 : 150, mobile);
    const metricAfter = await metric.boundingBox(), canvasAfter = await read();
    close(metricAfter.x, metricBefore.x + (mobile ? -35 : -240), "metric drag x");
    close(metricAfter.y, metricBefore.y + (mobile ? 130 : 150), "metric drag y");
    close(canvasAfter.x, metricAfter.x, "canvas and hit surface x");
    close(canvasAfter.y, metricAfter.y, "canvas and hit surface y");
    assert.equal(canvasAfter.value, initialMetric.value, "Dragging preserves the reading");
    assert.deepEqual(await camera(), initialCamera, "Metric drag must not pan the map");
    await page.screenshot({ path: path.join(output, `${width}-moved.jpg`), type: "jpeg", quality: 88 });

    await metric.focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(100);
    close((await metric.boundingBox()).x, metricAfter.x + 8, "keyboard movement");
    const beforeCancel = await metric.boundingBox();
    await page.mouse.move(beforeCancel.x + 30, beforeCancel.y + 20); await page.mouse.down();
    await page.mouse.move(beforeCancel.x + 55, beforeCancel.y + 70, { steps: 5 });
    await page.keyboard.press("Escape"); await page.mouse.up(); await page.waitForTimeout(100);
    close((await metric.boundingBox()).x, beforeCancel.x, "Escape rolls back x");
    close((await metric.boundingBox()).y, beforeCancel.y, "Escape rolls back y");
    assert.equal(await page.locator("#japan-layer").getAttribute("aria-hidden"), "false");

    await drag(metric, -width, -height);
    const clamped = await metric.boundingBox();
    close(clamped.x, 8, "left edge guard"); close(clamped.y, 8, "top edge guard");
    await metric.press("Home"); await page.waitForTimeout(100);
    if (mobile) await page.locator("#map-mobile-legend-toggle").click();
    const movedBox = await legend.boundingBox();
    if (mobile) {
      await page.touchscreen.tap(movedBox.x + 25, movedBox.y + 22);
      await page.touchscreen.tap(movedBox.x + 25, movedBox.y + 22);
    } else await page.mouse.dblclick(movedBox.x + 25, movedBox.y + 22);
    await page.waitForTimeout(150);
    assert.equal(await legend.evaluate(node => node.classList.contains("is-user-positioned")), false);
    if (mobile) await page.locator("#map-mobile-legend-toggle").click();
    await page.waitForFunction(y => Math.abs(Number(document.querySelector("#japan-overlay").dataset.auxiliaryPanelScreenTop) - y) < 2, initialMetric.y);
    close((await read()).x, initialMetric.x, "metric reset x");
    close((await read()).y, initialMetric.y, "metric reset y");
    if (mobile) {
      await drag(metric, 0, 40, true);
      const box = await metric.boundingBox();
      await page.touchscreen.tap(box.x + 25, box.y + 22);
      await page.touchscreen.tap(box.x + 25, box.y + 22);
      await page.waitForFunction(y => Math.abs(Number(document.querySelector("#japan-overlay").dataset.auxiliaryPanelScreenTop) - y) < 2, initialMetric.y);
    }
    // The rest of the canvas still pans normally after releasing the cards.
    await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lon: 135, lat: 20, zoom: 2, durationMs: 0 }));
    await page.waitForTimeout(150);
    const mapBefore = await camera();
    await page.mouse.move(width * .3, height * .72); await page.mouse.down();
    await page.mouse.move(width * .3 + 45, height * .72 - 25, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(150);
    assert.notDeepEqual(await camera(), mapBefore, "Map drag remains available outside the panels");

    await page.evaluate(() => GaiaMapObservationAdapter.selectMode(7));
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.quantitativeLegendId === "renewable-electricity");
    await drag(metric, 0, 60, mobile);
    const energyMoved = await read();
    await page.evaluate(() => GaiaMapObservationAdapter.selectMode(2));
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.quantitativeLegendId === "precipitation");
    close((await read()).y, energyMoved.y, "position survives exhibit change");
    if (width === 1440) {
      await page.setViewportSize({ width: 901, height: 650 });
      await page.waitForTimeout(250);
      const box = await metric.boundingBox(), dock = await page.locator(".map-command-dock").boundingBox();
      assert(box.x >= 8 && box.x + box.width <= 893 && box.y + box.height <= dock.y - 7, "Resize keeps the card clear of the bottom controls");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => !document.body.classList.contains("map-grid-desktop"));
      await page.waitForFunction(() => GaiaMobileMap.isActive() && document.querySelector('.map-metric-drag-handle').hidden);
    }
    await page.evaluate(() => GaiaMapCategories.buttons().find(button => button.dataset.firmsExhibit).click());
    await page.waitForFunction(() => document.querySelector(".map-metric-drag-handle").hidden);
    assert.equal(await page.locator(".is-panel-dragging").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    report.checks.push({ width, initialLegend, movedLegend, initialMetric, metricAfter, clamped, energyMoved });
    console.log(`PASS ${width}: mouse/touch drag, independent canvas movement, guide click, keyboard, cancel, bounds, reset, exhibit cleanup`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 88 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

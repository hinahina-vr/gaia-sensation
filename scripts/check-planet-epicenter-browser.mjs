import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/planet-epicenter");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const now = Date.now();
const points = [
  { id: "smaller-first", lon: -72, lat: -30, magnitude: 3.1, depth: 18, label: "Small event", time: now - 300000 },
  { id: "strongest-event", lon: 169.2, lat: -19.8, magnitude: 6.2, depth: 32, label: "96 km ESE of Isangel, Vanuatu", time: now - 200000 },
  { id: "smaller-latest", lon: 143, lat: 39, magnitude: 4, depth: 27, label: "Latest, not strongest", time: now - 100000 },
];
const payload = { type: "FeatureCollection", metadata: { generated: now }, features: points.map(point => ({
  type: "Feature", id: point.id, geometry: { type: "Point", coordinates: [point.lon, point.lat, point.depth] },
  properties: { mag: point.magnitude, place: point.label, time: point.time },
})) };
const longName = "143 km southeast of the Loyalty Islands, southwest Pacific Ocean";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const reduced of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? "reduce" : "no-preference", hasTouch: reduced });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await context.route("https://earthquake.usgs.gov/**", async route => { await gate; await route.fulfill({ json: payload }); });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("popup", () => report.errors.push("Epicenter navigation opened an external page"));
    await page.goto(`${base}/?preview=epicenter#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaPlanetSignals && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    await page.evaluate(() => {
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      document.querySelector('[data-planet-exhibit="usgs-earthquake-ripples"]').click();
    });
    const button = page.locator("[data-planet-epicenter]");
    assert(await button.isDisabled());
    assert.equal(await page.locator("[data-planet-epicenter-name]").textContent(), "読み込み中");
    await button.evaluate(element => element.click());
    assert.equal(await page.locator("#gaia-planet-signals-canvas").getAttribute("data-planet-focused-epicenter"), null);
    release();
    await page.waitForFunction(() => !document.querySelector("[data-planet-epicenter]").disabled);
    for (const width of reduced ? [3840, 1920, 1440, 1280, 1121, 1024, 900, 768, 390, 320] : [1440]) {
      await page.setViewportSize({ width, height: width === 3840 ? 2088 : width < 901 ? 844 : 900 });
      for (const long of reduced ? [false, true] : [false]) {
        const currentPoints = points.map(point => ({ ...point, label: point.id === "strongest-event" && long ? longName : point.label }));
        await page.evaluate(points => {
          sessionStorage.setItem("gaia-planet-signals-v3:earthquake", JSON.stringify({ cachedAt: Date.now(), data: { observedAt: new Date().toISOString(), points } }));
          return GaiaPlanetSignals.select(2);
        }, currentPoints);
        await page.waitForFunction(() => !document.querySelector("[data-planet-epicenter]").disabled
          && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
        assert.equal(await page.locator("[data-planet-epicenter-name]").textContent(), long ? longName : points[1].label);
        const layout = await button.evaluate(button => {
          const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
          const name = button.querySelector("strong");
          const range = document.createRange(); range.selectNodeContents(name);
          const count = document.querySelector("[data-planet-secondary-a]");
          return { visible: button.checkVisibility(), button: rect(button), label: rect(button.querySelector("small")), name: rect(name), text: rect(range), count: rect(count),
            dock: rect(button.closest(".gaia-planet-signals-readout")),
            clipped: name.scrollHeight > name.clientHeight + 1 || name.scrollWidth > name.clientWidth + 1,
            hit: button.contains(document.elementFromPoint(button.getBoundingClientRect().left + button.clientWidth / 2, button.getBoundingClientRect().top + button.clientHeight / 2)) };
        });
        assert(layout.visible && layout.hit, `${width}/${long}: button is hidden/obscured`);
        assert(!layout.clipped, `${width}/${long}: label clipped`);
        assert(layout.text.left >= layout.name.left - 1 && layout.text.right <= layout.name.right + 1, `${width}/${long}: label outside name box`);
        assert(layout.text.top >= layout.dock.top && layout.text.bottom <= layout.dock.bottom - 1, `${width}/${long}: name cut by dock`);
        assert(layout.label.top >= layout.dock.top && layout.label.bottom <= layout.name.top, `${width}/${long}: label clipped/overlapping`);
        assert(layout.button.left >= layout.count.right, `${width}: count/name overlap`);
        assert(layout.button.height >= 44, `${width}: touch target too small`);
        if (long) { await button.focus(); await page.keyboard.press("Enter"); }
        else if (width < 901) await button.tap();
        else await button.click();
        await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewTarget === "planet-epicenter:strongest-event"
          && document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
        const focus = await page.evaluate(point => {
          const map = document.querySelector("#japan-map").getBoundingClientRect();
          const view = document.querySelector("#japan-overlay").dataset;
          const zoom = Number(view.earthZoom), scale = (map.width >= 901 ? map.width / 360 : Math.max(map.width / 360, map.height / 180)) * zoom;
          const x = map.left + (map.width - scale * 360) / 2 + Number(view.earthOffsetX) + ((point.lon - Number(view.earthCenterLongitude) + 540) % 360) * scale;
          const y = map.top + (map.height - scale * 180) / 2 + Number(view.earthOffsetY) + (90 - point.lat) * scale;
          const poi = GaiaPlanetSignals.findPoiAt(x, y, "mouse");
          return { zoom, x, y, id: poi?.record.id, focus: document.querySelector("#gaia-planet-signals-canvas").dataset.planetFocusedEpicenter,
            dockTop: document.querySelector(".gaia-planet-signals-readout").getBoundingClientRect().top };
        }, points[1]);
        assert(focus.zoom >= 3);
        assert.equal(focus.id, "strongest-event", "Navigation must match the displayed maximum, including early arrival");
        assert.equal(focus.focus, "strongest-event");
        assert(focus.x > 5 && focus.x < width - 5 && focus.y > 70 && focus.y < focus.dockTop, `${width}: focused quake is out of view`);
        report.checks.push({ width, reduced, long, layout, focus });
        if (!long && [3840, 1440, 390].includes(width)) {
          await page.screenshot({ path: path.join(output, `${width}-${reduced ? "reduced" : "animated"}-focused.jpg`), type: "jpeg", quality: 88 });
          await page.locator(".gaia-planet-metrics").screenshot({ path: path.join(output, `${width}-metrics.png`) });
        }
      }
      console.log(`PASS ${width}/${reduced ? "reduced" : "animated"}: full name, mouse/touch/keyboard, correct largest-event camera target`);
    }
    // Leaving 29 must remove both the action and its selected marker.
    await page.evaluate(() => document.querySelector('[data-planet-exhibit="global-cloud-radiance"]').click());
    assert(!await button.isVisible());
    assert.equal(await page.locator("#gaia-planet-signals-canvas").getAttribute("data-planet-focused-epicenter"), null);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }

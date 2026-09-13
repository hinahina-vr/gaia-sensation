import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/fixed-chapter-arrows");
const widths = (process.argv[4] || "1440,3840,1024").split(",").map(Number);
const defaultHeight = Number(process.argv[5] || 900);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const height = width === 3840 ? 2088 : defaultHeight;
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, route => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, () => ({ current: {
          time: "2026-09-05T05:30", wind_speed_10m: 7.2, wind_direction_10m: 124, surface_pressure: 1014,
          cloud_cover: 52, shortwave_radiation: 512, pm2_5: 10, aerosol_optical_depth: .18,
        } }));
        return route.fulfill({ json: count === 1 ? rows[0] : rows });
      });
    }
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=fixed-chapter-arrows#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    await page.waitForTimeout(1200);
    const selector = (n, direction) => n <= 9 ? `[data-map-dock-mode-step="${direction}"]`
      : n <= 15 ? `[data-live-deck-step="${direction}"]` : n <= 25 ? `[data-estat-step="${direction}"]`
        : n === 26 ? `[data-firms-step="${direction}"]` : `[data-planet-step="${direction}"]`;
    let dockGeometry;
    const measure = async n => {
      const dock = page.locator(n <= 9 ? ".map-command-dock" : n <= 15 ? ".gaia-live-exhibit-readout"
        : n <= 25 ? ".gaia-estat-readout" : n === 26 ? ".gaia-firms-readout" : ".gaia-planet-signals-readout");
      const rect = await dock.boundingBox();
      assert(rect, `MAP ${n}: dock must be visible`);
      dockGeometry ||= { y: rect.y, height: rect.height };
      assert(Math.abs(rect.y - dockGeometry.y) < .75 && Math.abs(rect.height - dockGeometry.height) < .75,
        `${width}px MAP ${n}: dock ${JSON.stringify(rect)} must match MAP01 ${JSON.stringify(dockGeometry)}`);
      if (n >= 10) {
        const fields = await dock.locator("[data-live-exhibit-value], [data-live-deck-step], [data-live-poi-step], [data-estat-value], [data-estat-month], [data-firms-primary], [data-firms-progress], [data-firms-play], [data-planet-primary], .gaia-map-action").evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => ({
          name: node.getAttributeNames().find(name => name.startsWith("data-")) || node.className,
          top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom,
        })));
        for (const field of fields) assert(field.top >= rect.y - 1 && field.bottom <= rect.y + rect.height + 1,
          `${width}px MAP ${n}: ${JSON.stringify(field)} overflows dock vertically`);
      }
      const targets = [];
      for (const direction of [-1, 1]) {
        const button = page.locator(selector(n, direction));
        const rect = await button.boundingBox();
        assert(rect, `MAP ${n} must have navigation targets`);
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const hittable = await button.evaluate((node, center) => node.contains(document.elementFromPoint(center.x, center.y)), center);
        assert(hittable, `MAP ${n}: arrow must receive the actual pointer at ${JSON.stringify(center)}`);
        targets.push({ ...center, width: rect.width, height: rect.height });
      }
      return targets;
    };
    const select = async n => {
      await page.evaluate(n => [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .find(button => button.textContent.trim() === String(n).padStart(2, "0")).click(), n);
      await page.waitForFunction(n => document.querySelector("#japan-mode-number").textContent === String(n).padStart(2, "0"), n);
    };
    await select(1);
    const anchors = await measure(1);
    // Keep the cursor stationary across different dock implementations. No
    // locator.click(): it would silently follow a moving target and mask the bug.
    for (const direction of [1, -1]) {
      let current = 1;
      const anchor = anchors[direction === 1 ? 1 : 0];
      for (let i = 0; i < 30; i++) {
        const targets = await measure(current);
        targets.forEach((target, index) => {
          assert(Math.abs(target.x - anchors[index].x) < .75 && Math.abs(target.y - anchors[index].y) < .75,
            `${width}px MAP ${current}: target moved from ${JSON.stringify(anchors[index])} to ${JSON.stringify(target)}`);
          assert.equal(target.width, 44); assert.equal(target.height, 48);
        });
        if (direction === 1 && [9, 10, 16, 26, 27].includes(current)) {
          await page.screenshot({ path: path.join(output, `${width}-${current}-dock.jpg`), type: "jpeg", quality: 85,
            clip: { x: 0, y: height - 200, width, height: 200 } });
        }
        await page.mouse.click(anchor.x, anchor.y);
        current = (current - 1 + direction + 30) % 30 + 1;
        await page.waitForFunction(n => document.querySelector("#japan-mode-number").textContent === String(n).padStart(2, "0"), current, { timeout: 10000 });
        await page.waitForTimeout(80);
      }
    }
    // Repeated title clicks still open the existing list, not the arrow.
    await select(23);
    await page.locator(".gaia-estat-selector-toggle").click();
    assert.equal(await page.locator(".gaia-estat-selector-toggle").getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
    assert.deepEqual(await measure(23), anchors, "Data/animation settling cannot move navigation");
    report.checks.push({ width, dock: dockGeometry, anchors, forward: 30, backward: 30, picker: true });
    console.log(`PASS ${width}px: identical 01–30 dock heights, values/actions inside dock, fixed arrows, loading, title picker`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

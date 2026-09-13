import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/unified-exhibit-picker");
const widths = (process.argv[4] || "1440,3840,901,768,390,320").split(",").map(Number);
const modes = process.argv[5]?.split(",").map(Number) || Array.from({ length: 30 }, (_, index) => index + 1);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const height = width >= 2400 ? 2088 : width < 600 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, route => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, () => ({ current: { time: "2026-09-06T00:00", wind_speed_10m: 5,
          wind_direction_10m: 80, surface_pressure: 1005, cloud_cover: 58, shortwave_radiation: 194, pm2_5: 9.9, aerosol_optical_depth: .18 } }));
        return route.fulfill({ json: count === 1 ? rows[0] : rows });
      });
    }
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?preview=unified-picker#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
    });
    const settled = () => page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const trigger = () => page.locator('[data-map-bank-toggle]:visible').first();
    const opener = async () => await trigger().count() ? trigger()
      : page.locator(width > 900 ? ".map-dock-bank-trigger" : "#map-mobile-bank-toggle");
    const modeButton = number => page.locator('.map-category-group .map-mode-button').filter({ hasText: new RegExp(`^${String(number).padStart(2, "0")}$`) });
    let reference;
    for (const number of modes) {
      await settled();
      await page.waitForFunction(number => Number(document.querySelector('#japan-mode-number').textContent) === number, number);
      await (await opener()).click();
      await page.waitForTimeout(100);
      const scan = await page.evaluate(() => {
        const popover = document.querySelector('.map-dock-bank-popover');
        const visible = element => {
          const r = element.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(element).visibility !== "hidden";
        };
        const buttons = GaiaMapCategories.buttons();
        const style = getComputedStyle(buttons.find(button => button.getAttribute('aria-current') !== 'true'));
        return { count: buttons.length, visible: buttons.every(visible), legacyCount: document.querySelectorAll('.gaia-live-deck-modes').length,
          groups: [...document.querySelectorAll('.map-category-group')].map(group => ({ label: group.querySelector('strong').textContent,
            numbers: [...group.querySelectorAll('.map-mode-button')].map(button => Number(button.textContent)) })),
          selected: buttons.filter(button => button.getAttribute('aria-current') === 'true').map(button => Number(button.textContent)),
          rect: popover.getBoundingClientRect().toJSON(), palette: [style.color, style.backgroundColor, style.borderColor, style.borderRadius],
          overflow: document.documentElement.scrollWidth - innerWidth };
      });
      report.checks.push({ width, number, ...scan });
      assert.equal(scan.count, 30); assert.equal(scan.legacyCount, 0); assert(scan.visible, `${width}/${number}: shared picker hidden`);
      assert.equal(scan.groups.length, 7); assert.deepEqual(scan.selected, [number]); assert.equal(scan.overflow, 0);
      reference ||= scan;
      assert.deepEqual(scan.groups, reference.groups, `${width}/${number}: category order differs`);
      assert.deepEqual(scan.palette, reference.palette, `${width}/${number}: menu appearance differs`);
      if (width > 900) {
        assert.equal(scan.rect.width, reference.rect.width, `${width}/${number}: menu width differs`);
        assert(scan.rect.y >= 0 && scan.rect.bottom <= height, `${width}/${number}: picker outside screen`);
      }
      // The same focus-driven description card is available from every renderer.
      await page.keyboard.press("Tab");
      await modeButton(number).scrollIntoViewIfNeeded();
      await modeButton(number).focus();
      await page.waitForFunction(number => document.querySelector('#map-mode-preview').getAttribute('aria-hidden') === 'false'
        && document.querySelector('#map-mode-preview-number').textContent.startsWith(`${String(number).padStart(2, "0")} /`), number);
      if ([1, 6, 15, 21].includes(number)) {
        await page.screenshot({ path: path.join(output, `${width}-${number}-menu.jpg`), type: "jpeg", quality: 85 });
        // Escape closes the menu, keeps the map open and restores its visible entry.
        await page.keyboard.press("Escape");
        assert.equal(await (await opener()).getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#japan-layer').getAttribute('aria-hidden'), 'false');
        assert(await (await opener()).evaluate(node => node === document.activeElement), `${width}/${number}: focus not restored`);
        await (await opener()).click();
      }
      const next = modes[(modes.indexOf(number) + 1) % modes.length];
      await modeButton(next).click();
      await page.waitForFunction(number => Number(document.querySelector('#japan-mode-number').textContent) === number, next);
      assert.equal(await page.locator(width > 900 ? '.map-dock-bank-trigger' : '#map-mobile-bank-toggle').getAttribute('aria-expanded'), 'false');
    }
    console.log(`PASS ${width}: ${modes.length} modes open one 30-item category picker; previews, selection, Escape/focus and routing intact`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 85 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

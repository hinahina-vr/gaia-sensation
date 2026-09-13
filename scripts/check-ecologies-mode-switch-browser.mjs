import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve(process.argv[3] || "artifacts/ecologies-mode-switch");
const requested = process.argv[4]?.split(",") || ["1440"];
const stressRounds = Number(process.argv[5] || 0);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", base, stressRounds, checks: [], actions: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const snapshot = () => page.evaluate(() => ({
  title: document.querySelector("#japan-mode-title")?.textContent,
  number: document.querySelector("#japan-mode-number")?.textContent,
  state: globalThis.GaiaMapObservationAdapter?.getState(),
  panelHidden: document.querySelector("#ecologies-exhibit")?.hidden,
  layer: document.querySelector("#japan-layer")?.className,
  overlay: { ...document.querySelector("#japan-overlay")?.dataset },
}));
try {
  for (const width of requested.map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : width === 3840 ? 2088 : width === 2560 ? 1392 : 900 }, deviceScaleFactor: width === 2560 ? 1.5 : 1 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => { report.errors.push(`${width}: ${error.stack}`); console.error(error.stack); });
    await page.goto(`${base}/?preview=ecologies-switch#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop();
      document.querySelector('.map-mode-bank [data-map-standard-index="6"]').click();
    });
    await page.waitForFunction(() => !document.querySelector("#ecologies-exhibit").hidden && document.querySelector("#japan-overlay").dataset.plotRevealState === "complete");
    await page.waitForTimeout(2200);
    if (width <= 900) await page.locator('.map-mobile-ecology-summary button').click();
    for (const country of ['IRQ', 'RUS', 'HUN']) {
      await page.locator('#ecologies-exhibit .eco-country').selectOption(country);
      await page.waitForTimeout(50);
    }
    const countryOptions = await page.locator('#ecologies-exhibit .eco-country option').evaluateAll(options => options.map(option => option.value));
    for (let round = 0; round < stressRounds; round++) {
      const country = countryOptions[(round * 73 + 19) % countryOptions.length];
      report.actions.push({ width, round, country });
      await page.locator('#ecologies-exhibit .eco-country').click();
      await page.keyboard.press('Home');
      for (let step = 0; step <= round % 7; step++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.locator('#ecologies-exhibit .eco-country').selectOption(country);
      await page.locator('#ecologies-exhibit .eco-play').click();
      await page.locator('#ecologies-exhibit [data-eco-view="pattern"]').click();
      await page.locator(`#ecologies-exhibit [data-eco-country="${countryOptions[(round * 17) % countryOptions.length]}"]`).press('Enter');
      await page.locator('#ecologies-exhibit .eco-country').selectOption(countryOptions[(round * 31) % countryOptions.length]);
      await page.locator('#ecologies-exhibit [data-eco-view="culture"]').click();
      await page.locator('#ecologies-exhibit .eco-site').selectOption(String(round % 24));
      await page.locator('#ecologies-exhibit [data-eco-view="compare"]').click();
      await page.locator('#ecologies-exhibit .eco-country').selectOption(countryOptions[(round * 41) % countryOptions.length]);
      if (width > 900 && round % 5 === 4) {
        await page.locator('[data-map-dock-mode-step="1"]').click();
        await page.waitForFunction(() => document.querySelector('#ecologies-exhibit').hidden);
        await page.locator('[data-map-dock-mode-step="-1"]').click();
        await page.waitForFunction(() => !document.querySelector('#ecologies-exhibit').hidden && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
      }
      if (report.errors.length) throw new Error(`Page error after stress round ${round}`);
      if (round % 5 === 0) console.log(`${width} stress round ${round + 1}/${stressRounds}`);
    }
    const before = await snapshot();
    console.log(`${width} BEFORE: mode ${before.number}, panel hidden ${before.panelHidden}`);
    if (!stressRounds) await page.screenshot({ path: path.join(output, `${width}-before.jpg`), type: "jpeg", quality: 90 });
    if (width <= 900) {
      await page.locator('[data-mobile-sheet-close]').click();
      await page.locator('[data-mobile-sheet="exhibits"]').click();
      await page.locator('[data-mobile-exhibit="13"]').click();
    } else {
      await page.locator('[data-map-dock-mode-step="1"]').click();
    }
    await page.waitForTimeout(4200);
    const after = await snapshot();
    report.checks.push({ width, before, after });
    console.log(`${width} AFTER: mode ${after.number}, panel hidden ${after.panelHidden}, renewable ${after.overlay.renewableSelectedIso3}`);
    await page.screenshot({ path: path.join(output, `${width}-after.jpg`), type: "jpeg", quality: 90 });
    assert.equal(after.number, "13");
    assert.equal(after.panelHidden, true, "MAP 13 must not retain the MAP 12 right panel");
    assert(!after.layer.includes("is-ecologies-exhibit"));
    assert(after.overlay.renewableSelectedIso3, "MAP 13 must render its renewable energy data");
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  report.lastState = await snapshot().catch(() => null);
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 90 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

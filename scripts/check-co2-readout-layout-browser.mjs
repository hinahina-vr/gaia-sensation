import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/co2-readout-layout");
const widths = (process.argv[4] || "1440,3840,1024,901,768,390,320").split(",").map(Number);
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
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?mode=1&preview=co2-readout-layout#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapCategories?.buttons().length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
    });
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    for (const position of [0, 25, 70, 100]) {
      // Use the real timeline control, including its refresh and manual-pause path.
      await page.locator('.signal-console-map [data-signal-time]').evaluate((input, value) => {
        input.value = String(value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, position);
      await page.waitForFunction(() => document.querySelector('.signal-console-map .signal-value-details')?.children.length === 2);
      const scan = await page.locator('.signal-console-map .signal-console-heading').evaluate(heading => {
        const value = heading.querySelector("[data-signal-value]");
        const range = document.createRange();
        const cells = [...value.querySelectorAll(".signal-value-primary, .signal-value-details > span")].map(item => {
          range.selectNodeContents(item);
          return { text: item.textContent, rect: item.getBoundingClientRect().toJSON(), glyphs: range.getBoundingClientRect().toJSON(), font: getComputedStyle(item).fontSize };
        });
        const dock = document.querySelector(".map-command-dock");
        range.selectNodeContents(heading.querySelector("[data-signal-act]"));
        const act = range.getBoundingClientRect().toJSON();
        return { label: value.getAttribute("aria-label"), phase: document.querySelector("#co2-timeline-display").dataset.phase,
          act,
          heading: heading.getBoundingClientRect().toJSON(), value: value.getBoundingClientRect().toJSON(),
          dock: dock.getBoundingClientRect().toJSON(), time: heading.nextElementSibling.getBoundingClientRect().toJSON(),
          ellipsis: getComputedStyle(value).textOverflow, cells, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      report.checks.push({ width, position, ...scan });
      assert.equal(scan.cells.length, 3);
      assert.match(scan.cells[0].text, /^\d+\.\d ppm$/u);
      assert.equal(scan.ellipsis, "clip");
      assert.equal(scan.overflow, 0);
      assert(scan.act.x >= scan.heading.x - 1 && scan.act.right <= scan.heading.right + 1, `${width}: act label is clipped`);
      if (position === 100) {
        assert.equal(scan.cells[1].text, "予想の幅");
        assert.match(scan.cells[2].text, /^\d+\.\d–\d+\.\d$/u);
      } else {
        assert.match(scan.cells[1].text, /^実測 \d+$/u);
        assert.match(scan.cells[2].text, /^\+ 補完 \d+$/u);
      }
      for (const { text, rect, glyphs } of scan.cells) {
        assert(scan.label.includes(text), `${width}/${position}: a number differs from the original readout`);
        assert(glyphs.width <= rect.width + 1, `${width}/${position}: clipped glyphs in ${text}`);
        assert(glyphs.x >= scan.heading.x - 1 && glyphs.right <= scan.heading.right + 1, `${width}/${position}: count escapes the heading ${JSON.stringify(scan)}`);
        assert(glyphs.y >= scan.heading.y - 1 && glyphs.bottom <= scan.heading.bottom + 1, `${width}/${position}: vertical clipping`);
      }
      if (width > 900) {
        assert(scan.heading.right <= scan.time.x + 1, "Readout overlaps the timeline");
        assert(scan.value.y >= scan.dock.y && scan.value.bottom <= scan.dock.bottom, `${width}: readout overflows the fixed dock`);
      }
      if ([25, 100].includes(position)) {
        await page.locator('.signal-console-map .signal-console-heading').screenshot({ path: path.join(output, `${width}-${position}-readout.png`) });
        if (position === 25) await page.screenshot({ path: path.join(output, `${width}-screen.jpg`), type: "jpeg", quality: 85 });
      }
    }
    await page.evaluate(() => GaiaMapObservationAdapter.selectMode(1));
    assert.equal(await page.locator('.signal-console-map .has-breakdown').count(), 0, "CO₂ breakdown must not leak into another exhibit");
    assert.equal(await page.locator('.signal-console-map .signal-value-details').count(), 0);
    console.log(`PASS ${width}: concentration, measured/imputed counts and forecast range fully visible; fixed dock and next exhibit intact`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 85 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

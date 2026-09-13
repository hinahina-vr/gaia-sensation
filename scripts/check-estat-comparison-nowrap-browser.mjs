import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/estat-comparison-nowrap");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [3840, 1920, 1501, 1440, 1280, 1101, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width > 900 ? 900 : 844 }, reducedMotion: "reduce" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?preview=estat-comparison-nowrap#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && Boolean(globalThis.GaiaEstatExhibits));
    await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    const result = await page.evaluate(async () => {
      const measurements = [];
      const failures = [];
      for (let index = 0; index < GaiaEstatExhibits.definitions.length; index += 1) {
        await GaiaEstatExhibits.select(index);
        await document.fonts.ready;
        const card = document.querySelector(".gaia-estat-readout");
        const comparison = card.querySelector(".gaia-estat-comparison");
        for (const period of [0, Number(card.dataset.estatPeriodCount) - 1]) {
          GaiaEstatExhibits.setPeriod(period);
          for (const prefecture of [0, 12, 23, 26, 46]) {
            GaiaEstatExhibits.selectPrefecture(prefecture);
            const visible = comparison.getBoundingClientRect().width > 0;
            if (!visible) continue;
            const spans = [...comparison.children];
            const labels = spans.map(span => {
              const range = document.createRange(); range.selectNode(span.firstChild);
              const box = range.getBoundingClientRect();
              return { text: span.firstChild.textContent, lines: range.getClientRects().length, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
            });
            const values = spans.map(span => {
              const value = span.querySelector("strong");
              const range = document.createRange(); range.selectNodeContents(value);
              const box = range.getBoundingClientRect();
              return { text: value.textContent, lines: range.getClientRects().length, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
            });
            const box = comparison.getBoundingClientRect();
            const timeline = card.querySelector(".gaia-estat-timeline").getBoundingClientRect();
            const next = comparison.nextElementSibling.getBoundingClientRect();
            const nextLeft = next.width ? next.left : card.querySelector(".gaia-estat-actions").getBoundingClientRect().left;
            const fits = labels.concat(values).every(row => row.lines === 1 && row.left >= box.left && row.right <= box.right + 1)
              && labels[0].right + 8 <= labels[1].left && values[0].right + 8 <= values[1].left
              && Math.abs(labels[0].top - labels[1].top) <= 1 && Math.abs(values[0].top - values[1].top) <= 1
              && box.left >= timeline.right - 1 && box.right <= nextLeft + 1
              && card.scrollWidth <= card.clientWidth + 1;
            if (!fits) failures.push({ exhibit: card.dataset.estatExhibit, period, prefecture, labels, values, comparison: { left: box.left, right: box.right }, nextLeft, overflow: card.scrollWidth - card.clientWidth });
            measurements.push({ exhibit: card.dataset.estatExhibit, period, prefecture, labels: labels.map(row => row.text), values: values.map(row => row.text) });
          }
        }
      }
      await GaiaEstatExhibits.select(7);
      GaiaEstatExhibits.setPeriod(Number(document.querySelector(".gaia-estat-readout").dataset.estatPeriodCount) - 1);
      GaiaEstatExhibits.selectPrefecture(23);
      return { measurements: measurements.length, failures, visible: document.querySelector(".gaia-estat-comparison").getBoundingClientRect().width > 0 };
    });
    assert.equal(result.failures.length, 0, `${width}: comparison wrap, misalignment or clipping: ${JSON.stringify(result.failures.slice(0, 2))}`);
    if (width > 1100) {
      const primary = await page.locator(".gaia-estat-primary").evaluate(node => {
        const measure = element => { const range = document.createRange(); range.selectNodeContents(element); const box = range.getBoundingClientRect(); return { lines: range.getClientRects().length, left: box.left, right: box.right }; };
        return { value: measure(node.querySelector("strong")), unit: measure(node.querySelector("span")), right: node.getBoundingClientRect().right };
      });
      assert(primary.unit.lines === 1 && primary.value.right <= primary.unit.left && primary.unit.right <= primary.right, `Primary unit was squeezed: ${JSON.stringify(primary)}`);
    }
    assert.equal(result.visible, width > 1100, "Existing compact-layout visibility changed");
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.screenshot({ path: path.join(output, `${width}-full.jpg`), type: "jpeg", quality: 90 });
    if (result.visible) await page.locator(".gaia-estat-comparison").screenshot({ path: path.join(output, `${width}-comparison.png`) });
    report.checks.push({ width, ...result });
    await context.close();
    console.log(`PASS ${width}: ${result.measurements} comparisons, single-line labels/values, aligned rows, no overlap`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.errors.push(error.stack || String(error)); process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {});
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

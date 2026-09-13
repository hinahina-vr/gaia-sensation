import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/annual-temperature-titles");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [3840, 1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width > 900 ? 900 : 844 }, reducedMotion: "reduce" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?preview=annual-temperature-titles#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && Boolean(globalThis.GaiaEstatExhibits));
    await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    for (const [number, title, key] of [[20, "日最高気温の年平均", "summerHigh"], [21, "日最低気温の年平均", "winterLow"]]) {
      await page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === number).click(), number);
      await page.waitForFunction(title => document.querySelector("#japan-title").textContent === title && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"), title);
      assert.equal(await page.locator("[data-estat-title]").textContent(), title);
      assert.equal(await page.locator("[data-estat-value-label]").textContent(), title);
      assert.match(await page.locator("[data-estat-guide]").textContent(), number === 20 ? /夏だけの平均.*ではなく.*年平均/ : /冬だけの平均.*ではなく.*年平均/);
      const metadata = await page.evaluate(key => {
        const definition = GaiaEstatExhibits.definitions.find(row => row.key === key);
        return { title: definition.shortTitle, frequency: definition.frequency, periods: document.querySelector(".gaia-estat-readout").dataset.estatPeriodCount };
      }, key);
      assert.equal(metadata.frequency, "年次");
      assert.equal(Number(metadata.periods), 71);
      const titles = await page.locator("#japan-title, [data-estat-title]").evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(node);
        const glyphs = range.getBoundingClientRect();
        return { text: node.textContent, visible: r.width > 0 && r.height > 0, x: r.x, right: r.right, y: r.y, bottom: r.bottom,
          textWidth: glyphs.width, width: r.width, textHeight: glyphs.height, height: r.height,
          clipsY: ["hidden", "clip"].includes(getComputedStyle(node).overflowY), glyphTop: glyphs.top, glyphBottom: glyphs.bottom };
      }));
      for (const box of titles.filter(box => box.visible)) {
        assert(box.x >= 0 && box.right <= width + 1 && box.y >= 0, JSON.stringify(box));
        assert(box.textWidth <= box.width + 1 && (!box.clipsY || box.textHeight <= box.height + 2), `Truncated title: ${JSON.stringify(box)}`);
        assert(box.glyphTop >= 0 && box.glyphBottom <= (width === 3840 ? 2088 : width > 900 ? 900 : 844), JSON.stringify(box));
      }
      if (width <= 900) {
        const compact = await page.locator(".gaia-estat-readout").evaluate(node => {
          const title = node.querySelector("[data-estat-title]");
          return { height: node.getBoundingClientRect().height, titleLines: title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight) };
        });
        assert(compact.height <= 300 && compact.titleLines <= 2.1, `Excessively tall mobile title: ${JSON.stringify(compact)}`);
      }
      const buttonLabel = await page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === number).getAttribute("aria-label"), number);
      assert(buttonLabel.includes(title));
      await page.screenshot({ path: path.join(output, `${width}-${number}.jpg`), type: "jpeg", quality: 90 });
      report.checks.push({ width, number, title, metadata, titles });
    }
    await context.close();
    console.log(`PASS ${width}: annual daily high/low titles, definitions, 71 years, labels fit`);
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

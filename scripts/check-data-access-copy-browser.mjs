import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/data-access-copy");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", viewports: [], pageErrors: [] };
const browser = await chromium.launch({
  executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    // This is a copy/layout check, not a live upstream availability test.
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin === new URL(base).origin) return route.continue();
      if (route.request().url().includes("/ovation_aurora_latest.json")) {
        return route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.pageErrors.push(error.message));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator("#gaia-opening-sound-off").click();
    await page.waitForFunction(() => !document.querySelector("#gaia-opening")?.classList.contains("is-preloading"));
    // Reduced motion goes straight to the menu; no skip button is needed.
    await page.locator("#gaia-opening-route-other").waitFor({ state: "visible" });
    await page.locator("#gaia-opening-route-other").evaluate(button => button.click());
    await page.waitForFunction(() => document.querySelector("#gaia-opening")?.hidden === true
      && document.querySelector("#intro-layer")?.hidden === false);
    const architecture = page.locator("#architecture-exhibit");
    const text = await architecture.innerText();
    assert(text.includes('SYSTEM ARCHITECTURE / システム構成'));
    assert(text.includes('DATA PIPELINE / データの流れ'));
    assert(!text.includes('応募レギュレーション'));
    for (const selector of ['.regulation-note', '.data-source-use', '.data-scene-readout']) {
      const borders = await page.locator(selector).evaluateAll(nodes => nodes.map(n => getComputedStyle(n).borderLeftWidth));
      assert(borders.length > 0 && borders.every(width => width === '0px'), `${selector}: decorative left rule remains`);
    }
    assert.doesNotMatch(text, /審査中は外部APIへ接続しない|表示中に外部APIへ接続しません|次の開発段階/u);
    for (const required of ["保存JSON ＋ API", "地図の観測展示", "登場人物の記録", "総務省統計局", "今後実装予定", "LIVE CACHE", "SAVED VALUES", "演出用サンプル", "NOAA SWPC", "USGS", "5分間", "15分"]) {
      assert(text.includes(required), `Missing public copy: ${required}`);
    }
    const scans = [];
    for (const [name, selector] of [["diagram", ".architecture-figure"], ["routes", "#architecture-data-policy"], ["cache", "#architecture-cache-guide"]]) {
      await page.locator(selector).evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.screenshot({ path: path.join(output, `${viewport.width}-${name}.png`) });
      const scan = await page.evaluate(selector => {
        const layer = document.querySelector("#intro-layer");
        const target = document.querySelector(selector);
        const bounds = target.getBoundingClientRect();
        const clipped = [...target.querySelectorAll("h3, strong, p, small")].filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.left < bounds.left - 1 || rect.right > bounds.right + 1
            || element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).display !== "inline";
        }).map(element => element.textContent.trim());
        return {
          layerOverflow: layer.scrollWidth - layer.clientWidth,
          pageOverflow: document.documentElement.scrollWidth - innerWidth,
          visible: bounds.width > 0 && bounds.top < innerHeight && bounds.bottom > 0,
          top: bounds.top,
          paragraphFontSize: Number.parseFloat(getComputedStyle(target.querySelector("p")).fontSize),
          clipped,
        };
      }, selector);
      assert.equal(scan.layerOverflow, 0);
      assert.equal(scan.pageOverflow, 0);
      assert.equal(scan.visible, true);
      assert(scan.top >= 80, `${viewport.width}/${name}: fixed title/audio controls cover the heading`);
      if (name !== "diagram") {
        const readable = await page.locator("#architecture-cache-guide p").first().evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
        assert(readable >= 14, `${viewport.width}/${name}: data policy copy is too small`);
      }
      assert.deepEqual(scan.clipped, [], `${viewport.width}/${name}: clipped copy`);
      scans.push({ name, ...scan });
    }
    report.viewports.push({ ...viewport, scans });
    await context.close();
  }
  assert.deepEqual(report.pageErrors, []);
  report.status = "passed";
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const browserPath = process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = (process.argv[3] || "http://127.0.0.1:4198").replace(/\/$/u, "");
const outputDir = path.resolve(process.argv[4] || "artifacts/map-poi-card-readability");
const ovationSnapshot = fs.readFileSync(path.resolve("data/ovation-aurora-snapshot.json"), "utf8");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const evidence = [];

try {
  for (const viewport of [{ name: "pc", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: ovationSnapshot,
    }));
    await page.goto(`${baseUrl}/?preview=readable-poi-card#earth`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter), null, { timeout: 30_000 });
    await page.evaluate(() => {
      location.hash = "#japan";
      globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
    });
    await page.waitForFunction(() => document.querySelector(".experience")?.classList.contains("japan-open"));
    await page.evaluate(() => {
      const card = document.querySelector("#japan-poi-card");
      card.hidden = false;
      card.setAttribute("aria-hidden", "false");
      card.style.left = "34px";
      card.style.top = "120px";
      document.querySelector("#japan-poi-type").textContent = "地球の一呼吸 / DATA POI";
      document.querySelector("#japan-poi-meta").textContent = "約 315.6 PPM / 1964 / DERIVED / 昔の記録から再現";
      const source = document.querySelector("#japan-poi-source");
      source.hidden = false;
      source.href = "https://example.com/source";
    });
    const metrics = await page.locator("#japan-poi-card").evaluate((card) => {
      const type = card.querySelector("#japan-poi-type");
      const meta = card.querySelector("#japan-poi-meta");
      const source = card.querySelector("#japan-poi-source");
      const close = card.querySelector("#japan-poi-close");
      return {
        card: card.getBoundingClientRect().toJSON(),
        typeFont: Number.parseFloat(getComputedStyle(type).fontSize),
        metaFont: Number.parseFloat(getComputedStyle(meta).fontSize),
        sourceFont: Number.parseFloat(getComputedStyle(source).fontSize),
        close: close.getBoundingClientRect().toJSON(),
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    assert.ok(metrics.typeFont >= 12, `${viewport.name}: POI type remains too small`);
    assert.ok(metrics.metaFont >= 16, `${viewport.name}: POI metadata remains too small`);
    assert.ok(metrics.sourceFont >= 15, `${viewport.name}: POI source action remains too small`);
    assert.ok(metrics.close.width >= 44 && metrics.close.height >= 44, `${viewport.name}: close control remains too small`);
    assert.ok(metrics.card.left >= 0 && metrics.card.right <= metrics.viewport.width, `${viewport.name}: card is horizontally clipped`);
    assert.ok(metrics.card.top >= 0 && metrics.card.bottom <= metrics.viewport.height, `${viewport.name}: card is vertically clipped`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`) });
    evidence.push({ viewport: viewport.name, ...metrics });
    await context.close();
  }
  console.log(JSON.stringify({ status: "passed", baseUrl, evidence }, null, 2));
} finally {
  await browser.close();
}

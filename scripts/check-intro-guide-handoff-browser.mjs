import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/intro-guide-handoff");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", phases: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.activeElement?.id === "gaia-opening-sound-on");
  await page.locator("#gaia-opening-sound-off").click();
  await page.locator("#gaia-opening-skip").click();
  await page.locator("#gaia-opening-route-other").click();
  await page.waitForFunction(() => document.querySelector("#intro-entry-guide")?.classList.contains("is-presented"));
  await page.waitForTimeout(1400);
  assert.equal(await page.evaluate(() => GaiaIntroEntryGuide.getState().target), "map");
  await page.locator("#intro-entry-guide").click({ position: { x: 8, y: 8 } });
  await page.waitForFunction(() => document.querySelector("#intro-entry-guide")?.classList.contains("is-presented"));
  const started = Date.now();
  for (const time of [120, 380, 1600]) {
    await page.waitForTimeout(Math.max(1, time - (Date.now() - started)));
    const phase = await page.evaluate(() => {
      const guide = document.querySelector("#intro-entry-guide");
      const surface = guide.querySelector(".intro-entry-guide-bubble .intro-entry-guide-surface");
      const echo = guide.querySelector(".intro-entry-guide-echo");
      return { target: GaiaIntroEntryGuide.getState().target, incoming: Number(getComputedStyle(surface).opacity),
        outgoing: echo ? Number(getComputedStyle(echo).opacity) : 0,
        previousImage: echo?.querySelector("img").getAttribute("src"),
        nextImage: guide.querySelector("[data-intro-entry-guide-preview]").getAttribute("src"),
      };
    });
    report.phases.push({ time, ...phase });
    await page.screenshot({ path: path.join(output, `map-to-sensor-${time}.png`) });
  }
  assert.equal(report.phases[0].target, "sensor");
  assert(report.phases[0].outgoing > 0);
  assert.match(report.phases[0].previousImage, /map\.jpg/u);
  assert.match(report.phases[0].nextImage, /sensor\.jpg/u);
  assert(report.phases[1].incoming > 0 && report.phases[1].incoming < 1);
  assert(report.phases[1].outgoing < report.phases[0].outgoing);
  assert.equal(report.phases[2].incoming, 1);
  assert.equal(report.phases[2].outgoing, 0);
  await page.close();

  const cold = await browser.newPage({ viewport: { width: 390, height: 844 } });
  cold.on("pageerror", error => report.errors.push(error.message));
  await cold.route(/\/assets\/guide-previews\/(character|sound)\.jpg/u, async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue();
  });
  await cold.goto(`${base}/#top`, { waitUntil: "domcontentloaded" });
  await cold.waitForFunction(() => Boolean(globalThis.GaiaIntroEntryGuide) && document.querySelector("#gaia-boot")?.hidden);
  await cold.evaluate(() => {
    GaiaIntroEntryGuide.open();
    const guide = document.querySelector("#intro-entry-guide");
    guide.click(); guide.click(); guide.click();
    GaiaIntroEntryGuide.close();
  });
  await cold.waitForTimeout(1500);
  assert(await cold.locator("#intro-entry-guide").evaluate(node => node.hidden && node.inert && !node.classList.contains("is-presented")));
  assert.equal(await cold.locator(".intro-entry-guide-echo").count(), 0);
  await cold.evaluate(() => GaiaIntroEntryGuide.open());
  await cold.waitForFunction(() => document.querySelector("#intro-entry-guide")?.classList.contains("is-presented"));
  assert.equal(await cold.evaluate(() => GaiaIntroEntryGuide.getState().index), 0);
  await cold.keyboard.press("Escape");
  await cold.close();
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log("PASS real opening-to-guide handoff, visible crossfade and delayed-image dismissal");
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

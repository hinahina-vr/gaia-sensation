import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/sensor-design");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", viewports, scans: [], consoleErrors: [], expectedAuth401: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of viewports) {
    await fetch(new URL("/__qa/reset", baseUrl), { method: "POST" });
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    const label = viewport.name;
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (text === "Failed to load resource: the server responded with a status of 401 (Unauthorized)") report.expectedAuth401.push(`${label}: session probe`);
      else report.consoleErrors.push(`${label}: ${text}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });

    await page.goto(new URL("/sensors/", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view='login']").waitFor({ state: "visible" });
    await page.waitForTimeout(750);
    const login = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const heading = document.querySelector(".sensor-login h1");
      const headingStyle = getComputedStyle(heading);
      const backStyle = getComputedStyle(document.querySelector(".sensor-home-back"));
      const navStyle = getComputedStyle(document.querySelector(".sensor-topbar nav a"));
      const buttonStyle = getComputedStyle(document.querySelector("#google-login"));
      const topbar = document.querySelector(".sensor-topbar").getBoundingClientRect();
      const audio = document.querySelector("#gaia-audio-dock").getBoundingClientRect();
      const nav = [...document.querySelectorAll(".sensor-topbar nav a")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent.trim(), left: rect.left, right: rect.right, height: rect.height };
      });
      const button = document.querySelector("#google-login").getBoundingClientRect();
      const view = document.querySelector("[data-view='login']");
      return {
        bodyFont: body.fontFamily,
        headingFont: headingStyle.fontFamily,
        backFont: backStyle.fontFamily,
        navFont: navStyle.fontFamily,
        buttonFont: buttonStyle.fontFamily,
        headingHeight: heading.getBoundingClientRect().height,
        animationName: getComputedStyle(view).animationName,
        topbar: { height: topbar.height },
        audio: { left: audio.left, right: audio.right, height: audio.height },
        nav,
        buttonHeight: button.height,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.match(login.bodyFont, /Arial Narrow/u);
    assert.match(login.headingFont, /Yu Mincho/u);
    assert.match(login.backFont, /Yu Mincho/u);
    assert.match(login.navFont, /Yu Mincho/u);
    assert.match(login.buttonFont, /Yu Mincho/u);
    assert.equal(login.animationName, "sensor-enter");
    assert(login.buttonHeight >= 44);
    assert(login.audio.height >= 44);
    assert(login.nav.every((item) => item.height >= 44));
    assert(login.nav.every((item) => item.left >= -1 && item.right <= viewport.width + 1));
    assert(login.audio.left >= -1 && login.audio.right <= viewport.width + 1);
    assert.equal(login.overflowX, false);
    if (viewport.width === 390) assert(login.headingHeight < 120);
    await page.screenshot({ path: path.join(outputDir, `${label}-login.png`), fullPage: true });

    await page.goto(new URL("/sensors/#map", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view='map']").waitFor({ state: "visible" });
    await page.locator(".sensor-map-marker").first().waitFor({ state: "visible" });
    await page.waitForTimeout(750);
    const publicMap = await page.evaluate(() => ({
      headingFont: getComputedStyle(document.querySelector(".sensor-page-head h1")).fontFamily,
      markerSize: Math.min(...[...document.querySelectorAll(".sensor-map-marker")].map((marker) => Number.parseFloat(getComputedStyle(marker).width))),
      socialLinkTargets: [...document.querySelectorAll(".sensor-map-socials a")].map((link) => link.getBoundingClientRect().height),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.match(publicMap.headingFont, /Yu Mincho/u);
    assert(publicMap.markerSize >= 44);
    assert(publicMap.socialLinkTargets.every((height) => height >= 44));
    assert.equal(publicMap.overflowX, false);
    await page.screenshot({ path: path.join(outputDir, `${label}-map.png`), fullPage: true });

    await page.goto(new URL("/sensors/?authenticated=1#guide", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view='guide']").waitFor({ state: "visible" });
    await page.waitForTimeout(750);
    const guide = await page.evaluate(() => {
      const title = document.querySelector(".sensor-guide-hero h1");
      const titleStyle = getComputedStyle(title);
      const titleRect = title.getBoundingClientRect();
      const heroRect = document.querySelector(".sensor-guide-hero").getBoundingClientRect();
      return {
        title: title.textContent.trim(),
        headingFont: titleStyle.fontFamily,
        titleLines: Math.round(titleRect.height / Number.parseFloat(titleStyle.lineHeight)),
        titleContained: titleRect.left >= heroRect.left - 1 && titleRect.right <= heroRect.right + 1,
        jumpCount: document.querySelectorAll(".sensor-guide-jump a").length,
        linkTargets: [...document.querySelectorAll("[data-view='guide'] .sensor-guide-jump a, [data-view='guide'] .sensor-guide-finish a")].map((link) => link.getBoundingClientRect().height),
        kitColumns: getComputedStyle(document.querySelector(".sensor-kit-list")).gridTemplateColumns.trim().split(/\s+/u).length,
        pathColumns: getComputedStyle(document.querySelector(".sensor-guide-path")).gridTemplateColumns.trim().split(/\s+/u).length,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.equal(guide.title, "ESP32をつないで、観測をはじめる。");
    assert.match(guide.headingFont, /Yu Mincho/u);
    assert.equal(guide.titleLines, 2);
    assert.equal(guide.titleContained, true);
    assert.equal(guide.jumpCount, 4);
    assert(guide.linkTargets.every((height) => height >= 44));
    assert.equal(guide.kitColumns, viewport.width === 390 ? 2 : 4);
    assert.equal(guide.pathColumns, 1);
    assert.equal(guide.overflowX, false);
    await page.screenshot({ path: path.join(outputDir, `${label}-guide.png`), fullPage: true });

    await page.goto(new URL("/sensors/?authenticated=1#terms", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view='terms']").waitFor({ state: "visible" });
    await page.waitForTimeout(300);
    const terms = await page.evaluate(() => {
      const title = document.querySelector(".sensor-terms > h1");
      const style = getComputedStyle(title);
      return {
        title: title.textContent.trim(),
        titleLines: Math.round(title.getBoundingClientRect().height / Number.parseFloat(style.lineHeight)),
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.equal(terms.title, "利用条件と書き込み前の注意");
    assert.equal(terms.titleLines, 1);
    assert.equal(terms.overflowX, false);
    await page.screenshot({ path: path.join(outputDir, `${label}-terms.png`), fullPage: true });
    report.scans.push({ viewport: label, login, publicMap, guide, terms, passed: true });
    await context.close();
  }
  assert.equal(report.expectedAuth401.length, viewports.length);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log("sensor design browser check passed");

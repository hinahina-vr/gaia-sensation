import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv.slice(2).find(arg => /^https?:\/\//.test(arg)) || "http://127.0.0.1:4447";
const before = process.argv.includes("--before"), motion = process.argv.includes("--motion");
const widths = (process.argv.find(arg => arg.startsWith("--widths="))?.split("=")[1] || (before ? "390,1440" : "390,320,628,768,844,1440,1920")).split(",").map(Number);
const output = path.resolve(process.argv.find(arg => arg.startsWith("--output="))?.slice(9) || `artifacts/map-heading-navigation/${before ? "before" : motion ? "after-motion" : "after"}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", before, motion, checks: [], errors: [], scope: "Local Chrome with saved data / isolated API failures and touch emulation; not physical-device or production QA",
  sha256: Object.fromEntries(["map-heading-navigation.js", "map-heading-navigation.css", "gaia-mode-loader.js", "index.html"].filter(fs.existsSync).map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const current = () => page.evaluate(() => Number(GaiaMapCategories.buttons().find(button => button.getAttribute("aria-current") === "true").textContent));
const settled = number => page.waitForFunction(number => document.querySelector("#japan-title").dataset.exhibitNumber === String(number).padStart(2, "0") && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"), number);
const select = async number => { await page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent) === number).click(), number); await settled(number); };
const scan = () => page.evaluate(() => {
  const title = document.querySelector("#japan-title"), heading = title.closest(".japan-heading");
  const rect = node => node.getBoundingClientRect().toJSON();
  const visible = node => node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true });
  const titleRange = document.createRange(); titleRange.selectNodeContents(title);
  return { title: title.textContent, titleBox: rect(title), textBox: titleRange.getBoundingClientRect().toJSON(), heading: rect(heading), back: rect(document.querySelector("#japan-close")),
    arrows: [...heading.querySelectorAll(".map-heading-step")].filter(visible).map(node => { const box = rect(node); return { label: node.getAttribute("aria-label"), text: node.textContent, rect: box,
      disabled: node.disabled, hit: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) }; }),
    audio: [...document.querySelectorAll(".gaia-audio-dock")].filter(visible).map(rect),
    topControls: [...document.querySelectorAll(".japan-map-actions button")].filter(visible).map(rect),
    credits: [...document.querySelectorAll(".japan-credits a, .gaia-live-data-freshness > strong, .gaia-live-data-freshness > time")].filter(visible).map(node => ({ text: node.textContent.trim(), rect: rect(node) })),
    readouts: [...document.querySelectorAll(".gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout, .map-mobile-ecology-summary, .map-command-dock, .signal-console-map")].filter(visible).map(rect),
    overflow: document.documentElement.scrollWidth - innerWidth, titleScroll: title.scrollWidth - title.clientWidth };
});
const intersects = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 1;
const assertHeader = (result, width, height) => {
  assert.equal(result.arrows.length, 2); assert.equal(result.overflow, 0); assert(result.titleScroll <= 1);
  assert(result.titleBox.left <= (width <= 900 ? 70 : 300), `${width}: move the title left`);
  assert(result.textBox.left >= result.titleBox.left - 1 && result.textBox.right <= result.titleBox.right + 1, "No title clipping");
  const [previous, next] = result.arrows;
  assert(previous.rect.right <= result.titleBox.left && next.rect.left >= result.titleBox.right, "Arrows flank the title");
  for (const arrow of result.arrows) {
    assert(arrow.rect.width >= 44 && arrow.rect.height >= 44 && arrow.hit && !arrow.disabled, `${width}: reachable 44px controls ${JSON.stringify(arrow)}`);
    assert(arrow.rect.left >= 0 && arrow.rect.right <= width && arrow.rect.top >= 0 && arrow.rect.bottom <= height);
    assert(!intersects(arrow.rect, result.back) && result.audio.every(box => !intersects(arrow.rect, box)), "Back/audio stay separate");
  }
  assert(!intersects(result.heading, result.back));
  assert(result.topControls.every(box => !intersects(result.heading, box)), "Back/demo controls stay separate");
  for (const credit of result.credits) assert(!intersects(result.heading, credit.rect), `${width}: source overlaps heading: ${credit.text}`);
  for (const box of result.readouts) assert(!intersects(result.heading, box), "Heading stays clear of observation controls");
};
try {
  for (const width of widths) {
    const height = width === 844 ? 390 : width === 320 ? 568 : width === 768 ? 1024 : width === 1920 ? 1080 : width > 900 ? 900 : 844;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 900, hasTouch: width <= 900, reducedMotion: motion ? "no-preference" : "reduce" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); globalThis.EventSource = class { addEventListener() {} close() {} }; });
    await context.route("**/api/live/v1/**", route => route.fulfill({ status: 503, json: {} }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com", "earthquake.usgs.gov"]) await context.route(`https://${host}/**`, route => route.abort());
    page = await context.newPage(); page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?live=1&preview=heading-navigation#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(async () => { GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false }); await document.fonts.ready; });
    await select(1);
    if (before) {
      const result = await scan(); assert.equal(result.arrows.length, 0);
      report.checks.push({ width, height, number: 1, result });
      await page.screenshot({ path: path.join(output, `${width}-heading.png`), clip: { x: 0, y: 0, width, height: 160 } });
    } else {
      const previous = page.locator('.map-heading-step[data-map-heading-step="-1"]'), next = page.locator('.map-heading-step[data-map-heading-step="1"]');
      const check = async number => { await settled(number); const result = await scan(); assertHeader(result, width, height); report.checks.push({ width, height, number, result }); };
      const activate = async (button, number) => { if (width <= 900) await button.tap(); else await button.click(); assert.equal(await current(), number); await check(number); };
      await check(1);
      await page.screenshot({ path: path.join(output, `${width}-heading.png`), clip: { x: 0, y: 0, width, height: 180 } });
      await page.screenshot({ path: path.join(output, `${width}-map.png`) });
      await activate(previous, 30); await activate(next, 1);
      await next.focus(); await next.press("Enter"); await check(2); assert(await next.evaluate(node => node === document.activeElement));
      await next.press("Space"); await check(3); assert(await next.evaluate(node => node === document.activeElement));
      if (!motion && [320, 1440].includes(width)) {
        for (let number = 4; number <= 30; number++) await activate(next, number);
        await activate(next, 1);
      } else {
        for (const number of [5, 6, 12, 15, 18, 21, 24]) { await select(number); await check(number); }
      }
      // A genuine heading tap cancels the demo through the existing input path.
      await page.evaluate(() => GaiaMapDemo.start()); const demoNumber = await current();
      await activate(next, demoNumber % 30 + 1); assert.equal(await page.evaluate(() => GaiaMapDemo.getState().active), false);
      if (width <= 900) {
        await page.locator('[data-mobile-sheet="reading"]').click();
        await page.keyboard.press("Escape");
        const number = await current(); await page.locator('#map-mobile-toolbar [data-mobile-exhibit-step="1"]').tap(); await check(number % 30 + 1);
      }
      if (motion) {
        let number = await current();
        for (let index = 0; index < 5; index++) { await next.click(); number = number % 30 + 1; }
        await check(number);
        assert(await page.evaluate(() => document.getAnimations().filter(animation => animation.id === "map-dock-enter").length <= 1));
      }
      if (width === 390) {
        const number = await current();
        await page.locator('[data-mobile-sheet="reading"]').click();
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForFunction(() => !GaiaMobileMap.isActive() && !document.querySelector("#map-mobile-sheet").open);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const desktop = await scan(); assertHeader(desktop, 1440, 900);
        report.checks.push({ width: 1440, height: 900, number, phase: "resize-from-mobile", result: desktop });
        await page.setViewportSize({ width, height });
        await page.waitForFunction(() => GaiaMobileMap.isActive());
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await check(number);
      }
      await page.evaluate(() => document.querySelector("#japan-layer").dataset.storyMode = "map01");
      await previous.waitFor({ state: "hidden" }); await next.waitFor({ state: "hidden" });
      await page.evaluate(() => delete document.querySelector("#japan-layer").dataset.storyMode);
      await previous.waitFor({ state: "visible" });
      await page.locator("#japan-close").click();
      await page.waitForFunction(() => document.querySelector("#japan-layer").getAttribute("aria-hidden") === "true");
      assert.equal(await next.isVisible(), false);
      report.checks.push({ width, interactions: "real tap/click, circular stepping, Enter/Space, focus retention, demo stop, existing toolbar, story exclusion and Back" });
    }
    console.log(`${before ? "BEFORE" : "PASS"} ${width}: heading alignment and exhibit navigation`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv.slice(2).find(arg => /^https?:\/\//.test(arg)) || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const output = path.resolve(`artifacts/mobile-panel-edge/${before ? "before" : "after"}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", before, checks: [], errors: [],
  scope: "Actual local Chrome, mobile viewport/touch emulation, bundled data and isolated provider requests; not physical-device or production QA",
  sha256: Object.fromEntries(["map-mobile-shell.css", "gaia-mode-loader.js", "index.html"].map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height] of before ? [[628, 844]] : [[628, 844], [390, 844], [320, 568], [768, 1024], [844, 390], [1440, 900], [1920, 1080]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 900, hasTouch: width <= 900, reducedMotion: "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
    });
    await context.route("**/api/live/v1/**", route => route.fulfill({ status: 503, json: {} }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com", "earthquake.usgs.gov"]) await context.route(`https://${host}/**`, route => route.abort());
    page = await context.newPage(); page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?live=1&preview=mobile-panel-edge#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMobileMap && globalThis.GaiaMapDemo);
    await page.evaluate(async () => { GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false }); await document.fonts.ready; });
    for (const number of before ? [18] : [18, 1, 2, 6, 12, 21]) {
      const selector = { 18: ".gaia-live-exhibit-readout", 1: ".gaia-firms-readout", 2: ".gaia-planet-signals-readout", 21: ".gaia-estat-readout",
        6: width <= 900 ? ".signal-console-map" : ".map-command-dock", 12: width <= 900 ? ".map-mobile-ecology-summary" : ".map-command-dock" }[number];
      await page.evaluate(number => { GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === number).click(); globalThis.GaiaLiveExhibits?.pausePoiAutoplay(); }, number);
      await page.waitForFunction(number => {
        const layer = document.querySelector("#japan-layer"), target = String(number).padStart(2, "0");
        return document.querySelector("#japan-title").dataset.exhibitNumber === target
          && layer.dataset.dockMotionTo === target && layer.dataset.dockMotionPhase === "complete"
          && !layer.classList.contains("is-map-title-transitioning");
      }, number);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Ecology also fades its own freshly rendered surface. Wait for that
      // actual panel, not just the shared dock entrance or an outgoing node.
      await page.waitForFunction(selector => {
        const panel = document.querySelector(selector);
        return getComputedStyle(panel).opacity === "1" && panel.getAnimations().every(animation => animation.playState !== "running");
      }, selector);
      const scan = () => page.evaluate(({ number, selector }) => {
        const panel = document.querySelector(selector);
        const style = getComputedStyle(panel), rect = panel.getBoundingClientRect().toJSON();
        return { panel: panel.className, rect, text: panel.innerText, font: style.font, opacity: style.opacity,
          background: style.backgroundImage, top: style.borderTop, right: style.borderRight, radius: style.borderRadius, shadow: style.boxShadow,
          creditGap: number === 18 ? rect.top - document.querySelector(".japan-credits").getBoundingClientRect().bottom : null,
          overflow: document.documentElement.scrollWidth - innerWidth,
          controls: [...panel.querySelectorAll("button, input")].filter(node => node.checkVisibility({ checkVisibilityCSS: true })).map(node => {
            const box = node.getBoundingClientRect();
            return { label: node.getAttribute("aria-label") || node.textContent, hit: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
          }) };
      }, { number, selector });
      const result = await scan();
      assert(result.text.trim()); assert.equal(result.overflow, 0);
      assert(result.rect.left >= -1 && result.rect.right <= width + 1 && result.rect.top >= 0 && result.rect.bottom <= height + 1);
      assert(result.controls.every(control => control.hit), `${width}/${number}: controls stay reachable`);
      if (number === 18) assert(result.creditGap >= 11.9, "Source-credit clearance is preserved");
      if (width <= 900) {
        assert(result.background.includes("0.8")); assert.equal(result.opacity, "1");
        if (before) {
          assert(result.top.startsWith("2px solid")); assert.notEqual(result.top, result.right);
          assert.equal(result.radius, "16px"); assert.notEqual(result.shadow, "none");
        } else {
          assert.equal(result.top, "1px solid rgba(167, 184, 190, 0.22)"); assert.equal(result.right, result.top);
          assert.equal(result.radius, "6px"); assert.equal(result.shadow, "none");
        }
      } else {
        // The previous mobile decoration must have no effect on desktop.
        const previousRule = await page.addStyleTag({ content: `@media (max-width: 900px) {
          #japan-layer.is-mobile-map-shell :is(.signal-console-map, .gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout, .map-mobile-ecology-summary):not([hidden]) {
            border: 1px solid #9bcddd70; border-top: 2px solid var(--mobile-exhibit-accent, #7bddff); border-radius: 16px;
            box-shadow: inset 0 1px #d9f7ff24, 0 8px 28px #0005, 0 -4px 18px color-mix(in srgb, var(--mobile-exhibit-accent, #7bddff) 12%, transparent);
          }
        }` });
        const previous = await scan(); await previousRule.evaluate(node => node.remove());
        for (const key of ["font", "background", "top", "right", "radius", "shadow", "rect"]) assert.deepEqual(result[key], previous[key], `Desktop ${key} unchanged`);
      }
      report.checks.push({ width, height, number, result });
      if (number === 18 || number === 6) {
        await page.screenshot({ path: path.join(output, `${width}-${number}-map.png`) });
        const top = Math.max(0, Math.floor(result.rect.top - 18));
        await page.screenshot({ path: path.join(output, `${width}-${number}-edge.png`), clip: { x: 0, y: top, width, height: Math.min(height - top, 48) } });
      }
    }
    console.log(`${before ? "BEFORE" : "PASS"} ${width}: panel edge, opacity, control hit targets${width > 900 ? ", unchanged desktop" : ""}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }

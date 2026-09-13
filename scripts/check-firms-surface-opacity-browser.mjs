import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const output = path.resolve(`artifacts/firms-surface-opacity/${before ? "before" : "after"}`);
fs.mkdirSync(output, { recursive: true });
const files = ["realtime-exhibits.css", "panel-surfaces.css", "gaia-mode-loader.js", "index.html"];
const css = fs.readFileSync(files[0], "utf8");
const testedCss = before ? css.replace("#japan-layer .gaia-firms-readout > .gaia-realtime-status { background: none; }", "") : css;
const report = { status: "running", before, base,
  environment: "Local Chrome with mobile/touch emulation; saved and synthetic live provider fixtures, not production or physical-device testing",
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash("sha256").update(file === files[0] ? testedCss : fs.readFileSync(file)).digest("hex")])),
  checks: [], errors: [] };
const now = Date.parse("2026-09-08T06:00:00Z");
const live = JSON.parse(fs.readFileSync("data/firms-active-fire-snapshot.json", "utf8"));
live.source = "nasa-firms-modis";
live.generatedAt = new Date(now).toISOString();
live.summary.end = new Date(now - 3600_000).toISOString();
live.summary.start = new Date(now - 24 * 3600_000).toISOString();
const profiles = before ? [[628, 844, "saved"]] : [[628, 844, "saved"], [390, 844, "saved"], [320, 568, "saved"], [844, 390, "saved"], [1440, 900, "saved"], [390, 844, "live"]];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height, state] of profiles) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 900, hasTouch: width <= 900, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    if (before) await context.route(`${base}/realtime-exhibits.css*`, route => route.fulfill({ body: testedCss, contentType: "text/css" }));
    await context.route("**/api/live/v1/firms", route => state === "live" ? route.fulfill({ json: live }) : route.fulfill({ status: 503, json: {} }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com", "earthquake.usgs.gov"]) await context.route(`https://${host}/**`, route => route.abort());
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, state, error: error.message }));
    await page.clock.install({ time: new Date(now) });
    await page.goto(`${base}/?live=1&preview=firms-surface-opacity#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMapCategories);
    await page.evaluate(async () => { GaiaMapDemo.stop(); await document.fonts.ready; });
    const panel = page.locator(".gaia-firms-readout");
    const settle = async () => {
      await panel.locator(`[data-realtime-state="${state}"]`).waitFor();
      await page.waitForFunction(() => {
        const node = document.querySelector(".gaia-firms-readout");
        return !node.hidden && getComputedStyle(node).opacity === "1" && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning");
      });
    };
    await settle();
    const scan = () => panel.evaluate(node => {
      const style = getComputedStyle(node), status = getComputedStyle(node.querySelector(".gaia-realtime-status"));
      const visible = element => element.checkVisibility({ checkVisibilityCSS: true });
      return { background: style.backgroundImage, baseColor: style.backgroundColor, opacity: style.opacity,
        statusBackground: status.backgroundImage, statusColor: status.backgroundColor,
        rect: node.getBoundingClientRect().toJSON(), text: node.innerText,
        children: [...node.children].filter(visible).map(element => ({ name: element.className, opacity: getComputedStyle(element).opacity })),
        controls: [...node.querySelectorAll("button, input")].filter(visible).map(element => {
          const rect = element.getBoundingClientRect();
          return { name: element.getAttribute("aria-label") || element.textContent, hit: element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
        }) };
    });
    const measured = await scan();
    assert.equal(measured.background, "linear-gradient(145deg, rgba(19, 42, 52, 0.8), rgba(5, 22, 32, 0.8))");
    assert.equal(measured.baseColor, "rgba(0, 0, 0, 0)");
    assert.equal(measured.opacity, "1");
    assert(measured.children.every(child => child.opacity === "1"), "Text and controls are not faded");
    assert.equal(measured.statusColor, "rgba(0, 0, 0, 0)");
    if (before) assert.match(measured.statusBackground, /rgba\(78, 172, 150, 0\.125\)/, "Reproduce the second tint above the 80% panel");
    else assert.equal(measured.statusBackground, "none", "No stacked fill above the 80% surface");
    assert(measured.rect.left >= 0 && measured.rect.right <= width + 1 && measured.rect.top >= 0 && measured.rect.bottom <= height + 1);
    assert(measured.controls.every(control => control.hit), "Controls remain reachable");
    assert.match(measured.text, state === "saved" ? /保存観測を表示.*ライブ未接続/u : /ライブ/u);
    const slider = panel.locator("[data-firms-progress]"), play = panel.locator("[data-firms-play]");
    await play.click();
    assert.equal(await play.getAttribute("aria-pressed"), "false");
    await slider.focus(); await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight");
    assert.equal(await slider.inputValue(), "1", "Real keyboard input scrubs the observation timeline");
    await play.click();
    // Resume updates the visible label on the next render, not in the handler.
    await page.waitForFunction(() => document.querySelector("[data-firms-play]").getAttribute("aria-pressed") === "true");
    await play.click();
    await page.screenshot({ path: path.join(output, `${width}x${height}-${state}.png`) });
    await panel.screenshot({ path: path.join(output, `${width}x${height}-${state}-panel.png`) });
    if (!before) {
      // Existing map controls still switch away and restore the same surface.
      await page.evaluate(() => GaiaMapCategories.buttons().find(button => Number(button.textContent) === 6).click());
      await panel.waitFor({ state: "hidden" });
      await page.evaluate(() => GaiaMapCategories.buttons().find(button => Number(button.textContent) === 1).click());
      await settle();
      const restored = await scan();
      assert.equal(restored.background, measured.background);
      assert.equal(restored.statusBackground, "none");
    }
    report.checks.push({ width, height, state, measured, playback: "Pause, keyboard scrub, resume and pause passed", reentry: !before });
    console.log(`${before ? "BEFORE" : "PASS"} ${width}x${height}/${state}: 80% surface, readable content and timeline controls`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, failure: report.failure }));
}

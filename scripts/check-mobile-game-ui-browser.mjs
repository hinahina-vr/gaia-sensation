import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve("artifacts/mobile-game-ui");
fs.mkdirSync(output, { recursive: true });
const files = ["map-mobile-shell.js", "map-mobile-shell.css", "gaia-mode-loader.js", "index.html"];
const report = { status: "running", environment: "Local Chrome, mobile touch emulation and saved/synthetic data; no physical iPhone/Android or live-feed claim",
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const contextFor = async (width, height, before = false) => {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 900, hasTouch: width <= 900, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    for (const v of [3, 4, 5]) sessionStorage.setItem(`gaia:mode-entry-guide:map:v${v}`, "seen");
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
    globalThis.EventSource = class { addEventListener() {} close() {} };
  });
  await context.route("https://services.swpc.noaa.gov/**", r => r.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
  await context.route("**/api/live/v1/firms", r => r.fulfill({ path: "data/firms-active-fire-snapshot.json", contentType: "application/json" }));
  if (before) for (const file of files.filter(file => file !== "index.html")) {
    const body = execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
    await context.route(`**/${file}*`, r => r.fulfill({ body, contentType: file.endsWith("css") ? "text/css" : "text/javascript" }));
  }
  return context;
};
const ready = async () => {
  await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
  await page.evaluate(async () => { GaiaMapDemo.stop(); await document.fonts.ready; });
  await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
  await page.waitForTimeout(300);
};
const open = async kind => {
  await page.locator(`[data-mobile-sheet="${kind}"]`).tap();
  await page.waitForTimeout(250); // Let the browser's native touch highlight fade.
};
const select = async number => {
  await open("exhibits");
  await page.locator(`[data-mobile-exhibit="${number}"]`).tap();
  await ready();
  assert.equal(await page.evaluate(() => Number(GaiaMapCategories.buttons().find(b => b.getAttribute("aria-current") === "true").textContent)), number);
};
try {
  // Capture the reported plain-text panels from the unchanged base in exactly
  // the same browser, viewport, exhibit and data conditions as the new version.
  const oldContext = await contextFor(390, 844, true);
  page = await oldContext.newPage();
  await page.goto(`${base}/?exhibit=1&live=1#world`, { waitUntil: "domcontentloaded" });
  await ready();
  await page.screenshot({ path: path.join(output, "390-before-map.png") });
  for (const kind of ["exhibits", "tools"]) {
    await open(kind);
    assert.equal(await page.locator(".map-mobile-card-art, .map-mobile-action-card").count(), 0);
    await page.screenshot({ path: path.join(output, `390-before-${kind}.png`) });
    await page.keyboard.press("Escape");
  }
  await oldContext.close();
  report.checks.push({ baseline: "HEAD plain text-only mobile cards reproduced" });

  for (const [width, height] of [[390, 844], [320, 568], [768, 1024], [844, 390]]) {
    const context = await contextFor(width, height);
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, error: error.message }));
    await page.goto(`${base}/?exhibit=1&live=1#world`, { waitUntil: "domcontentloaded" });
    await ready();
    const readout = page.locator(".gaia-firms-readout");
    const observation = await readout.evaluate(e => ({ client: e.clientHeight, scroll: e.scrollHeight, text: e.innerText }));
    assert(observation.text.includes("ライブ未接続") && observation.text.includes("2026年9月3日"));
    assert(observation.scroll <= observation.client + 1, "Observation values and timeline must not be clipped");
    await page.screenshot({ path: path.join(output, `${width}-map.png`) });
    await open("exhibits");
    assert.equal(await page.locator('[data-mobile-exhibit="1"][aria-current="true"]').count(), 1);
    for (const [number, illustration] of [[7, "current"], [8, "forest"], [18, "climate"], [20, "air"], [23, "home"], [28, "sun"]]) {
      assert.equal(await page.locator(`[data-mobile-exhibit="${number}"] [data-mobile-art]`).getAttribute("data-mobile-art"), illustration);
      assert(await page.locator(`[data-mobile-exhibit="${number}"]`).getAttribute("aria-description"));
    }
    await page.screenshot({ path: path.join(output, `${width}-exhibits.png`) });
    // Header taps and a pointer drag released outside do not dismiss the sheet.
    await page.locator("#map-mobile-sheet-title").tap();
    assert(await page.locator("#map-mobile-sheet").evaluate(e => e.open));
    await page.locator("#map-mobile-sheet").dispatchEvent("pointerdown", { clientX: width / 2, clientY: height - 10 });
    await page.locator("#map-mobile-sheet").dispatchEvent("click", { clientX: 2, clientY: 2 });
    assert(await page.locator("#map-mobile-sheet").evaluate(e => e.open));
    // Scroll the actual touch scroller, then reach and activate the last card.
    const sheetBody = page.locator(".map-mobile-sheet-body");
    const box = await sheetBody.boundingBox();
    const cdp = await context.newCDPSession(page);
    const start = Math.min(height - 20, box.y + box.height - 25);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: width / 2, y: start }] });
    for (let step = 1; step <= 5; step++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: width / 2, y: start - step * Math.min(36, box.height / 8) }] });
      await page.waitForTimeout(20);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction(() => document.querySelector(".map-mobile-sheet-body").scrollTop > 0);
    await page.locator('[data-mobile-exhibit="30"]').tap();
    await ready();
    assert.equal(await page.evaluate(() => Number(GaiaMapCategories.buttons().find(b => b.getAttribute("aria-current") === "true").textContent)), 30);
    await page.locator('[data-mobile-exhibit-step="1"]').tap();
    await ready();
    assert.equal(await page.evaluate(() => Number(GaiaMapCategories.buttons().find(b => b.getAttribute("aria-current") === "true").textContent)), 1);
    await page.locator('[data-mobile-exhibit-step="-1"]').tap(); await ready();
    assert.equal(await page.evaluate(() => Number(GaiaMapCategories.buttons().find(b => b.getAttribute("aria-current") === "true").textContent)), 30);
    await select(1);
    await open("tools");
    const disabled = page.locator("#map-mobile-sheet").getByRole("button", { name: "統計分析", exact: true });
    assert(await disabled.isDisabled());
    assert.equal(await disabled.getAttribute("aria-describedby"), "map-mobile-analysis-unavailable-reason");
    assert.match(await page.locator("#map-mobile-analysis-unavailable-reason").innerText(), /時系列・比較/);
    assert.equal(await disabled.locator("small").textContent(), "この展示では対象外");
    await page.screenshot({ path: path.join(output, `${width}-tools.png`) });
    await page.locator("#map-mobile-sheet").getByRole("button", { name: "データの出典", exact: true }).tap();
    await page.locator("#japan-data-panel").waitFor({ state: "visible" });
    assert.match(await page.locator("#japan-data-panel").innerText(), /NASA|FIRMS/);
    await page.locator("#japan-data-close").tap();
    await open("reading");
    assert.match(await page.locator(".map-mobile-reading-copy.gaia-realtime-status").innerText(), /NASA FIRMS/);
    assert.equal(await page.locator("#japan-title").count(), 1);
    await page.screenshot({ path: path.join(output, `${width}-reading.png`) });
    await page.touchscreen.tap(2, 2);
    assert.equal(await page.locator("#map-mobile-sheet").evaluate(e => e.open), false, "Genuine backdrop tap closes");
    await select(6);
    await open("tools");
    assert.equal(await disabled.isDisabled(), false, "Historical data still supports analysis");
    await page.locator("#map-mobile-sheet").getByRole("button", { name: "＋ 拡大", exact: true }).tap();
    await page.waitForTimeout(400);
    await open("tools");
    assert.equal(await page.locator("#map-mobile-sheet").getByRole("button", { name: "− 縮小", exact: true }).isDisabled(), false);
    await page.locator("#map-mobile-sheet").getByRole("button", { name: "全体に戻す", exact: true }).tap();
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#map-mobile-sheet").evaluate(e => e.open), false);
    // A real OS motion-preference switch enables only the short entrance.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open("exhibits");
    await page.waitForTimeout(350);
    assert.equal(await page.locator("#map-mobile-sheet").evaluate(e => getComputedStyle(e).animationName), "mobile-deck-arrive");
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator("#map-mobile-sheet").evaluate(e => getComputedStyle(e).animationName), "none");
    report.checks.push({ width, height, observation, interactions: "real tap, touch swipe, last card, cyclic previous/next, disabled reason, source, reading metadata, backdrop/drag, zoom/reset, motion preference" });
    await context.close(); console.log(`PASS ${width}: game UI touch interactions`);
  }

  // Compare computed desktop surfaces against HEAD, not just 'mobile bar hidden'.
  for (const [width, height] of [[1440, 900], [1920, 1080]]) {
    const scans = [];
    for (const before of [true, false]) {
      const context = await contextFor(width, height, before);
      page = await context.newPage();
      await page.goto(`${base}/?exhibit=1&live=1#world`, { waitUntil: "domcontentloaded" });
      await ready();
      await page.locator(".gaia-firms-count [data-firms-total]").waitFor({ state: "attached" });
      await page.waitForTimeout(500);
      scans.push(await page.evaluate(() => ["#japan-close", ".japan-heading", ".gaia-firms-readout", ".gaia-realtime-status", ".gaia-firms-primary", ".gaia-firms-actions"].map(selector => {
        const e = document.querySelector(selector), css = getComputedStyle(e), r = e.getBoundingClientRect();
        return { selector, x: r.x, y: r.y, width: r.width, height: r.height, background: css.backgroundImage, border: css.border, font: css.font, display: css.display };
      })));
      assert.equal(await page.locator("#map-mobile-toolbar").isVisible(), false);
      await page.screenshot({ path: path.join(output, `${width}-desktop-${before ? "before" : "after"}.png`) });
      await context.close();
    }
    assert.deepEqual(scans[1], scans[0], "Desktop geometry, fonts, colours and borders must be unchanged");
    report.checks.push({ width, desktop: "HEAD/candidate computed surfaces identical", scan: scans[1] });
    console.log(`PASS ${width}: desktop matches HEAD`);
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close(); console.log(JSON.stringify({ status: report.status, failure: report.failure }));
}

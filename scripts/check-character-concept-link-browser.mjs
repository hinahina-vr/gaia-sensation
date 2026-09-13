import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = process.env.GAIA_OUTPUT_DIR || "artifacts/character-concept-link-2026-09-09";
fs.mkdirSync(output, { recursive: true });
if (fs.existsSync(`${output}/report.json`) && !fs.existsSync(`${output}/before-keyboard-fix.json`)) {
  const previous = JSON.parse(fs.readFileSync(`${output}/report.json`));
  if (previous.status === "failed" && previous.failure.includes("intro-architecture-back")) {
    fs.copyFileSync(`${output}/report.json`, `${output}/before-keyboard-fix.json`);
    if (fs.existsSync(`${output}/failure.png`)) fs.copyFileSync(`${output}/failure.png`, `${output}/before-keyboard-fix.png`);
  }
}
const files = ["index.html", "app.js", "character-mode.css", "character-mode.js", "gaia-mode-loader.js", "concept/index.html", "concept/concept.css", "concept/concept.js"];
const report = { status: "running", version: "character-concept-20260909", environment: "Local installed Chrome with CSP and desktop/touch emulation, not physical phones or production. External requests blocked; no live AI or export.",
  hashes: Object.fromEntries(files.map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    const mobile = width <= 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" });
    await enforceBrowserSecurity(context, base);
    await context.route("**/*", route => route.request().url().startsWith(base) ? route.fallback() : route.abort());
    page = await context.newPage();
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    page.on("response", response => { if (response.status() >= 400 && response.url().startsWith(base)) report.errors.push(`${width}: ${response.status()} ${response.url()}`); });
    await page.goto(`${base}/#character`, { waitUntil: "domcontentloaded" });
    await page.locator("#character-book-layer").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("#character-book-layer").classList.contains("is-open") && document.querySelectorAll("[data-character-cg-id]").length === 6);
    await page.evaluate(() => document.fonts.ready);
    for (const id of ["amane", "mizuha", "sakuya", "aoneko"]) {
      await page.locator(`[data-character-select="${id}"]`).click();
      await page.waitForFunction(id => document.querySelector("#character-book-layer").dataset.characterId === id && document.querySelector("#character-book-image").complete, id);
    }
    const card = page.locator('[data-character-cg-id="first-encounter"]');
    await card.click();
    await page.locator("#character-book-cg-viewer").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.locator("#character-book-cg-viewer").waitFor({ state: "hidden" });
    const panel = page.locator("#character-book-concept"), link = page.locator("#character-book-concept-link");
    await panel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    assert.match(await panel.innerText(), /放課後の窓辺から。/);
    assert.equal(await panel.locator('p').textContent(), '放課後の静けさの向こうに広がる、地球の気配。『惑星の放課後～GAIA SENSATION～』が生まれた背景と思想を綴りました。');
    assert.equal(await link.getAttribute("href"), "./concept/");
    assert.equal(await link.getAttribute("target"), null, "Ordinary same-tab navigation");
    const geometry = await panel.evaluate(node => {
      const rect = node.getBoundingClientRect(), anchor = node.querySelector("a"), a = anchor.getBoundingClientRect();
      const previous = document.querySelector("#character-book-cg").getBoundingClientRect(), footer = document.querySelector(".character-book-footer").getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(node.querySelector("p"));
      return { panel: rect.toJSON(), link: a.toJSON(), afterAlbum: rect.top >= previous.bottom - 1, beforeFooter: rect.bottom <= footer.top + 1,
        hit: anchor.contains(document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2)),
        font: parseFloat(getComputedStyle(node.querySelector("p")).fontSize), textFits: [...range.getClientRects()].every(r => r.left >= rect.left - 1 && r.right <= rect.right + 1) };
    });
    assert(geometry.afterAlbum && geometry.beforeFooter, "Introduce the concept after the six-scene album and before the footer");
    assert(geometry.hit && geometry.link.height >= 44 && geometry.link.left >= 0 && geometry.link.right <= width + 1 && geometry.textFits && geometry.font >= 14, JSON.stringify(geometry));
    assert.equal(await page.evaluate(() => Math.max(document.documentElement.scrollWidth - innerWidth, document.querySelector("#character-book-scroll").scrollWidth - document.querySelector("#character-book-scroll").clientWidth)), 0);
    assert(!requests.some(url => /\/concept\/|myth-machine-circulation/.test(url)), "No concept assets loaded before clicking");
    await page.screenshot({ path: `${output}/${width}-introduction.png` });
    if (mobile) await link.tap();
    else {
      await link.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
      assert.equal(await page.locator(":focus").getAttribute("id"), "character-book-concept-link");
      assert.notEqual(await link.evaluate(node => getComputedStyle(node).outlineStyle), "none");
      await page.keyboard.press("Enter");
    }
    await page.waitForURL(`${base}/concept/`);
    await page.waitForFunction(() => document.body.dataset.enhanced === "true");
    assert.equal(await page.locator("#page-title").textContent(), "『惑星の放課後』とは");
    await page.screenshot({ path: `${output}/${width}-destination.png` });
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.locator("#character-book-layer").waitFor({ state: "visible" });
    assert.equal(new URL(page.url()).hash, "#character");
    await page.locator("[data-character-close]").click();
    await page.locator("#character-book-layer").waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.body.classList.contains("character-mode-open")), false);
    // The original intro key loop becomes available again after closing.
    await page.locator("#intro-layer").waitFor({ state: "visible" });
    await page.locator("#intro-title-return").focus();
    await page.keyboard.press("Tab");
    assert(await page.locator(":focus").evaluate(node => !!node.closest("#intro-layer")));
    report.checks.push({ width, height, geometry, characters: 4, cgViewer: true, conceptNavigation: true, backAndClose: true });
    console.log(`PASS ${width}x${height}: end-of-page copy, native link, concept, back, four characters and album`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
}

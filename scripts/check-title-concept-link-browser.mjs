import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve(process.argv[3] || "artifacts/title-concept-link");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", revision: "title-about-desktop-1", base, testedAt: new Date().toISOString(), environment: "Local Chrome with CSP and mobile/touch emulation; live APIs isolated", checks: [], errors: [], hashes: {} };
for (const file of ["index.html", "opening.css", "opening.js", "concept/index.html", "concept/concept.css", "concept/concept.js"]) {
  report.hashes[file] = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
let page;
const tap = async (selector, mobile) => mobile ? page.locator(selector).tap() : page.locator(selector).click();
const snap = name => page.screenshot({ path: path.join(output, `${name}.png`) });
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const titleReady = async () => {
  await page.waitForFunction(() => document.querySelector("#gaia-opening-final-menu")?.classList.contains("is-visible"));
  await page.locator("#gaia-boot").waitFor({ state: "hidden" });
  await page.waitForTimeout(900);
  if (await page.locator("#gaia-opening-route-guide").isVisible()) await page.keyboard.press("Escape");
};
const linkGeometry = async () => {
  const state = await page.locator("#gaia-opening-concept").evaluate(el => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { rect: rect.toJSON(), hit: hit === el || el.contains(hit), desktop: matchMedia("(min-width: 961px) and (hover: hover) and (pointer: fine)").matches, parent: el.parentElement.parentElement.id, style: { color: getComputedStyle(el).color, fontSize: getComputedStyle(el).fontSize }, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  assert(state.hit, "CONCEPT must receive a real pointer hit");
  assert(state.rect.width >= 44 && state.rect.height >= 44, "CONCEPT has a 44px minimum hit area");
  assert.equal(state.overflow, 0);
  assert(state.rect.x >= 0 && state.rect.y >= 0 && state.rect.right <= page.viewportSize().width && state.rect.bottom <= page.viewportSize().height);
  const audio = await page.locator("#gaia-audio-dock").boundingBox();
  assert(!overlap(state.rect, audio), "CONCEPT and audio must not overlap");
  assert.equal(await page.locator("#gaia-opening-concept").textContent(), "このサイトについて");
  assert.equal(await page.locator("#gaia-opening-concept").getAttribute("lang"), null, "Japanese caption inherits the page language");
  const routes = await page.locator(".gaia-opening-route-grid").boundingBox();
  if (state.desktop) {
    assert.equal(state.parent, "gaia-opening", "Desktop link is outside the transformed title lockup");
    assert(Math.abs(state.rect.top - audio.y) < 1, "Desktop utilities share a top edge");
    assert(Math.abs(audio.x - state.rect.right - 12) < 1, "Desktop link is 12px left of the audio control");
  } else {
    assert.equal(state.parent, "gaia-opening-final-menu", "Touch/narrow layouts retain the original menu link");
    assert(state.rect.top >= routes.y + routes.height, "About link is below the start buttons");
    assert(Math.abs((state.rect.left + state.rect.width / 2) - (routes.x + routes.width / 2)) < 2, "About link is centered beneath the start buttons");
  }
  assert(!overlap(state.rect, routes), "About link remains separate from the start buttons");
  const guide = await page.locator("#gaia-opening-route-guide-replay").boundingBox();
  if (guide) assert(!overlap(state.rect, guide), "About link does not overlap the entry guide");
  return state;
};
const audioTransition = async () => {
  const samples = await page.evaluate(async () => {
    const samples = [];
    const end = performance.now() + 500;
    do {
      await new Promise(requestAnimationFrame);
      const about = document.querySelector("#gaia-opening-concept").getBoundingClientRect();
      const audio = document.querySelector("#gaia-audio-dock").getBoundingClientRect();
      samples.push({ gap: audio.left - about.right, overlap: about.left < audio.right && about.right > audio.left && about.top < audio.bottom && about.bottom > audio.top });
    } while (performance.now() < end);
    return samples;
  });
  assert(samples.length > 0);
  assert(samples.every(sample => !sample.overlap), "Audio never covers the link during its animation");
  return { samples: samples.length, minimumHorizontalGap: Math.min(...samples.map(sample => sample.gap)) };
};

try {
  for (const [width, height, mobile, reduced] of [[1440, 900, false, false], [390, 844, true, false], [320, 568, true, true], [844, 390, true, false]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: reduced ? "reduce" : "no-preference" });
    await context.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await enforceBrowserSecurity(context, base);
    await context.route(`${base}/api/**`, route => route.fulfill({ status: 503, contentType: "application/json", body: '{"status":"offline","observations":[]}' }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator("#gaia-opening-sound-off").waitFor({ state: "visible" });
    assert.equal(await page.locator("#gaia-opening-concept").isVisible(), false, "No link in the sound-choice screen");
    await tap("#gaia-opening-sound-off", mobile);
    if (!reduced) {
      await page.locator("#gaia-opening-skip").waitFor({ state: "visible" });
      assert.equal(await page.locator("#gaia-opening-concept").isVisible(), false, "No link during the cinematic");
      await tap("#gaia-opening-skip", mobile);
    }
    await titleReady();
    assert.equal(await page.locator('a[href="./concept/"]').count(), 1);
    const initial = await linkGeometry();
    assert(!requests.some(url => /\/concept\/|\/assets\/concept\//u.test(url)), "No concept assets fetched before navigation");
    await snap(`${width}-title`);
    const responsive = [];
    if (width === 1440) {
      await page.locator("#gaia-opening-concept").focus();
      await page.evaluate(() => { window.__originalAboutLink = document.querySelector("#gaia-opening-concept"); });
      for (const [resizeWidth, resizeHeight] of [[1920, 1080], [1366, 768], [1024, 600], [961, 768], [960, 768], [961, 768], [1440, 500], [1440, 900]]) {
        await page.setViewportSize({ width: resizeWidth, height: resizeHeight });
        await page.waitForTimeout(500);
        if (await page.locator("#gaia-opening-route-guide").isVisible()) await page.keyboard.press("Escape");
        assert.equal(await page.locator('a[href="./concept/"]').count(), 1);
        assert.equal(await page.evaluate(() => document.activeElement === window.__originalAboutLink && document.querySelector("#gaia-opening-concept") === window.__originalAboutLink), true, "Resizing preserves the same link and keyboard focus");
        responsive.push({ width: resizeWidth, height: resizeHeight, about: await linkGeometry() });
        await snap(`resize-${resizeWidth}x${resizeHeight}`);
      }
    }
    if (width === 320) {
      for (const [resizeWidth, resizeHeight] of [[360, 640], [390, 600], [420, 568], [390, 640], [390, 641], [420, 720], [420, 721]]) {
        await page.setViewportSize({ width: resizeWidth, height: resizeHeight });
        await page.waitForTimeout(150);
        if (await page.locator("#gaia-opening-route-guide").isVisible()) await page.keyboard.press("Escape");
        responsive.push({ width: resizeWidth, height: resizeHeight, about: await linkGeometry() });
        await snap(`resize-${resizeWidth}x${resizeHeight}`);
      }
      await page.setViewportSize({ width, height });
    }
    await tap("#gaia-audio-toggle", mobile);
    const openingAnimation = await audioTransition();
    assert.equal(await page.locator("#gaia-audio-toggle").getAttribute("aria-expanded"), "true");
    const expanded = await linkGeometry();
    await snap(`${width}-audio-expanded`);
    await page.keyboard.press("Escape");
    const closingAnimation = await audioTransition();
    await linkGeometry();
    if (mobile) {
      await tap("#gaia-opening-concept", true);
    } else {
      await page.locator("#gaia-opening-concept").focus();
      // Traverse the actual tab order before activating the native anchor.
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "gaia-opening-concept");
      assert.notEqual(await page.locator("#gaia-opening-concept").evaluate(el => getComputedStyle(el).outlineStyle), "none");
      await snap(`${width}-keyboard-focus`);
      await page.keyboard.press("Enter");
    }
    await page.waitForURL(`${base}/concept/`);
    await page.waitForFunction(() => document.body.dataset.enhanced === "true");
    await page.locator("#page-title").waitFor({ state: "visible" });
    await page.waitForTimeout(1000);
    assert.match(await page.locator("#page-title").innerText(), /惑星の放課後/u);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.equal(await page.locator("#gaia-opening-concept").count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await snap(`${width}-concept`);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await titleReady();
    assert.equal(await page.locator("#gaia-opening-sound-modal").isVisible(), false, "Back returns to title without replaying sound setup");
    await linkGeometry();
    const route = width === 844 ? "#gaia-opening-route-story" : "#gaia-opening-route-other";
    await tap(route, mobile);
    await page.waitForFunction(() => document.querySelector("#gaia-opening")?.hidden === true);
    assert.equal(await page.locator("#gaia-opening-concept").isVisible(), false, "Link hidden after leaving title");
    if (width === 844) {
      await page.locator("#novel-runtime").waitFor({ state: "visible" });
    } else {
      await page.locator("#intro-layer").waitFor({ state: "visible" });
      await tap('[data-intro-path="map"]', mobile);
      await page.locator("#japan-layer").waitFor({ state: "visible" });
      assert.equal(await page.locator("#gaia-opening-concept").isVisible(), false, "No concept link in MAP");
      await page.locator("[data-feature-close]").waitFor({ state: "visible" });
      await tap("[data-feature-close]", mobile);
      await tap("#japan-close", mobile);
      await page.locator("#intro-layer").waitFor({ state: "visible" });
      await tap("#intro-title-return", mobile);
      await titleReady();
      await linkGeometry();
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ width, height, mobile, reduced, initial, expanded, responsive, openingAnimation, closingAnimation, passed: [initial.desktop ? "Desktop about link at top right beside audio" : "Japanese about caption centered below start buttons", "title only", "pointer hit and bounds", "44px target", "audio collapsed/expanded/animated separation", "no early concept loads", mobile ? "native tap navigation" : "keyboard navigation, visible focus and responsive focus preservation", "concept content and layout", "browser Back returns to title", width === 844 ? "story entry without link" : "MAP entry/exit/title return", "CSP"] });
    console.log(`PASS ${width}x${height}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page && !page.isClosed()) await snap("failure").catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ status: report.status, profiles: report.checks.length, errors: report.errors, report: path.join(output, "report.json") }));
}

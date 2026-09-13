import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

const base = process.argv.find(arg => /^https?:\/\//u.test(arg)) || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const baselineRef = process.argv.find(arg => arg.startsWith("--baseline="))?.slice(11) || "HEAD";
const baselineCss = before ? execFileSync("git", ["show", `${baselineRef}:styles.css`]) : null;
const output = path.resolve(process.argv.find(arg => arg.startsWith("--output="))?.slice(9) || `artifacts/intro-face-clearance/${before ? "before" : "after"}`);
const selected = process.argv.find(arg => arg.startsWith("--profiles="))?.slice(11).split(",");
const profiles = [
  { name: "mobile390", width: 390, height: 864, touch: true },
  { name: "mobile390-unlocked", width: 390, height: 864, touch: true, unlocked: true },
  { name: "small320", width: 320, height: 568, touch: true },
  { name: "large430", width: 430, height: 932, touch: true },
  { name: "mobile390-reduced", width: 390, height: 844, touch: true, reduced: true },
  { name: "tablet768", width: 768, height: 1024, touch: true },
  { name: "landscape844", width: 844, height: 390, touch: true },
  { name: "pc1440", width: 1440, height: 900 },
  { name: "pc1920", width: 1920, height: 1080 },
].filter(profile => !selected || selected.includes(profile.name));
assert(profiles.length > 0);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", base, before, scope: "Local real Chrome with CSP; mobile/touch emulation, saved data and isolated live APIs; not production or a physical device", profiles: [], errors: [], hashes: Object.fromEntries(["styles.css", "gaia-mode-loader.js", "index.html"].map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
if (before) {
  report.baselineCommit = execFileSync("git", ["rev-parse", baselineRef], { encoding: "utf8" }).trim();
  report.hashes["styles.css"] = createHash("sha256").update(baselineCss).digest("hex");
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const scan = () => page.evaluate(() => {
  const img = document.querySelector('.intro-visual[data-intro-visual="default"]');
  const imageBox = img.getBoundingClientRect(), stack = img.parentElement.getBoundingClientRect();
  const objectPosition = getComputedStyle(img).objectPosition.split(" ").map(value => parseFloat(value) / 100);
  const scale = Math.max(imageBox.width / img.naturalWidth, imageBox.height / img.naturalHeight);
  const imageLeft = imageBox.left + (imageBox.width - img.naturalWidth * scale) * objectPosition[0];
  const imageTop = imageBox.top + (imageBox.height - img.naturalHeight * scale) * objectPosition[1];
  // Conservative face bounds inspected in the unchanged 1672×941 key visual.
  // Map the actual object-fit crop and animated transform into viewport space.
  const faces = [
    { name: "mizuha", left: 1040, top: 322, right: 1184, bottom: 456 },
    { name: "minamo", left: 1384, top: 318, right: 1530, bottom: 456 },
  ].map(face => ({ name: face.name, left: imageLeft + face.left * scale, top: imageTop + face.top * scale, right: imageLeft + face.right * scale, bottom: imageTop + face.bottom * scale }))
    .map(face => ({ ...face, left: Math.max(face.left, stack.left), right: Math.min(face.right, stack.right), top: Math.max(face.top, stack.top), bottom: Math.min(face.bottom, stack.bottom) }))
    .filter(face => face.right > face.left && face.bottom > face.top);
  const text = [];
  const walker = document.createTreeWalker(document.querySelector('.intro-lp-hero'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || !node.parentElement.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) continue;
    const range = document.createRange(); range.selectNode(node);
    for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) text.push({ text: node.textContent.trim(), ...rect.toJSON() });
  }
  const layer = document.querySelector('#intro-layer');
  return { faces, text, imageBox: imageBox.toJSON(), stack: stack.toJSON(), objectPosition, imageNatural: [img.naturalWidth, img.naturalHeight], title: document.querySelector('#intro-title').getBoundingClientRect().toJSON(), hero: document.querySelector('.intro-lp-hero').getBoundingClientRect().toJSON(), layerOverflow: layer.scrollWidth - layer.clientWidth, documentOverflow: document.documentElement.scrollWidth - innerWidth, scrollMax: layer.scrollHeight - layer.clientHeight };
});
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, hasTouch: !!profile.touch, isMobile: !!profile.touch, reducedMotion: profile.reduced ? "reduce" : "no-preference" });
    await context.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await enforceBrowserSecurity(context, base);
    if (before) await context.route(/\/styles\.css(?:\?|$)/u, route => route.fulfill({ contentType: "text/css", body: baselineCss }));
    await context.route(`${base}/api/**`, route => route.fulfill({ status: 503, json: {} }));
    if (profile.unlocked) await context.addInitScript(() => localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({ storyVersion: 13, stepId: "festival_concept_001", clear: true, archivesUnlocked: true })));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ profile: profile.name, message: error.message }));
    const tap = async selector => profile.touch ? page.locator(selector).tap() : page.locator(selector).click();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await tap("#gaia-opening-sound-off");
    if (!profile.reduced) await tap("#gaia-opening-skip");
    await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
    await page.waitForTimeout(1200);
    if (await page.locator('#gaia-opening-route-guide').isVisible()) await page.keyboard.press('Escape');
    await tap('#gaia-opening-route-other');
    await page.waitForFunction(() => document.querySelector('#gaia-opening')?.hidden && document.querySelector('#intro-layer')?.getAttribute('aria-hidden') === 'false');
    await page.waitForFunction(() => { const img = document.querySelector('.intro-visual[data-intro-visual="default"]'); return img?.complete && img.naturalWidth > 0; });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2000);
    if (await page.locator('#intro-entry-guide').isVisible()) {
      await page.keyboard.press('Escape');
      await page.locator('#intro-entry-guide').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => !document.querySelector('.intro-entry-guide-echo'));
    }
    await page.mouse.move(2, 90);
    // A touch guide may scroll to its card on a short display. Inspect the
    // reported top-of-page composition after the guide has been dismissed.
    await page.locator('#intro-layer').evaluate(el => { el.scrollTop = 0; });
    await page.waitForTimeout(800);
    if (profile.unlocked) await page.waitForFunction(() => document.querySelector('.intro-story-return')?.textContent.includes('APEIRONCENE'), null, { timeout: 12000 });
    const initial = await scan();
    const collisions = initial.faces.flatMap(face => initial.text.filter(text => overlap(face, text) > 1).map(text => ({ face: face.name, text: text.text, area: overlap(face, text) })));
    report.profiles.push({ ...profile, initial, collisions });
    await page.screenshot({ path: path.join(output, `${profile.name}-entry.png`) });
    if (!before) {
      assert.deepEqual(collisions, [], `${profile.name}: title/copy overlaps a character face`);
      assert(initial.faces.some(face => face.name === "mizuha" && face.right - face.left >= 28 && face.bottom - face.top >= 35 && face.top >= 0 && face.bottom <= profile.height), `${profile.name}: do not hide Mizuha to avoid the text`);
      assert(initial.hero.left >= 0 && initial.hero.right <= profile.width + 1, `${profile.name}: hero extends beyond the viewport`);
      assert.equal(initial.documentOverflow, 0);
      if (!profile.touch) {
        assert.deepEqual(initial.objectPosition, [0.5, 0.5], 'Keep the existing desktop crop');
        assert.equal(initial.stack.height, profile.height, 'Keep the full-height desktop artwork');
      }
      if (profile.name === 'mobile390') {
        const resizes = [];
        for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 864 }]) {
          await page.setViewportSize(viewport);
          await page.locator('#intro-layer').evaluate(el => { el.scrollTop = 0; });
          await page.waitForTimeout(400);
          const state = await scan();
          assert(state.faces.every(face => state.text.every(text => overlap(face, text) <= 1)), 'Face clearance survives in-place rotation');
          assert.equal(state.documentOverflow, 0);
          resizes.push({ ...viewport, faces: state.faces, title: state.title });
        }
        report.profiles.at(-1).resizes = resizes;
      }
      for (const selector of ['[data-intro-path="map"]', '[data-sensor-platform-link]', '[data-character-gallery-open]', '[data-sound-gallery-open]']) {
        const action = page.locator(`#intro-path-stage ${selector}`).first();
        await action.scrollIntoViewIfNeeded();
        const box = await action.boundingBox();
        assert(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= profile.width + 1, `${profile.name}: reachable choice ${selector}`);
      }
      await page.locator('#intro-layer').evaluate(el => { el.scrollTop = 0; });
      await tap('#intro-entry-guide-replay');
      await page.locator('#intro-entry-guide').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.locator('#intro-entry-guide').waitFor({ state: 'hidden' });
      await tap('[data-intro-path="map"]');
      await page.locator('#japan-layer').waitFor({ state: 'visible' });
      await page.locator('[data-feature-close]').waitFor({ state: 'visible' });
      await tap('[data-feature-close]');
      await tap('#japan-close');
      await page.locator('#intro-layer').waitFor({ state: 'visible' });
      await tap('#intro-title-return');
      await page.waitForFunction(() => document.querySelector('#intro-layer')?.hidden && document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
      assert.deepEqual(await page.evaluate(() => globalThis.__securityViolations), []);
    }
    console.log(`${before ? 'BEFORE' : 'PASS'} ${profile.name}: ${collisions.length} face/text collisions`);
    await context.close();
  }
  if (before) assert(report.profiles.some(profile => profile.collisions.length > 0), 'Reproduce the reported face overlap');
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

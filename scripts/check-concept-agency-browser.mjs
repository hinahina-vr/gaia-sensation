import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity, securityHeaders } from "./lib/browser-security-qa.mjs";

const base = process.argv[2] || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const baselineCommit = "aaa9153116c704f14d82f48969a396b907388451";
const baselineFiles = before ? Object.fromEntries(["concept/index.html", "concept/concept.css", "concept/concept.js"].map(file => [file, execFileSync("git", ["show", `${baselineCommit}:${file}`], { encoding: "utf8", maxBuffer: 5_000_000 })])) : null;
const output = path.resolve(`artifacts/concept-agency-${before ? "before" : "v15"}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", revision: before ? "concept-9-text-baseline" : "concept-15-original-v5-restoration", before, base, testedAt: new Date().toISOString(), environment: "Local headless Chrome with CSP and desktop/mobile emulation; no live AI, personal records, or production changes", hashes: {}, checks: [], errors: [] };
for (const file of ["concept/index.html", "concept/concept.css", "concept/concept.js", ...(!before ? ["assets/concept/myth-machine-circulation-v3.png", "assets/concept/myth-possible-worlds-v1.png"] : [])]) {
  report.hashes[file] = createHash("sha256").update(baselineFiles?.[file] || fs.readFileSync(file)).digest("hex");
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
let page;
const snap = name => page.screenshot({ path: path.join(output, `${name}.png`) });
const settle = () => page.waitForTimeout(250);
try {
  for (const [width, height] of (before ? [[1440, 900], [390, 844]] : [[1440, 900], [390, 844], [320, 568], [768, 1024]])) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 390, hasTouch: width <= 768, reducedMotion: "reduce" });
    await context.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await enforceBrowserSecurity(context, base);
    if (before) await context.route(`${base}/concept/**`, route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname === "/concept/" ? "concept/index.html" : pathname.slice(1);
      if (!(file in baselineFiles)) return route.fallback();
      return route.fulfill({ body: baselineFiles[file], headers: securityHeaders, contentType: file.endsWith(".html") ? "text/html" : file.endsWith(".css") ? "text/css" : "application/javascript" });
    });
    page = await context.newPage();
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/concept/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.enhanced === "true");
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.site-header a[href="#mechanism"]').click();
    await settle();
    await snap(`${width}-mechanism`);
    const copy = await page.locator("#mechanism, #position").allTextContents();
    const characterCount = copy.join("").replace(/\s/g, "").length;
    await page.locator(".machine-figure").scrollIntoViewIfNeeded();
    await settle();
    await page.locator(".machine-figure").screenshot({ path: path.join(output, `${width}-diagram.png`), style: ".site-header, .skip-link { visibility: hidden !important; }" });
    await page.locator("#position").scrollIntoViewIfNeeded();
    await settle();
    await snap(`${width}-worlds`);
    const result = { width, height, characterCount };
    if (!before) {
      const baseline = JSON.parse(fs.readFileSync("artifacts/concept-agency-before/report.json", "utf8"));
      const baselineCharacters = baseline.checks[0].characterCount;
      result.copyReduction = 1 - characterCount / baselineCharacters;
      assert(result.copyReduction >= .5, "At least half of the old text is removed, not hidden in tabs");
      assert.equal(await page.locator(".process-tabs, .process-panel, .myth-node").count(), 0, "Retire the dense text diagram and six-tab explainer");
      assert.match(copy.join(""), /世界を選択する。/u);
      assert.match(copy.join(""), /決定論的な世界/u);
      assert.match(copy.join(""), /神託/u);
      assert.equal(await page.locator('.origin-note, #mechanism .concept-limit').count(), 0, 'Keep the requested LifeLog explanation blocks removed');
      assert.doesNotMatch(await page.locator("body").textContent(), /安田均|1987年|同書の引用|A HOMAGE/u);
      assert.equal(await page.locator(".vision-step").count(), 6);
      result.images = await page.locator("main img.myth-visual").evaluateAll(nodes => nodes.map(img => ({ src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth >= 1000, alt: img.alt, width: img.clientWidth, ratio: img.clientWidth / img.clientHeight, naturalRatio: img.naturalWidth / img.naturalHeight })));
      assert.equal(result.images.length, 2);
      for (const img of result.images) {
        assert(img.loaded && img.alt.length > 20, "Both generated diagrams load and have descriptive alternatives");
        assert(Math.abs(img.ratio - img.naturalRatio) < .01, "Illustrations are never cropped");
      }
      result.type = await page.locator(".vision-step p").evaluateAll(nodes => nodes.map(el => ({ text: el.textContent.trim().slice(0, 40), size: parseFloat(getComputedStyle(el).fontSize), width: el.clientWidth, scrollWidth: el.scrollWidth })));
      assert.equal(result.type.length, 6);
      assert(result.type.every(item => item.size >= 14 && item.scrollWidth <= item.width + 1), "Explanation stays readable without small-print overflow");
      await page.locator("[data-open-diagram]").click();
      await page.locator(".diagram-viewer").waitFor({ state: "visible" });
      assert.equal(await page.locator(".viewer-stage img").count(), 1);
      await page.locator(".viewer-stage img").evaluate(img => img.decode());
      await snap(`${width}-viewer`);
      await page.locator("[data-zoom-diagram]").click();
      await settle();
      assert.equal(await page.locator("[data-zoom-diagram]").getAttribute("aria-pressed"), "true");
      result.viewer = await page.locator(".viewer-stage").evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight }));
      assert(result.viewer.scrollWidth > result.viewer.width && result.viewer.scrollHeight > result.viewer.height);
      // Use the native scroll container, then verify the actual image moved.
      const imageBefore = await page.locator(".viewer-stage img").boundingBox();
      await page.locator(".viewer-stage").hover();
      await page.mouse.wheel(180, 240);
      await settle();
      const imageAfter = await page.locator(".viewer-stage img").boundingBox();
      assert(imageAfter.y < imageBefore.y, "Expanded illustration scrolls with native input");
      await snap(`${width}-viewer-zoomed`);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".diagram-viewer").isVisible(), false);
      assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-open-diagram")), true, "Dialog closing restores focus");
      await page.locator("#position").scrollIntoViewIfNeeded();
      await settle();
      await page.locator("#position").screenshot({ path: path.join(output, `${width}-worlds-section.png`), style: ".site-header, .skip-link { visibility: hidden !important; }" });
      await page.locator('.return-to-world a[href="#top"]').click();
      await settle();
      assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "light");
      assert.equal(await page.locator("h1").textContent(), "惑星の放課後について");
      assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
      assert(!requests.some(url => /\/api\/|openai\.com|anthropic\.com/u.test(url)), "Concept page never contacts inference or personal-data APIs");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    report.checks.push(result);
    console.log(`PASS ${before ? "baseline" : "agency"} ${width}x${height}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? "reproduced" : "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page && !page.isClosed()) await snap("failure").catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, failure: report.failure, output }));
}

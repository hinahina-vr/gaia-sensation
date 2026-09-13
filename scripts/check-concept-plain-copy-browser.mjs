import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity, securityHeaders } from "./lib/browser-security-qa.mjs";

const base = process.argv[2] || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const baseline = "aaa9153116c704f14d82f48969a396b907388451";
const output = path.resolve(`artifacts/concept-plain-copy-${before ? "before" : "v15"}`);
fs.mkdirSync(output, { recursive: true });
const files = ["concept/index.html", "concept/concept.css", "concept/concept.js"];
const sources = Object.fromEntries(files.map(file => [file, before ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8")]));
const report = { status: "running", revision: before ? "concept-9-baseline" : "concept-15-original-v5-restoration", before, baseline, testedAt: new Date().toISOString(), environment: "Local headless Chrome, CSP, desktop/mobile emulation; not physical-device or production QA", hashes: Object.fromEntries(files.map(file => [file, createHash("sha256").update(sources[file]).digest("hex")])), checks: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
let page;
try {
  for (const [width, height] of (before ? [[595, 1040]] : [[1440, 900], [595, 1040], [390, 844], [320, 568]])) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 595, hasTouch: width <= 595, reducedMotion: "reduce" });
    await enforceBrowserSecurity(context, base);
    if (before) await context.route(`${base}/concept/**`, route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname === "/concept/" ? "concept/index.html" : pathname.slice(1);
      if (!(file in sources)) return route.fallback();
      return route.fulfill({ body: sources[file], headers: securityHeaders, contentType: file.endsWith(".html") ? "text/html" : file.endsWith(".css") ? "text/css" : "application/javascript" });
    });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/concept/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.enhanced === "true");
    const copy = (await page.locator("body").textContent()).replace(/\s/gu, "");
    const opaque = ["世界は、まだ物語ではない。", "初めて神話になる", "最後まで人間である。", "基底として", "表層へ", "基底にある設計構想"];
    if (before) {
      for (const phrase of opaque.slice(0, 3)) assert(copy.includes(phrase), `Reproduce the reported copy: ${phrase}`);
      await page.locator(".world-manifesto").scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(output, `${width}-reported-closing.png`) });
    } else {
      // The owner's follow-up explicitly retains the opening title on one line.
      for (const phrase of opaque.slice(1)) assert(!copy.includes(phrase), `Opaque explanatory prose removed: ${phrase}`);
      const sections = [];
      for (const [selector, name] of [[".depth-heading", "explanation"], [".world-caption", "current-work"], [".site-footer", "footer"]]) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const section = await page.locator(selector).evaluate(el => {
          const bounds = el.getBoundingClientRect();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let clipped = false;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects()) if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.left < -1 || rect.right > innerWidth + 1) clipped = true;
          }
          return { text: el.textContent.trim(), clipped, fontSizes: [...el.querySelectorAll("p")].map(p => parseFloat(getComputedStyle(p).fontSize)) };
        });
        assert(!section.clipped, `${width}/${name}: rendered characters stay within their column`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
        sections.push({ name, ...section });
        await page.locator(selector).screenshot({ path: path.join(output, `${width}-${name}.png`), style: ".site-header, .skip-link { visibility: hidden !important; }" });
      }
      assert.match(sections[0].text, /複数のAIが、経験や会話、過去の選択/u);
      assert.match(sections[0].text, /従う必要はない。選ぶのは本人です。/u);
      assert.match(sections[1].text, /第01世界.*惑星の放課後/u);
      assert.match(sections[2].text, /CONCEPT ARCHIVE 2026/u);
      assert.equal(await page.locator('.world-caption p, .concept-limit, .footer-note').count(), 0, 'The author removed these closing explanations');
      await page.locator('.depth-heading a[href="#mechanism"]').click();
      await page.waitForTimeout(200);
      assert.equal(new URL(page.url()).hash, "#mechanism");
      const target = await page.locator("#mechanism").boundingBox();
      const header = await page.locator(".site-header").boundingBox();
      assert(target.y >= header.y + header.height - 1, "The new plain-language link clears the fixed header");
      await page.locator("[data-open-diagram]").click();
      await page.locator(".viewer-stage img").evaluate(img => img.decode());
      assert.equal(await page.locator(".viewer-stage img").getAttribute("src"), "../assets/concept/myth-machine-circulation-v3.png");
      await page.locator("[data-zoom-diagram]").click();
      assert.equal(await page.locator("[data-zoom-diagram]").getAttribute("aria-pressed"), "true");
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-open-diagram")), true);
      await page.locator('.return-to-world a[href="#top"]').click();
      await page.waitForTimeout(200);
      assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "light");
      report.checks.push({ width, height, sections, diagramNavigation: true, zoomCloseFocus: true, returnToOverview: true });
    }
    if (before) report.checks.push({ width, height, reproduced: opaque.slice(0, 3) });
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? "reproduced" : "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, failure: report.failure, output }));
}

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
const output = path.resolve(`artifacts/concept-closing-line-${before ? "before" : "v12"}`);
fs.mkdirSync(output, { recursive: true });
const files = ["concept/index.html", "concept/concept.css", "concept/concept.js"];
const sources = Object.fromEntries(files.map(file => [file, before ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8")]));
const report = { status: "running", revision: before ? "concept-9-baseline" : "concept-12-zen-background", before, baseline,
  environment: "Local Chrome with CSP and viewport emulation. The supplied image shows two lines; its original viewport is unknown. Historical baseline wrapping is reproduced at 280px without altering its markup or CSS.",
  testedAt: new Date().toISOString(), hashes: Object.fromEntries(files.map(file => [file, createHash("sha256").update(sources[file]).digest("hex")])), checks: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  for (const width of (before ? [280, 327] : [280, 320, 327, 390, 595, 1440])) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: "reduce" });
    await enforceBrowserSecurity(context, base);
    if (before) await context.route(`${base}/concept/**`, route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname === "/concept/" ? "concept/index.html" : pathname.slice(1);
      if (!(file in sources)) return route.fallback();
      return route.fulfill({ body: sources[file], headers: securityHeaders, contentType: file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" });
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/concept/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const title = page.locator(before ? ".world-manifesto p:first-child" : ".world-closing-title");
    await title.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    const measurement = await title.evaluate(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      const bounds = el.getBoundingClientRect();
      return { text: el.textContent, lines: new Set(rects.map(rect => Math.round(rect.top))).size,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        clipped: rects.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.left < -1 || rect.right > innerWidth + 1),
        pageOverflow: document.documentElement.scrollWidth - innerWidth };
    });
    report.checks.push({ width, ...measurement });
    assert.equal(measurement.text, "世界は、まだ物語ではない。");
    if (before && width === 280) assert(measurement.lines > 1, "Reproduce the historical heading wrapping on a narrow screen");
    if (!before) {
      assert.equal(measurement.lines, 1, `${width}: all rendered characters must share one line`);
      assert.equal(measurement.clipped, false, `${width}: title must fit without cropping`);
      assert.equal(measurement.pageOverflow, 0, `${width}: no horizontal scrolling`);
      assert(measurement.fontSize >= 17, "Keep a readable title size");
    }
    await page.screenshot({ path: path.join(output, `${width}-closing.png`) });
    if (!before) {
      await page.locator('.return-to-world a[href="#top"]').click();
      await page.waitForTimeout(100);
      assert.equal(new URL(page.url()).hash, "#top");
      assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "light");
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? "reproduced" : "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

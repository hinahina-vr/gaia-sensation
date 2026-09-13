import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity, securityHeaders } from "./lib/browser-security-qa.mjs";

const base = process.argv[2] || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const source = "artifacts/concept-original-v5-before";
const output = before ? source : "artifacts/concept-original-v5-v15";
fs.mkdirSync(output, { recursive: true });
const baseline = Object.fromEntries(["index.html", "concept.css", "concept.js"].map(name => [name, fs.readFileSync(path.join(source, name), "utf8")]));
const report = { status: "running", version: before ? "concept-14-reproduction" : "concept-15-original-v5-restoration", base, testedAt: new Date().toISOString(), environment: "Local Chrome desktop/mobile emulation. Diagram is explanatory artwork; no AI system or personal data processing is exercised.", hashes: {}, checks: [], errors: [] };
for (const file of ["concept/index.html", "concept/concept.css", "concept/concept.js", ...(!before ? ["assets/concept/myth-machine-circulation-v3.png"] : [])]) report.hashes[file] = createHash("sha256").update(before ? baseline[path.basename(file)] : fs.readFileSync(file)).digest("hex");
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
let page;
try {
  for (const [width, height] of (before ? [[1440, 900], [390, 844]] : [[1440, 900], [390, 844], [320, 568], [768, 1024]])) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 390, hasTouch: width <= 768, reducedMotion: "reduce" });
    await enforceBrowserSecurity(context, base);
    await context.route("**/*", route => route.request().url().startsWith(base) ? route.fallback() : route.abort());
    if (before) await context.route(`${base}/concept/**`, route => {
      const pathname = new URL(route.request().url()).pathname;
      const name = pathname === "/concept/" ? "index.html" : path.basename(pathname);
      if (!(name in baseline)) return route.fallback();
      return route.fulfill({ body: baseline[name], headers: securityHeaders, contentType: name.endsWith(".html") ? "text/html" : name.endsWith(".css") ? "text/css" : "application/javascript" });
    });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    page.on("response", response => { if (response.status() >= 400) report.errors.push(`${width}: ${response.status()} ${response.url()}`); });
    await page.goto(`${base}/concept/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.enhanced === "true");
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.site-header a[href="#mechanism"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(output, `${width}-mechanism.png`) });
    await page.locator("#machine-diagram").evaluate(img => img.decode());
    await page.locator("#mechanism").screenshot({ path: path.join(output, `${width}-mechanism-section.png`), style: ".site-header, .skip-link { visibility: hidden !important; }" });
    const copy = await page.locator("#mechanism").textContent();
    const result = { width, height, characterCount: copy.replace(/\s/gu, "").length, componentTitles: await page.locator(".vision-step h3").allTextContents() };
    if (before) {
      assert.equal(result.componentTitles.length, 4);
      assert(copy.includes("ひとつの正解にはまとめない") && copy.includes("選択肢にない道"));
      assert(!copy.includes("世界・因果報告書群") && !copy.includes("因果推論・処方的分析") && !copy.includes("神託の根拠は見せない"));
      assert.match(await page.locator("#machine-diagram").getAttribute("src"), /myth-agency-loop-v2/u);
      result.symptom = "Four-stage simplification omits distinct reports, causal/prescriptive analysis, and oracle conditions; contains author-rejected interpretation.";
    } else {
      assert.deepEqual(result.componentTitles, ["完全自己情報", "深層AI群", "私の別人格AI群", "世界・因果報告書群", "神AI", "神託"]);
      for (const text of ["Personal Akashic Records", "Deep Agent", "Simulacrum Agent", "God Agent", "Oracle Insight", "私（原型）", "因果推論・処方的分析", "神託の根拠は見せない", "因果的介入はしない", "最後の意味づけは本人に委ねる", "ラプラスの魔", "因果の流れ", "情報の流れ"]) assert(copy.includes(text), `Restore original component or condition: ${text}`);
      assert.doesNotMatch(copy, /ひとつの正解にはまとめない|選択肢にない道|私の断片を、ためる。|未来は、決まらない。|神託は、命令じゃない。|お前|大奥/u);
      const untouched = await page.evaluate(html => {
        const old = new DOMParser().parseFromString(html, "text/html");
        const clean = doc => {
          const clone = doc.querySelector("main").cloneNode(true);
          clone.querySelector("#mechanism").remove();
          return { text: clone.textContent.replace(/\s/gu, ""), images: [...clone.querySelectorAll("img")].map(img => img.getAttribute("src")), links: [...clone.querySelectorAll("a")].map(a => [a.textContent, a.getAttribute("href")]) };
        };
        return { old: clean(old), current: clean(document) };
      }, baseline["index.html"]);
      assert.deepEqual(untouched.current, untouched.old, "No unrelated concept sections, illustrations, or links change");
      result.unselectedContentPreserved = true;
      assert.equal(await page.locator(".origin-note, .mechanism-lead, .concept-limit, .footer-note, .overview-facts, .experience-footnote, .illustration-note, .world-caption p").count(), 0);
      result.image = await page.locator("#machine-diagram").evaluate(img => ({ source: img.getAttribute("src"), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, width: img.clientWidth, height: img.clientHeight }));
      assert.match(result.image.source, /myth-machine-circulation-v3\.png$/u);
      assert(result.image.naturalWidth > result.image.naturalHeight);
      assert(Math.abs(result.image.width / result.image.height - result.image.naturalWidth / result.image.naturalHeight) < .02);
      result.type = await page.locator(".vision-step p, .oracle-principles li").evaluateAll(nodes => nodes.map(el => ({ text: el.textContent, fontSize: parseFloat(getComputedStyle(el).fontSize), width: el.clientWidth, scrollWidth: el.scrollWidth })));
      assert(result.type.every(item => item.fontSize >= 14 && item.scrollWidth <= item.width + 1));
      result.legend = await page.locator(".flow-key").evaluateAll(nodes => nodes.map(el => ({ text: el.textContent, size: parseFloat(getComputedStyle(el).fontSize) })));
      assert.equal(result.legend.length, 2);
      assert(result.legend.every(item => item.size >= 12), "Both arrow legends are readable; no obsolete last-child small-print rule");
      await page.locator("[data-open-diagram]").click();
      await page.locator(".viewer-stage img").evaluate(img => img.decode());
      await page.screenshot({ path: path.join(output, `${width}-viewer.png`) });
      await page.locator("[data-zoom-diagram]").click();
      assert.equal(await page.locator("[data-zoom-diagram]").getAttribute("aria-pressed"), "true");
      result.zoom = await page.locator(".viewer-stage").evaluate(el => ({ width: el.clientWidth, height: el.clientHeight, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight }));
      assert(result.zoom.scrollWidth > result.zoom.width && result.zoom.scrollHeight > result.zoom.height);
      const imageBefore = await page.locator(".viewer-stage img").boundingBox();
      await page.locator(".viewer-stage").hover();
      await page.mouse.wheel(300, 240);
      await page.waitForTimeout(300);
      const imageAfter = await page.locator(".viewer-stage img").boundingBox();
      assert(imageAfter.x < imageBefore.x && imageAfter.y < imageBefore.y, "Native input pans the actual image in both directions");
      await page.screenshot({ path: path.join(output, `${width}-viewer-zoom.png`) });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".diagram-viewer").isVisible(), false);
      assert(await page.evaluate(() => document.activeElement.hasAttribute("data-open-diagram")));
      await page.locator('.footer-bottom a[href="#top"]').click();
      await page.waitForTimeout(300);
      assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "light");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push(result);
    console.log(`PASS original-v5 ${before ? "reproduction" : "restoration"} ${width}x${height}`);
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
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, output }));
}

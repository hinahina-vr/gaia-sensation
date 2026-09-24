import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity, securityHeaders } from "./lib/browser-security-qa.mjs";
import { conceptEditorialCopy } from "./lib/concept-editorial-copy.mjs";

const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const root = "artifacts/concept-author-oracle-2026-09-09";
const output = process.env.GAIA_OUTPUT_DIR || path.join(root, before ? "before" : "verified");
const files = ["concept/index.html", "concept/concept.css", "concept/concept.js"];
const note = "https://note.com/hinahina_vr/n/nd03dec22e46a";
fs.mkdirSync(output, { recursive: true });
if (before) for (const file of files) {
  const saved = path.join(output, path.basename(file));
  if (!fs.existsSync(saved)) fs.copyFileSync(file, saved);
}
const originals = before ? Object.fromEntries(files.map(file => [file, fs.readFileSync(path.join(output, path.basename(file)), "utf8")])) : null;
const report = { status: "running", before, version: before ? "before-author-oracle-rewrite" : "concept-20-notes-20260910", baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  environment: "Installed Chrome, local files, enforced CSP, desktop/touch emulation. Not physical phones or production. External navigation is captured then blocked; no live AI, data collection, or export.",
  hashes: Object.fromEntries([...files, "assets/concept/myth-machine-circulation-v3.png"].map(file => [file, createHash("sha256").update(originals?.[file] || fs.readFileSync(file)).digest("hex")])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height] of before ? [[1440, 900], [390, 844]] : [[1440, 900], [390, 844], [320, 568], [768, 1024]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 390, hasTouch: width <= 768, reducedMotion: "reduce" });
    await enforceBrowserSecurity(context, base);
    const requests = [];
    context.on("request", request => requests.push(request.url()));
    await context.route("**/*", route => route.request().url().startsWith(base) ? route.fallback() : route.abort());
    if (before) await context.route(`${base}/concept/**`, route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname === "/concept/" ? "concept/index.html" : pathname.slice(1);
      return originals[file] ? route.fulfill({ body: originals[file], headers: securityHeaders, contentType: file.endsWith(".html") ? "text/html" : file.endsWith(".css") ? "text/css" : "application/javascript" }) : route.fallback();
    });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    page.on("response", response => { if (response.status() >= 400 && response.url().startsWith(base)) report.errors.push(`${width}: ${response.status()} ${response.url()}`); });
    await page.goto(`${base}/concept/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.body.dataset.enhanced === "true");
    await page.locator('.site-header a[href="#learning"]').click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(output, `${width}-learning.png`) });
    if (before) {
      assert.equal(await page.locator("#learning-title").innerText(), "ZEN大学という、\n学びの舞台。");
      assert.equal(await page.locator(".university-pillar").count(), 3);
      assert.match(await page.locator(".project-note").innerText(), /本作は大学の公式作品ではなく/);
      assert.equal(await page.locator(`a[href="${note}"]`).count(), 0);
      await page.locator(".learning-courses").screenshot({ path: path.join(output, `${width}-courses.png`), style: ".site-header { visibility: hidden !important; }" });
      report.checks.push({ width, oldTitle: true, universityPromotionalBlocks: 3, noteLinkAbsent: true, disclaimerInMain: true });
      await context.close(); continue;
    }
    assert.equal((await page.locator("#learning-title").textContent()).replace(/\s/g, ""), "ZEN大学の講義から、惑星の放課後へ。");
    assert.equal(await page.locator(".university-pillars, .university-pillar").count(), 0);
    assert.equal(await page.locator('.author-profile').count(), 0);
    assert.equal(await page.locator('.site-footer .author-colophon > p').count(), 2);
    const profile = await page.locator(".author-colophon").innerText();
    for (const text of ["ひなひな", "知能情報社会学部1期生", "映像制作と", "note"]) assert(profile.includes(text), `Colophon retains the remaining user-confirmed facts: ${text}`);
    assert.doesNotMatch(profile, /法学部|SIer|社内AI導入|BMS/u);
    assert.equal(await page.locator('.footer-bottom > span').textContent(), `${conceptEditorialCopy.footerBrand} / CONCEPT ARCHIVE 2026`);
    assert.equal(await page.locator('#mechanism-title').textContent(), conceptEditorialCopy.mechanismTitle);
    assert.equal(await page.locator('.site-header a[href="#mechanism"]').textContent(), conceptEditorialCopy.mechanismNav);
    assert.deepEqual(await page.locator('.overview-description').allTextContents(), conceptEditorialCopy.overview);
    assert.equal(await page.locator('.experience-meet .experience-detail').textContent(), conceptEditorialCopy.storyExperienceDetail);
    assert.match(await page.locator(".project-note").innerText(), /ZEN大学の卒業プロジェクトを見据えて/);
    assert.doesNotMatch(await page.locator("main").innerText(), /本作は大学の公式作品ではなく|制作・監修・公認|物語はフィクション/);
    const disclaimer = await page.locator(".work-disclaimer").innerText();
    for (const text of ["ZEN大学", "個人による", "制作・監修・公認", "フィクション"]) assert(disclaimer.includes(text));
    assert.equal(await page.locator(".site-footer > .work-disclaimer + .build-info:last-child").count(), 1, "Keep the disclaimer intact, followed only by the build identity");
    assert.deepEqual(await page.locator(".learning-courses h3").allTextContents(), ["共創地球論", "人新世の人類学", "リテラシーと応用のための物語理論", "統計学入門"]);
    for (const [index, course] of (await page.locator(".learning-courses > li").all()).entries()) {
      assert.deepEqual(await course.locator("p").allTextContents(), conceptEditorialCopy.learning.courses[index], "Keep exactly the two retained paragraphs per course");
      assert.match(await course.locator("a").getAttribute("href"), /^https:\/\/syllabus\.zen\.ac\.jp\/subjects\/2026\//);
    }
    assert.deepEqual(await page.locator(".oracle-principles h4").allTextContents(), ["根拠は見せない", "因果的介入をしない", "最後の意味づけは本人に委ねる"]);
    const principleMarkers = await page.locator('.oracle-principles > li').evaluateAll(nodes => nodes.map(node => ({before: getComputedStyle(node, '::before').content, listStyle: getComputedStyle(node).listStyleType, headingMargin: getComputedStyle(node.querySelector('h4')).marginTop})));
    assert(principleMarkers.length === 3 && principleMarkers.every(marker => ['none', 'normal'].includes(marker.before) && marker.listStyle === 'none' && marker.headingMargin === '0px'), 'Remove the 01/02/03 generated counters and their reserved heading gap');
    assert.deepEqual(await page.locator('.depth-description').allTextContents(), conceptEditorialCopy.depth, 'Keep all three owner-supplied paragraphs verbatim and in order');
    assert.equal(await page.locator(".oracle-evidence-note").count(), 0);
    assert.match(await page.locator(".agency-sting").innerText(), /おすすめ順/);
    assert.deepEqual(await page.locator('.agency-closing > p').allTextContents(), conceptEditorialCopy.closing.map(lines => lines.join('')), 'Keep only the two retained closing paragraphs');
    assert.equal(await page.locator(".vision-step").count(), 6);
    assert.deepEqual(await page.locator('.vision-step h3').allTextContents(), conceptEditorialCopy.components.map(item => item[0]));
    assert.deepEqual(await page.locator('.vision-step p').allTextContents(), conceptEditorialCopy.components.map(item => item[1]), 'All six replacement descriptions match the supplied copy, including punctuation and spaces');
    assert.equal(await page.locator('.machine-figure figcaption').textContent(), '金色：因果の流れ青紫：情報の流れ', 'Keep only the diagram color legend');
    const selected = ["#top", ".experience-meet", ".author-colophon", ".university-story", ".learning-courses", ".project-note", "#depth", ".oracle-ethics", ".mechanism-heading", ".vision-steps", ".agency-closing", ".agency-sting", ".site-footer"];
    for (const selector of selected) {
      const element = page.locator(selector);
      await element.scrollIntoViewIfNeeded();
      await page.waitForTimeout(90);
      if (selector === '.vision-steps') {
        const endings = await element.locator('p > .copy-phrase').evaluateAll(nodes => nodes.map(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          return {text: node.textContent, lines: new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size};
        }));
        assert(endings.length === 6 && endings.every(ending => ending.lines === 1), 'Each component keeps its ending together instead of orphaning a final syllable');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${width}/${selector}: no horizontal overflow`);
      const clipped = await element.locator("p, h2, h3, h4, a").evaluateAll(nodes => nodes.filter(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return [...range.getClientRects()].some(rect => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1));
      }).map(node => node.textContent.slice(0, 70)));
      assert.deepEqual(clipped, [], `${width}/${selector}: real text fits width`);
      if (["#top", ".experience-meet", ".author-colophon", ".learning-courses", ".oracle-ethics", ".mechanism-heading", ".vision-steps", ".agency-closing", ".agency-sting", ".site-footer"].includes(selector)) await element.screenshot({ path: path.join(output, `${width}-${selector.slice(1)}.png`), style: ".site-header, .skip-link { visibility: hidden !important; }" });
    }
    const bodySizes = await page.locator(".author-profile > p:not(.university-kicker), .learning-courses li > p, .oracle-principles p").evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
    assert(bodySizes.every(size => size >= 14), "Substantial new body copy is never small-print");
    await page.locator('.site-header a[href="#depth"]').click();
    await page.waitForFunction(() => document.querySelector(".site-header").dataset.theme === "deep");
    await page.screenshot({ path: path.join(output, `${width}-depth.png`) });
    const depthPhrases = await page.locator('.depth-description .copy-phrase').evaluateAll(nodes => nodes.map(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return { text: node.textContent, lines: new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size };
    }));
    assert(depthPhrases.length > 10 && depthPhrases.every(phrase => phrase.lines === 1), 'Keep every depth-introduction phrase on one painted line');
    await page.locator('.depth-heading').screenshot({ path: path.join(output, `${width}-depth-copy.png`), style: '.site-header, .skip-link { visibility: hidden !important; }' });
    await page.locator("[data-open-diagram]").click();
    assert(await page.locator("dialog").evaluate(node => node.open));
    await page.locator("[data-zoom-diagram]").click();
    assert.equal(await page.locator("[data-zoom-diagram]").getAttribute("aria-pressed"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(":focus").getAttribute("data-open-diagram"), "");
    await page.locator('.site-footer a[href="#top"]').click();
    await page.waitForFunction(() => document.querySelector(".site-header").dataset.theme === "light");
    const link = page.locator(`a[href="${note}"]`);
    assert.equal(await link.count(), 1, "One quiet note link, not a repeated campaign");
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.match(await link.getAttribute("rel"), /noopener/);
    const popupEvent = page.waitForEvent("popup");
    await link.click(); const popup = await popupEvent;
    await page.waitForTimeout(100);
    assert(requests.includes(note), "Actual note-link click attempts the verified article, with external loading blocked");
    await popup.close();
    assert(!requests.some(url => /\/(api|telemetry)\//.test(url)), "Reading the concept never starts personal-record collection");
    report.checks.push({ width, height, authorColophon: true, courses: 4, detailedPrinciples: 3, footerOnlyDisclaimer: true, noteClick: true, noClippedCopy: true, diagramAndTheme: true });
    console.log(`PASS ${width}x${height}: author, courses, oracle, footer, note click, layout and existing reader controls`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close();
}

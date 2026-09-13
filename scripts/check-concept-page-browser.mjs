import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

const [base = "http://127.0.0.1:4447", output = "artifacts/concept-page-v16"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", version: "concept-18-editorial-20260910", base, testedAt: new Date().toISOString(), environment: "Local Chrome with desktop/mobile emulation and CSP; no AI or live-provider integration", checks: [], errors: [], hashes: {} };
for (const file of ["concept/index.html", "concept/concept.css", "concept/concept.js", "assets/concept/myth-machine-circulation-v3.png", "assets/concept/myth-possible-worlds-v1.png", "assets/concept/brochure-map-co2-v1.webp", "assets/concept/brochure-map-energy-v1.webp", "assets/concept/brochure-map-currents-v1.webp", "assets/concept/brochure-meet-v1.webp", ...["earth", "ribbon", "learning", "archive"].map(name => `assets/concept/brochure-ornament-${name}-v1.webp`)]) {
  report.hashes[file] = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let currentPage;
const snap = (page, name, fullPage = false) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage });
const settle = page => page.waitForTimeout(950);
const checkOverflow = async (page, name) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${name}: horizontal page overflow`);

// Check the rendered small-copy regression, not just a CSS declaration. The light
// reading surfaces are opaque; a conservative 4.5 floor applies even to labels.
const checkReadingType = async (page, width) => {
  const selectors = [".overview-description", ".experience-copy > p:not(.experience-label)", ".learning-copy p", ".project-note p", ".brochure-scene figcaption div > span", ".experience-figure figcaption", ".experience-figure figcaption span", ".illustration-note", ".learning-reference-label span", ".overview-facts dt", ".overview-facts dd", ".experience-footnote", ".university-pillar > p", ".university-story > p", ".learning-courses li > p", ".source-link"];
  const readings = await page.locator(selectors.join(",")).evaluateAll(nodes => {
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const luminance = channels => channels.slice(0, 3).map(channel => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    return nodes.map(el => {
      const style = getComputedStyle(el);
      const color = rgb(style.color);
      let background;
      let opacity = 1;
      for (let parent = el; parent; parent = parent.parentElement) {
        const computed = getComputedStyle(parent);
        opacity *= Number(computed.opacity);
        const candidate = rgb(computed.backgroundColor);
        if (!background && (candidate[3] ?? 1) === 1) background = candidate;
      }
      if (!background) throw new Error("Text contrast check needs an opaque reading surface");
      const foregroundLuminance = luminance(color);
      const backgroundLuminance = luminance(background);
      const body = el.matches(".overview-description, .experience-copy > p:not(.experience-label), .learning-copy p, .project-note p, .university-pillar > p:not(.university-kicker), .university-story > p:not(.university-kicker):not(.fiction-note), .learning-courses li > p");
      return { text: el.textContent.trim().slice(0, 52), body, fontFamily: style.fontFamily, fontSize: parseFloat(style.fontSize), fontWeight: style.fontWeight, color: style.color, background, opacity, contrast: (Math.max(foregroundLuminance, backgroundLuminance) + .05) / (Math.min(foregroundLuminance, backgroundLuminance) + .05) };
    });
  });
  const cdp = await page.context().newCDPSession(page);
  let actualFonts;
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".experience-detail" });
    actualFonts = (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
  } finally { await cdp.detach(); }
  // Store diagnostics even if an assertion fails against the old version.
  report.typography ??= [];
  report.typography.push({ width, actualFonts, readings });
  for (const reading of readings) {
    assert(reading.contrast >= 4.5, `${width}: text contrast ${reading.contrast.toFixed(2)} is too low: ${reading.text}`);
    assert(reading.fontSize >= (reading.body ? 14 : 11), `${width}: reading size ${reading.fontSize}px is too small: ${reading.text}`);
    assert.match(reading.fontFamily, /^Meiryo,/u, "Use the solid-stroke body font before Yu Gothic on Windows");
    assert.equal(reading.opacity, 1, "Settled reading copy must not be faded by its ancestors");
  }
  if (process.platform === "win32") assert(actualFonts.some(font => font.familyName === "Meiryo" && font.glyphCount > 0), "Verify the actual Windows font used to paint the Japanese copy");
};

try {
  for (const [width, height, reduced] of [[1440, 900, false], [390, 844, false], [320, 568, true], [768, 1024, false], [3840, 2160, false]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 390, hasTouch: width <= 768, reducedMotion: reduced ? "reduce" : "no-preference" });
    await enforceBrowserSecurity(context, base);
    const page = currentPage = await context.newPage();
    const requests = [];
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    page.on("request", request => requests.push({ url: request.url(), method: request.method() }));
    page.on("response", response => { if (response.status() >= 400) report.errors.push(`${width}: ${response.status()} ${response.url()}`); });
    await page.goto(`${base}/concept/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.enhanced === "true");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(reduced ? 100 : 1900);
    assert.equal(await page.locator("img.editorial-art").count(), 4, "Four distinct ImageGen chapter ornaments must be present, separate from real mode screenshots");
    const ornaments = await page.locator("img.editorial-art").evaluateAll(nodes => nodes.map(img => ({ src: img.getAttribute("src"), alt: img.alt, decorative: Boolean(img.closest('[aria-hidden="true"]')), pointerEvents: getComputedStyle(img).pointerEvents })));
    assert.equal(new Set(ornaments.map(img => img.src)).size, 4);
    assert(ornaments.every(img => img.alt === "" && img.decorative && img.pointerEvents === "none"), "Decorative images must not interrupt assistive reading or pointer input");
    assert.equal(await page.locator("h1").textContent(), "『惑星の放課後』とは", "Landing must read as a work overview, not a repeated opening");
    assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "light");
    assert.equal(await page.locator(".world-surface").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(245, 251, 249)");
    assert.equal(await page.locator('.hero-art, #top button, #top video, #top audio').count(), 0);
    assert(!requests.some(request => /opening-keyvisual|opening\.js|opening-audio/u.test(request.url)), "Overview must not load the opening illustration or runtime");
    const overview = await page.locator("#top").evaluate(el => {
      const description = el.querySelector(".overview-description");
      return { height: el.getBoundingClientRect().height, minimumHeight: getComputedStyle(el).minHeight, description: description?.getBoundingClientRect().toJSON(), animatedElements: [el, ...el.querySelectorAll("*")].filter(node => getComputedStyle(node).animationName !== "none").length };
    });
    assert.equal(overview.minimumHeight, "0px", "Overview must not reserve a fullscreen opening stage");
    assert.equal(overview.animatedElements, 0, "Overview copy appears directly without an arrival sequence");
    assert(overview.description && overview.description.bottom < height, `${width}: concrete work description is readable on the first screen`);
    const illustration = await page.locator(".brochure-scene").boundingBox();
    const introCopy = await page.locator(".overview-copy").boundingBox();
    assert(illustration, "Brochure begins with a framed, captioned illustration");
    if (width >= 900) {
      assert(introCopy.height > 0, `${width}: the complete supplied introduction is rendered`);
      assert(illustration.x >= introCopy.x + introCopy.width, "Brochure picture sits beside the explanation, never behind it");
      assert(illustration.y < height && illustration.y + illustration.height <= height, "Desktop brochure illustration is visible on the first screen");
    } else assert(illustration.y >= introCopy.y + introCopy.height, "Narrow brochure stacks copy before illustration without overlap");
    const readingOrder = await page.evaluate(() => ["top", "first-world", "learning", "surface", "depth", "mechanism"].map(id => ({ id, y: document.getElementById(id).getBoundingClientRect().top + scrollY })));
    assert(readingOrder.every((section, i) => !i || section.y > readingOrder[i - 1].y), "Visual order must match work-first reading order");
    await snap(page, `${width}-overview`);
    await checkOverflow(page, `${width}/overview`);
    const heading = await page.locator("h1").boundingBox();
    const header = await page.locator(".site-header").boundingBox();
    assert(heading.x >= 0 && heading.x + heading.width <= width && heading.y > header.y + header.height, `${width}: heading is below header and within viewport`);
    const text = await page.locator("body").textContent();
    assert(!/公開予定|近日登場|安田均|A HOMAGE/u.test(text));
    assert(text.includes("自己決定権を留保します") && text.includes("主体性を取り戻すための試み"));
    assert.equal(await page.locator('#question, .oracle-evidence-note').count(), 0);
    assert.equal(await page.locator('.overview-topics, .vision-agent, #position, .world-illustration, .world-caption, .world-closing-title').count(), 0);
    assert.deepEqual(await page.locator(".vision-step h3").allTextContents(), ["完全自己情報", "深層知性群", "多元我（別人格群）", "世界・因果報告書群", "神格アーキテクチャ", "神託"]);
    assert.equal(await page.locator(".process-tabs, .process-panel, .myth-node").count(), 0);
    assert.equal(await page.locator('.overview-facts, .experience-footnote, .illustration-note, .mechanism-lead, .origin-note, .concept-limit, .footer-note, .world-caption p').count(), 0, "The requested supplementary blocks are removed, not hidden");
    assert.equal(await page.locator('main img[src*="myth-machine-circulation-v3"]').count(), 1);
    await page.locator('.site-header a[href="#first-world"]').click();
    await settle(page);
    const anchor = await page.locator("#first-world").boundingBox();
    assert(anchor.y >= header.height - 1 && anchor.y < header.height + 150, `${width}: anchor clears fixed header`);
    assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "light");
    await snap(page, `${width}-work-intro`);
    await page.locator('.site-header a[href="#learning"]').click();
    await settle(page);
    const learningAnchor = await page.locator("#learning").boundingBox();
    assert(learningAnchor.y >= header.height - 1, "Academic background anchor clears header");
    assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "light");
    assert.deepEqual(await page.locator(".learning-courses h3").allTextContents(), ["共創地球論", "人新世の人類学", "リテラシーと応用のための物語理論", "統計学入門"]);
    assert.equal(await page.locator('.learning-copy, .learning-lead, a[href*="education_mission"]').count(), 0);
    assert.equal(await page.locator('.university-pillar').count(), 0);
    assert.equal(await page.locator('.author-profile').count(), 0);
    assert.equal(await page.locator('.site-footer .author-colophon > p').count(), 2);
    assert.equal(await page.locator('.learning-courses a[href^="https://syllabus.zen.ac.jp/subjects/2026/"]').count(), 4);
    assert.doesNotMatch(text, /お前|大奥|自分にとっての実感|意味を持つ体験/u);
    assert.match(text, /選択肢のない一本道のビジュアルノベル/u);
    for (const selector of ['.author-colophon', '.university-story', '.learning-courses', '.project-note', '.oracle-ethics']) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await settle(page);
      await page.locator(selector).screenshot({ path: path.join(output, `${width}-${selector.replace(/^[#.]/u, '')}.png`), style: '.site-header, .skip-link { visibility: hidden !important; }' });
    }
    await page.locator('.site-header a[href="#learning"]').click();
    await settle(page);
    await snap(page, `${width}-learning`);
    await page.locator('.site-header a[href="#depth"]').click();
    await settle(page);
    assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "deep");
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute("content"), "#07111d");
    await snap(page, `${width}-depth`);
    assert.equal(await page.locator(".experience-figure img").count(), 3);
    assert.equal(await page.locator(".experience-figure figcaption").count(), 3);
    assert.match(await page.locator(".brochure-picture img").getAttribute("src"), /brochure-map-co2-v1\.webp$/u);
    assert.match(await page.locator(".experience-explore img").getAttribute("src"), /brochure-map-energy-v1\.webp$/u);
    assert.match(await page.locator(".experience-feel img").getAttribute("src"), /brochure-map-currents-v1\.webp$/u);
    assert.match(await page.locator(".experience-meet img").getAttribute("src"), /brochure-meet-v1\.webp$/u);
    assert.equal(await page.locator('.world-surface img:not(.editorial-art):not([src*="brochure-map-"]):not([src*="brochure-meet-"])').count(), 0, "Real mode screenshots and the third game panel remain separate from editorial art");
    for (const selector of [".brochure-scene", ".editorial-ribbon", "#first-world", ".experience-explore", ".experience-feel", ".experience-meet", "#learning", ".learning-courses", ".learning-plate", ".project-note", "#surface", "#depth", ".archive-frontispiece", "#mechanism", ".machine-figure", ".vision-steps", ".agency-closing", ".site-footer"]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(60);
      await checkOverflow(page, `${width}/${selector}`);
    }
    for (const [selector, name] of [["#machine-diagram", "machine"], [".agency-closing", "agency"]]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await settle(page);
      // A tall element capture temporarily changes the viewport. Suppress only
      // fixed navigation in these isolated plates; normal viewport/full-page
      // evidence above retains the real header and keyboard skip link.
      await page.locator(selector).screenshot({ path: path.join(output, `${width}-${name}.png`), style: '.site-header, .skip-link { visibility: hidden !important; }' });
    }
    for (const figure of await page.locator(".experience-figure").all()) {
      const picture = await figure.locator("img").boundingBox();
      const caption = await figure.locator("figcaption").boundingBox();
      assert(picture.height > 100 && caption.y >= picture.y + picture.height - 1, `${width}: illustrations and their captions are separate and legible`);
    }
    assert.equal(await page.locator(".world-experiences").evaluate(el => getComputedStyle(el).flexDirection), "column", "Use editorial spreads instead of a generic three-card grid");
    for (const [index, article] of (await page.locator(".world-experience").all()).entries()) {
      const picture = await article.locator(".experience-figure").boundingBox();
      const copy = await article.locator(".experience-heading").boundingBox();
      if (width > 600) {
        assert(index === 1 ? picture.x >= copy.x + copy.width : copy.x >= picture.x + picture.width, "Alternate real mode imagery with adjacent headings");
        const paragraphs = await article.locator('.experience-copy > p').all();
        for (const paragraph of paragraphs) assert((await paragraph.boundingBox()).y >= picture.y + picture.height, "Description rows span below the image and heading");
      } else assert(copy.y >= picture.y + picture.height, "Mobile spread keeps image then copy without overlap");
    }
    for (const art of await page.locator("img.editorial-art").all()) {
      await art.scrollIntoViewIfNeeded();
      const bounds = await art.boundingBox();
      assert(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `${width}: editorial art stays within its page edge`);
    }
    await page.locator(".world-experiences").scrollIntoViewIfNeeded();
    await settle(page);
    await page.locator(".world-experiences").screenshot({ path: path.join(output, `${width}-illustrated-experiences.png`) });
    await page.locator(".learning-plate").screenshot({ path: path.join(output, `${width}-learning-plate.png`) });
    await page.locator(".editorial-ribbon").screenshot({ path: path.join(output, `${width}-ribbon.png`) });
    await page.locator(".archive-frontispiece").screenshot({ path: path.join(output, `${width}-archive-plate.png`) });
    // All reveal sections above were visited and settled; capture the exact
    // reported card paragraphs before asserting their minimum size and contrast.
    if (width === 1440 || width === 390) await page.locator(".experience-explore").screenshot({ path: path.join(output, `${width}-reading-detail.png`) });
    await checkReadingType(page, width);
    const images = await page.locator("main img").evaluateAll(nodes => nodes.map(img => ({ src: img.getAttribute("src"), complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, width: Number(img.getAttribute("width")), height: Number(img.getAttribute("height")) })));
    for (const img of images) {
      assert(img.complete && img.naturalWidth > 0, `${width}: image did not decode: ${img.src}`);
      assert.equal(img.width, img.naturalWidth, `${img.src}: declared width matches selected asset`);
      assert.equal(img.height, img.naturalHeight, `${img.src}: declared height matches selected asset`);
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await settle(page);
    await snap(page, `${width}-full`, true);
    assert.equal(await page.locator(".site-header").getAttribute("data-theme"), "light", "Returning to the work restores its light header");
    await page.locator(".threshold-copy").scrollIntoViewIfNeeded();
    await settle(page);
    await snap(page, `${width}-threshold`);

    assert.equal(await page.locator(".vision-step").count(), 6, "All component explanations remain immediately readable");

    await page.locator("[data-open-diagram]").click();
    assert(await page.locator("dialog").evaluate(el => el.open));
    assert.equal(await page.locator(".viewer-stage img.myth-visual").count(), 1);
    assert.equal(await page.locator('#machine-diagram').count(), 1, "The reader copy must not duplicate element IDs");
    assert.equal(await page.locator(":focus").getAttribute("data-close-diagram"), "");
    const fit = await page.locator(".viewer-stage").evaluate(el => {
      const diagram = el.querySelector("img.myth-visual");
      return { stage: el.getBoundingClientRect().toJSON(), diagram: diagram.getBoundingClientRect().toJSON(), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    assert(fit.diagram.top >= fit.stage.top && fit.diagram.right <= fit.stage.right + 1, `${width}: regular view fits width and shows the complete illustration`);
    assert.equal(fit.scrollWidth, fit.clientWidth, "Regular illustration must not require horizontal scrolling");
    await page.locator(".viewer-stage").evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert(await page.locator(".viewer-stage").evaluate(el => { const item = el.querySelector("img").getBoundingClientRect(); const box = el.getBoundingClientRect(); return item.bottom <= box.bottom + 1; }), "The human-choice end remains reachable by scrolling");
    await page.locator('.viewer-stage').evaluate(el => el.scrollTo(0, 0));
    await snap(page, `${width}-diagram-fit`);
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      assert(await page.locator(":focus").evaluate(el => Boolean(el.closest("dialog"))), "Modal keeps keyboard focus inside");
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Shift+Tab");
      assert(await page.locator(":focus").evaluate(el => Boolean(el.closest("dialog"))), "Modal also wraps reverse keyboard navigation");
    }
    await page.locator("[data-zoom-diagram]").click();
    assert.equal(await page.locator("[data-zoom-diagram]").getAttribute("aria-pressed"), "true");
    const overflow = await page.locator(".viewer-stage").evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
    assert(overflow.content > overflow.width, "Zoom offers a pannable enlarged illustration");
    await page.locator(".viewer-stage").evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight; });
    assert(await page.locator(".viewer-stage").evaluate(el => el.scrollLeft > 0));
    await snap(page, `${width}-diagram-zoom`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog").open);
    assert.equal(await page.locator(":focus").getAttribute("data-open-diagram"), "");
    assert.notEqual(await page.locator("body").evaluate(el => getComputedStyle(el).overflow), "hidden");
    await page.locator("[data-open-diagram]").click();
    assert.equal(await page.locator("[data-zoom-diagram]").getAttribute("aria-pressed"), "false");
    await page.locator("[data-close-diagram]").click();
    await page.locator("[data-open-diagram]").click();
    await page.mouse.click(2, 2);
    await page.waitForFunction(() => !document.querySelector("dialog").open);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".vision-step:visible").count(), 6, "Print includes every component explanation");
    assert.equal(await page.locator("main img.myth-visual:visible").count(), 1, "Print keeps the system diagram and omits the deleted illustration");
    await page.emulateMedia({ media: "screen" });
    if (reduced) assert.equal(await page.evaluate(() => document.getAnimations().length), 0, "Reduced motion disables animation");
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert(requests.every(request => request.url.startsWith(base) && request.method === "GET"), "Concept performs only local read-only asset requests");
    report.checks.push({ width, height, reduced, overview, illustration, readingOrder, images, requestCount: requests.length, passed: ["actual map screenshots in introduction and 01/02", "game illustration only in 03", "four staff-roll courses and graduation concept framing", "work/learning/underlying idea order", "illustrated brochure spread", "three captioned experience illustrations", "editorial overview visible on first screen", "release announcements removed", "original v5 system topology and separate agents/reports/oracle", "ocean-current myth seeds and first world", "author's original concept, not an unread-book account", "daylight/deep/return themes", "layout", "image decode", "anchor", "keyboard", "modal focus", "illustration scroll and zoom/pan", "Escape", "close/backdrop", "print content", "no storage/API"] });
    await context.close();
  }

  const noJsContext = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, reducedMotion: "reduce" });
  const noJs = currentPage = await noJsContext.newPage();
  await noJs.goto(`${base}/concept/`, { waitUntil: "networkidle" });
  assert.equal(await noJs.locator(".vision-step:visible").count(), 6);
  assert.equal(await noJs.locator("main img.myth-visual:visible").count(), 1);
  assert.equal(await noJs.locator(".process-tabs:visible").count(), 0);
  assert.equal(await noJs.locator("[data-open-diagram]:visible").count(), 0);
  assert.equal(await noJs.locator(".reveal").first().evaluate(el => getComputedStyle(el).opacity), "1");
  await checkOverflow(noJs, "no-JavaScript");
  await snap(noJs, "390-no-javascript", true);
  report.checks.push({ noJavaScript: true, allExplanationsVisible: true });
  await noJsContext.close();

  // Existing story entry smoke uses local assets only, not live-service QA.
  const rootContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await rootContext.addInitScript(() => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await rootContext.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const rootPage = currentPage = await rootContext.newPage();
  const rootRequests = [];
  rootPage.on("request", request => rootRequests.push(request.url()));
  // The sensor QA server supports the public hash entry, not Pages' /story rewrite.
  await rootPage.goto(`${base}/#story`, { waitUntil: "domcontentloaded" });
  await rootPage.locator("#novel-runtime").waitFor({ state: "visible" });
  await rootPage.locator("#gaia-boot").waitFor({ state: "hidden" });
  await rootPage.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible" && document.querySelector("#novel-text")?.textContent.length > 30);
  assert.equal(await rootPage.title(), "惑星の放課後 — GAIA SENSATION");
  assert.equal(await rootPage.locator('a[href*="/concept"]').count(), 1);
  assert.equal(await rootPage.locator('#gaia-opening-concept').isVisible(), false, "The concept link is only visible on the title, not in the story");
  assert(!rootRequests.some(url => /myth-machine-|\/concept\//u.test(url)), "Existing story entry does not load concept assets");
  await snap(rootPage, "1440-existing-story");
  report.checks.push({ existingStoryEntry: true, conceptAssetsLoaded: false, externalServicesTested: false });
  await rootContext.close();
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (currentPage && !currentPage.isClosed()) await snap(currentPage, "failure").catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, report: path.join(output, "report.json") }));
}

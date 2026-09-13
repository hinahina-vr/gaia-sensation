import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4174"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/story-start-clean-transition-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    await enforceBrowserSecurity(context, baseUrl);
    await context.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.locator("#gaia-opening-sound-off").waitFor({ state: "visible", timeout: 30_000 });
    await page.locator("#gaia-opening-sound-off").click();
    await page.waitForFunction(() => !document.querySelector("#gaia-opening-skip")?.hidden);
    await page.locator("#gaia-opening-skip").click();
    await page.waitForFunction(() => !document.querySelector("#gaia-opening-final-menu")?.hidden);

    await page.evaluate(() => {
      globalThis.__gaiaStoryEntryFrames = [];
      const startedAt = performance.now();
      const sample = () => {
        const opening = document.querySelector("#gaia-opening");
        const novel = document.querySelector("#novel-layer");
        const runtime = document.querySelector("#novel-runtime");
        const chapter = document.querySelector("#novel-chapter-card");
        const prologue = document.querySelector("#gaia-story-prologue");
        const openingStyle = opening ? getComputedStyle(opening) : null;
        const novelStyle = novel ? getComputedStyle(novel) : null;
        globalThis.__gaiaStoryEntryFrames.push({
          elapsed: performance.now() - startedAt,
          prologueOpacity: prologue ? Number(getComputedStyle(prologue).opacity) : 0,
          openingHidden: opening?.hidden ?? true,
          openingOpacity: Number(openingStyle?.opacity || 0),
          novelHidden: novel?.hidden ?? true,
          novelOpacity: Number(novelStyle?.opacity || 0),
          novelVisibility: novelStyle?.visibility || "",
          novelOpenClass: novel?.classList.contains("is-open") || false,
          novelTransitionDuration: novelStyle?.transitionDuration || "",
          novelTransitionDelay: novelStyle?.transitionDelay || "",
          backgroundImage: novelStyle?.backgroundImage || "",
          entryTransition: novel?.dataset.entryTransition || "",
          runtimeReveal: novel?.dataset.runtimeReveal || "",
          stepType: novel?.dataset.stepType || "",
          runtimeVisible: Boolean(runtime && !runtime.hidden),
          chapterVisible: Boolean(chapter && !chapter.hidden),
          bodyNovelOpen: document.body.classList.contains("novel-open"),
        });
        if (performance.now() - startedAt < 24_000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    await page.locator("#gaia-opening-route-story").click();
    await page.waitForFunction(() => {
      const novel = document.querySelector("#novel-layer");
      return novel?.dataset.runtimeReveal === "revealed"
        && novel?.dataset.entryTransition === "visible"
        && novel.classList.contains("is-open");
    }, null, { timeout: 30_000 });
    await page.waitForTimeout(700);
    const frames = await page.evaluate(() => globalThis.__gaiaStoryEntryFrames || []);
    const outgoingFadeFrames = frames.filter((frame) => !frame.openingHidden && frame.openingOpacity > 0.05 && frame.openingOpacity < 0.95);
    const incomingFadeFrames = frames.filter((frame) => !frame.novelHidden && frame.novelOpacity > 0.05 && frame.novelOpacity < 0.95);
    const visibleNovelFrames = frames.filter((frame) => !frame.novelHidden && frame.novelOpacity > 0.01);
    const compositedRevealFrames = outgoingFadeFrames.filter((frame) => !frame.novelHidden && frame.novelOpacity > 0.01);
    const invalidNovelFrames = visibleNovelFrames.filter((frame) => frame.prologueOpacity < .98 && (
      !frame.backgroundImage.includes("url(")
      || (frame.stepType && frame.stepType !== "narration")
    ));
    const lastOutgoing = frames.findLast((frame) => !frame.openingHidden && frame.openingOpacity > 0.02);
    const firstIncoming = visibleNovelFrames[0];
    const uncoveredGapMs = Math.max(0, (firstIncoming?.elapsed || 0) - (lastOutgoing?.elapsed || 0));

    report.scans.push({
      viewport: viewport.name,
      frameCount: frames.length,
      outgoingFadeFrames: outgoingFadeFrames.length,
      incomingFadeFrames: incomingFadeFrames.length,
      compositedRevealFrames: compositedRevealFrames.length,
      uncoveredGapMs,
      lastOutgoing,
      firstNovelMounted: frames.find((frame) => !frame.novelHidden),
      firstNovelPreparing: frames.find((frame) => frame.entryTransition === "preparing"),
      firstNovelPaintReady: frames.find((frame) => frame.entryTransition === "paint-ready"),
      firstNovelOpenClass: frames.find((frame) => frame.novelOpenClass),
      firstIncoming,
      passed: false,
    });

    assert(outgoingFadeFrames.length >= 3, `${viewport.name}: opening did not fade out progressively`);
    assert(incomingFadeFrames.length >= 3, `${viewport.name}: story did not fade in progressively`);
    assert(compositedRevealFrames.length >= 3, `${viewport.name}: the prepared story did not fade in behind the outgoing artwork`);
    assert(visibleNovelFrames.length > 0, `${viewport.name}: story layer never became visible`);
    assert.deepEqual(invalidNovelFrames, [], `${viewport.name}: an unpainted entrance or unexpected chapter card became visible`);
    assert.equal(await page.locator('#novel-layer').getAttribute('data-step-type'), 'narration');
    assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'), 'festival_concept_001');
    assert(uncoveredGapMs <= 100, `${viewport.name}: blank handoff gap lasted ${uncoveredGapMs.toFixed(1)}ms`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-first-line-ready.png`) });
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.scans.at(-1).passed = true;
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Story start clean transition browser check passed: ${report.scans.length} viewports`);

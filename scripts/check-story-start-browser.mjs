import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/story-start-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const scan = (page) => page.evaluate(() => {
  const layer = document.querySelector("#novel-layer");
  const dialogue = document.querySelector("#novel-dialogue");
  const text = document.querySelector("#novel-text");
  const chapterCard = document.querySelector("#novel-chapter-card");
  return {
    stepId: layer?.dataset.stepId || "",
    stepType: layer?.dataset.stepType || "",
    openingNodePresent: Boolean(document.querySelector("#novel-opening-sequence")),
    openingClass: layer?.classList.contains("is-opening-sequence") || false,
    openingPhase: layer?.dataset.openingPhase || "",
    runtimeTransition: layer?.dataset.runtimeTransition || "",
    chapterVisible: Boolean(chapterCard && !chapterCard.hidden),
    dialogueVisible: Boolean(dialogue && !dialogue.hidden),
    text: text?.textContent.trim() || "",
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  };
});

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
      globalThis.GaiaNovel.open();
    });
    await page.locator("#novel-start-button").click();
    await page.waitForFunction(() => document.body.classList.contains("scene-transitioning"));
    await page.waitForTimeout(220);
    const transition = await page.evaluate(() => ({
      active: document.body.classList.contains("scene-transitioning"),
      canvasVisible: !document.querySelector("#scene-transition")?.hidden,
      titleVisible: !document.querySelector("#novel-title-screen")?.hidden,
      runtimeHidden: document.querySelector("#novel-runtime")?.hidden,
      startDisabled: document.querySelector("#novel-start-button")?.disabled,
      phase: document.querySelector("#novel-layer")?.dataset.runtimeTransition || "",
    }));
    assert.deepEqual(transition, {
      active: true,
      canvasVisible: true,
      titleVisible: true,
      runtimeHidden: true,
      startDisabled: true,
      phase: "covering",
    }, `${viewport.name}: story start transition did not cover the title before the runtime swap`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-transition.png`) });
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "section-separator");
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.runtimeReveal === "revealed");
    const chapter = await scan(page);
    assert.equal(chapter.stepId, "festival_concept_001", `${viewport.name}: first step changed`);
    assert.equal(chapter.openingNodePresent, false, `${viewport.name}: removed opening markup remains`);
    assert.equal(chapter.openingClass, false, `${viewport.name}: removed opening class remains`);
    assert.equal(chapter.openingPhase, "", `${viewport.name}: removed opening phase remains`);
    assert.equal(chapter.runtimeTransition, "complete", `${viewport.name}: story start transition did not finish`);
    assert.equal(chapter.chapterVisible, true, `${viewport.name}: initial chapter card is missing`);
    assert.equal(chapter.dialogueVisible, false, `${viewport.name}: dialogue appeared under the chapter card`);

    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "narration", null, { timeout: 5_000 });
    await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete", null, { timeout: 5_000 });
    const firstLine = await scan(page);
    assert.equal(firstLine.stepId, "festival_concept_001", `${viewport.name}: start skipped the first step`);
    assert.equal(firstLine.stepType, "narration");
    assert.equal(firstLine.openingNodePresent, false);
    assert.match(firstLine.text, /海から吹く風/u, `${viewport.name}: first line did not render`);
    assert.equal(firstLine.overflowX, 0, `${viewport.name}: horizontal overflow`);
    assert.equal(firstLine.overflowY, 0, `${viewport.name}: vertical overflow`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-first-line.png`), animations: "disabled" });
    report.scans.push({ viewport: viewport.name, transition, chapter, firstLine, passed: true });
    await context.close();

    const reducedContext = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const reducedPage = await reducedContext.newPage();
    const reducedLabel = `${viewport.name}-reduced`;
    reducedPage.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${reducedLabel}: ${message.text()}`); });
    reducedPage.on("pageerror", (error) => report.pageErrors.push(`${reducedLabel}: ${error.message}`));
    reducedPage.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${reducedLabel}: ${response.url()}`); });
    await reducedPage.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await reducedPage.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await reducedPage.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
      globalThis.GaiaNovel.open();
    });
    await reducedPage.locator("#novel-start-button").click();
    await reducedPage.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.runtimeReveal === "revealed");
    const reduced = await reducedPage.evaluate(() => ({
      active: document.body.classList.contains("scene-transitioning"),
      canvasHidden: document.querySelector("#scene-transition")?.hidden,
      titleHidden: document.querySelector("#novel-title-screen")?.hidden,
      runtimeVisible: !document.querySelector("#novel-runtime")?.hidden,
      phase: document.querySelector("#novel-layer")?.dataset.runtimeTransition || "",
      stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
    }));
    assert.deepEqual(reduced, {
      active: false,
      canvasHidden: true,
      titleHidden: true,
      runtimeVisible: true,
      phase: "reduced",
      stepId: "festival_concept_001",
    }, `${viewport.name}: reduced motion did not use the immediate story start path`);
    report.scans.at(-1).reduced = reduced;
    await reducedContext.close();
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

console.log(`Story start browser check passed: ${report.scans.length} viewports`);

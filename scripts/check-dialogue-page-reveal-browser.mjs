import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4174"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/dialogue-page-reveal-browser");
fs.mkdirSync(outputDir, { recursive: true });

// 003 is now a short 38-character narration. Use the actual long GX dialogue
// so this remains a multi-page regression on the current approved script.
const target = { id: "gx_experience_010", sceneId: "gx_experience" };
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, target, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const snapshot = (page) => page.evaluate(() => {
  const text = document.querySelector("#novel-text");
  return {
    pageCount: Number(text?.dataset.pageCount || 0),
    pageIndex: Number(text?.dataset.pageIndex || 0),
    revealState: text?.dataset.revealState || "",
    revealCount: Number(text?.dataset.revealCount || 0),
    sourceLength: Array.from(text?.getAttribute("aria-label") || "").length,
    visibleGlyphs: [...(text?.querySelectorAll(".novel-reveal-glyph") || [])]
      .filter((glyph) => glyph.classList.contains("is-visible")).length,
  };
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await page.evaluate(() => GaiaNovel.open());
    await page.evaluate(({ stepId, sceneId }) => {
      const progress = {
        storyVersion: globalThis.GAIA_NOVEL_STORY.storyVersion,
        stepId,
        reachedSceneIds: [sceneId],
        viewed: {},
        evesRoute: [],
        observationOrder: "LOCAL_FIRST",
        editorialChoice: null,
        reflectionIds: [],
        resultTone: null,
        demoInterest: "",
        metCharacters: { mizuha: true, amane: true, sakuya: true },
        audio: { muted: true, volume: 0 },
        readStepIds: [],
        clear: false,
        archivesUnlocked: false,
        sessionId: `dialogue-page-reveal-${innerWidth}`,
      };
      localStorage.clear();
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 50, reducedMotion: false }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
    }, { stepId: target.id, sceneId: target.sceneId });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction((stepId) => document.querySelector("#novel-layer")?.dataset.stepId === stepId, target.id, { timeout: 20_000 });
    await page.waitForFunction(() => Number(document.querySelector("#novel-text")?.dataset.pageCount || 0) > 1, null, { timeout: 20_000 });
    await page.waitForFunction(() => {
      const text = document.querySelector("#novel-text");
      return text?.dataset.revealState === "running" && Number(text?.dataset.revealCount || 0) >= 2;
    }, null, { timeout: 20_000 });

    await page.setViewportSize({ width: viewport.width - 2, height: viewport.height });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.locator("#novel-dialogue").click();
    await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
    await page.waitForFunction(() => Number(document.querySelector("#novel-text")?.dataset.pageCount || 0) > 1, null, { timeout: 20_000 });
    await page.waitForTimeout(360);
    const firstPage = await snapshot(page);
    assert.equal(firstPage.pageIndex, 1, `${viewport.name}: resize reflow moved off page one`);

    await page.locator("#novel-dialogue").click();
    await page.waitForFunction(() => Number(document.querySelector("#novel-text")?.dataset.pageIndex || 0) === 2);
    const secondPageStart = await snapshot(page);
    assert.notEqual(secondPageStart.revealState, "complete", `${viewport.name}: page two inherited the completed reveal state`);
    assert(secondPageStart.revealCount < secondPageStart.sourceLength, `${viewport.name}: page two appeared in full immediately`);
    await page.waitForFunction(() => {
      const text = document.querySelector("#novel-text");
      const count = Number(text?.dataset.revealCount || 0);
      const length = Array.from(text?.getAttribute("aria-label") || "").length;
      return text?.dataset.pageIndex === "2" && count >= 2 && count < length;
    });
    const secondPageProgress = await snapshot(page);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-page-2-revealing.png`) });
    await page.locator("#novel-dialogue").click();
    await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
    const secondPageComplete = await snapshot(page);
    assert.equal(secondPageComplete.revealCount, secondPageComplete.sourceLength, `${viewport.name}: page two did not complete cleanly`);
    report.scans.push({ viewport, firstPage, secondPageStart, secondPageProgress, secondPageComplete, passed: true });
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

console.log(`Dialogue page reveal browser check passed: ${report.scans.length} viewports`);

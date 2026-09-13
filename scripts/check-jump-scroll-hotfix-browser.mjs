import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4316"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument || "artifacts/jump-scroll-hotfix");
fs.mkdirSync(outputDir, { recursive: true });
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of [{ name: "pc-1440", width: 1440, height: 900 }, { name: "mobile-390", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await page.evaluate(() => {
      const story = globalThis.GAIA_NOVEL_STORY;
      const stepId = story.scenes[0].steps.find((step) => ["dialogue", "narration"].includes(step.type))?.id || story.scenes[0].steps[0].id;
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({ storyVersion: story.storyVersion, stepId, reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null, metCharacters: { mizuha: false, amane: false, sakuya: false }, audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false, sessionId: "jump-scroll-hotfix" }));
      localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => globalThis.GaiaNovel.open());
    await page.locator("#novel-resume-button").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId);
    await page.locator("#novel-jump-button").click();
    await page.locator("#novel-jump-panel").waitFor({ state: "visible" });
    const before = await page.evaluate(() => {
      const panel = document.querySelector("#novel-jump-panel");
      const list = document.querySelector("#novel-jump-list");
      const panelRect = panel.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const top = document.elementsFromPoint(listRect.left + listRect.width / 2, listRect.top + listRect.height / 2)[0];
      return {
        itemCount: list.querySelectorAll(".novel-jump-item").length,
        scrollTop: list.scrollTop,
        clientHeight: list.clientHeight,
        scrollHeight: list.scrollHeight,
        overflowY: getComputedStyle(list).overflowY,
        overscroll: getComputedStyle(list).overscrollBehavior,
        touchAction: getComputedStyle(list).touchAction,
        panelOverscroll: getComputedStyle(panel).overscrollBehavior,
        panelTouchAction: getComputedStyle(panel).touchAction,
        panelContained: panelRect.left >= -1 && panelRect.top >= -1 && panelRect.right <= innerWidth + 1 && panelRect.bottom <= innerHeight + 1,
        listFront: Boolean(top?.closest?.("#novel-jump-panel")),
        bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.equal(before.itemCount, 23);
    assert(before.scrollHeight > before.clientHeight && before.overflowY === "auto" && before.overscroll === "contain" && before.touchAction === "pan-y");
    assert(before.panelOverscroll === "contain" && before.panelTouchAction === "pan-y" && before.panelContained && before.listFront && !before.bodyOverflow);
    await page.locator("#novel-jump-list").hover();
    await page.mouse.wheel(0, 640);
    await page.waitForTimeout(100);
    const after = await page.locator("#novel-jump-list").evaluate((list) => list.scrollTop);
    assert(after > before.scrollTop, `${viewport.name}: wheel did not scroll JUMP list`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-jump-scrolled.png`), animations: "disabled" });
    await page.locator("#novel-jump-close").click();
    assert.equal(await page.locator("#novel-jump-panel").isHidden(), true);
    report.scans.push({ viewport, before, after, passed: true });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0);
  assert.equal(report.pageErrors.length, 0);
  assert.equal(report.responses404.length, 0);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log("JUMP scroll hotfix browser check passed");

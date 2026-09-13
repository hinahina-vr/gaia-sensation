import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4315"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument || "artifacts/terminal-chat-advance");
fs.mkdirSync(outputDir, { recursive: true });
const viewports = [
  { name: "pc-1440", width: 1440, height: 900, action: "button" },
  { name: "mobile-390", width: 390, height: 844, action: "keyboard" },
];
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
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
      const story = globalThis.GAIA_NOVEL_STORY;
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({
        storyVersion: story.storyVersion,
        stepId: "prologue_online_circle_007",
        reachedSceneIds: ["current_exhibition", "opening_empty_seat", "prologue_online_circle"],
        viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null,
        metCharacters: { mizuha: false, amane: false, sakuya: false },
        audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false,
        sessionId: "terminal-chat-advance",
      }));
      localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => globalThis.GaiaNovel.open());
    await page.locator("#novel-resume-button").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "prologue_online_circle_007");
    const stepId = () => page.evaluate(() => globalThis.GaiaNovel.getState().stepId);

    await page.locator(".novel-slack-thread").dispatchEvent("click", { clientX: 20, clientY: 20 });
    assert.equal(await stepId(), "prologue_online_circle_007", `${viewport.name}: advanced before chat settled`);
    await page.waitForFunction(() => !document.querySelector("#novel-layer")?.classList.contains("is-slack-entering"));
    await page.locator(".novel-slack-workspace > main > footer").click();
    assert.equal(await stepId(), "prologue_online_circle_007", `${viewport.name}: composer advanced story`);
    await page.locator(".novel-slack-thread").evaluate((thread) => {
      thread.scrollTop = Math.max(1, thread.scrollHeight - thread.clientHeight);
      thread.dispatchEvent(new Event("scroll"));
    });
    await page.locator(".novel-slack-post").last().click();
    assert.equal(await stepId(), "prologue_online_circle_007", `${viewport.name}: scroll guard failed`);
    await page.waitForTimeout(260);

    const next = page.locator(".novel-slack-next");
    await next.waitFor({ state: "visible" });
    assert.equal(await next.getAttribute("aria-label"), "次の場面へ進む");
    if (viewport.action === "button") await next.click();
    else {
      await page.locator("#novel-dialogue").focus();
      await page.keyboard.press("Enter");
    }
    await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "prologue_basil_001", null, { timeout: 10_000 });
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "section-separator", null, { timeout: 10_000 });
    const result = await page.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      sceneId: document.querySelector("#novel-layer")?.dataset.sceneId,
      stepType: document.querySelector("#novel-layer")?.dataset.stepType,
      chapterTitle: document.querySelector("#novel-chapter-title")?.getAttribute("aria-label"),
      nextCount: document.querySelectorAll(".novel-slack-next").length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(result.sceneId, "prologue_basil");
    assert.equal(result.nextCount, 0);
    assert.equal(result.overflow, false);
    report.scans.push({ viewport, result, passed: true });
    await context.close();
  }

  {
    const viewport = { name: "pc-1440-production-boundary", width: 1440, height: 900 };
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await page.evaluate(() => {
      const story = globalThis.GAIA_NOVEL_STORY;
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({
        storyVersion: story.storyVersion,
        stepId: "production_year_005",
        reachedSceneIds: ["current_exhibition", "opening_empty_seat", "prologue_online_circle", "prologue_basil", "first_meeting_hall", "festival_walk", "production_year"],
        viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null,
        metCharacters: { mizuha: true, amane: true, sakuya: true },
        audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false,
        sessionId: "production-transition-advance",
      }));
      localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => globalThis.GaiaNovel.open());
    await page.locator("#novel-resume-button").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "production_year_005");
    await page.waitForFunction(() => document.querySelector("#novel-text")?.classList.contains("is-revealed"));

    await page.locator("#novel-dialogue").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "production_year_006", null, { timeout: 10_000 });
    await page.waitForFunction(() => {
      const layer = document.querySelector("#novel-layer");
      return !layer?.classList.contains("is-background-buffered")
        && !layer?.classList.contains("is-background-releasing");
    }, null, { timeout: 10_000 });

    if (await page.locator("#novel-layer").getAttribute("data-step-type") === "temporal-transition") {
      await page.locator("#novel-layer").dispatchEvent("keydown", { key: "Enter" });
    }
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "transition");
    await page.waitForFunction(() => document.querySelector("#novel-text")?.classList.contains("is-revealed"));
    assert.equal(await page.evaluate(() => globalThis.GaiaNovel.getState().stepId), "production_year_006", "temporal card advanced more than once");

    await page.locator("#novel-dialogue").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "production_year_007", null, { timeout: 10_000 });
    await page.waitForFunction(() => {
      const layer = document.querySelector("#novel-layer");
      return !layer.classList.contains("is-background-buffered") && !layer.classList.contains("is-background-releasing");
    }, null, { timeout: 10_000 });
    const result = await page.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      stepType: document.querySelector("#novel-layer")?.dataset.stepType,
      title: document.querySelector("#novel-text")?.getAttribute("aria-label"),
      transitionLocked: document.querySelector("#novel-layer")?.classList.contains("is-background-buffered")
        || document.querySelector("#novel-layer")?.classList.contains("is-background-releasing"),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(result.stepId, "production_year_007");
    assert.equal(result.transitionLocked, false);
    assert.equal(result.overflow, false);
    report.scans.push({ viewport, result, passed: true });
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

console.log("terminal chat advance browser check passed");

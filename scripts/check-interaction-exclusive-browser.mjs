import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4316"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument || "artifacts/interaction-exclusive");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const cases = [
  { name: "mode03", stepId: "mode03_map_002", nextStepId: "mode03_map_003", modal: "#japan-layer" },
  { name: "gx", stepId: "gx_deep_time_002", nextStepId: "gx_deep_time_003", modal: "#gx-layer" },
];
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of viewports) {
    for (const testCase of cases) {
      const label = `${viewport.name}-${testCase.name}`;
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.addInitScript(() => {
        globalThis.__isVisibleForCheck = (element) => {
          if (!element || element.hidden) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
        };
      });
      page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
      page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
      page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
      await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
      await page.evaluate((stepId) => {
        const story = globalThis.GAIA_NOVEL_STORY;
        localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({
          storyVersion: story.storyVersion,
          stepId,
          reachedSceneIds: [stepId.startsWith("mode03") ? "mode03_map" : "gx_deep_time"],
          viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null,
          metCharacters: { mizuha: true, amane: true, sakuya: true },
          audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false,
          sessionId: `exclusive-${stepId}`,
        }));
        localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      }, testCase.stepId);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
      await page.evaluate(() => globalThis.GaiaNovel.open());
      await page.locator("#novel-resume-button").click();
      await page.waitForFunction((stepId) => document.querySelector("#novel-layer")?.dataset.stepId === stepId, testCase.stepId);

      const prep = await page.evaluate((modal) => ({
        lifecycle: document.body.dataset.novelInteractionState,
        storyVisible: globalThis.__isVisibleForCheck(document.querySelector("#novel-layer")),
        storyInert: document.querySelector("#novel-layer")?.inert,
        promptVisible: globalThis.__isVisibleForCheck(document.querySelector(".novel-interaction-open")),
        modalVisible: globalThis.__isVisibleForCheck(document.querySelector(modal)),
      }), testCase.modal);
      assert.deepEqual(prep, { lifecycle: "prep", storyVisible: true, storyInert: false, promptVisible: true, modalVisible: false });

      await page.locator(".novel-interaction-open").click();
      await page.waitForFunction((modal) => document.body.dataset.novelInteractionState === "open" && globalThis.__isVisibleForCheck(document.querySelector(modal)), testCase.modal);
      const stepBeforeBlockedInput = await page.evaluate(() => globalThis.GaiaNovel.getState().stepId);
      await page.locator("#novel-layer").dispatchEvent("click");
      await page.locator("#novel-layer").dispatchEvent("keydown", { key: "Enter" });
      assert.equal(await page.evaluate(() => globalThis.GaiaNovel.getState().stepId), stepBeforeBlockedInput, `${label}: background advanced`);

      const open = await page.evaluate((modal) => ({
        lifecycle: document.body.dataset.novelInteractionState,
        storyHidden: document.querySelector("#novel-layer")?.hidden,
        storyInert: document.querySelector("#novel-layer")?.inert,
        storyAriaHidden: document.querySelector("#novel-layer")?.getAttribute("aria-hidden"),
        modalVisible: globalThis.__isVisibleForCheck(document.querySelector(modal)),
        dockVisible: globalThis.__isVisibleForCheck(document.querySelector(".story-detour-dock")),
        promptVisible: globalThis.__isVisibleForCheck(document.querySelector(".novel-interaction-open")),
        gxDialogueVisible: globalThis.__isVisibleForCheck(document.querySelector("#gx-story-dialogue")),
        visibleLayerCount: ["#novel-layer", modal].filter((selector) => globalThis.__isVisibleForCheck(document.querySelector(selector))).length,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }), testCase.modal);
      assert.equal(open.lifecycle, "open");
      assert.equal(open.storyHidden, true);
      assert.equal(open.storyInert, true);
      assert.equal(open.storyAriaHidden, "true");
      assert.equal(open.modalVisible, true);
      assert.equal(open.dockVisible, true);
      assert.equal(open.promptVisible, false);
      assert.equal(open.gxDialogueVisible, false);
      assert.equal(open.visibleLayerCount, 1);
      assert.equal(open.overflow, false);
      await page.screenshot({ path: path.join(outputDir, `${label}-open.png`), fullPage: false });

      if (testCase.name === "mode03") {
        for (const text of ["森林を開く", "降水量を開く", "二つを重ねる"]) {
          await page.getByRole("button", { name: text, exact: true }).click();
        }
      } else {
        for (let index = 0; index < 3; index += 1) {
          await page.getByRole("button", { name: "段階表示を進める", exact: true }).click();
        }
      }
      const returnButton = page.locator("#story-detour-return");
      assert.equal(await returnButton.isEnabled(), true);
      await returnButton.click();
      await page.waitForFunction((nextStepId) => globalThis.GaiaNovel.getState().stepId === nextStepId, testCase.nextStepId, { timeout: 10_000 });
      await page.waitForFunction((modal) => !globalThis.__isVisibleForCheck(document.querySelector(modal)), testCase.modal, { timeout: 10_000 });

      const closed = await page.evaluate((modal) => ({
        lifecycle: document.body.dataset.novelInteractionState || "idle",
        stepId: globalThis.GaiaNovel.getState().stepId,
        storyVisible: globalThis.__isVisibleForCheck(document.querySelector("#novel-layer")),
        storyInert: document.querySelector("#novel-layer")?.inert,
        modalVisible: globalThis.__isVisibleForCheck(document.querySelector(modal)),
        dockCount: document.querySelectorAll(".story-detour-dock").length,
        exclusiveClass: document.body.classList.contains("novel-interaction-exclusive"),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }), testCase.modal);
      assert.equal(closed.lifecycle, "idle");
      assert.equal(closed.stepId, testCase.nextStepId);
      assert.equal(closed.storyVisible, true);
      assert.equal(closed.storyInert, false);
      assert.equal(closed.modalVisible, false);
      assert.equal(closed.dockCount, 0);
      assert.equal(closed.exclusiveClass, false);
      assert.equal(closed.overflow, false);
      await page.screenshot({ path: path.join(outputDir, `${label}-closed.png`), fullPage: false });
      report.scans.push({ viewport, case: testCase.name, prep, open, closed, passed: true });
      await context.close();
    }
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

console.log("interaction exclusive browser check passed");

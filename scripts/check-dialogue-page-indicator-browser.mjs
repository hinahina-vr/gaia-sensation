import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4184"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument || "artifacts/dialogue-page-indicator");
const routeUrl = new URL("/story", baseUrl).href;
const target = { id: "esp32_pitch_015", sceneId: "esp32_pitch" };
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", target, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
fs.mkdirSync(outputDir, { recursive: true });

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const bootAtTarget = async (page) => {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(({ stepId, sceneId }) => {
    const story = globalThis.GAIA_NOVEL_STORY;
    const progress = {
      storyVersion: story.storyVersion,
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
      readStepIds: [stepId],
      clear: false,
      archivesUnlocked: false,
      sessionId: "dialogue-page-indicator-browser",
    };
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{ progress, savedAt: Date.now(), meta: { title: "Dialogue indicator QA", excerpt: stepId } }]));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, { stepId: target.id, sceneId: target.sceneId });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, target.id, { timeout: 15_000 });
  await page.waitForFunction(() => Number(document.querySelector("#novel-text")?.dataset.pageCount) > 1, null, { timeout: 15_000 });
  await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 15_000 });
};

const snapshot = (page) => page.evaluate(() => ({
  pageCount: Number(document.querySelector("#novel-text")?.dataset.pageCount),
  pageIndex: Number(document.querySelector("#novel-text")?.dataset.pageIndex),
  continueText: document.querySelector("#novel-continue")?.textContent.trim() || "",
  bodyOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
}));

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await bootAtTarget(page);
    const pages = [await snapshot(page)];
    const pageCount = pages[0].pageCount;
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-page-1.png`), animations: "disabled" });
    for (let pageIndex = 2; pageIndex <= pageCount; pageIndex += 1) {
      await page.locator("#novel-dialogue").click();
      await page.waitForFunction((index) => Number(document.querySelector("#novel-text")?.dataset.pageIndex) === index, pageIndex, { timeout: 15_000 });
      await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 15_000 });
      pages.push(await snapshot(page));
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-page-${pageIndex}.png`), animations: "disabled" });
    }
    assert.equal(pages.length > 1, true, `${viewport.name}: target did not paginate`);
    assert.equal(pages.every((item) => item.continueText === "▼"), true, `${viewport.name}: N/N counter is visible`);
    assert.equal(pages.every((item) => item.bodyOverflow === 0), true, `${viewport.name}: horizontal overflow`);
    report.scans.push({ viewport, pages, passed: true });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join("\n")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join("\n")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`dialogue page indicator check passed: ${report.scans.length} viewports`);

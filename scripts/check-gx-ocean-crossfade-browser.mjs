import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4430"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/gx-ocean-crossfade-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1080p", width: 1920, height: 1080 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });

const stateFor = (storyVersion) => ({
  storyVersion,
  stepId: "map_mode01_043",
  reachedSceneIds: ["festival_concept", "map_mode01"],
  viewed: {},
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "太古の海",
  metCharacters: { mizuha: true, amane: true, sakuya: false },
  audio: { muted: true, volume: 0 },
  readStepIds: ["map_mode01_043", "first_meeting_hall_032"],
  clear: false,
  archivesUnlocked: false,
  sessionId: "gx-ocean-crossfade-check",
});

const bootAtTransition = async (page) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const progress = stateFor(storyVersion);
  await page.evaluate((savedProgress) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(savedProgress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: savedProgress,
      savedAt: Date.now(),
      meta: { title: "GX crossfade QA", excerpt: savedProgress.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, progress);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  if (await page.locator("#novel-save-panel").isVisible()) {
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "map_mode01_043");
  await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 10000 });
};

const transitionPresentation = (page) => page.locator("#novel-layer").evaluate((layer) => {
  const background = getComputedStyle(layer);
  const outgoing = getComputedStyle(layer, "::before");
  return {
    stepId: layer.dataset.stepId || "",
    stepType: layer.dataset.stepType || "",
    cue: layer.dataset.backgroundCue || "",
    backgroundImage: background.backgroundImage,
    outgoingImage: outgoing.backgroundImage,
    outgoingOpacity: Number(outgoing.opacity),
    buffered: layer.classList.contains("is-background-buffered"),
    releasing: layer.classList.contains("is-background-releasing"),
    sharedSceneTransition: document.body.classList.contains("scene-transitioning"),
    sharedCanvasVisible: !document.querySelector("#scene-transition")?.hidden,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push({ viewport: viewport.name, text: message.text() });
    });
    page.on("pageerror", (error) => report.pageErrors.push({ viewport: viewport.name, text: error.message }));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push({ viewport: viewport.name, url: response.url() });
    });

    await bootAtTransition(page);
    const before = await transitionPresentation(page);
    assert(before.backgroundImage.includes("novel-bg-festival-five-plane-projection-autumn-morning-v2.png"), `${viewport.name}: wrong outgoing background`);
    await page.locator("#novel-dialogue").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "gx_experience_001");
    const section = await transitionPresentation(page);
    assert.equal(section.stepType, "section-separator", `${viewport.name}: GX section separator was skipped`);
    assert(!section.sharedSceneTransition && !section.sharedCanvasVisible, `${viewport.name}: tile transition replaced the requested crossfade`);

    await page.waitForFunction(() => document.querySelector("#novel-layer")?.classList.contains("is-background-releasing"), null, { timeout: 5000 });
    await page.waitForTimeout(360);
    const middle = await transitionPresentation(page);
    assert(middle.backgroundImage.includes("novel-bg-gx-ancient-ocean-autumn-morning-v3.png"), `${viewport.name}: ancient-ocean background did not become the incoming layer`);
    assert(middle.outgoingImage.includes("novel-bg-festival-five-plane-projection-autumn-morning-v2.png"), `${viewport.name}: current-Earth background was not retained as the outgoing layer`);
    assert(middle.outgoingOpacity > 0 && middle.outgoingOpacity < 1, `${viewport.name}: outgoing layer did not crossfade: ${middle.outgoingOpacity}`);
    assert(middle.buffered && middle.releasing && !middle.sharedSceneTransition && !middle.sharedCanvasVisible, `${viewport.name}: crossfade state was not isolated from the shared transition`);
    assert(!middle.horizontalOverflow, `${viewport.name}: transition introduced horizontal overflow`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-crossfade-mid.png`), fullPage: false });

    await page.waitForFunction(() => !document.querySelector("#novel-layer")?.classList.contains("is-background-buffered"), null, { timeout: 5000 });
    const after = await transitionPresentation(page);
    assert(after.backgroundImage.includes("novel-bg-gx-ancient-ocean-autumn-morning-v3.png"), `${viewport.name}: incoming background did not remain after the fade`);
    assert.equal(after.outgoingImage, "none", `${viewport.name}: outgoing background was not released`);
    report.scans.push({ viewport: viewport.name, before, section, middle, after, passed: true });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${JSON.stringify(report.consoleErrors)}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${JSON.stringify(report.pageErrors)}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${JSON.stringify(report.responses404)}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`GX ocean crossfade browser check passed: ${report.scans.length} viewports`);

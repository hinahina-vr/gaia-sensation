import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/novacene-release-gate");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4173";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const REACHED_KEY = "gaiaSensewareTrueEnd:reached:v1";
const STEP_ID = "festival_concept_006";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = {
  status: "running",
  baseUrl,
  scans: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};
fs.mkdirSync(outputDir, { recursive: true });

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
};

const bootAtStoryStep = async (page, profile) => {
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate(({ stepId, profileName, reachedKey }) => {
    localStorage.clear();
    const story = globalThis.GAIA_NOVEL_STORY;
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({
      storyVersion: story.storyVersion,
      stepId,
      reachedSceneIds: [],
      viewed: {},
      metCharacters: { mizuha: false, amane: false, sakuya: false },
      evesRoute: [],
      observationOrder: "LOCAL_FIRST",
      editorialChoice: null,
      reflectionIds: [],
      resultTone: null,
      demoInterest: "",
      audio: { muted: true, volume: 0 },
      readStepIds: [],
      clear: false,
      archivesUnlocked: false,
      sessionId: `novacene-gate-${profileName}`,
    }));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
    localStorage.removeItem(reachedKey);
  }, { stepId: STEP_ID, profileName: profile, reachedKey: REACHED_KEY });
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((stepId) => (
    globalThis.GaiaNovel?.getState?.().stepId === stepId
    && !document.querySelector("#novel-runtime")?.hidden
  ), STEP_ID);
  await page.waitForFunction(() => (
    document.querySelector("#novel-text")?.dataset.revealState === "complete"
    && document.querySelector("#novel-chapter-card")?.hidden !== false
  ));
  await page.locator("#novel-jump-button").click();
  await page.locator("#novel-jump-panel").waitFor({ state: "visible" });
};

const scanMenu = (page) => page.evaluate(() => ({
  buildProfile: globalThis.GaiaNovel?.buildProfile || "",
  items: [...document.querySelectorAll("button.novel-jump-item[data-scene-id]")].map((item) => ({
    id: item.dataset.sceneId,
    text: item.innerText,
  })),
  titleVisible: Boolean(document.querySelector("#novel-title-screen") && !document.querySelector("#novel-title-screen").hidden),
  overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
}));

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    for (const profile of ["debug", "release"]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      if (profile === "release") {
        await context.addInitScript(() => { globalThis.GAIA_BUILD_PROFILE = "release"; });
      }
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(90_000);
      page.setDefaultTimeout(45_000);
      const label = `${viewport.name}-${profile}`;
      attachDiagnostics(page, label);
      await bootAtStoryStep(page, profile);
      const menu = await scanMenu(page);
      const trueEndEntries = menu.items.filter((item) => item.id === "true-end");
      assert.equal(menu.buildProfile, profile, `${label}: build profile`);
      assert.equal(menu.titleVisible, false, `${label}: pre-APEIRONCENE title was visible`);
      assert.equal(menu.items.at(-1)?.id, profile === "debug" ? "true-end" : "ending", `${label}: final jump destination`);
      assert.equal(trueEndEntries.length, profile === "debug" ? 1 : 0, `${label}: APEIRONCENE jump availability`);
      assert.equal(menu.items.some((item) => item.id === "ending"), true, `${label}: ending debug jump was removed`);
      assert.equal(menu.overflowX, 0, `${label}: horizontal overflow`);
      assert.equal(menu.overflowY, 0, `${label}: vertical overflow`);
      if (profile === "debug") {
        assert.match(trueEndEntries[0].text, /APEIRONCENE/u, `${label}: APEIRONCENE label`);
        await page.locator('button.novel-jump-item[data-scene-id="true-end"]').click();
        await page.waitForFunction(() => Boolean(document.querySelector(".true-end-shell")));
        await page.waitForFunction(() => !document.querySelector(".true-end-shell")?.classList.contains("is-scene-separating"));
        const debugReach = await page.evaluate((key) => ({
          isReached: globalThis.GaiaTrueEnd?.isReached?.() ?? true,
          stored: localStorage.getItem(key),
        }), REACHED_KEY);
        assert.equal(debugReach.isReached, false, `${label}: debug jump unlocked the title`);
        assert.equal(debugReach.stored, null, `${label}: debug jump persisted the reached marker`);
      }
      await page.screenshot({ path: path.join(outputDir, `${label}.png`), animations: "disabled" });
      report.scans.push({ viewport: viewport.name, profile, menu, passed: true });
      await context.close();
    }
  }
  assert.deepEqual(report.consoleErrors, [], `console errors: ${report.consoleErrors.join("\n")}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${report.pageErrors.join("\n")}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`APEIRONCENE release gate browser check passed: ${report.scans.length} profiles`);

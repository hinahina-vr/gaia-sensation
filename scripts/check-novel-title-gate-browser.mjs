import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/novel-title-gate");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4173";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const PROGRESS_KEY = "gaiaSensewareNovel:progress";
const MANUAL_KEY = "gaiaSensewareNovel:manual-saves";
const REACHED_KEY = "gaiaSensewareTrueEnd:reached:v1";
const COMPLETE_KEY = "gaiaSensewareTrueEnd:complete:v1";
const RESUME_STEP_ID = "festival_concept_006";
const MANUAL_STEP_ID = "festival_concept_001";
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

const createScenarioPage = async (browser, viewport, scenario) => {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000);
  page.setDefaultTimeout(45_000);
  const label = `${viewport.name}-${scenario}`;
  attachDiagnostics(page, label);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate(({ progressKey, manualKey, reachedKey, completeKey, scenarioName, resumeStepId, manualStepId }) => {
    localStorage.clear();
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    const storyVersion = globalThis.GAIA_NOVEL_STORY.storyVersion;
    const makeProgress = (stepId, suffix) => ({
      storyVersion,
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
      sessionId: `title-gate-${scenarioName}-${suffix}`,
    });
    if (scenarioName !== "fresh") {
      const autosave = makeProgress(resumeStepId, "autosave");
      const manual = makeProgress(manualStepId, "manual");
      localStorage.setItem(progressKey, JSON.stringify(autosave));
      localStorage.setItem(manualKey, JSON.stringify([{
        progress: manual,
        savedAt: Date.now() + 1000,
        meta: { title: "Manual QA", excerpt: manual.stepId },
      }]));
    }
    if (scenarioName === "reached") localStorage.setItem(reachedKey, new Date().toISOString());
    if (scenarioName === "completed-legacy") localStorage.setItem(completeKey, new Date().toISOString());
  }, {
    progressKey: PROGRESS_KEY,
    manualKey: MANUAL_KEY,
    reachedKey: REACHED_KEY,
    completeKey: COMPLETE_KEY,
    scenarioName: scenario,
    resumeStepId: RESUME_STEP_ID,
    manualStepId: MANUAL_STEP_ID,
  });
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && document.querySelector("#novel-layer")?.classList.contains("is-open")));
  return { context, page, label };
};

const scan = (page) => page.evaluate(({ reachedKey, completeKey }) => {
  const layer = document.querySelector("#novel-layer");
  const title = document.querySelector("#novel-title-screen");
  const runtime = document.querySelector("#novel-runtime");
  return {
    buildProfile: globalThis.GaiaNovel?.buildProfile || "",
    titleVisible: Boolean(title && !title.hidden),
    runtimeVisible: Boolean(runtime && !runtime.hidden),
    stepId: layer?.dataset.stepId || "",
    titleUnlocked: globalThis.GaiaTrueEnd?.isReached?.() ?? false,
    reachedStored: Boolean(localStorage.getItem(reachedKey)),
    completeStored: Boolean(localStorage.getItem(completeKey)),
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  };
}, { reachedKey: REACHED_KEY, completeKey: COMPLETE_KEY });

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    for (const scenario of ["fresh", "stored", "reached", "completed-legacy"]) {
      const { context, page, label } = await createScenarioPage(browser, viewport, scenario);
      if (scenario === "fresh") {
        await page.waitForFunction(() => Boolean(document.querySelector("#novel-runtime") && !document.querySelector("#novel-runtime").hidden));
      } else if (scenario === "stored") {
        await page.waitForFunction((stepId) => document.querySelector("#novel-layer")?.dataset.stepId === stepId, RESUME_STEP_ID);
      } else {
        await page.locator("#novel-title-screen").waitFor({ state: "visible" });
      }
      const result = await scan(page);
      assert.equal(result.buildProfile, "debug", `${label}: current build profile`);
      assert.equal(result.overflowX, 0, `${label}: horizontal overflow`);
      assert.equal(result.overflowY, 0, `${label}: vertical overflow`);
      if (scenario === "fresh") {
        assert.equal(result.titleVisible, false, `${label}: fresh save exposed the locked title`);
        assert.equal(result.runtimeVisible, true, `${label}: fresh story did not start directly`);
        assert.equal(result.titleUnlocked, false, `${label}: fresh save unlocked the title`);
      } else if (scenario === "stored") {
        assert.equal(result.titleVisible, false, `${label}: pre-APEIRONCENE save exposed the locked title`);
        assert.equal(result.runtimeVisible, true, `${label}: pre-APEIRONCENE save did not resume directly`);
        assert.equal(result.stepId, RESUME_STEP_ID, `${label}: autosave was not resumed directly`);
        assert.equal(result.titleUnlocked, false, `${label}: pre-APEIRONCENE save unlocked the title`);
      } else {
        assert.equal(result.titleVisible, true, `${label}: unlocked title was not shown`);
        assert.equal(result.runtimeVisible, false, `${label}: unlocked title was bypassed`);
        assert.equal(result.titleUnlocked, true, `${label}: reached/completed marker was not recognized`);
      }
      if (["fresh", "reached"].includes(scenario)) {
        await page.screenshot({ path: path.join(outputDir, `${label}.png`), animations: "disabled" });
      }
      report.scans.push({ viewport: viewport.name, scenario, ...result, passed: true });
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

console.log(`novel title gate browser check passed: ${report.scans.length} scenarios`);

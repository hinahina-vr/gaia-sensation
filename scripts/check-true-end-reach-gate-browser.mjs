import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/true-end-reach-gate");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4173";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const REACHED_KEY = "gaiaSensewareTrueEnd:reached:v1";
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

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript(() => { globalThis.GAIA_BUILD_PROFILE = "release"; });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90_000);
    page.setDefaultTimeout(45_000);
    attachDiagnostics(page, viewport.name);
    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await page.evaluate((reachedKey) => {
      localStorage.clear();
      const story = globalThis.GAIA_NOVEL_STORY;
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({
        storyVersion: story.storyVersion,
        stepId: "welcome_chat_095",
        reachedSceneIds: ["welcome_chat"],
        viewed: {},
        metCharacters: { mizuha: true, amane: true, sakuya: true },
        evesRoute: [],
        observationOrder: "LOCAL_FIRST",
        editorialChoice: null,
        reflectionIds: [],
        resultTone: null,
        demoInterest: "太古の海",
        audio: { muted: true, volume: 0 },
        readStepIds: [],
        clear: false,
        archivesUnlocked: false,
        sessionId: "true-end-reach-gate",
      }));
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
      localStorage.removeItem(reachedKey);
      localStorage.removeItem("gaiaSensewareTrueEnd:complete:v1");
    }, REACHED_KEY);
    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "complete");

    const before = await page.evaluate((reachedKey) => ({
      buildProfile: globalThis.GaiaNovel?.buildProfile || "",
      titleVisible: Boolean(document.querySelector("#novel-title-screen") && !document.querySelector("#novel-title-screen").hidden),
      isReached: globalThis.GaiaTrueEnd?.isReached?.() ?? true,
      reachedStored: Boolean(localStorage.getItem(reachedKey)),
    }), REACHED_KEY);
    assert.equal(before.buildProfile, "release", `${viewport.name}: release profile was not active`);
    assert.equal(before.titleVisible, false, `${viewport.name}: title appeared before canonical APEIRONCENE entry`);
    assert.equal(before.isReached, false, `${viewport.name}: ending checkpoint counted as APEIRONCENE reached`);
    assert.equal(before.reachedStored, false, `${viewport.name}: ending checkpoint already had a reached marker`);

    await page.locator(".novel-staff-roll-finale button").click();
    await page.waitForFunction(() => Boolean(document.querySelector(".true-end-shell")));
    await page.waitForFunction(() => globalThis.GaiaTrueEnd?.isReached?.() === true);
    const reached = await page.evaluate((reachedKey) => ({
      scene: document.querySelector(".true-end-shell")?.dataset.scene || "",
      isReached: globalThis.GaiaTrueEnd?.isReached?.() ?? false,
      reachedStored: Boolean(localStorage.getItem(reachedKey)),
      trueEndJumpCount: document.querySelectorAll('button.novel-jump-item[data-scene-id="true-end"]').length,
    }), REACHED_KEY);
    assert.equal(reached.scene, "after-ending", `${viewport.name}: canonical APEIRONCENE opening scene`);
    assert.equal(reached.isReached, true, `${viewport.name}: canonical entry did not unlock the title`);
    assert.equal(reached.reachedStored, true, `${viewport.name}: canonical entry did not persist the reached marker`);
    assert.equal(reached.trueEndJumpCount, 0, `${viewport.name}: release build exposed an APEIRONCENE jump`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-canonical-entry.png`), animations: "disabled" });

    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("#novel-title-screen").waitFor({ state: "visible" });
    const reopened = await page.evaluate(() => ({
      titleVisible: Boolean(document.querySelector("#novel-title-screen") && !document.querySelector("#novel-title-screen").hidden),
      runtimeVisible: Boolean(document.querySelector("#novel-runtime") && !document.querySelector("#novel-runtime").hidden),
      buildProfile: globalThis.GaiaNovel?.buildProfile || "",
    }));
    assert.equal(reopened.titleVisible, true, `${viewport.name}: reached save did not show the title on reopen`);
    assert.equal(reopened.runtimeVisible, false, `${viewport.name}: reached save bypassed the title on reopen`);
    assert.equal(reopened.buildProfile, "release", `${viewport.name}: release profile changed after reopen`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-unlocked-title.png`), animations: "disabled" });

    report.scans.push({ viewport: viewport.name, before, reached, reopened, passed: true });
    await context.close();
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

console.log(`true-end reach gate browser check passed: ${report.scans.length} viewports`);

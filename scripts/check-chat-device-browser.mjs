import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4291";
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/chat-device-browser");
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required.");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?chat-device=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const stepMap = new Map(story.scenes.flatMap((scene) => scene.steps).map((step) => [step.id, step]));
const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const configKey = "gaiaSensewareNovel:config:v2";
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const boundaryCases = [
  ["prologue_basil_003", "wide"],
  ["prologue_basil_004", "wide"],
  ["prologue_basil_005", "wide"],
  ["prologue_basil_006", "wide"],
  ["prologue_basil_007", "wide"],
  ["prologue_basil_008", "wide"],
  ["prologue_basil_009", "wide"],
  ["prologue_basil_010", "wide"],
  ["first_meeting_hall_020", "wide"],
  ["first_meeting_hall_021", "mobile"],
  ["first_meeting_hall_022", "mobile"],
  ["first_meeting_hall_023", "mobile"],
  ["first_meeting_hall_024", "wide"],
  ["first_meeting_hall_041", "wide"],
  ["first_meeting_hall_042", "mobile"],
  ["first_meeting_hall_043", "mobile"],
  ["first_meeting_hall_044", "mobile"],
  ["first_meeting_hall_045", "mobile"],
  ["first_meeting_hall_046", "mobile"],
  ["first_meeting_hall_047", "mobile"],
  ["first_meeting_hall_048", "mobile"],
  ["first_meeting_hall_049", "wide"],
  ["production_year_124", "wide"],
  ["production_year_125", "mobile"],
  ["production_year_126", "mobile"],
  ["production_year_127", "mobile"],
  ["production_year_128", "wide"],
  ["production_year_195", "wide"],
  ["production_year_196", "mobile"],
  ["production_year_197", "mobile"],
  ["production_year_198", "mobile"],
  ["production_year_199", "wide"],
  ["absence_039", "wide"],
  ["absence_040", "mobile"],
  ["absence_041", "wide"],
  ["absence_060", "wide"],
  ["absence_061", "mobile"],
  ["absence_062", "mobile"],
  ["absence_063", "mobile"],
  ["absence_064", "wide"],
];

const mobileViewportCases = [
  ["prologue_basil_004", "wide"],
  ["prologue_basil_010", "wide"],
  ["first_meeting_hall_041", "wide"],
  ["first_meeting_hall_042", "mobile"],
  ["first_meeting_hall_048", "mobile"],
  ["production_year_125", "mobile"],
  ["production_year_198", "mobile"],
  ["production_year_128", "wide"],
  ["absence_040", "mobile"],
  ["absence_041", "wide"],
  ["absence_061", "mobile"],
  ["absence_062", "mobile"],
  ["absence_064", "wide"],
];

for (const [stepId] of boundaryCases) assert(stepMap.has(stepId), `cue boundary step is missing: ${stepId}`);

const baseState = (stepId) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "chat-device-browser",
});

const ensureNovelOpen = async (page) => {
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer.classList.contains("is-open")) globalThis.GaiaNovel.open();
  });
  await page.locator("#novel-title-screen").waitFor({ state: "visible", timeout: 15_000 });
};

const bootAt = async (page, stepId) => {
  await page.evaluate(({ progressKey, progress, settingsKey }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { progressKey: storageKey, progress: baseState(stepId), settingsKey: configKey });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
};

const readDeviceState = (page) => page.evaluate(() => {
  const layer = document.querySelector("#novel-layer");
  const surface = document.querySelector("#novel-slack-surface");
  const workspace = document.querySelector(".novel-slack-workspace");
  const workspaceRect = workspace?.getBoundingClientRect();
  const surfaceRect = surface?.getBoundingClientRect();
  return {
    stepId: layer?.dataset.stepId || null,
    layerDevice: layer?.dataset.slackDevice || null,
    slackVisible: Boolean(surface && !surface.hidden),
    workspaceDevice: workspace?.dataset.device || null,
    mobileClass: workspace?.classList.contains("is-mobile-device") || false,
    portrait: Boolean(workspaceRect && workspaceRect.height > workspaceRect.width),
    workspaceFits: Boolean(workspaceRect
      && workspaceRect.left >= -1 && workspaceRect.right <= innerWidth + 1
      && workspaceRect.top >= -1 && workspaceRect.bottom <= innerHeight + 1),
    surfaceFits: Boolean(surfaceRect
      && surfaceRect.left >= -1 && surfaceRect.right <= innerWidth + 1
      && surfaceRect.top >= -1 && surfaceRect.bottom <= innerHeight + 1),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
});

const report = {
  baseUrl: routeUrl,
  boundaryChecks: [],
  mobileViewportChecks: [],
  progressionChecks: [],
  persistenceChecks: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const verifyAt = async (page, stepId, expected, target) => {
  await bootAt(page, stepId);
  const actual = await readDeviceState(page);
  const isChat = stepMap.get(stepId)?.type === "chat";
  assert(actual.layerDevice === expected, `${stepId}: expected layer device ${expected}, got ${actual.layerDevice}`);
  if (isChat) {
    assert(actual.slackVisible, `${stepId}: chat surface is hidden`);
    assert(actual.workspaceDevice === expected, `${stepId}: workspace device was not recomputed`);
    assert(actual.mobileClass === (expected === "mobile"), `${stepId}: mobile class mismatch`);
    assert(actual.workspaceFits && actual.surfaceFits && !actual.horizontalOverflow, `${stepId}: chat frame overflowed the viewport`);
    if (expected === "mobile") assert(actual.portrait, `${stepId}: mobile chat frame is not portrait`);
  }
  target.push({ stepId, expected, isChat, ...actual });
};

const advanceOnce = async (page, expectedStepId) => {
  await page.waitForFunction(() => !document.querySelector("#novel-layer")?.classList.contains("is-slack-entering"));
  const previous = await page.locator("#novel-layer").getAttribute("data-step-id");
  await page.locator("#novel-layer").dispatchEvent("click");
  if (await page.locator("#novel-layer").getAttribute("data-step-id") === previous) {
    await page.locator("#novel-layer").dispatchEvent("click");
  }
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, expectedStepId);
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const desktop = await desktopContext.newPage();
  attachDiagnostics(desktop, "desktop-1440");
  await desktop.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await ensureNovelOpen(desktop);
  await desktop.evaluate(() => localStorage.clear());

  for (const [stepId, expected] of boundaryCases) await verifyAt(desktop, stepId, expected, report.boundaryChecks);

  await bootAt(desktop, "absence_040");
  await advanceOnce(desktop, "absence_041");
  let actual = await readDeviceState(desktop);
  assert(actual.layerDevice === "wide" && actual.workspaceDevice === "wide" && !actual.mobileClass, "absence _040 -> _041 did not return to wide");
  report.progressionChecks.push({ from: "absence_040", to: "absence_041", ...actual });

  await bootAt(desktop, "absence_063");
  await advanceOnce(desktop, "absence_064");
  await desktop.waitForFunction(() => document.querySelector("#novel-slack-surface")?.hidden);
  actual = await readDeviceState(desktop);
  assert(actual.layerDevice === "wide" && !actual.slackVisible, "absence _063 -> _064 did not clear the mobile chat presentation");
  report.progressionChecks.push({ from: "absence_063", to: "absence_064", ...actual });

  await bootAt(desktop, "absence_040");
  await desktop.locator("#novel-save-button").click();
  await desktop.locator("#novel-save-slots .novel-save-primary").first().click();
  await desktop.locator("#novel-save-close").click();
  await bootAt(desktop, "absence_041");
  await desktop.locator("#novel-load-button").click();
  await desktop.locator("#novel-save-slots .novel-save-primary").first().click();
  await desktop.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "absence_040");
  actual = await readDeviceState(desktop);
  assert(actual.layerDevice === "mobile" && actual.workspaceDevice === "mobile" && actual.mobileClass, "manual SAVE/LOAD did not restore mobile chat state");
  report.persistenceChecks.push({ kind: "manual-save-load", ...actual });
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const mobile = await mobileContext.newPage();
  attachDiagnostics(mobile, "mobile-390");
  await mobile.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await ensureNovelOpen(mobile);
  await mobile.evaluate(() => localStorage.clear());
  for (const [stepId, expected] of mobileViewportCases) await verifyAt(mobile, stepId, expected, report.mobileViewportChecks);

  await bootAt(mobile, "absence_061");
  await mobile.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(mobile);
  await mobile.locator("#novel-resume-button").click();
  await mobile.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "absence_061");
  actual = await readDeviceState(mobile);
  assert(actual.layerDevice === "mobile" && actual.workspaceDevice === "mobile" && actual.mobileClass && actual.portrait, "RESUME did not recompute the mobile chat state");
  report.persistenceChecks.push({ kind: "resume-mobile-390", ...actual });
  await mobileContext.close();

  assert(report.consoleErrors.length === 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert(report.pageErrors.length === 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert(report.responses404.length === 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`chat device browser check passed: ${report.boundaryChecks.length} boundaries, ${report.mobileViewportChecks.length} mobile viewport checks, ${report.persistenceChecks.length} persistence checks`);

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/ending-data-skip-browser");
fs.mkdirSync(outputDir, { recursive: true });

const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v3";
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

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const bootAtEnding = async (page, label, { priorApeironceneComplete = false } = {}) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.addInitScript(({ storageKey, configKey, sessionId, priorApeironceneComplete }) => {
    const state = {
      storyVersion: 13,
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
      sessionId,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: state,
      savedAt: Date.now(),
      meta: { title: "Ending data skip QA", excerpt: state.stepId },
    }]));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
    localStorage.removeItem("gaiaSensewareTrueEnd:reached:v1");
    localStorage.removeItem("gaiaSensewareTrueEnd:pending:v1");
    if (priorApeironceneComplete) {
      localStorage.setItem("gaiaSensewareTrueEnd:complete:v1", "previous-cycle");
    } else {
      localStorage.removeItem("gaiaSensewareTrueEnd:complete:v1");
    }
  }, { storageKey: STORAGE_KEY, configKey: CONFIG_KEY, sessionId: `ending-data-skip-${label}`, priorApeironceneComplete });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  const direct = await page.locator('.novel-staff-roll-data-skip').waitFor({state:'visible',timeout:8000}).then(() => true, () => false);
  if (!direct) {
    await page.locator("#novel-resume-button").click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible" });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.locator(".novel-staff-roll-data-skip").waitFor({ state: "visible", timeout: 15_000 });
};

const scanEnding = (page) => page.evaluate(() => {
  const button = document.querySelector(".novel-staff-roll-data-skip");
  const audioDock = document.querySelector(".gaia-audio-dock");
  const buttonRect = button?.getBoundingClientRect();
  const audioRect = audioDock?.getBoundingClientRect();
  const overlapsAudio = Boolean(buttonRect && audioRect
    && buttonRect.left < audioRect.right
    && buttonRect.right > audioRect.left
    && buttonRect.top < audioRect.bottom
    && buttonRect.bottom > audioRect.top);
  return {
    stepId: document.querySelector("#novel-layer")?.dataset.stepId,
    text: button?.textContent?.trim() || "",
    title: button?.title || "",
    ariaLabel: button?.getAttribute("aria-label") || "",
    top: buttonRect?.top ?? -1,
    left: buttonRect?.left ?? -1,
    rightGap: buttonRect ? innerWidth - buttonRect.right : -1,
    width: buttonRect?.width || 0,
    height: buttonRect?.height || 0,
    overlapsAudio,
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  };
});

const scanDestination = (page) => page.evaluate((storageKey) => {
  const intro = document.querySelector("#intro-layer");
  const stage = document.querySelector("#intro-path-stage");
  const storyReturn = document.querySelector(".intro-story-return[data-primary-action='true']");
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  return {
    introVisible: Boolean(intro && !intro.hidden && intro.getAttribute("aria-hidden") === "false"),
    stageVisible: Boolean(stage && !stage.hidden),
    heading: stage?.querySelector(".intro-exploration-heading h3")?.textContent?.trim() || "",
    pathCount: stage?.querySelectorAll(".intro-path-card").length || 0,
    novelHidden: document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "true",
    hash: location.hash,
    clear: globalThis.GaiaNovel?.getState?.().clear,
    archivesUnlocked: globalThis.GaiaNovel?.getState?.().archivesUnlocked,
    savedClear: saved.clear,
    savedArchivesUnlocked: saved.archivesUnlocked,
    titleUnlocked: globalThis.GaiaTrueEnd?.isReached?.() ?? false,
    reachedMarkerStored: Boolean(localStorage.getItem("gaiaSensewareTrueEnd:reached:v1")),
    pendingMarkerStored: Boolean(localStorage.getItem("gaiaSensewareTrueEnd:pending:v1")),
    completeMarkerStored: Boolean(localStorage.getItem("gaiaSensewareTrueEnd:complete:v1")),
    storyReturnLabel: storyReturn?.querySelector("strong")?.textContent?.trim() || "",
    storyDestination: storyReturn?.dataset.storyDestination || "",
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  };
}, STORAGE_KEY);

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    const priorApeironceneComplete = viewport.width <= 720;
    await bootAtEnding(page, viewport.name, { priorApeironceneComplete });

    const ending = await scanEnding(page);
    const credits = await page.locator('.novel-staff-roll-credits').innerText();
    assert(credits.includes('ZEN大学『ビッグデータ分析概論』'));
    assert(credits.includes('気象庁 / 総務省 ほか'));
    assert(credits.includes('アシスタント') && !credits.includes('AIアシスタンス'));
    assert(credits.includes('Suno AI (Music Composition)') && !credits.includes('Theme Songs Composition'));
    assert.equal((credits.match(/ひなひな/g) || []).length, 6);
    assert.deepEqual(await page.locator('.novel-staff-roll-credit-department').allTextContents(), ['ORIGINAL CONCEPT & PLANNING','THE ARCHITECT','SCENARIO','CHARACTER CONCEPT','ART DIRECTOR','TECHNICAL DIRECTOR','ASSISTANT','MUSIC','ACADEMIC INSPIRATION','DATA SOURCES']);
    assert.equal(await page.locator('#gaia-opening-route-story strong').textContent(), '物語をはじめる');
    assert.equal(ending.stepId, "welcome_chat_095");
    assert.equal(ending.text, "スキップ▶");
    assert.equal(ending.title, "データを見てみる");
    assert.match(ending.ariaLabel, /データを見てみる/u);
    assert(ending.top >= 0 && ending.top <= 40, `${viewport.name}: skip is not at the upper edge (${ending.top})`);
    assert(ending.left >= 0 && ending.left <= 40, `${viewport.name}: skip is not at the left edge (${ending.left})`);
    assert(ending.width >= (viewport.width <= 720 ? 44 : 110), `${viewport.name}: skip width is too small (${ending.width})`);
    assert(ending.height >= 44, `${viewport.name}: skip hit area is under 44px (${ending.height})`);
    assert.equal(ending.overlapsAudio, false, `${viewport.name}: skip overlaps the audio control`);
    assert.equal(ending.overflowX, 0);
    assert.equal(ending.overflowY, 0);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-ending-skip.png`), animations: "disabled" });
    await page.locator('.novel-staff-roll-track').evaluate(node => {
      const animation = node.getAnimations().find(a => a.animationName === 'novel-staff-roll-rise');
      if (animation) { animation.pause(); animation.currentTime = 40000; }
    });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-credit-roles.png`) });

    await page.locator(".novel-staff-roll-data-skip").click();
    await page.waitForFunction(() => {
      const intro = document.querySelector("#intro-layer");
      return Boolean(intro && !intro.hidden && intro.getAttribute("aria-hidden") === "false");
    });
    await page.waitForFunction(() => globalThis.GaiaNovel?.getState?.().clear === true);
    const destination = await scanDestination(page);
    assert.equal(destination.introVisible, true, `${viewport.name}: free exploration did not open`);
    assert.equal(destination.stageVisible, true);
    assert.equal(destination.heading, "観測モードを選ぶ");
    assert(destination.pathCount >= 4, `${viewport.name}: observation mode choices are missing`);
    assert.equal(destination.novelHidden, true);
    assert.equal(destination.hash, "");
    assert.equal(destination.clear, true);
    assert.equal(destination.archivesUnlocked, true);
    assert.equal(destination.savedClear, true);
    assert.equal(destination.savedArchivesUnlocked, true);
    assert.equal(destination.titleUnlocked, priorApeironceneComplete, `${viewport.name}: existing APEIRONCENE achievement changed unexpectedly`);
    assert.equal(destination.reachedMarkerStored, false, `${viewport.name}: data skip persisted an APEIRONCENE marker`);
    assert.equal(destination.pendingMarkerStored, true, `${viewport.name}: staff-roll arrival did not persist the pending APEIRONCENE cycle`);
    assert.equal(destination.completeMarkerStored, priorApeironceneComplete, `${viewport.name}: staff-roll arrival overwrote the lifetime completion marker`);
    assert.equal(destination.storyReturnLabel, "星々の放課後 ～APEIRONCENE～", `${viewport.name}: staff-roll completion did not reveal APEIRONCENE on the GAIA page`);
    assert.equal(destination.storyDestination, "apeironcene", `${viewport.name}: GAIA story button still targets the ordinary title`);
    assert.equal(destination.overflowX, 0);
    assert.equal(destination.overflowY, 0);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-data-page.png`), animations: "disabled" });
    report.scans.push({ viewport: viewport.name, priorApeironceneComplete, ending, destination, passed: true });
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

console.log(`Ending data skip browser check passed: ${report.scans.length} viewports`);

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4517", phase = "candidate"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/esp32-connection-background-browser");
fs.mkdirSync(outputDir, { recursive: true });

const targets = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, phase, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const progressFor = (stepId, label) => ({
  storyVersion: 13,
  stepId,
  reachedSceneIds: ["festival_concept", "map_mode01", "gx_experience", "esp32_pitch"],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: true },
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
  sessionId: `esp32-background-${phase}-${label}`,
});

const bootAt = async (page, stepId, label) => {
  const progress = progressFor(stepId, label);
  await page.addInitScript((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "ESP32 connection background QA", excerpt: candidate.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, progress);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const resumedDirectly = await page.waitForFunction(
    (expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected,
    stepId,
    { timeout: 8_000 },
  ).then(() => true, () => false);
  if (!resumedDirectly) {
    await page.locator("#novel-resume-button").click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.waitForFunction((expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected, stepId);
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#novel-layer")).backgroundImage !== "none");
  await page.waitForFunction(() => document.querySelector('#novel-layer').dataset.runtimeReveal === 'revealed'
    && document.querySelector('#novel-layer').dataset.entryTransition === 'visible'
    && document.querySelector('#novel-text').dataset.revealState === 'complete');
  await page.locator('#gaia-boot').waitFor({state:'hidden'});
};

const scanPage = (page) => page.evaluate(() => {
  const layer = document.querySelector("#novel-layer");
  const dialogue = document.querySelector("#novel-dialogue");
  const layerStyle = getComputedStyle(layer);
  const dialogueRect = dialogue?.getBoundingClientRect();
  return {
    stepId: layer?.dataset.stepId || "",
    cue: layer?.dataset.backgroundCue || "",
    backgroundImage: layerStyle.backgroundImage,
    backgroundSize: layerStyle.backgroundSize,
    backgroundPosition: layerStyle.backgroundPosition,
    dialogue: dialogueRect?.toJSON?.() || null,
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  };
});

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of targets) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
    await bootAt(page, "esp32_pitch_019", viewport.name);
    const scan = await scanPage(page);
    assert.equal(scan.stepId, "esp32_pitch_019");
    assert.equal(scan.cue, "esp32-system-design");
    const expectedAsset = viewport.name === "mobile-390"
      ? "gaia-field-sensor-whiteboard-20260912.png"
      : "gaia-field-sensor-whiteboard-20260912.png";
    assert(scan.backgroundImage.includes(expectedAsset), `${viewport.name} background mismatch: ${scan.backgroundImage}`);
    assert.match(scan.backgroundSize, viewport.width <= 720 ? /cover, cover/u : /cover, contain/u);
    assert.equal(scan.overflowX, 0);
    assert.equal(scan.overflowY, 0);
    await page.evaluate(async () => {
      const image = new Image(); image.src = '/assets/architecture/gaia-field-sensor-whiteboard-20260912.png';
      await image.decode(); if (!image.naturalWidth) throw new Error('Selected image did not decode');
    });
    await page.screenshot({ path: path.join(outputDir, `${phase}-${viewport.name}-esp32-system-design.png`), animations: "disabled" });
    report.scans.push({ viewport: viewport.name, ...scan, passed: true });
    await context.close();
  }

  if (phase === "candidate") {
    for (const [stepId, cue, asset] of [
      ["esp32_pitch_018", "esp32-exhibition-proposal", "event-cg-esp32-collaboration-v2.png"],
      ["esp32_pitch_019", "esp32-system-design", "gaia-field-sensor-whiteboard-20260912.png"],
      ["esp32_pitch_025", "esp32-system-design", "gaia-field-sensor-whiteboard-20260912.png"],
      ["esp32_pitch_028", "esp32-co-created-prototype", "novel-bg-festival-five-plane-projection-autumn-morning-v2.png"],
    ]) {
      const context = await browser.newContext({ viewport: targets[0], reducedMotion: "no-preference" });
      const page = await context.newPage();
      page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`transition-${stepId}: ${message.text()}`); });
      page.on("pageerror", (error) => report.pageErrors.push(`transition-${stepId}: ${error.message}`));
      page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`transition-${stepId}: ${response.url()}`); });
      await bootAt(page, stepId, `transition-${stepId}`);
      const scan = await scanPage(page);
      assert.equal(scan.cue, cue);
      assert(scan.backgroundImage.includes(asset), `${stepId} background mismatch: ${scan.backgroundImage}`);
      report.scans.push({ viewport: "pc-1440", transitionPoint: stepId, ...scan, passed: true });
      await context.close();
    }
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, `${phase}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`ESP32 connection background browser check passed: ${phase}`);

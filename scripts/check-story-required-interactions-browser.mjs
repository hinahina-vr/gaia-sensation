import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173", caseFilter = "all", viewportFilter = "all"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/story-required-interactions-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900, mobile: false },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-320", width: 320, height: 568, mobile: true },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });

const progressFor = (storyVersion, stepId) => ({
  storyVersion,
  stepId,
  reachedSceneIds: ["festival_concept", "map_mode01", "gx_experience"],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気候の長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `required-interaction-${stepId}-${Date.now()}`,
});

const attachDiagnostics = (page, viewport) => {
  page.on("console", (message) => {
    if (message.type() !== "error" || message.text().includes("ERR_NETWORK_ACCESS_DENIED")) return;
    report.consoleErrors.push({ viewport, text: message.text() });
  });
  page.on("pageerror", (error) => report.pageErrors.push({ viewport, text: error.message }));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push({ viewport, url: response.url() });
  });
};

const bootAt = async (page, stepId) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const progress = progressFor(storyVersion, stepId);
  await page.evaluate((savedProgress) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(savedProgress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: savedProgress,
      savedAt: Date.now(),
      meta: { title: "Required interaction QA", excerpt: savedProgress.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, progress);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  if (await page.locator("#novel-resume-button").isVisible()) await page.locator("#novel-resume-button").click();
  if (await page.locator("#novel-save-panel").isVisible()) await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15_000 });
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open", null, { timeout: 15_000 });
};

const assertNoOverflow = async (page, label) => {
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  assert(layout.scrollWidth <= layout.width + 1, `${label}: horizontal overflow ${JSON.stringify(layout)}`);
  assert(layout.scrollHeight <= layout.height + 1, `${label}: vertical overflow ${JSON.stringify(layout)}`);
  return layout;
};

const advanceNovelOnce = async (page, viewport, fromStepId) => {
  await page.waitForTimeout(900);
  for (let attempt = 0; attempt < 12 && await page.locator("#novel-layer").getAttribute("data-step-id") === fromStepId; attempt += 1) {
    if (viewport.mobile) await page.locator("#novel-dialogue").tap();
    else await page.locator("#novel-dialogue").click();
    await page.waitForTimeout(120);
  }
  const current = await page.locator("#novel-layer").getAttribute("data-step-id");
  if (current === fromStepId) {
    const diagnostic = await page.evaluate(() => ({
      activeTag: document.activeElement?.tagName,
      activeId: document.activeElement?.id,
      activeHidden: document.activeElement?.closest?.("[hidden]")?.id || "",
      activeInert: document.activeElement?.closest?.("[inert]")?.id || "",
      interactionState: document.body.dataset.novelInteractionState || "idle",
      layerInert: document.querySelector("#novel-layer")?.inert,
      dialogueHidden: document.querySelector("#novel-dialogue")?.hidden,
    }));
    assert.notEqual(current, fromStepId, `${fromStepId}: story did not advance after returning from the interaction: ${JSON.stringify(diagnostic)}`);
  }
};

const operateTimeline = async (page, viewport) => {
  await bootAt(page, "map_mode01_004");
  await page.locator("#japan-layer").waitFor({ state: "visible" });
  const layout = await assertNoOverflow(page, `${viewport.name} timeline`);
  const startValue = Number(await page.locator("[data-signal-time]").inputValue());
  await page.waitForTimeout(1_200);
  const movingValue = Number(await page.locator("[data-signal-time]").inputValue());
  assert(movingValue > startValue, `${viewport.name}: the required timeline did not start automatically`);
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_005", null, { timeout: 23_000 });
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.hidden === true, null, { timeout: 5_000 });
  await advanceNovelOnce(page, viewport, "map_mode01_005");
  return { layout, startValue, movingValue, nextStepId: await page.locator("#novel-layer").getAttribute("data-step-id") };
};

const operateTemperature = async (page, viewport) => {
  await bootAt(page, "map_mode01_023");
  const slider = page.locator("[data-signal-time]").first();
  await slider.waitFor({ state: "visible" });
  const layout = await assertNoOverflow(page, `${viewport.name} temperature`);
  const before = Number(await slider.inputValue());
  const bounds = await slider.boundingBox();
  assert(bounds, `${viewport.name}: temperature slider has no bounds`);
  const ratio = before > 50 ? 0.22 : 0.78;
  const x = bounds.x + bounds.width * ratio;
  const y = bounds.y + bounds.height / 2;
  if (viewport.mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForFunction((value) => Number(document.querySelector("[data-signal-time]")?.value) !== value, before, { timeout: 3_000 });
  const after = Number(await slider.inputValue());
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_024", null, { timeout: 5_000 });
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.hidden === true, null, { timeout: 5_000 });
  await advanceNovelOnce(page, viewport, "map_mode01_024");
  return { layout, before, after, nextStepId: await page.locator("#novel-layer").getAttribute("data-step-id") };
};

const touchPlanet = async (page, viewport, pointIndex) => {
  const bounds = await page.locator("#gx-canvas").boundingBox();
  assert(bounds, `${viewport.name}: GX canvas has no bounds`);
  const angle = pointIndex * 2.399963229728653;
  const radial = 0.08 + 0.70 * Math.sqrt((pointIndex % 36) / 35);
  const radius = Math.min(bounds.width, bounds.height) * 0.37;
  const x = bounds.x + bounds.width * 0.69 + Math.cos(angle) * radius * radial;
  const y = bounds.y + bounds.height * 0.50 + Math.sin(angle) * radius * radial;
  const hitsCanvas = await page.evaluate(({ x: clientX, y: clientY }) => document.elementFromPoint(clientX, clientY)?.id === "gx-canvas", { x, y });
  if (!hitsCanvas) return false;
  if (viewport.mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  return true;
};

const operateGX = async (page, viewport) => {
  await bootAt(page, "gx_experience_017");
  await page.locator("#gx-layer").waitFor({ state: "visible" });
  const layout = await assertNoOverflow(page, `${viewport.name} GX`);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-open.png`), fullPage: false });
  if (viewport.mobile) {
    const toggle = page.locator("#gx-mobile-info-toggle");
    await toggle.tap();
    assert.equal(await page.locator("#gx-story-card").getAttribute("data-mobile-info-open"), "true", `${viewport.name}: GX detail card did not open`);
    await toggle.tap();
    assert.equal(await page.locator("#gx-story-card").getAttribute("data-mobile-info-open"), "false", `${viewport.name}: GX detail card did not close`);
  }
  const phases = [];
  for (let phase = 1; phase <= 8; phase += 1) {
    const expected = `${String(phase).padStart(2, "0")} / 08`;
    await page.waitForFunction((label) => document.querySelector("#gx-phase-index")?.textContent?.trim() === label, expected, { timeout: 3_000 });
    let attempts = 0;
    while (attempts < 180 && !await page.locator("#gx-era-transition").evaluate((node) => node.classList.contains("is-visible"))) {
      await touchPlanet(page, viewport, attempts);
      attempts += 1;
    }
    if (attempts >= 180) {
      const diagnostic = await page.evaluate(() => {
        const canvas = document.querySelector("#gx-canvas");
        const card = document.querySelector("#gx-story-card");
        const rect = canvas.getBoundingClientRect();
        const x = rect.left + rect.width * 0.69;
        const y = rect.top + rect.height * 0.50;
        const hit = document.elementFromPoint(x, y);
        return {
          canvasRect: rect.toJSON(),
          canvasPixels: { width: canvas.width, height: canvas.height },
          centerPoint: { x, y },
          centerHit: { tag: hit?.tagName, id: hit?.id, className: hit?.className },
          cardPointerEvents: getComputedStyle(card).pointerEvents,
          cardTouchAction: getComputedStyle(card).touchAction,
          cardExpanded: card.dataset.mobileInfoOpen,
          cssHrefs: [...document.styleSheets].map((sheet) => sheet.href).filter(Boolean),
          progress: document.querySelector("#gx-era-progress-value")?.textContent?.trim(),
          effect: document.querySelector("#gx-effect")?.textContent?.trim(),
          phase: document.querySelector("#gx-phase-index")?.textContent?.trim(),
          layerPhase: document.querySelector("#gx-layer")?.dataset.phase,
        };
      });
      throw new Error(`${viewport.name}: GX phase ${phase} could not be completed by ${viewport.mobile ? "touch" : "pointer"}: ${JSON.stringify(diagnostic)}`);
    }
    phases.push({ phase, attempts });
    if (phase < 8) {
      await page.waitForFunction((label) => document.querySelector("#gx-phase-index")?.textContent?.trim() !== label, expected, { timeout: 3_000 });
    }
  }
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "gx_experience_018", null, { timeout: 5_000 });
  await page.waitForFunction(() => document.querySelector("#gx-layer")?.hidden === true, null, { timeout: 5_000 });
  const completed = await page.evaluate(() => globalThis.GaiaNovel.getState().viewed.gxDeepTime === true);
  assert.equal(completed, true, `${viewport.name}: completed GX state was not persisted`);
  await advanceNovelOnce(page, viewport, "gx_experience_018");
  return { layout, phases, completed, nextStepId: await page.locator("#novel-layer").getAttribute("data-step-id") };
};

try {
  for (const viewport of viewports.filter((entry) => viewportFilter === "all" || entry.name === viewportFilter)) {
    const results = { timeline: null, temperature: null, gx: null };
    for (const testCase of ["timeline", "temperature", "gx"].filter((entry) => caseFilter === "all" || entry === caseFilter)) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      attachDiagnostics(page, `${viewport.name}-${testCase}`);
      if (testCase === "timeline") results.timeline = await operateTimeline(page, viewport);
      if (testCase === "temperature") results.temperature = await operateTemperature(page, viewport);
      if (testCase === "gx") results.gx = await operateGX(page, viewport);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${testCase}-return.png`), fullPage: false });
      await context.close();
    }
    const { timeline, temperature, gx } = results;
    report.scans.push({ viewport: viewport.name, timeline, temperature, gx, passed: true });
  }
  assert.deepEqual(report.consoleErrors, [], `console errors: ${JSON.stringify(report.consoleErrors)}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${JSON.stringify(report.pageErrors)}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${JSON.stringify(report.responses404)}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Required story interactions passed: ${report.scans.length} viewports`);

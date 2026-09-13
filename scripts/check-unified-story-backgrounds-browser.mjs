import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4387", scanScope = "full"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/unified-story-backgrounds");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const cases = [
  ["festival_concept_001", "festival-convention-hall-entrance", "novel-bg-convention-hall-entrance-autumn-morning-v2.png"],
  ["festival_concept_002", "festival-convention-hall-entrance", "novel-bg-convention-hall-entrance-autumn-morning-v2.png"],
  ["festival_concept_008", "festival-b-hall-overview", "novel-bg-festival-b-hall-autumn-morning-v1.png"],
  ["festival_concept_010", "festival-gaia-five-plane-projection", "novel-bg-festival-five-plane-projection-autumn-morning-v2.png"],
  ["map_mode01_029", "map01-data-provenance", "novel-bg-map01-data-provenance-autumn-morning-v3.png"],
  ["gx_experience_001", "gx-ocean-entry", "novel-bg-gx-ancient-ocean-autumn-morning-v3.png"],
  ["circle_invitation_070", "circle-after-welcome", "novel-bg-festival-five-plane-projection-autumn-morning-v2.png"],
  ["gx_experience_030", "gx-coevolution", "novel-bg-gx-breathing-points-autumn-morning-v3.png"],
  ["gx_experience_055", "gx-ten-mode-gateway", "novel-bg-gx-mode-gateway-autumn-morning-v4.png"],
  ["circle_invitation_011", "circle-private-invitation", "novel-bg-festival-five-plane-projection-autumn-morning-v2.png"],
  ["welcome_chat_074", "welcome-night-exit-mobile", "01-turning-in-the-sunset.webp", "01-turning-in-the-sunset.webp"],
  ["welcome_chat_084", "welcome-earth-partner-reflection", "01-turning-in-the-sunset.webp", "01-turning-in-the-sunset.webp"],
  ["festival_concept_015", "festival-first-encounter-cg", "event-cg-first-encounter-five-plane-v3.png", "event-cg-first-encounter-five-plane-mobile-v2.png"],
  ["festival_concept_021", "festival-amane-closeup-cg", "event-cg-amane-closeup-five-plane-v4.png"],
  ["festival_concept_023", "festival-mizuha-closeup-cg", "event-cg-mizuha-closeup-five-plane-v3.png"],
  ["festival_concept_076", "festival-map-transition", "event-cg-festival-map-transition-five-plane-v3.png", "event-cg-festival-map-transition-five-plane-mobile-v1.png"],
  ["map_mode01_001", "map01-co2-observation", "event-cg-festival-map-transition-five-plane-v3.png"],
  ["gx_experience_019", "gx-ancient-ocean", "mode-abstract-v1.webp"],
  ["esp32_pitch_008", "esp32-exhibition-proposal", "event-cg-esp32-collaboration-v2.png", "event-cg-esp32-collaboration-mobile-v1.png"],
  ["circle_invitation_029", "circle-invitation-card-cg", "event-cg-circle-invitation-card-v3.png", "event-cg-circle-invitation-card-mobile-v1.png"],
  ["circle_invitation_048", "circle-welcome-cg", "event-cg-circle-welcome-v2.png", "event-cg-circle-welcome-mobile-v1.png"],
  ["welcome_chat_092", "welcome-exhibition-finale-cg", "01-turning-in-the-sunset.webp", "01-turning-in-the-sunset.webp"],
];
const selectedCases = scanScope === "start" ? cases.slice(0, 2) : scanScope === "smoke" ? [cases[0], cases[1], cases[3], cases[11]] : cases;

const report = { status: "running", scanScope, viewports, cases: [], interactions: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });

const stateFor = (stepId) => ({
  storyVersion: 10,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気候の長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  audio: { muted: true, volume: 0.37 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `unified-background-${stepId}`,
});

const bootAt = async (page, stepId) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([
      { progress: candidate, savedAt: Date.now(), meta: { title: "背景検証", excerpt: candidate.stepId } },
      null,
      null,
      null,
      null,
      null,
    ]));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, stateFor(stepId));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
};

const scanCase = async (viewport, stepId, cueId, desktopFile, mobileFile, index) => {
  const expectedFile = viewport.name.startsWith("mobile") && mobileFile ? mobileFile : desktopFile;
  const label = `${viewport.name}-${String(index + 1).padStart(2, "0")}-${stepId}`;
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const onConsole = (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    report.consoleErrors.push(`${label}: ${message.text()} (${location.url || "inline"}:${location.lineNumber || 0})`);
  };
  page.on("console", onConsole);
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });

  await bootAt(page, stepId);
  await page.waitForFunction((file) => getComputedStyle(document.querySelector("#novel-layer")).backgroundImage.includes(file), expectedFile);
  const scan = await page.evaluate(async ({ expectedFile: file }) => {
    const layer = document.querySelector("#novel-layer");
    const dialogue = document.querySelector("#novel-dialogue");
    const style = getComputedStyle(layer);
    const source = /url\(["']?([^"')]+)/u.exec(style.backgroundImage)?.[1] || "";
    const image = new Image();
    image.src = source;
    await image.decode();
    const layerRect = layer.getBoundingClientRect();
    const dialogueRect = dialogue.getBoundingClientRect();
    return {
      stepId: layer.dataset.stepId,
      cueId: layer.dataset.backgroundCue,
      expectedFile: file,
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      layerRect: layerRect.toJSON(),
      dialogueRect: dialogueRect.toJSON(),
      dialogueOverlapsBackground: dialogueRect.top < layerRect.bottom && dialogueRect.bottom > layerRect.top,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      verticalOverflow: document.documentElement.scrollHeight > innerHeight + 1,
    };
  }, { expectedFile });

  assert.equal(scan.stepId, stepId);
  assert.equal(scan.cueId, cueId);
  assert(scan.backgroundImage.includes(expectedFile));
  const framedEnding = expectedFile === "01-turning-in-the-sunset.webp" && viewport.name.startsWith("mobile");
  if (framedEnding) assert.match(scan.backgroundSize, /^cover, auto [\d.]+px$/u);
  else assert(scan.backgroundSize.split(",").every((value) => value.trim() === "cover"));
  assert(scan.naturalWidth >= 900 && scan.naturalHeight >= 900);
  const expectedAspect = mobileFile && viewport.name.startsWith("mobile") && !framedEnding ? 9 / 16 : 16 / 9;
  assert(Math.abs(scan.naturalWidth / scan.naturalHeight - expectedAspect) < 0.02);
  assert.equal(scan.dialogueOverlapsBackground, true);
  assert.equal(scan.horizontalOverflow, false);
  assert.equal(scan.verticalOverflow, false);

  const screenshotPath = path.join(outputDir, `${label}.png`);
  await page.screenshot({ path: screenshotPath });
  page.off("console", onConsole);
  await context.close();
  report.cases.push({ viewport: viewport.name, screenshotPath, ...scan, passed: true });
};

const prepareInteractionPage = async (viewport, label, reducedMotion = "reduce") => {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  const onConsole = (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    report.consoleErrors.push(`${label}: ${message.text()} (${location.url || "inline"}:${location.lineNumber || 0})`);
  };
  page.on("console", onConsole);
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  await page.addInitScript(() => {
    globalThis.__backgroundQaVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
  });
  return { context, page, onConsole };
};

const scanMapInteraction = async (viewport) => {
  const label = `${viewport.name}-map-progression`;
  const { context, page, onConsole } = await prepareInteractionPage(viewport, label);
  await bootAt(page, "map_mode01_004");
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open" && __backgroundQaVisible(document.querySelector("#japan-layer")));
  const input = page.locator("#japan-layer [data-signal-time]").first();
  await input.focus();
  await input.press("Home");
  await input.press("ArrowRight");
  await page.locator("#japan-map").click({ position: { x: 32, y: 32 } });
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  await page.locator("#story-detour-return").click();
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_005");
  const scan = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    lifecycle: document.body.dataset.novelInteractionState || "idle",
    modalVisible: __backgroundQaVisible(document.querySelector("#japan-layer")),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.deepEqual(scan, { stepId: "map_mode01_005", lifecycle: "idle", modalVisible: false, horizontalOverflow: false });
  await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
  report.interactions.push({ viewport: viewport.name, interaction: "MAP01", ...scan, passed: true });
  page.off("console", onConsole);
  await context.close();
};

const scanGxInteraction = async (viewport) => {
  const label = `${viewport.name}-gx-progression`;
  const { context, page, onConsole } = await prepareInteractionPage(viewport, label);
  await bootAt(page, "gx_experience_017");
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open" && __backgroundQaVisible(document.querySelector("#gx-layer")));
  const stepControl = page.locator('.story-detour-dock[data-kind="gx"] .story-detour-controls button');
  await stepControl.waitFor();
  for (let index = 0; index < 3; index += 1) {
    await stepControl.click();
    await page.waitForTimeout(80);
  }
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  await page.locator("#story-detour-return").click();
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "gx_experience_018");
  const scan = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    lifecycle: document.body.dataset.novelInteractionState || "idle",
    modalVisible: __backgroundQaVisible(document.querySelector("#gx-layer")),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.deepEqual(scan, { stepId: "gx_experience_018", lifecycle: "idle", modalVisible: false, horizontalOverflow: false });
  await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
  report.interactions.push({ viewport: viewport.name, interaction: "GX", ...scan, passed: true });
  page.off("console", onConsole);
  await context.close();
};

const makeContactSheet = async (viewport) => {
  const scans = report.cases.filter((entry) => entry.viewport === viewport.name);
  const isMobile = viewport.name.startsWith("mobile");
  const columns = isMobile ? 6 : 4;
  const cellWidth = isMobile ? 195 : 360;
  const imageHeight = isMobile ? 422 : 225;
  const labelHeight = 24;
  const rows = Math.ceil(scans.length / columns);
  const page = await browser.newPage({ viewport: { width: columns * cellWidth, height: rows * (imageHeight + labelHeight) } });
  const cells = scans.map((scan) => {
    const encoded = fs.readFileSync(scan.screenshotPath).toString("base64");
    return `<figure><img src="data:image/png;base64,${encoded}"><figcaption>${scan.stepId}</figcaption></figure>`;
  }).join("");
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;background:#061126}main{display:grid;grid-template-columns:repeat(${columns},${cellWidth}px)}figure{margin:0;width:${cellWidth}px;height:${imageHeight + labelHeight}px;border:1px solid #6f91b5;background:#061126}img{display:block;width:100%;height:${imageHeight}px;object-fit:fill}figcaption{height:${labelHeight}px;padding:4px 6px;color:#eef7ff;font:12px/16px monospace;white-space:nowrap;overflow:hidden}</style><main>${cells}</main>`);
  const outputPath = path.join(outputDir, `${viewport.name}-contact-sheet.png`);
  await page.screenshot({ path: outputPath, fullPage: true });
  await page.close();
  return outputPath;
};

try {
  for (const viewport of viewports) {
    for (const [index, [stepId, cueId, desktopFile, mobileFile]] of selectedCases.entries()) {
      await scanCase(viewport, stepId, cueId, desktopFile, mobileFile, index);
    }
    if (scanScope !== "start") {
      await scanMapInteraction(viewport);
      await scanGxInteraction(viewport);
    }
  }
  report.contactSheets = [];
  for (const viewport of viewports) report.contactSheets.push(await makeContactSheet(viewport));
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`unified story background browser check passed: ${report.cases.length} background scans, ${report.interactions.length} interaction scans, ${selectedCases.length} assets (${scanScope})`);
  console.log(report.contactSheets.join("\n"));
} finally {
  await browser.close();
}

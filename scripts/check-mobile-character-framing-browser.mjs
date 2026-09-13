import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4575"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/mobile-character-framing");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-430", width: 430, height: 932 },
];
const cases = [
  { name: "amane-normal", stepId: "festival_concept_032", cast: "novel-character-sora", portraitAsset: "amane-calm-07-v3.png" },
  { name: "mizuha-normal", stepId: "festival_concept_036", cast: "novel-character-minamo" },
  { name: "mizuha-physical", stepId: "welcome_chat_055", cast: "novel-character-minamo", portraitAsset: "mizuha-worried-07-v2.png" },
  { name: "amane-physical", stepId: "welcome_chat_060", cast: "novel-character-sora", portraitAsset: "amane-soft-07-v3.png" },
  { name: "first-encounter-cg", stepId: "festival_concept_015", eventCg: true, mobileAsset: "event-cg-first-encounter-five-plane-mobile-v2.png" },
  { name: "amane-closeup-cg", stepId: "festival_concept_021", eventCg: true },
  { name: "mizuha-closeup-cg", stepId: "festival_concept_023", eventCg: true },
  { name: "festival-map-transition-cg", stepId: "festival_concept_076", eventCg: true, mobileAsset: "event-cg-festival-map-transition-five-plane-mobile-v1.png" },
  { name: "map01-character-background-cg", stepId: "map_mode01_003", eventCg: true, mobileAsset: "event-cg-festival-map-transition-five-plane-mobile-v1.png" },
  { name: "esp32-collaboration-cg", stepId: "esp32_pitch_008", eventCg: true, mobileAsset: "event-cg-esp32-collaboration-mobile-v1.png" },
  { name: "invitation-card-cg", stepId: "circle_invitation_029", eventCg: true, mobileAsset: "event-cg-circle-invitation-card-mobile-v1.png" },
  { name: "circle-welcome-cg", stepId: "circle_invitation_048", eventCg: true, mobileAsset: "event-cg-circle-welcome-mobile-v1.png" },
  { name: "exhibition-finale-cg", stepId: "welcome_chat_092", eventCg: true, mobileAsset: "01-turning-in-the-sunset.webp" },
];
const report = { status: "running", viewports, cases: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });

const stateFor = (stepId) => ({
  storyVersion: 10,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "太古の海",
  metCharacters: { mizuha: true, amane: true, sakuya: false },
  audio: { muted: true, volume: 0 },
  readStepIds: [stepId],
  clear: false,
  archivesUnlocked: false,
  sessionId: `mobile-character-framing-${stepId}`,
});

const bootAt = async (page, stepId) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const candidate = { ...stateFor(stepId), storyVersion };
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([
      { progress: candidate, savedAt: Date.now(), meta: { title: "Mobile framing QA", excerpt: candidate.stepId } },
    ]));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, candidate);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForTimeout(120);
};

const scanCase = async (viewport, testCase, index) => {
  const label = `${viewport.name}-${String(index + 1).padStart(2, "0")}-${testCase.name}`;
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  await bootAt(page, testCase.stepId);
  const scan = await page.evaluate(async () => {
    const layer = document.querySelector("#novel-layer");
    const layerStyle = getComputedStyle(layer);
    const visible = (node) => {
      if (!node || node.hidden) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.5 && rect.width > 0 && rect.height > 0;
    };
    const rect = (node) => node ? node.getBoundingClientRect().toJSON() : null;
    const activeCharacters = [...document.querySelectorAll("#novel-cast .novel-character")].filter(visible);
    const activeCharacter = activeCharacters[0] || null;
    const portrait = activeCharacter?.querySelector(".novel-character-portrait") || null;
    const source = /url\(["']?([^"')]+)/u.exec(layerStyle.backgroundImage)?.[1] || "";
    let naturalSize = null;
    if (source) {
      const image = new Image();
      image.src = source;
      await image.decode();
      naturalSize = { width: image.naturalWidth, height: image.naturalHeight };
    }
    return {
      stepId: layer.dataset.stepId,
      presentation: layer.dataset.backgroundPresentation || "scenic",
      backgroundCue: layer.dataset.backgroundCue || "",
      backgroundImage: layerStyle.backgroundImage,
      backgroundSize: layerStyle.backgroundSize,
      backgroundPosition: layerStyle.backgroundPosition,
      naturalSize,
      activeCast: activeCharacters.map((node) => node.id),
      characterRect: rect(activeCharacter),
      portraitBackgroundImage: portrait ? getComputedStyle(portrait).backgroundImage : "none",
      portraitBackgroundSize: portrait ? getComputedStyle(portrait).backgroundSize : "",
      portraitBackgroundPosition: portrait ? getComputedStyle(portrait).backgroundPosition : "",
      portraitMask: portrait ? getComputedStyle(portrait).maskImage : null,
      layerRect: rect(layer),
      dialogueRect: rect(document.querySelector("#novel-dialogue")),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      verticalOverflow: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  assert.equal(scan.stepId, testCase.stepId);
  assert.equal(scan.horizontalOverflow, false);
  assert.equal(scan.verticalOverflow, false);
  if (testCase.eventCg) {
    assert.equal(scan.presentation, "event-cg");
    assert.deepEqual(scan.activeCast, []);
    if (testCase.mobileAsset) {
      assert(scan.backgroundImage.includes(testCase.mobileAsset), `${label}: mobile event CG was not selected`);
      const aspect = testCase.mobileAsset === "01-turning-in-the-sunset.webp" ? 1672 / 941 : 9 / 16;
      assert(scan.naturalSize && Math.abs(scan.naturalSize.width / scan.naturalSize.height - aspect) < 0.02);
    }
  } else {
    assert.deepEqual(scan.activeCast, [testCase.cast]);
    assert(scan.characterRect && scan.layerRect);
    assert(Math.abs(scan.characterRect.bottom - scan.layerRect.bottom) <= 2, `${label}: portrait does not reach stage bottom`);
    assert.equal(scan.portraitMask, "none");
    if (testCase.portraitAsset) {
      assert(scan.portraitBackgroundImage.includes(testCase.portraitAsset), `${label}: expected portrait asset was not selected`);
    }
  }
  const screenshotPath = path.join(outputDir, `${label}.png`);
  await page.screenshot({ path: screenshotPath, animations: "disabled" });
  report.cases.push({ viewport: viewport.name, ...testCase, ...scan, screenshotPath, passed: true });
  await context.close();
};

const makeContactSheet = async (viewport) => {
  const scans = report.cases.filter((entry) => entry.viewport === viewport.name);
  const columns = 6;
  const cellWidth = Math.round(viewport.width / 2);
  const imageHeight = Math.round(viewport.height / 2);
  const labelHeight = 24;
  const page = await browser.newPage({ viewport: { width: columns * cellWidth, height: Math.ceil(scans.length / columns) * (imageHeight + labelHeight) } });
  const cells = scans.map((scan) => {
    const encoded = fs.readFileSync(scan.screenshotPath).toString("base64");
    return `<figure><img src="data:image/png;base64,${encoded}"><figcaption>${scan.name}</figcaption></figure>`;
  }).join("");
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;background:#061126}main{display:grid;grid-template-columns:repeat(${columns},${cellWidth}px)}figure{margin:0;width:${cellWidth}px;height:${imageHeight + labelHeight}px;border:1px solid #6f91b5;background:#061126}img{display:block;width:100%;height:${imageHeight}px;object-fit:fill}figcaption{height:${labelHeight}px;padding:4px 6px;color:#eef7ff;font:12px/16px monospace;white-space:nowrap;overflow:hidden}</style><main>${cells}</main>`);
  const outputPath = path.join(outputDir, `${viewport.name}-contact-sheet.png`);
  await page.screenshot({ path: outputPath, fullPage: true });
  await page.close();
  return outputPath;
};

const assertMobileDialogueDistanceMatch = (viewport) => {
  const scans = report.cases.filter((entry) => entry.viewport === viewport.name);
  const amane = scans.find((entry) => entry.name === "amane-normal");
  const mizuhaScans = scans.filter((entry) => entry.name === "mizuha-normal" || entry.name === "mizuha-physical");
  const backgroundHeight = (entry) => Number(/auto\s+([\d.]+)px/u.exec(entry?.portraitBackgroundSize || "")?.[1]);
  const amaneHeight = backgroundHeight(amane);
  assert(Number.isFinite(amaneHeight), `${viewport.name}: Amane portrait height was not measurable`);
  assert.equal(amane.portraitBackgroundPosition, "50% 0px", `${viewport.name}: Amane head alignment drifted`);
  for (const mizuha of mizuhaScans) {
    const mizuhaHeight = backgroundHeight(mizuha);
    assert(Number.isFinite(mizuhaHeight), `${viewport.name}/${mizuha.name}: Mizuha portrait height was not measurable`);
    const ratio = mizuhaHeight / amaneHeight;
    assert(ratio >= 1.32 && ratio <= 1.36, `${viewport.name}/${mizuha.name}: Mizuha distance compensation ratio was ${ratio}`);
    assert.equal(mizuha.portraitBackgroundPosition, "50% -60px", `${viewport.name}/${mizuha.name}: Mizuha head alignment drifted`);
  }
};

try {
  for (const viewport of viewports) {
    for (const [index, testCase] of cases.entries()) await scanCase(viewport, testCase, index);
    assertMobileDialogueDistanceMatch(viewport);
  }
  report.contactSheets = [];
  for (const viewport of viewports) report.contactSheets.push(await makeContactSheet(viewport));
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  console.log(`mobile character framing browser check passed: ${report.cases.length} scans`);
  console.log(report.contactSheets.join("\n"));
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

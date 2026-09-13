import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4173";
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/coastal-venue-background");
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required.");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?coastal=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const configKey = "gaiaSensewareNovel:config:v2";
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const diagnostics = { consoleErrors: [], pageErrors: [], responses404: [] };
const report = { baseUrl: routeUrl, viewports: [], diagnostics };

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-first-run", "--disable-background-networking"],
});

const bootAt = async (page, stepId) => {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15000 });
  await page.evaluate(({ key, config, version, id }) => {
    localStorage.setItem(key, JSON.stringify({
      storyVersion: version,
      stepId: id,
      reachedSceneIds: [],
      viewed: {},
      evesRoute: [],
      observationOrder: null,
      editorialChoice: null,
      reflectionIds: [],
      resultTone: null,
      metCharacters: { mizuha: false, amane: false, sakuya: false },
      audio: { muted: false, volume: 0.1 },
      readStepIds: [],
      clear: false,
      archivesUnlocked: false,
      sessionId: "coastal-background-check",
    }));
    localStorage.setItem(config, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { key: storageKey, config: configKey, version: story.storyVersion, id: stepId });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15000 });
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
};

for (const viewport of [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(`${viewport.name}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) diagnostics.responses404.push(`${viewport.name}: ${response.url()}`); });

  await bootAt(page, "first_meeting_hall_002");
  const presentation = await page.locator("#novel-layer").evaluate((layer) => {
    const style = getComputedStyle(layer);
    return {
      sceneId: layer.dataset.sceneId,
      stepId: layer.dataset.stepId,
      backgroundImage: style.backgroundImage,
      backgroundPosition: style.backgroundPosition,
      backgroundSize: style.backgroundSize,
      backgroundRepeat: style.backgroundRepeat,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert(presentation.sceneId === "first_meeting_hall" && presentation.stepId === "first_meeting_hall_002", `wrong scene at ${viewport.name}: ${JSON.stringify(presentation)}`);
  assert(presentation.backgroundImage.includes("novel-bg-coastal-venue-v3.png"), `v3 missing at ${viewport.name}: ${presentation.backgroundImage}`);
  assert(presentation.backgroundPosition.split(",").every((value) => value.trim() === "50% 50%" || value.trim() === "center"), `background crop changed at ${viewport.name}: ${presentation.backgroundPosition}`);
  assert(presentation.backgroundSize.split(",").every((value) => value.trim() === "cover"), `background size changed at ${viewport.name}: ${presentation.backgroundSize}`);
  assert(!presentation.horizontalOverflow, `horizontal overflow at ${viewport.name}`);
  const screenshot = path.join(outputDir, `${viewport.name}-first-meeting-hall-002.png`);
  await page.screenshot({ path: screenshot, animations: "disabled" });
  report.viewports.push({ ...viewport, screenshot, presentation });
  await context.close();
}

assert(diagnostics.consoleErrors.length === 0, `console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
assert(diagnostics.pageErrors.length === 0, `page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
assert(diagnostics.responses404.length === 0, `404 responses: ${JSON.stringify(diagnostics.responses404)}`);
const reportPath = path.join(outputDir, "report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await browser.close();
console.log(`Coastal venue background check passed: ${reportPath}`);

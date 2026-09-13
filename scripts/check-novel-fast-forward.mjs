import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/novel-fast-forward");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4173";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?fast-forward=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const allSteps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(allSteps.map((step) => [step.id, step]));
const choiceStep = allSteps.find((step) => step.type === "choice");
const simpleStep = allSteps.find((step) => step.type === "narration" && step.sceneId === "current_exhibition");
assert.ok(choiceStep && simpleStep, "fast-forward fixtures are missing");

const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const configKey = "gaiaSensewareNovel:config:v2";
const fastForwardMarkup = `<button id="novel-fast-forward-button" type="button" aria-pressed="false" title="クリックで切替／Ctrlキー長押しでも早送り"><span aria-hidden="true">≫</span><b id="novel-fast-forward-label">早送り</b></button>`;

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
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "fast-forward-check",
});

const report = {
  baseUrl: routeUrl,
  viewports: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const ensureNovelOpen = async (page) => {
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer.classList.contains("is-open")) globalThis.GaiaNovel.open();
  });
  await page.locator("#novel-title-screen").waitFor({ state: "visible", timeout: 15_000 });
};

const bootAt = async (page, stepId) => {
  await page.evaluate(({ key, config, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem(config, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { key: storageKey, config: configKey, state: baseState(stepId) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
};

const fastState = (page) => page.evaluate(() => ({
  stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
  active: document.querySelector("#novel-fast-forward-button")?.classList.contains("is-active") || false,
  held: document.querySelector("#novel-fast-forward-button")?.classList.contains("is-control-held") || false,
  pressed: document.querySelector("#novel-fast-forward-button")?.getAttribute("aria-pressed") || "",
  label: document.querySelector("#novel-fast-forward-label")?.textContent
    || document.querySelector("#novel-fast-forward-button")?.textContent.trim()
    || "",
  auto: document.querySelector("#novel-auto-button")?.getAttribute("aria-pressed") || "",
  restartHidden: document.querySelector("#novel-restart-button")?.hidden ?? false,
  restartRect: document.querySelector("#novel-restart-button")?.getBoundingClientRect().toJSON() || null,
}));

const waitForActive = (page, active) => page.waitForFunction((expected) => (
  document.querySelector("#novel-fast-forward-button")?.classList.contains("is-active") === expected
), active);

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });

try {
  for (const viewport of [{ name: "pc-1440", width: 1440, height: 900 }, { name: "mobile-390", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
    await page.route("**/story*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const body = source.includes('id="novel-fast-forward-button"')
        ? source
        : source.replace('<button id="novel-restart-button"', `${fastForwardMarkup}<button id="novel-restart-button"`);
      await route.fulfill({ response, body });
    });
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);

    await bootAt(page, simpleStep.id);
    let before = await fastState(page);
    assert.equal(before.restartHidden, true, `${viewport.name}: RESTART is visible`);
    assert.equal(before.restartRect.width, 0, `${viewport.name}: hidden RESTART retains a hit target`);
    await page.locator("#novel-auto-button").click();
    assert.equal((await fastState(page)).auto, "true", `${viewport.name}: AUTO did not enable`);
    await page.locator("#novel-fast-forward-button").click();
    await waitForActive(page, true);
    let active = await fastState(page);
    assert.equal(active.pressed, "true", `${viewport.name}: button toggle did not set aria-pressed`);
    assert.equal(active.label, "早送り中", `${viewport.name}: active label did not update`);
    assert.equal(active.auto, "false", `${viewport.name}: fast-forward did not disable AUTO`);
    await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, before.stepId);
    await page.locator("#novel-fast-forward-button").click();
    await waitForActive(page, false);

    await bootAt(page, simpleStep.id);
    await page.keyboard.down("Control");
    await waitForActive(page, true);
    active = await fastState(page);
    assert.equal(active.held, true, `${viewport.name}: Ctrl hold is not identified`);
    assert.equal(active.pressed, "false", `${viewport.name}: Ctrl hold changed button toggle state`);
    await page.keyboard.up("Control");
    await waitForActive(page, false);

    await bootAt(page, simpleStep.id);
    const shortcutAllowed = await page.evaluate(() => {
      const control = new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft", ctrlKey: true, bubbles: true, cancelable: true });
      const shortcut = new KeyboardEvent("keydown", { key: "s", code: "KeyS", ctrlKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(control);
      const allowed = document.dispatchEvent(shortcut);
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", code: "ControlLeft", bubbles: true }));
      return allowed;
    });
    await page.waitForTimeout(230);
    assert.equal(shortcutAllowed, true, `${viewport.name}: Ctrl+S was prevented`);
    assert.equal((await fastState(page)).active, false, `${viewport.name}: Ctrl+S activated fast-forward`);

    await bootAt(page, simpleStep.id);
    await page.locator("#novel-config-button").click();
    await page.locator("#novel-config-panel").waitFor({ state: "visible" });
    await page.locator("#novel-message-speed").focus();
    await page.keyboard.down("Control");
    await page.waitForTimeout(230);
    assert.equal((await fastState(page)).active, false, `${viewport.name}: input Ctrl activated fast-forward`);
    await page.keyboard.up("Control");
    await page.locator("#novel-config-close").click();

    await bootAt(page, simpleStep.id);
    await page.keyboard.down("Control");
    await waitForActive(page, true);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await waitForActive(page, false);
    await page.keyboard.up("Control");

    await bootAt(page, simpleStep.id);
    await page.keyboard.down("Control");
    await waitForActive(page, true);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitForActive(page, false);
    await page.keyboard.up("Control");

    await bootAt(page, choiceStep.id);
    await page.locator("#novel-fast-forward-button").click();
    await waitForActive(page, false);
    assert.equal((await fastState(page)).stepId, choiceStep.id, `${viewport.name}: fast-forward crossed a choice barrier`);

    await bootAt(page, simpleStep.id);
    await page.locator("#novel-fast-forward-button").click();
    await waitForActive(page, true);
    await page.evaluate(() => globalThis.GaiaNovel.close());
    await waitForActive(page, false);
    const closed = await fastState(page);
    assert.equal(closed.pressed, "false", `${viewport.name}: story close left button toggled`);

    report.viewports.push({ name: viewport.name, checks: 9, final: closed });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, [], `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${report.pageErrors.join(" | ")}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`novel fast-forward check passed: ${report.viewports.length} viewports, button/Ctrl/shortcut/input/blur/visibility/choice/close`);

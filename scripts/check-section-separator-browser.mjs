import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, baseUrlArgument, outputArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4289";
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/section-separator-browser");
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");
const cssSource = fs.readFileSync(path.join(projectRoot, "novel-mode.css"), "utf8");
assert.match(jsSource, /const SECTION_SEPARATOR_MS = 4200;/u);
assert.match(jsSource, /const SECTION_SEPARATOR_REDUCED_MOTION_MS = 4900;/u);
assert.match(jsSource, /const AUTO_DELAY_MS = 3600;/u, "AUTO delay must not change with the title hold");
assert.match(cssSource, /animation: novel-chapter-in 1\.45s ease both;/u, "non-section cards must keep their original timing");
assert.match(cssSource, /animation: novel-chapter-beam 1\.45s cubic-bezier\(0\.22, 1, 0\.36, 1\) both;/u, "non-section beams must keep their original timing");
assert.match(cssSource, /animation: novel-section-chapter-in 4\.2s ease both;/u);
assert.match(cssSource, /animation: novel-section-chapter-beam 4\.2s cubic-bezier\(0\.22, 1, 0\.36, 1\) both;/u);
assert.match(cssSource, /8\.3%, 91\.7% \{ opacity: 1;/u);
assert.match(cssSource, /0%, 3\.5% \{ opacity: 0; transform: scaleX\(0\); \}/u);
assert.match(cssSource, /11\.1%, 91\.1% \{ opacity: 1; transform: scaleX\(1\); \}/u);
assert.match(jsSource, /function renderChapterTitleUnits\(value\)/u);
assert.match(jsSource, /renderChapterTitleUnits\(scene\.title\)/u);
assert.match(jsSource, /renderChapterTitleUnits\(transition\.displayTitle\)/u);
assert.match(cssSource, /\.novel-chapter-title-unit,[\s\S]*?white-space: nowrap;/u);
assert.match(cssSource, /flex-wrap: wrap;/u);

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?section-separator=1`);
const story = globalThis.GAIA_NOVEL_STORY;
assert.equal(story.scenes.length, 6, "section separator scope must cover all 6 contest-v10 scenes");
const transitionSeparators = story.scenes.flatMap((scene) => [scene.temporal?.entryTransition, ...(scene.temporal?.transitions || [])]
  .filter((transition) => transition?.fromTemporalContext && transition?.toTemporalContext)
  .map((transition) => ({ kind: "transition", id: transition.stepId, title: transition.displayTitle })));
assert.equal(transitionSeparators.length, 0, "contest-v10 introduced an unexpected temporal transition separator");
const separatorCases = [
  ...story.scenes.map((scene) => ({ kind: "scene", id: scene.id, title: scene.title, chapter: scene.chapter })),
  ...transitionSeparators,
];

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
const routeUrl = new URL("/story", baseUrl).href;
const STORAGE_KEY = "gaiaSensewareNovel:progress";
const MANUAL_SAVE_KEY = "gaiaSensewareNovel:manual-saves";
const CONFIG_KEY = "gaiaSensewareNovel:config:v3";
const errors = [];
const responses404 = [];
const report = { status: "running", separatorCases: separatorCases.length, scans: [], timingChecks: [], errors, responses404 };
fs.mkdirSync(outputDir, { recursive: true });

const baseState = (stepId) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  audio: { muted: false, volume: 0.1 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "separator-browser-check",
});

const separatorLayout = (page) => page.locator("#novel-chapter-title").evaluate((title) => {
  const card = title.closest(".novel-chapter-card");
  const cardRect = card.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const units = [...title.querySelectorAll("[data-title-unit]")].map((unit) => {
    const rect = unit.getBoundingClientRect();
    return {
      kind: unit.dataset.titleUnit,
      text: unit.textContent,
      rectCount: unit.getClientRects().length,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
  const lineMap = new Map();
  units.forEach((unit) => {
    const key = Math.round(unit.top * 10) / 10;
    const line = lineMap.get(key) || { top: key, text: "", labelCharacters: 0 };
    line.text += unit.text;
    if (unit.kind === "label") line.labelCharacters += Array.from(unit.text).length;
    lineMap.set(key, line);
  });
  const lines = [...lineMap.values()].sort((left, right) => left.top - right.top);
  const separators = units.flatMap((unit, index) => unit.kind === "separator" ? [{ unit, next: units[index + 1] }] : []);
  return {
    text: title.textContent,
    ariaLabel: title.getAttribute("aria-label"),
    density: title.dataset.titleDensity,
    units,
    lines,
    lineCount: lines.length,
    splitUnits: units.filter((unit) => unit.rectCount !== 1),
    isolatedLabelLines: lines.filter((line) => line.labelCharacters === 1),
    detachedSeparators: separators.filter(({ unit, next }) => !next || next.kind !== "label" || Math.abs(unit.top - next.top) > 1),
    clippedUnits: units.filter((unit) => unit.left < cardRect.left - 1 || unit.right > cardRect.right + 1 || unit.left < -1 || unit.right > innerWidth + 1),
    card: { left: cardRect.left, right: cardRect.right, width: cardRect.width },
    title: { left: titleRect.left, right: titleRect.right, width: titleRect.width },
    bodyOverflow: document.documentElement.scrollWidth - innerWidth,
  };
});

const renderSeparatorCase = (page, item) => page.evaluate((current) => {
  const layer = document.querySelector("#novel-layer");
  const runtime = document.querySelector("#novel-runtime");
  const titleScreen = document.querySelector("#novel-title-screen");
  const card = document.querySelector("#novel-chapter-card");
  const index = document.querySelector("#novel-chapter-index");
  const title = document.querySelector("#novel-chapter-title");
  const labels = String(current.title || "").split("｜");
  const longestLabel = labels.reduce((longest, label) => Math.max(longest, Array.from(label).length), 0);
  title.dataset.titleDensity = longestLabel >= 23 ? "dense" : longestLabel >= 17 ? "compact" : "regular";
  title.setAttribute("aria-label", current.title);
  const labelUnit = (label) => {
    const unit = document.createElement("span");
    unit.className = "novel-chapter-title-unit";
    unit.dataset.titleUnit = "label";
    unit.textContent = label;
    return unit;
  };
  const units = [labelUnit(labels.shift() || "")];
  labels.forEach((label) => {
    const tail = document.createElement("span");
    tail.className = "novel-chapter-title-tail";
    const separator = document.createElement("span");
    separator.className = "novel-chapter-title-unit is-separator";
    separator.dataset.titleUnit = "separator";
    separator.textContent = "｜";
    tail.append(separator, labelUnit(label));
    units.push(tail);
  });
  title.replaceChildren(...units);
  index.textContent = current.chapter || (current.kind === "transition" ? "CURRENT ↔ RECORD" : "SCENE");
  layer.dataset.stepType = current.kind === "transition" ? "temporal-transition" : "section-separator";
  runtime.hidden = false;
  titleScreen.hidden = true;
  card.hidden = false;
  card.style.animation = "none";
  card.style.opacity = "1";
  card.style.filter = "none";
  card.style.transform = "translate(-50%, -50%)";
}, item);

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const reducedMotion of [false, true]) {
      const page = await browser.newPage({ viewport });
      await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
      const label = `${viewport.width}/${reducedMotion ? "reduced" : "normal"}`;
      page.on("console", (message) => { if (message.type() === "error") errors.push(`${label}: ${message.text()}`); });
      page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
      page.on("response", (response) => { if (response.status() === 404) responses404.push(`${label}: ${response.url()}`); });
      await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
      await page.evaluate(() => globalThis.GaiaNovel.open());

      await page.evaluate(() => document.querySelector("#novel-start-button").click());
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "section-separator");
      const firstStep = await page.locator("#novel-layer").getAttribute("data-step-id");
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "narration");
      assert.equal(await page.locator("#novel-layer").getAttribute("data-step-id"), firstStep, `${label}: initial chapter card skipped the first story step`);

      await page.evaluate(() => {
        const card = document.querySelector("#novel-chapter-card");
        const layer = document.querySelector("#novel-layer");
        const timing = { startedAt: null, finishedAt: null, visibleAfter3s: false };
        window.__gaiaSeparatorTimingCheck = timing;
        const observer = new MutationObserver(() => {
          if (!card.hidden) {
            // Measure the separator itself, excluding the restart's background transition.
            if (timing.startedAt === null && layer.dataset.stepType === "section-separator") {
              timing.startedAt = performance.now();
              setTimeout(() => {
                timing.visibleAfter3s = !card.hidden && Number(getComputedStyle(card).opacity) === 1;
              }, 3000);
            }
            return;
          }
          if (timing.startedAt === null) return;
          timing.finishedAt = performance.now();
          observer.disconnect();
        });
        observer.observe(card, { attributes: true, attributeFilter: ["hidden"] });
        observer.observe(layer, { attributes: true, attributeFilter: ["data-step-type"] });
        document.querySelector("#novel-restart-button").click();
      });
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "section-separator");
      const initialStep = await page.locator("#novel-layer").getAttribute("data-step-id");
      const initialLayout = await separatorLayout(page);
      assert.equal(initialLayout.text, story.scenes[0].title, `${label}: initial separator title changed`);
      assert.equal(initialLayout.units.map((unit) => unit.text).join(""), story.scenes[0].title, `${label}: initial separator units changed`);
      assert.equal(initialLayout.splitUnits.length, 0, `${label}: initial separator split inside a unit`);
      assert.equal(initialLayout.detachedSeparators.length, 0, `${label}: initial separator bar detached from its right label`);
      const animation = await page.locator("#novel-chapter-card").evaluate((card) => {
        const item = card.getAnimations({ subtree: true }).find((candidate) => candidate.animationName === "novel-section-chapter-in");
        return item ? { duration: item.effect.getTiming().duration, keyframes: item.effect.getKeyframes().map(({ offset, opacity }) => ({ offset, opacity })) } : null;
      });
      if (reducedMotion) {
        assert.equal(animation, null, `${label}: reduced motion must not run the fade animation`);
      } else {
        assert.equal(animation?.duration, 4200, `${label}: motion animation duration changed`);
        const offsets = animation?.keyframes.map(({ offset }) => Number(offset.toFixed(3)));
        assert.deepEqual(offsets, [0, 0.083, 0.917, 1], `${label}: fade/hold boundaries changed`);
      }
      await page.waitForFunction(() => document.querySelector("#novel-chapter-card")?.hidden, null, { timeout: 5000 });
      const timing = await page.evaluate(() => window.__gaiaSeparatorTimingCheck);
      assert.equal(timing.visibleAfter3s, true, `${label}: extended hold must keep the title fully visible`);
      const elapsed = timing.finishedAt - timing.startedAt;
      const minimum = reducedMotion ? 4820 : 4120;
      const maximum = reducedMotion ? 5300 : 4600;
      assert(elapsed >= minimum && elapsed <= maximum, `${label}: hide timing ${Math.round(elapsed)}ms is outside ${minimum}-${maximum}ms`);
      report.timingChecks.push({ label, elapsed, minimum, maximum, passed: true });
      assert.equal(await page.locator("#novel-layer").getAttribute("data-step-id"), initialStep, `${label}: first story step was skipped`);

      await page.evaluate(() => document.querySelector("#novel-restart-button").click());
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "section-separator");
      const restartStep = await page.locator("#novel-layer").getAttribute("data-step-id");
      await page.locator("#novel-layer").dispatchEvent("keydown", { key: "Enter" });
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType !== "section-separator");
      assert.equal(await page.locator("#novel-layer").getAttribute("data-step-id"), restartStep, `${label}: manual dismiss skipped the first step`);

      await page.evaluate(({ storageKey, manualSaveKey, configKey, stateValue, reduced }) => {
        localStorage.setItem(storageKey, JSON.stringify(stateValue));
        localStorage.setItem(manualSaveKey, JSON.stringify([{
          progress: stateValue,
          savedAt: Date.now(),
          meta: { title: "Section separator QA", excerpt: stateValue.stepId },
        }]));
        localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 200, reducedMotion: reduced }));
      }, { storageKey: STORAGE_KEY, manualSaveKey: MANUAL_SAVE_KEY, configKey: CONFIG_KEY, stateValue: baseState("festival_concept_005"), reduced: reducedMotion });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
      await page.evaluate(() => globalThis.GaiaNovel.open());
      // The current /story route resumes saved progress directly, without the legacy title menu.
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "festival_concept_005");
      assert.notEqual(await page.locator("#novel-layer").getAttribute("data-step-type"), "section-separator", `${label}: RESUME incorrectly replayed the scene title`);

      await page.evaluate(() => window.dispatchEvent(new CustomEvent("gaia:novel-open-at-mode", { detail: { index: 2, source: "separator-check" } })));
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "section-separator");
      await page.locator("#novel-layer").dispatchEvent("keydown", { key: " " });
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType !== "section-separator");
      await page.close();
    }
  }
  for (const viewport of [
    { name: "pc-2048", width: 2048, height: 1114 },
    { name: "pc-1440", width: 1440, height: 900 },
    { name: "pc-1280", width: 1280, height: 800 },
    { name: "pc-1024", width: 1024, height: 768 },
    { name: "mobile-390", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => errors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) responses404.push(`${viewport.name}: ${response.url()}`); });
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => globalThis.GaiaNovel.open());
    for (const item of separatorCases) {
      await renderSeparatorCase(page, item);
      const layout = await separatorLayout(page);
      assert.equal(layout.text, item.title, `${viewport.name}/${item.id}: title text changed`);
      assert.equal(layout.ariaLabel, item.title, `${viewport.name}/${item.id}: accessible title changed`);
      assert.equal(layout.units.map((unit) => unit.text).join(""), item.title, `${viewport.name}/${item.id}: unit order changed`);
      assert.equal(layout.splitUnits.length, 0, `${viewport.name}/${item.id}: Japanese label split inside a unit ${JSON.stringify(layout.splitUnits)}`);
      assert.equal(layout.isolatedLabelLines.length, 0, `${viewport.name}/${item.id}: isolated one-character label line ${JSON.stringify(layout.lines)}`);
      assert.equal(layout.detachedSeparators.length, 0, `${viewport.name}/${item.id}: separator bar detached from its right label`);
      assert.equal(layout.clippedUnits.length, 0, `${viewport.name}/${item.id}: separator unit clipped ${JSON.stringify(layout.clippedUnits)}`);
      assert(layout.bodyOverflow <= 1, `${viewport.name}/${item.id}: horizontal overflow ${layout.bodyOverflow}`);
      if (viewport.width >= 1024) assert.equal(layout.lineCount, 1, `${viewport.name}/${item.id}: PC separator is not one line ${JSON.stringify(layout.lines)}`);
      report.scans.push({ viewport: viewport.name, ...item, layout, passed: true });
    }
    const evidenceItem = separatorCases.find((item) => item.id === story.startSceneId);
    await renderSeparatorCase(page, evidenceItem);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-festival-concept.png`), animations: "disabled", timeout: 90000 });
    if (viewport.width === 390 && transitionSeparators.length) {
      const transitionEvidence = transitionSeparators.reduce((longest, item) => item.title.length > longest.title.length ? item : longest);
      await renderSeparatorCase(page, transitionEvidence);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-transition-wrap.png`), animations: "disabled", timeout: 90000 });
    }
    await page.close();
  }
  assert.equal(errors.length, 0, `browser errors: ${errors.join(" | ")}`);
  assert.equal(responses404.length, 0, `404 responses: ${responses404.join(" | ")}`);
  report.status = "passed";
  console.log("section separator browser check passed: 6 scenes, 2048/1440/1280/1024/390 layout, normal/reduced timing, OPENING/RESTART/RESUME/mode entry, manual dismiss");
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

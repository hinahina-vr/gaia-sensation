import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, baseUrlArgument, outputArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4304";
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/temporal-heading-browser");
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = path.dirname(moduleRoot);
const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const jsSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");
const cssSource = fs.readFileSync(path.join(projectRoot, "novel-mode.css"), "utf8");
assert.doesNotMatch(indexSource, />\s*DETAIL\s*[+＋]?\s*</iu, "visible DETAIL label remains in the story markup");
assert.match(jsSource, /function renderTemporalHeading\(value\)/u);
assert.match(jsSource, /renderTemporalHeading\(displayTitle\)/u);
assert.match(cssSource, /\.novel-temporal-heading-unit,[\s\S]*?white-space:\s*nowrap;/u);
assert.match(cssSource, /left:\s*50vw;/u);

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?temporal-heading=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
assert.ok(story.scenes.length > 0, "temporal heading scope is empty");
const sceneCases = story.scenes.map((scene) => ({
  kind: "scene",
  id: scene.id,
  stepId: scene.steps[0].id,
  title: scene.temporal.displayTitle,
}));
const transitionCases = story.scenes.flatMap((scene) => (scene.temporal.transitions || [])
  .filter((transition) => transition.displayMode !== "ARCHIVE_REFERENCE")
  .map((transition, index) => ({
    kind: "transition",
    id: `${scene.id}:${transition.stepId}:${index}`,
    stepId: transition.stepId,
    title: transition.displayTitle,
  })));
const headingCases = [...sceneCases, ...transitionCases];
assert.equal(sceneCases.length, story.scenes.length, "temporal heading scope does not cover every current scene");
const visualTitle = (title) => {
  const [temporal = "", ...locationParts] = String(title || "").split("｜");
  const clockMatch = temporal.match(/(?:^|\s)([0-2]?\d:\d{2})(?=\s*(?:〜|～|–|—|-)|\s*$)/u);
  return `${clockMatch?.[1] || temporal}${locationParts.length ? `｜${locationParts.join("｜")}` : ""}`;
};

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const sharpEntry = path.join(nodeModules, "sharp", "lib", "index.js");
const sharp = fs.existsSync(sharpEntry) ? (await import(pathToFileURL(sharpEntry))).default : null;
const routeUrl = new URL("/story", baseUrl).href;
const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v2";
const viewports = [
  { name: "pc-2048", width: 2048, height: 1114 },
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "pc-1280", width: 1280, height: 800 },
  { name: "pc-1024", width: 1024, height: 768 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = {
  status: "running",
  scenes: sceneCases.length,
  transitions: transitionCases.length,
  cases: headingCases.length,
  viewports,
  scans: [],
  evidence: [],
  contactSheet: "",
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};
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
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "temporal-heading-browser",
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const ensureNovelOpen = async (page) => {
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15000 });
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer?.classList.contains("is-open")) globalThis.GaiaNovel.open();
  });
  await page.waitForFunction(() => {
    const layer = document.querySelector("#novel-layer");
    return Boolean(layer && !layer.hidden && layer.classList.contains("is-open"));
  }, null, { timeout: 15000 });
};

const bootAt = async (page, stepId) => {
  await page.evaluate(({ progressKey, configKey, progress }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { progressKey: STORAGE_KEY, configKey: CONFIG_KEY, progress: baseState(stepId) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  if (await page.locator("#novel-resume-button").isVisible()) await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15000 });
};

const renderHeadingCase = (page, item) => page.evaluate((current) => {
  const heading = document.querySelector("#novel-location");
  const label = document.querySelector("#novel-source-label");
  const [temporal = "", ...locationParts] = String(current.title || "").split("｜");
  const unit = (text, kind) => {
    const node = document.createElement("span");
    node.className = "novel-temporal-heading-unit";
    node.dataset.temporalHeadingUnit = kind;
    node.textContent = text;
    return node;
  };
  const clockMatch = temporal.match(/(?:^|\s)([0-2]?\d:\d{2})(?=\s*(?:〜|～|–|—|-)|\s*$)/u);
  const units = [unit(clockMatch?.[1] || temporal, "time")];
  if (locationParts.length) {
    const tail = document.createElement("span");
    tail.className = "novel-temporal-heading-tail";
    tail.append(unit("｜", "separator"), unit(locationParts.join("｜"), "location"));
    units.push(tail);
  }
  heading.setAttribute("aria-label", current.title);
  heading.replaceChildren(...units);
  label.hidden = false;
  label.classList.remove("is-signal-reveal");
  label.style.animation = "none";
}, item);

const headingLayout = (page) => page.locator("#novel-location").evaluate((heading) => {
  const button = heading.closest("#novel-source-label");
  const directUnits = [...heading.children];
  const groupedLines = [];
  directUnits.filter((unit) => unit.getClientRects().length > 0).forEach((unit) => {
    const rect = unit.getBoundingClientRect();
    const line = groupedLines.find((candidate) => Math.abs(candidate.top - rect.top) <= 2)
      || { top: rect.top, left: rect.left, right: rect.right, text: "" };
    line.left = Math.min(line.left, rect.left);
    line.right = Math.max(line.right, rect.right);
    line.text += unit.textContent;
    if (!groupedLines.includes(line)) groupedLines.push(line);
  });
  const lines = groupedLines.sort((a, b) => a.top - b.top).map((line) => ({
    ...line,
    centerDelta: ((line.left + line.right) / 2) - (innerWidth / 2),
    characterCount: Array.from(line.text.replace(/[｜〜・「」／\s]/gu, "")).length,
  }));
  const units = [...heading.querySelectorAll("[data-temporal-heading-unit]")].map((unit) => {
    const rect = unit.getBoundingClientRect();
    return { kind: unit.dataset.temporalHeadingUnit, text: unit.textContent, rectCount: unit.getClientRects().length, left: rect.left, right: rect.right, top: rect.top };
  });
  const tails = [...heading.querySelectorAll(".novel-temporal-heading-tail")].map((tail) => {
    const rect = tail.getBoundingClientRect();
    const children = [...tail.children].map((child) => child.getBoundingClientRect());
    return { text: tail.textContent, rectCount: tail.getClientRects().length, left: rect.left, right: rect.right, sameLine: children.every((child) => Math.abs(child.top - children[0].top) <= 1) };
  });
  const visibleDetail = [...document.querySelectorAll("#novel-runtime *")].filter((element) => {
    const ownText = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("").trim();
    const style = getComputedStyle(element);
    return /^DETAIL\s*[+＋]?$/iu.test(ownText) && style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  });
  const buttonRect = button.getBoundingClientRect();
  return {
    text: heading.textContent,
    ariaLabel: heading.getAttribute("aria-label"),
    units,
    tails,
    lines,
    lineCount: lines.length,
    maxCenterDelta: Math.max(0, ...lines.map((line) => Math.abs(line.centerDelta))),
    splitUnits: units.filter((unit) => unit.rectCount > 0 && unit.rectCount !== 1),
    detachedTails: tails.filter((tail) => tail.rectCount > 0 && (tail.rectCount !== 1 || !tail.sameLine)),
    clippedUnits: units.filter((unit) => unit.left < -1 || unit.right > innerWidth + 1),
    isolatedLines: lines.filter((line) => line.characterCount === 1),
    visibleDetailCount: visibleDetail.length,
    buttonCenterDelta: ((buttonRect.left + buttonRect.right) / 2) - (innerWidth / 2),
    bodyOverflow: document.documentElement.scrollWidth - innerWidth,
    layerOverflow: document.querySelector("#novel-layer").scrollWidth - document.querySelector("#novel-layer").clientWidth,
  };
});

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
const headingShots = [];
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    attachDiagnostics(page, viewport.name);
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
    await bootAt(page, sceneCases[0].stepId);
    await page.waitForFunction(
      (title) => document.querySelector("#novel-location")?.getAttribute("aria-label") === title,
      sceneCases[0].title,
      { timeout: 15000 },
    );
    const actual = await headingLayout(page);
    assert.equal(actual.text, visualTitle(sceneCases[0].title), `${viewport.name}: actual heading does not show the start time only`);
    assert.equal(actual.ariaLabel, sceneCases[0].title, `${viewport.name}: full temporal range is missing from the accessible label`);
    assert(actual.maxCenterDelta <= 1, `${viewport.name}: actual heading is off center ${JSON.stringify(actual)}`);
    assert.equal(actual.visibleDetailCount, 0, `${viewport.name}: DETAIL remains visible in the actual scene`);

    for (const item of headingCases) {
      await renderHeadingCase(page, item);
      const layout = await headingLayout(page);
      assert.equal(layout.text, visualTitle(item.title), `${viewport.name}/${item.id}: heading does not show the start time only`);
      assert.equal(layout.ariaLabel, item.title, `${viewport.name}/${item.id}: accessible heading text changed`);
      assert(layout.maxCenterDelta <= 1, `${viewport.name}/${item.id}: visual center delta ${layout.maxCenterDelta}px`);
      assert(Math.abs(layout.buttonCenterDelta) <= 1, `${viewport.name}/${item.id}: container center delta ${layout.buttonCenterDelta}px`);
      assert.equal(layout.visibleDetailCount, 0, `${viewport.name}/${item.id}: DETAIL remains visible`);
      assert.equal(layout.splitUnits.length, 0, `${viewport.name}/${item.id}: a meaning unit split ${JSON.stringify(layout.splitUnits)}`);
      assert.equal(layout.detachedTails.length, 0, `${viewport.name}/${item.id}: location separator detached ${JSON.stringify(layout.detachedTails)}`);
      assert.equal(layout.clippedUnits.length, 0, `${viewport.name}/${item.id}: heading unit clipped ${JSON.stringify(layout.clippedUnits)}`);
      assert.equal(layout.isolatedLines.length, 0, `${viewport.name}/${item.id}: isolated one-character line ${JSON.stringify(layout.lines)}`);
      assert(layout.bodyOverflow <= 1, `${viewport.name}/${item.id}: page horizontal overflow ${layout.bodyOverflow}`);
      report.scans.push({ viewport: viewport.name, ...item, layout, passed: true });
    }

    await renderHeadingCase(page, sceneCases[0]);
    const pageShot = path.join(outputDir, `${viewport.name}-current-exhibition.png`);
    const headingShot = path.join(outputDir, `${viewport.name}-heading.png`);
    await page.screenshot({ path: pageShot, animations: "disabled", timeout: 90000 });
    await page.locator("#novel-source-label").screenshot({ path: headingShot, animations: "disabled", timeout: 90000 });
    headingShots.push(headingShot);
    report.evidence.push({ viewport: viewport.name, kind: "current", path: pageShot, layout: await headingLayout(page) });
    if (viewport.width === 390) {
      const longest = headingCases.reduce((current, item) => Array.from(item.title).length > Array.from(current.title).length ? item : current);
      await renderHeadingCase(page, longest);
      const longestShot = path.join(outputDir, "mobile-390-longest-heading.png");
      await page.screenshot({ path: longestShot, animations: "disabled", timeout: 90000 });
      report.evidence.push({ viewport: viewport.name, kind: "longest", id: longest.id, title: longest.title, path: longestShot, layout: await headingLayout(page) });
    }
    await page.close();
  }

  if (sharp) {
    const imageInfo = await Promise.all(headingShots.map((file) => sharp(file).metadata()));
    const height = Math.max(...imageInfo.map((image) => image.height));
    const gap = 12;
    const width = imageInfo.reduce((sum, image) => sum + image.width, 0) + gap * (imageInfo.length - 1);
    let left = 0;
    const composites = headingShots.map((file, index) => {
      const item = { input: file, left, top: Math.floor((height - imageInfo[index].height) / 2) };
      left += imageInfo[index].width + gap;
      return item;
    });
    report.contactSheet = path.join(outputDir, "five-widths-side-by-side.png");
    await sharp({ create: { width, height, channels: 4, background: "#071328" } }).composite(composites).png().toFile(report.contactSheet);
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
  console.log(`temporal heading browser check passed: ${headingCases.length} headings × ${viewports.length} widths (${report.scans.length} scans), center/DETAIL/wrap/overflow`);
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

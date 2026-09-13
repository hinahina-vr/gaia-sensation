import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4288";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?temporal-browser=1`);
const story = globalThis.GAIA_NOVEL_STORY;
const routeUrl = new URL("/story", baseUrl).href;
const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v2";
const assert = (condition, message) => { if (!condition) throw new Error(message); };

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
  audio: { muted: false, volume: 0.1 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "temporal-browser-check",
});

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
const errors = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${viewport.width}: ${message.text()}`); });
    page.on("pageerror", (error) => errors.push(`${viewport.width}: ${error.message}`));

    const bootAt = async (stepId) => {
      await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
      await page.evaluate(({ storageKey, configKey, value }) => {
        localStorage.setItem(storageKey, JSON.stringify(value));
        localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
      }, { storageKey: STORAGE_KEY, configKey: CONFIG_KEY, value: baseState(stepId) });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
      await page.evaluate(() => globalThis.GaiaNovel.open());
      await page.locator("#novel-resume-button").click();
      await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
    };

    const assertHeading = async (stepId, expected) => {
      await bootAt(stepId);
      const actual = await page.locator("#novel-location").textContent();
      const attrs = await page.locator("#novel-layer").evaluate((element) => ({
        context: element.dataset.temporalContext,
        precision: element.dataset.timePrecision,
        period: element.dataset.temporalPeriod,
      }));
      const geometry = await page.locator("#novel-location").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: element.scrollWidth };
      });
      assert(actual === expected.title, `${viewport.width}/${stepId}: heading mismatch: ${actual}`);
      assert(attrs.context === expected.context, `${viewport.width}/${stepId}: context mismatch`);
      assert(attrs.precision === expected.precision, `${viewport.width}/${stepId}: precision mismatch`);
      assert(attrs.period === String(expected.period), `${viewport.width}/${stepId}: period mismatch`);
      assert(geometry.left >= -1 && geometry.right <= viewport.width + 1, `${viewport.width}/${stepId}: heading exceeds the viewport`);
      assert(geometry.scrollWidth <= geometry.width + 1, `${viewport.width}/${stepId}: heading is horizontally clipped`);
    };

    await assertHeading("current_exhibition_001", {
      title: "11月1日（日） 13:30｜学園祭・展示ホール", context: "CURRENT", precision: "MINUTE", period: false,
    });
    await assertHeading("prologue_basil_001", {
      title: "5月3日（土）〜5月4日（日）｜学内サークル「惑星の放課後」・チャット", context: "RECORD", precision: "MINUTE", period: true,
    });
    await assertHeading("production_year_248", {
      title: "2026年7月25日（土） 10:02〜18:32｜七月の終わり・予約と制作チャット", context: "RECORD", precision: "MINUTE", period: true,
    });
    await assertHeading("search_060", {
      title: "8月6日（木） 朝｜六日目", context: "RECORD", precision: "PART_OF_DAY", period: false,
    });

    await bootAt("current_exhibition_017");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (await page.locator("#novel-layer").getAttribute("data-step-type") === "section-separator") break;
      await page.locator("#novel-dialogue").dispatchEvent("click");
      await page.waitForTimeout(80);
    }
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "section-separator");
    await page.locator("#novel-layer").dispatchEvent("click");
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "temporal-transition");
    const transitionBackground = await page.locator("#novel-layer").evaluate((element) => ({
      stage: element.dataset.openingTransitionStage,
      image: getComputedStyle(element).backgroundImage,
    }));
    assert(transitionBackground.stage === "awaiting-record" && transitionBackground.image.includes("novel-bg-exhibition-v3.png"), `${viewport.width}: workroom appeared before the RECORD date card: ${JSON.stringify(transitionBackground)}`);
    const card = await page.locator("#novel-chapter-card").evaluate((element) => ({
      hidden: element.hidden,
      from: element.dataset.transitionFrom,
      to: element.dataset.transitionTo,
      title: element.querySelector("strong")?.textContent,
    }));
    assert(!card.hidden && card.from === "CURRENT" && card.to === "RECORD", `${viewport.width}: context transition card missing`);
    assert(card.title === "8月1日（土） 10:21｜海に近い町・共同作業室", `${viewport.width}: context transition title mismatch`);
    await page.locator("#novel-layer").dispatchEvent("click");
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "narration");
    await page.waitForFunction(() => !document.body.classList.contains("scene-transitioning"));
    const settledRecord = await page.locator("#novel-layer").evaluate((element) => ({
      stage: element.dataset.openingTransitionStage || "",
      cue: element.dataset.openingCue,
      presentation: element.dataset.openingPresentation,
      image: getComputedStyle(element).backgroundImage,
    }));
    assert(settledRecord.stage === "" && settledRecord.cue === "objective-record" && settledRecord.presentation === "objective-record" && settledRecord.image.includes("novel-bg-workroom-v2.png"), `${viewport.width}: objective RECORD did not settle after the date card: ${JSON.stringify(settledRecord)}`);
    assert(await page.locator("#novel-location").textContent() === "8月1日（土） 10:21｜海に近い町・共同作業室", `${viewport.width}: heading did not settle after transition card`);
    await page.close();
  }
  assert(errors.length === 0, `browser errors: ${errors.join(" | ")}`);
  console.log("novel temporal browser check passed: 1440/390 headings, periods, precision and CURRENT→RECORD card");
} finally {
  await browser.close();
}

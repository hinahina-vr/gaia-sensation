import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4181"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/chat-current-marker-browser");
fs.mkdirSync(outputDir, { recursive: true });

const stepId = "welcome_chat_006";
const expectedWelcomeCopy = "ESP32に詳しい。参加者が測った温度や湿度をGAIA SENSEWAREに表示する案を出してくれたよ。";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const stateFor = (storyVersion) => ({
  storyVersion,
  stepId,
  reachedSceneIds: ["welcome_chat"],
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
  sessionId: "chat-current-marker-browser",
});

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
    const progress = stateFor(storyVersion);
    await page.evaluate((candidate) => {
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
      localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
        progress: candidate,
        savedAt: Date.now(),
        meta: { title: "Chat marker QA", excerpt: candidate.stepId },
      }]));
      localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
    }, progress);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => globalThis.GaiaNovel.open());
    await page.locator("#novel-resume-button").click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible" });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    const current = page.locator('.novel-slack-post.is-new[data-speaker="mizuha"]');
    await current.waitFor({ state: "visible" });

    const scan = await current.evaluate((post) => {
      const style = getComputedStyle(post);
      const connector = getComputedStyle(post, "::before");
      const avatar = post.querySelector(".novel-slack-avatar");
      const avatarImage = avatar?.querySelector("img");
      const postRect = post.getBoundingClientRect();
      const avatarRect = avatar?.getBoundingClientRect();
      return {
        boxShadow: style.boxShadow,
        connectorContent: connector.content,
        connectorBorderLeftWidth: connector.borderLeftWidth,
        connectorBorderBottomWidth: connector.borderBottomWidth,
        avatarSource: avatarImage?.getAttribute("src") || "",
        avatarVisible: Boolean(avatarRect && avatarRect.width > 0 && avatarRect.height > 0),
        postVisible: postRect.width > 0 && postRect.height > 0,
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    assert.equal(scan.boxShadow, "none", `${viewport.name}: blue current-message bar remains`);
    assert.notEqual(scan.connectorContent, "none", `${viewport.name}: reply connector disappeared`);
    assert.equal(scan.connectorBorderLeftWidth, "1px", `${viewport.name}: reply connector left edge changed`);
    assert.equal(scan.connectorBorderBottomWidth, "1px", `${viewport.name}: reply connector bottom edge changed`);
    assert.match(scan.avatarSource, /slack-avatar-mizuha-v2\.webp$/u, `${viewport.name}: mizuha avatar changed`);
    assert.equal(scan.avatarVisible, true, `${viewport.name}: mizuha avatar disappeared`);
    assert.equal(scan.postVisible, true, `${viewport.name}: current message disappeared`);
    assert.equal(scan.overflowX, 0, `${viewport.name}: horizontal overflow`);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "welcome_chat_007");
    const introduction = page.locator('.novel-slack-post.is-new[data-speaker="amane"]');
    await introduction.waitFor({ state: "visible" });
    const introductionScan = await introduction.evaluate((post) => {
      const rect = post.getBoundingClientRect();
      return {
        stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
        text: post.querySelector(".novel-slack-message")?.textContent || "",
        postVisible: rect.width > 0 && rect.height > 0,
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    assert.equal(introductionScan.stepId, "welcome_chat_007", `${viewport.name}: welcome_chat_007 did not render`);
    assert.equal(introductionScan.text, expectedWelcomeCopy, `${viewport.name}: welcome_chat_007 copy differs`);
    assert.equal(introductionScan.postVisible, true, `${viewport.name}: welcome_chat_007 post is hidden`);
    assert.equal(introductionScan.overflowX, 0, `${viewport.name}: welcome_chat_007 horizontal overflow`);
    report.scans.push({ viewport: viewport.name, marker: scan, introduction: introductionScan, passed: true });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`), animations: "disabled" });
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

console.log(`Chat current marker browser check passed: ${report.scans.length} viewports`);

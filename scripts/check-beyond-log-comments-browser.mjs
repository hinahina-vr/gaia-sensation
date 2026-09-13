import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import "../novel-story-data.js";
import "../true-end-data.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/beyond-log-comments-browser");
const widths = (process.argv[4] || "1440,390").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const beyond = globalThis.GAIA_TRUE_END_STORY.scenes.flatMap(scene => scene.steps);
const speakerNames = { system: "AIVA", lou: "ルウ", mizuha: "みず", amane: "あめ", sakuya: "saku", visitor: "あなた" };
const captures = new Set(["beyond_01_028", "beyond_01_add_032", "beyond_02_024", "beyond_02_040", "beyond_02_042", "beyond_03_043", "beyond_03_053", beyond.at(-1).id]);
const revision = JSON.parse(fs.readFileSync(new URL("../story/LOG_REVISION_2026-09-09.json", import.meta.url), "utf8"));
for (const edit of revision.edits) captures.add(edit.runtimeId);
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: "reduce" });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.addInitScript(storyVersion => {
      globalThis.GAIA_BUILD_PROFILE = "debug";
      const progress = { storyVersion, stepId: "welcome_chat_094", reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null, metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false, sessionId: "beyond-log-revision-qa" };
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
      localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    }, globalThis.GAIA_NOVEL_STORY.storyVersion);
    await page.goto(`${base}/?preview=beyond-log-comments#story`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "welcome_chat_094" && document.querySelector("#novel-text")?.dataset.revealState === "complete");
    await page.locator("#novel-jump-button").click();
    await page.locator('.novel-jump-item[data-scene-id="true-end"]').click();
    const played = [];
    for (const expected of beyond) {
      await page.waitForFunction(id => document.querySelector(".true-end-shell")?.dataset.step === id && !document.querySelector(".true-end-shell")?.classList.contains("is-revealing"), expected.id);
      const pages = [];
      for (let index = 0; index < (expected.pages?.length || 1); index++) {
        await page.waitForFunction(({ id, index }) => {
          const shell = document.querySelector(".true-end-shell");
          return shell?.dataset.step === id && shell.dataset.messagePage?.startsWith(`${index + 1}/`) && !shell.classList.contains("is-revealing");
        }, { id: expected.id, index });
        const scan = await page.locator(".true-end-message").evaluate(node => ({ text: node.textContent, excessX: node.scrollWidth - node.clientWidth, excessY: node.scrollHeight - node.clientHeight, box: node.getBoundingClientRect().toJSON(), width: innerWidth, height: innerHeight, speaker: document.querySelector(".true-end-speaker")?.textContent, overflow: document.documentElement.scrollWidth - innerWidth }));
        assert(scan.excessX <= 1 && scan.excessY <= 1, `${width}/${expected.id}: text clipped`);
        assert(scan.overflow <= 1 && scan.box.left >= 0 && scan.box.right <= scan.width + 1 && scan.box.bottom <= scan.height + 1, `${width}/${expected.id}: outside viewport`);
        assert.equal(scan.speaker, expected.speakerLabel || speakerNames[expected.speaker] || "", `${expected.id}: wrong displayed speaker`);
        pages.push(scan.text);
        if (captures.has(expected.id)) await page.screenshot({ path: path.join(output, `${width}-${expected.id}-${index + 1}.png`) });
        await page.locator(".true-end-dialogue").click();
      }
      assert.equal(pages.join(""), expected.text, `${expected.id}: pages lost text`);
      played.push({ id: expected.id, pages: pages.length });
      if (played.length % 40 === 0) console.log(`${width}px: ${played.length}/${beyond.length} messages verified`);
    }
    await page.locator(".true-end-finale").waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(output, `${width}-finale.png`) });
    report.checks.push({ width, played, finale: true });
    await context.close();
    console.log(`PASS ${width}px: all ${played.length} messages, speakers, pagination and finale`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

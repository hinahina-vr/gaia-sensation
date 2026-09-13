import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import "../novel-story-data.js";
import "../true-end-data.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/story-log-comments-browser");
const widths = (process.argv[4] || "1440,390").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const story = globalThis.GAIA_NOVEL_STORY;
const main = story.scenes.flatMap(scene => scene.steps);
const mainMap = new Map(main.map(step => [step.id, step]));
const beyond = globalThis.GAIA_TRUE_END_STORY.scenes.flatMap(scene => scene.steps);
const manifest = JSON.parse(fs.readFileSync(new URL("../story/LOG_REVISION_2026-09-06.json", import.meta.url), "utf8"));
const revisedMain = [...new Set(manifest.comments.flatMap(row => row.outputIds).filter(id => mainMap.has(id)))];
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const boot = async (context, stepId, expectedId = stepId) => {
  if (page && !page.isClosed()) await page.close();
  page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.addInitScript(({ stepId, storyVersion }) => {
    globalThis.GAIA_BUILD_PROFILE = "debug";
    const progress = { storyVersion, stepId, reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null, metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false, sessionId: "log-revision-qa" };
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{ progress, savedAt: Date.now(), meta: { title: "LOG revision QA", excerpt: stepId } }]));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
  }, { stepId, storyVersion: story.storyVersion });
  await page.goto(`${base}/?preview=story-log-comments#story`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.GaiaNovel);
  await page.waitForFunction(id => document.querySelector("#novel-layer")?.dataset.stepId === id, expectedId);
  await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
};
const nextMain = async (expectedId) => {
  for (let attempt = 0; attempt < 15; attempt++) {
    if (await page.evaluate(id => document.querySelector("#novel-layer")?.dataset.stepId === id, expectedId)) return;
    await page.locator("#novel-layer").evaluate(node => node.click());
    await page.waitForTimeout(70);
  }
  throw new Error(`Did not advance to ${expectedId}`);
};
const readMain = async id => {
  const step = mainMap.get(id);
  await page.waitForFunction(id => document.querySelector("#novel-layer")?.dataset.stepId === id, id);
  if (step.type === "chat") {
    await page.waitForFunction(text => [...document.querySelectorAll(".novel-slack-post")].some(node => node.textContent.includes(text)), step.text);
    return { id, text: step.text, type: step.type };
  }
  await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
  const pages = [];
  for (let attempt = 0; attempt < 15; attempt++) {
    const scan = await page.evaluate(() => {
      const text = document.querySelector("#novel-text");
      return { page: Number(text.dataset.pageIndex), count: Number(text.dataset.pageCount), text: text.getAttribute("aria-label") || text.textContent, speaker: document.querySelector("#novel-speaker")?.textContent, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    assert(scan.overflow <= 1, `${id}: horizontal overflow`);
    pages.push(scan);
    if (scan.page >= scan.count) break;
    await page.locator("#novel-layer").evaluate(node => node.click());
    await page.waitForFunction(oldPage => Number(document.querySelector("#novel-text")?.dataset.pageIndex) !== oldPage && document.querySelector("#novel-text")?.dataset.revealState === "complete", scan.page);
  }
  assert.equal(pages.map(scan=>scan.text).join(""), step.text, `${id}: rendered pages lost text`);
  return { id, type: step.type, pages };
};
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: "reduce" });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await boot(context, "festival_concept_019");
    const intro = await readMain("festival_concept_019");
    assert(!intro.pages[0].speaker.includes("あなた"), "Guide line is still assigned to the player");
    const layout = await page.evaluate(ids => ids.map(id => {
      const step = GAIA_NOVEL_STORY.scenes.flatMap(scene=>scene.steps).find(step=>step.id === id);
      if (!["narration", "dialogue"].includes(step.type)) return { id, skipped: step.type };
      return { id, ...GaiaNovel.inspectDialoguePagination(step.text) };
    }), revisedMain);
    for (const sample of layout.filter(sample=>!sample.skipped)) {
      assert.equal(sample.pages.map(p=>p.text).join(""), sample.source, `${width}/${sample.id}: layout dropped text`);
      assert(sample.pages.every(p=>p.fits && p.horizontalOverflow <= 1), `${width}/${sample.id}: text does not fit`);
    }
    await page.screenshot({ path: path.join(output, `${width}-guide.png`) });
    console.log(`${width}px: guide and ${layout.length} revised layouts passed`);
    const played = [];
    for (const sequence of [
      ["esp32_pitch_016i", "esp32_pitch_new_010", "esp32_pitch_new_011"],
      ["circle_invitation_new_030", "circle_invitation_081"],
      ["welcome_chat_new_022", "welcome_chat_new_024", "welcome_chat_094", "welcome_chat_new_025", "welcome_chat_new_026", "welcome_chat_new_027"],
    ]) {
      await boot(context, sequence[0]);
      for (const id of sequence) {
        await nextMain(id);
        played.push(await readMain(id));
        if (id === "welcome_chat_new_024") {
          assert.equal(await page.locator(".novel-slack-workspace").getAttribute("data-active-channel"), "惑星の放課後_センサー");
          await page.screenshot({ path: path.join(output, `${width}-first-sensor-message.png`) });
        }
      }
      console.log(`${width}px: played ${sequence.join(" -> ")}`);
    }
    await page.screenshot({ path: path.join(output, `${width}-last-narration.png`) });
    await nextMain("welcome_chat_095");
    await page.locator(".novel-staff-roll").waitFor({ state: "visible" });
    await boot(context, "welcome_chat_092", "welcome_chat_094");

    await page.locator("#novel-jump-button").click();
    await page.locator('.novel-jump-item[data-scene-id="true-end"]').click();
    const playedBeyond = [];
    for (const expected of beyond) {
      await page.waitForFunction(id => document.querySelector(".true-end-shell")?.dataset.step === id && !document.querySelector(".true-end-shell")?.classList.contains("is-revealing"), expected.id);
      const texts = [];
      const pageCount = expected.pages?.length || 1;
      for (let index = 0; index < pageCount; index++) {
        await page.waitForFunction(({id,index}) => {
          const shell = document.querySelector(".true-end-shell");
          return shell?.dataset.step === id && shell.dataset.messagePage?.startsWith(`${index+1}/`) && !shell.classList.contains("is-revealing");
        }, { id: expected.id, index });
        const scan = await page.locator(".true-end-message").evaluate(node => ({ text: node.textContent, excessX: node.scrollWidth - node.clientWidth, excessY: node.scrollHeight - node.clientHeight, box: node.getBoundingClientRect().toJSON(), width: innerWidth, height: innerHeight }));
        assert(scan.excessX <= 1 && scan.excessY <= 1, `${width}/${expected.id}: beyond text clipped`);
        assert(scan.box.left >= 0 && scan.box.right <= scan.width+1 && scan.box.bottom <= scan.height+1, `${expected.id}: beyond text outside viewport`);
        texts.push(scan.text);
        if (expected.id === "beyond_01_008" && index === 0) await page.screenshot({ path: path.join(output, `${width}-future-universe.png`) });
        await page.locator(".true-end-dialogue").click();
      }
      assert.equal(texts.join(""), expected.text, `${expected.id}: beyond pages lost text`);
      playedBeyond.push(expected.id);
    }
    await page.locator(".true-end-finale").waitFor({ state: "visible" });
    report.checks.push({ width, revisedLayouts: layout.length, played, beyond: playedBeyond, staffRoll: true, oldSaveMigration: true });
    await context.close();
    console.log(`PASS ${width}px: ${layout.length} revised layouts, ${played.length} narrative/chat steps, ${beyond.length} beyond messages, staff roll and save migration`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch(error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output,"failure.png")});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,"report.json"), JSON.stringify(report,null,2));
  await browser.close();
}

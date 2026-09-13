import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";
const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/hardening/story-storage");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
    await enforceBrowserSecurity(context, base);
    await context.addInitScript(() => {
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/story`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "narration" && document.querySelector("#novel-text")?.dataset.revealState === "complete");
    const first = await page.locator("#novel-layer").getAttribute("data-step-id");
    assert.equal(first, "festival_concept_001");
    const story = await page.evaluate(() => ({ firstText: GAIA_NOVEL_STORY.scenes[0].steps[0].text, ids: GAIA_NOVEL_STORY.scenes.flatMap(scene => scene.steps.map(step => step.id)) }));
    await page.locator("#novel-save-button").click();
    await page.locator("#novel-save-slots .novel-save-primary").first().click();
    await page.locator("#novel-save-close").click();
    for (let index = 0; index < 10 && await page.locator("#novel-layer").getAttribute("data-step-id") === first; index++) {
      await page.locator("#novel-dialogue").click(); await page.waitForTimeout(180);
    }
    assert.notEqual(await page.locator("#novel-layer").getAttribute("data-step-id"), first, "story did not advance before LOAD");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaNovel && !document.querySelector("#novel-runtime")?.hidden && document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
    await page.locator("#novel-load-button").click();
    await page.locator("#novel-save-slots .novel-save-primary").first().click();
    await page.waitForFunction(id => document.querySelector("#novel-layer")?.dataset.stepId === id, first);
    await page.locator("#novel-log-button").click();
    const downloaded = page.waitForEvent("download");
    await page.locator("#novel-log-script-export").click();
    const download = await downloaded;
    const exported = path.join(output, `${width}-${download.suggestedFilename()}`);
    await download.saveAs(exported);
    assert.equal(await download.failure(), null);
    const content = fs.readFileSync(exported, "utf8");
    assert(content.includes(story.firstText), "download changed the current first paragraph");
    assert(story.ids.every(id => content.includes(`\`${id}\``)), "download omitted a current story step");
    assert(content.length > 10000, "full script download is unexpectedly empty");
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await page.screenshot({ path: path.join(output, `${width}-restored-log.png`) });
    report.checks.push({ width, savedStep: first, loadAfterReload: true, actualDownloadedCharacters: content.length, exported, cspViolations: 0 });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) { report.status = "failed"; report.error = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report, null, 2));

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4314"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument || "artifacts/public-overlay-hotfix");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900, columns: 2 },
  { name: "mobile-390", width: 390, height: 844, columns: 1 },
];
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
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
    await page.evaluate(() => {
      const story = globalThis.GAIA_NOVEL_STORY;
      const stepId = story.scenes[0].steps.find((step) => ["dialogue", "narration"].includes(step.type))?.id || story.scenes[0].steps[0].id;
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({
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
        sessionId: "public-overlay-hotfix",
      }));
      localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => globalThis.GaiaNovel.open());
    await page.locator("#novel-resume-button").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId);

    const nav = await page.evaluate(() => {
      const entries = [...document.querySelectorAll(".novel-topbar nav > button")].map((button) => {
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return { id: button.id, hidden: button.hidden, display: style.display, visibility: style.visibility, width: rect.width, height: rect.height, pointerEvents: style.pointerEvents };
      });
      return { entries, visible: entries.filter((entry) => entry.id !== "novel-close-button" && !entry.hidden && entry.display !== "none" && entry.visibility !== "hidden" && entry.width > 0 && entry.height > 0).map((entry) => entry.id) };
    });
    assert.deepEqual(nav.visible, ["novel-eves-button", "novel-log-button", "novel-save-button", "novel-load-button", "novel-config-button", "novel-auto-button", "novel-fast-forward-button", "novel-jump-button"]);
    const restart = nav.entries.find((entry) => entry.id === "novel-restart-button");
    assert(restart && restart.hidden && restart.display === "none" && restart.width === 0 && restart.height === 0 && restart.pointerEvents === "none");

    await page.locator("#novel-save-button").click();
    const save = await page.evaluate((expectedColumns) => {
      const shell = document.querySelector(".novel-save-shell");
      const header = document.querySelector(".novel-save-header");
      const toolbar = document.querySelector(".novel-save-toolbar");
      const slots = document.querySelector(".novel-save-slots");
      const footer = document.querySelector(".novel-save-footer");
      const rect = (node) => { const value = node.getBoundingClientRect(); return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height }; };
      const contains = (outer, inner) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
      const shellRect = rect(shell);
      const cards = [...document.querySelectorAll(".novel-save-slot")].map((card) => {
        const cardRect = rect(card);
        const title = rect(card.querySelector("h3"));
        const excerpt = rect(card.querySelector(":scope > p"));
        const actions = rect(card.querySelector("footer"));
        return { card: cardRect, title, excerpt, actions, contained: [title, excerpt, actions].every((child) => contains(cardRect, child)), overlap: title.bottom > excerpt.top + 1 || excerpt.bottom > actions.top + 1 };
      });
      const columns = getComputedStyle(slots).gridTemplateColumns.split(" ").filter(Boolean).length;
      const before = { header: rect(header), toolbar: rect(toolbar), footer: rect(footer) };
      slots.scrollTop = slots.scrollHeight;
      const after = { header: rect(header), toolbar: rect(toolbar), footer: rect(footer) };
      return {
        shell: shellRect,
        columns,
        expectedColumns,
        cardCount: cards.length,
        cards,
        slots: { ...rect(slots), clientHeight: slots.clientHeight, scrollHeight: slots.scrollHeight, overflowY: getComputedStyle(slots).overflowY },
        fixedChrome: JSON.stringify(before) === JSON.stringify(after),
        chromeOrdered: before.header.bottom <= before.toolbar.top + 1 && before.toolbar.bottom <= rect(slots).top + 1 && rect(slots).bottom <= before.footer.top + 1,
        shellContained: shellRect.left >= -1 && shellRect.top >= -1 && shellRect.right <= innerWidth + 1 && shellRect.bottom <= innerHeight + 1,
        bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    }, viewport.columns);
    assert.equal(save.columns, viewport.columns);
    assert.equal(save.cardCount, 6);
    assert(save.cards.every((card) => card.contained && !card.overlap));
    assert(save.fixedChrome && save.chromeOrdered && save.shellContained && !save.bodyOverflow && save.slots.overflowY === "auto");

    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-save.png`), animations: "disabled" });
    await page.locator("#novel-load-tab").click();
    assert.equal(await page.locator("#novel-load-tab").getAttribute("aria-selected"), "true");
    await page.locator("#novel-save-close").click();
    assert.equal(await page.locator("#novel-save-panel").isHidden(), true);
    report.scans.push({ viewport, nav, save, passed: true });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0);
  assert.equal(report.pageErrors.length, 0);
  assert.equal(report.responses404.length, 0);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log("public overlay hotfix browser check passed");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4517"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/chat-reaction-sequence-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const finalReactions = ["🎉 3", "🌍 2", "🫶 2"];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const progressFor = (stepId, label, readStepIds = []) => ({
  storyVersion: 13,
  stepId,
  reachedSceneIds: ["festival_concept", "map_mode01", "gx_experience", "esp32_pitch", "circle_invitation", "welcome_chat"],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds,
  clear: false,
  archivesUnlocked: false,
  sessionId: `chat-reactions-${label}`,
});

const installProgress = async (page, progress) => {
  await page.addInitScript((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "Reaction sequence QA", excerpt: candidate.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, progress);
};

const installReactionObserver = (page) => page.addInitScript(() => {
  const install = () => {
    if (!document.documentElement) {
      document.addEventListener("DOMContentLoaded", install, { once: true });
      return;
    }
    globalThis.__reactionTimeline = [];
    globalThis.__reactionMessageAppearedAt = null;
    let previous = "";
    const sample = () => {
      if (document.querySelector("#novel-layer")?.dataset.stepId !== "welcome_chat_011") return;
      const post = document.querySelector(".novel-slack-post.is-new");
      if (!post) return;
      const now = performance.now();
      if (globalThis.__reactionMessageAppearedAt === null) globalThis.__reactionMessageAppearedAt = now;
      const snapshot = {
        at: now,
        afterMessageMs: now - globalThis.__reactionMessageAppearedAt,
        state: post.dataset.reactions || "",
        stage: post.querySelector(".novel-slack-reactions")?.dataset.reactionStage || "",
        message: post.querySelector(".novel-slack-message")?.textContent || "",
        reactions: [...post.querySelectorAll(".novel-slack-reaction")].map((node) => node.textContent?.trim() || ""),
      };
      const signature = JSON.stringify({ state: snapshot.state, stage: snapshot.stage, message: snapshot.message, reactions: snapshot.reactions });
      if (signature !== previous) {
        previous = signature;
        globalThis.__reactionTimeline.push(snapshot);
      }
    };
    new MutationObserver(sample).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    queueMicrotask(sample);
  };
  install();
});

const bootAt = async (page, stepId, label, { readStepIds = [], observe = false, waitForSlackReady = true } = {}) => {
  await installProgress(page, progressFor(stepId, label, readStepIds));
  if (observe) await installReactionObserver(page);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const resumedDirectly = await page.waitForFunction(
    (expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected,
    stepId,
    { timeout: 12_000 },
  ).then(() => true, () => false);
  if (!resumedDirectly) {
    const resume = page.locator("#novel-resume-button");
    if (await resume.isVisible()) {
      await resume.click();
      await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
      await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    }
  }
  await page.waitForFunction((expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected, stepId, { timeout: 20_000 });
  if (waitForSlackReady) {
    await page.waitForFunction(() => {
      const layer = document.querySelector("#novel-layer");
      const surface = document.querySelector("#novel-slack-surface");
      return Boolean(
        layer?.classList.contains("is-open")
        && layer.classList.contains("is-slack")
        && !layer.classList.contains("is-slack-entering")
        && !layer.classList.contains("is-background-transitioning")
        && surface
        && !surface.hidden
      );
    }, null, { timeout: 15_000 });
  }
  await page.locator(".novel-slack-workspace").waitFor({ state: "attached", timeout: 15_000 });
};

const addPageDiagnostics = (page, label) => {
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const readReactionState = (page) => page.evaluate(() => {
  const post = document.querySelector(".novel-slack-post.is-new");
  return {
    stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
    message: post?.querySelector(".novel-slack-message")?.textContent || "",
    state: post?.dataset.reactions || "",
    stage: post?.querySelector(".novel-slack-reactions")?.dataset.reactionStage || "",
    reactions: [...(post?.querySelectorAll(".novel-slack-reaction") || [])].map((node) => node.textContent?.trim() || ""),
  };
});

const validateTimeline = (timeline, viewportName) => {
  assert(timeline.length >= 6, `${viewportName}: too few reaction states: ${JSON.stringify(timeline)}`);
  assert.deepEqual(timeline[0].reactions, [], `${viewportName}: reactions appeared with the message`);
  const firstVisible = timeline.find((entry) => entry.reactions.length > 0);
  assert(firstVisible, `${viewportName}: first reaction never appeared`);
  assert(firstVisible.afterMessageMs >= 500, `${viewportName}: first reaction appeared too soon (${firstVisible.afterMessageMs}ms)`);
  assert.deepEqual(firstVisible.reactions, ["🎉 1"]);
  assert(timeline.some((entry) => entry.reactions.length === 2), `${viewportName}: second reaction type was not staged`);
  assert(timeline.some((entry) => entry.reactions.length === 3), `${viewportName}: third reaction type was not staged`);
  assert.deepEqual(timeline.at(-1).reactions, finalReactions, `${viewportName}: final reaction values changed`);
  const previousCounts = new Map();
  for (const entry of timeline) {
    for (const text of entry.reactions) {
      const match = text.match(/^(\S+)\s+(\d+)$/u);
      assert(match, `${viewportName}: malformed reaction state ${text}`);
      const count = Number(match[2]);
      assert(count >= (previousCounts.get(match[1]) || 0), `${viewportName}: ${match[1]} count decreased`);
      previousCounts.set(match[1], count);
    }
  }
};

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    addPageDiagnostics(page, `${viewport.name}-first-view`);
    await bootAt(page, "welcome_chat_011", `${viewport.name}-first-view`, { observe: true });
    await page.waitForFunction(() => document.querySelector(".novel-slack-post.is-new")?.dataset.reactions === "staging");
    const initial = await readReactionState(page);
    assert.deepEqual(initial.reactions, []);
    assert.doesNotMatch(initial.message, /🎉|🌍|🫶/u);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-01-message-before-reactions.png`) });

    await page.waitForFunction(() => document.querySelectorAll('.novel-slack-post.is-new .novel-slack-reaction').length === 1);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-01b-first-reaction.png`) });

    await page.waitForFunction(() => document.querySelector(".novel-slack-post.is-new")?.dataset.reactions === "complete", null, { timeout: 8_000 });
    const completed = await readReactionState(page);
    assert.deepEqual(completed.reactions, finalReactions);
    const timeline = await page.evaluate(() => globalThis.__reactionTimeline);
    validateTimeline(timeline, viewport.name);
    const first = timeline.find((entry) => entry.reactions.length > 0);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-02-final-reactions.png`), animations: "disabled" });
    report.scans.push({ case: "first-view-stages", viewport: viewport.name, initial, first, completed, timeline, passed: true });
    await context.close();
  }

  {
    const viewport = viewports[0];
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    addPageDiagnostics(page, "pc-save-restore");
    await bootAt(page, "welcome_chat_011", "pc-save-restore", { readStepIds: ["welcome_chat_011"] });
    await page.waitForFunction(() => document.querySelector(".novel-slack-post.is-new")?.dataset.reactions === "complete");
    const restoredInitial = await readReactionState(page);
    assert.deepEqual(restoredInitial.reactions, finalReactions);
    await page.waitForTimeout(1_200);
    assert.deepEqual(await readReactionState(page), restoredInitial, "read message replayed its reaction sequence");
    await page.locator("#novel-load-button").click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible" });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    await page.waitForFunction(() => document.querySelector(".novel-slack-post.is-new")?.dataset.reactions === "complete");
    const loaded = await readReactionState(page);
    assert.deepEqual(loaded.reactions, finalReactions);
    await page.waitForTimeout(1_200);
    assert.deepEqual(await readReactionState(page), loaded, "loaded save replayed its reaction sequence");
    report.scans.push({ case: "read-and-save-restore", viewport: viewport.name, restoredInitial, loaded, passed: true });
    await context.close();
  }

  {
    const viewport = viewports[0];
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    addPageDiagnostics(page, "pc-fast-forward");
    await bootAt(page, "welcome_chat_new_004", "pc-fast-forward", { readStepIds: ["welcome_chat_010"] });
    await page.evaluate(() => {
      globalThis.__fastForwardReactionArrival = null;
      const sample = () => {
        if (document.querySelector("#novel-layer")?.dataset.stepId !== "welcome_chat_011") return;
        const post = document.querySelector(".novel-slack-post.is-new");
        if (!post) return;
        globalThis.__fastForwardReactionArrival = {
          state: post.dataset.reactions || "",
          reactions: [...post.querySelectorAll(".novel-slack-reaction")].map((node) => node.textContent?.trim() || ""),
        };
      };
      new MutationObserver(sample).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    });
    await page.locator("#novel-fast-forward-button").click();
    await page.waitForFunction(() => Boolean(globalThis.__fastForwardReactionArrival), null, { timeout: 10_000 });
    const arrival = await page.evaluate(() => globalThis.__fastForwardReactionArrival);
    assert.equal(arrival.state, "complete");
    assert.deepEqual(arrival.reactions, finalReactions);
    if (await page.locator("#novel-fast-forward-button").getAttribute("aria-pressed") === "true") {
      await page.locator("#novel-fast-forward-button").click();
    }
    report.scans.push({ case: "fast-forward", viewport: viewport.name, arrival, passed: true });
    await context.close();
  }

  {
    const viewport = viewports[1];
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    addPageDiagnostics(page, "mobile-section-skip");
    await bootAt(page, "welcome_chat_011", "mobile-section-skip", { waitForSlackReady: false });
    await page.waitForFunction(() => ["pending", "staging"].includes(document.querySelector(".novel-slack-post.is-new")?.dataset.reactions));
    await page.waitForFunction(() => !document.querySelector("#novel-close-button")?.disabled);
    await page.locator("#novel-close-button").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.classList.contains("is-staff-roll"), null, { timeout: 15_000 });
    await page.waitForTimeout(1_200);
    const skipped = await page.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      read: globalThis.GaiaNovel.getState().readStepIds.includes("welcome_chat_011"),
      reactionCount: document.querySelectorAll(".novel-slack-reaction").length,
      slackVisible: !document.querySelector("#novel-slack-surface")?.hidden,
    }));
    assert.equal(skipped.stepId, "welcome_chat_095");
    assert.equal(skipped.read, true);
    assert.equal(skipped.reactionCount, 0);
    assert.equal(skipped.slackVisible, false);
    report.scans.push({ case: "section-skip-cancels-staging", viewport: viewport.name, skipped, passed: true });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log("Campus chat reaction sequence browser check passed");

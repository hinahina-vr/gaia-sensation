import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4198"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/observation-log-revisions-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const progressFor = (storyVersion, stepId, label) => ({
  storyVersion,
  stepId,
  reachedSceneIds: [stepId.split(/_(?=\d{3}$)/u)[0]],
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
  sessionId: `observation-log-${label}`,
});

const bootAt = async (page, stepId, label) => {
  const progress = progressFor(13, stepId, label);
  await page.addInitScript((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "Observation log QA", excerpt: candidate.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, progress);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const resumedDirectly = await page.waitForFunction(
    (expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected,
    stepId,
    { timeout: 20_000 },
  ).then(() => true, () => false);
  if (!resumedDirectly) {
    const resume = page.locator("#novel-resume-button");
    if (await resume.isVisible()) {
      await resume.click();
      await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
      await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    } else {
      const actual = await page.evaluate(() => ({
        stateStepId: globalThis.GaiaNovel?.getState?.().stepId || "",
        layerStepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
        stepType: document.querySelector("#novel-layer")?.dataset.stepType || "",
      }));
      throw new Error(`${label}: direct resume did not reach ${stepId}: ${JSON.stringify(actual)}`);
    }
  }
  await page.waitForFunction((expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected, stepId);
};

const createPage = async (browser, viewport, label) => {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    report.consoleErrors.push(`${label}: ${message.text()}${location.url ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})` : ""}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  return { context, page };
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  {
    const viewport = viewports[0];
    const { context, page } = await createPage(browser, viewport, "welcome-reactions");
    await bootAt(page, "welcome_chat_011", "welcome-reactions");
    await page.locator(".novel-slack-workspace").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector(".novel-slack-post.is-new")?.dataset.reactions === "complete", null, { timeout: 8_000 });
    const scan = await page.evaluate(() => ({
      stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
      memberLabel: document.querySelector(".novel-slack-channel-members")?.textContent?.trim() || "",
      reactions: [...document.querySelectorAll(".novel-slack-post.is-new .novel-slack-reaction")].map((node) => node.textContent?.trim() || ""),
      observationMemoCount: [...document.querySelectorAll(".novel-slack-workspace > aside > :is(span, button)")]
        .filter((node) => node.textContent?.includes("観測メモ")).length,
      directMessages: [...document.querySelectorAll(".novel-slack-dm")].map((node) => node.dataset.directMessage),
      currentMessage: document.querySelector(".novel-slack-post.is-new .novel-slack-message")?.textContent || "",
    }));
    assert.equal(scan.stepId, "welcome_chat_011");
    assert.match(scan.memberLabel, /9/u);
    assert.deepEqual(scan.reactions, ["🎉 3", "🌍 2", "🫶 2"]);
    assert.equal(scan.observationMemoCount, 0);
    assert.deepEqual(scan.directMessages, ["cc_hinahina"]);
    assert.match(scan.currentMessage, /ESP32の試作/u);
    await page.screenshot({ path: path.join(outputDir, "pc-welcome-reactions.png"), animations: "disabled" });
    report.scans.push({ case: "welcome-reactions", ...scan, passed: true });
    await context.close();
  }

  for (const viewport of viewports) {
    const { context, page } = await createPage(browser, viewport, `${viewport.name}-connection-diagram`);
    await bootAt(page, "welcome_chat_023", `${viewport.name}-connection-diagram`);
    await page.locator('.novel-slack-attachment[data-attachment="GAIA_CONNECTION_DIAGRAM"] img').waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const image = document.querySelector('.novel-slack-attachment[data-attachment="GAIA_CONNECTION_DIAGRAM"] img');
      return image?.complete && image.naturalWidth > 0;
    });
    const scan = await page.evaluate(() => {
      const workspace = document.querySelector(".novel-slack-workspace");
      const attachment = document.querySelector('.novel-slack-attachment[data-attachment="GAIA_CONNECTION_DIAGRAM"]');
      const image = attachment?.querySelector("img");
      const attachmentRect = attachment?.getBoundingClientRect();
      const workspaceRect = workspace?.getBoundingClientRect();
      return {
        stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
        activeChannel: workspace?.dataset.activeChannel || "",
        currentChannel: document.querySelector(".novel-slack-workspace > aside .is-current")?.dataset.channel || "",
        title: document.querySelector(".novel-slack-channel-title")?.textContent?.trim() || "",
        memberLabel: document.querySelector(".novel-slack-channel-members")?.textContent?.trim() || "",
        currentMessage: document.querySelector(".novel-slack-post.is-new .novel-slack-message")?.textContent || "",
        imageSrc: image?.getAttribute("src") || "",
        imageAlt: image?.getAttribute("alt") || "",
        naturalWidth: image?.naturalWidth || 0,
        naturalHeight: image?.naturalHeight || 0,
        attachmentInsideWorkspace: Boolean(attachmentRect && workspaceRect
          && attachmentRect.left >= workspaceRect.left - 1
          && attachmentRect.right <= workspaceRect.right + 1),
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    assert.equal(scan.stepId, "welcome_chat_023");
    assert.equal(scan.activeChannel, "惑星の放課後_センサー");
    assert.equal(scan.currentChannel, "惑星の放課後_センサー");
    assert.equal(scan.title, "# 惑星の放課後");
    assert.match(scan.memberLabel, /9/u);
    assert.match(scan.currentMessage, /GAIA SENSEWAREへ観測データを送る接続図/u);
    assert.match(scan.imageSrc, /campus-chat-gaia-senseware-connection-diagram-v1\.png/u);
    assert.match(scan.imageAlt, /GAIA SENSEWARE.*接続図/u);
    assert(scan.naturalWidth > 1000 && scan.naturalHeight > 600);
    assert.equal(scan.attachmentInsideWorkspace, true);
    assert.equal(scan.overflowX, 0);
    if (await page.locator(".novel-slack-workspace > aside").isVisible()) {
      await page.locator('.novel-slack-story-channel[data-channel="惑星の放課後_雑談"]').click();
      assert.equal(await page.locator(".novel-slack-workspace").getAttribute("data-active-channel"), "惑星の放課後_雑談");
      await page.locator('.novel-slack-circle-channel[data-channel="惑星の放課後_センサー"]').click();
      assert.equal(await page.locator(".novel-slack-workspace").getAttribute("data-active-channel"), "惑星の放課後_センサー");
    }
    assert.equal(await page.locator("#novel-layer").getAttribute("data-step-id"), "welcome_chat_023");
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-connection-diagram.png`), animations: "disabled" });
    report.scans.push({ case: "connection-diagram", viewport: viewport.name, ...scan, passed: true });
    await context.close();
  }

  for (const viewport of viewports) {
    const { context, page } = await createPage(browser, viewport, `${viewport.name}-mobile-chat`);
    await bootAt(page, "welcome_chat_081", `${viewport.name}-mobile-chat`);
    await page.locator(".novel-slack-workspace.is-mobile-device").waitFor({ state: "visible" });
    const scan = await page.evaluate(() => {
      const workspace = document.querySelector(".novel-slack-workspace.is-mobile-device");
      const rect = workspace?.getBoundingClientRect();
      const style = workspace ? getComputedStyle(workspace) : null;
      const notch = workspace ? getComputedStyle(workspace, "::before") : null;
      const aside = workspace?.querySelector("aside");
      return {
        device: document.querySelector("#novel-layer")?.dataset.slackDevice || "",
        width: rect?.width || 0,
        height: rect?.height || 0,
        ratio: rect ? rect.width / rect.height : 0,
        borderWidth: style ? Number.parseFloat(style.borderTopWidth) : 0,
        borderRadius: style ? Number.parseFloat(style.borderTopLeftRadius) : 0,
        notchDisplay: notch?.display || "none",
        notchWidth: notch ? Number.parseFloat(notch.width) : 0,
        asideDisplay: aside ? getComputedStyle(aside).display : "",
        activeChannel: workspace?.dataset.activeChannel || "",
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    assert.equal(scan.device, "mobile");
    assert(scan.ratio < 0.72, `${viewport.name}: chat surface is still too square`);
    assert(scan.borderWidth >= 4);
    assert(scan.borderRadius >= 18);
    assert.notEqual(scan.notchDisplay, "none");
    assert(scan.notchWidth >= 60);
    assert.equal(scan.asideDisplay, "none");
    assert.equal(scan.activeChannel, "惑星の放課後_センサー");
    assert.equal(scan.overflowX, 0);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-smartphone-chat.png`), animations: "disabled" });
    report.scans.push({ case: "smartphone-chat", viewport: viewport.name, ...scan, passed: true });
    await context.close();
  }

  for (const target of [
    { stepId: "festival_concept_027", cue: "festival-mizuha-closeup-cg", presentation: "event-cg", cast: null },
    { stepId: "gx_experience_042", cue: "gx-present-return", asset: "novel-bg-festival-five-plane-projection-autumn-morning-v2.png", cast: null },
    { stepId: "circle_invitation_068", cue: "circle-after-welcome", asset: "novel-bg-festival-five-plane-projection-autumn-morning-v2.png", cast: "minamo" },
  ]) {
    const { context, page } = await createPage(browser, viewports[0], target.stepId);
    await bootAt(page, target.stepId, target.stepId);
    const scan = await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      const activeCast = document.querySelector("#novel-cast")?.dataset.speaker || "";
      const activeFigure = activeCast ? document.querySelector(`#novel-character-${activeCast}`) : null;
      return {
        cue: layer?.dataset.backgroundCue || "",
        presentation: layer?.dataset.backgroundPresentation || "",
        backgroundImage: getComputedStyle(layer).backgroundImage,
        castSuppressed: layer?.classList.contains("is-cast-suppressed") || false,
        activeCast,
        activeCastOpacity: activeFigure ? Number.parseFloat(getComputedStyle(activeFigure).opacity) : 0,
      };
    });
    assert.equal(scan.cue, target.cue);
    if (target.presentation) assert.equal(scan.presentation, target.presentation);
    if (target.asset) assert.match(scan.backgroundImage, new RegExp(target.asset.replaceAll(".", "\\."), "u"));
    if (target.cast) {
      assert.equal(scan.castSuppressed, false);
      assert.equal(scan.activeCast, target.cast);
      assert(scan.activeCastOpacity > 0.5);
    }
    await page.screenshot({ path: path.join(outputDir, `${target.stepId}.png`), animations: "disabled" });
    report.scans.push({ case: "story-staging", stepId: target.stepId, ...scan, passed: true });
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

console.log(`Observation log revision browser check passed: ${report.scans.length} scans`);

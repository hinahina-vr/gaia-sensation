import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, referenceArgument, outputArgument, baseUrl = "http://127.0.0.1:4321"] = process.argv.slice(2);
if (!moduleRoot || !executablePath || !referenceArgument) throw new Error("Playwright module, browser executable, and reference image are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const referencePath = path.resolve(referenceArgument);
const outputDir = path.resolve(outputArgument || "artifacts/reference-message-nav");
fs.mkdirSync(outputDir, { recursive: true });

const navContract = [
  ["novel-eves-button", "E.V.E.S."],
  ["novel-log-button", "LOG"],
  ["novel-save-button", "SAVE"],
  ["novel-load-button", "LOAD"],
  ["novel-config-button", "CONFIG"],
  ["novel-auto-button", "AUTO"],
  ["novel-fast-forward-button", "早送り"],
  ["novel-jump-button", "JUMP"],
];

const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const prepareStep = async (page, type) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GAIA_NOVEL_STORY && globalThis.GaiaNovel));
  await page.evaluate((stepType) => {
    const story = globalThis.GAIA_NOVEL_STORY;
    const steps = story.scenes.flatMap((scene) => scene.steps);
    const step = stepType === "dialogue"
      ? steps.filter((entry) => entry.type === "dialogue" && entry.speaker && entry.speaker !== "narrator" && String(entry.text || "").length >= 12 && String(entry.text || "").length <= 28)
        .sort((a, b) => String(a.text).length - String(b.text).length)[0]
      : steps.find((entry) => entry.type === "narration" || entry.speaker === "narrator");
    if (!step) throw new Error(`missing ${stepType} step`);
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({
      storyVersion: story.storyVersion,
      stepId: step.id,
      reachedSceneIds: [],
      viewed: {},
      evesRoute: [],
      observationOrder: null,
      editorialChoice: null,
      reflectionIds: [],
      resultTone: null,
      metCharacters: { mizuha: true, amane: true, sakuya: false },
      audio: { muted: true, volume: 0 },
      readStepIds: [],
      clear: false,
      archivesUnlocked: false,
      sessionId: `reference-message-${stepType}`,
    }));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, type);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.locator("#novel-dialogue").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#novel-text")?.textContent?.trim().length > 0);
  await page.waitForTimeout(120);
};

const measure = (page) => page.evaluate((contract) => {
  const rect = (node) => {
    const value = node.getBoundingClientRect();
    return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
  };
  const overlaps = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const dialogue = document.querySelector("#novel-dialogue");
  const speaker = document.querySelector("#novel-speaker");
  const text = document.querySelector("#novel-text");
  const continuation = document.querySelector("#novel-continue");
  const nav = document.querySelector(".novel-topbar nav");
  const close = document.querySelector("#novel-close-button");
  const dialogueRect = rect(dialogue);
  const speakerRect = rect(speaker);
  const textRect = rect(text);
  const continueRect = rect(continuation);
  const navRect = rect(nav);
  const closeRect = rect(close);
  const dialogueStyle = getComputedStyle(dialogue);
  const dialogueAfter = getComputedStyle(dialogue, "::after");
  const speakerStyle = getComputedStyle(speaker);
  const buttons = contract.map(([id, expected]) => {
    const button = document.querySelector(`#${id}`);
    const label = button.querySelector(".novel-nav-label");
    const icon = button.querySelector(".novel-nav-icon");
    const buttonStyle = getComputedStyle(button);
    const labelStyle = getComputedStyle(label);
    return {
      id,
      expected,
      text: label.textContent.trim(),
      button: rect(button),
      icon: rect(icon),
      label: rect(label),
      display: buttonStyle.display,
      visibility: buttonStyle.visibility,
      pointerEvents: buttonStyle.pointerEvents,
      labelDisplay: labelStyle.display,
      labelVisibility: labelStyle.visibility,
      labelClipped: label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1,
    };
  });
  return {
    stepId: document.querySelector("#novel-layer")?.dataset.stepId,
    speakerText: speaker.textContent.trim(),
    dialogue: dialogueRect,
    speaker: speakerRect,
    text: textRect,
    continuation: continueRect,
    nav: navRect,
    close: closeRect,
    buttons,
    dialogueBorder: [dialogueStyle.borderTopWidth, dialogueStyle.borderRightWidth, dialogueStyle.borderBottomWidth, dialogueStyle.borderLeftWidth],
    dialogueRadius: dialogueStyle.borderRadius,
    dialogueBackground: dialogueStyle.backgroundImage,
    afterBackground: dialogueAfter.backgroundImage,
    afterRadius: dialogueAfter.borderRadius,
    speakerBackground: speakerStyle.backgroundImage,
    speakerRadius: speakerStyle.borderRadius,
    speakerDisplay: speakerStyle.display,
    speakerCenterDelta: (speakerRect.left + speakerRect.width / 2) - (dialogueRect.left + dialogueRect.width / 2),
    textNavOverlap: overlaps(textRect, navRect),
    dialogueNavOverlap: overlaps(dialogueRect, navRect),
    continueNavOverlap: overlaps(continueRect, navRect),
    closeNavOverlap: overlaps(closeRect, navRect),
    closeDialogueOverlap: overlaps(closeRect, dialogueRect),
    overflow: document.documentElement.scrollWidth - innerWidth,
    restart: (() => {
      const node = document.querySelector("#novel-restart-button");
      const style = getComputedStyle(node);
      return { hidden: node.hidden, display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents, rect: rect(node) };
    })(),
  };
}, navContract);

const assertLayout = (scan, type, viewport) => {
  assert(scan.dialogueBorder.every((value) => value === "0px"), `${viewport}/${type}: dialogue border remains`);
  assert.equal(scan.dialogueRadius, "0px", `${viewport}/${type}: dialogue radius remains`);
  assert.equal(scan.afterRadius, "0px", `${viewport}/${type}: gradient radius remains`);
  assert(!scan.dialogueBackground.includes("radial-gradient") && !scan.afterBackground.includes("radial-gradient"), `${viewport}/${type}: radial message remains`);
  assert(scan.afterBackground.includes("linear-gradient"), `${viewport}/${type}: linear message gradient missing`);
  assert.equal(scan.speakerRadius, "0px", `${viewport}/${type}: speaker pill remains`);
  assert(!scan.speakerBackground.includes("radial-gradient"), `${viewport}/${type}: radial speaker remains`);
  assert(!scan.textNavOverlap && !scan.dialogueNavOverlap && !scan.continueNavOverlap, `${viewport}/${type}: nav intersects message`);
  assert(!scan.closeNavOverlap && !scan.closeDialogueOverlap, `${viewport}/${type}: close action intersects message/nav`);
  assert(scan.overflow <= 1, `${viewport}/${type}: horizontal overflow ${scan.overflow}`);
  assert.equal(scan.restart.hidden, true, `${viewport}/${type}: restart hidden attr missing`);
  assert.equal(scan.restart.display, "none", `${viewport}/${type}: restart visible`);
  assert(scan.buttons.every((button, index) => button.id === navContract[index][0] && button.text === navContract[index][1]), `${viewport}/${type}: nav order/labels changed`);
  assert(scan.buttons.every((button) => button.button.width >= 44 && button.button.height >= 44 && button.label.width > 0 && button.label.height > 0 && !button.labelClipped), `${viewport}/${type}: nav hit or label failed`);
  if (type === "dialogue") {
    assert(scan.speakerText.length > 0 && scan.speakerDisplay !== "none", `${viewport}: dialogue speaker missing`);
    assert(scan.speaker.height <= 30, `${viewport}: speaker strip too tall`);
  } else {
    assert.equal(scan.speakerText, "", `${viewport}: narration has speaker text`);
    assert.equal(scan.speakerDisplay, "none", `${viewport}: empty narration speaker visible`);
  }
};

const capture = async ({ name, width, height, type }) => {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${name}/${type}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${name}/${type}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${name}/${type}: ${response.url()}`); });
  await prepareStep(page, type);
  const scan = await measure(page);
  assertLayout(scan, type, name);
  const screenshotPath = path.join(outputDir, `${name}-${type}.png`);
  await page.screenshot({ path: screenshotPath, animations: "disabled" });
  report.scans.push({ name, width, height, type, ...scan });
  await context.close();
  return screenshotPath;
};

const imageDataUrl = (imagePath) => `data:image/png;base64,${fs.readFileSync(imagePath).toString("base64")}`;

const makeComparison = async (candidatePath) => {
  const reference = imageDataUrl(referencePath);
  const candidate = imageDataUrl(candidatePath);
  const context = await browser.newContext({ viewport: { width: 1448, height: 570 } });
  const page = await context.newPage();
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:1448px;height:570px;overflow:hidden;background:#07101e}.board{display:grid;grid-template-columns:724px 724px}.cell{position:relative;width:724px;height:570px}.tag{position:absolute;z-index:2;top:8px;left:8px;padding:4px 7px;background:#061126cc;color:#dceeff;font:11px monospace}.cell img{display:block;width:724px;height:570px;object-fit:fill}</style><div class="board"><div class="cell"><span class="tag">REFERENCE</span><img src="${reference}"></div><div class="cell"><span class="tag">CANDIDATE</span><img src="${candidate}"></div></div>`);
  await page.screenshot({ path: path.join(outputDir, "reference-candidate-side-by-side.png") });
  await context.close();

  const overlayContext = await browser.newContext({ viewport: { width: 724, height: 570 } });
  const overlayPage = await overlayContext.newPage();
  await overlayPage.setContent(`<style>html,body{margin:0;width:724px;height:570px;overflow:hidden;background:#000}.frame{position:relative;width:724px;height:570px}.frame img{position:absolute;inset:0;width:724px;height:570px;object-fit:fill}.candidate{opacity:.5}.tag{position:absolute;z-index:3;top:8px;left:8px;padding:4px 7px;background:#061126cc;color:#dceeff;font:11px monospace}</style><div class="frame"><img src="${reference}"><img class="candidate" src="${candidate}"><span class="tag">REFERENCE + 50% CANDIDATE</span></div>`);
  await overlayPage.screenshot({ path: path.join(outputDir, "reference-candidate-overlay-50.png") });
  await overlayContext.close();
};

try {
  const referenceCandidate = await capture({ name: "reference-724x570", width: 724, height: 570, type: "dialogue" });
  await makeComparison(referenceCandidate);
  for (const viewport of [{ name: "pc-1440", width: 1440, height: 900 }, { name: "mobile-390", width: 390, height: 844 }]) {
    await capture({ ...viewport, type: "dialogue" });
    await capture({ ...viewport, type: "narration" });
  }
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
}

console.log(`reference message/nav browser check: ${report.status}`);

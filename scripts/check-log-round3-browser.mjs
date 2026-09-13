import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(outputArgument || "artifacts/log-round3-browser");
fs.mkdirSync(outputDir, { recursive: true });

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?round3=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const stepMap = new Map(story.scenes.flatMap((scene) => scene.steps).map((step) => [step.id, step]));
const expectedText = new Map([
  ["map_mode01_003", "「こちらがMODE 01です。1958年から2050年まで、地球の変化を続けて見てください」"],
  ["gx_experience_008", "「GXという言葉は、どこかで見たことがありますか？」"],
  ["gx_experience_010", "「一般にはそうですわ。でも、この画面のGXは『GAIA Transformation』。生命が地球を変え、変わった海や大気がまた生命の条件を変えてきた、その相互作用を表す言葉ですの」"],
  ["gx_experience_011", "「ここでは、生命と地球が互いを変えてきた過程を、時間をさかのぼりながら見ていきます」"],
  ["gx_experience_018", "時間軸へ触れ、左へ引く。指を少し動かすだけで、画面の上では何千万年もの時間が過ぎていく。"],
  ["gx_experience_033", "「これはシアノバクテリアです。海で光合成を行い、酸素を生み出した微小な細菌です。触れたことで増えたのではなく、触れた場所で当時の活動を表示しています」"],
  ["gx_experience_044", "生命が環境を変え、変わった環境が生命の条件を変える。画面を行き来する光を見て、共進化とは、完成へ向かう一本道ではなく影響を返し合うことなのだと分かった。"],
  ["gx_experience_055", "画面の端に、まだ開いていない機能の入口がいくつか並ぶ。"],
  ["esp32_pitch_001", "画面に秋の日差しと海辺の会場が戻る。暗い海を見ていた目には、パネルへ差す光が少しまぶしい。"],
  ["esp32_pitch_008", "あめも、みずも、すぐには答えなかった。失敗したと思いかけたとき、二人が続きを待っているのだと気づいた。"],
  ["esp32_pitch_027", "あめはもう、説明用タブレットに新しい提案メモを作り始めていた。"],
  ["circle_invitation_001", "展示終了まで、あと三十分だというアナウンスが流れた。隣のブースでは、配布物を箱へ戻し始めている。"],
  ["circle_invitation_020", "「その相談、学内チャットで見せてもらえますか」"],
  ["circle_invitation_029", "それを見てから、みずは机の端から小さな案内カードを取り出した。丸い惑星の絵と、「惑星の放課後」という文字が印刷されている。こちらへ文字が見える向きに差し出したが、手元で止めて次の言葉を待った。"],
  ["circle_invitation_045", "二人へ向き直り、今度は迷わず答えた。"],
  ["circle_invitation_046", "「これから、よろしくお願いします」"],
  ["circle_invitation_053", "通知音に、あめがこちらを見た。"],
  ["circle_invitation_055", "「ええ。参加できています」"],
  ["welcome_chat_015", "まだ会ったことのないsakuから、短いメッセージが届いた。"],
  ["welcome_chat_020", "sakuの短い返事で、画面越しの距離が縮まった。初めてのチャットなのに、このまま話を続けられる気がした。"],
  ["welcome_chat_063", "地球の未来を考えたい。ESP32をつなぎたい。二人にまた会いたい。どれも同じくらい本当だった。周囲では、午前枠を終えた学生たちが機材を箱へ戻し始めていた。"],
  ["welcome_chat_064", "「私たちも、そろそろ片づけます。展示画面を消しますね」"],
  ["welcome_chat_081", "次に測る場所、決まったら教えて。"],
  ["welcome_chat_095", "その選択の中に、今日から私たちもいる。物語は、ここからも続いていく。"],
]);
const expectedAssets = new Map([
  ["map_mode01_003", "event-cg-festival-map-transition-five-plane-v3.png"],
  ["gx_experience_018", "novel-bg-festival-five-plane-projection-autumn-morning-v2.png"],
  ["gx_experience_055", "novel-bg-gx-mode-gateway-autumn-morning-v4.png"],
  ["esp32_pitch_001", "novel-bg-festival-five-plane-projection-autumn-morning-v2.png"],
  ["esp32_pitch_008", "event-cg-esp32-collaboration-v2.png"],
  ["esp32_pitch_027", "novel-bg-festival-five-plane-projection-autumn-morning-v2.png"],
  ["circle_invitation_001", "novel-bg-festival-five-plane-projection-autumn-morning-v2.png"],
  ["circle_invitation_029", "event-cg-circle-invitation-card-v3.png"],
]);
const mobileExpectedAssets = new Map([
  ["map_mode01_003", "event-cg-festival-map-transition-five-plane-mobile-v1.png"],
  ["esp32_pitch_008", "event-cg-esp32-collaboration-mobile-v1.png"],
  ["circle_invitation_029", "event-cg-circle-invitation-card-mobile-v1.png"],
]);
const specialIds = new Set(["welcome_chat_081", "welcome_chat_095"]);
assert.equal(expectedText.size, 24);
for (const [id, text] of expectedText) assert.equal(stepMap.get(id)?.text, text, `${id}: generated text differs`);
assert.equal(story.scenes.flatMap((scene) => scene.steps).length, 372);
assert.equal(story.sourceSha256, "27db292fbcfd2fc5130c9dcef8f33532ee0956abb559729347aa055dc5cd6b0c");

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = {
  status: "running",
  baseUrl,
  targetStepCount: expectedText.size,
  scans: [],
  gxInteractions: [],
  retiredDemoPolls: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const stateFor = (stepId, extra = {}) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [stepMap.get(stepId)?.sceneId || "gx_experience"],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気温偏差の地図",
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `round3-${stepId}`,
  ...extra,
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const bootAt = async (page, stepId, extra = {}) => {
  const expectedStepId = /^gx_experience_0(?:4[5-9]|5[0-4])$/u.test(stepId) ? "gx_experience_055" : stepId;
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{ progress: candidate, savedAt: Date.now(), meta: { title: "LOG round 3 QA", excerpt: candidate.stepId } }]));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, stateFor(stepId, extra));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, expectedStepId, { timeout: 15_000 });
  await page.waitForTimeout(150);
};

const scanSimpleStep = async (page, viewport, stepId) => {
  await bootAt(page, stepId);
  await page.waitForFunction(() => Boolean(document.querySelector("#novel-text")?.dataset.pageCount));
  const pageCount = Number(await page.locator("#novel-text").getAttribute("data-page-count"));
  const renderedPages = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (await page.locator("#novel-text").evaluate((text) => text.classList.contains("is-revealing"))) {
      await page.locator("#novel-dialogue").click({ position: { x: 24, y: 24 } });
      await page.waitForFunction(() => !document.querySelector("#novel-text")?.classList.contains("is-revealing"));
    }
    renderedPages.push(await page.locator("#novel-text").getAttribute("aria-label") || "");
    if (pageIndex < pageCount - 1) {
      await page.locator("#novel-dialogue").click({ position: { x: 24, y: 24 } });
      await page.waitForFunction((expected) => Number(document.querySelector("#novel-text")?.dataset.pageIndex) === expected, pageIndex + 2);
    }
  }
  const scan = await page.evaluate((id) => {
    const isVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const layer = document.querySelector("#novel-layer");
    const text = document.querySelector("#novel-text");
    const dialogue = document.querySelector("#novel-dialogue");
    return {
      stepId: layer?.dataset.stepId,
      cueId: layer?.dataset.backgroundCue,
      backgroundImage: getComputedStyle(layer).backgroundImage,
      sourceText: text?.getAttribute("aria-label") || "",
      dialogueVisible: isVisible(dialogue),
      measuredLineCount: Number(text?.dataset.measuredLineCount || 0),
      maxLineCount: Number(text?.dataset.maxLineCount || 0),
      castSuppressed: layer?.classList.contains("is-cast-suppressed"),
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      bodyOverflowX: Math.max(0, document.body.scrollWidth - innerWidth),
      expectedId: id,
    };
  }, stepId);
  assert.equal(scan.stepId, stepId);
  assert.equal(renderedPages.join(""), expectedText.get(stepId));
  assert.equal(scan.dialogueVisible, true);
  assert(scan.cueId && scan.backgroundImage !== "none");
  assert.equal(scan.overflowX, 0);
  assert.equal(scan.bodyOverflowX, 0);
  assert(scan.measuredLineCount > 0 && scan.measuredLineCount <= scan.maxLineCount);
  if (expectedAssets.has(stepId)) {
    const expectedAsset = viewport.name.startsWith("mobile")
      ? mobileExpectedAssets.get(stepId) || expectedAssets.get(stepId)
      : expectedAssets.get(stepId);
    assert.match(scan.backgroundImage, new RegExp(expectedAsset.replaceAll(".", "\\."), "u"));
  }
  if (["map_mode01_003", "circle_invitation_029"].includes(stepId)) assert.equal(scan.castSuppressed, true);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${stepId}.png`), animations: "disabled" });
  report.scans.push({ viewport: viewport.name, stepId, kind: "dialogue", ...scan, passed: true });
};

const scanChat = async (page, viewport) => {
  const stepId = "welcome_chat_081";
  await bootAt(page, stepId);
  const scan = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const post = document.querySelector(".novel-slack-post.is-new");
    return {
      stepId: document.querySelector("#novel-layer")?.dataset.stepId,
      text: post?.querySelector(".novel-slack-message")?.textContent || "",
      visible: isVisible(post),
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
  assert.deepEqual(scan, { stepId, text: expectedText.get(stepId), visible: true, overflowX: 0 });
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${stepId}.png`), animations: "disabled" });
  report.scans.push({ viewport: viewport.name, stepId, kind: "chat", ...scan, passed: true });
};

const performGxInteraction = async (page, viewport) => {
  await bootAt(page, "gx_experience_017", { readStepIds: ["gx_experience_016"] });
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open" && document.querySelector("#gx-layer")?.hidden === false);
  await page.waitForTimeout(450);
  for (let index = 0; index < 3; index += 1) {
    const target = await page.evaluate(() => {
      const canvas = document.querySelector("#gx-canvas");
      const rect = canvas?.getBoundingClientRect();
      if (!canvas || !rect) return null;
      for (const [nx, ny] of [[0.69, 0.5], [0.62, 0.5], [0.76, 0.5], [0.69, 0.4], [0.69, 0.6]]) {
        const x = rect.left + rect.width * nx;
        const y = rect.top + rect.height * ny;
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
      return null;
    });
    assert(target, `${viewport.name}: GX canvas has no real gesture target`);
    await page.mouse.move(target.x - 18, target.y);
    await page.mouse.down();
    await page.mouse.move(target.x + 18, target.y + 8, { steps: 8 });
    await page.mouse.up();
  }
  let keyboardPhaseAdvances = 0;
  for (; keyboardPhaseAdvances < 10; keyboardPhaseAdvances += 1) {
    const completed = await page.evaluate(() => globalThis.GaiaNovel.getState().stepId === "gx_experience_018");
    if (completed) break;
    const previousPhase = await page.locator("#gx-phase-index").textContent();
    await page.keyboard.press("Enter");
    await page.waitForFunction((phase) => (
      globalThis.GaiaNovel.getState().stepId === "gx_experience_018"
      || (document.querySelector("#gx-phase-index")?.textContent !== phase
        && !document.querySelector("#gx-layer")?.classList.contains("is-era-transitioning"))
    ), previousPhase, { timeout: 5_000 });
  }
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "gx_experience_018", null, { timeout: 5_000 });
  const closed = await page.evaluate(() => {
    const element = document.querySelector("#gx-layer");
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      stepId: globalThis.GaiaNovel.getState().stepId,
      lifecycle: document.body.dataset.novelInteractionState || "idle",
      gxVisible: !element.hidden && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0,
      backgroundImage: getComputedStyle(document.querySelector("#novel-layer")).backgroundImage,
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
  assert.equal(closed.stepId, "gx_experience_018");
  assert.equal(closed.lifecycle, "idle");
  assert.equal(closed.gxVisible, false);
  assert.match(closed.backgroundImage, /novel-bg-festival-five-plane-projection-autumn-morning-v2\.png/u);
  assert.equal(closed.overflowX, 0);
  report.gxInteractions.push({ viewport: viewport.name, keyboardPhaseAdvances, ...closed, passed: true });
};

const scanRetiredDemoPoll = async (page, viewport) => {
  await bootAt(page, "gx_experience_046", { demoInterest: "太古の海" });
  const migrated = await page.evaluate(() => ({
    stepId: document.querySelector("#novel-layer")?.dataset.stepId,
    text: document.querySelector("#novel-text")?.getAttribute("aria-label") || "",
    choiceCount: document.querySelectorAll("#novel-choices button").length,
    hasTally: Boolean(document.querySelector(".novel-demo-results-shell")),
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  }));
  assert.equal(migrated.stepId, "gx_experience_055");
  assert.equal(migrated.text, expectedText.get("gx_experience_055"));
  assert.equal(migrated.choiceCount, 0);
  assert.equal(migrated.hasTally, false);
  assert.equal(migrated.overflowX, 0);

  await bootAt(page, "gx_experience_044");
  for (let index = 0; index < 5; index += 1) {
    if (await page.evaluate(() => document.querySelector("#novel-layer")?.dataset.stepId === "gx_experience_055")) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "gx_experience_055");
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-demo-poll-retired.png`), animations: "disabled" });
  report.retiredDemoPolls.push({ viewport: viewport.name, ...migrated, directNext: "gx_experience_055", passed: true });
};

const scanStaffRoll = async (page, viewport) => {
  const stepId = "welcome_chat_095";
  await bootAt(page, stepId);
  const scan = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const shell = document.querySelector(".novel-staff-roll");
    const button = shell?.querySelector("button");
    return {
      stepId: document.querySelector("#novel-layer")?.dataset.stepId,
      text: shell?.innerText || "",
      visible: isVisible(shell),
      buttonHeight: button?.getBoundingClientRect().height || 0,
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
  assert.equal(scan.stepId, stepId);
  assert.equal(scan.visible, true);
  [
    "ひなひな",
    "OpenAI Codex",
    "OpenAI ImageGen",
    "ZEN大学『共創地球論』",
    "ZEN大学『統計学入門』",
    "ZEN大学『リテラシーと応用のための物語理論』",
    "JAXA / NASA / NOAA",
    "気象庁",
  ].forEach((text) => assert.match(scan.text, new RegExp(text, "u")));
  assert(scan.buttonHeight >= 44 && scan.overflowX === 0);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${stepId}.png`), animations: "disabled" });
  report.scans.push({ viewport: viewport.name, stepId, kind: "staff-roll", ...scan, passed: true });
  await page.locator(".novel-staff-roll button:not(.novel-staff-roll-data-skip)").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().clear === true);
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await performGxInteraction(page, viewport);
    for (const stepId of expectedText.keys()) if (!specialIds.has(stepId)) await scanSimpleStep(page, viewport, stepId);
    await scanChat(page, viewport);
    await scanRetiredDemoPoll(page, viewport);
    await scanStaffRoll(page, viewport);
    await context.close();
  }
  assert.equal(report.scans.length, expectedText.size * viewports.length);
  assert.equal(report.gxInteractions.length, viewports.length);
  assert.equal(report.retiredDemoPolls.length, viewports.length);
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

console.log(`LOG round 3 browser check passed: ${report.scans.length} focused step scans, ${report.gxInteractions.length} GX interactions`);

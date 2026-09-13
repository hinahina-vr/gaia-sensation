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
const outputDir = path.resolve(outputArgument || "artifacts/log-comment-fixes-browser");
fs.mkdirSync(outputDir, { recursive: true });
const loaderSource = fs.readFileSync(path.join(projectRoot, "gaia-mode-loader.js"), "utf8");
assert.match(loaderSource, /novel-story-data\.js\?v=gaia-script-natural-copy-1/u,
  "revised LOG script data must use a fresh cache key");

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?log-fixes=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const allSteps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(allSteps.map((step) => [step.id, step]));

const expectedText = new Map([
  ["festival_concept_006", "受付でスマートフォンを取り出し、入場用の二次元コードをかざす。"],
  ["festival_concept_new_003", "受付を抜けると、行き交う学生たちの胸元の名札に、学内チャットで見たことのあるハンドルネームがいくつもあった。けれど、話したことのある名前は一つもない。学内チャットは、眺めているだけで、自分から何かを発信したり、会話に参加したこともない。それは、オフラインでも同じことだ。自分だけが名前のない匿名ユーザーのように、楽しそうに笑い合う人の輪を外から眺めていた。"],
  ["festival_concept_010", "受付棟から階段を下り、海風の吹く屋外展示エリアへ出る。話し声と呼び込みの喧騒の中を歩いていると、暗幕で覆われた大型の展示に目を奪われた。"],
  ["festival_concept_013", "机の向こうで、水色のボブヘアの学生が、固定したケーブルを端から順に点検している。半分眠そうな目はコネクターの表示を正確に追い、机の端にはドライバーと結束バンドが整然と並んでいた。"],
  ["festival_concept_014", "その隣では、海のような色の長い髪をした学生が、説明用のタブレットを確かめていた。表示された文章を上から下まで目で追い、最後の一行で一度だけ小さくうなずいている。"],
  ["festival_concept_015", "画面へ近づくと、私の影が地球に重なった。水色のボブヘアの学生が顔を上げ、私と目が合う。肩の力を抜いたまま、声をかける合図のように小さくうなずいた。"],
  ["festival_concept_016", "「こんにちは。何十億年も前から今の気候まで、全身で体感できる展示です。よかったら見ていきませんか？」"],
  ["festival_concept_new_005", "最後の言葉に合わせて、彼女の口元が少しだけ緩んだ。呼び込み用の笑顔というより、私が断っても気にしないような、力の抜けた表情だった。すぐ隣で、海のような色の長い髪の学生が、優しく微笑んでいる。"],
  ["festival_concept_021", "「ありがとうございます！改めまして、私は『あめ』と言います。2年生です」"],
  ["festival_concept_023", "「私は『みず』と申します。同じく2年生。あなたも、うちの大学の方ですの？」"],
  ["festival_concept_new_009", "「みず」と名乗った学生も、表情は落ち着いているが、こちらの反応を楽しみにしているように見えた。"],
  ["festival_concept_new_010", "みずはタブレットを両手で持ち、返事を待つあいだ、わずかに首を傾けていた。地球の青い光が、長い髪の内側へ薄く映っている。"],
  ["festival_concept_new_011", "みずの目元が少し柔らかくなった。私は改めてブースを見回す。展示用のディスプレイはプロジェクターで照らされ、テントの奥から左右のパネルへ切れ目なく続いている。機材も演出も、学生の仕事には見えない、プロ顔負けの設えだ。"],
  ["festival_concept_031", "あめの表情が一層明るくなる。みずが隣で、秘密を明かす順番を知っているように小さく笑った。"],
  ["festival_concept_032", "「んー、お目が高いですね！実は、親戚のオジキがイルミネーション屋さんなんです。日中の屋外でも使える、20,000ルーメン級のプロジェクターを貸してくれて、設営も一緒に考えてくれました」"],
  ["festival_concept_034", "「20,000ルーメン……。ちょっとしたvTuberライブもできちゃいますね。しかも複数台ある。それに、明るさだけじゃなくて、投影面の角度も海風への備えも、全部きちんと設計されているんですね」"],
  ["festival_concept_new_014", "あめが首を縦にぶんぶんと振り、嬉しそうにうなずく。気怠そうな第一印象とは裏腹に、スイッチが入るとテンションが上がるタイプなのだろうか。その横で、みずが楽しそうに口元をほころばせた。なるほど、いいコンビなのかも知れないな、と思った。"],
  ["festival_concept_036", "「ええ。陽射しの中でも見やすい画面の向きも、海風でケーブルが揺れない留め方も、おじさまがあめと一緒に考えてくださいましたの」"],
  ["festival_concept_new_015", "みずの言い方には、設営の日にあめやおじと試行錯誤した時間を、誰かへ伝えたかったような弾みがあった。"],
  ["festival_concept_039", "「あめは、電気工事士の資格も持っていますの。今日の配線も、あめとおじさまが安全を確認しましたわ」"],
  ["festival_concept_047", "みずは「そのお話、もっと詳しく」と言うようにタブレットを胸元へ寄せた。あめも短くうなずく。初対面の人にいきなり趣味の話までして恥ずかしいという気持ちより、続きを話したい気持ちが少しだけ勝っていた。"],
  ["festival_concept_048", "「このGAIA SENSEWAREって、どんなコンセプトなんですか？」"],
  ["festival_concept_052", "「ただ『環境にいいこと』を教えるような展示とは、ちょっと違います」"],
  ["festival_concept_new_023", "あめは「環境」という言葉のあたりで、眉をほんの少し寄せた。嫌っているというより、その一言でありきたりな枠にまとめられるのを警戒している顔だった。"],
  ["festival_concept_new_024", "そう聞いて、私は節電やリサイクルの話を想像していた。どうやら、そういうお説教じみた展示ではないらしい。"],
  ["festival_concept_062", "二人の声に呼応するように、地球の表面から有機的な光の筋が芽吹き、網目のように増殖していった。大気、海、森、都市。バラバラに揺らいでいた現象が、脈打つ一本の系として結ばれていく。"],
  ["festival_concept_new_029", "揺らめく光の軌跡を見つめるみずの横顔には、自ら生み出したものへの自負と、相手に届いているかを測る静かな緊張が混ざり合っているようだった。"],
  ["festival_concept_066", "「数字だけじゃ気づきにくい変化を、地図や光、音へ変換しています。地球の感覚と、人間の感覚を重ね合わせるようにして、直感で感じ取ってもらいたいんです！」"],
  ["festival_concept_new_031", "「地球の感覚と、人間の感覚を重ね合わせる」。まだ作りかけだと二人は笑っていたけれど、私にはそれがとんでもないものに見えた。完成された綺麗な展示より、いま目の前で動いているアイデアの生々しさのほうが、ずっと強く胸に刺さる。画面の文字を追うのをやめて、光と音の揺らぎをぼんやり眺めてみる。遠い海の波や風の気配が、そのまま自分の呼吸に重なっていくようだった。"],
]);

const expectedSpeakers = new Map([
  ["festival_concept_016", "短髪の女性"],
  ["festival_concept_021", "短髪の女性"],
  ["festival_concept_023", "長髪の女性"],
  ["festival_concept_032", "あめ"],
  ["festival_concept_034", "あなた"],
  ["festival_concept_036", "みず"],
  ["festival_concept_039", "みず"],
  ["festival_concept_048", "あなた"],
  ["festival_concept_052", "あめ"],
  ["festival_concept_066", "あめ"],
]);

const expectedAssets = new Map();

assert.equal(allSteps.length, 372);
assert.equal(new Set(allSteps.map((step) => step.id)).size, 372);
assert.equal(expectedText.size, 29);
assert.equal(story.sourceSha256, "27db292fbcfd2fc5130c9dcef8f33532ee0956abb559729347aa055dc5cd6b0c");
assert.deepEqual(story.requiredInteractions, ["map01", "gx"]);
assert(story.saveFields.includes("stepId") && story.saveFields.includes("readStepIds") && story.saveFields.includes("demoInterest"));
for (const [id, text] of expectedText) assert.equal(stepMap.get(id)?.text, text, `${id}: generated text differs`);
assert.equal(stepMap.has("festival_concept_new_030"), false);

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = {
  status: "running",
  baseUrl,
  targetStepCount: expectedText.size,
  scans: [],
  mapInteractions: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const stateFor = (stepId, extra = {}) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [stepMap.get(stepId).sceneId],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: false },
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
  sessionId: `log-comment-fixes-${stepId}`,
  ...extra,
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
};

const bootAt = async (page, stepId, extra = {}) => {
  const candidate = stateFor(stepId, extra);
  await page.addInitScript((progress) => {
    localStorage.clear();
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress,
      savedAt: Date.now(),
      meta: { title: "LOG fixes QA", excerpt: progress.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, candidate);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15_000 });
  await page.waitForTimeout(180);
};

const scanStep = async (page, viewport, stepId) => {
  await bootAt(page, stepId);
  await page.waitForFunction(() => Boolean(document.querySelector("#novel-text")?.dataset.pageCount));
  if (await page.locator("#novel-text").evaluate((text) => text.classList.contains("is-revealing"))) {
    await page.locator("#novel-dialogue").click({ position: { x: 30, y: 30 } });
    await page.waitForFunction(() => !document.querySelector("#novel-text")?.classList.contains("is-revealing"));
  }
  const scan = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const layer = document.querySelector("#novel-layer");
    const dialogue = document.querySelector("#novel-dialogue");
    const text = document.querySelector("#novel-text");
    const speaker = document.querySelector("#novel-speaker");
    const avatar = document.querySelector("#novel-avatar");
    const dialogueRect = dialogue?.getBoundingClientRect();
    const textRect = text?.getBoundingClientRect();
    return {
      stepId: layer?.dataset.stepId,
      cueId: layer?.dataset.backgroundCue,
      backgroundImage: getComputedStyle(layer).backgroundImage,
      renderedText: text?.textContent || "",
      sourceText: text?.getAttribute("aria-label") || "",
      speaker: speaker?.textContent || "",
      avatarHidden: avatar?.hidden,
      avatarVisible: isVisible(avatar),
      dialogueVisible: isVisible(dialogue),
      dialogueRect: dialogueRect?.toJSON(),
      textRect: textRect?.toJSON(),
      pageCount: Number(text?.dataset.pageCount || 1),
      measuredLineCount: Number(text?.dataset.measuredLineCount || 0),
      maxLineCount: Number(text?.dataset.maxLineCount || 0),
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      bodyOverflowX: Math.max(0, document.body.scrollWidth - innerWidth),
    };
  });
  assert.equal(scan.stepId, stepId);
  assert.equal(scan.dialogueVisible, true, `${viewport.name} ${stepId}: dialogue is not visible`);
  assert(scan.renderedText.length > 0, `${viewport.name} ${stepId}: text is empty`);
  assert(scan.cueId, `${viewport.name} ${stepId}: background cue is missing`);
  assert.notEqual(scan.backgroundImage, "none", `${viewport.name} ${stepId}: background image is missing`);
  assert.equal(scan.overflowX, 0, `${viewport.name} ${stepId}: document overflows horizontally`);
  assert.equal(scan.bodyOverflowX, 0, `${viewport.name} ${stepId}: body overflows horizontally`);
  assert(scan.measuredLineCount > 0 && scan.measuredLineCount <= scan.maxLineCount, `${viewport.name} ${stepId}: text exceeds the measured page capacity`);
  assert(scan.dialogueRect.left >= 0 && scan.dialogueRect.right <= viewport.width + 1, `${viewport.name} ${stepId}: dialogue leaves viewport`);
  assert(scan.textRect.left >= scan.dialogueRect.left && scan.textRect.right <= scan.dialogueRect.right + 1, `${viewport.name} ${stepId}: text leaves dialogue`);
  if (expectedSpeakers.has(stepId)) assert.equal(scan.speaker, expectedSpeakers.get(stepId), `${viewport.name} ${stepId}: speaker differs`);
  if (expectedAssets.has(stepId)) {
    assert.match(scan.backgroundImage, new RegExp(expectedAssets.get(stepId).replaceAll(".", "\\."), "u"), `${viewport.name} ${stepId}: expected background asset is missing`);
  }
  assert.equal(scan.avatarHidden, true, `${viewport.name} ${stepId}: abstract avatar is not hidden`);
  assert.equal(scan.avatarVisible, false, `${viewport.name} ${stepId}: abstract avatar remains visible`);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${stepId}.png`), animations: "disabled" });
  report.scans.push({ viewport: viewport.name, ...scan, passed: true });
};

const performMapInteraction = async (page, viewport) => {
  await bootAt(page, "map_mode01_003", { readStepIds: ["map_mode01_001", "map_mode01_002"] });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await page.evaluate(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_004")) break;
    await page.locator("#novel-dialogue").click({ position: { x: 30, y: 30 } });
    await page.waitForTimeout(90);
  }
  await page.waitForFunction(() => (
    globalThis.GaiaNovel.getState().stepId === "map_mode01_004"
    && document.body.dataset.novelInteractionState === "open"
    && document.querySelector("#japan-layer")?.hidden === false
  ), null, { timeout: 15_000 });
  const open = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const guide = document.querySelector(".story-map-guide");
    const input = document.querySelector("#japan-layer [data-signal-time]");
    const signalConsole = document.querySelector("#japan-layer .signal-console-map");
    const dock = document.querySelector("#japan-layer .story-detour-dock");
    const returnButton = document.querySelector("#story-detour-return");
    const signalConsoleRect = signalConsole?.getBoundingClientRect();
    const guideRect = guide?.getBoundingClientRect();
    const dockRect = dock?.getBoundingClientRect();
    const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    return {
      stepId: globalThis.GaiaNovel.getState().stepId,
      guideStage: guide?.dataset.stage,
      guideText: guide?.innerText || "",
      inputVisible: isVisible(input),
      inputDisabled: input?.disabled,
      signalConsoleVisible: isVisible(signalConsole),
      signalConsoleRect: signalConsoleRect?.toJSON(),
      signalConsoleOverlapsGuide: overlaps(signalConsoleRect, guideRect),
      signalConsoleOverlapsDock: overlaps(signalConsoleRect, dockRect),
      returnText: returnButton?.textContent || "",
      returnEnabled: !returnButton?.disabled,
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
  assert.deepEqual({ stepId: open.stepId, guideStage: open.guideStage, inputVisible: open.inputVisible, inputDisabled: open.inputDisabled, returnEnabled: open.returnEnabled, overflowX: open.overflowX }, {
    stepId: "map_mode01_004", guideStage: "1", inputVisible: true, inputDisabled: false, returnEnabled: false, overflowX: 0,
  });
  assert.match(open.guideText, /年代を動かす[\s\S]*地図を押す[\s\S]*物語へ戻る/u);
  assert.equal(open.returnText, "操作を保存して物語へ戻る");
  assert.equal(open.signalConsoleVisible, true, `${viewport.name}: MAP slider console is hidden`);
  assert(open.signalConsoleRect.left >= 0 && open.signalConsoleRect.left <= 25, `${viewport.name}: MAP slider console is not left-aligned`);
  assert(open.signalConsoleRect.top >= 0 && open.signalConsoleRect.top <= 100, `${viewport.name}: MAP slider console is not at the top: ${JSON.stringify(open.signalConsoleRect)}`);
  assert.equal(open.signalConsoleOverlapsGuide, false, `${viewport.name}: MAP slider console overlaps the guide`);
  assert.equal(open.signalConsoleOverlapsDock, false, `${viewport.name}: MAP slider console overlaps the return dock`);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-map-stage-1.png`), animations: "disabled" });

  const timeInput = page.locator("#japan-layer [data-signal-time]").first();
  const before = Number(await timeInput.inputValue());
  const inputBox = await timeInput.boundingBox();
  assert(inputBox && inputBox.width >= 40 && inputBox.height >= 10, `${viewport.name}: MAP slider has no real pointer target`);
  const ratio = before > 50 ? 0.2 : 0.8;
  await page.mouse.move(inputBox.x + inputBox.width * (1 - ratio), inputBox.y + inputBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(inputBox.x + inputBox.width * ratio, inputBox.y + inputBox.height / 2, { steps: 8 });
  await page.mouse.up();
  const afterPointer = Number(await timeInput.inputValue());
  assert.notEqual(afterPointer, before, `${viewport.name}: MAP slider did not change from real pointer input`);
  await page.waitForFunction(() => document.querySelector(".story-map-guide")?.dataset.stage === "2");
  await timeInput.focus();
  await timeInput.press("ArrowRight");
  const afterKeyboard = Number(await timeInput.inputValue());
  assert.notEqual(afterKeyboard, afterPointer, `${viewport.name}: MAP slider did not change from keyboard input`);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-map-stage-2.png`), animations: "disabled" });

  const map = page.locator("#japan-map");
  const mapBox = await map.boundingBox();
  assert(mapBox && mapBox.width > 100 && mapBox.height > 100, `${viewport.name}: MAP surface has no real pointer target`);
  const point = { x: mapBox.x + mapBox.width * 0.52, y: mapBox.y + mapBox.height * 0.5 };
  assert.equal(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest?.("#japan-map")), point), true);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => document.querySelector(".story-map-guide")?.dataset.stage === "3");
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-map-stage-3.png`), animations: "disabled" });
  await page.locator("#story-detour-return").click();
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_005");
  const closed = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    return {
      stepId: globalThis.GaiaNovel.getState().stepId,
      lifecycle: document.body.dataset.novelInteractionState || "idle",
      mapVisible: isVisible(document.querySelector("#japan-layer")),
      guideCount: document.querySelectorAll(".story-map-guide").length,
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
  assert.deepEqual(closed, { stepId: "map_mode01_005", lifecycle: "idle", mapVisible: false, guideCount: 0, overflowX: 0 });
  report.mapInteractions.push({ viewport: viewport.name, open, before, afterPointer, afterKeyboard, closed, passed: true });
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    for (const stepId of expectedText.keys()) {
      const page = await context.newPage();
      attachDiagnostics(page, `${viewport.name}-${stepId}`);
      await scanStep(page, viewport, stepId);
      await page.close();
    }
    await context.close();
  }
  assert.equal(report.scans.length, expectedText.size * viewports.length);
  assert.equal(report.mapInteractions.length, 0);
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

console.log(`LOG comment fixes browser check passed: ${report.scans.length} step scans, ${report.mapInteractions.length} MAP interactions`);

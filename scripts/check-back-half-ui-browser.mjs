import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrlArgument] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument || "artifacts/back-half-ui-browser");
const routeUrl = new URL("/story", baseUrlArgument || "http://127.0.0.1:4298").href;
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
const report = { status: "running", viewports: [], consoleErrors: [], pageErrors: [], responses404: [] };
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const prepareRuntime = async (page) => {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => {
    globalThis.GaiaNovel.open();
    const layer = document.querySelector("#novel-layer");
    document.querySelector("#novel-title-screen").hidden = true;
    document.querySelector("#novel-runtime").hidden = false;
    const dialogue = document.querySelector("#novel-dialogue");
    dialogue.hidden = false;
    document.querySelector("#novel-speaker").textContent = "";
    document.querySelector("#novel-text").textContent = "運営端末に公式通知が届く。";
    layer.dataset.stepType = "dialogue";
    layer.classList.remove("is-title", "is-slack", "is-reflection", "is-result");
  });
};

const phoneMetrics = (page) => page.evaluate(() => {
  const overlaps = (first, second) => Math.min(first.right, second.right) > Math.max(first.left, second.left)
    && Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top);
  const bounds = (node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
  };
  const frame = document.querySelector(".novel-operations-phone");
  const dialogue = document.querySelector("#novel-dialogue");
  const nav = [...document.querySelectorAll(".novel-topbar nav button")].filter((button) => getComputedStyle(button).display !== "none");
  const frameRect = bounds(frame);
  const dialogueRect = bounds(dialogue);
  const visibleViews = [...document.querySelectorAll(".novel-operations-phone-view")].filter((view) => getComputedStyle(view).visibility === "visible");
  return {
    frameCount: document.querySelectorAll(".novel-operations-phone").length,
    frame: frameRect,
    dialogue: dialogueRect,
    visibleViews: visibleViews.map((view) => view.className),
    visibleText: visibleViews.map((view) => view.innerText).join("\n"),
    sender: document.querySelector("#novel-operations-phone-notice-sender")?.textContent?.trim() || "",
    noticeBody: document.querySelector("#novel-operations-phone-notice-body")?.textContent?.trim() || "",
    intersectsDialogue: overlaps(frameRect, dialogueRect),
    intersectsNav: nav.some((button) => overlaps(frameRect, bounds(button))),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    fitsViewport: frameRect.left >= 0 && frameRect.right <= innerWidth && frameRect.top >= 0 && frameRect.bottom <= innerHeight,
  };
});

try {
  for (const viewport of [{ name: "pc-1440", width: 1440, height: 900 }, { name: "mobile-390", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "no-preference" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await prepareRuntime(page);

    await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      const surface = document.querySelector("#novel-operations-phone-surface");
      globalThis.__operationsPhoneSurface = surface;
      globalThis.__operationsPhoneFrame = surface.querySelector(".novel-operations-phone");
      surface.hidden = false;
      layer.dataset.storyDevice = "portrait-operations-phone";
      layer.dataset.storyDevicePhase = "prepare";
      layer.classList.add("is-cast-suppressed");
    });
    const prepare = await phoneMetrics(page);
    assert(prepare.frameCount === 1 && prepare.visibleViews.length === 1 && prepare.visibleViews[0].includes("is-prepare"), `${viewport.name}: prepare view failed: ${JSON.stringify(prepare)}`);
    assert(prepare.visibleText.includes("運営端末") && prepare.visibleText.includes("連絡を確認中") && !prepare.visibleText.includes("連絡を確認しています") && !/OPERATIONS DEVICE|INCOMING AUDIO/u.test(prepare.visibleText), `${viewport.name}: prepare copy is incorrect: ${prepare.visibleText}`);
    assert(prepare.fitsViewport && !prepare.horizontalOverflow && !prepare.intersectsDialogue && !prepare.intersectsNav, `${viewport.name}: prepare geometry failed: ${JSON.stringify(prepare)}`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-prepare.png`), animations: "disabled" });

    await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      layer.dataset.storyDevicePhase = "official-notice";
      document.querySelector("#novel-operations-phone-clock").textContent = "15:52";
      document.querySelector("#novel-operations-phone-notice-time").textContent = "15:52";
      document.querySelector("#novel-operations-phone-notice-sender").textContent = "大学学生支援窓口";
      document.querySelector("#novel-operations-phone-notice-body").textContent = "本人の安全を確認しました。本人の同意により、中央入口で二人と話したい旨をお伝えします。";
    });
    await page.waitForTimeout(220);
    const notice = await phoneMetrics(page);
    assert(notice.frameCount === 1 && notice.visibleViews.length === 1 && notice.visibleViews[0].includes("is-notice"), `${viewport.name}: official notice view failed: ${JSON.stringify(notice)}`);
    assert(notice.sender === "大学学生支援窓口" && notice.sender !== "学園祭運営", `${viewport.name}: official sender is incorrect: ${notice.sender}`);
    assert(notice.noticeBody.includes("本人の安全を確認") && notice.noticeBody.includes("本人の同意") && notice.noticeBody.includes("中央入口") && !notice.noticeBody.includes("展示を一時休止"), `${viewport.name}: official notice context is incorrect: ${notice.noticeBody}`);
    assert(!/OPERATIONS DEVICE|INCOMING AUDIO/u.test(notice.visibleText), `${viewport.name}: untranslated phone label remains: ${notice.visibleText}`);
    assert(notice.fitsViewport && !notice.horizontalOverflow && !notice.intersectsDialogue && !notice.intersectsNav, `${viewport.name}: operations phone geometry failed: ${JSON.stringify(notice)}`);
    assert(JSON.stringify(prepare.frame) === JSON.stringify(notice.frame), `${viewport.name}: phone frame moved from prepare to notice`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-official-notice.png`), animations: "disabled" });

    await page.evaluate(() => {
      document.querySelector("#novel-layer").dataset.storyDevicePhase = "incoming-audio";
      document.querySelector("#novel-operations-phone-clock").textContent = "15:54";
      document.querySelector("#novel-operations-phone-audio-status").textContent = "接続中";
    });
    await page.waitForTimeout(220);
    const audio = await phoneMetrics(page);
    const identity = await page.evaluate(() => globalThis.__operationsPhoneSurface === document.querySelector("#novel-operations-phone-surface")
      && globalThis.__operationsPhoneFrame === document.querySelector(".novel-operations-phone"));
    assert(identity && audio.frameCount === 1 && audio.visibleViews.length === 1 && audio.visibleViews[0].includes("is-audio"), `${viewport.name}: phone surface was replaced between phases`);
    assert(audio.visibleText.includes("音声着信") && !/OPERATIONS DEVICE|INCOMING AUDIO/u.test(audio.visibleText), `${viewport.name}: incoming audio label is incorrect: ${audio.visibleText}`);
    assert(JSON.stringify(notice.frame) === JSON.stringify(audio.frame), `${viewport.name}: phone frame moved between phases: ${JSON.stringify({ notice: notice.frame, audio: audio.frame })}`);
    assert(!audio.horizontalOverflow && !audio.intersectsDialogue && !audio.intersectsNav, `${viewport.name}: incoming audio geometry failed`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-incoming-audio.png`), animations: "disabled" });

    await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      document.querySelector("#novel-operations-phone-surface").hidden = true;
      delete layer.dataset.storyDevice;
      delete layer.dataset.storyDevicePhase;
      layer.style.setProperty("--novel-scene-background", 'url("./assets/visuals-07/novel-bg-coastal-venue-v2.png")');
      layer.classList.remove("is-central-entrance-distance");
      layer.classList.add("is-cast-suppressed");
      document.querySelector("#novel-cast").dataset.speaker = "sakuya";
      document.querySelector("#novel-speaker").textContent = "サクヤ";
      document.querySelector("#novel-text").textContent = "中央入口で、数歩の距離を保って話している。";
    });
    const unseen = await page.evaluate(() => {
      const cast = document.querySelector("#novel-cast");
      const sakuya = document.querySelector("#novel-character-sakuya");
      return { castVisibility: getComputedStyle(cast).visibility, castOpacity: getComputedStyle(cast).opacity, sakuyaOpacity: getComputedStyle(sakuya).opacity };
    });
    assert(unseen.castVisibility === "hidden" && Number(unseen.castOpacity) === 0, `${viewport.name}: Sakuya is visible at return_to_start_020`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-return-020-unseen.png`), animations: "disabled" });

    await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      globalThis.__centralEntranceCast = document.querySelector("#novel-cast");
      layer.classList.remove("is-cast-suppressed");
      layer.classList.add("is-central-entrance-distance");
    });
    const distance = await page.evaluate(() => {
      const overlaps = (first, second) => Math.min(first.right, second.right) > Math.max(first.left, second.left)
        && Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top);
      const bounds = (node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const sakuya = document.querySelector("#novel-character-sakuya");
      const dialogue = document.querySelector("#novel-dialogue");
      const otherCharacters = [...document.querySelectorAll(".novel-character:not(.novel-character--sakuya)")];
      const sakuyaRect = bounds(sakuya);
      const dialogueRect = bounds(dialogue);
      return {
        sameCastNode: globalThis.__centralEntranceCast === document.querySelector("#novel-cast"),
        sakuya: sakuyaRect,
        dialogue: dialogueRect,
        sakuyaVisible: getComputedStyle(sakuya).visibility === "visible" && Number(getComputedStyle(sakuya).opacity) > 0.8,
        otherCharactersHidden: otherCharacters.every((character) => getComputedStyle(character).visibility === "hidden" && Number(getComputedStyle(character).opacity) === 0),
        intersectsDialogue: overlaps(sakuyaRect, dialogueRect),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        centerRatio: (sakuyaRect.left + sakuyaRect.right) / 2 / innerWidth,
        widthRatio: sakuyaRect.width / innerWidth,
      };
    });
    assert(distance.sameCastNode && distance.sakuyaVisible && distance.otherCharactersHidden, `${viewport.name}: return_to_start_020→021 cast gate failed: ${JSON.stringify(distance)}`);
    assert(!distance.intersectsDialogue && !distance.horizontalOverflow && distance.centerRatio > 0.55 && distance.widthRatio < 0.6, `${viewport.name}: central entrance distance preset failed: ${JSON.stringify(distance)}`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-return-021-distance.png`), animations: "disabled" });

    report.viewports.push({ ...viewport, prepare, notice, audio, identity, unseen, distance, passed: true });
    await context.close();
  }
  assert(report.consoleErrors.length === 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert(report.pageErrors.length === 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert(report.responses404.length === 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
} finally {
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`back-half UI browser check passed: ${report.viewports.length} viewports`);

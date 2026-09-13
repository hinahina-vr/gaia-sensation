import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4399"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs")) ? path.join(moduleRoot, "index.mjs") : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/current-ui-hotfix-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-2048", width: 2048, height: 1030 },
  { name: "pc-1920", width: 1920, height: 1000 },
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
];
const report = { status: "running", viewports, scans: [], consoleErrors: [], pageErrors: [], responses404: [], expectedMediaErrors: [] };
const browser = await chromium.launch({ headless: true, executablePath });
const stateFor = (stepId, extra = {}) => ({
  storyVersion: 10, stepId, reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null,
  editorialChoice: null, reflectionIds: [], resultTone: null, demoInterest: "気候の長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0.3 },
  readStepIds: [], clear: false, archivesUnlocked: false, sessionId: `ui-hotfix-${stepId}`, ...extra,
});
const visible = `(element) => {
  if (!element || element.hidden) return false;
  const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
}`;

const createPage = async (viewport, label, options = {}) => {
  const context = await browser.newContext({ viewport, hasTouch: Boolean(viewport.mobile), isMobile: Boolean(viewport.mobile), reducedMotion: options.reducedMotion || "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
    if (response.status() >= 400 && /\.(mp3|ogg|wav)(?:\?|$)/iu.test(response.url())) report.expectedMediaErrors.push(`${label}: ${response.status()} ${response.url()}`);
  });
  await page.addInitScript((visibleSource) => { globalThis.__uiVisible = eval(visibleSource); }, visible);
  return { context, page };
};

const bootAt = async (page, stepId, extra = {}) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([
      { progress: candidate, savedAt: Date.now(), meta: { title: "Current UI QA", excerpt: candidate.stepId } },
    ]));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
  }, stateFor(stepId, extra));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  const savePanel = page.locator("#novel-save-panel");
  if (await savePanel.isVisible()) await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForTimeout(180);
};

const screenshot = async (page, name) => page.screenshot({ path: path.join(outputDir, `${name}.png`) });
const contrastRatio = (a, b) => {
  const lum = (rgb) => rgb.map((v) => v / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05);
};
const composite = (fg, alpha, bg) => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)));

const scanBackground = async (viewport, stepId, shot = false) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-${stepId}`);
  await bootAt(page, stepId);
  const samples = [];
  for (const wait of [0, 500, 2500]) {
    if (wait) await page.waitForTimeout(wait - samples.at(-1).elapsed);
    const sample = await page.evaluate((elapsed) => {
      const layer = document.querySelector("#novel-layer"); const style = getComputedStyle(layer); const rect = layer.getBoundingClientRect();
      const source = /url\(["']?([^"')]+)/u.exec(style.backgroundImage)?.[1] || "";
      return { elapsed, stepId: layer.dataset.stepId, cueId: layer.dataset.backgroundCue, source, backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize, backgroundPosition: style.backgroundPosition, transform: style.transform,
        animationName: style.animationName, rect: rect.toJSON(), overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        openingVisible: __uiVisible(document.querySelector("#gaia-opening")), openingHidden: document.querySelector("#gaia-opening")?.hidden,
        novelVisibleCount: [...document.querySelectorAll("#novel-layer")].filter(__uiVisible).length,
      };
    }, wait);
    samples.push(sample);
  }
  assert(samples.every((s) => s.backgroundSize.split(",").every((v) => v.trim() === "cover")));
  assert(samples.every((s) => s.backgroundPosition === samples[0].backgroundPosition && s.transform === "none" && s.animationName === "none"));
  assert(samples.every((s) => s.rect.left === 0 && s.rect.top === 0 && Math.abs(s.rect.width - viewport.width) <= 1 && Math.abs(s.rect.height - viewport.height) <= 1));
  assert(samples.every((s) => !s.overflowX && !s.openingVisible && s.openingHidden && s.novelVisibleCount === 1));
  if (/festival_concept_00[1-7]/u.test(stepId)) assert(samples.every((s) => /novel-bg-convention-hall-entrance-autumn-morning-v2\.png/u.test(s.backgroundImage)));
  const asset = await page.evaluate(async () => {
    const url = /url\(["']?([^"')]+)/u.exec(getComputedStyle(document.querySelector("#novel-layer")).backgroundImage)?.[1];
    const image = new Image(); image.src = url; await image.decode(); return { url, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
  });
  assert(asset.naturalWidth > 0 && asset.naturalHeight > 0);
  const metadata = await page.evaluate(() => {
    const element = document.querySelector(".novel-signal-caption"); const style = getComputedStyle(element);
    return { visible: __uiVisible(element), text: element.textContent.trim(), color: style.color, background: style.backgroundImage, rect: element.getBoundingClientRect().toJSON() };
  });
  const worstScrim = composite([2, 13, 34], 0.88, [255, 255, 255]);
  const effectiveText = composite([244, 251, 255], 0.98, worstScrim);
  metadata.contrastWorstCase = contrastRatio(effectiveText, worstScrim);
  assert(metadata.visible && metadata.contrastWorstCase >= 4.5);
  assert(metadata.rect.left >= 0 && metadata.rect.right <= viewport.width && metadata.rect.top >= 0 && metadata.rect.bottom <= viewport.height);
  if (shot) await screenshot(page, `${viewport.name}-${stepId}`);
  report.scans.push({ viewport: viewport.name, case: `background-${stepId}`, samples, asset, metadata, passed: true });
  await context.close();
};

const scanChromeAndNames = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-chrome-names`);
  await bootAt(page, "festival_concept_032");
  const base = await page.evaluate(() => ({
    speaker: document.querySelector("#novel-speaker")?.textContent, oldCampusNameCount: document.body.innerText.split("あまあま").length - 1,
    formalNameEarlyCount: ["雨音", "瑞葉", "咲弥"].reduce((n, s) => n + (document.body.innerText.split(s).length - 1), 0),
    evesVisible: __uiVisible(document.querySelector("#novel-eves-button")), evesTab: document.querySelector("#novel-eves-button")?.tabIndex,
    evesPanelVisible: __uiVisible(document.querySelector("#novel-eves-panel")), footerLocationVisible: __uiVisible(document.querySelector(".novel-footer-location")),
    footerHintDomCount: [...document.querySelectorAll(".novel-footer span")].filter((e) => e.textContent.includes("CLICK")).length,
  }));
  assert.deepEqual(base, { speaker: "あめ", oldCampusNameCount: 0, formalNameEarlyCount: 0, evesVisible: false, evesTab: -1, evesPanelVisible: false, footerLocationVisible: false, footerHintDomCount: 1 });
  await bootAt(page, "festival_concept_021"); assert.equal(await page.locator("#novel-speaker").textContent(), "短髪の女性");
  await bootAt(page, "festival_concept_023"); assert.equal(await page.locator("#novel-speaker").textContent(), "長髪の女性");
  await bootAt(page, "festival_concept_032"); await page.locator("#novel-log-button").click();
  const log = await page.locator("#novel-log-content").innerText(); assert(log.includes("あめ") && !log.includes("あまあま") && !/[雨瑞咲][音葉弥]/u.test(log));
  await screenshot(page, `${viewport.name}-name-log`);
  report.scans.push({ viewport: viewport.name, case: "chrome-name-boundaries", base, logHasCampusName: true, passed: true });
  await context.close();
};

const scanChat = async (viewport, stepId, shot = false) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-chat-${stepId}`);
  await bootAt(page, stepId);
  const scan = await page.evaluate(() => {
    const posts = [...document.querySelectorAll(".novel-slack-post")];
    const typing = document.querySelector(".novel-slack-typing");
    const symbols = [...document.querySelectorAll(".novel-slack-post .novel-slack-avatar, .novel-slack-typing .novel-slack-avatar")];
    const mapping = Object.fromEntries([...posts, ...(typing ? [typing] : [])].map((node) => [node.dataset.speaker, node.querySelector(".novel-slack-avatar")?.dataset.symbol]));
    return { speaker: document.querySelector("#novel-speaker")?.textContent, oldNameCount: document.body.innerText.split("あまあま").length - 1,
      symbolCount: symbols.length, symbolVisibleCount: symbols.filter(__uiVisible).length,
      humanAvatarCount: document.querySelectorAll(".novel-slack-avatar[data-human-avatar], .novel-slack-avatar img[src*='/characters/']").length,
      mapping, images: symbols.flatMap((s) => [...s.querySelectorAll("img")].map((i) => ({ src: i.currentSrc, complete: i.complete, naturalWidth: i.naturalWidth }))),
      currentVisible: __uiVisible(document.querySelector(".novel-slack-post.is-new")), typingVisible: __uiVisible(typing),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1, overflowY: document.documentElement.scrollHeight > innerHeight + 1 };
  });
  assert(scan.symbolCount > 0 && scan.symbolVisibleCount === scan.symbolCount && scan.humanAvatarCount === 0 && scan.images.every((i) => i.complete && i.naturalWidth > 0));
  assert.equal(scan.oldNameCount, 0); assert.equal(scan.currentVisible, true); assert.equal(scan.overflowX, false); assert.equal(scan.overflowY, false);
  const expected = { amane: "cloud", mizuha: "water", sakuya: "flower", visitor: "green-apple", bluecat: "green-apple", system: "system" };
  for (const [speaker, symbol] of Object.entries(scan.mapping)) assert.equal(symbol, expected[speaker] || "system");
  if (shot) await screenshot(page, `${viewport.name}-chat-${stepId}`);
  report.scans.push({ viewport: viewport.name, case: `chat-symbol-${stepId}`, ...scan, passed: true });
  await context.close();
};

const scanSaveAndGallery = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-save-gallery`);
  await bootAt(page, "festival_concept_032");
  await page.locator("#novel-save-button").click();
  const scroll = await page.evaluate(() => { const slots = document.querySelector("#novel-save-slots"); const style = getComputedStyle(slots); return { scrollbarWidth: style.scrollbarWidth, gutter: style.scrollbarGutter, scrollHeight: slots.scrollHeight, clientHeight: slots.clientHeight, clientWidth: slots.clientWidth, offsetWidth: slots.offsetWidth }; });
  assert.equal(scroll.scrollbarWidth, "none"); assert.equal(scroll.gutter, "auto"); assert(scroll.scrollHeight > scroll.clientHeight);
  const slotsBox = await page.locator("#novel-save-slots").boundingBox();
  await page.mouse.move(slotsBox.x + slotsBox.width - 6, slotsBox.y + slotsBox.height / 2); await page.mouse.wheel(0, 1600); await page.waitForTimeout(120);
  const wheelScroll = await page.evaluate(() => ({ slots: document.querySelector("#novel-save-slots").scrollTop, panel: document.querySelector("#novel-save-panel").scrollTop }));
  assert(wheelScroll.slots + wheelScroll.panel > 0);
  await page.locator("#novel-save-slots").focus(); await page.locator("#novel-save-slots").press("Home");
  await page.evaluate(() => { document.querySelector("#novel-save-slots").scrollTop = 0; document.querySelector("#novel-save-panel").scrollTop = 0; });
  assert.equal(await page.locator("#novel-save-slots").evaluate((e) => e.scrollTop), 0);
  const slot = page.locator(".novel-save-slot").first(); const box = await slot.boundingBox();
  const points = [{ x: 4, y: 4 }, { x: box.width / 2, y: box.height / 2 }, { x: box.width - 4, y: box.height - 4 }];
  for (let index = 0; index < points.length; index += 1) {
    await page.evaluate((i) => { const slots = JSON.parse(localStorage.getItem("gaiaSensewareNovel:manual-saves") || "[]"); slots[i] = null; localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify(slots)); }, index);
    if (index) { await page.locator("#novel-save-close").click(); await page.locator("#novel-save-button").click(); }
    await page.locator(".novel-save-slot").nth(index).click({ position: points[index] });
    const saved = await page.evaluate((i) => Boolean(JSON.parse(localStorage.getItem("gaiaSensewareNovel:manual-saves") || "[]")[i]), index); assert.equal(saved, true);
  }
  await page.locator("#novel-save-close").click(); await page.locator("#novel-save-button").click();
  const fourth = page.locator(".novel-save-slot").nth(3); await fourth.focus(); await fourth.press("Enter");
  assert.equal(await page.evaluate(() => Boolean(JSON.parse(localStorage.getItem("gaiaSensewareNovel:manual-saves") || "[]")[3])), true);
  const runtimeGalleryDomCount = await page.locator("#novel-gallery-button,#novel-gallery-count").count();
  assert.equal(runtimeGalleryDomCount, 0);
  await screenshot(page, `${viewport.name}-save-keyboard`);
  report.scans.push({ viewport: viewport.name, case: "save-runtime-gallery-absent", scroll, runtimeGalleryDomCount, passed: true });
  await context.close();
};

const scanLegacySave = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-legacy-save`);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => {
    localStorage.removeItem("gaiaSensewareNovel:progress");
    localStorage.setItem("gaia_novel_save_v6", JSON.stringify({ storyVersion: 9, stepId: "unknown_legacy_step", evesRoute: [{ decisionId: "editorial_choice", optionId: "legacy" }], audio: { muted: false, volume: 0.42 }, unknownLegacyField: "preserved" }));
  });
  await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForFunction(() => Boolean(globalThis.GaiaNovel)); await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click(); await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "festival_concept_001");
  const restored = await page.evaluate(() => { const s = globalThis.GaiaNovel.getState(); return { stepId: s.stepId, audio: s.audio, unknownLegacyField: s.unknownLegacyField, evesRoute: s.evesRoute, amaneInternalSteps: globalThis.GAIA_NOVEL_STORY.scenes.flatMap((scene) => scene.steps).filter((step) => step.speaker === "amane").length, bodyOldName: document.body.innerText.includes("あまあま") }; });
  assert.equal(restored.stepId, "festival_concept_001"); assert.equal(restored.unknownLegacyField, "preserved"); assert.equal(restored.evesRoute.length, 0); assert(restored.amaneInternalSteps > 0); assert.equal(restored.bodyOldName, false);
  report.scans.push({ viewport: viewport.name, case: "legacy-save", restored, passed: true }); await context.close();
};

const scanAutosaveResume = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-autosave-resume`);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.removeItem("gaiaSensewareNovel:manual-saves");
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, stateFor("welcome_chat_038", { unknownAutosaveField: "preserved" }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "welcome_chat_038");
  const restored = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    unknownAutosaveField: globalThis.GaiaNovel.getState().unknownAutosaveField,
    runtimeHidden: document.querySelector("#novel-runtime")?.hidden,
    titleHidden: document.querySelector("#novel-title-screen")?.hidden,
    loadPanelHidden: document.querySelector("#novel-save-panel")?.hidden,
  }));
  assert.deepEqual(restored, {
    stepId: "welcome_chat_038",
    unknownAutosaveField: "preserved",
    runtimeHidden: false,
    titleHidden: true,
    loadPanelHidden: true,
  });
  report.scans.push({ viewport: viewport.name, case: "autosave-resume", restored, passed: true });
  await context.close();
};

const scanTitleAndOpening = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-title`, { reducedMotion: "reduce" });
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => { localStorage.removeItem("gaiaSensewareNovel:progress"); globalThis.GaiaNovel.open(); });
  const title = await page.evaluate(() => ({ text: document.querySelector("#novel-start-button")?.textContent.trim(), aria: document.querySelector("#novel-start-button")?.getAttribute("aria-label"), oldStartVisible: [...document.querySelectorAll("button")].filter((e) => e.textContent.trim() === "START" && __uiVisible(e)).length }));
  assert.deepEqual(title, { text: "はじめる", aria: "はじめる", oldStartVisible: 0 });
  await screenshot(page, `${viewport.name}-title-hajimeru`); await page.locator("#novel-start-button").press("Enter");
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "festival_concept_001");
  const isolation = await page.evaluate(() => ({ openingVisible: __uiVisible(document.querySelector("#gaia-opening")), openingHidden: document.querySelector("#gaia-opening")?.hidden, openingInert: document.querySelector("#gaia-opening")?.inert,
    baseVisible: [...document.querySelectorAll("#gaia-canvas,#intro-layer,.masthead,.status,#guide,#mode-caption,.signal-console-main,.mode-nav,.actions")].filter(__uiVisible).length,
    baseFocusable: [...document.querySelectorAll("#gaia-opening *,#intro-layer *, .mode-nav *, .actions *")].filter((e) => !e.closest("#novel-layer") && e.matches("button,a,input,[tabindex]:not([tabindex='-1'])") && !e.closest("[inert]") && __uiVisible(e)).length,
    novelVisible: __uiVisible(document.querySelector("#novel-layer")), stepId: globalThis.GaiaNovel.getState().stepId }));
  assert.deepEqual(isolation, { openingVisible: false, openingHidden: true, openingInert: true, baseVisible: 0, baseFocusable: 0, novelVisible: true, stepId: "festival_concept_001" });
  await screenshot(page, `${viewport.name}-story-isolated`);
  report.scans.push({ viewport: viewport.name, case: "title-story-isolation", title, isolation, passed: true });
  await context.close();

  const root = await createPage(viewport, `${viewport.name}-sound`, { reducedMotion: "no-preference" });
  await root.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await root.page.waitForSelector("#gaia-opening-sound-modal #gaia-opening-sound-on", { state: "visible" });
  assert.equal(await root.page.evaluate(() => document.querySelector("#gaia-opening")?.classList.contains("is-active")), false);
  const soundStates = [];
  for (const selector of ["#gaia-opening-sound-on", "#gaia-opening-sound-off"]) {
    await root.page.locator(selector).focus();
    soundStates.push(await root.page.locator(selector).evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const icon = button.querySelector(".gaia-opening-sound-icon-shell")?.getBoundingClientRect();
      return { label: button.textContent.trim(), width: rect.width, height: rect.height, iconWidth: icon?.width, iconHeight: icon?.height };
    }));
  }
  assert(soundStates.every((s) => s.width >= 44 && s.height >= 44 && s.iconWidth >= 40 && s.iconHeight >= 40));
  assert.match(soundStates[0].label, /サウンドあり/u);
  assert.match(soundStates[1].label, /サウンドなし/u);
  await screenshot(root.page, `${viewport.name}-sound-focus`); await root.page.locator("#gaia-opening-sound-off").press("Space");
  await root.page.waitForFunction(() => document.querySelector("#gaia-opening")?.classList.contains("is-active"), null, { timeout: 10000 });
  report.scans.push({ viewport: viewport.name, case: "sound-choice", soundStates, passed: true }); await root.context.close();
};

try {
  for (const viewport of viewports) {
    for (const step of ["festival_concept_001", "festival_concept_002", "festival_concept_007", "festival_concept_008", "festival_concept_010", "festival_concept_015"]) await scanBackground(viewport, step, ["festival_concept_001", "festival_concept_002", "festival_concept_008"].includes(step));
    await scanTitleAndOpening(viewport);
    if (["pc-1440", "mobile-390"].includes(viewport.name)) {
      await scanChromeAndNames(viewport);
      for (const step of ["welcome_chat_004", "welcome_chat_011", "welcome_chat_024", "welcome_chat_083"]) await scanChat(viewport, step, true);
      await scanSaveAndGallery(viewport);
      await scanLegacySave(viewport);
      await scanAutosaveResume(viewport);
    }
  }
  assert.equal(report.consoleErrors.length, 0); assert.equal(report.pageErrors.length, 0); assert.equal(report.responses404.length, 0); report.status = "passed";
} catch (error) { report.status = "failed"; report.error = error.stack || String(error); throw error; }
finally { fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`); await browser.close(); }
console.log(`current UI hotfix browser check passed: ${report.scans.length} scans`);

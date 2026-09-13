import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "https://gaia-senseware.pages.dev/"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/mobile-layout-audit");
fs.mkdirSync(outputDir, { recursive: true });
const auditScope = process.env.GAIA_MOBILE_AUDIT_SCOPE || "all";

const viewports = [
  { name: "mobile-320x568", width: 320, height: 568 },
  { name: "mobile-360x800", width: 360, height: 800 },
  { name: "mobile-375x667", width: 375, height: 667 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "pixel-11-412x924-dpr2.625", width: 412, height: 924, deviceScaleFactor: 2.625 },
  { name: "mobile-430x932", width: 430, height: 932 },
];
const viewportFilter = new Set(String(process.env.GAIA_MOBILE_AUDIT_VIEWPORTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean));
const selectedViewports = viewportFilter.size
  ? viewports.filter((viewport) => viewportFilter.has(viewport.name))
  : viewports;
if (!selectedViewports.length) throw new Error(`No mobile audit viewport matched: ${[...viewportFilter].join(", ")}`);
const dialogueCases = [
  { name: "b-hall-crowd", stepId: "festival_concept_008" },
  { name: "earth-installation", stepId: "festival_concept_011" },
  { name: "first-meeting", stepId: "festival_concept_016" },
  { name: "projector", stepId: "festival_concept_032" },
  { name: "continue-feeling", stepId: "festival_concept_047" },
  { name: "gx-explanation", stepId: "gx_experience_010" },
  { name: "sensor-explanation", stepId: "esp32_pitch_015" },
];
const report = {
  status: "running",
  baseUrl,
  auditScope,
  viewports: selectedViewports,
  screenshots: [],
  scans: [],
  issues: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--no-first-run", "--disable-background-networking"],
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (value.includes("status of 401")) return;
    report.consoleErrors.push(`${label}: ${value}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
};

const makePage = async (viewport, label, init = null, initArgument = undefined) => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000);
  page.setDefaultTimeout(45_000);
  attachDiagnostics(page, label);
  if (init) await page.addInitScript(init, initArgument);
  return { context, page };
};

const saveScreenshot = async (page, viewport, surface, { fullPage = false } = {}) => {
  const file = path.join(outputDir, `${viewport.name}-${surface}.png`);
  await page.screenshot({ path: file, animations: "disabled", fullPage });
  report.screenshots.push({ viewport: viewport.name, surface, file });
  return file;
};

const addIssue = (viewport, surface, code, message, evidence = null) => {
  report.issues.push({ viewport: viewport.name, surface, code, message, evidence });
};

const inspectSurface = (page, selectors = []) => page.evaluate((targetSelectors) => {
  const visible = (node) => {
    if (!node || node.hidden || node.closest("[hidden]")) return false;
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0
      && box.width > 0 && box.height > 0;
  };
  const rect = (node) => node?.getBoundingClientRect().toJSON() || null;
  const withinViewport = (box) => Boolean(box
    && box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1);
  const controls = [...document.querySelectorAll("button, a[href], input, select, textarea")]
    .filter(visible)
    .map((node) => {
      const box = rect(node);
      return {
        label: node.getAttribute("aria-label") || node.textContent?.trim().replace(/\s+/gu, " ").slice(0, 80) || node.id || node.tagName,
        id: node.id || "",
        tag: node.tagName,
        box,
        withinViewport: withinViewport(box),
        hitSize: box.width >= 44 && box.height >= 44,
      };
    });
  return {
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    },
    controls,
    targets: targetSelectors.map((selector) => {
      const node = document.querySelector(selector);
      const box = rect(node);
      const style = node ? getComputedStyle(node) : null;
      return {
        selector,
        visible: visible(node),
        box,
        withinViewport: withinViewport(box),
        scrollWidth: node?.scrollWidth || 0,
        scrollHeight: node?.scrollHeight || 0,
        clientWidth: node?.clientWidth || 0,
        clientHeight: node?.clientHeight || 0,
        overflowX: style?.overflowX || "",
        overflowY: style?.overflowY || "",
        text: node?.textContent?.trim().replace(/\s+/gu, " ").slice(0, 300) || "",
      };
    }),
  };
}, selectors);

const collectRenderedLines = (page, selector) => page.evaluate((targetSelector) => {
  const target = document.querySelector(targetSelector);
  if (!target) return { text: "", lines: [], style: null, box: null };
  const groups = [];
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue) continue;
    let offset = 0;
    for (const glyph of Array.from(node.nodeValue)) {
      const nextOffset = offset + glyph.length;
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, nextOffset);
      const box = range.getBoundingClientRect();
      offset = nextOffset;
      if (!box.width || !box.height) continue;
      let line = groups.find((candidate) => Math.abs(candidate.top - box.top) < 2);
      if (!line) {
        line = { top: box.top, bottom: box.bottom, left: box.left, right: box.right, text: "" };
        groups.push(line);
      }
      line.text += glyph;
      line.left = Math.min(line.left, box.left);
      line.right = Math.max(line.right, box.right);
      line.bottom = Math.max(line.bottom, box.bottom);
    }
  }
  groups.sort((a, b) => a.top - b.top || a.left - b.left);
  const style = getComputedStyle(target);
  return {
    text: target.getAttribute("aria-label") || target.textContent || "",
    lines: groups.map((line) => ({ ...line, text: line.text.trim() })).filter((line) => line.text),
    style: { fontSize: style.fontSize, lineHeight: style.lineHeight, overflowX: style.overflowX, overflowY: style.overflowY },
    box: target.getBoundingClientRect().toJSON(),
    scrollWidth: target.scrollWidth,
    scrollHeight: target.scrollHeight,
    clientWidth: target.clientWidth,
    clientHeight: target.clientHeight,
  };
}, selector);

const reviewCommon = (viewport, surface, scan, { allowDocumentY = false, allowOffscreenControls = false } = {}) => {
  if (scan.document.overflowX > 1) addIssue(viewport, surface, "document-overflow-x", "ページ全体に横スクロールが発生", scan.document);
  if (!allowDocumentY && scan.document.overflowY > 1) addIssue(viewport, surface, "document-overflow-y", "固定画面でページ全体に縦スクロールが発生", scan.document);
  const escaped = scan.controls.filter((control) => !control.withinViewport);
  if (!allowOffscreenControls && escaped.length) addIssue(viewport, surface, "control-outside-viewport", "操作要素が表示領域からはみ出している", escaped);
};

const scanOpening = async (viewport) => {
  const label = `${viewport.name}-opening`;
  const { context, page } = await makePage(viewport, label, () => {
    localStorage.clear();
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(document.querySelector("#gaia-opening")));
  await page.waitForTimeout(900);
  const scan = await inspectSurface(page, ["#gaia-opening", "#gaia-opening-sound-modal", "#gaia-opening-skip"]);
  await saveScreenshot(page, viewport, "opening");
  reviewCommon(viewport, "opening", scan);
  report.scans.push({ ...scan, viewport: viewport.name, surface: "opening" });
  await context.close();
};

const scanObservation = async (viewport) => {
  const label = `${viewport.name}-observation`;
  const { context, page } = await makePage(viewport, label, () => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#mode-list .mode-button").length === 9);
  await page.evaluate(() => {
    for (const selector of ["#gaia-opening", "#intro-layer"]) {
      const node = document.querySelector(selector);
      if (node) { node.hidden = true; node.inert = true; node.setAttribute("aria-hidden", "true"); }
    }
    document.body.classList.remove("gaia-opening-active", "opening-active", "intro-open");
  });
  await page.locator("#mode-list .mode-button").last().click();
  await page.waitForFunction(() => document.querySelector("#mode-number")?.textContent?.trim() === "10");
  const scan = await inspectSurface(page, ["#intro-button", ".actions", ".signal-console-main", "#mode-title", ".mode-reading-label", ".mode-description", "#mode-caption", "#mode-list"]);
  const titleLines = await collectRenderedLines(page, "#mode-title");
  await saveScreenshot(page, viewport, "observation-10");
  reviewCommon(viewport, "observation-10", scan);
  const modeList = scan.targets.find((target) => target.selector === "#mode-list");
  if (modeList && modeList.scrollHeight > modeList.clientHeight + 2) {
    addIssue(viewport, "observation-10", "mode-list-scroll", "展示選択UIの内部に縦スクロールが発生", modeList);
  }
  const signalConsole = scan.targets.find((target) => target.selector === ".signal-console-main");
  const observationActions = new Set(["space-button", "story-button", "japan-button", "auto-button", "source-button", "reset-button"]);
  const overlappingActions = signalConsole?.box ? scan.controls.filter((control) => observationActions.has(control.id)
    && control.box.left < signalConsole.box.right
    && control.box.right > signalConsole.box.left
    && control.box.top < signalConsole.box.bottom
    && control.box.bottom > signalConsole.box.top) : [];
  if (overlappingActions.length) {
    addIssue(viewport, "observation-10", "observation-control-overlap", "観測画面の操作ボタンがデータ表示に重なっている", { signalConsole, controls: overlappingActions });
  }
  const redundantObservationCopy = scan.targets.filter((target) => [".mode-reading-label", ".mode-description"].includes(target.selector) && target.visible);
  if (redundantObservationCopy.length) {
    addIssue(viewport, "observation-10", "observation-copy-density", "スマートフォン表示に重複する説明文が残っている", redundantObservationCopy);
  }
  report.scans.push({ ...scan, viewport: viewport.name, surface: "observation-10", titleLines });
  await context.close();
};

const prepareMainModePage = async (viewport, label) => {
  const { context, page } = await makePage(viewport, label, () => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await page.goto(new URL("/?mode=1#earth", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#mode-list .mode-button").length === 9);
  await page.evaluate(() => {
    for (const selector of ["#gaia-opening", "#intro-layer", "#novel-layer", "#true-end-layer"]) {
      const node = document.querySelector(selector);
      if (!node) continue;
      node.hidden = true;
      node.inert = true;
      node.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("gaia-opening-active", "opening-active", "intro-open");
    document.querySelector(".experience")?.classList.remove("intro-open");
    window.dispatchEvent(new CustomEvent("gaia:opening-complete"));
  });
  return { context, page };
};

const scanMapMode = async (viewport) => {
  const surface = "map-mode";
  const { context, page } = await prepareMainModePage(viewport, `${viewport.name}-${surface}`);
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
  await page.waitForFunction(() => document.querySelectorAll("#japan-mode-list .map-mode-button:not([data-live-exhibit])").length === 9);
  await page.waitForFunction(() => !document.body.classList.contains("scene-transitioning"));
  await page.waitForTimeout(220);
  let modeSelected = false;
  for (let attempt = 0; attempt < 3 && !modeSelected; attempt += 1) {
    await page.locator("#japan-mode-list .map-mode-button").first().click({ force: true });
    modeSelected = await page.waitForFunction(
      () => document.querySelector("#japan-mode-number")?.textContent?.trim() === "01",
      null,
      { timeout: 5000 },
    ).then(() => true, () => false);
    if (!modeSelected) await page.waitForTimeout(250);
  }
  if (!modeSelected) throw new Error("地図モード01への切り替えに失敗しました");
  await page.waitForFunction(() => {
    const overlay = document.querySelector("#japan-overlay");
    const basis = document.querySelector("#map-scope-note")?.textContent || "";
    const snapshot = document.querySelector(".signal-console-map [data-signal-value]")?.textContent || "";
    return overlay instanceof HTMLCanvasElement
      && overlay.width > 0
      && overlay.height > 0
      && Boolean(overlay.dataset.vectorWorldCopies)
      && basis.includes("LOCAL GEOJSON")
      && !snapshot.includes("LOADING");
  });
  await page.waitForTimeout(350);
  const scan = await inspectSurface(page, ["#japan-layer", "#japan-close", ".japan-heading", "#japan-title", "#japan-data-button", ".japan-story-button", "#japan-map", ".map-scope-switch", "#japan-mode-list", ".japan-credits"]);
  const mapRender = await page.locator("#japan-overlay").evaluate((overlay) => ({
    width: overlay.width,
    height: overlay.height,
    vectorWorldCopies: overlay.dataset.vectorWorldCopies || "",
    modeNumber: document.querySelector("#japan-mode-number")?.textContent?.trim() || "",
    basis: document.querySelector("#map-scope-note")?.textContent?.replace(/\s+/g, " ").trim() || "",
    snapshot: document.querySelector(".signal-console-map [data-signal-value]")?.textContent?.trim() || "",
    headingFont: getComputedStyle(document.querySelector("#japan-title")).fontFamily,
  }));
  await saveScreenshot(page, viewport, surface);
  reviewCommon(viewport, surface, scan);
  const modeList = scan.targets.find((target) => target.selector === "#japan-mode-list");
  if (modeList && modeList.scrollHeight > modeList.clientHeight + 2) {
    addIssue(viewport, surface, "map-mode-list-scroll", "地図モード切替UIに縦スクロールが発生", modeList);
  }
  if (mapRender.modeNumber !== "01" || !mapRender.vectorWorldCopies || !mapRender.basis.includes("LOCAL GEOJSON") || mapRender.snapshot.includes("LOADING")) {
    addIssue(viewport, surface, "map-not-rendered", "世界地図が描画済みの状態になっていない", mapRender);
  }
  if (!mapRender.headingFont.includes("Yu Mincho") || !mapRender.headingFont.includes("Noto Serif CJK JP")) {
    addIssue(viewport, surface, "map-font-stack", "地図見出しがPC基準の明朝フォールバックになっていない", mapRender);
  }
  report.scans.push({ ...scan, viewport: viewport.name, surface, mapRender });
  await context.close();
};

const scanSpaceMode = async (viewport) => {
  const surface = "space-mode";
  const { context, page } = await makePage(viewport, `${viewport.name}-${surface}`, () => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await page.goto(new URL("/?space=1&debug=1", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.classList.contains("space-mode-open") && !document.querySelector("#space-layer")?.hidden);
  await page.addStyleTag({ content: "#gaia-opening { display: none !important; }" });
  await page.locator("#space-canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelectorAll("#space-mode-list button").length === 10);
  await page.locator("#space-mode-list button").last().click({ force: true });
  await page.waitForFunction(() => document.querySelector("#space-number")?.textContent?.trim() === "10");
  await page.waitForTimeout(350);
  const scan = await inspectSurface(page, ["#space-layer", "#space-close", ".space-header", ".space-readout", ".space-touch", "#space-mode-list", ".space-footer"]);
  await saveScreenshot(page, viewport, surface);
  reviewCommon(viewport, surface, scan);
  const modeList = scan.targets.find((target) => target.selector === "#space-mode-list");
  if (modeList && modeList.scrollHeight > modeList.clientHeight + 2) {
    addIssue(viewport, surface, "space-mode-list-scroll", "宇宙モード切替UIに縦スクロールが発生", modeList);
  }
  report.scans.push({ ...scan, viewport: viewport.name, surface });
  await context.close();
};

const scanSoundMode = async (viewport) => {
  const surface = "sound-mode";
  const { context, page } = await makePage(viewport, `${viewport.name}-${surface}`, () => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof globalThis.GaiaModeLoader?.load === "function");
  await page.evaluate(() => globalThis.GaiaModeLoader.load("sound"));
  await page.evaluate(() => document.querySelector("[data-sound-gallery-open]")?.click());
  await page.locator("#sound-layer").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelectorAll("[data-sound-track]").length === 12);
  await page.waitForTimeout(350);
  const scan = await inspectSurface(page, ["#sound-layer", ".sound-header", ".sound-layout", ".sound-track-panel", ".sound-player", ".sound-transport", ".sound-progress-group", ".sound-volume"]);
  await saveScreenshot(page, viewport, surface);
  reviewCommon(viewport, surface, scan, { allowOffscreenControls: true });
  const layout = scan.targets.find((target) => target.selector === ".sound-layout");
  if (layout && layout.scrollHeight <= layout.clientHeight + 2) {
    addIssue(viewport, surface, "sound-layout-not-scrollable", "スマートフォンの音楽一覧が必要時に内部スクロールできない", layout);
  }
  report.scans.push({ ...scan, viewport: viewport.name, surface });
  await context.close();
};

const scanSensorPublicMap = async (viewport) => {
  const surface = "sensor-public-map";
  const { context, page } = await makePage(viewport, `${viewport.name}-${surface}`, () => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await page.route("**/api/public/v1/sensors", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ sensors: [{
      sensorName: "放課後の環境センサー",
      state: "ONLINE",
      location: { longitude: 139.7, latitude: 35.7 },
      owner: { displayName: "GAIA観測部", avatarUrl: null, xUrl: null, githubUrl: null, instagramUrl: null },
      region: { countryCode: "JP", subdivisionCode: "JP-13", subdivisionName: "東京都" },
    }] }),
  }));
  await page.route("**/api/web/v1/**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorized" }) }));
  await page.goto(new URL("/sensors/#map", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.locator("[data-view='map']").waitFor({ state: "visible" });
  await page.locator(".sensor-map-marker").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForTimeout(350);
  const scan = await inspectSurface(page, [".sensor-topbar", ".sensor-page-head", "#public-sensor-map", "#public-sensor-detail", "#public-sensor-list"]);
  await saveScreenshot(page, viewport, surface);
  reviewCommon(viewport, surface, scan, { allowDocumentY: true, allowOffscreenControls: true });
  const marker = scan.controls.find((control) => control.label.includes("放課後の環境センサー"));
  if (!marker?.hitSize) addIssue(viewport, surface, "sensor-marker-target", "公開センサーマーカーが44px未満", marker || null);
  const headingFontSize = await page.locator(".sensor-public-map .sensor-page-head h1").evaluate((heading) => parseFloat(getComputedStyle(heading).fontSize));
  const headingFont = await page.locator(".sensor-public-map .sensor-page-head h1").evaluate((heading) => getComputedStyle(heading).fontFamily);
  if (headingFontSize > 30) addIssue(viewport, surface, "sensor-heading-too-large", "「みんなのセンサー」の見出しが30pxを超えている", { headingFontSize });
  if (!headingFont.includes("Yu Mincho") || !headingFont.includes("Noto Serif CJK JP")) {
    addIssue(viewport, surface, "sensor-font-stack", "センサー見出しがPC基準の明朝フォールバックになっていない", { headingFont });
  }
  report.scans.push({ ...scan, viewport: viewport.name, surface, headingFontSize, headingFont });
  await context.close();
};

const scanTitle = async (viewport) => {
  const label = `${viewport.name}-title`;
  const { context, page } = await makePage(viewport, label, () => {
    localStorage.clear();
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
    localStorage.setItem("gaiaSensewareTrueEnd:reached:v1", new Date().toISOString());
  });
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.locator("#novel-title-screen").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  const scan = await inspectSurface(page, ["#novel-title-screen", "#novel-title", ".novel-title-actions", "#novel-title-gallery-button", "#novel-start-button"]);
  const titleLines = await collectRenderedLines(page, "#novel-title");
  await saveScreenshot(page, viewport, "title");
  reviewCommon(viewport, "title", scan);
  report.scans.push({ ...scan, viewport: viewport.name, surface: "title", titleLines });
  await context.close();
};

const progressFor = (stepId, label) => ({
  storyVersion: 13,
  stepId,
  reachedSceneIds: ["festival_concept", "map_mode01", "gx_experience", "esp32_pitch"],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds: [stepId],
  clear: false,
  archivesUnlocked: false,
  sessionId: `mobile-layout-audit-${label}`,
});

const scanDialogue = async (viewport, testCase, includeConfig = false) => {
  const label = `${viewport.name}-dialogue-${testCase.name}`;
  const progress = progressFor(testCase.stepId, label);
  const { context, page } = await makePage(viewport, label, (candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "Mobile layout audit", excerpt: candidate.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, progress);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const resumed = await page.waitForFunction(
    (expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected,
    testCase.stepId,
    { timeout: 12_000 },
  ).then(() => true, () => false);
  if (!resumed && await page.locator("#novel-resume-button").isVisible()) {
    await page.locator("#novel-resume-button").click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible" });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.waitForFunction((expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected, testCase.stepId);
  await page.waitForFunction(() => Boolean(document.querySelector("#novel-text")?.textContent?.trim()));
  await page.waitForTimeout(250);
  const scan = await inspectSurface(page, ["#novel-layer", "#novel-dialogue", "#novel-text", ".novel-topbar nav", "#novel-home-button", "#novel-close-button", "#novel-source-label", "#gaia-audio-dock"]);
  const lines = await collectRenderedLines(page, "#novel-text");
  const headingLines = await collectRenderedLines(page, "#novel-location");
  const pageCount = await page.locator("#novel-text").evaluate((node) => Number(node.dataset.pageCount || 1));
  const renderedPages = [{ pageIndex: 1, lines }];
  await saveScreenshot(page, viewport, `dialogue-${testCase.name}-page-1`);
  for (let pageIndex = 2; pageIndex <= pageCount; pageIndex += 1) {
    await page.locator("#novel-dialogue").click();
    await page.waitForFunction((expected) => Number(document.querySelector("#novel-text")?.dataset.pageIndex || 0) === expected, pageIndex);
    await page.locator("#novel-continue.is-visible").waitFor({ state: "visible" });
    const pageLines = await collectRenderedLines(page, "#novel-text");
    renderedPages.push({ pageIndex, lines: pageLines });
    await saveScreenshot(page, viewport, `dialogue-${testCase.name}-page-${pageIndex}`);
  }
  const pagination = await page.evaluate((stepId) => {
    const step = globalThis.GAIA_NOVEL_STORY?.scenes
      ?.flatMap((scene) => scene.steps)
      ?.find((candidate) => candidate.id === stepId);
    return step ? globalThis.GaiaNovel.inspectDialoguePagination(step.text) : null;
  }, testCase.stepId);
  reviewCommon(viewport, `dialogue-${testCase.name}`, scan);
  const textTarget = scan.targets.find((target) => target.selector === "#novel-text");
  if (textTarget && textTarget.scrollHeight > textTarget.clientHeight + 2) {
    addIssue(viewport, `dialogue-${testCase.name}`, "dialogue-scroll", "通常会話本文に内部スクロールが発生", textTarget);
  }
  const allRenderedLines = renderedPages.flatMap((pageItem) => pageItem.lines.lines);
  const badStarts = allRenderedLines.filter((line) => /^[、。，．・：；？！）」』】]/u.test(line.text));
  const badEnds = allRenderedLines.filter((line) => /[（「『【]$/u.test(line.text));
  const oneGlyphLines = allRenderedLines.filter((line) => Array.from(line.text.replace(/\s+/gu, "")).length <= 1);
  if (badStarts.length) addIssue(viewport, `dialogue-${testCase.name}`, "kinsoku-line-start", "句読点・閉じ括弧から始まる行がある", badStarts);
  if (badEnds.length) addIssue(viewport, `dialogue-${testCase.name}`, "kinsoku-line-end", "開き括弧で終わる行がある", badEnds);
  if (oneGlyphLines.length) addIssue(viewport, `dialogue-${testCase.name}`, "single-glyph-line", "1文字だけの行がある", oneGlyphLines);
  if (headingLines.lines.length > 1) {
    addIssue(viewport, `dialogue-${testCase.name}`, "dialogue-header-wrap", "物語ヘッダーの場面情報が複数行になっている", headingLines);
  }
  const headerTargets = scan.targets.filter((target) => ["#novel-home-button", "#novel-close-button", "#novel-source-label", "#gaia-audio-dock"].includes(target.selector) && target.visible && target.box);
  const headerOverlaps = [];
  for (let leftIndex = 0; leftIndex < headerTargets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < headerTargets.length; rightIndex += 1) {
      const left = headerTargets[leftIndex];
      const right = headerTargets[rightIndex];
      if (left.box.left < right.box.right && left.box.right > right.box.left && left.box.top < right.box.bottom && left.box.bottom > right.box.top) {
        headerOverlaps.push([left, right]);
      }
    }
  }
  if (headerOverlaps.length) addIssue(viewport, `dialogue-${testCase.name}`, "dialogue-header-overlap", "物語ヘッダーの要素同士が重なっている", headerOverlaps);
  if (headerTargets.length > 1) {
    const headerTops = headerTargets.map((target) => target.box.top);
    if (Math.max(...headerTops) - Math.min(...headerTops) > 2) {
      addIssue(viewport, `dialogue-${testCase.name}`, "dialogue-header-multiline", "物語ヘッダーの要素が同じ1段に揃っていない", headerTargets);
    }
  }
  const sparsePages = pagination?.pages?.filter((candidate) => candidate.lines < 2) || [];
  if ((pagination?.pages?.length || 0) > 1 && sparsePages.length) {
    addIssue(viewport, `dialogue-${testCase.name}`, "sparse-dialogue-page", "複数ページの会話に1行だけのページがある", sparsePages);
  }
  const overfullPages = pagination?.pages?.filter((candidate) => candidate.lines > 3 || !candidate.fits) || [];
  if (overfullPages.length) {
    addIssue(viewport, `dialogue-${testCase.name}`, "dialogue-page-overfull", "会話ページが3行または表示可能領域を超えている", overfullPages);
  }
  const dialogueTarget = scan.targets.find((target) => target.selector === "#novel-dialogue");
  const dialogueHeightRatio = dialogueTarget?.box?.height ? dialogueTarget.box.height / scan.viewport.height : 0;
  if (viewport.height >= 800 && dialogueHeightRatio > 0.23) {
    addIssue(viewport, `dialogue-${testCase.name}`, "dialogue-panel-too-tall", "3行会話欄がスマートフォン画面を圧迫している", { dialogueHeightRatio, dialogue: dialogueTarget });
  }
  report.scans.push({ ...scan, viewport: viewport.name, surface: `dialogue-${testCase.name}`, stepId: testCase.stepId, lines, renderedPages, headingLines, pagination, dialogueHeightRatio });

  if (includeConfig) {
    await page.locator("#novel-config-button").click();
    await page.locator("#novel-config-panel").waitFor({ state: "visible" });
    const configScan = await inspectSurface(page, ["#novel-config-panel", ".novel-config-shell", ".novel-config-content", "#novel-config-close"]);
    await saveScreenshot(page, viewport, "config");
    reviewCommon(viewport, "config", configScan);
    const audioControl = configScan.controls.find((control) => control.id === "gaia-audio-toggle");
    const closeControl = configScan.controls.find((control) => control.id === "novel-config-close");
    if (audioControl && closeControl) {
      const intersects = audioControl.box.left < closeControl.box.right
        && audioControl.box.right > closeControl.box.left
        && audioControl.box.top < closeControl.box.bottom
        && audioControl.box.bottom > closeControl.box.top;
      if (intersects) addIssue(viewport, "config", "modal-control-overlap", "音量ボタンと設定画面の閉じるボタンが重なっている", { audioControl, closeControl });
    }
    const configContent = configScan.targets.find((target) => target.selector === ".novel-config-content");
    if (configContent && configContent.scrollHeight > configContent.clientHeight + 2) {
      addIssue(viewport, "config", "config-content-scroll", "設定項目が画面内に収まらず内部スクロールが発生", configContent);
    }
    report.scans.push({ ...configScan, viewport: viewport.name, surface: "config" });
  }
  await context.close();
};

const scanSensorLogin = async (viewport) => {
  const label = `${viewport.name}-sensor-login`;
  const { context, page } = await makePage(viewport, label, () => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await page.route("**/api/public/v1/sensors", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sensors: [] }) }));
  await page.route("**/api/web/v1/**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorized" }) }));
  await page.goto(new URL("/sensors/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.locator("[data-view='login']").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  const scan = await inspectSurface(page, [".sensor-topbar", "[data-view='login']", ".sensor-login h1", "#google-login", "#sensor-audio-toggle"]);
  const headingLines = await collectRenderedLines(page, ".sensor-login h1");
  await saveScreenshot(page, viewport, "sensor-login");
  reviewCommon(viewport, "sensor-login", scan, { allowDocumentY: true, allowOffscreenControls: true });
  report.scans.push({ ...scan, viewport: viewport.name, surface: "sensor-login", headingLines });
  await context.close();
};

try {
  for (const viewport of selectedViewports) {
    if (auditScope === "special-modes") {
      await scanMapMode(viewport);
      await scanSpaceMode(viewport);
      await scanSoundMode(viewport);
      await scanSensorPublicMap(viewport);
      continue;
    }
    if (auditScope === "dialogue") {
      for (const testCase of dialogueCases) await scanDialogue(viewport, testCase);
      continue;
    }
    await scanOpening(viewport);
    await scanObservation(viewport);
    await scanMapMode(viewport);
    await scanSpaceMode(viewport);
    await scanSoundMode(viewport);
    await scanSensorPublicMap(viewport);
    await scanTitle(viewport);
    for (let index = 0; index < dialogueCases.length; index += 1) {
      await scanDialogue(viewport, dialogueCases[index], index === 0);
    }
    await scanSensorLogin(viewport);
  }
  report.status = report.issues.length || report.consoleErrors.length || report.pageErrors.length || report.responses404.length
    ? "issues"
    : "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(JSON.stringify({
  status: report.status,
  scans: report.scans.length,
  screenshots: report.screenshots.length,
  issues: report.issues.length,
  consoleErrors: report.consoleErrors.length,
  pageErrors: report.pageErrors.length,
  responses404: report.responses404.length,
  outputDir,
}, null, 2));

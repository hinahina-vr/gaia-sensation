import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4417"] = process.argv.slice(2);
const cardsOnly = process.argv.slice(6).includes("--cards-only");
const gxFeatureOnly = process.argv.slice(6).includes("--gx-feature-only");
const introOnly = process.argv.slice(6).includes("--intro-only");
const endingOnly = process.argv.slice(6).includes("--ending-only");
const mapCopyOnly = process.argv.slice(6).includes("--map-copy-only");
const repeatOnly = process.argv.slice(6).includes("--repeat-only");
const integratedLightOnly = process.argv.slice(6).includes("--integrated-light-only");
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/lightweight-story-menu-hotfix");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-2048", width: 2048, height: 1030, action: "click" },
  { name: "pc-1920", width: 1920, height: 1000, action: "Enter" },
  { name: "pc-1440", width: 1440, height: 900, action: "click" },
  { name: "mobile-390", width: 390, height: 844, mobile: true, action: "Space" },
  { name: "mobile-landscape-568", width: 568, height: 320, mobile: true, action: "click" },
  { name: "mobile-320", width: 320, height: 568, mobile: true, action: "click" },
  { name: "pc-low-1366x600", width: 1366, height: 600, action: "click" },
];
const report = {
  status: "running",
  baseUrl,
  viewports,
  scans: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};
const browser = await chromium.launch({ headless: true, executablePath });
const visibleSource = `(element) => {
  if (!element || element.hidden || element.closest('[hidden]')) return false;
  const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
}`;
const progressFixture = {
  storyVersion: 13,
  stepId: "festival_concept_032",
  reachedSceneIds: ["festival_concept"],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  metCharacters: { mizuha: true, amane: true, sakuya: false },
  audio: { muted: true, volume: 0.3 },
  readStepIds: ["festival_concept_001", "festival_concept_021", "festival_concept_023"],
  clear: false,
  archivesUnlocked: false,
  sessionId: "lightweight-story-menu-hotfix",
  unknownLocalField: { preserved: true },
};
const unlockedGallery = [
  "first-encounter",
  "amane-closeup",
  "mizuha-closeup",
  "esp32-collaboration",
  "circle-welcome",
  "exhibition-finale",
];

const createPage = async (viewport, label) => {
  const context = await browser.newContext({
    viewport,
    hasTouch: Boolean(viewport.mobile),
    isMobile: Boolean(viewport.mobile),
    reducedMotion: "reduce",
  });
  if (endingOnly) {
    // Ending navigation does not depend on the live aurora service.
    await context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: fs.readFileSync(path.resolve("data/ovation-aurora-snapshot.json"), "utf8"),
    }));
  }
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
  await page.addInitScript((source) => {
    globalThis.__qaVisible = eval(source);
    sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
    globalThis.__qaNovelOpenAtCount = 0;
    globalThis.__qaNovelOpenCount = 0;
    globalThis.__qaSpaceOpenAtCount = 0;
    window.addEventListener("gaia:novel-open-at-mode", () => { globalThis.__qaNovelOpenAtCount += 1; }, true);
    window.addEventListener("gaia:novel-open", () => { globalThis.__qaNovelOpenCount += 1; }, true);
    window.addEventListener("gaia:space-open-at-mode", () => { globalThis.__qaSpaceOpenAtCount += 1; }, true);
  }, visibleSource);
  return { context, page };
};

const seedStorage = async (page, stepId = progressFixture.stepId) => page.evaluate(({ progress, ids, targetStepId }) => {
  localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({ ...progress, stepId: targetStepId }));
  localStorage.setItem("gaiaSensewareNovel:cg-gallery:v1", JSON.stringify({ version: 1, unlocked: ids }));
  localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  localStorage.setItem("gaiaSensewareTrueEnd:reached:v1", new Date().toISOString());
}, { progress: progressFixture, ids: unlockedGallery, targetStepId: stepId });

const openIntro = async (page, { progressOverrides = {}, apeironceneComplete = false } = {}) => {
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof globalThis.GaiaModeLoader?.load === "function");
  await page.evaluate(() => Promise.all([
    globalThis.GaiaModeLoader.load("exploration"),
    globalThis.GaiaModeLoader.load("story"),
  ]));
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await seedStorage(page);
  await page.evaluate(({ overrides, trueEndComplete }) => {
    const progress = JSON.parse(localStorage.getItem("gaiaSensewareNovel:progress") || "null");
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({ ...progress, ...overrides }));
    if (trueEndComplete) localStorage.setItem("gaiaSensewareTrueEnd:complete:v1", new Date().toISOString());
    else localStorage.removeItem("gaiaSensewareTrueEnd:complete:v1");
    const opening = document.querySelector("#gaia-opening");
    opening.hidden = true;
    opening.inert = true;
    opening.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gaia-opening-active");
    window.dispatchEvent(new CustomEvent("gaia:opening-complete"));
    document.querySelector("#intro-button")?.click();
  }, { overrides: progressOverrides, trueEndComplete: apeironceneComplete });
  await page.waitForFunction(() => __qaVisible(document.querySelector("#intro-layer")));
  await page.waitForFunction(() => [...document.querySelectorAll(".intro-path-card")]
    .every((card) => !card.classList.contains("is-awaiting-reveal") && !card.classList.contains("is-depth-arriving")), null, { timeout: 3_000 });
};

const scanEndingDestinations = async () => {
  const viewport = viewports.find((entry) => entry.name === "pc-1440");

  const completed = await createPage(viewport, "pc-1440-apeironcene-complete");
  await openIntro(completed.page, { progressOverrides: { clear: true }, apeironceneComplete: true });
  const completedCta = await completed.page.locator(".intro-story-return[data-primary-action='true']").evaluate((button) => ({
    text: button.querySelector("strong")?.textContent.trim(),
    destination: button.dataset.storyDestination,
    ariaLabel: button.getAttribute("aria-label"),
  }));
  assert.deepEqual(completedCta, {
    text: "物語をはじめる",
    destination: "story",
    ariaLabel: "物語をはじめる",
  });
  await completed.context.close();

  const pending = await createPage(viewport, "pc-1440-apeironcene-pending");
  await openIntro(pending.page, { progressOverrides: { clear: true }, apeironceneComplete: false });
  const pendingButton = pending.page.locator(".intro-story-return[data-primary-action='true']");
  const pendingCta = await pendingButton.evaluate((button) => ({
    text: button.querySelector("strong")?.textContent.trim(),
    destination: button.dataset.storyDestination,
    ariaLabel: button.getAttribute("aria-label"),
  }));
  assert.deepEqual(pendingCta, {
    text: "星々の放課後 ～APEIRONCENE～",
    destination: "apeironcene",
    ariaLabel: "星々の放課後 APEIRONCENEへ進む",
  });
  await pendingButton.click();
  await pending.page.waitForFunction(() => (
    document.querySelector("#novel-layer")?.classList.contains("is-true-end")
    && document.querySelector("#novel-layer")?.dataset.sceneId === "true-end"
    && __qaVisible(document.querySelector(".true-end-shell"))
  ), null, { timeout: 30_000 });
  const launched = await pending.page.evaluate(() => ({
    introVisible: __qaVisible(document.querySelector("#intro-layer")),
    trueEndVisible: __qaVisible(document.querySelector(".true-end-shell")),
    sceneId: document.querySelector("#novel-layer")?.dataset.sceneId,
    openAtCount: globalThis.__qaNovelOpenAtCount,
  }));
  assert.deepEqual(launched, { introVisible: false, trueEndVisible: true, sceneId: "true-end", openAtCount: 1 });
  report.scans.push({ viewport: viewport.name, case: "ending-destination-switch", completedCta, pendingCta, launched, passed: true });
  await pending.context.close();
};

const cardScan = async (page) => page.evaluate(() => {
  const cards = [...document.querySelectorAll(".intro-path-card")];
  const grid = document.querySelector(".intro-path-grid");
  const hiddenDetails = [...document.querySelectorAll(
    ".intro-path-card .intro-path-index,.intro-path-card .intro-path-enter",
  )];
  const primary = document.querySelector(".intro-story-return[data-primary-action='true']");
  const primaryStyle = getComputedStyle(primary);
  return {
    cardCount: cards.length,
    viewportWidth: innerWidth,
    landingMetaCount: document.querySelectorAll(".intro-lp-hero > .intro-heading").length,
    landingEyebrowCount: document.querySelectorAll(".intro-title-lockup > p").length,
    wideRowMedia: matchMedia("(min-width: 1280px)").matches,
    gridTemplateColumns: grid ? getComputedStyle(grid).gridTemplateColumns : "",
    cards: cards.map((card) => {
      const title = card.querySelector(":scope > strong");
      const titleStyle = getComputedStyle(title);
      return {
      path: card.dataset.introPath || (card.hasAttribute("data-sound-gallery-open") ? "sound" : ""),
      title: title?.textContent.trim(),
      titleFontSize: titleStyle.fontSize,
      titleFontWeight: titleStyle.fontWeight,
      titleLetterSpacing: titleStyle.letterSpacing,
      titleLineHeight: titleStyle.lineHeight,
      copy: card.querySelector(":scope > p")?.textContent.trim(),
      copyLineCount: (() => {
        const copy = card.querySelector(":scope > p");
        if (!copy) return 0;
        const range = document.createRange();
        range.selectNodeContents(copy);
        return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0).length;
      })(),
      glyphVisible: __qaVisible(card.querySelector(".intro-path-glyph")),
      layoutTop: card.offsetTop,
      rect: card.getBoundingClientRect().toJSON(),
      accessibleName: card.getAttribute("aria-label") || card.innerText.trim(),
      focusable: card.tabIndex >= 0,
    };
    }),
    hiddenDetailCount: hiddenDetails.length,
    hiddenDetailVisibleCount: hiddenDetails.filter(__qaVisible).length,
    focusEffectCount: document.querySelectorAll(".intro-path-card .intro-card-reveal-fx,.intro-path-card .intro-border-glint").length,
    primaryCount: document.querySelectorAll("[data-primary-action='true']").length,
    primaryVisible: __qaVisible(primary),
    primaryFocusable: primary.tabIndex >= 0,
    primaryText: primary.textContent.replace(/\s+/gu, "").trim(),
    primaryRole: primary.tagName.toLowerCase(),
    primaryBackground: primaryStyle.backgroundImage,
    gridRect: grid?.getBoundingClientRect().toJSON(),
    primaryRect: primary.getBoundingClientRect().toJSON(),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    overflowY: document.documentElement.scrollHeight > innerHeight + 1,
  };
});

const assertCards = (scan, viewport) => {
  assert.equal(scan.landingMetaCount, 0, `${viewport.name}: obsolete landing metadata remains`);
  assert.equal(scan.landingEyebrowCount, 0, `${viewport.name}: obsolete landing eyebrow remains`);
  assert.equal(scan.cardCount, 4);
  assert.deepEqual(scan.cards.map((card) => card.title), ["世界を観測する", "みんなのセンサー", "登場人物の記録", "音楽を聴く"]);
  assert.deepEqual(scan.cards.map((card) => card.copy), ["地球のデータを光と色で描く", "あなたの端末をひとつのセンサーに", "4人の役割と設定スケッチ", "放課後を彩る音楽のアーカイブ"]);
  for (const property of ["titleFontSize", "titleFontWeight", "titleLetterSpacing", "titleLineHeight"]) {
    assert.equal(new Set(scan.cards.map((card) => card[property])).size, 1, `${viewport.name}: card ${property} values are not unified`);
  }
  assert.equal(scan.cards.find((card) => card.title === "登場人物の記録")?.copyLineCount, 1, `${viewport.name}: character copy is not one line`);
  assert.equal(scan.cards.some((card) => card.path === "space" || card.title === "宇宙から見る"), false);
  assert.equal(scan.cards.some((card) => card.path === "abstract" || card.title === "光に触れる"), false);
  assert(scan.cards.every((card) => card.glyphVisible && card.focusable && card.rect.width > 0 && card.rect.height >= 90));
  assert.equal(scan.hiddenDetailVisibleCount, 0);
  assert(scan.hiddenDetailCount > 0);
  assert.equal(scan.focusEffectCount, 8);
  assert.equal(scan.primaryCount, 1);
  assert(scan.primaryVisible && scan.primaryFocusable && scan.primaryRole === "button");
  assert(scan.primaryText.includes("物語をはじめる"));
  assert.equal(scan.primaryText.includes("→"), false);
  assert.notEqual(scan.primaryBackground, "none");
  assert(Math.abs(scan.gridRect.left - scan.primaryRect.left) <= 1);
  assert(Math.abs(scan.gridRect.right - scan.primaryRect.right) <= 1);
  assert(Math.abs(scan.gridRect.width - scan.primaryRect.width) <= 1);
  assert.equal(scan.overflowX, false);
  assert.equal(scan.overflowY, false);
  if (!viewport.mobile) {
    const cardTops = scan.cards.map(({ layoutTop }) => layoutTop);
    assert(Math.max(...cardTops) - Math.min(...cardTops) <= 1, `${viewport.name}: the four exploration cards are not in one row (${JSON.stringify({ cardTops, viewportWidth: scan.viewportWidth, wideRowMedia: scan.wideRowMedia, gridTemplateColumns: scan.gridTemplateColumns })})`);
  }
};

const verifyCardFocusGlint = async (page, viewport) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const effects = [];
  const cards = page.locator(".intro-path-card");
  for (let index = 0; index < await cards.count(); index += 1) {
    const card = cards.nth(index);
    await card.focus();
    effects.push(await card.evaluate((element) => {
      const reveal = element.querySelector(".intro-card-reveal-fx");
      const border = element.querySelector(".intro-border-glint");
      return {
        focused: element.matches(":focus-visible"),
        revealDisplay: getComputedStyle(reveal).display,
        revealAnimation: getComputedStyle(reveal).animationName,
        borderDisplay: getComputedStyle(border).display,
        borderAnimation: getComputedStyle(border, "::before").animationName,
      };
    }));
  }
  effects.forEach((effect, index) => {
    assert.equal(effect.focused, true, `${viewport.name}: card ${index + 1} is not visibly focused`);
    assert.notEqual(effect.revealDisplay, "none", `${viewport.name}: card ${index + 1} surface glint is hidden`);
    assert.match(effect.revealAnimation, /intro-card-hover-glint/u, `${viewport.name}: card ${index + 1} surface glint does not animate`);
    assert.notEqual(effect.borderDisplay, "none", `${viewport.name}: card ${index + 1} border glint is hidden`);
    assert.match(effect.borderAnimation, /intro-border-sweep/u, `${viewport.name}: card ${index + 1} border glint does not animate`);
  });
  await cards.first().focus();
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-intro-card-focus-glint.png`), fullPage: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  return effects;
};

const useScrollCue = async (page, viewport) => {
  const cue = page.locator("#intro-lp-scroll");
  const before = await cue.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const heroRect = element.closest(".intro-lp-hero")?.getBoundingClientRect();
    const arrow = element.querySelector("i");
    return {
      rect: rect.toJSON(),
      heroRect: heroRect?.toJSON(),
      text: element.textContent.replace(/\s+/gu, " ").trim(),
      ariaLabel: element.getAttribute("aria-label"),
      arrowSize: arrow ? getComputedStyle(arrow).width : "",
      arrowBorderRadius: arrow ? getComputedStyle(arrow).borderRadius : "",
      arrowAnimation: arrow ? getComputedStyle(arrow, "::before").animationName : "",
      visible: globalThis.__qaVisible(element),
      layerScrollTop: document.querySelector("#intro-layer")?.scrollTop,
    };
  });
  assert.equal(before.visible, true);
  assert.match(before.text, /SCROLL/u);
  assert.match(before.text, /他の展示を見る/u);
  assert.match(before.ariaLabel, /下へスクロール/u);
  assert.match(before.arrowBorderRadius, /50%/u);
  assert(Number.parseFloat(before.arrowSize) >= 30, JSON.stringify(before));
  const shortLandscape = viewport.width > viewport.height && viewport.height <= 560;
  if (shortLandscape) {
    assert(before.rect.top >= viewport.height, JSON.stringify(before.rect));
    await cue.scrollIntoViewIfNeeded();
  } else {
    assert(before.rect.bottom <= viewport.height + 1 && before.rect.bottom >= viewport.height - 90, JSON.stringify(before.rect));
  }
  const cueCenter = before.rect.left + before.rect.width / 2;
  const heroCenter = before.heroRect.left + before.heroRect.width / 2;
  assert(Math.abs(cueCenter - heroCenter) <= 1, JSON.stringify({ cueCenter, heroCenter }));

  await cue.click();
  await page.waitForFunction(() => (
    document.querySelector("#intro-layer")?.scrollTop > 0
    && document.activeElement === document.querySelector("#intro-gx-feature")
  ));
  const after = await page.evaluate(() => ({
    layerScrollTop: document.querySelector("#intro-layer")?.scrollTop,
    focusedId: document.activeElement?.id,
    gxVisible: globalThis.__qaVisible(document.querySelector("#intro-gx-feature")),
  }));
  assert(after.layerScrollTop > 0 && after.gxVisible);
  assert.equal(after.focusedId, "intro-gx-feature");
  return { before, after };
};

const scanGxFeature = async (page, viewport) => {
  const feature = page.locator("#intro-gx-feature");
  await feature.scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  const scan = await feature.evaluate((element) => {
    const style = getComputedStyle(element);
    const copy = element.querySelector(".intro-gx-copy");
    const title = element.querySelector(".intro-gx-copy strong");
    const description = element.querySelector(".intro-gx-copy p");
    const enter = element.querySelector(".intro-gx-enter");
    const rect = element.getBoundingClientRect();
    const descriptionRange = document.createRange();
    descriptionRange.selectNodeContents(description);
    return {
      rect: rect.toJSON(),
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      borderRadius: Number.parseFloat(style.borderRadius),
      borderLeftWidth: Number.parseFloat(style.borderLeftWidth),
      color: style.color,
      gridAreas: style.gridTemplateAreas,
      title: title?.textContent.trim(),
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
      copy: copy?.querySelector("p")?.textContent.trim(),
      copyLineCount: [...descriptionRange.getClientRects()].length,
      enter: enter?.textContent.replace(/\s+/gu, " ").trim(),
      copyAlignedLeft: getComputedStyle(copy).textAlign === "left",
      viewportCenter: element.closest(".intro-layer")?.clientWidth / 2,
      featureCenter: rect.left + rect.width / 2,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      visible: globalThis.__qaVisible(element),
    };
  });
  assert.equal(scan.visible, true);
  assert.match(scan.backgroundImage, /gradient/u);
  assert(scan.borderRadius >= 2 && scan.borderLeftWidth >= 1, JSON.stringify(scan));
  assert.equal(scan.title, "酸素は、最初の廃棄物だった。");
  assert.match(scan.copy, /人間と地球が、ともに変わるGX/u);
  if (viewport.width >= 1280) assert.equal(scan.copyLineCount, 1, JSON.stringify(scan));
  assert.match(scan.enter, /THE FIRST GX/u);
  assert(scan.titleSize >= 21 && scan.titleSize <= 31, JSON.stringify(scan));
  assert.equal(scan.copyAlignedLeft, true);
  assert(Math.abs(scan.featureCenter - scan.viewportCenter) <= 1, JSON.stringify(scan));
  assert.equal(scan.overflowX, false);
  assert(scan.rect.left >= 0 && scan.rect.right <= viewport.width + 1, JSON.stringify(scan.rect));
  return scan;
};

const scanGxFeatureOnly = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-gx-feature-only`);
  await openIntro(page);
  const gxFeature = await scanGxFeature(page, viewport);
  const screenshot = path.join(outputDir, `${viewport.name}-gx-feature-one-line.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  report.scans.push({ viewport: viewport.name, case: "gx-feature-one-line", gxFeature, screenshot, passed: true });
  await context.close();
};

const scanCharacterFile = async (page, viewport) => {
  const jump = page.locator("#intro-character-jump");
  await jump.scrollIntoViewIfNeeded();
  const jumpCopy = await jump.evaluate((button) => ({
    text: button.textContent.replace(/\s+/gu, " ").trim(),
    controls: button.getAttribute("aria-controls"),
    hasPopup: button.getAttribute("aria-haspopup"),
    visible: __qaVisible(button),
    inMainGrid: button.parentElement?.id === "intro-path-grid",
  }));
  assert(jumpCopy.visible);
  assert.match(jumpCopy.text, /CHARACTER FILE/u);
  assert.match(jumpCopy.text, /登場人物の記録/u);
  assert.doesNotMatch(jumpCopy.text, /キャラクター設定/u);
  assert.equal(jumpCopy.controls, "character-book-layer");
  assert.equal(jumpCopy.hasPopup, "dialog");
  assert.equal(jumpCopy.inMainGrid, true);

  await jump.click();
  await page.waitForFunction(() => (
    document.body.classList.contains("character-mode-open")
    && __qaVisible(document.querySelector("#character-book-layer"))
  ));
  await page.waitForFunction(() => {
    const image = document.querySelector("#character-book-image");
    return image?.complete && image.naturalWidth > 0;
  });

  const scan = await page.evaluate(() => {
    const layer = document.querySelector("#character-book-layer");
    const image = document.querySelector("#character-book-image");
    const imageRect = image.getBoundingClientRect();
    const pageButtons = [...document.querySelectorAll("[data-character-page]")];
    return {
      visible: __qaVisible(layer),
      focusedId: document.activeElement?.id,
      heading: document.querySelector("#character-book-title")?.textContent.trim(),
      pageTitle: document.querySelector("#character-book-page-title")?.textContent.trim(),
      current: document.querySelector("#character-book-current")?.textContent.trim(),
      pageCount: pageButtons.length,
      activePages: pageButtons.filter((button) => button.getAttribute("aria-current") === "page").length,
      image: { loaded: image.complete && image.naturalWidth > 0, alt: image.alt, src: image.currentSrc },
      imageRect: imageRect.toJSON(),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert(scan.visible);
  assert.equal(scan.focusedId, "character-book-close");
  assert.match(scan.heading, /キャラクター設定$/u);
  assert.equal(scan.pageTitle, "三人の基準設定画");
  assert.equal(scan.current, "01");
  assert.equal(scan.pageCount, 10);
  assert.equal(scan.activePages, 1);
  assert(scan.image.loaded && scan.image.alt.length > 0);
  assert.match(scan.image.src, /01-three-ecologies-character-master\.png/u);
  assert.equal(scan.overflowX, false);
  assert(scan.imageRect.left >= -1 && scan.imageRect.right <= viewport.width + 1, JSON.stringify(scan.imageRect));

  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#character-book-current")?.textContent.trim() === "02");
  assert.equal(await page.locator("#character-book-page-title").textContent(), "海辺での初対面");

  await page.screenshot({ path: path.join(outputDir, viewport.name + "-character-file.png") });
  await page.locator("#character-book-close").click();
  await page.waitForFunction(() => document.querySelector("#character-book-layer")?.hidden === true);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "intro-character-jump");
  return { jumpCopy, ...scan };
};

const scanMapActionCopy = async (viewport) => {
  const { context, page } = await createPage(viewport, viewport.name + "-map-action-copy");
  await openIntro(page);
  await page.locator('[data-intro-path="map"]').click();
  await page.waitForFunction(() => (
    __qaVisible(document.querySelector("#japan-layer"))
    && !__qaVisible(document.querySelector("#intro-layer"))
  ), null, { timeout: 15_000 });
  await page.waitForTimeout(850);
  if (viewport.mobile) {
    await page.locator("#map-mobile-heading-toggle").click();
    await page.waitForFunction(() => document.querySelector("#map-mobile-heading-toggle")?.getAttribute("aria-expanded") === "true");
  }
  await page.waitForFunction(() => (
    __qaVisible(document.querySelector("#japan-data-button"))
    && __qaVisible(document.querySelector("#gaia-statistics-button"))
  ));
  const scan = await page.evaluate(() => ({
    openDataCopy: document.querySelector("#japan-data-button")?.textContent.replace(/\s+/gu, " ").trim(),
    statisticsCopy: document.querySelector("#gaia-statistics-button")?.textContent.replace(/\s+/gu, " ").trim(),
    openDataVisible: __qaVisible(document.querySelector("#japan-data-button")),
    statisticsVisible: __qaVisible(document.querySelector("#gaia-statistics-button")),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.match(scan.openDataCopy, /^データの出典を表示する ↗$/u);
  assert.match(scan.statisticsCopy, /^データを統計分析する ＋$/u);
  assert.doesNotMatch(scan.openDataCopy, /OPEN DATA/u);
  assert.doesNotMatch(scan.statisticsCopy, /STAT LAB/u);
  assert(scan.openDataVisible && scan.statisticsVisible);
  assert.equal(scan.overflowX, false);
  await page.screenshot({ path: path.join(outputDir, viewport.name + "-map-action-copy.png") });
  report.scans.push({ viewport: viewport.name, case: "map-action-copy", ...scan, passed: true });
  await context.close();
};

const scanDirectMapEntry = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-direct-map-entry`);
  await openIntro(page);
  await page.locator('[data-intro-path="map"]').click();
  await page.waitForFunction(() => (
    __qaVisible(document.querySelector("#japan-layer"))
    && !__qaVisible(document.querySelector("#intro-layer"))
    && document.querySelector("#japan-mode-list .map-mode-button")?.getAttribute("aria-current") === "true"
  ), null, { timeout: 15_000 });
  if (viewport.mobile) await page.locator("#map-mobile-bank-toggle").click();
  await page.locator("#japan-mode-list .map-mode-button").first().focus();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#map-mode-preview")).opacity) >= 0.99);
  const focused = await page.evaluate(() => {
    const tooltip = document.querySelector("#map-mode-preview");
    const tooltipStyle = getComputedStyle(tooltip);
    const tooltipRect = tooltip.getBoundingClientRect();
    tooltip.style.pointerEvents = "auto";
    const tooltipStack = document.elementsFromPoint(tooltipRect.left + tooltipRect.width / 2, tooltipRect.top + 18)
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}#${element.id}.${element.className}`);
    tooltip.style.removeProperty("pointer-events");
    const current = [...document.querySelectorAll("#japan-mode-list .map-mode-button[aria-current='true']")];
    return {
      introVisible: __qaVisible(document.querySelector("#intro-layer")),
      intermediateVisible: __qaVisible(document.querySelector("#intro-sense-stage")),
      mapVisible: __qaVisible(document.querySelector("#japan-layer")),
      currentLabels: current.map((button) => button.textContent.trim()),
      focusedLabel: document.activeElement?.textContent.trim(),
      describedBy: document.activeElement?.getAttribute("aria-describedby"),
      tooltipVisible: __qaVisible(tooltip),
      tooltipVisibility: tooltipStyle.visibility,
      tooltipOpacity: Number(tooltipStyle.opacity),
      tooltipRect: tooltipRect.toJSON(),
      tooltipStack,
      tooltipText: tooltip.textContent.replace(/\s+/gu, " ").trim(),
      openDataCopy: document.querySelector("#japan-data-button")?.textContent.replace(/\s+/gu, " ").trim(),
      statisticsCopy: document.querySelector("#gaia-statistics-button")?.textContent.replace(/\s+/gu, " ").trim(),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  assert(focused.mapVisible && !focused.introVisible && !focused.intermediateVisible);
  assert.deepEqual(focused.currentLabels, ["01"]);
  assert.equal(focused.focusedLabel, "01");
  assert.equal(focused.describedBy, "map-mode-preview");
  assert(focused.tooltipVisible && focused.tooltipVisibility === "visible" && focused.tooltipOpacity >= 0.99, JSON.stringify(focused));
  assert(focused.tooltipRect.top >= 0 && focused.tooltipRect.bottom <= viewport.height + 1, JSON.stringify(focused.tooltipRect));
  assert(focused.tooltipStack.slice(0, 2).some((entry) => /map-mode-preview/u.test(entry)), JSON.stringify(focused.tooltipStack));
  assert.match(focused.openDataCopy, /^データの出典を表示する ↗$/u);
  assert.match(focused.statisticsCopy, /^データを統計分析する ＋$/u);
  assert.match(focused.tooltipText, /^01 \/ AIR 空気の声 CO₂が季節ごとに上下しながら/u);
  assert.doesNotMatch(focused.tooltipText, /どの信号を|クリックすると/u);
  assert.equal(focused.overflowX, false);
  assert.equal(focused.overflowY, false);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-direct-map-tooltip.png`) });
  await page.locator("#japan-close").focus();
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#map-mode-preview")).visibility === "hidden");
  const hiddenAfterBlur = await page.locator("#map-mode-preview").evaluate((tooltip) => getComputedStyle(tooltip).visibility);
  assert.equal(hiddenAfterBlur, "hidden");
  report.scans.push({ viewport: viewport.name, case: "direct-map-entry-tooltip", focused, hiddenAfterBlur, passed: true });
  await context.close();
};

const scanIntegratedLightEntry = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-integrated-light-entry`);
  await openIntro(page);
  assert.equal(await page.locator('[data-intro-path="abstract"]').count(), 0);
  await page.locator('[data-intro-path="map"]').click();
  await page.waitForFunction(() => __qaVisible(document.querySelector("#japan-layer")));
  assert.equal(await page.locator("#map-light-overlay, #abstract-mode-list").count(), 0);
  for (let index = 0; index < 8; index += 1) {
    if (viewport.mobile && await page.locator("#map-mobile-bank-toggle").getAttribute("aria-expanded") !== "true") {
      await page.locator("#map-mobile-bank-toggle").click();
    }
    const number = String(index + 1).padStart(2, "0");
    await page.locator("#japan-mode-list .map-mode-button:not([data-live-exhibit])").nth(index).evaluate((button) => button.click());
    await page.waitForFunction((expected) => (
      document.querySelector("#japan-layer")?.classList.contains("has-integrated-map-light")
      && document.querySelector("#gaia-canvas")?.dataset.integratedMapMode === expected
      && document.querySelector("#gaia-canvas")?.parentElement?.id === "japan-layer"
    ), number);
  }
  const integrated = await page.evaluate(() => ({
    introVisible: __qaVisible(document.querySelector("#intro-layer")),
    mapLayerVisible: __qaVisible(document.querySelector("#japan-layer")),
    activeSurface: document.querySelector(".map-mode-bank")?.dataset.mapSurface,
    lightIntegration: document.querySelector(".map-mode-bank")?.dataset.lightIntegration,
    integratedClass: document.querySelector("#japan-layer")?.classList.contains("has-integrated-map-light"),
    mapVisible: __qaVisible(document.querySelector("#japan-map")),
    canvasVisible: __qaVisible(document.querySelector("#gaia-canvas")),
    canvasPointerEvents: getComputedStyle(document.querySelector("#gaia-canvas")).pointerEvents,
    mapChoiceCount: document.querySelectorAll("#japan-mode-list .map-mode-button").length,
    currentMapChoice: document.querySelector("#japan-mode-list .map-mode-button[aria-current='true']")?.textContent.trim(),
    mapChoiceListDisplay: getComputedStyle(document.querySelector("#japan-mode-list")).display,
    integratedMode: document.querySelector("#gaia-canvas")?.dataset.integratedMapMode,
    heading: document.querySelector("#japan-mode-title")?.textContent.trim(),
    bankKicker: document.querySelector("#map-mode-bank-kicker")?.textContent.trim(),
    bankGuide: document.querySelector("#map-mode-bank-guide")?.textContent.trim(),
    tooltipVisible: __qaVisible(document.querySelector("#map-mode-preview")),
    novelOpenAtCount: globalThis.__qaNovelOpenAtCount,
    spaceOpenAtCount: globalThis.__qaSpaceOpenAtCount,
    canvasParent: document.querySelector("#gaia-canvas")?.parentElement?.id,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert(!integrated.introVisible && integrated.mapLayerVisible && integrated.integratedClass);
  assert.equal(integrated.activeSurface, "map");
  assert.equal(integrated.lightIntegration, "mode-matched");
  assert(integrated.mapVisible && integrated.canvasVisible && integrated.canvasPointerEvents === "none");
  assert.equal(integrated.canvasParent, "japan-layer");
  assert.equal(integrated.mapChoiceCount, 15);
  assert.equal(integrated.currentMapChoice, "08");
  assert.equal(integrated.integratedMode, "08");
  assert.equal(integrated.mapChoiceListDisplay, "grid");
  assert.equal(integrated.heading, "人工物の共生化");
  assert.equal(integrated.bankKicker, "INSTALLATION BANK / MAP 01—30");
  assert.equal(integrated.bankGuide, "見たい地図展示を選んでください");
  assert.equal(integrated.tooltipVisible, false);
  assert.equal(integrated.novelOpenAtCount, 0);
  assert.equal(integrated.spaceOpenAtCount, 0);
  assert.equal(integrated.overflowX, false);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-integrated-light-entry.png`) });
  report.scans.push({ viewport: viewport.name, case: "mode-matched-light-integration", integrated, passed: true });
  await context.close();
};

const titleState = async (page) => page.evaluate(() => ({
  titleVisible: __qaVisible(document.querySelector("#novel-title-screen")),
  runtimeVisible: __qaVisible(document.querySelector("#novel-runtime")),
  novelVisibleCount: [...document.querySelectorAll("#novel-layer")].filter(__qaVisible).length,
  openingVisible: __qaVisible(document.querySelector("#gaia-opening")),
  introVisible: __qaVisible(document.querySelector("#intro-layer")),
  actionVisible: {
    start: __qaVisible(document.querySelector("#novel-start-button")),
    resume: __qaVisible(document.querySelector("#novel-resume-button")),
    load: __qaVisible(document.querySelector("#novel-title-load-button")),
    gallery: __qaVisible(document.querySelector("#novel-title-gallery-button")),
  },
  runtimeGalleryDomCount: document.querySelectorAll("#novel-gallery-button,#novel-gallery-count").length,
  progress: JSON.parse(localStorage.getItem("gaiaSensewareNovel:progress") || "null"),
  openAtCount: globalThis.__qaNovelOpenAtCount,
  novelOpenCount: globalThis.__qaNovelOpenCount,
  overflowX: document.documentElement.scrollWidth > innerWidth + 1,
  overflowY: document.documentElement.scrollHeight > innerHeight + 1,
}));

const assertTitle = (state) => {
  assert(state.titleVisible && !state.runtimeVisible && !state.openingVisible && !state.introVisible);
  assert.equal(state.novelVisibleCount, 1);
  assert.deepEqual(state.actionVisible, { start: true, resume: true, load: false, gallery: true });
  assert.equal(state.runtimeGalleryDomCount, 0);
  assert.equal(state.openAtCount, 1);
  assert.equal(state.novelOpenCount, 1);
  assert.equal(state.progress.stepId, progressFixture.stepId);
  assert.deepEqual(state.progress.unknownLocalField, progressFixture.unknownLocalField);
  assert.equal(state.overflowX, false);
  assert.equal(state.overflowY, false);
};

const scanIntroReturn = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-intro-return`);
  await openIntro(page);
  const before = await cardScan(page);
  assertCards(before, viewport);
  const focusGlint = await verifyCardFocusGlint(page, viewport);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-intro-simple.png`) });
  if (cardsOnly) {
    report.scans.push({ viewport: viewport.name, case: "intro-cards-only", before, focusGlint, passed: true });
    await context.close();
    return;
  }
  const scrollCue = await useScrollCue(page, viewport);
  const gxFeature = await scanGxFeature(page, viewport);
  const gxScreenshot = path.join(outputDir, `${viewport.name}-gx-feature-centered.png`);
  await page.screenshot({ path: gxScreenshot, fullPage: false });
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-intro-gx-feature.png`) });
  await scanCharacterFile(page, viewport);
  const returnButton = page.locator(".intro-story-return[data-primary-action='true']");
  if (viewport.action === "click") await returnButton.click();
  else {
    await returnButton.focus();
    await returnButton.press(viewport.action);
  }
  await page.waitForFunction(() => __qaVisible(document.querySelector("#novel-title-screen")));
  await page.waitForTimeout(80);
  const after = await titleState(page);
  assertTitle(after);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-novel-title.png`) });

  let album = null;
  if (["pc-1440", "mobile-390"].includes(viewport.name)) {
    await page.locator("#novel-title-gallery-button").click();
    await page.waitForFunction(() => __qaVisible(document.querySelector("#novel-gallery-panel")));
    album = await page.evaluate(() => ({
      visible: __qaVisible(document.querySelector("#novel-gallery-panel")),
      cardCount: document.querySelectorAll(".novel-gallery-card[data-unlocked='true']").length,
      progress: document.querySelector("#novel-title-gallery-progress")?.textContent.trim(),
    }));
    assert(album.visible && album.cardCount === 6 && /6\s*\/\s*6/u.test(album.progress));
    await page.locator(".novel-gallery-card[data-unlocked='true']").first().click();
    assert.equal(await page.locator("#novel-gallery-viewer").evaluate((element) => __qaVisible(element)), true);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-title-album-viewer.png`) });
    await page.locator("#novel-gallery-viewer-close").click();
    await page.locator("#novel-gallery-close").click();
  }

  report.scans.push({ viewport: viewport.name, case: `intro-return-${viewport.action}`, before, focusGlint, scrollCue, gxFeature, gxScreenshot, after, album, passed: true });
  await context.close();
};

const scanMetadataAndRuntimeGallery = async (viewport, stepId) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-${stepId}`);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await seedStorage(page, stepId);
  await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem("gaiaSensewareNovel:progress") || "null");
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([
      { progress, savedAt: Date.now(), meta: { title: "Story menu QA", excerpt: progress.stepId } },
    ]));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForTimeout(120);
  const scan = await page.evaluate(() => {
    const caption = document.querySelector(".novel-signal-caption");
    const style = getComputedStyle(caption);
    const strong = getComputedStyle(caption.querySelector("strong"));
    const before = getComputedStyle(caption, "::before");
    const after = getComputedStyle(caption, "::after");
    return {
      stepId: document.querySelector("#novel-layer")?.dataset.stepId,
      captionVisible: __qaVisible(caption),
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter,
      textShadow: strong.textShadow,
      pseudoBefore: before.display,
      pseudoAfter: after.display,
      runtimeGalleryDomCount: document.querySelectorAll("#novel-gallery-button,#novel-gallery-count").length,
      runtimeGalleryFocusable: [...document.querySelectorAll("#novel-gallery-button,#novel-gallery-count")].filter((element) => element.tabIndex >= 0).length,
      titleGalleryDomCount: document.querySelectorAll("#novel-title-gallery-button,#novel-title-gallery-progress").length,
      titleGalleryHidden: document.querySelector("#novel-title-gallery-button")?.hidden,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
      rect: caption.getBoundingClientRect().toJSON(),
    };
  });
  assert(scan.captionVisible);
  assert(["rgba(0, 0, 0, 0)", "transparent"].includes(scan.backgroundColor));
  assert(scan.backgroundImage.includes("radial-gradient"));
  assert(scan.borderWidths.every((width) => width === "0px"));
  assert.equal(scan.boxShadow, "none");
  assert(["none", ""].includes(scan.backdropFilter));
  assert.notEqual(scan.textShadow, "none");
  assert.equal(scan.pseudoBefore, "block");
  assert.equal(scan.pseudoAfter, "block");
  assert.equal(scan.runtimeGalleryDomCount, 0);
  assert.equal(scan.runtimeGalleryFocusable, 0);
  assert.equal(scan.titleGalleryDomCount, 2);
  assert.equal(scan.titleGalleryHidden, false);
  assert.equal(scan.overflowX, false);
  assert.equal(scan.overflowY, false);
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${stepId}-metadata.png`) });
  report.scans.push({ viewport: viewport.name, case: `metadata-runtime-${stepId}`, ...scan, passed: true });
  await context.close();
};

const scanIntroductionSequence = async (viewport) => {
  const expected = [
    ["festival_concept_020", "narration", "narrator", "", "返事を聞くと、青い髪の学生はわずかに目を細めた。画面の端へ触れると、地球が一度だけゆっくり明滅し、海から都市までの光が短くつながった。最初のデモを終えてから、彼女はケーブルを離し、体ごとこちらへ向き直る。"],
    ["festival_concept_021", "dialogue", "amane", "短髪の女性", "「改めまして、私は『あめ』です」"],
    ["festival_concept_022", "narration", "narrator", "", "「あめ」と名乗っても、照れたり笑ったりはしなかった。柔らかな響きとは対照的に、言葉は簡潔だった。"],
    ["festival_concept_023", "dialogue", "mizuha", "長髪の女性", "「みず」と申します。あなたも、うちの大学の方ですの？"],
    ["festival_concept_024", "narration", "narrator", "", "あめと、みず。空から地上へ、二人の名前だけでひとつの流れができていた。本名ではなく、学内で使っている名前らしい。オンラインの大学では、そのほうが自然だった。"],
    ["festival_concept_025", "narration", "narrator", "", "長い髪の学生もタブレットから顔を上げた。表情は落ち着いているが、「うちの大学」と言ったところで眉が少し上がる。答えを予想するより、こちらの返事を楽しみにしているように見えた。"],
    ["festival_concept_026", "narration", "narrator", "", "あめは名乗ったあとも、机の端のケーブルを指先で確かめている。みずはタブレットを両手で持ち、返事を待つあいだ、わずかに首を傾けていた。地球の青い光が、長い髪の内側へ薄く映っている。"],
    ["festival_concept_027", "dialogue", "visitor", "あなた", "「はい。同じ大学の学生です。今日は学生作品を見に来ました。広場から見えた、この地球が気になって」"],
  ];
  const { context, page } = await createPage(viewport, `${viewport.name}-introduction-sequence`);
  const scans = [];
  for (const [stepId, type, speaker, speakerLabel, text] of expected) {
    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await seedStorage(page, stepId);
    await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem("gaiaSensewareNovel:progress") || "null");
      localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([
        { progress, savedAt: Date.now(), meta: { title: "Introduction QA", excerpt: progress.stepId } },
      ]));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => globalThis.GaiaNovel.open());
    await page.locator("#novel-resume-button").click();
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
    await page.waitForTimeout(100);
    const scan = await page.evaluate(() => {
      const step = globalThis.GAIA_NOVEL_STORY.scenes.flatMap((scene) => scene.steps)
        .find((candidate) => candidate.id === document.querySelector("#novel-layer")?.dataset.stepId);
      const dialogueText = document.querySelector("#novel-text")?.textContent.trim();
      const pagination = globalThis.GaiaNovel.inspectDialoguePagination(step.text);
      const textElement = document.querySelector("#novel-text");
      const textRect = textElement.getBoundingClientRect();
      const dialogueRect = document.querySelector("#novel-dialogue")?.getBoundingClientRect();
      return {
        stepId: step.id,
        type: step.type,
        internalSpeaker: step.speaker,
        sourceText: step.text,
        speakerLabel: document.querySelector("#novel-speaker")?.textContent.trim(),
        dialogueText,
        pagination: pagination.pages.map((page) => ({ text: page.text, lines: page.lines, maxLines: page.maxLines, fits: page.fits })),
        measuredLines: Number(textElement.dataset.measuredLineCount || 0),
        maxLines: Number(textElement.dataset.maxLineCount || 0),
        safeArea: textRect.bottom <= dialogueRect.bottom + 1,
        cueId: document.querySelector("#novel-layer")?.dataset.backgroundCue,
        backgroundImage: getComputedStyle(document.querySelector("#novel-layer")).backgroundImage,
        formalNameEarly: /雨音|瑞葉/u.test(`${document.querySelector("#novel-speaker")?.textContent}\n${dialogueText}`),
        placementVerb: /置(?:く|か|き|け|こ|い)/u.test(step.text || ""),
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        overflowY: document.documentElement.scrollHeight > innerHeight + 1,
      };
    });
    assert.equal(scan.stepId, stepId);
    assert.equal(scan.type, type);
    assert.equal(scan.internalSpeaker, speaker);
    assert.equal(scan.sourceText, text);
    if (speakerLabel) assert.equal(scan.speakerLabel, speakerLabel);
    assert.equal(scan.dialogueText, scan.pagination[0].text);
    assert(scan.pagination.every((page) => page.fits && page.lines <= 3));
    assert(scan.measuredLines <= Math.max(3, scan.maxLines));
    assert(scan.safeArea && !scan.formalNameEarly && !scan.placementVerb);
    assert.equal(scan.overflowX, false);
    assert.equal(scan.overflowY, false);
    if (stepId === "festival_concept_024" && scan.pagination.length > 1) {
      for (let pageIndex = 1; pageIndex < scan.pagination.length; pageIndex += 1) {
        await page.locator("#novel-dialogue").click();
        await page.waitForFunction((expectedPage) => Number(document.querySelector("#novel-text")?.dataset.pageIndex) === expectedPage, pageIndex + 1);
        const pageScan = await page.evaluate(() => ({
          stepId: document.querySelector("#novel-layer")?.dataset.stepId,
          text: document.querySelector("#novel-text")?.textContent.trim(),
          pageIndex: Number(document.querySelector("#novel-text")?.dataset.pageIndex),
          measuredLines: Number(document.querySelector("#novel-text")?.dataset.measuredLineCount || 0),
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
          overflowY: document.documentElement.scrollHeight > innerHeight + 1,
        }));
        assert.equal(pageScan.stepId, stepId);
        assert.equal(pageScan.text, scan.pagination[pageIndex].text);
        assert(pageScan.measuredLines <= 3 && !pageScan.overflowX && !pageScan.overflowY);
        scan.renderedPages = scan.renderedPages || [{ pageIndex: 1, text: scan.dialogueText, measuredLines: scan.measuredLines }];
        scan.renderedPages.push(pageScan);
        await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${stepId}-decision-copy-page-${pageIndex + 1}.png`) });
      }
    }
    if (["festival_concept_021", "festival_concept_023", "festival_concept_024"].includes(stepId)) {
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${stepId}-decision-copy.png`) });
    }
    scans.push(scan);
  }
  assert(scans.slice(1, 3).every((scan) => scan.cueId === "festival-amane-closeup-cg"));
  assert(scans.slice(3, 7).every((scan) => scan.cueId === "festival-mizuha-closeup-cg"));
  assert.equal(scans[7].cueId, "festival-gaia-booth-conversation");
  report.scans.push({
    viewport: viewport.name,
    case: "introduction-decision-copy-020-027",
    interpretation: "024決定稿の後は025/026既存narrationを保持し、027が次のdialogue response。追加step・ID shiftなし。",
    scans,
    passed: true,
  });
  await context.close();
};

const scanRepeatAndBack = async () => {
  for (const viewport of viewports.filter(({ name }) => ["pc-1440", "pc-low-1366x600", "mobile-390", "mobile-320", "mobile-landscape-568"].includes(name))) {
  const { context, page } = await createPage(viewport, `${viewport.name}-repeat-back`);
  await openIntro(page);
  await page.evaluate(() => history.pushState({ qa: true }, "", "#explore"));
  await page.locator(".intro-story-return[data-primary-action='true']").click();
  await page.waitForFunction(() => (
    __qaVisible(document.querySelector("#novel-layer"))
    && (__qaVisible(document.querySelector("#novel-title-screen")) || __qaVisible(document.querySelector("#novel-runtime")))
  ));
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(80);
  const afterBack = await page.evaluate(() => ({
    titleVisible: __qaVisible(document.querySelector("#novel-title-screen")),
    runtimeVisible: __qaVisible(document.querySelector("#novel-runtime")),
    progress: JSON.parse(localStorage.getItem("gaiaSensewareNovel:progress") || "null"),
  }));
  assert(
    afterBack.titleVisible !== afterBack.runtimeVisible && afterBack.progress.stepId === progressFixture.stepId,
    `${viewport.name}: browser back lost the story surface or saved step: ${JSON.stringify(afterBack)}`,
  );
  if (afterBack.runtimeVisible) await page.locator("#novel-home-button").click();
  else await page.locator("#novel-close-button").click();
  await page.waitForFunction(() => __qaVisible(document.querySelector("#intro-layer")));
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.hidden === true);
  await page.locator(".intro-story-return[data-primary-action='true']").click();
  await page.waitForFunction(() => (
    __qaVisible(document.querySelector("#novel-layer"))
    && (__qaVisible(document.querySelector("#novel-title-screen")) || __qaVisible(document.querySelector("#novel-runtime")))
  ));
  const repeated = await page.evaluate(() => ({
    titleVisible: __qaVisible(document.querySelector("#novel-title-screen")),
    novelVisibleCount: [...document.querySelectorAll("#novel-layer")].filter(__qaVisible).length,
    runtimeVisible: __qaVisible(document.querySelector("#novel-runtime")),
    progress: JSON.parse(localStorage.getItem("gaiaSensewareNovel:progress") || "null"),
    openAtCount: globalThis.__qaNovelOpenAtCount,
    novelOpenCount: globalThis.__qaNovelOpenCount,
  }));
  assert(repeated.titleVisible !== repeated.runtimeVisible && repeated.novelVisibleCount === 1);
  assert.equal(repeated.progress.stepId, progressFixture.stepId);
  assert.deepEqual(repeated.progress.unknownLocalField, progressFixture.unknownLocalField);
  assert.equal(repeated.openAtCount, 2);
  assert.equal(repeated.novelOpenCount, 2);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((stepId) => (
    document.querySelector("#novel-layer")?.dataset.stepId === stepId
    && __qaVisible(document.querySelector("#novel-runtime"))
  ), progressFixture.stepId);
  const directResume = await page.evaluate(() => ({
    stepId: document.querySelector("#novel-layer")?.dataset.stepId,
    runtimeVisible: __qaVisible(document.querySelector("#novel-runtime")),
  }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction((stepId) => (
    document.querySelector("#novel-layer")?.dataset.stepId === stepId
    && __qaVisible(document.querySelector("#novel-runtime"))
  ), progressFixture.stepId);
  const reloadResume = await page.evaluate(() => ({
    stepId: document.querySelector("#novel-layer")?.dataset.stepId,
    runtimeVisible: __qaVisible(document.querySelector("#novel-runtime")),
  }));
  assert.deepEqual(directResume, { stepId: progressFixture.stepId, runtimeVisible: true });
  assert.deepEqual(reloadResume, directResume);
  report.scans.push({ viewport: viewport.name, case: "browser-back-repeat", afterBack, repeated, directResume, reloadResume, passed: true });
  await context.close();
  }
};

const scanRuntimeStoryContract = async () => {
  const viewport = viewports.find((entry) => entry.name === "pc-1440");
  const { context, page } = await createPage(viewport, "runtime-story-contract");
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GAIA_NOVEL_STORY));
  const scan = await page.evaluate(() => {
    const scenes = globalThis.GAIA_NOVEL_STORY.scenes;
    const steps = scenes.flatMap((scene) => scene.steps);
    const userVisible = steps.filter((step) => ["dialogue", "narration", "ui"].includes(step.type));
    const placementVerb = /置(?:く|か(?:ない|な|せ|ず|ぬ|れ|ろ|ん|せる|れる)?|き|け|こ|い(?:た|て|てある|ていた|ておく)?)/u;
    const containsCharacter = userVisible.filter((step) => String(step.text || "").includes("置"));
    const allText = steps.map((step) => String(step.text || "")).join("\n");
    return {
      sourceSha256: globalThis.GAIA_NOVEL_STORY.sourceSha256,
      sceneCount: scenes.length,
      stepCount: steps.length,
      userVisibleCount: userVisible.length,
      userVisiblePlacementVerbStepIds: userVisible.filter((step) => placementVerb.test(String(step.text || ""))).map((step) => step.id),
      excludedNounOccurrences: containsCharacter.map((step) => ({ stepId: step.id, text: step.text })),
      exactCounts: {
        old024: allText.split("あめと、みず。本名ではなく、学内で使っている名前らしい。オンラインの大学では、そのほうが自然だった。").length - 1,
        final024: allText.split("あめと、みず。空から地上へ、二人の名前だけでひとつの流れができていた。本名ではなく、学内で使っている名前らしい。オンラインの大学では、そのほうが自然だった。").length - 1,
        withdrawn: allText.split("雨が降って、水になる。二人の名前を並べると、偶然にしては出来すぎていた。").length - 1,
      },
    };
  });
  assert.equal(scan.sourceSha256, "27db292fbcfd2fc5130c9dcef8f33532ee0956abb559729347aa055dc5cd6b0c");
  assert.equal(scan.sceneCount, 6);
  assert.equal(scan.stepCount, 372);
  assert.deepEqual(scan.userVisiblePlacementVerbStepIds, []);
  assert.deepEqual(scan.excludedNounOccurrences.map((entry) => entry.stepId), ["festival_concept_028", "map_mode01_024", "esp32_pitch_016", "esp32_pitch_030"]);
  assert.deepEqual(scan.exactCounts, { old024: 0, final024: 1, withdrawn: 0 });
  report.scans.push({ viewport: viewport.name, case: "runtime-story-contract", ...scan, passed: true });
  await context.close();
};

try {
  if (repeatOnly) {
    await scanRepeatAndBack();
  } else if (gxFeatureOnly) {
    for (const viewport of viewports) await scanGxFeatureOnly(viewport);
  } else if (mapCopyOnly) {
    await scanMapActionCopy(viewports[2]);
    await scanMapActionCopy(viewports[3]);
  } else if (integratedLightOnly) {
    await scanIntegratedLightEntry(viewports[2]);
    await scanIntegratedLightEntry(viewports[3]);
  } else if (endingOnly) {
    await scanEndingDestinations();
  } else {
    for (const viewport of viewports) await scanIntroReturn(viewport);
  }
  if (!repeatOnly && !gxFeatureOnly && !mapCopyOnly && !integratedLightOnly && !introOnly && !endingOnly && !cardsOnly) {
    await scanEndingDestinations();
    await scanIntegratedLightEntry(viewports[2]);
    await scanIntegratedLightEntry(viewports[3]);
    await scanDirectMapEntry(viewports[2]);
    await scanDirectMapEntry(viewports[3]);
    await scanMetadataAndRuntimeGallery(viewports[0], "festival_concept_001");
    await scanMetadataAndRuntimeGallery(viewports[1], "festival_concept_008");
    await scanMetadataAndRuntimeGallery(viewports[2], "festival_concept_015");
    await scanMetadataAndRuntimeGallery(viewports[3], "festival_concept_001");
    await scanIntroductionSequence(viewports[2]);
    await scanIntroductionSequence(viewports[3]);
    await scanRuntimeStoryContract();
    await scanRepeatAndBack();
  }
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(JSON.stringify({ status: report.status, scans: report.scans.length, outputDir }, null, 2));

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4193"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/opening-route-cards-browser");
fs.mkdirSync(outputDir, { recursive: true });

const allViewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "pc-reference-1456x746", width: 1456, height: 746 },
  { name: "pc-4k", width: 3840, height: 2160 },
  { name: "mobile-280", width: 280, height: 653, mobile: true },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "landscape-568", width: 568, height: 320, mobile: true },
  { name: "landscape-667", width: 667, height: 375, mobile: true },
  { name: "landscape-844", width: 844, height: 390, mobile: true },
  { name: "reduced-motion", width: 1440, height: 900, reduced: true },
];
const viewports = process.env.GAIA_VIEWPORT
  ? allViewports.filter(({ name }) => name === process.env.GAIA_VIEWPORT)
  : allViewports;
if (viewports.length === 0) throw new Error(`Unknown GAIA_VIEWPORT: ${process.env.GAIA_VIEWPORT}`);
const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
      reducedMotion: viewport.reduced ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("gaia:opening-route-guide:v3", "seen");
      globalThis.__qaVisible = (element) => {
        if (!element || element.hidden || element.closest("[hidden]")) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
      };
    });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-sound-modal")));
    await page.locator("#gaia-opening-sound-off").click();
    if (!viewport.reduced) {
      await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-skip")), null, { timeout: 10_000 });
      await page.locator("#gaia-opening-skip").click();
    }
    await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-route-story")), null, { timeout: 10_000 });
    await page.waitForFunction(() => document.querySelector("#gaia-opening-route-guide")?.classList.contains("is-visible"), null, { timeout: 10_000 });
    await page.waitForFunction(() => document.activeElement?.id === "gaia-opening-route-guide", null, { timeout: 4_000 });

    const waitForExactSpotlight = async () => {
      const waitForMatch = () => page.waitForFunction(() => {
        const target = document.querySelector(".gaia-opening-route.is-route-guide-target");
        const shade = document.querySelector(".gaia-opening-route-guide-shade");
        if (!(target instanceof HTMLElement) || !(shade instanceof HTMLElement)) return false;
        const targetRect = target.getBoundingClientRect();
        const shadeRect = shade.getBoundingClientRect();
        return Math.abs(targetRect.left - shadeRect.left) <= 0.5
          && Math.abs(targetRect.top - shadeRect.top) <= 0.5
          && Math.abs(targetRect.width - shadeRect.width) <= 0.5
          && Math.abs(targetRect.height - shadeRect.height) <= 0.5;
      });
      await waitForMatch();
      if (!viewport.reduced) await page.waitForTimeout(260);
      await waitForMatch();
    };
    const readGuide = () => page.evaluate(() => {
      const guide = document.querySelector("#gaia-opening-route-guide");
      const bubble = guide.querySelector(".gaia-opening-route-guide-bubble");
      const title = guide.querySelector("[data-route-guide-title]");
      const shade = guide.querySelector(".gaia-opening-route-guide-shade");
      const target = document.querySelector(".gaia-opening-route.is-route-guide-target");
      const menu = document.querySelector("#gaia-opening-final-menu");
      const copy = guide.querySelector("[data-route-guide-copy]");
      const copyRect = copy.getBoundingClientRect();
      const surface = guide.querySelector(".gaia-opening-route-guide-surface");
      const surfaceStyle = getComputedStyle(surface);
      const tail = getComputedStyle(surface, "::before");
      const tailMatrix = new DOMMatrix(tail.transform);
      return {
        step: guide.dataset.step,
        targetId: target?.id,
        activeId: document.activeElement?.id,
        title: title?.textContent.trim() || "",
        titleHidden: title?.hidden,
        indexLabelCount: guide.querySelectorAll(".gaia-opening-route-guide-index, [data-route-guide-step]").length,
        inputBadgeCount: guide.querySelectorAll(".gaia-opening-route-guide-hint b").length,
        copy: guide.querySelector("[data-route-guide-copy]")?.textContent.trim(),
        copyOverflow: Array.from(copy.children).some(phrase => {
          const rect = phrase.getBoundingClientRect();
          return rect.left < copyRect.left - 1 || rect.right > copyRect.right + 1;
        }),
        kickerCount: guide.querySelectorAll("[data-route-guide-kicker]").length,
        hintCount: guide.querySelectorAll(".gaia-opening-route-guide-hint, [data-route-guide-hint-action]").length,
        buttonCount: guide.querySelectorAll("button").length,
        surfaceAnimation: getComputedStyle(guide.querySelector(".gaia-opening-route-guide-surface")).animationName,
        surfaceAnimationDuration: getComputedStyle(guide.querySelector(".gaia-opening-route-guide-surface")).animationDuration,
        surfaceRadius: surfaceStyle.borderRadius,
        surfaceOverflow: surfaceStyle.overflow,
        tail: {
          content: tail.content,
          width: Number.parseFloat(tail.width),
          height: Number.parseFloat(tail.height),
          rotation: Math.round(Math.atan2(tailMatrix.b, tailMatrix.a) * 180 / Math.PI),
          placement: bubble.dataset.placement,
          top: tail.top,
          bottom: tail.bottom,
          borderTop: tail.borderTopWidth,
          borderBottom: tail.borderBottomWidth,
        },
        bubbleRect: bubble.getBoundingClientRect().toJSON(),
        targetRect: target.getBoundingClientRect().toJSON(),
        shadeRect: shade.getBoundingClientRect().toJSON(),
        targetRadius: getComputedStyle(target).borderRadius,
        shadeRadius: getComputedStyle(shade).borderRadius,
        revealStartedAt: Number(menu.dataset.revealStartedAt),
        revealCompleteAt: Number(menu.dataset.revealCompleteAt),
        openedAt: Number(guide.dataset.openedAt),
      };
    });
    await waitForExactSpotlight();
    const guideSteps = [await readGuide()];
    assert.equal(guideSteps[0].step, "1");
    assert.equal(guideSteps[0].targetId, "gaia-opening-route-story");
    assert.equal(guideSteps[0].activeId, "gaia-opening-route-guide");
    assert.equal(guideSteps[0].title, "");
    assert.equal(guideSteps[0].titleHidden, true, `${viewport.name}: first route guide title is still visible`);
    assert.equal(guideSteps[0].indexLabelCount, 0, `${viewport.name}: removed route-guide heading returned`);
    assert.equal(guideSteps[0].inputBadgeCount, 0, `${viewport.name}: CLICK / TAP badge returned`);
    assert.equal(guideSteps[0].copy, "ビジュアルノベル風のストーリーを読みながら、インタラクティブに展示の世界を楽しめます。");
    assert.equal(guideSteps[0].kickerCount, 0, `${viewport.name}: route guide still contains category kickers`);
    assert.equal(guideSteps[0].buttonCount, 0, `${viewport.name}: route guide still contains operation buttons`);
    assert.equal(guideSteps[0].hintCount, 0);
    if (!viewport.reduced) {
      assert.equal(guideSteps[0].surfaceAnimation, "opening-guide-surface", `${viewport.name}: route guide entrance is missing`);
      assert(Number.parseFloat(guideSteps[0].surfaceAnimationDuration) >= 0.6, `${viewport.name}: route guide entrance is too short`);
    }
    const automaticGuideDelay = guideSteps[0].openedAt - guideSteps[0].revealStartedAt;
    assert(automaticGuideDelay >= 2900, `${viewport.name}: guide opened before the three-second title-screen delay`);
    assert(automaticGuideDelay <= 3600, `${viewport.name}: guide did not open about three seconds after the title screen appeared`);
    assert(Math.abs(guideSteps[0].openedAt - guideSteps[0].revealCompleteAt) <= 20, `${viewport.name}: guide timing marker drifted from its automatic opening`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-guide.png`), animations: "disabled" });

    await page.locator("#gaia-opening-route-guide").click({ position: { x: 8, y: 8 } });
    await page.waitForFunction(() => document.querySelector("#gaia-opening-route-guide")?.dataset.step === "2");
    await waitForExactSpotlight();
    const clickAdvancedGuide = await readGuide();
    assert.equal(clickAdvancedGuide.targetId, "gaia-opening-route-other", `${viewport.name}: click did not advance the guide`);
    assert.equal(clickAdvancedGuide.activeId, "gaia-opening-route-guide");
    assert.equal(clickAdvancedGuide.title, "");
    assert.equal(clickAdvancedGuide.titleHidden, true);
    assert.equal(clickAdvancedGuide.copy, "気候変動や観測ポイントを、インタラクティブな地図上で探索・分析できます。");
    assert.equal(clickAdvancedGuide.hintCount, 0);
    guideSteps.push(clickAdvancedGuide);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-guide-data.png`), animations: "disabled" });

    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector("#gaia-opening-route-guide")?.classList.contains("is-visible"));
    await page.locator("#gaia-opening-route-guide-replay").click();
    await page.waitForFunction(() => document.querySelector("#gaia-opening-route-guide")?.classList.contains("is-visible"));
    await waitForExactSpotlight();
    const replayedGuide = await readGuide();
    assert.equal(replayedGuide.step, "1", `${viewport.name}: replay did not restart the guide`);
    assert.equal(replayedGuide.targetId, "gaia-opening-route-story", `${viewport.name}: replay targets the wrong route`);
    assert.equal(replayedGuide.buttonCount, 0, `${viewport.name}: replayed guide restored removed buttons`);
    for (const guideStep of [...guideSteps, replayedGuide]) {
      assert.equal(guideStep.surfaceRadius, "15px", `${viewport.name}: rounded speech-bubble shape was lost`);
      assert.equal(guideStep.surfaceOverflow, "visible", `${viewport.name}: bubble clips its pointer`);
      assert.equal(guideStep.tail.content, '""', `${viewport.name}: speech-bubble pointer is missing`);
      assert.equal(guideStep.tail.width, 13);
      assert.equal(guideStep.tail.height, 13);
      assert.equal(guideStep.tail.rotation, 45, `${viewport.name}: bubble pointer is no longer triangular`);
      const pointsUp = guideStep.tail.placement === "below";
      assert.equal(pointsUp ? guideStep.tail.top : guideStep.tail.bottom, "-7px");
      assert.equal(pointsUp ? guideStep.tail.borderTop : guideStep.tail.borderBottom, "1px");
      assert.equal(guideStep.indexLabelCount, 0, `${viewport.name}: a route-guide heading returned`);
      assert.equal(guideStep.inputBadgeCount, 0, `${viewport.name}: a guide input badge returned`);
      assert.equal(guideStep.hintCount, 0, `${viewport.name}: removed guide footer returned`);
      assert.equal(guideStep.copyOverflow, false, `${viewport.name}: a phrase overflowed the guide`);
      assert(guideStep.bubbleRect.left >= 11 && guideStep.bubbleRect.right <= viewport.width - 11, `${viewport.name}: guide escaped the viewport horizontally`);
      assert(guideStep.bubbleRect.top >= 11 && guideStep.bubbleRect.bottom <= viewport.height - 11, `${viewport.name}: guide escaped the viewport vertically`);
      assert.equal(overlapArea(guideStep.bubbleRect, guideStep.targetRect), 0, `${viewport.name}: guide covers its target`);
      assert(Math.abs(guideStep.targetRect.left - guideStep.shadeRect.left) <= 0.5, `${viewport.name}: spotlight left edge is offset from ${guideStep.targetId}`);
      assert(Math.abs(guideStep.targetRect.top - guideStep.shadeRect.top) <= 0.5, `${viewport.name}: spotlight top edge is offset from ${guideStep.targetId}`);
      assert(Math.abs(guideStep.targetRect.width - guideStep.shadeRect.width) <= 0.5, `${viewport.name}: spotlight width does not match ${guideStep.targetId}`);
      assert(Math.abs(guideStep.targetRect.height - guideStep.shadeRect.height) <= 0.5, `${viewport.name}: spotlight height does not match ${guideStep.targetId}`);
      assert.equal(guideStep.shadeRadius, guideStep.targetRadius, `${viewport.name}: spotlight corners do not match ${guideStep.targetId}`);
    }
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("gaia:return-to-title")));
    await page.waitForFunction(() => document.querySelector("#gaia-opening-route-guide")?.classList.contains("is-visible"), null, { timeout: 10_000 });
    const repeatedGuide = await readGuide();
    assert.equal(repeatedGuide.step, "1", `${viewport.name}: returning to the title did not restart the guide`);
    assert(repeatedGuide.openedAt > replayedGuide.openedAt, `${viewport.name}: returning to the title did not open a fresh guide`);
    const repeatedGuideDelay = repeatedGuide.openedAt - repeatedGuide.revealStartedAt;
    assert(repeatedGuideDelay >= 2900 && repeatedGuideDelay <= 3600, `${viewport.name}: returning to the title did not reopen the guide after about three seconds`);
    await page.keyboard.press("Escape");
    await page.locator("#gaia-opening-route-story").focus();

    const layout = await page.evaluate(async () => {
      const readRect = (element) => element?.getBoundingClientRect().toJSON();
      const logo = document.querySelector(".gaia-vn-panel-final .gaia-vn-work-logo");
      if (logo instanceof HTMLImageElement && !logo.complete) await logo.decode();
      const logoRect = logo?.getBoundingClientRect();
      let logoVisibleBottom = logoRect?.bottom ?? 0;
      if (logo instanceof HTMLImageElement && logo.naturalWidth > 0 && logo.naturalHeight > 0 && logoRect) {
        const canvas = document.createElement("canvas");
        canvas.width = logo.naturalWidth;
        canvas.height = logo.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(logo, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let alphaBottom = -1;
        for (let y = canvas.height - 1; y >= 0 && alphaBottom < 0; y -= 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
              alphaBottom = y;
              break;
            }
          }
        }
        if (alphaBottom >= 0) logoVisibleBottom = logoRect.top + ((alphaBottom + 1) / canvas.height) * logoRect.height;
      }
      const poem = document.querySelector(".gaia-vn-panel-final .gaia-vn-final-choice > strong");
      const poemRect = poem?.getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll(".gaia-opening-route-grid .gaia-opening-route"), (card) => ({
        id: card.id,
        index: card.querySelector(".gaia-opening-route-index")?.textContent.trim(),
        label: card.querySelector("strong")?.textContent.trim(),
        english: card.querySelector(".gaia-opening-route-en")?.textContent.trim(),
        englishVisible: __qaVisible(card.querySelector(".gaia-opening-route-en")),
        rect: readRect(card),
        labelRect: readRect(card.querySelector("strong")),
        symbolRect: readRect(card.querySelector(".gaia-opening-route-symbol")),
        iconRect: readRect(card.querySelector(".gaia-opening-route-icon")),
        iconPosition: getComputedStyle(card.querySelector(".gaia-opening-route-icon")).position,
        boxShadow: getComputedStyle(card).boxShadow,
        backgroundImage: getComputedStyle(card).backgroundImage,
        glintDisplay: getComputedStyle(card, "::after").display,
        glintAnimationName: getComputedStyle(card, "::after").animationName,
        glintAnimationDuration: getComputedStyle(card, "::after").animationDuration,
        focusFlashDisplay: getComputedStyle(card, "::before").display,
        focusFlashAnimationName: getComputedStyle(card, "::before").animationName,
        focusFlashAnimationDuration: getComputedStyle(card, "::before").animationDuration,
      }));
      return {
        menuRect: readRect(document.querySelector("#gaia-opening-final-menu")),
        replayRect: readRect(document.querySelector("#gaia-opening-route-guide-replay")),
        replayLabel: document.querySelector("#gaia-opening-route-guide-replay strong")?.textContent.trim(),
        replayEnglish: document.querySelector("#gaia-opening-route-guide-replay small")?.textContent.trim(),
        finalCopyRect: readRect(document.querySelector(".gaia-vn-panel-final .gaia-vn-final-copy")),
        logoSrc: document.querySelector(".gaia-vn-panel-final .gaia-vn-work-logo")?.currentSrc,
        logoAlt: document.querySelector(".gaia-vn-panel-final .gaia-vn-work-logo")?.alt,
        logoRect: readRect(logo),
        logoVisibleBottom,
        poemRect: readRect(poem),
        poemLineHeight: Number.parseFloat(getComputedStyle(poem).lineHeight),
        poemTextAlign: getComputedStyle(poem).textAlign,
        poemLetterSpacing: Number.parseFloat(getComputedStyle(poem).letterSpacing),
        finalBackground: getComputedStyle(document.querySelector(".gaia-vn-panel-final .gaia-vn-final-photo")).backgroundImage,
        forbiddenTaglinePresent: document.querySelector(".gaia-vn-panel-final").textContent.includes("感じ、記録し、未来を選ぶ"),
        cards,
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      };
    });
    report.scans.push({ viewport: viewport.name, guideSteps, replayedGuide, repeatedGuide, layout, passed: false });
    assert(layout.menuRect.left >= 13 && layout.menuRect.right <= viewport.width - 13, `${viewport.name}: route menu is outside its safe area`);
    assert(layout.menuRect.top >= -1 && layout.menuRect.bottom <= viewport.height + 1, `${viewport.name}: route menu is outside the viewport vertically`);
    assert(layout.replayRect.width >= 44 && layout.replayRect.height >= 44, `${viewport.name}: guide replay hit area is smaller than 44px`);
    assert.equal(layout.replayLabel, "入口ガイド");
    assert.equal(layout.replayEnglish, "CHOICE GUIDE");
    assert.match(layout.logoSrc, /brand-logo-dark-surface-(?:590|1180)\.webp$/u, `${viewport.name}: final screen does not use the default logo`);
    assert.equal(layout.logoAlt, "惑星の放課後 — GAIA SENSATION");
    assert(layout.logoRect.left >= 0 && layout.logoRect.top >= 0 && layout.logoRect.right <= viewport.width + 1 && layout.logoRect.bottom <= viewport.height + 1, `${viewport.name}: final logo escaped the viewport`);
    if (viewport.name === "pc-4k") {
      assert(layout.logoRect.top <= viewport.height * 0.45, `${viewport.name}: final logo dropped below the intended title area`);
      assert(layout.menuRect.bottom <= viewport.height * 0.68, `${viewport.name}: route buttons dropped below the intended title area`);
    }
    const expectedGatewayAxis = viewport.width >= 961 && viewport.height >= 521
      ? Math.max(viewport.width * 0.26, Math.min(460, viewport.width * 0.44) + 18)
      : viewport.width / 2;
    const logoAxis = (layout.logoRect.left + layout.logoRect.right) / 2;
    const menuAxis = (layout.menuRect.left + layout.menuRect.right) / 2;
    assert(Math.abs(logoAxis - expectedGatewayAxis) <= 2, `${viewport.name}: final logo is not on the intended lighthouse-side axis`);
    assert(Math.abs(menuAxis - logoAxis) <= 2, `${viewport.name}: route buttons are not centered under the logo`);
    const minimumLogoWidth = viewport.height <= 430
      ? viewport.height
      : (viewport.width >= 961 ? Math.min(900, viewport.width * 0.62) : viewport.width * 0.7);
    assert(layout.logoRect.width >= minimumLogoWidth, `${viewport.name}: final logo does not use enough horizontal space`);
    assert.equal(layout.poemTextAlign, "center", `${viewport.name}: final poem is not center-aligned`);
    const minimumPoemLetterSpacing = viewport.width <= 320 ? 1.3 : 1.5;
    assert(layout.poemLetterSpacing >= minimumPoemLetterSpacing, `${viewport.name}: final poem characters are still cramped`);
    if (layout.poemRect.width > 0) {
      assert(Math.abs((layout.poemRect.left + layout.poemRect.right) / 2 - logoAxis) <= 2, `${viewport.name}: final poem block is not centered on the logo axis`);
      assert(layout.poemRect.top - layout.logoVisibleBottom >= layout.poemLineHeight, `${viewport.name}: final poem is less than one line below the visible logo`);
    }
    assert.match(layout.finalBackground, /01-starlit-observatory\.webp/u, `${viewport.name}: selected final background is not active`);
    assert.equal(layout.forbiddenTaglinePresent, false, `${viewport.name}: removed final-screen tagline returned`);
    assert.equal(layout.cards.length, 2, `${viewport.name}: route card count changed`);
    assert.equal(new Set(layout.cards.map(({ backgroundImage }) => backgroundImage)).size, 2, `${viewport.name}: the two independent routes are not color-distinguished`);
    assert.deepEqual(layout.cards.map(({ index }) => index), ["01 / STORY", "02 / DATA"]);
    assert.deepEqual(layout.cards.map(({ label }) => label), ["物語を始める", "データを探索する"]);
    assert.deepEqual(layout.cards.map(({ english }) => english), ["STORY EXPERIENCE", "DATA EXPLORATION"]);
    for (const card of layout.cards) {
      assert(card.rect.width >= 44 && card.rect.height >= 64, `${viewport.name}: ${card.id} hit area is too small`);
      assert(card.rect.left >= 13 && card.rect.right <= viewport.width - 13, `${viewport.name}: ${card.id} left the safe area`);
      assert.equal(card.englishVisible, false, `${viewport.name}: ${card.id} retains dashboard-like English metadata`);
      assert.equal(card.iconPosition, "static", `${viewport.name}: ${card.id} icon escaped its column`);
      assert.equal(card.boxShadow.includes(" 3px 0px 0px 0px inset"), false, `${viewport.name}: ${card.id} retains the asymmetric left glow rail`);
      assert.equal(card.boxShadow.includes(" 0px -2px 0px"), false, `${viewport.name}: ${card.id} retains the thick bottom accent`);
      assert.notEqual(card.backgroundImage, "none", `${viewport.name}: ${card.id} is transparent while unfocused`);
      assert.equal(card.glintDisplay, viewport.reduced ? "none" : "block", `${viewport.name}: ${card.id} glint layer is incorrect`);
      if (!viewport.reduced && card.id === "gaia-opening-route-story") {
        assert.equal(card.glintAnimationName, "opening-route-glint", `${viewport.name}: focused-card glint did not run`);
        assert.equal(card.glintAnimationDuration, "0.68s", `${viewport.name}: focused-card glint is mistimed`);
        assert.equal(card.focusFlashDisplay, "block", `${viewport.name}: focused-card reflection layer is hidden`);
        assert.equal(card.focusFlashAnimationName, "opening-route-focus-flash", `${viewport.name}: focused-card reflection did not run`);
        assert.equal(card.focusFlashAnimationDuration, "0.78s", `${viewport.name}: focused-card reflection is mistimed`);
      }
      if (viewport.reduced) assert.equal(card.focusFlashDisplay, "none", `${viewport.name}: reduced-motion focus flash remains visible`);
      assert.equal(overlapArea(card.labelRect, card.symbolRect), 0, `${viewport.name}: ${card.id} label overlaps its icon`);
      assert(Math.abs((card.iconRect.left + card.iconRect.right - card.symbolRect.left - card.symbolRect.right) / 2) <= 0.75, `${viewport.name}: ${card.id} icon is not horizontally centered`);
      assert(Math.abs((card.iconRect.top + card.iconRect.bottom - card.symbolRect.top - card.symbolRect.bottom) / 2) <= 1.25, `${viewport.name}: ${card.id} icon is not vertically centered`);
    }
    assert.equal(layout.overflowX, 0, `${viewport.name}: horizontal overflow remains`);
    assert.equal(layout.overflowY, 0, `${viewport.name}: vertical overflow remains`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-cards-focused.png`), animations: "disabled" });
    const beforeDataExit = await page.evaluate(() => {
      const rect = document.querySelector(".gaia-vn-panel-final .gaia-vn-work-logo")?.getBoundingClientRect();
      return rect?.toJSON();
    });
    await page.locator("#gaia-opening-route-other").click();
    await page.waitForFunction(() => document.querySelector("#gaia-opening")?.classList.contains("is-leaving"));
    await page.waitForTimeout(160);
    const duringDataExit = await page.evaluate(() => {
      const logo = document.querySelector(".gaia-vn-panel-final .gaia-vn-work-logo");
      const menu = document.querySelector("#gaia-opening-final-menu");
      return {
        logoRect: logo?.getBoundingClientRect().toJSON(),
        menuDisplay: getComputedStyle(menu).display,
        menuVisibility: getComputedStyle(menu).visibility,
      };
    });
    assert.equal(duringDataExit.menuDisplay, "grid", `${viewport.name}: data handoff removed the menu layout box`);
    assert.equal(duringDataExit.menuVisibility, "hidden", `${viewport.name}: data handoff did not fully hide the route cards`);
    assert(Math.abs(duringDataExit.logoRect.left - beforeDataExit.left) <= 1, `${viewport.name}: logo moved horizontally during data handoff`);
    assert(Math.abs(duringDataExit.logoRect.top - beforeDataExit.top) <= 1, `${viewport.name}: logo dropped during data handoff`);
    assert(Math.abs(duringDataExit.logoRect.width - beforeDataExit.width) <= 1, `${viewport.name}: logo resized during data handoff`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-data-exit.png`) });
    report.scans[report.scans.length - 1].passed = true;
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  console.log(`Opening route cards passed: ${report.scans.length} viewports`);
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

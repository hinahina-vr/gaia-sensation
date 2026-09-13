import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/opening-title-load-integration");
fs.mkdirSync(outputDir, { recursive: true });

const canonicalFile = "novel-bg-festival-five-plane-projection-autumn-morning-v2.png";
const forbiddenFiles = [
  "novel-bg-exhibition-v3.png",
  "novel-bg-exhibition-v2.png",
  "novel-bg-festival-projection-conversation-v1.png",
  "novel-bg-online-night-v2.png",
  "novel-bg-production-night-v2.png",
  "concept-04-co-created-future.png",
  "concept-01-earth-as-partner.png",
];
const viewportFlags = process.argv.slice(6);
const mobileOnly = viewportFlags.includes("--mobile-only");
const pcOnly = viewportFlags.includes("--pc-only");
const panelsOnly = viewportFlags.includes("--panels-only");
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  ...(panelsOnly ? [{ name: "mobile-short-360", width: 360, height: 700, mobile: true }] : []),
].filter(({ mobile }) => (!mobileOnly || mobile) && (!pcOnly || !mobile));
const savedProgress = {
  storyVersion: 13,
  stepId: "welcome_chat_038",
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気温の長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  audio: { muted: true, volume: 0.1 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "opening-title-load-integration",
};
const report = {
  status: "running",
  baseUrl,
  viewports,
  flows: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
      deviceScaleFactor: viewport.mobile ? 3 : 1,
      reducedMotion: "no-preference",
    });
    await context.addInitScript((progress) => {
      localStorage.clear();
      localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
        progress,
        savedAt: 1786597200000,
        meta: { title: "閉場後の展示ホール", excerpt: "チャットの保存地点" },
      }]));
      localStorage.setItem("gaiaSensewareTrueEnd:reached:v1", "2026-08-26T00:00:00.000Z");
      localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    }, savedProgress);
    const page = await context.newPage();
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
    await page.addInitScript(() => {
      globalThis.__qaVisible = (element) => {
        if (!element || element.hidden || element.closest("[hidden]")) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
      };
    });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-sound-modal")));
    const openingLeaks = await page.evaluate(() => [...document.querySelector(".experience").children]
      .filter((element) => !element.matches(".gaia-opening, .gaia-audio-dock, template"))
      .filter((element) => {
        if (element.hidden) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0
          && rect.width > 0
          && rect.height > 0;
      })
      .map((element) => element.id || element.className || element.tagName));
    assert.deepEqual(openingLeaks, [], `${viewport.name}: unstyled exploration UI leaked through the opening`);
    await page.locator("#gaia-opening-sound-off").click();
    await page.waitForFunction(() => !__qaVisible(document.querySelector("#gaia-opening-sound-modal")));
    await page.waitForFunction(() => !document.querySelector("#gaia-opening")?.classList.contains("is-preloading"), null, { timeout: 10000 });
    await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-skip")));
    const opening = await page.evaluate(() => {
      const copy = [...document.querySelectorAll(".gaia-vn-panel-character .gaia-vn-character-copy")];
      const byName = (name) => copy.find((node) => node.querySelector("h2")?.textContent.trim() === name);
      const read = (name) => {
        const node = byName(name);
        return {
          meta: node?.querySelector("p")?.textContent.replace(/\s+/gu, " ").trim(),
          quote: node?.querySelector("strong")?.textContent.trim(),
          reply: node?.querySelector(".gaia-vn-character-reply")?.textContent.trim(),
        };
      };
      const lineCount = (element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top))).size;
      };
      return {
        mizu: read("みず"),
        ame: read("あめ"),
        mizuQuoteBreak: Boolean(document.querySelector(".gaia-vn-panel-minamo .gaia-vn-quote-break")),
        mizuQuoteLines: lineCount(document.querySelector(".gaia-vn-panel-minamo strong")),
        characterBands: [...document.querySelectorAll(".gaia-vn-character-band")].map((node) => node.textContent.trim()),
        montageNames: [...document.querySelectorAll(".gaia-vn-word-rails small")].map((node) => node.textContent.trim()),
        montageActions: [...document.querySelectorAll(".gaia-vn-word-rails strong")].map((node) => node.textContent.trim()),
        mizuhaArt: getComputedStyle(document.querySelector(".gaia-vn-panel-minamo")).backgroundImage,
        amaneArt: getComputedStyle(document.querySelector(".gaia-vn-panel-sora")).backgroundImage,
        characterSpriteCount: document.querySelectorAll(".gaia-vn-character-focus, .gaia-vn-character-image").length,
        characterDecorationCount: document.querySelectorAll(".gaia-vn-character-copy > small").length,
        realEarthLabel: document.querySelector(".gaia-vn-real-earth-copy > small")?.textContent.trim(),
        realEarthHeading: document.querySelector(".gaia-vn-real-earth-copy h2")?.textContent.trim(),
        realEarthBody: document.querySelector(".gaia-vn-real-earth-body")?.textContent.trim(),
        realEarthFlow: document.querySelector(".gaia-vn-real-earth-flow")?.textContent.trim(),
        hasRealEarthDecoration: Boolean(document.querySelector(".gaia-vn-real-earth-copy > em")),
        realEarthArt: getComputedStyle(document.querySelector(".gaia-vn-panel-real-earth")).backgroundImage,
        realEarthDuration: getComputedStyle(document.querySelector(".gaia-vn-panel-real-earth")).animationDuration,
        realEarthDelay: getComputedStyle(document.querySelector(".gaia-vn-panel-real-earth")).animationDelay,
        montageLabel: document.querySelector(".gaia-vn-montage-label")?.textContent.trim(),
        montageHeading: document.querySelector(".gaia-vn-path-copy h2")?.textContent.trim(),
        montageHeadingLines: lineCount(document.querySelector(".gaia-vn-path-copy h2")),
        montageBody: document.querySelector(".gaia-vn-path-copy > p")?.textContent.trim(),
        montageDuration: getComputedStyle(document.querySelector(".gaia-vn-panel-montage")).animationDuration,
        montageDelay: getComputedStyle(document.querySelector(".gaia-vn-panel-montage")).animationDelay,
        stepLabels: [...document.querySelectorAll(".gaia-opening-steps span")].map((node) => node.textContent.trim()),
        soundGateCount: document.querySelectorAll("#gaia-opening-sound-gate").length,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        overflowY: document.documentElement.scrollHeight - innerHeight,
      };
    });
    assert.deepEqual(opening.mizu, {
      meta: "01 MIZU / FEEL",
      quote: "「海も空も生き物も、ぜんぶ影響し合って今の地球になってるんだよ。」",
      reply: "複雑に絡み合う生態系のつながりを、直感的なビジュアルで受け止める。",
    });
    assert.deepEqual(opening.ame, {
      meta: "02 AME / MEASURE",
      quote: "「数値で見ると、地球が呼吸してるリズムがちゃんとわかるね。」",
      reply: "手元のマイコンとセンサーから、リアルタイムの地球データを追いかける。",
    });
    assert.equal(opening.mizuQuoteBreak, true);
    if (viewport.width >= 390) assert.equal(opening.mizuQuoteLines, 2, `${viewport.name}: Mizu quote did not keep its intended two-line phrasing`);
    assert.deepEqual(opening.characterBands, ["MIZU　MIZU　MIZU", "AME　AME　AME　AME"]);
    assert.deepEqual(opening.montageNames, ["MIZU", "AME", "SAKUYA", "YOU"]);
    assert.deepEqual(opening.montageActions, ["感じる。", "測る。", "つなぐ。", "ともに選ぶ。"]);
    assert.match(opening.mizuhaArt, /opening-mizu-01(?:-834)?\.webp/u);
    assert.match(opening.amaneArt, /opening-ame-01(?:-834)?\.webp/u);
    assert.equal(opening.characterSpriteCount, 0);
    assert.equal(opening.characterDecorationCount, 0);
    assert.equal(opening.realEarthLabel, "REAL EARTH / OPEN DATA");
    assert.equal(opening.realEarthHeading, "手元の画面は、本物の地球とつながっている。");
    assert.equal(opening.realEarthBody, "CO₂濃度や気温など、世界中で観測されている実際のオープンデータを取得。生の数値をシェーダープログラムによって、リアルタイムに光や波紋のグラフィックへと変換しています。");
    assert.equal(opening.realEarthFlow, "観測する ── 描画する ── 体感する");
    assert.equal(opening.hasRealEarthDecoration, false);
    assert.match(opening.realEarthArt, /open-data-archive-bg-v1(?:-834)?\.webp/u);
    assert.equal(opening.realEarthDuration, "4.08s");
    assert.equal(opening.realEarthDelay, "9.8175s");
    assert.equal(opening.montageLabel, "SENSES / MEASURES / TRACES / CHOICES");
    assert.equal(opening.montageHeading, "未来は、ともに変わる。");
    assert.equal(opening.montageHeadingLines, 1, `${viewport.name}: transformation heading wrapped`);
    assert.equal(opening.montageBody, "この星の息づかいを、感じ、測り、つなぎ、ともに選ぶ。やがて、地球は静かに姿を変えていく。");
    assert.equal(opening.montageDuration, "4.08s");
    assert.equal(opening.montageDelay, "13.26s");
    assert.deepEqual(opening.stepLabels, ["01", "02", "03", "04", "05", "06"]);
    assert.equal(opening.soundGateCount, 0);
    assert(opening.overflowX <= 1 && opening.overflowY <= 1);

    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-opening.png`), animations: "disabled" });
    for (const panelName of ["minamo", "sora", "real-earth", "montage"]) {
      await page.evaluate((name) => {
        document.querySelector(".gaia-opening-hud")?.setAttribute("hidden", "");
        document.querySelectorAll("[data-opening-focus]").forEach((node) => node.classList.remove("is-opening-focus-pending"));
        document.querySelectorAll(".gaia-vn-panel").forEach((panel) => {
          panel.style.animation = "none";
          panel.style.opacity = "0";
          panel.style.visibility = "hidden";
        });
        const panel = document.querySelector(`.gaia-vn-panel-${name}`);
        panel.style.opacity = "1";
        panel.style.visibility = "visible";
        panel.style.filter = "none";
        panel.style.transform = "none";
      }, panelName);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-opening-${panelName}.png`), animations: "disabled" });
    }
    await page.evaluate(() => {
      document.querySelector(".gaia-opening-hud")?.removeAttribute("hidden");
      document.querySelectorAll(".gaia-vn-panel").forEach((panel) => panel.removeAttribute("style"));
    });
    if (panelsOnly) {
      await page.locator("#gaia-opening-skip").click();
      await page.locator("#gaia-opening-final-menu").waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector("#gaia-opening-final-menu")?.classList.contains("is-visible"));
      await page.waitForTimeout(700);
      const menuLayout = await page.evaluate(() => {
        const copy = document.querySelector(".gaia-vn-final-copy");
        const menu = document.querySelector("#gaia-opening-final-menu");
        const photo = document.querySelector(".gaia-vn-final-photo");
        const title = document.querySelector(".gaia-vn-work-title");
        const logo = title.querySelector(".gaia-vn-work-logo");
        const storyRoute = document.querySelector("#gaia-opening-route-story");
        const hud = document.querySelector(".gaia-opening-hud");
        const copyRect = copy.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        const photoStyle = getComputedStyle(photo);
        const storyStyle = getComputedStyle(storyRoute);
        return {
          copy: { top: copyRect.top, bottom: copyRect.bottom, height: copyRect.height },
          menu: { top: menuRect.top, bottom: menuRect.bottom, height: menuRect.height },
          menuPosition: getComputedStyle(menu).position,
          photoBackground: photoStyle.backgroundImage,
          photoBackgroundPosition: photoStyle.backgroundPosition,
          photoBackgroundSize: photoStyle.backgroundSize,
          titleText: logo?.alt,
          logoSrc: logo?.currentSrc,
          titleRect: { width: titleRect.width, height: titleRect.height },
          logoCount: document.querySelectorAll(".gaia-vn-panel-final .gaia-vn-work-logo").length,
          storySurface: {
            backgroundImage: storyStyle.backgroundImage,
            backdropFilter: storyStyle.backdropFilter,
            opacity: storyStyle.opacity,
          },
          hudDisplay: getComputedStyle(hud).display,
          trailingFinalCopyCount: document.querySelectorAll(".gaia-vn-final-copy > span").length,
          routes: [...document.querySelectorAll(".gaia-opening-route")].map((route) => ({
            action: route.querySelector("strong")?.textContent.trim(),
            microcopyCount: route.querySelectorAll("small, :scope > span").length,
          })),
          bottomGap: innerHeight - menuRect.bottom,
          overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
        };
      });
      assert.match(menuLayout.photoBackground, /01-starlit-observatory\.webp/u, `${viewport.name}: selected gateway artwork is missing`);
      assert.equal(menuLayout.titleText, "惑星の放課後 — GAIA SENSATION", `${viewport.name}: accessible work title changed`);
      assert.match(menuLayout.logoSrc, /brand-logo-dark-surface-(?:590|1180)\.webp$/u, `${viewport.name}: final title does not use the default logo`);
      assert(menuLayout.titleRect.width > 1 && menuLayout.titleRect.height > 1, `${viewport.name}: default logo is not visible`);
      assert.equal(menuLayout.logoCount, 1, `${viewport.name}: final title does not contain exactly one live logo`);
      assert.notEqual(menuLayout.storySurface.backgroundImage, "none", `${viewport.name}: story button is still transparent`);
      assert.equal(menuLayout.storySurface.backdropFilter, "none", `${viewport.name}: story button still relies on translucent backdrop blur`);
      assert.equal(menuLayout.storySurface.opacity, "1", `${viewport.name}: story button opacity reduced its text contrast`);
      assert.equal(menuLayout.hudDisplay, "none", `${viewport.name}: decorative microcopy remains visible behind the route menu`);
      assert.equal(menuLayout.trailingFinalCopyCount, 0, `${viewport.name}: obsolete explanation remains below the route choice`);
      assert.deepEqual(menuLayout.routes, [
        {
          action: "物語を始める",
          microcopyCount: 0,
        },
        {
          action: "データを探索する",
          microcopyCount: 0,
        },
      ], `${viewport.name}: route actions are not reduced to the two clear choices`);
      assert.equal(menuLayout.menuPosition, "static", `${viewport.name}: route menu is not anchored to the artwork layout`);
      if (viewport.mobile) {
        const artworkBottom = viewport.width * 9 / 16;
        assert(menuLayout.copy.top >= artworkBottom, `${viewport.name}: controls overlap the complete character artwork`);
        assert.equal(menuLayout.photoBackgroundPosition, "50% 0%", `${viewport.name}: complete artwork is not top aligned`);
        assert(["100%", "100% auto"].includes(menuLayout.photoBackgroundSize), `${viewport.name}: complete artwork is cropped`);
        assert(menuLayout.menu.bottom <= viewport.height - 40, `${viewport.name}: route menu leaves the safe viewport`);
        assert.equal(menuLayout.overflowX, 0, `${viewport.name}: bottom lockup overflows horizontally`);
        assert.equal(menuLayout.overflowY, 0, `${viewport.name}: bottom lockup overflows vertically`);
      } else {
        assert(menuLayout.copy.top >= viewport.height * 0.5, `${viewport.name}: route controls cover too much of the scene`);
        assert(menuLayout.copy.bottom <= viewport.height - 40, `${viewport.name}: route controls leave the viewport`);
      }
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-menu.png`), animations: "disabled" });
      report.flows.push({ viewport: viewport.name, opening, menuLayout, passed: true });
      await context.close();
      continue;
    }
    const routeMenuAlreadyVisible = await page.evaluate(() => __qaVisible(document.querySelector("#gaia-opening-route-story")));
    if (!routeMenuAlreadyVisible) {
      await page.evaluate(() => document.querySelector("#gaia-opening-skip")?.click());
    }
    await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-route-story")), null, { timeout: 30_000 });
    await page.locator("#gaia-opening-route-story").click();
    await page.waitForFunction(() => __qaVisible(document.querySelector("#novel-title-screen")), null, { timeout: 90_000 });
    const title = await page.evaluate(() => ({
      titleVisible: __qaVisible(document.querySelector("#novel-title-screen")),
      runtimeVisible: __qaVisible(document.querySelector("#novel-runtime")),
      subtitleCount: document.querySelectorAll(".novel-title-sub").length,
      resumeVisible: __qaVisible(document.querySelector("#novel-resume-button")),
      resumeText: document.querySelector("#novel-resume-button")?.textContent.trim(),
      resumeExpanded: document.querySelector("#novel-resume-button")?.getAttribute("aria-expanded"),
      obsoleteTitleLoadCount: document.querySelectorAll("#novel-title-load-button").length,
      actions: [...document.querySelectorAll(".novel-title-actions > button")].map((button) => button.textContent.replace(/\s+/gu, " ").trim()),
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
    }));
    assert(title.titleVisible && !title.runtimeVisible && title.resumeVisible);
    assert.equal(title.subtitleCount, 0);
    assert.equal(title.resumeText, "続きから");
    assert.equal(title.resumeExpanded, "false");
    assert.equal(title.obsoleteTitleLoadCount, 0);
    assert.equal(title.actions.some((text) => text.includes("セーブデータから")), false);
    assert(title.overflowX <= 1 && title.overflowY <= 1);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-title.png`), animations: "disabled" });

    await page.locator("#novel-resume-button").click();
    await page.waitForFunction(() => __qaVisible(document.querySelector("#novel-save-panel")));
    const loadPanel = await page.evaluate(() => ({
      visible: __qaVisible(document.querySelector("#novel-save-panel")),
      title: document.querySelector("#novel-save-title")?.textContent.trim(),
      loadSelected: document.querySelector("#novel-load-tab")?.getAttribute("aria-selected"),
      saveSelected: document.querySelector("#novel-save-tab")?.getAttribute("aria-selected"),
      saveDisabled: document.querySelector("#novel-save-tab")?.disabled,
      resumeExpanded: document.querySelector("#novel-resume-button")?.getAttribute("aria-expanded"),
      slots: document.querySelectorAll(".novel-save-slot").length,
      enabledSlots: document.querySelectorAll(".novel-save-slot[aria-disabled='false']").length,
      focusedSlot: document.activeElement?.matches(".novel-save-slot[data-slot-index='0']"),
      runtimeVisible: __qaVisible(document.querySelector("#novel-runtime")),
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
    }));
    assert(loadPanel.visible && loadPanel.title === "LOAD");
    assert.equal(loadPanel.loadSelected, "true");
    assert.equal(loadPanel.saveSelected, "false");
    assert.equal(loadPanel.saveDisabled, true);
    assert.equal(loadPanel.resumeExpanded, "true");
    assert.equal(loadPanel.slots, 6);
    assert.equal(loadPanel.enabledSlots, 1);
    assert(loadPanel.focusedSlot && !loadPanel.runtimeVisible && loadPanel.overflowX <= 1 && loadPanel.overflowY <= 1);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-load.png`), animations: "disabled" });

    const requestOffset = requests.length;
    await page.locator(".novel-save-slot[data-slot-index='0']").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "welcome_chat_038");
    await page.waitForTimeout(1_000);
    const restored = await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      const workspace = document.querySelector(".novel-slack-workspace");
      const rect = workspace.getBoundingClientRect();
      const images = [...document.querySelectorAll(".novel-slack-avatar img")];
      const apple = document.querySelector('.novel-slack-avatar[data-symbol="green-apple"] .novel-slack-apple-body');
      return {
        stepId: layer.dataset.stepId,
        titleVisible: __qaVisible(document.querySelector("#novel-title-screen")),
        runtimeVisible: __qaVisible(document.querySelector("#novel-runtime")),
        loadVisible: __qaVisible(document.querySelector("#novel-save-panel")),
        backgroundImage: getComputedStyle(layer).backgroundImage,
        centerDeviationX: rect.left + rect.width / 2 - innerWidth / 2,
        centerDeviationY: rect.top + rect.height / 2 - innerHeight / 2,
        workspaceInViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
        dialogueHidden: document.querySelector("#novel-dialogue")?.hidden,
        vnText: document.querySelector("#novel-text")?.textContent,
        vnSpeaker: document.querySelector("#novel-speaker")?.textContent,
        appleColor: apple ? getComputedStyle(apple).fill : "",
        appleImageCount: document.querySelectorAll('.novel-slack-avatar[data-symbol="green-apple"] img').length,
        v2Mascots: images.filter((image) => /slack-avatar-(?:amane|mizuha)-v2\.webp/u.test(image.currentSrc)).map((image) => ({
          src: image.currentSrc,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          rect: image.closest(".novel-slack-avatar").getBoundingClientRect().toJSON(),
        })),
        v1Mascots: images.filter((image) => /slack-avatar-(?:amane|mizuha)-v1\.webp/u.test(image.currentSrc)).length,
        humanAvatars: document.querySelectorAll(".novel-slack-avatar[data-human-avatar], .novel-slack-avatar img[src*='/characters/']").length,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        overflowY: document.documentElement.scrollHeight - innerHeight,
      };
    });
    assert(restored.stepId === "welcome_chat_038" && restored.runtimeVisible && !restored.titleVisible && !restored.loadVisible);
    assert(restored.backgroundImage.includes(canonicalFile));
    const verticalPositionValid = viewport.mobile
      ? restored.centerDeviationY <= 0 && restored.centerDeviationY >= -24
      : Math.abs(restored.centerDeviationY) <= 1;
    assert(
      Math.abs(restored.centerDeviationX) <= 1 && verticalPositionValid && restored.workspaceInViewport,
      `${viewport.name}: restored chat is not centered in the viewport ${JSON.stringify({
        centerDeviationX: restored.centerDeviationX,
        centerDeviationY: restored.centerDeviationY,
        workspaceInViewport: restored.workspaceInViewport,
      })}`,
    );
    assert(restored.dialogueHidden && restored.vnText === "" && restored.vnSpeaker === "");
    assert.equal(restored.appleColor, "rgb(88, 168, 76)");
    assert.equal(restored.appleImageCount, 0);
    assert(
      restored.v2Mascots.length > 0
        && restored.v2Mascots.every((image) => image.complete && image.naturalWidth === 512 && image.naturalHeight === 512 && image.rect.width >= 24),
      `${viewport.name}: invalid mascot render ${JSON.stringify(restored.v2Mascots)}`,
    );
    assert.equal(restored.v1Mascots, 0);
    assert.equal(restored.humanAvatars, 0);
    assert(restored.overflowX <= 1 && restored.overflowY <= 1);
    const runtimeRequests = requests.slice(requestOffset);
    assert.equal(runtimeRequests.filter((url) => forbiddenFiles.some((file) => url.includes(file))).length, 0);
    assert.equal(runtimeRequests.filter((url) => /slack-avatar-(?:amane|mizuha)-v1\.webp(?:\?|$)/u.test(url)).length, 0);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-restored-chat.png`), animations: "disabled" });

    report.flows.push({ viewport: viewport.name, opening, title, loadPanel, restored, runtimeRequests, passed: true });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
  console.log(`opening/title/LOAD integration passed: ${report.flows.length} viewport flows`);
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

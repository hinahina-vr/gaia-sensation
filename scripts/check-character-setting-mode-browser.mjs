import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4202"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "E:/CodexData/temp/gaia-character-profile-browser");
fs.mkdirSync(outputDir, { recursive: true });

const allViewports = [
  { name: "pc-1440", width: 1440, height: 900, mobile: false },
  { name: "pc-4k", width: 3840, height: 2160, mobile: false },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-320", width: 320, height: 568, mobile: true },
  { name: "reduced-motion", width: 1440, height: 900, mobile: false, reduced: true },
];
const viewports = process.env.GAIA_VIEWPORT
  ? allViewports.filter(({ name }) => name === process.env.GAIA_VIEWPORT)
  : allViewports;
if (viewports.length === 0) throw new Error(`Unknown GAIA_VIEWPORT: ${process.env.GAIA_VIEWPORT}`);
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], expectedNetworkDenied: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });
const normalizeAnimatedText = (value) => value?.replaceAll("\u00a0", " ");

const attachDiagnostics = (page, name) => {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes("net::ERR_NETWORK_ACCESS_DENIED")) report.expectedNetworkDenied.push(name + ": " + message.text());
    else report.consoleErrors.push(name + ": " + message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(name + ": " + error.message));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(name + ": " + response.url());
  });
};

const inspect = (page) => page.evaluate(() => {
  const layer = document.querySelector("#character-book-layer");
  const scroller = document.querySelector("#character-book-scroll");
  const hero = document.querySelector("#character-book-hero");
  const image = document.querySelector("#character-book-image");
  const canvas = document.querySelector("#character-book-webgl");
  const lead = document.querySelector(".character-book-lead");
  const quote = document.querySelector("#character-book-quote");
  const master = document.querySelector("#character-book-master");
  const header = document.querySelector(".character-book-header");
  const close = document.querySelector("#character-book-close");
  const rect = (element) => element?.getBoundingClientRect().toJSON();
  return {
    layerPosition: getComputedStyle(layer).position,
    layerRect: rect(layer),
    heroRect: rect(hero),
    imageRect: rect(image),
    quoteRect: rect(quote),
    canvasRect: rect(canvas),
    webglState: canvas?.dataset.webglState || "missing",
    webglRendered: canvas?.dataset.webglRendered || "false",
    webglWidth: canvas instanceof HTMLCanvasElement ? canvas.width : 0,
    webglHeight: canvas instanceof HTMLCanvasElement ? canvas.height : 0,
    webglOpacity: Number.parseFloat(getComputedStyle(canvas).opacity || "0"),
    imageSource: image?.currentSrc || "",
    imageAlt: image?.alt || "",
    selectors: document.querySelectorAll("[data-character-select]").length,
    activeSelectors: [...document.querySelectorAll("[data-character-select]")]
      .filter((button) => button.getAttribute("aria-current") === "true").length,
    expressions: document.querySelectorAll("[data-character-expression]").length,
    activeExpressions: [...document.querySelectorAll("[data-character-expression]")]
      .filter((button) => button.getAttribute("aria-pressed") === "true").length,
    expressionName: document.querySelector("#character-book-expression-name")?.textContent.trim(),
    expressionId: layer?.dataset.expressionId,
    profiles: document.querySelectorAll("[data-character-profile]").length,
    oldCompactProfiles: document.querySelectorAll(".character-book-hero-profile").length,
    brandMarks: document.querySelectorAll(".character-book-mark").length,
    headerRect: rect(header),
    closeRect: rect(close),
    closeText: close?.textContent.trim(),
    current: document.querySelector("#character-book-current")?.textContent.trim(),
    title: document.querySelector("#character-book-page-title")?.textContent.replace(/\s+/gu, " ").trim(),
    tagline: document.querySelector("#character-book-tagline")?.textContent.trim(),
    fullName: document.querySelector("#character-book-full-name")?.textContent.trim(),
    reading: document.querySelector("#character-book-reading")?.textContent.trim(),
    profile: document.querySelector("#character-book-profile")?.textContent.trim(),
    profileLines: document.querySelectorAll("#character-book-profile > span").length,
    profileShadow: document.querySelector("#character-book-profile")
      ? getComputedStyle(document.querySelector("#character-book-profile")).textShadow
      : "none",
    quote: quote?.textContent.trim(),
    quoteWritingMode: quote ? getComputedStyle(quote).writingMode : "missing",
    statusRows: document.querySelectorAll(".character-book-hero-detail dl").length,
    cgCards: document.querySelectorAll("[data-character-cg-id]").length,
    cgPoemLines: document.querySelectorAll(".character-book-cg-card-poem > span").length,
    cgTitles: [...document.querySelectorAll(".character-book-cg-card-copy > strong")].map((element) => element.textContent.trim()),
    cgAssets: [...document.querySelectorAll(".character-book-cg-card-visual img")].map((element) => element.getAttribute("src")),
    masterRect: rect(master),
    characterId: layer?.dataset.characterId,
    bodyMode: document.body.classList.contains("character-mode-open"),
    ariaHidden: layer?.getAttribute("aria-hidden"),
    role: layer?.getAttribute("role"),
    modal: layer?.getAttribute("aria-modal"),
    scrollHeight: scroller?.scrollHeight || 0,
    clientHeight: scroller?.clientHeight || 0,
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    leadOverflow: lead ? Math.max(0, lead.scrollWidth - lead.clientWidth) : -1,
  };
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.mobile,
      reducedMotion: viewport.reduced ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await page.goto(new URL("/#character", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("#character-book-layer").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForFunction(() => {
      const image = document.querySelector("#character-book-image");
      return image?.complete && image.naturalWidth > 0
        && document.querySelector("#character-book-webgl")?.dataset.webglRendered === "true"
        && document.querySelectorAll("[data-character-expression]").length === 4
        && document.querySelector("#character-book-layer")?.dataset.expressionId === "calm";
    });

    const initial = await inspect(page);
    assert.equal(initial.layerPosition, "fixed", viewport.name + ": character page is not an independent full-screen surface");
    assert.equal(initial.bodyMode, true, viewport.name + ": character body mode is missing");
    assert.equal(initial.ariaHidden, "false", viewport.name + ": dialog remains hidden");
    assert.equal(initial.role, "dialog", viewport.name + ": dialog role is missing");
    assert.equal(initial.modal, "true", viewport.name + ": modal state is missing");
    assert.equal(initial.selectors, 4, viewport.name + ": four-character selector is incomplete");
    assert.equal(initial.activeSelectors, 1, viewport.name + ": selector active state is ambiguous");
    assert.equal(initial.expressions, 4, viewport.name + ": Amane expression selector is incomplete");
    assert.equal(initial.activeExpressions, 1, viewport.name + ": expression active state is ambiguous");
    assert.equal(initial.expressionName, "通常", viewport.name + ": opening expression label is incorrect");
    assert.equal(initial.expressionId, "calm", viewport.name + ": opening expression is not calm");
    assert.equal(initial.profiles, 0, viewport.name + ": duplicate lower profiles remain");
    assert.equal(initial.oldCompactProfiles, 0, viewport.name + ": old compact hero profile remains");
    assert.equal(initial.brandMarks, 0, viewport.name + ": GAIA SENSEWARE header mark remains");
    assert.equal(initial.closeText, "戻る", viewport.name + ": back control label is incorrect");
    assert(initial.closeRect.left < (viewport.mobile ? 28 : 90), viewport.name + ": back control is not placed at the left edge");
    assert.equal(initial.current, "01", viewport.name + ": Amane is not the opening character");
    assert.equal(initial.title, "あめ｜雨宮 周あめみや あまね", viewport.name + ": opening profile title is incorrect");
    assert.match(initial.imageSource, /amane-calm-07-v2\.png/u, viewport.name + ": opening character art is incorrect");
    assert.equal(initial.tagline, "20,000ルーメンを背負う電工少女");
    assert.equal(normalizeAnimatedText(initial.fullName), "雨宮 周");
    assert.equal(normalizeAnimatedText(initial.reading), "あめみや あまね");
    assert.equal(initial.profile, "水色のショートボブと眠そうな目元が特徴の大学2年生。普段は無口で省エネ運転だが、電気やエネルギーの話になると途端にスイッチが入る。電気工事士・電気主任技術者の資格を持ち、現場の機材設営から安全管理までを一手に担う実践派。");
    assert.equal(initial.profileLines, 3, viewport.name + ": Amane profile is not split at sentence endings");
    assert.notEqual(initial.profileShadow, "none", viewport.name + ": profile lacks contrast shadow");
    assert.equal(initial.quote, "「信号線とは違うの。一本飛んだら、本当に終わるよ」");
    assert.equal(
      initial.quoteWritingMode,
      viewport.mobile ? "horizontal-tb" : "vertical-rl",
      viewport.name + ": character quote orientation is incorrect",
    );
    assert.equal(initial.statusRows, 0, viewport.name + ": FIELD / ROLE / TOOLS remain in the hero");
    assert.equal(initial.cgCards, 6, viewport.name + ": story CG archive is incomplete");
    assert.equal(initial.cgPoemLines, 12, viewport.name + ": every story CG does not have a two-line poem");
    assert.deepEqual(initial.cgTitles, [
      "はじめまして",
      "手元のあかり",
      "澄んだまなざし",
      "小さな設計図",
      "輪のなかへ",
      "夕暮れの帰り道",
    ], viewport.name + ": story CG archive order is incorrect");
    assert.deepEqual(initial.cgAssets.map((source) => source?.replace(/^.*\/assets/u, "assets").replace(/\?.*$/u, "")), [
      "assets/visuals-07/event-cg-first-encounter-five-plane-v3.png",
      "assets/visuals-07/event-cg-amane-closeup-five-plane-v4.png",
      "assets/visuals-07/event-cg-mizuha-closeup-five-plane-v3.png",
      "assets/visuals-07/event-cg-esp32-collaboration-v2.png",
      "assets/visuals-07/event-cg-circle-welcome-v2.png",
      "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp",
    ], viewport.name + ": story CG archive is not using the game assets");
    assert(initial.imageAlt.length >= 10, viewport.name + ": hero character alt text is missing");
    assert.equal(initial.webglState, "ready", viewport.name + ": WebGL atmosphere did not initialize");
    assert.equal(initial.webglRendered, "true", viewport.name + ": WebGL atmosphere did not render");
    assert(initial.webglWidth > 0 && initial.webglHeight > 0, viewport.name + ": WebGL buffer is empty");
    assert(initial.webglOpacity > 0, viewport.name + ": WebGL atmosphere is not visible");
    assert(initial.canvasRect.left <= 0 && initial.canvasRect.top <= 0, viewport.name + ": WebGL canvas is offset");
    assert(initial.heroRect.height >= viewport.height * 0.9, viewport.name + ": hero does not occupy the viewport");
    assert(initial.scrollHeight > initial.clientHeight * 1.4, viewport.name + ": character reference document is missing");
    assert.equal(initial.overflowX, 0, viewport.name + ": page has horizontal overflow");
    if (viewport.mobile) {
      assert(
        initial.quoteRect.bottom <= initial.imageRect.top + initial.imageRect.height * 0.08,
        viewport.name + ": key line overlaps the visible character art "
          + JSON.stringify({ quote: initial.quoteRect, image: initial.imageRect }),
      );
    }
    if (!viewport.mobile) assert(initial.leadOverflow <= 1, viewport.name + ": one-line lead is clipped");

    await page.screenshot({ path: path.join(outputDir, viewport.name + "-character-hero.png"), fullPage: false });

    const amaneSoft = page.locator('[data-character-expression="soft"]');
    if (viewport.mobile) await amaneSoft.click();
    else await amaneSoft.hover();
    await page.waitForFunction(() => /amane-soft-07-v2\.png/u.test(document.querySelector("#character-book-image")?.currentSrc || ""));
    if (!viewport.reduced) {
      await page.waitForFunction(() => document.querySelector("#character-book-image")?.classList.contains("is-switching")
        && document.querySelectorAll(".character-book-hero-ghost").length === 1);
    }
    const amaneExpression = await inspect(page);
    assert.equal(amaneExpression.expressionId, "soft", viewport.name + ": Amane hover expression did not activate");
    assert.equal(amaneExpression.expressionName, "微笑み", viewport.name + ": Amane expression label did not update");
    assert.equal(amaneExpression.activeExpressions, 1, viewport.name + ": Amane expression selection is ambiguous");
    assert.match(amaneExpression.imageAlt, /微笑/u, viewport.name + ": expression-specific alt text is missing");

    await page.locator('[data-character-select="mizuha"]').click();
    await page.waitForFunction(() => document.querySelector("#character-book-layer")?.dataset.characterId === "mizuha"
      && document.querySelector("#character-book-current")?.textContent.trim() === "02"
      && /mizuha-calm-07-v2\.png/u.test(document.querySelector("#character-book-image")?.currentSrc || ""));
    const mizuha = await inspect(page);
    assert.equal(mizuha.title, "みず｜青野 瑞葉あおの みずは", viewport.name + ": Mizuha profile did not update");
    assert.equal(mizuha.tagline, "星の呼吸を言葉にする語り部");
    assert.equal(normalizeAnimatedText(mizuha.fullName), "青野 瑞葉");
    assert.equal(normalizeAnimatedText(mizuha.reading), "あおの みずは");
    assert.equal(mizuha.profile, "海色の長い髪とおっとりした丁寧語が印象的な大学2年生。大気と水系の循環に関心を持ち、観測データの科学考証と、地球の動態を読み解くストーリーテリングを担当する。物腰は穏やかだが、データの出典や数字の正確さ、観測条件の厳密さには決して妥協しない。");
    assert.equal(mizuha.profileLines, 5, viewport.name + ": Mizuha profile must use five authored lines");
    assert.equal(mizuha.quote, "「46億年、ずっと変わり続けている星ですから」");
    assert.equal(mizuha.activeSelectors, 1, viewport.name + ": Mizuha selection produced multiple active portraits");
    assert.equal(mizuha.expressions, 4, viewport.name + ": Mizuha expression selector is incomplete");
    assert.equal(mizuha.activeExpressions, 1, viewport.name + ": Mizuha expression selection is ambiguous");
    assert.equal(mizuha.expressionId, "calm", viewport.name + ": character change did not reset the expression");

    const mizuhaWorried = page.locator('[data-character-expression="worried"]');
    if (viewport.mobile) await mizuhaWorried.click();
    else await mizuhaWorried.hover();
    await page.waitForFunction(() => /mizuha-worried-07-v2\.png/u.test(document.querySelector("#character-book-image")?.currentSrc || ""));
    const mizuhaExpression = await inspect(page);
    assert.equal(mizuhaExpression.expressionId, "worried", viewport.name + ": Mizuha hover expression did not activate");
    assert.equal(mizuhaExpression.expressionName, "心配", viewport.name + ": Mizuha expression label did not update");

    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector("#character-book-layer")?.dataset.characterId === "sakuya"
      && document.querySelector("#character-book-current")?.textContent.trim() === "03");
    const sakuya = await inspect(page);
    assert.equal(sakuya.title, "saku｜木下 咲弥きのした さくや", viewport.name + ": keyboard character change failed");
    assert.equal(sakuya.tagline, "海を隔てて世界を繋ぐアーキテクト");
    assert.equal(normalizeAnimatedText(sakuya.fullName), "木下 咲弥");
    assert.equal(normalizeAnimatedText(sakuya.reading), "きのした さくや");
    assert.match(sakuya.imageSource, /sakuya-calm-07-v1\.png/u, viewport.name + ": Sakuya art did not load");
    assert.equal(normalizeAnimatedText(sakuya.profile), "海外からオンラインで参加するサークルのプロデューサー。普段のチャットでは無駄口を叩かないが、作品の構想やシステムデザインの議論では、圧倒的な解像度を発揮する。『GAIA SENSEWARE』の名付け親であり、プロジェクトの骨格を支えるシステムアーキテクト。");
    assert.equal(sakuya.profileLines, 5, viewport.name + ": Sakuya profile must use five authored lines");
    assert.equal(sakuya.quote, "「まだ気づいてないだけでしょ。世界は満ちてるよ」");
    assert.equal(sakuya.expressions, 4, viewport.name + ": Sakuya expression selector is incomplete");
    assert.equal(sakuya.expressionId, "calm", viewport.name + ": Sakuya did not open with the calm expression");

    await page.locator("#character-book-cg").evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(viewport.reduced ? 30 : 180);
    const galleryState = await page.locator("#character-book-cg").evaluate((element) => {
      const cards = [...element.querySelectorAll(".character-book-cg-card")];
      const rects = cards.map((card) => card.getBoundingClientRect().toJSON());
      return {
        width: element.getBoundingClientRect().width,
        cardWidths: rects.map((rect) => rect.width),
        overflowX: Math.max(0, element.scrollWidth - element.clientWidth),
        firstAlt: cards[0]?.querySelector("img")?.alt,
      };
    });
    assert(galleryState.width > 0, viewport.name + ": story CG archive collapsed");
    assert(galleryState.cardWidths.every((width) => width > 0), viewport.name + ": story CG card collapsed");
    assert.equal(galleryState.overflowX, 0, viewport.name + ": story CG archive has horizontal overflow");
    assert.match(galleryState.firstAlt, /ミズハ.*アマネ/u, viewport.name + ": story CG alt text is missing");
    await page.screenshot({ path: path.join(outputDir, viewport.name + "-character-cg-archive.png"), fullPage: false });

    const firstCg = page.locator('[data-character-cg-id="first-encounter"]');
    await firstCg.click();
    await page.locator("#character-book-cg-viewer").waitFor({ state: "visible", timeout: 5000 });
    await page.waitForFunction(() => {
      const image = document.querySelector("#character-book-cg-viewer-image");
      const viewer = document.querySelector("#character-book-cg-viewer");
      return image?.complete && image.naturalWidth > 0
        && viewer?.classList.contains("is-open")
        && Number.parseFloat(getComputedStyle(viewer).opacity) > 0.9;
    });
    const firstCgViewer = await page.locator("#character-book-cg-viewer").evaluate((viewer) => ({
      id: viewer.dataset.characterCgId,
      ariaHidden: viewer.getAttribute("aria-hidden"),
      title: viewer.querySelector("#character-book-cg-viewer-title")?.textContent.trim(),
      chapter: viewer.querySelector("#character-book-cg-viewer-chapter")?.textContent.trim(),
      count: viewer.querySelector("#character-book-cg-viewer-count")?.textContent.trim(),
      poem: [...viewer.querySelectorAll("#character-book-cg-viewer-poem > span")].map((line) => line.textContent.trim()),
      imageSource: viewer.querySelector("#character-book-cg-viewer-image")?.currentSrc,
      imageAlt: viewer.querySelector("#character-book-cg-viewer-image")?.alt,
      focusedClose: document.activeElement?.classList.contains("character-book-cg-viewer-close"),
      viewerOpacity: getComputedStyle(viewer).opacity,
      viewerRect: viewer.getBoundingClientRect().toJSON(),
      sheetBackground: getComputedStyle(viewer.querySelector(".character-book-cg-viewer-sheet")).backgroundColor,
      sheetRect: viewer.querySelector(".character-book-cg-viewer-sheet").getBoundingClientRect().toJSON(),
      backdropBackground: getComputedStyle(viewer.querySelector(".character-book-cg-viewer-backdrop")).backgroundColor,
    }));
    assert.equal(firstCgViewer.id, "first-encounter", viewport.name + ": viewer opened the wrong CG");
    assert.equal(firstCgViewer.ariaHidden, "false", viewport.name + ": viewer remains hidden from assistive technology");
    assert.equal(firstCgViewer.title, "はじめまして", viewport.name + ": viewer title is incorrect");
    assert.equal(firstCgViewer.chapter, "01｜海辺の屋外展示", viewport.name + ": viewer chapter is incorrect");
    assert.equal(firstCgViewer.count, "01 / 06", viewport.name + ": viewer position is incorrect");
    assert.deepEqual(firstCgViewer.poem, [
      "海風の抜ける通りで、ふたりと出会った。",
      "柔らかな秋の光のなか、物語が静かに動き出す。",
    ], viewport.name + ": viewer poem is incorrect");
    assert.match(firstCgViewer.imageSource, viewport.mobile
      ? /event-cg-first-encounter-five-plane-mobile-v2\.png/u
      : /event-cg-first-encounter-five-plane-v3\.png/u, viewport.name + ": viewer did not choose the correct CG asset");
    assert.match(firstCgViewer.imageAlt, /ミズハ.*アマネ/u, viewport.name + ": viewer alt text is missing");
    assert.equal(firstCgViewer.focusedClose, true, viewport.name + ": viewer did not receive keyboard focus");

    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector("#character-book-cg-viewer")?.dataset.characterCgId === "amane-closeup");
    await page.waitForFunction(() => !document.querySelector(".character-book-cg-viewer-sheet")?.classList.contains("is-turning")
      && document.querySelector("#character-book-cg-viewer-image")?.complete
      && document.querySelector("#character-book-cg-viewer-image")?.naturalWidth > 0);
    const secondCgViewer = await page.locator("#character-book-cg-viewer").evaluate((viewer) => ({
      title: viewer.querySelector("#character-book-cg-viewer-title")?.textContent.trim(),
      count: viewer.querySelector("#character-book-cg-viewer-count")?.textContent.trim(),
      poemLines: viewer.querySelectorAll("#character-book-cg-viewer-poem > span").length,
      imageSource: viewer.querySelector("#character-book-cg-viewer-image")?.currentSrc,
    }));
    assert.equal(secondCgViewer.title, "手元のあかり", viewport.name + ": keyboard CG navigation failed");
    assert.equal(secondCgViewer.count, "02 / 06", viewport.name + ": keyboard CG position did not update");
    assert.equal(secondCgViewer.poemLines, 2, viewport.name + ": next CG poem is missing");
    assert.match(secondCgViewer.imageSource, /event-cg-amane-closeup-five-plane-v4\.png/u, viewport.name + ": next CG asset is incorrect");
    await page.screenshot({ path: path.join(outputDir, viewport.name + "-character-cg-viewer.png"), fullPage: false });
    await page.keyboard.press("Escape");
    await page.locator("#character-book-cg-viewer").waitFor({ state: "hidden", timeout: 5000 });
    await page.waitForFunction(() => document.activeElement?.classList.contains("character-book-cg-card")
      && document.activeElement?.dataset.characterCgId === "first-encounter");

    await page.locator("#character-book-master").scrollIntoViewIfNeeded();
    await page.waitForTimeout(viewport.reduced ? 50 : 220);
    const sectionState = await page.locator("#character-book-master").evaluate((element) => ({
      color: getComputedStyle(element).color,
      width: element.getBoundingClientRect().width,
    }));
    assert(sectionState.width > 0, viewport.name + ": reference section collapsed");
    assert.match(sectionState.color, /rgb/u, viewport.name + ": reference typography is not rendered");

    await page.screenshot({ path: path.join(outputDir, viewport.name + "-character-profile.png"), fullPage: false });
    await page.locator("#character-book-close").click();
    await page.locator("#character-book-layer").waitFor({ state: "hidden", timeout: 5000 });
    assert.equal(await page.evaluate(() => document.body.classList.contains("character-mode-open")), false);
    report.scans.push({ viewport, initial, amaneExpression, mizuha, mizuhaExpression, sakuya, galleryState, firstCgViewer, secondCgViewer, sectionState });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, [], "console errors were detected");
  assert.deepEqual(report.pageErrors, [], "page errors were detected");
  assert.deepEqual(report.responses404, [], "404 responses were detected");
  report.status = "passed";
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
}

console.log(JSON.stringify({ status: report.status, scans: report.scans.length, outputDir }, null, 2));

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4202"] = process.argv.slice(2);
const mapOnly = process.argv.slice(6).includes("--map-only");
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/mode-exit-buttons-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const surfaces = [
  { name: "map", trigger: "#japan-button", selector: "#japan-close", ready: "#japan-layer:not([hidden])" },
  { name: "sound", trigger: "[data-sound-gallery-open]", selector: "#sound-close", ready: "#sound-layer:not([hidden])" },
  { name: "character", trigger: "[data-character-gallery-open]", selector: "#character-book-close", ready: "#character-book-layer:not([hidden])" },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const attachDiagnostics = (page, viewport) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${viewport}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport}: ${response.url()}`); });
};

const bypassOpening = async (page) => {
  await page.evaluate(() => globalThis.GaiaModeLoader.load("exploration"));
  await page.waitForFunction(() => document.querySelectorAll("#mode-list .mode-button").length === 9);
  await page.evaluate(() => {
    const opening = document.querySelector("#gaia-opening");
    if (opening) {
      opening.hidden = true;
      opening.inert = true;
      opening.setAttribute("aria-hidden", "true");
    }
    const intro = document.querySelector("#intro-layer");
    if (intro) {
      intro.hidden = true;
      intro.inert = true;
      intro.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("gaia-opening-active", "opening-active", "intro-open");
    document.querySelector(".experience")?.classList.remove("intro-open");
    window.dispatchEvent(new CustomEvent("gaia:opening-complete"));
  });
};

const inspectButton = async (page, selector, viewport, surface) => {
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  const viewportSize = page.viewportSize();
  await page.mouse.move((viewportSize?.width || 1) - 1, (viewportSize?.height || 1) - 1);
  await page.waitForTimeout(240);
  const data = await locator.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    const arrow = getComputedStyle(button, "::before");
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const hitButton = hit?.closest("button");
    return {
      text: button.textContent.trim(),
      rect: rect.toJSON(),
      clipPath: style.clipPath,
      borderWidth: style.borderWidth,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      background: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      transform: style.transform,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      transitionDuration: style.transitionDuration,
      fontSize: style.fontSize,
      arrow: arrow.content,
      arrowWidth: arrow.width,
      arrowBorderWidth: arrow.borderWidth,
      arrowBackground: arrow.backgroundColor,
      hit: Boolean(hitButton === button),
      hitElement: hit ? `${hit.tagName.toLowerCase()}#${hit.id}.${hit.className}` : null,
      hitButtonId: hitButton?.id || null,
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
  assert(data.text.includes("戻る"), `${viewport}/${surface}: return label is missing`);
  assert(parseFloat(data.fontSize) > 0, `${viewport}/${surface}: return label is visually hidden`);
  assert(data.rect.height >= 44, `${viewport}/${surface}: hit area is under 44px`);
  assert(data.rect.width < 220, `${viewport}/${surface}: return control is still oversized`);
  assert.equal(data.hit, true, `${viewport}/${surface}: center hit is obstructed (${JSON.stringify(data)})`);
  assert.equal(data.clipPath, "none", `${viewport}/${surface}: split angular silhouette remains`);
  assert(parseFloat(data.borderWidth) >= 1, `${viewport}/${surface}: standard outer border is missing`);
  assert(parseFloat(data.borderRadius) >= 10, `${viewport}/${surface}: standard glass radius is missing`);
  assert(data.arrow.includes("◀"), `${viewport}/${surface}: directional cue is missing`);
  assert(parseFloat(data.arrowWidth) <= 20, `${viewport}/${surface}: arrow retained an oversized split cell`);
  assert.equal(parseFloat(data.arrowBorderWidth), 0, `${viewport}/${surface}: arrow retained its independent frame`);
  assert.equal(data.arrowBackground, "rgba(0, 0, 0, 0)", `${viewport}/${surface}: arrow retained a separate background`);
  assert.equal(data.overflowX, 0, `${viewport}/${surface}: horizontal overflow`);
  if (surface === "map") {
    const mobile = viewport.startsWith("mobile");
    assert.match(data.background, /rgba?\((?:7, 42, 88|9, 52, 104)/u, `${viewport}/${surface}: return control is not using the story-mode navy glass`);
    assert(Math.abs(data.rect.width - 88) <= 0.5, `${viewport}/${surface}: width does not match the shared return control`);
    assert(Math.abs(data.rect.height - 44) <= 0.5, `${viewport}/${surface}: height does not match the shared return control`);
  }
  await locator.hover();
  await page.waitForTimeout(240);
  const hover = await locator.evaluate((button) => {
    const style = getComputedStyle(button);
    return { borderColor: style.borderColor, background: style.backgroundImage, transform: style.transform };
  });
  assert(
    hover.borderColor !== data.borderColor || hover.background !== data.background || hover.transform !== data.transform,
    `${viewport}/${surface}: hover produced no visual state change (${JSON.stringify({ data, hover })})`,
  );
  await locator.focus();
  assert.equal(await locator.evaluate((button) => document.activeElement === button), true, `${viewport}/${surface}: keyboard focus failed`);
  report.scans.push({ viewport, surface, ...data, hover, passed: true });
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);

    for (const surface of surfaces) {
      if (mapOnly && surface.name !== "map") continue;
      await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
      await bypassOpening(page);
      await page.evaluate((selector) => document.querySelector(selector)?.click(), surface.trigger);
      await page.locator(surface.ready).waitFor({ state: "visible", timeout: 15_000 });
      await page.waitForFunction(() => !window.GaiaSceneTransition?.running);
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.(null, { restoreFocus: false }));
      await page.waitForFunction(() => !globalThis.GaiaModeEntryGuide?.getState?.().active);
      await inspectButton(page, surface.selector, viewport.name, surface.name);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${surface.name}.png`) });
      await page.locator(surface.selector).press("Enter");
      await page.locator(surface.ready).waitFor({ state: "hidden", timeout: 15_000 });
      report.scans.at(-1).keyboardActivated = true;
    }

    if (mapOnly) {
      await context.close();
      continue;
    }

    await page.goto(new URL("/#story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => globalThis.GaiaModeLoader.load("story"));
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel?.open));
    await page.evaluate(() => {
      localStorage.clear();
      globalThis.GaiaNovel.open();
    });
    await page.waitForFunction(() => (
      document.querySelector("#novel-home-button")?.hidden === false
      || (
        document.querySelector("#novel-start-button")?.disabled === false
        && document.querySelector("#novel-start-button")?.offsetParent !== null
      )
    ));
    if (await page.locator("#novel-start-button").isVisible()) {
      await page.locator("#novel-start-button").click();
    }
    await page.waitForFunction(() => (
      document.querySelector("#novel-home-button")?.hidden === false
      && document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "false"
    ));
    await page.waitForFunction(() => !window.GaiaSceneTransition?.running);
    await inspectButton(page, "#novel-home-button", viewport.name, "story-home");
    const storyControls = await page.evaluate(() => {
      const read = (selector) => {
        const button = document.querySelector(selector);
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          text: button.textContent.trim(),
          ariaLabel: button.getAttribute("aria-label"),
          controlMode: button.dataset.controlMode || "",
          fontSize: style.fontSize,
          backgroundImage: style.backgroundImage,
          borderColor: style.borderColor,
          arrow: getComputedStyle(button, "::before").content,
          rect: rect.toJSON(),
        };
      };
      const back = read("#novel-home-button");
      const skip = read("#novel-close-button");
      const audioDock = document.querySelector("#gaia-audio-dock");
      const audioRect = audioDock?.getBoundingClientRect();
      const audioControlRect = document.querySelector("#gaia-audio-toggle")?.getBoundingClientRect();
      const audioStyle = audioDock ? getComputedStyle(audioDock) : null;
      const temporalText = document.querySelector(".novel-signal-caption strong");
      const temporalStyle = temporalText ? getComputedStyle(temporalText) : null;
      const temporalCaption = document.querySelector(".novel-signal-caption");
      const temporalRect = temporalCaption?.getBoundingClientRect();
      return {
        back,
        skip,
        gap: skip.rect.left - back.rect.right,
        overlap: !(back.rect.right <= skip.rect.left || skip.rect.right <= back.rect.left),
        audioRightGap: audioRect ? innerWidth - audioRect.right : null,
        audioVisible: Boolean(audioRect && audioRect.width > 0 && audioRect.height > 0),
        audioRect: audioRect?.toJSON() || null,
        audioControlRect: audioControlRect?.toJSON() || null,
        audioComputedRight: audioStyle?.right || "",
        audioTransform: audioStyle?.transform || "",
        audioClassName: audioDock?.className || "",
        bodyClassName: document.body.className,
        temporalText: temporalText?.textContent.trim() || "",
        temporalColor: temporalStyle?.color || "",
        temporalShadow: temporalStyle?.textShadow || "",
        temporalCenterDelta: temporalRect ? Math.abs((temporalRect.left + temporalRect.width / 2) - innerWidth / 2) : null,
      };
    });
    assert.equal(storyControls.back.text, "戻る", `${viewport.name}: story back label is unclear`);
    assert.equal(storyControls.skip.text, "スキップ▶", `${viewport.name}: story skip label is unclear`);
    assert.equal(storyControls.skip.controlMode, "skip", `${viewport.name}: skip control mode was lost`);
    assert(storyControls.back.arrow.includes("◀"), `${viewport.name}: back arrow is incorrect`);
    assert(["none", "normal"].includes(storyControls.skip.arrow), `${viewport.name}: obsolete skip arrow remains`);
    assert.match(storyControls.back.backgroundImage, /rgba?\((?:7, 42, 88|9, 52, 104)/u, `${viewport.name}: story back control is not dialogue blue`);
    assert.match(storyControls.skip.backgroundImage, /rgba?\((?:7, 42, 88|9, 52, 104)/u, `${viewport.name}: story skip control is not dialogue blue`);
    assert(parseFloat(storyControls.back.fontSize) > 0 && parseFloat(storyControls.skip.fontSize) > 0, `${viewport.name}: story labels are visually hidden`);
    assert(storyControls.back.rect.left < storyControls.skip.rect.left, `${viewport.name}: story controls are in an unexpected order`);
    assert.equal(storyControls.overlap, false, `${viewport.name}: story controls overlap`);
    assert(storyControls.gap >= 4 && storyControls.gap <= 10, `${viewport.name}: story controls have an unnatural gap (${storyControls.gap}px)`);
    assert(storyControls.audioVisible && storyControls.audioRightGap >= 0, `${viewport.name}: audio control is outside the viewport`);
    assert(storyControls.audioRightGap <= (viewport.width <= 720 ? 8 : 12), `${viewport.name}: audio control is not anchored to the right edge (${JSON.stringify(storyControls)})`);
    if (viewport.width <= 720) {
      assert.equal(storyControls.back.rect.width, 88, `${viewport.name}: shared return width`);
      assert.equal(storyControls.back.rect.height, 44, `${viewport.name}: shared return height`);
      assert.equal(storyControls.skip.rect.height, 44, `${viewport.name}: shared skip height`);
      assert(storyControls.skip.rect.right < storyControls.audioRect.left, `${viewport.name}: skip overlaps audio control`);
    }
    assert(storyControls.temporalText.length > 0, `${viewport.name}: story date is missing`);
    assert.match(storyControls.temporalColor, /rgba?\((?:248, 253, 255|255, 255, 255)/u, `${viewport.name}: story date is not high-contrast`);
    assert((storyControls.temporalShadow.match(/rgba?\(0, 0, 0/gu) || []).length >= 3, `${viewport.name}: story date shadow is too weak (${storyControls.temporalShadow})`);
    assert(storyControls.temporalCenterDelta <= 0.5, `${viewport.name}: story date is not centered on the viewport (${storyControls.temporalCenterDelta}px)`);
    report.scans.push({ viewport: viewport.name, surface: "story-controls", ...storyControls, passed: true });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-story-home.png`) });
    await page.locator("#novel-home-button").click();
    await page.waitForFunction(() => (
      document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "true"
      && !document.querySelector("#intro-layer")?.hidden
    ));
    report.scans.at(-1).pointerActivated = true;

    await page.goto(new URL("/#earth", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => globalThis.GaiaModeLoader.load("exploration"));
    await page.locator("#japan-layer:not([hidden])").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("#japan-close").click();
    await page.locator("#japan-layer:not([hidden])").waitFor({ state: "hidden", timeout: 15_000 });
    await page.waitForFunction(() => !window.GaiaSceneTransition?.running);
    await bypassOpening(page);

    await page.evaluate(async () => {
      await globalThis.GaiaModeLoader.load("space");
      window.GaiaSpace.open(0);
    });
    await page.locator("#space-layer").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForFunction(() => !window.GaiaSceneTransition?.running);
    await inspectButton(page, "#space-close", viewport.name, "space");
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-space.png`) });
    await page.locator("#space-close").press("Enter");
    await page.locator("#space-layer").waitFor({ state: "hidden", timeout: 15_000 });
    report.scans.at(-1).keyboardActivated = true;

    await context.close();
  }

  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`Mode exit browser check passed: ${report.scans.length} surfaces`);

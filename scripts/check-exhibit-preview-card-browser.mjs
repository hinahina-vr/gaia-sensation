import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/exhibit-preview-card");
const requested = process.argv.slice(4).find(value => value.startsWith("--viewports="))?.split("=")[1].split(",");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const options of [
    { width: 1440, height: 900 }, { width: 3840, height: 2160 },
    { width: 768, height: 900 }, { width: 390, height: 844 },
    { width: 320, height: 740 }, { width: 390, height: 844, reduced: true },
  ]) {
    const label = `${options.width}${options.reduced ? "-reduced" : ""}`;
    if (requested && !requested.includes(label)) continue;
    const context = await browser.newContext({
      viewport: { width: options.width, height: options.height },
      hasTouch: options.width < 900,
      deviceScaleFactor: options.width < 600 ? 2 : 1,
      reducedMotion: options.reduced ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${label}: ${error.message}`));
    await page.goto(`${base}/?preview=exhibit-preview-card#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
    });
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const mobileTrigger = page.locator("#map-mobile-bank-toggle");
    const dockTrigger = page.locator(".map-dock-bank-trigger");
    if (await mobileTrigger.isVisible()) await mobileTrigger.click();
    else if (options.width > 900 && await dockTrigger.isVisible()) await dockTrigger.click();
    await page.keyboard.press("Tab");
    for (let number = 1; number <= 30; number++) {
      const button = page.locator(".map-mode-bank .map-mode-button").filter({ hasText: new RegExp(`^${String(number).padStart(2, "0")}$`) });
      await button.scrollIntoViewIfNeeded();
      await button.focus();
      await page.waitForFunction(number => document.querySelector("#map-mode-preview").getAttribute("aria-hidden") === "false"
        && document.querySelector("#map-mode-preview-number").textContent.startsWith(`${String(number).padStart(2, "0")} /`), number);
      await page.waitForTimeout(300);
      const scan = await page.locator("#map-mode-preview").evaluate((preview, number) => {
        const title = preview.querySelector("b");
        const meta = preview.querySelector("span");
        const copy = preview.querySelector("p");
        const button = [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
          .find(button => button.textContent.trim() === String(number).padStart(2, "0"));
        const id = button.dataset.liveExhibit || button.dataset.planetExhibit || button.dataset.firmsExhibit
          || button.dataset.estatExhibit || GaiaAppContent.modes[number - 1]?.id;
        const inspect = element => {
          const style = getComputedStyle(element);
          return { rect: element.getBoundingClientRect().toJSON(), text: element.textContent,
            font: style.fontFamily, fontSize: parseFloat(style.fontSize), weight: style.fontWeight,
            scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
        };
        // Briefly enable hit testing to detect a card hidden by another stacking
        // context. Restore the production pointer-through behavior immediately.
        const previousPointerEvents = preview.style.pointerEvents;
        preview.style.pointerEvents = "auto";
        const unobscured = [title, meta, copy].every(element => {
          const bounds = element.getBoundingClientRect();
          return preview.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2));
        });
        preview.style.pointerEvents = previousPointerEvents;
        return { number, title: inspect(title), meta: inspect(meta), copy: inspect(copy),
          expectedCopy: GaiaAppContent.MAP_MODE_DESCRIPTIONS[id], rect: preview.getBoundingClientRect().toJSON(),
          anchor: button.getBoundingClientRect().toJSON(), aria: button.getAttribute("aria-describedby"),
          before: getComputedStyle(preview, "::before").content, after: getComputedStyle(preview, "::after").content,
          stripe: getComputedStyle(preview.firstElementChild).borderLeftWidth,
          opacity: Number(getComputedStyle(preview).opacity),
          overflow: preview.scrollHeight - preview.clientHeight,
          transition: getComputedStyle(preview).transitionDuration,
          activeNumber: document.querySelector("#japan-mode-number").textContent.trim(), unobscured };
      }, number);
      assert.equal(scan.before, "none"); assert.equal(scan.after, "none");
      assert.equal(scan.stripe, "0px");
      assert.equal(scan.aria, "map-mode-preview");
      assert.equal(scan.unobscured, true, `${label}/${number}: another panel covers the preview`);
      assert.equal(scan.copy.text, scan.expectedCopy, `${label}/${number}: preserve exhibit copy`);
      assert.equal(scan.activeNumber, "01", "Preview focus must not select another exhibit");
      assert.equal(scan.title.weight, "500"); assert.equal(scan.copy.weight, "400");
      assert.match(scan.title.font, /Yu Gothic UI/); assert.match(scan.copy.font, /Yu Gothic UI/);
      assert(scan.opacity > .99 && scan.overflow <= 1, `${label}/${number}: card content is clipped`);
      assert(scan.rect.left >= -1 && scan.rect.right <= options.width + 1
        && scan.rect.top >= -1 && scan.rect.bottom <= options.height + 1, `${label}/${number}: card exceeds viewport`);
      assert(scan.title.rect.right <= scan.meta.rect.left + 1, "Title and classification must not overlap");
      assert(scan.copy.rect.top >= Math.max(scan.title.rect.bottom, scan.meta.rect.bottom) + 8, "Body needs clear separation from header");
      for (const item of [scan.title, scan.meta, scan.copy]) {
        assert(item.scrollWidth <= item.clientWidth + 1, `${label}/${number}: text overflows`);
        assert(item.rect.left >= scan.rect.left && item.rect.right <= scan.rect.right);
        assert(item.rect.top >= scan.rect.top && item.rect.bottom <= scan.rect.bottom);
      }
      if (options.width > 900) {
        const gap = scan.rect.left >= scan.anchor.right ? scan.rect.left - scan.anchor.right : scan.anchor.left - scan.rect.right;
        assert(gap >= 0 && gap <= 12, "Keep preview attached to its button");
      }
      if (options.reduced) assert(getComputedTransitionMax(scan.transition) <= .001);
      if ([3, 12, 30].includes(number)) {
        await page.screenshot({ path: path.join(output, `${label}-${number}.jpg`), type: "jpeg", quality: 90 });
        await page.locator("#map-mode-preview").screenshot({ path: path.join(output, `${label}-${number}-detail.png`) });
      }
      report.checks.push({ viewport: label, ...scan });
    }
    await page.locator("#japan-close").focus();
    await page.waitForFunction(() => document.querySelector("#map-mode-preview").getAttribute("aria-hidden") === "true"
      && Number(getComputedStyle(document.querySelector("#map-mode-preview")).opacity) < .01);
    if (options.width > 900) {
      const rain = page.locator(".map-mode-bank .map-mode-button").filter({ hasText: /^12$/ });
      await rain.hover();
      await page.waitForFunction(() => document.querySelector("#map-mode-preview-number").textContent.startsWith("12 /")
        && document.querySelector("#map-mode-preview").getAttribute("aria-hidden") === "false");
      await page.mouse.move(options.width / 2, options.height / 2);
      await page.waitForFunction(() => document.querySelector("#map-mode-preview").getAttribute("aria-hidden") === "true");
    }
    console.log(`PASS ${label}: 30 previews, unchanged copy, sans typography, no tails/stripe, text bounds, keyboard/pointer dismissal`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

function getComputedTransitionMax(value) {
  return Math.max(...value.split(",").map(part => parseFloat(part)));
}

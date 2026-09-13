import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/main-overlay-layout-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900, maxInset: 36 },
  { name: "mobile-390", width: 390, height: 844, maxInset: 28 },
];
const report = { status: "running", baseUrl, scans: [], detours: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
    });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.evaluate(() => globalThis.GaiaModeLoader.load("exploration"));
    await page.waitForFunction(() => document.querySelectorAll("#mode-list .mode-button").length === 9);
    const modeCount = await page.locator("#mode-list .mode-button").count();
    assert.equal(modeCount, 9, `${viewport.name}: mode button count`);
    await page.evaluate(() => {
      const opening = document.querySelector("#gaia-opening");
      if (opening) {
        opening.hidden = true;
        opening.inert = true;
        opening.setAttribute("aria-hidden", "true");
      }
      document.body.classList.remove("gaia-opening-active", "opening-active", "intro-open");
      window.dispatchEvent(new CustomEvent("gaia:opening-complete"));
      const intro = document.querySelector("#intro-layer");
      if (intro) {
        intro.hidden = true;
        intro.inert = true;
        intro.setAttribute("aria-hidden", "true");
      }
      document.querySelector(".experience")?.classList.remove("intro-open");
    });

    for (let index = 0; index < modeCount; index += 1) {
      await page.evaluate((modeIndex) => document.querySelectorAll("#mode-list .mode-button")[modeIndex]?.click(), index);
      await page.waitForFunction(
        (modeNumber) => document.querySelector("#mode-number")?.textContent?.trim() === modeNumber,
        String(index + 1).padStart(2, "0"),
      );
      await page.waitForTimeout(80);

      const scan = await page.evaluate(() => {
        const box = (node) => node?.getBoundingClientRect().toJSON() || null;
        const back = document.querySelector("#intro-button");
        const status = document.querySelector(".status");
        const panel = document.querySelector(".signal-console-main");
        const slider = panel?.querySelector('input[type="range"]');
        const title = document.querySelector("#mode-title");
        const caption = document.querySelector("#mode-caption");
        const modeCopy = document.querySelector(".mode-copy");
        const centerHit = (node) => {
          const box = node?.getBoundingClientRect();
          return box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
        };
        return {
          mastheadCount: document.querySelectorAll(".masthead").length,
          modeNumber: document.querySelector("#mode-number")?.textContent?.trim() || "",
          modeTitle: title?.textContent?.trim() || "",
          panelParentClass: panel?.parentElement?.className || "",
          back: box(back),
          status: box(status),
          panel: box(panel),
          slider: box(slider),
          title: box(title),
          caption: box(caption),
          modeCopy: box(modeCopy),
          backHitId: centerHit(back)?.closest("button")?.id || "",
          sliderHitTag: centerHit(slider)?.tagName || "",
          panelVisible: panel ? getComputedStyle(panel).visibility !== "hidden" && getComputedStyle(panel).opacity !== "0" : false,
          overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
          viewport: { width: innerWidth, height: innerHeight },
        };
      });

      assert.equal(scan.mastheadCount, 0, `${viewport.name}/${scan.modeNumber}: title block remains`);
      assert.equal(scan.panelParentClass, "mode-copy", `${viewport.name}/${scan.modeNumber}: signal panel is not in the mode rail`);
      assert.equal(scan.panelVisible, true, `${viewport.name}/${scan.modeNumber}: signal panel is hidden`);
      assert.equal(scan.backHitId, "intro-button", `${viewport.name}/${scan.modeNumber}: back button is obstructed`);
      assert.equal(scan.sliderHitTag, "INPUT", `${viewport.name}/${scan.modeNumber}: slider is obstructed`);
      assert(scan.back.left >= 0 && scan.back.left <= viewport.maxInset, `${viewport.name}/${scan.modeNumber}: back button is not at left edge`);
      assert(scan.back.top >= 0 && scan.back.top <= viewport.maxInset, `${viewport.name}/${scan.modeNumber}: back button is not at top edge`);
      assert(scan.back.width >= 44 && scan.back.height >= 44, `${viewport.name}/${scan.modeNumber}: back hit area is too small`);
      assert(scan.panel.left >= 0 && scan.panel.right <= scan.viewport.width, `${viewport.name}/${scan.modeNumber}: panel is clipped horizontally`);
      assert(scan.panel.top >= scan.back.bottom + 8, `${viewport.name}/${scan.modeNumber}: panel overlaps back button`);
      assert(scan.panel.bottom <= scan.title.top - 8, `${viewport.name}/${scan.modeNumber}: panel is not above the mode title`);
      assert(Math.abs(scan.panel.left - scan.title.left) <= 1, `${viewport.name}/${scan.modeNumber}: panel and title are not aligned`);
      assert(scan.panel.width <= scan.modeCopy.width + 1, `${viewport.name}/${scan.modeNumber}: panel exceeds the mode rail`);
      assert(scan.caption.left >= 0 && scan.caption.right <= scan.viewport.width, `${viewport.name}/${scan.modeNumber}: caption is clipped horizontally`);
      assert.equal(scan.overflowX, 0, `${viewport.name}/${scan.modeNumber}: horizontal overflow`);
      assert.equal(scan.overflowY, 0, `${viewport.name}/${scan.modeNumber}: vertical overflow`);
      report.scans.push({ viewport: viewport.name, ...scan, passed: true });

      if (index === 0 || index === 7) {
        await page.screenshot({
          path: path.join(outputDir, `${viewport.name}-${scan.modeNumber}.png`),
          animations: "disabled",
        });
      }
    }

    const originalPanelState = await page.evaluate(() => {
      const panel = document.querySelector(".signal-console-main");
      return { hidden: panel.hidden, inert: panel.inert, ariaHidden: panel.getAttribute("aria-hidden") };
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("gaia:story-mode-open", {
      detail: { kind: "abstract07", index: 6, phase: "timeline" },
    })));
    await page.waitForFunction(() => {
      const panel = document.querySelector(".signal-console-main");
      return panel?.hidden && panel.inert && panel.getAttribute("aria-hidden") === "true";
    });
    const hiddenForDetour = await page.locator(".signal-console-main").isHidden();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("gaia:story-mode-close", {
      detail: { kind: "abstract07" },
    })));
    await page.waitForFunction((original) => {
      const panel = document.querySelector(".signal-console-main");
      return panel?.hidden === original.hidden
        && panel.inert === original.inert
        && panel.getAttribute("aria-hidden") === original.ariaHidden;
    }, originalPanelState);
    assert.equal(hiddenForDetour, true, `${viewport.name}: signal panel remained visible during story detour`);
    report.detours.push({ viewport: viewport.name, originalPanelState, hiddenForDetour, restored: true });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, [], `console errors: ${report.consoleErrors.join("\n")}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${report.pageErrors.join("\n")}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`Main overlay layout browser check passed: ${report.scans.length} mode/viewports`);

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173", flag] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(path.resolve(moduleRoot, "index.mjs")).href);
const output = path.resolve(outputArgument || "artifacts/map-dock-actions");
const baseline = flag === "--baseline";
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const snapshot = fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8");
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const width of [3840, 1920, 1440, 1281, 1280, 1180, 901, 390]) {
    const height = width === 3840 ? 1600 : width === 390 ? 844 : 1000;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: snapshot }));
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.goto(new URL("/?preview=compact-dock#earth", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !document.documentElement.classList.contains("gaia-booting"));
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    await page.waitForTimeout(400);
    const scan = await page.evaluate(() => {
      const geometry = (selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right };
      };
      const buttons = [...document.querySelectorAll(".map-dock-action")].map((button) => {
        const rect = button.getBoundingClientRect();
        const text = button.querySelector("strong");
        const icon = button.querySelector("svg");
        return {
          width: rect.width, height: rect.height,
          textClipped: text.scrollWidth > text.clientWidth + 1,
          icon: icon?.getAttribute("viewBox"),
          iconBox: getComputedStyle(button.querySelector("i")).boxShadow,
          hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest("button") === button,
        };
      });
      return {
        width: innerWidth, buttons,
        dock: geometry(".map-command-dock"),
        guide: geometry(".map-reading-guide"),
        timeline: geometry(".signal-console-map"),
        overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    report.scans.push(scan);
    if (width > 900) {
      await page.screenshot({ path: path.join(output, width + "-page.png") });
      const sourceBox = await page.locator(".map-dock-action--source").boundingBox();
      const analysisBox = await page.locator(".map-dock-action--statistics").boundingBox();
      await page.screenshot({ path: path.join(output, width + "-buttons.png"), clip: {
        x: sourceBox.x - 5, y: sourceBox.y - 6,
        width: analysisBox.x + analysisBox.width - sourceBox.x + 10, height: sourceBox.height + 12,
      } });
      if (!baseline) {
        assert(scan.buttons.every((b) => b.width <= 183), "Actions must not stretch across a wide monitor");
        assert(scan.buttons.every((b) => b.height >= 44 && b.hit && !b.textClipped), "Actions must remain readable and clickable");
        assert(scan.buttons.every((b) => b.icon === "0 0 36 36" && b.iconBox === "none"));
        assert(scan.timeline.width > scan.guide.width, "Give the timeline more room than the closed description column");
        assert(scan.dock.right <= width + 1);
        assert.equal(scan.overflow, 0);
      }
      scan.timeControls = [];
      for (const mode of [0, 1]) {
        await page.evaluate((index) => globalThis.GaiaMapObservationAdapter.selectMode(index), mode);
        await page.waitForTimeout(250);
        const controls = await page.locator(".signal-console-map").evaluate((console) => {
          const rect = (element) => {
            const box = element.getBoundingClientRect();
            return { left: box.left, right: box.right, width: box.width };
          };
          const year = console.querySelector(".map-dock-year");
          const slider = console.querySelector("[data-signal-time]");
          return {
            console: rect(console), year: rect(year), slider: rect(slider),
            text: year.innerText, unit: year.querySelector("small").textContent,
            parts: [...year.querySelectorAll("button, b, small")].map(rect),
            buttons: [...year.querySelectorAll("button")].map((button) => {
              const box = button.getBoundingClientRect();
              return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("button") === button;
            }),
          };
        });
        scan.timeControls.push({ mode, ...controls });
        if (!baseline) {
          assert(controls.year.width >= (width > 1180 ? 180 : 144) - 1, "Year / STEP control needs more breathing room");
          assert(controls.slider.width >= 48, "Keep a usable timeline alongside the wider STEP control");
          assert(controls.slider.right <= controls.console.right + 1);
          assert(controls.parts.every((part) => part.left >= controls.year.left && part.right <= controls.year.right));
          assert(controls.parts.every((part, i, parts) => i === 0 || part.left >= parts[i - 1].right + 2), "Arrows, number and unit must not overlap");
          assert(controls.buttons.every(Boolean), "Both time-step buttons must remain clickable");
          assert.equal(controls.unit, mode === 1 ? "STEP" : "年");
        }
        if (mode === 1) {
          await page.locator(".map-command-dock").screenshot({ path: path.join(output, width + "-step-dock.png") });
          if (!baseline) {
            const slider = page.locator(".signal-console-map [data-signal-time]");
            await slider.fill("1");
            await slider.dispatchEvent("input");
            await slider.dispatchEvent("change");
            const before = Number(await slider.inputValue());
            await page.locator('[data-map-dock-year-step="1"]').click();
            assert(Number(await slider.inputValue()) > before, "Next STEP advances the timeline");
            await page.locator('[data-map-dock-year-step="-1"]').click();
            assert.equal(Number(await slider.inputValue()), before, "Previous STEP restores the timeline");
          }
        }
      }
      if (!baseline && width === 1440) {
        const source = page.locator(".map-dock-action--source");
        await source.focus();
        await source.press("Enter");
        await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
        await page.locator("#japan-data-close").click();
        const statistics = page.locator(".map-dock-action--statistics");
        await statistics.click();
        await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady === true);
        await page.locator("#gaia-statistics-close").click();
      }
    } else if (!baseline) {
      assert(scan.buttons.every((button) => button.width === 0), "Keep the separate mobile controls");
      assert.equal(scan.overflow, 0);
      assert(await page.locator("#gaia-statistics-button-mobile").isVisible());
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

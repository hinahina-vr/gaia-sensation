import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(path.resolve(moduleRoot, "index.mjs")).href);
const output = path.resolve(outputArgument || "artifacts/map-guide-three-line-copy");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const snapshot = fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8");
const browser = await chromium.launch({ executablePath, headless: true });
const measure = (page) => page.locator(".map-reading-guide-body").evaluate((panel) => {
  const bounds = panel.getBoundingClientRect();
  const rows = [...panel.children].map((row) => {
    const rect = row.getBoundingClientRect();
    const label = row.querySelector("h3");
    const p = row.querySelector("p");
    const labelRect = label.getBoundingClientRect();
    const textRect = p.getBoundingClientRect();
    return {
      label: label.textContent, text: p.textContent,
      x: rect.x, y: rect.y, width: rect.width, bottom: rect.bottom,
      textX: textRect.x, lines: Math.round(textRect.height / parseFloat(getComputedStyle(p).lineHeight)),
      paired: labelRect.right <= textRect.left && labelRect.top < textRect.bottom,
      textBelowHeading: textRect.top >= labelRect.bottom,
      explicitLines: p.textContent.split("\n").length,
      clipped: p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1,
      labelBorder: getComputedStyle(row).borderRightWidth,
    };
  });
  return {
    viewport: innerWidth, panel: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
    rows, filter: getComputedStyle(panel).filter,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  };
});
try {
  for (const viewport of [
    { width: 3840, height: 1600 }, { width: 1920, height: 1000 },
    { width: 1440, height: 900 }, { width: 901, height: 600 },
    { width: 390, height: 844 }, { width: 320, height: 568 },
  ]) {
    const mobile = viewport.width <= 900;
    const context = await browser.newContext({ viewport, reducedMotion: viewport.width === 1440 ? "no-preference" : "reduce", hasTouch: mobile });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: snapshot }));
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.goto(new URL("/?preview=guide-three-line-copy#earth", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !document.documentElement.classList.contains("gaia-booting"));
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    const guide = page.locator("#map-reading-guide");
    const summary = guide.locator("summary");
    if (mobile) await summary.click();
    else await summary.focus();
    await page.waitForFunction(() => document.querySelector("#map-reading-guide").open);
    await page.waitForTimeout(400);
    const cases = viewport.width === 1920 ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0];
    for (const modeIndex of cases) {
      if (modeIndex) {
        await page.evaluate((index) => globalThis.GaiaMapObservationAdapter.selectMode(index), modeIndex);
        await page.waitForFunction(() => document.querySelector(".map-reading-guide-body").getAttribute("aria-busy") !== "true");
        await page.waitForTimeout(150);
      }
      const scan = await measure(page);
      assert.deepEqual(scan.rows.map((r) => r.label), ["何を見る？", "色の意味", "押すと"]);
      assert.equal(scan.rows.length, 3);
      assert(scan.rows.every((row) => !row.clipped));
      if (mobile) {
        assert(scan.rows.every((row) => row.paired && row.labelBorder === "0px"));
        assert(scan.rows.every((row) => Math.abs(row.x - scan.rows[0].x) < 1));
        assert(scan.rows[1].y >= scan.rows[0].bottom && scan.rows[2].y >= scan.rows[1].bottom);
      } else {
        assert(scan.rows.every((row) => row.textBelowHeading));
        assert(scan.rows.every((row) => Math.abs(row.y - scan.rows[0].y) < 1), "Restore the original horizontal three-column layout");
        assert(scan.rows[1].x >= scan.rows[0].x + scan.rows[0].width - 1);
        assert(scan.rows[2].x >= scan.rows[1].x + scan.rows[1].width - 1);
        assert.deepEqual(scan.rows.map((row) => row.labelBorder), ["1px", "1px", "0px"]);
      }
      assert(scan.panel.left >= 0 && scan.panel.right <= viewport.width + 1, "Guide must stay on screen");
      assert.equal(scan.overflow, 0);
      if (!mobile) {
        assert(scan.panel.top >= 0 && scan.panel.bottom <= viewport.height);
        assert.equal(scan.filter, "none");
      }
      if (!mobile && modeIndex === 0) assert(scan.rows.every((row) => row.lines === 3 && row.explicitLines === 3), "Each paragraph should be three complete lines, not three stacked sections");
      report.scans.push({ ...scan, modeIndex });
      if (modeIndex === 0) {
        await page.screenshot({ path: path.join(output, viewport.width + "-page.png") });
        if (!mobile) await guide.locator(".map-reading-guide-body").screenshot({ path: path.join(output, viewport.width + "-guide.png") });
      }
    }
    if (mobile) {
      const accessible = await guide.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        const bounds = element.getBoundingClientRect();
        const lastText = element.querySelector("#map-guide-action").getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight && lastText.bottom <= bounds.bottom;
      });
      assert(accessible, "The last row must remain accessible inside the mobile scroll area");
    }
    // Pointer dismissal still works with a wider, viewport-clamped sheet.
    if (!mobile) {
      await page.locator("#japan-close").focus();
      await page.mouse.move(viewport.width - 2, 90);
      await page.waitForFunction(() => !document.querySelector("#map-reading-guide").open);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log(JSON.stringify({ status: report.status, scans: report.scans.length, output }, null, 2));
} catch (error) {
  report.status = "failed"; report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

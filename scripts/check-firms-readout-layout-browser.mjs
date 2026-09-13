import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/firms-readout-layout");
const captureOnly = process.argv.includes("--capture-only");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
  });
  await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
  await context.route("**/firms-active-fire-snapshot.json", route => route.fulfill({ path: "data/firms-active-fire-snapshot.json", contentType: "application/json" }));
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(`${base}/?preview=firms-readout#world`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.GaiaFirmsExhibit && globalThis.GaiaMapObservationAdapter);
  await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
  await page.evaluate(() => {
    GaiaModeEntryGuide.close("map", { restoreFocus: false });
    document.querySelector("[data-firms-exhibit]").click();
  });
  await page.waitForFunction(() => document.querySelector(".gaia-firms-readout").dataset.firmsSource
    && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
  for (const width of [3840, 2560, 1920, 1600, 1501, 1500, 1440, 1280, 1101, 1024, 900, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 3840 ? 2088 : width < 900 ? 844 : 1080 });
    await page.waitForTimeout(200);
    for (const status of ["LIVE CACHE", "SAVED SNAPSHOT"]) {
      // Both possible source labels, including the longest fallback label.
      await page.locator("[data-firms-status]").evaluate((element, status) => { element.textContent = status; }, status);
      const scan = await page.locator(".gaia-firms-readout").evaluate(readout => {
        const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const box = element => ({ ...rect(element), visible: element.checkVisibility(), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth });
        const count = readout.querySelector(".gaia-firms-count > p");
        const timeline = readout.querySelector(".gaia-firms-timeline");
        const primary = readout.querySelector(".gaia-firms-primary");
        const label = readout.querySelector("[data-firms-status]");
        const range = document.createRange(); range.selectNodeContents(count);
        const countLines = [...range.getClientRects()].map(rect => rect.top);
        const quality = [...readout.querySelectorAll(".gaia-firms-quality > span")].map(element => {
          range.selectNode(element.firstChild);
          return { column: box(element), label: rect(range), value: box(element.querySelector("strong")) };
        });
        return { readout: box(readout), columns: [...readout.children].map(element => ({ name: element.className, ...box(element) })),
          count: { ...box(count), text: count.textContent, lines: new Set(countLines).size },
          timeline: box(timeline), header: box(timeline.querySelector("header")), status: box(label), slider: box(timeline.querySelector("input")), quality,
          primary: box(primary), value: box(primary.querySelector("strong")), unit: box(primary.querySelector("span")) };
      });
      report.checks.push({ width, status, scan });
      if (!captureOnly) {
        assert(scan.readout.left >= 0 && scan.readout.right <= width + 1, `${width}: dock outside viewport`);
        if (scan.count.visible) {
          assert.equal(scan.count.lines, 1, `${width}: count heading wrapped`);
          assert(scan.count.scrollWidth <= scan.count.clientWidth + 1, `${width}: count heading clipped`);
          assert(scan.value.right <= scan.unit.left && scan.unit.right <= scan.primary.right, `${width}: other columns squeezed the FRP value/unit`);
        }
        assert(scan.status.left >= scan.header.left && scan.status.right <= scan.header.right + 1, `${width}/${status}: status overflow`);
        assert(scan.status.scrollWidth <= scan.status.clientWidth + 1, `${width}/${status}: status clipped`);
        assert(scan.header.right <= scan.timeline.right && scan.slider.right <= scan.timeline.right, `${width}/${status}: timeline overlaps adjacent column`);
        for (const item of scan.quality.filter(item => item.column.visible)) {
          assert(item.label.left >= item.column.left && item.label.right <= item.column.right + 1, `${width}: quality label crosses its column`);
          assert(item.value.right <= item.column.right + 1, `${width}: quality value crosses its column`);
          assert(scan.status.right <= item.label.left, `${width}: CACHE overlaps quality label`);
        }
      }
      if (status === "LIVE CACHE" && [3840, 1920, 1501, 1440, 390].includes(width)) {
        await page.locator(".gaia-firms-readout").screenshot({ path: path.join(output, `${width}-dock.png`) });
      }
    }
    console.log(`${captureOnly ? "SCAN" : "PASS"} ${width}: one-line heading, contained timeline/status, separated quality labels`);
  }
  assert.deepEqual(report.errors, []); report.status = captureOnly ? "captured" : "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }

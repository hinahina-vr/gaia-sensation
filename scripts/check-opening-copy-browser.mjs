import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");

const entry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(entry).href);
const outputDir = path.resolve(outputArgument || "artifacts/opening-copy-browser");
fs.mkdirSync(outputDir, { recursive: true });

const expectedHeading = "「はじめまして。」";
const expectedLines = [
  "画面越しにコードやデータをやりとりしていた、あの時間。",
  "潮風が吹き抜けるこの場所で顔を合わせるのは、今日が初めてだった。",
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of [{ name: "pc-1440", width: 1440, height: 900 }, { name: "mobile-390", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("#gaia-opening-sound-modal").waitFor({ state: "visible" });
    await page.locator("#gaia-opening-sound-off").click();
    await page.locator("#gaia-opening-sound-modal").waitFor({ state: "hidden" });
    await page.locator("#gaia-opening.is-active").waitFor({ state: "attached", timeout: 10_000 });
    await page.waitForTimeout(2_050);

    const heading = await page.locator(".gaia-vn-prologue-lockup h2").textContent();
    const lines = await page.locator(".gaia-vn-prologue-copy > span").allTextContents();
    assert.equal(heading?.trim(), expectedHeading, `${viewport.name}: opening heading changed`);
    assert.deepEqual(lines, expectedLines, `${viewport.name}: opening copy or punctuation changed`);

    const scan = await page.evaluate(() => {
      const headingElement = document.querySelector(".gaia-vn-prologue-lockup h2");
      const copyElement = document.querySelector(".gaia-vn-prologue-copy");
      const spans = [...document.querySelectorAll(".gaia-vn-prologue-copy > span")];
      const toRect = (rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
      const lineBoxes = (element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
        return rects.reduce((lines, rect) => {
          const line = lines.find((candidate) => Math.abs(candidate.top - rect.top) < 1);
          if (line) {
            line.left = Math.min(line.left, rect.left);
            line.right = Math.max(line.right, rect.right);
            line.bottom = Math.max(line.bottom, rect.bottom);
            line.width = line.right - line.left;
          } else {
            lines.push(toRect(rect));
          }
          return lines;
        }, []).sort((a, b) => a.top - b.top);
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        headingFontFamily: getComputedStyle(headingElement).fontFamily,
        copyFontFamily: getComputedStyle(copyElement).fontFamily,
        headingRect: toRect(headingElement.getBoundingClientRect()),
        copyRect: toRect(copyElement.getBoundingClientRect()),
        lineBoxes: spans.map(lineBoxes),
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      };
    });

    assert.equal(scan.overflowX, 0, `${viewport.name}: opening copy causes horizontal overflow`);
    assert.equal(scan.overflowY, 0, `${viewport.name}: opening copy causes vertical overflow`);
    assert.match(scan.headingFontFamily, /Yu Mincho|YuMincho/u, `${viewport.name}: opening heading lost the Mincho font stack`);
    assert.match(scan.copyFontFamily, /Yu Mincho|YuMincho/u, `${viewport.name}: opening copy lost the Mincho font stack`);
    for (const [label, rect] of [["heading", scan.headingRect], ["copy", scan.copyRect]]) {
      assert(rect.left >= 0 && rect.top >= 0 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1, `${viewport.name}: ${label} escaped the viewport`);
    }
    assert(scan.copyRect.top > scan.headingRect.bottom, `${viewport.name}: heading and body overlap`);
    assert.deepEqual(scan.lineBoxes.map((boxes) => boxes.length), viewport.name === "pc-1440" ? [1, 1] : [1, 2], `${viewport.name}: opening copy wrapped at an unintended position`);
    for (const boxes of scan.lineBoxes) {
      for (const box of boxes) assert(box.left >= 0 && box.right <= viewport.width + 1, `${viewport.name}: a copy line escaped the viewport`);
    }

    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`) });
    report.scans.push({ viewport: viewport.name, ...scan, passed: true });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log("opening copy browser check passed");

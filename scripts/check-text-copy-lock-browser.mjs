import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/text-copy-lock-browser");
fs.mkdirSync(outputDir, { recursive: true });

const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
];

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
      deviceScaleFactor: viewport.mobile ? 3 : 1,
    });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => Boolean(document.querySelector(".gaia-vn-prologue-copy")));
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".gaia-vn-prologue-copy")).userSelect === "none");
    await page.evaluate(() => globalThis.GaiaModeLoader?.load?.("story"));
    await page.waitForFunction(() => Boolean(document.querySelector("#novel-text")));

    const scan = await page.evaluate(() => {
      const openingCopy = document.querySelector(".gaia-vn-prologue-copy");
      const novelCopy = document.querySelector("#novel-text");
      const debugCopy = document.querySelector(".novel-script-debug-copy");
      const textarea = document.createElement("textarea");
      textarea.value = "editable text";
      document.body.append(textarea);
      const dispatchCopy = (target) => {
        const event = new Event("copy", { bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const result = {
        openingUserSelect: getComputedStyle(openingCopy).userSelect,
        novelUserSelect: getComputedStyle(novelCopy).userSelect,
        debugUserSelect: getComputedStyle(debugCopy).userSelect,
        textareaUserSelect: getComputedStyle(textarea).userSelect,
        openingCopyPrevented: dispatchCopy(openingCopy),
        novelCopyPrevented: dispatchCopy(novelCopy),
        textareaCopyPrevented: dispatchCopy(textarea),
      };
      textarea.remove();
      return result;
    });

    assert.equal(scan.openingUserSelect, "none", `${viewport.name}: opening text remains selectable`);
    assert.equal(scan.novelUserSelect, "none", `${viewport.name}: story text remains selectable`);
    assert.equal(scan.debugUserSelect, "none", `${viewport.name}: explicit selectable override escaped the global lock`);
    assert.equal(scan.textareaUserSelect, "text", `${viewport.name}: editable text selection was blocked`);
    assert.equal(scan.openingCopyPrevented, true, `${viewport.name}: opening copy event was not blocked`);
    assert.equal(scan.novelCopyPrevented, true, `${viewport.name}: story copy event was not blocked`);
    assert.equal(scan.textareaCopyPrevented, false, `${viewport.name}: textarea copy event was blocked`);
    report.scans.push({ viewport: viewport.name, ...scan, passed: true });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  console.log("text copy lock browser check passed");
} catch (error) {
  report.status = "failed";
  report.error = error?.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", reference = "HEAD", output = "artifacts/refactor-loader"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const original = execFileSync("git", ["show", `${reference}:gaia-mode-loader.js`], { encoding: "utf8", windowsHide: true });
const report = { reference, addedScriptLatencyMs: 80, samples: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const version of ["before", "after"]) {
    for (const group of ["character", "story"]) {
      const context = await browser.newContext();
      await context.route(`${base}/**`, async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (!pathname.endsWith(".js")) return route.continue();
        await new Promise(resolve => setTimeout(resolve, report.addedScriptLatencyMs));
        if (version === "before" && pathname === "/gaia-mode-loader.js") return route.fulfill({ body: original, contentType: "text/javascript" });
        return route.continue();
      });
      const page = await context.newPage();
      page.on("pageerror", error => report.errors.push(`${version}/${group}: ${error.message}`));
      await page.goto(base, { waitUntil: "load" });
      await page.waitForFunction(() => globalThis.GaiaModeLoader);
      const sample = await page.evaluate(async group => {
        const before = document.querySelectorAll('link[data-gaia-lazy-asset="preload"]').length;
        const start = performance.now();
        await GaiaModeLoader.load(group);
        const durationMs = performance.now() - start;
        const scripts = [...document.querySelectorAll('script[data-gaia-lazy-asset="script"]')].map(node => ({
          path: new URL(node.src).pathname,
          resources: performance.getEntriesByName(node.src).map(entry => ({ start: entry.startTime - start, end: entry.responseEnd - start, initiator: entry.initiatorType })),
        }));
        return { before, durationMs, scripts };
      }, group);
      assert.equal(sample.before, 0, "Opening must remain lazy");
      assert(sample.scripts.every(script => script.resources.length === 1), "Preloads must be consumed without duplicate script requests");
      report.samples.push({ version, group, ...sample });
      console.log(JSON.stringify({ version, group, durationMs: sample.durationMs, scripts: sample.scripts.length }));
      await context.close();
    }
  }
  for (const group of ["character", "story"]) {
    const before = report.samples.find(sample => sample.version === "before" && sample.group === group);
    const after = report.samples.find(sample => sample.version === "after" && sample.group === group);
    assert.deepEqual(after.scripts.map(script => script.path), before.scripts.map(script => script.path), "Script order must remain identical");
    const first = after.scripts[0].resources[0];
    assert(after.scripts.every(script => script.resources[0].start < first.end), "All classic scripts must be discovered before the first download finishes");
  }
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

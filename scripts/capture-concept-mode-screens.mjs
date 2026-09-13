import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const [base = "http://127.0.0.1:4397", output = "artifacts/concept-page-v5/source"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const report = { capturedAt: new Date().toISOString(), base, viewport: { width: 1600, height: 900 }, network: "Local implementation and bundled data only; external services blocked", captures: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  });
  await context.route("**/*", route => {
    const url = route.request().url();
    if (!url.startsWith(base)) return route.abort();
    if (url.includes("/api/live/v1/")) return route.fulfill({ status: 503, json: { error: "Use bundled observations for the local screenshot" } });
    return route.continue();
  });
  page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  const capture = async (name, selectors) => {
    await page.mouse.move(12, 450);
    await page.waitForTimeout(5000);
    const state = await page.evaluate(selectors => Object.fromEntries(selectors.map(selector => {
      const node = document.querySelector(selector);
      return [selector, node ? { text: (node.innerText || "").trim().slice(0, 500), visible: node.checkVisibility(), dataset: { ...node.dataset }, bounds: node.getBoundingClientRect().toJSON() } : null];
    })), selectors);
    const source = path.join(output, `${name}.png`);
    await page.screenshot({ path: source });
    const target = `assets/concept/${name}.webp`;
    const converted = await sharp(source).resize({ width: 1200 }).webp({ quality: 90, effort: 6 }).toFile(target);
    report.captures.push({ name, url: page.url(), state, source, target, width: converted.width, height: converted.height, bytes: converted.size, sha256: createHash("sha256").update(fs.readFileSync(target)).digest("hex") });
    console.log(JSON.stringify(report.captures.at(-1)));
  };

  await page.goto(`${base}/?preview=concept-mode-capture#world`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaMapCategories?.buttons().length === 30);
  await page.evaluate(() => {
    globalThis.GaiaMapDemo?.stop("brochure-capture");
    globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
  });
  for (const [number, name] of [[6, "brochure-map-co2-v1"], [13, "brochure-map-energy-v1"], [7, "brochure-map-currents-v1"]]) {
    await page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === number).click(), number);
    await page.waitForFunction(number => document.querySelector("#japan-title").dataset.exhibitNumber === String(number).padStart(2, "0"), number);
    await capture(name, ["#japan-layer", "#japan-title", "#japan-mode-title", "#japan-overlay"]);
    assert(report.captures.at(-1).state["#japan-overlay"]?.visible, "Capture requires the actual map canvas to be visible");
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page) await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "capture-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

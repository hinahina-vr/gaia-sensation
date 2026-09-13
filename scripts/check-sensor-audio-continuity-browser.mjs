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
const outputDir = path.resolve(outputArgument || "artifacts/sensor-audio-continuity-browser");
fs.mkdirSync(outputDir, { recursive: true });
const openingSource = fs.readFileSync(path.resolve("opening.js"), "utf8");
const audioSource = fs.readFileSync(path.resolve("opening-audio.js"), "utf8");
assert(!openingSource.includes("window.GaiaOpeningAudio?.stop(0.05)"), "pagehide must not fade out the soundtrack before navigation");
assert(audioSource.includes("navigationElapsedSeconds"), "navigation handoff must keep the soundtrack timeline moving");

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.route("**/api/public/v1/sensors", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sensors: [] }) }));
    await page.route("**/api/public/v1/measurement-types", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ measurementTypes: [] }) }));
    await page.route("**/api/web/v1/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      let body = {};
      if (pathname.endsWith("/countries")) body = { countries: [] };
      else if (pathname.endsWith("/devices")) body = { devices: [] };
      else if (pathname.endsWith("/profile")) body = { profile: { displayName: "QA", avatarUrl: null, xUrl: null, githubUrl: null, instagramUrl: null } };
      else if (pathname.endsWith("/session")) body = { user: { id: "qa" } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/#earth", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaOpeningAudio));
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "audio-start-qa";
      button.textContent = "AUDIO START QA";
      Object.assign(button.style, { position: "fixed", zIndex: "999999", inset: "12px auto auto 12px", padding: "14px" });
      button.addEventListener("click", () => void globalThis.GaiaOpeningAudio.start(0.14));
      document.body.append(button);
    });
    await page.locator("#audio-start-qa").click();
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().playing === true);
    await page.evaluate(() => globalThis.GaiaOpeningAudio.switchTrack("story", 0));
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "story" && globalThis.GaiaOpeningAudio?.getState?.().playing === true);
    await page.waitForTimeout(900);
    const before = await page.evaluate(() => ({
      ...globalThis.GaiaOpeningAudio.getPlaybackState(),
      sampledAt: Date.now(),
    }));

    await page.evaluate(() => {
      document.querySelector("#audio-start-qa")?.remove();
      const source = document.querySelector("[data-sensor-platform-link]");
      const link = document.createElement("a");
      link.id = "sensor-audio-qa-link";
      link.href = source.href;
      link.dataset.sensorPlatformLink = "";
      link.textContent = "SENSOR QA";
      Object.assign(link.style, { position: "fixed", zIndex: "99999", inset: "12px auto auto 12px", padding: "14px" });
      document.body.append(link);
    });
    await page.locator("#sensor-audio-qa-link").click();
    await page.waitForURL(/\/sensors\/?(?:#map)?$/u);
    await page.waitForFunction(() => Boolean(globalThis.GaiaOpeningAudio && document.querySelector("#gaia-audio-toggle")));
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "sensorfield" && globalThis.GaiaOpeningAudio?.getState?.().playing === true, null, { timeout: 10_000 });
    const after = await page.evaluate(() => {
      const state = globalThis.GaiaOpeningAudio.getPlaybackState();
      const button = document.querySelector("#gaia-audio-toggle");
      const rect = button.getBoundingClientRect();
      return {
        ...state,
        sampledAt: Date.now(),
        buttonHeight: rect.height,
        buttonWidth: rect.width,
        buttonLabel: button.getAttribute("aria-label"),
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    assert.equal(after.track, "sensorfield", `${viewport.name}: sensor soundtrack was not selected`);
    assert.equal(after.muted, false, `${viewport.name}: BGM became muted on sensor navigation`);
    assert.equal(after.playing, true, `${viewport.name}: BGM stopped on sensor navigation`);
    assert(Math.abs(after.volume - before.volume) < 0.001, `${viewport.name}: BGM volume changed`);
    assert(after.outputVolume < before.volume, `${viewport.name}: sensor soundtrack did not begin with a fade-in`);
    await page.waitForTimeout(1400);
    const fadedIn = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    assert(Math.abs(fadedIn.outputVolume - before.volume) < 0.001, `${viewport.name}: sensor soundtrack did not finish fading in`);
    assert.equal(after.buttonLabel, "音量調整を開く");
    assert.equal(after.overflowX, 0);

    await page.locator(".sensor-home-back").click();
    await page.waitForURL(/\/#top$/u);
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "senseware"
      && globalThis.GaiaOpeningAudio?.getState?.().playing === true, null, { timeout: 10_000 });
    const returned = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    assert.equal(returned.track, "senseware", `${viewport.name}: top soundtrack was not selected on return`);
    assert.equal(returned.muted, false, `${viewport.name}: BGM became muted on return from sensors`);
    assert.equal(returned.playing, true, `${viewport.name}: BGM stopped on return from sensors`);
    assert(Math.abs(returned.volume - before.volume) < 0.001, `${viewport.name}: BGM volume changed on return`);
    assert(returned.outputVolume < returned.volume, `${viewport.name}: top soundtrack did not begin with a fade-in`);
    await page.waitForTimeout(1400);
    const returnedFadedIn = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    assert(Math.abs(returnedFadedIn.outputVolume - before.volume) < 0.001, `${viewport.name}: top soundtrack did not finish fading in`);

    await page.evaluate(() => document.querySelector("[data-sensor-platform-link]")?.click());
    await page.waitForURL(/\/sensors\/?(?:#map)?$/u);
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "sensorfield"
      && globalThis.GaiaOpeningAudio?.getState?.().playing === true, null, { timeout: 10_000 });
    await page.evaluate(() => document.querySelector('[data-gaia-audio-transition="mapambient"]')?.click());
    await page.waitForURL(/\/#world$/u);
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "mapambient"
      && globalThis.GaiaOpeningAudio?.getState?.().playing === true, null, { timeout: 10_000 });
    const mapReturned = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    assert.equal(mapReturned.muted, false, `${viewport.name}: BGM became muted on map return`);
    assert.equal(mapReturned.playing, true, `${viewport.name}: BGM stopped on map return`);
    assert(Math.abs(mapReturned.volume - before.volume) < 0.001, `${viewport.name}: BGM volume changed on map return`);

    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`), fullPage: false });
    report.scans.push({ viewport: viewport.name, before, after, fadedIn, returned, returnedFadedIn, mapReturned, passed: true });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join("\n")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join("\n")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Sensor audio continuity browser check passed: ${report.scans.length} viewports`);

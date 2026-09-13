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
const outputDir = path.resolve(outputArgument || "artifacts/route-bgm");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
];
const targetOrigin = new URL(baseUrl).origin;
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [], networkAccessDenied: [] };
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("gaia-senseware-bgm-volume", "0.2");
      localStorage.setItem("gaia:opening-route-guide:v3", "seen");
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      globalThis.__gaiaMediaElementSourceCalls = 0;
      globalThis.__gaiaAudioContinuity = { waiting: 0, stalled: 0, errors: 0 };
      const instrumentedMedia = new WeakSet();
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function instrumentPlayback(...args) {
        if (!instrumentedMedia.has(this)) {
          instrumentedMedia.add(this);
          this.addEventListener("waiting", () => { globalThis.__gaiaAudioContinuity.waiting += 1; });
          this.addEventListener("stalled", () => { globalThis.__gaiaAudioContinuity.stalled += 1; });
          this.addEventListener("error", () => { globalThis.__gaiaAudioContinuity.errors += 1; });
        }
        return nativePlay.apply(this, args);
      };
      const prototypes = new Set([
        globalThis.AudioContext?.prototype,
        globalThis.webkitAudioContext?.prototype,
      ].filter(Boolean));
      prototypes.forEach((prototype) => {
        const createMediaElementSource = prototype.createMediaElementSource;
        if (typeof createMediaElementSource !== "function") return;
        prototype.createMediaElementSource = function instrumentMediaElementSource(...args) {
          globalThis.__gaiaMediaElementSourceCalls += 1;
          return createMediaElementSource.apply(this, args);
        };
      });
    });
    const page = await context.newPage();
    if (viewport.mobile) {
      const devtools = await context.newCDPSession(page);
      await devtools.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    const audioResponses = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (message.text().includes("ERR_NETWORK_ACCESS_DENIED")) return;
      report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText?.includes("ERR_NETWORK_ACCESS_DENIED")) {
        report.networkAccessDenied.push({ viewport: viewport.name, url: request.url() });
      }
    });
    page.on("response", (response) => {
      if (/\/assets\/audio\//u.test(response.url())) audioResponses.push({ url: response.url(), status: response.status() });
      if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
    });

    await page.goto(new URL("/?routeGuide=0", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => Boolean(globalThis.GaiaOpeningAudio));
    await page.locator("#gaia-opening-sound-on").waitFor({ state: "visible" });
    if (viewport.mobile) await page.locator("#gaia-opening-sound-on").tap();
    else await page.locator("#gaia-opening-sound-on").click();
    await page.waitForFunction(() => document.querySelector("#gaia-opening-route-other")?.offsetParent !== null);
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "opening");
    if (!audioResponses.some(({ url, status }) => url.includes("satellite-forecast-hope.mp3") && [200, 206].includes(status))) {
      await page.waitForResponse((response) => response.url().includes("satellite-forecast-hope.mp3") && [200, 206].includes(response.status()), { timeout: 10_000 });
    }
    assert(audioResponses.some(({ url, status }) => url.includes("satellite-forecast-hope.mp3") && [200, 206].includes(status)), `${viewport.name}: Planet Forecast - Hope was not requested by the opening`);

    const routeStartedAt = performance.now();
    if (viewport.mobile) await page.locator("#gaia-opening-route-other").tap();
    else await page.locator("#gaia-opening-route-other").click();
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "senseware", null, { timeout: 10_000 });
    await page.waitForFunction(() => document.querySelector("#intro-layer")?.getAttribute("aria-hidden") === "false", null, { timeout: 10_000 });
    const routeSwitchMs = performance.now() - routeStartedAt;
    await page.waitForTimeout(120);
    assert(audioResponses.some(({ url, status }) => url.includes("moonlit-source-save.mp3") && [200, 206].includes(status)), `${viewport.name}: GAIA SENSEWARE main score was not requested by the data entrance`);
    const destination = await page.evaluate(() => ({
      track: globalThis.GaiaOpeningAudio.getState().track,
      openingHidden: document.querySelector("#gaia-opening")?.hidden,
      introVisible: document.querySelector("#intro-layer")?.getAttribute("aria-hidden") === "false",
    }));
    assert.deepEqual(destination, { track: "senseware", openingHidden: true, introVisible: true });
    await page.evaluate(() => globalThis.GaiaIntroEntryGuide?.close?.({ restoreFocus: false }));
    const nativeRouteSourceCalls = await page.evaluate(() => globalThis.__gaiaMediaElementSourceCalls);
    assert.equal(nativeRouteSourceCalls, 0, `${viewport.name}: ordinary route BGM was forced through Web Audio`);
    const soundArchiveBefore = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    await page.locator('[data-intro-guide="sound"]').click();
    await page.waitForFunction(() => document.body.classList.contains("sound-mode-open"), null, { timeout: 10_000 });
    await page.waitForTimeout(400);
    const soundArchiveAfter = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    assert.equal(soundArchiveAfter.track, soundArchiveBefore.track, `${viewport.name}: sound archive changed the current soundtrack on entry`);
    assert.equal(soundArchiveAfter.muted, false, `${viewport.name}: sound archive muted the current soundtrack on entry`);
    assert.equal(soundArchiveAfter.playing, true, `${viewport.name}: sound archive stopped the current soundtrack on entry`);
    assert(Math.abs(soundArchiveAfter.volume - soundArchiveBefore.volume) < 0.001, `${viewport.name}: sound archive changed the BGM volume on entry`);
    assert(soundArchiveAfter.currentTime > soundArchiveBefore.currentTime, `${viewport.name}: soundtrack timeline did not advance in the sound archive`);
    await page.locator("#sound-close").click();
    await page.waitForFunction(() => !document.body.classList.contains("sound-mode-open"), null, { timeout: 10_000 });
    const mapPath = page.locator('[data-intro-path="map"]');
    if (viewport.mobile) await mapPath.tap();
    else await mapPath.click();
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "moonreopen", null, { timeout: 10_000 });
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false", null, { timeout: 10_000 });
    if (!audioResponses.some(({ url, status }) => url.includes("moonlit-reopen.mp3") && [200, 206].includes(status))) {
      await page.waitForResponse((response) => response.url().includes("moonlit-reopen.mp3") && [200, 206].includes(response.status()), { timeout: 10_000 });
    }
    assert(audioResponses.some(({ url, status }) => url.includes("moonlit-reopen.mp3") && [200, 206].includes(status)), `${viewport.name}: Blue Glass Tide was not requested by the map`);
    await page.waitForFunction(() => {
      const state = globalThis.GaiaOpeningAudio?.getPlaybackState?.();
      return state?.track === "moonreopen" && state.playing;
    }, null, { timeout: 10_000 });
    const continuityBefore = await page.evaluate(() => {
      globalThis.__gaiaAudioContinuity = { waiting: 0, stalled: 0, errors: 0 };
      return globalThis.GaiaOpeningAudio.getPlaybackState().currentTime;
    });
    const observationMs = viewport.mobile ? 6_000 : 3_000;
    await page.waitForTimeout(observationMs);
    const continuity = await page.evaluate(() => ({
      state: globalThis.GaiaOpeningAudio.getPlaybackState(),
      events: globalThis.__gaiaAudioContinuity,
    }));
    const playbackAdvance = continuity.state.currentTime - continuityBefore;
    assert(continuity.state.playing && playbackAdvance >= observationMs / 1_000 * 0.75, `${viewport.name}: BGM did not advance continuously: ${playbackAdvance.toFixed(3)}s`);
    assert.deepEqual(continuity.events, { waiting: 0, stalled: 0, errors: 0 }, `${viewport.name}: BGM emitted a playback interruption: ${JSON.stringify(continuity.events)}`);
    const screenshot = path.join(outputDir, `${viewport.name}-senseware-destination.png`);
    await page.screenshot({ path: screenshot, animations: "disabled" });

    await page.goto(new URL("/#japan", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "moonreopen");
    const directTrack = await page.evaluate(() => globalThis.GaiaOpeningAudio.getState().track);
    assert.equal(directTrack, "moonreopen", `${viewport.name}: direct map routes do not use Blue Glass Tide`);
    const directRouteSourceCalls = await page.evaluate(() => globalThis.__gaiaMediaElementSourceCalls);
    assert.equal(directRouteSourceCalls, 0, `${viewport.name}: direct map BGM was forced through Web Audio`);
    report.scans.push({ viewport, routeSwitchMs, destination, directTrack, nativeRouteSourceCalls, directRouteSourceCalls, playbackAdvance, soundArchiveBefore, soundArchiveAfter, continuityEvents: continuity.events, audioResponses, screenshot, passed: true });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  assert.equal(
    report.networkAccessDenied.some(({ url }) => url.startsWith(`${targetOrigin}/assets/audio/`)),
    false,
    `A required local audio request was denied: ${JSON.stringify(report.networkAccessDenied)}`,
  );
  report.status = "passed";
  console.log(`Route BGM checks passed: ${report.scans.length} viewports.`);
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

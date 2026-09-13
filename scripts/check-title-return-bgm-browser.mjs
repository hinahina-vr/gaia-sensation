import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/title-return-bgm");
const selectedCase = process.argv[4];
fs.mkdirSync(output, { recursive: true });
const cases = [
  { name: "desktop-normal", width: 1440, height: 900 },
  { name: "mobile-normal", width: 390, height: 844, mobile: true },
  { name: "desktop-direct", width: 1440, height: 900, direct: true, reduced: true },
  { name: "mobile-direct", width: 390, height: 844, mobile: true, direct: true, reduced: true },
  { name: "desktop-muted", width: 1440, height: 900, muted: true, reduced: true },
  { name: "mobile-direct-muted", width: 390, height: 844, mobile: true, direct: true, muted: true, reduced: true },
].filter(test => !selectedCase || test.name === selectedCase);
assert(cases.length, "Unknown case");
const report = { status: "running", scans: [], errors: [], missing: [] };
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});

try {
  for (const test of cases) {
    const context = await browser.newContext({
      viewport: { width: test.width, height: test.height },
      hasTouch: Boolean(test.mobile), isMobile: Boolean(test.mobile),
      reducedMotion: test.reduced ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => {
      // Preserve navigation preferences across title and exploration entries.
      localStorage.setItem("gaia-senseware-bgm-volume", "0.37");
      globalThis.__qaDocumentId = performance.timeOrigin;
      globalThis.__qaPlayers = [];
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        if (!globalThis.__qaPlayers.includes(this)) globalThis.__qaPlayers.push(this);
        return nativePlay.apply(this, args);
      };
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ case: test.name, message: error.message }));
    page.on("response", response => {
      if (response.status() === 404) report.missing.push({ case: test.name, url: response.url() });
    });
    const press = selector => test.mobile ? page.locator(selector).tap() : page.locator(selector).click();
    const state = () => page.evaluate(() => ({
      ...GaiaOpeningAudio.getPlaybackState(),
      documentId: __qaDocumentId,
      players: __qaPlayers.map(player => ({ src: player.currentSrc || player.src, paused: player.paused, volume: player.volume })),
    }));
    const waitTrack = async track => {
      await page.waitForFunction(({ expected, muted }) => {
        const audio = globalThis.GaiaOpeningAudio?.getPlaybackState?.();
        return audio?.track === expected && audio.muted === muted
          && (muted ? audio.outputVolume === 0 : audio.playing && audio.outputVolume > 0.36);
      }, { expected: track, muted: Boolean(test.muted) }, { timeout: 12_000 });
      const current = await state();
      assert.equal(current.track, track);
      assert.equal(current.muted, Boolean(test.muted));
      assert(Math.abs(current.volume - 0.37) < 0.001, `${test.name}: volume preference changed`);
      const audible = current.players.filter(player => !player.paused && player.volume > 0.001);
      assert.equal(audible.length, test.muted ? 0 : 1, `${test.name}: overlapping or missing soundtrack`);
      if (!test.muted) {
        assert.match(audible[0].src, track === "opening" ? /satellite-forecast-hope\.mp3/u : /moonlit-source-save\.mp3/u);
        await page.waitForTimeout(180);
        assert((await state()).currentTime > current.currentTime, `${test.name}: selected soundtrack is not advancing`);
      }
      return current;
    };
    const waitIntro = async () => {
      await page.waitForFunction(() => document.querySelector("#gaia-opening")?.hidden
        && document.querySelector("#intro-layer")?.getAttribute("aria-hidden") === "false"
        && document.querySelector("#gaia-boot")?.hidden);
      await page.evaluate(() => GaiaIntroEntryGuide?.close?.({ restoreFocus: false }));
    };
    const waitTitle = () => page.waitForFunction(() => {
      const opening = document.querySelector("#gaia-opening");
      const menu = document.querySelector("#gaia-opening-final-menu");
      return opening && !opening.hidden && !opening.inert
        && menu && !menu.hidden && !menu.inert && menu.classList.contains("is-visible")
        && document.querySelector("#intro-layer")?.getAttribute("aria-hidden") !== "false"
        && document.querySelector("#gaia-boot")?.hidden;
    });

    await page.goto(`${base}/?routeGuide=0${test.direct ? "#top" : ""}`, { waitUntil: "domcontentloaded" });
    if (test.direct) {
      await waitIntro();
      if (!test.muted) {
        await press("#gaia-audio-toggle");
        await press("#gaia-audio-toggle");
      }
    } else {
      await page.waitForFunction(() => document.querySelector("#gaia-boot")?.hidden);
      await press(test.muted ? "#gaia-opening-sound-off" : "#gaia-opening-sound-on");
      if (!test.reduced) await press("#gaia-opening-skip");
      await waitTrack("opening");
      await press("#gaia-opening-route-other");
      await waitIntro();
    }
    const entrance = await waitTrack("senseware");
    const returnedAt = Date.now();
    await press("#intro-title-return");
    await waitTitle();
    const title = await waitTrack("opening");
    const returnMs = Date.now() - returnedAt;
    assert.equal(title.documentId, entrance.documentId, `${test.name}: title return must not reboot the app`);
    assert.equal(new URL(page.url()).hash, "");
    await page.screenshot({ path: path.join(output, `${test.name}-title.png`) });

    await press("#gaia-opening-route-other");
    await waitIntro();
    const reentry = await waitTrack("senseware");
    await press("#intro-title-return");
    await waitTitle();
    // Re-enter before title fade-in completes, then return again. The final
    // screen must own playback even when route requests supersede a fade.
    await press("#gaia-opening-route-other");
    await waitIntro();
    await press("#intro-title-return");
    await waitTitle();
    const repeatedTitle = await waitTrack("opening");
    const preferences = await page.evaluate(() => ({
      storedVolume: localStorage.getItem("gaia-senseware-bgm-volume"),
      muted: document.querySelector("#gaia-audio-dock")?.dataset.muted,
      resumeFlag: sessionStorage.getItem("gaia:title-return-resume"),
    }));
    assert.equal(preferences.storedVolume, "0.37");
    assert.equal(preferences.muted, String(Boolean(test.muted)));
    assert.equal(preferences.resumeFlag, null);
    report.scans.push({ case: test.name, entrance, title, returnMs, reentry, repeatedTitle, preferences, passed: true });
    console.log(`${test.name}: passed (${returnMs}ms title return)`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missing, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

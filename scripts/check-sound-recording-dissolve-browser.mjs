import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { seedHeardSoundArchive } from "./sound-archive-fixture.mjs";
import { approvedDescriptions } from './sound-description-fixture.mjs';

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/sound-recording-dissolve");
const filter = process.argv[4];
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [], missing: [] };
const cases = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "4k", width: 3840, height: 2160 },
  { name: "mobile", width: 390, height: 844, mobile: true },
  { name: "small", width: 320, height: 568, mobile: true },
  { name: "minimum", width: 280, height: 653, mobile: true },
  { name: "landscape", width: 568, height: 320, mobile: true },
  { name: "wide-landscape", width: 844, height: 390, mobile: true },
  { name: "reduced", width: 1440, height: 900, reduced: true },
  { name: "mobile-reduced", width: 390, height: 844, mobile: true, reduced: true },
].filter(test => !filter || test.name === filter);
assert(cases.length, "Unknown viewport");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const head = ".sound-now-playing[aria-live]";
const waitTrack = (page, track) => page.waitForFunction(expected => {
  const surface = document.querySelector(".sound-now-playing[aria-live]");
  const image = surface?.querySelector(".sound-cover-art img");
  return surface?.dataset.track === expected && surface.getAttribute("aria-busy") === "false"
    && image?.complete && image.naturalWidth > 0;
}, track);
const geometry = page => page.evaluate(() => {
  const live = document.querySelector(".sound-now-playing[aria-live]");
  const player = document.querySelector(".sound-player");
  const origin = player.getBoundingClientRect();
  const rect = node => {
    const r = node.getBoundingClientRect();
    return { left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top,
      bottom: r.bottom - origin.top, width: r.width, height: r.height };
  };
  const image = live.querySelector(".sound-cover-art img");
  const layout = document.querySelector(".sound-layout");
  return {
    track: live.dataset.track, title: live.querySelector("h3").textContent,
    descriptionText: live.querySelector("p:last-child").textContent,
    src: image.getAttribute("src"), imageLoaded: image.complete && image.naturalWidth > 0,
    cover: rect(live.querySelector(".sound-cover-art")), head: rect(live),
    titleRect: rect(live.querySelector("h3")), description: rect(live.querySelector("p:last-child")),
    transport: rect(document.querySelector(".sound-transport")), volume: rect(document.querySelector(".sound-volume")),
    headOverflow: live.scrollWidth - live.clientWidth, layoutOverflow: layout.scrollWidth - layout.clientWidth,
    ids: ["sound-track-number", "sound-track-title", "sound-mode-description"].map(id => document.querySelectorAll(`[id="${id}"]`).length),
    echoes: document.querySelectorAll(".sound-player-echo").length,
    echoAccessible: [...document.querySelectorAll(".sound-player-echo")].some(echo => !echo.inert || echo.getAttribute("aria-hidden") !== "true" || echo.querySelector("[id]")),
    echoRect: player.querySelector(".sound-player-echo") ? rect(player.querySelector(".sound-player-echo")) : null,
  };
});
const seekMotion = (page, time) => page.evaluate(time => {
  const player = document.querySelector(".sound-player");
  for (const animation of player.getAnimations({ subtree: true })) {
    animation.pause();
    animation.currentTime = time;
  }
  const live = player.querySelector(".sound-now-playing[aria-live]");
  const echo = player.querySelector(".sound-player-echo");
  const read = node => node ? { opacity: Number(getComputedStyle(node).opacity), filter: getComputedStyle(node).filter } : null;
  return {
    names: player.getAnimations({ subtree: true }).map(a => a.animationName),
    incoming: read(live.querySelector(".sound-cover-art img")), title: read(live.querySelector("h3")),
    description: read(live.querySelector("p:last-child")), outgoing: read(echo?.querySelector(".sound-cover-art img")),
    oldTitle: echo?.querySelector("h3")?.textContent,
  };
}, time);

try {
  for (const test of cases) {
    const page = await browser.newPage({
      viewport: { width: test.width, height: test.height },
      hasTouch: Boolean(test.mobile), isMobile: Boolean(test.mobile),
      reducedMotion: test.reduced ? "reduce" : "no-preference",
    });
    page.on("pageerror", error => report.errors.push({ case: test.name, message: error.message }));
    page.on("response", response => { if (response.status() === 404) report.missing.push(response.url()); });
    await seedHeardSoundArchive(page);
    await page.goto(`${base}/#sound`);
    await page.waitForFunction(() => document.querySelector("#gaia-boot")?.hidden);
    await waitTrack(page, "opening");
    await page.waitForTimeout(360);
    const tracks = await page.locator("[data-sound-track]").evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.soundTrack, title: node.querySelector("strong").textContent })));
    assert.equal(tracks.length, 12);
    const before = await geometry(page);
    const scans = [];
    const assets = new Set();
    let previousTitle = before.title;
    for (const [index, track] of tracks.entries()) {
      // Keep the geometry pass silent. Real playback and UI selection are
      // exercised separately below.
      await page.evaluate(async id => {
        await GaiaOpeningAudio.setMuted(true);
        await GaiaOpeningAudio.switchTrack(id, 0);
      }, track.id);
      await waitTrack(page, track.id);
      if (index > 0 && !test.reduced) {
        const start = await seekMotion(page, 0);
        assert(start.names.includes("sound-jacket-arrive"), `${test.name}/${track.id}: no jacket arrival`);
        assert(start.names.includes("sound-recording-title-arrive"), `${test.name}/${track.id}: no title arrival`);
        assert.equal(start.incoming.opacity, 0);
        assert.equal(start.title.opacity, 0);
        assert.equal(start.description.opacity, 0);
        assert.equal(start.oldTitle, previousTitle, `${test.name}: previous recording was overwritten in its echo`);
        assert(start.outgoing.opacity > 0.95);
        const middle = await seekMotion(page, 360);
        assert(middle.incoming.opacity > 0 && middle.incoming.opacity < 1);
        assert(middle.outgoing.opacity > 0 && middle.outgoing.opacity < 1);
        assert(middle.title.opacity > middle.description.opacity, `${test.name}: description did not follow the title`);
        if (index === 1 && ["desktop", "4k", "mobile"].includes(test.name)) {
          await page.locator(head).screenshot({ path: path.join(output, `${test.name}-transition.png`) });
        }
      } else if (test.reduced) {
        assert.deepEqual((await seekMotion(page, 0)).names, [], `${test.name}: reduced motion still animates the player`);
      }
      await seekMotion(page, 1780);
      const current = await geometry(page);
      assert.equal(current.title, track.title);
      assert.equal(current.track, track.id);
      if (approvedDescriptions[track.id]) assert.equal(current.descriptionText, approvedDescriptions[track.id]);
      assert(current.imageLoaded);
      assert(!assets.has(current.src), `${test.name}/${track.id}: duplicate album jacket`);
      assets.add(current.src);
      assert(current.cover.width >= 64 && current.cover.height >= 64, `${test.name}: jacket is hidden`);
      assert(Math.abs(current.cover.width - current.cover.height) < 1, `${test.name}: jacket is not square`);
      assert(current.headOverflow <= 1 && current.layoutOverflow <= 1, `${test.name}/${track.id}: horizontal overflow`);
      assert(current.description.bottom <= current.head.bottom + 1, `${test.name}/${track.id}: copy escaped its reserved space`);
      assert(current.titleRect.left >= current.cover.right - 1, `${test.name}/${track.id}: title overlaps jacket`);
      assert(current.transport.top >= current.head.bottom - 1, `${test.name}/${track.id}: controls overlap the recording`);
      assert(Math.abs(current.transport.top - before.transport.top) <= 1, `${test.name}/${track.id}: playback controls jumped`);
      assert(Math.abs(current.volume.top - before.volume.top) <= 1, `${test.name}/${track.id}: volume controls jumped`);
      assert.deepEqual(current.ids, [1, 1, 1]);
      assert(current.echoes <= 1 && !current.echoAccessible);
      if (current.echoRect) {
        assert(Math.abs(current.echoRect.left - current.head.left) <= 1, `${test.name}: echo is horizontally offset`);
        assert(Math.abs(current.echoRect.top - current.head.top) <= 1, `${test.name}: echo is vertically offset`);
      }
      if ([0, 1, 11].includes(index)) {
        await page.locator(head).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${test.name}-${track.id}.png`) });
      }
      if (test.name === "desktop") await page.locator(`${head} .sound-cover-art`).screenshot({ path: path.join(output, `cover-${track.id}.png`) });
      previousTitle = current.title;
      scans.push(current);
    }
    await page.waitForTimeout(1850);
    assert.equal(await page.locator(".sound-player-echo").count(), 0);
    assert.equal(await page.locator(".sound-player-measure").count(), 0);
    assert.equal(await page.locator(".sound-player.is-track-changing").count(), 0);
    report.scans.push({ viewport: test.name, scans, passed: true });
    console.log(`${test.name}: all 12 jackets, transitions, and stable controls passed`);
    await page.close();
  }

  // Actual clicks, native audio playback, controls during the dissolve, and
  // slow artwork arriving after another selection/close are separate checks.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await seedHeardSoundArchive(page);
  page.on("pageerror", error => report.errors.push({ case: "interaction", message: error.message }));
  await page.addInitScript(() => {
    globalThis.__qaPlayers = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (!__qaPlayers.includes(this)) __qaPlayers.push(this);
      return play.apply(this, args);
    };
  });
  await page.route("**/novel-bg-production-night-v2.png", async route => {
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.continue();
  });
  await page.goto(`${base}/#sound`);
  await page.waitForFunction(() => document.querySelector("#gaia-boot")?.hidden);
  await waitTrack(page, "opening");
  await page.locator('[data-sound-track="story"]').click();
  await waitTrack(page, "story");
  await page.waitForFunction(() => GaiaOpeningAudio.getPlaybackState().playing && GaiaOpeningAudio.getPlaybackState().duration > 0);
  await page.locator("#sound-volume").evaluate(input => {
    input.value = "27"; input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.evaluate(() => GaiaOpeningAudio.getState().volume), .27);
  await page.locator("#sound-progress").evaluate(input => {
    input.value = "400";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert(await page.evaluate(() => { const s = GaiaOpeningAudio.getPlaybackState(); return s.currentTime / s.duration >= .39; }));
  await page.locator("#sound-play").click();
  assert.equal(await page.evaluate(() => GaiaOpeningAudio.getState().muted), true);
  await page.locator("#sound-play").click();
  assert.equal(await page.evaluate(() => GaiaOpeningAudio.getState().muted), false);
  await page.locator('[data-sound-track="moonbook"]').click();
  await waitTrack(page, "moonbook");
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(output, "real-switch-220.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => !document.querySelector(".sound-player-echo"));
  assert.equal(await page.locator(".sound-player-echo").count(), 0);
  assert.deepEqual((await seekMotion(page, 0)).names, []);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => GaiaOpeningAudio.setMuted(true));
  await page.locator('[data-sound-track="snowfire"]').click();
  await page.waitForFunction(() => document.querySelector(".sound-now-playing[aria-live]")?.getAttribute("aria-busy") === "true");
  await page.locator('[data-sound-track="firstlight"]').click();
  await page.locator('[data-sound-track="trueend"]').click();
  await page.locator("#sound-close").click();
  await page.waitForTimeout(2100);
  assert.equal(await page.locator(".sound-player-echo").count(), 0);
  assert.equal(await page.locator(".sound-player.is-track-changing").count(), 0);
  assert.equal(await page.locator("#sound-layer").evaluate(node => node.hidden), true);
  await page.evaluate(() => { location.hash = "sound"; });
  await waitTrack(page, "trueend");
  await page.waitForFunction(() => { const s = GaiaOpeningAudio.getPlaybackState(); return s.track === "trueend" && s.playing && !s.muted && s.outputVolume > .26; });
  const playback = await page.evaluate(() => ({
    state: GaiaOpeningAudio.getPlaybackState(),
    audible: __qaPlayers.filter(player => !player.paused && player.volume > .001).map(player => player.src),
  }));
  assert.equal(playback.audible.length, 1);
  assert.equal(playback.state.volume, .27);
  assert.match(playback.audible[0], /sensory-horizon\.wav/u);
  report.interaction = { playback, passed: true };
  await page.close();
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

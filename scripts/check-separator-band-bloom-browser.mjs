import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/separator-band-bloom");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "4k", width: 3840, height: 2160 },
  { name: "mobile", width: 390, height: 844 },
  { name: "minimum", width: 280, height: 653 },
  { name: "landscape", width: 568, height: 320 },
  { name: "reduced", width: 390, height: 844, reduced: true },
];
const select = (page, number) => page.evaluate(number => {
  [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
    .find(button => button.textContent.trim() === String(number).padStart(2, "0")).click();
}, number);
const readPhases = (page, times) => page.evaluate(times => {
  const layer = document.querySelector("#map-title-transition");
  const title = document.querySelector("#map-title-transition-text");
  const subtitle = document.querySelector("#map-title-transition-subtitle");
  const copy = layer.querySelector(".map-title-transition-copy");
  const animations = layer.getAnimations({ subtree: true });
  return times.map(time => {
    animations.forEach(animation => { animation.pause(); animation.currentTime = time; });
    const root = getComputedStyle(layer);
    const band = getComputedStyle(layer, "::before");
    const type = getComputedStyle(title);
    const rect = title.getBoundingClientRect();
    const subRect = subtitle.getBoundingClientRect();
    const copyMatrix = new DOMMatrix(getComputedStyle(copy).transform);
    return {
      time, names: animations.map(animation => animation.animationName),
      rootOpacity: Number(root.opacity), rootPointer: root.pointerEvents,
      bandOpacity: Number(band.opacity), bandScale: new DOMMatrix(band.transform).a,
      bandX: new DOMMatrix(band.transform).e, bandOrigin: band.transformOrigin,
      bandCurve: band.animationTimingFunction,
      copyX: copyMatrix.e, copyY: copyMatrix.f, copyOpacity: Number(getComputedStyle(copy).opacity), overflow: root.overflow,
      subtitle: subtitle.textContent, subtitleOpacity: Number(getComputedStyle(subtitle).opacity),
      subtitleRect: { x: subRect.x, right: subRect.right, y: subRect.y, bottom: subRect.bottom },
      text: title.textContent, typeOpacity: Number(type.opacity), typeScale: new DOMMatrix(type.transform).a,
      typeFilter: type.filter, typeColor: type.color, typeShadow: type.textShadow,
      rect: { x: rect.x, right: rect.right, y: rect.y, bottom: rect.bottom },
    };
  });
}, times);

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.width < 720,
      reducedMotion: viewport.reduced ? "reduce" : "no-preference",
    });
    page.on("pageerror", error => report.errors.push({ viewport: viewport.name, message: error.message }));
    await page.addInitScript(() => sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"));
    await page.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await page.goto(`${base}/?preview=separator-band-bloom&live=1#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length >= 30 && document.querySelector("#gaia-boot")?.hidden);
    await page.evaluate(() => { GaiaMapDemo?.stop?.(); GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }); });
    await select(page, 7);
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await select(page, 6);
    await page.waitForFunction(() => document.querySelector("#map-title-transition-text").textContent === document.querySelector("#japan-title").textContent
      && document.querySelector("#japan-title").dataset.exhibitNumber === "06"
      && document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const expected = await page.evaluate(() => ({ title: document.querySelector("#japan-title").textContent, subtitle: GaiaAppContent.MAP_TITLE_SUBTITLES["06"] }));
    const times = viewport.reduced ? [0, 100, 1700, 1959.999] : [0, 150, 300, 450, 600, 690, 735, 1050, 2200, 2350, 2450, 2475, 2500, 2625, 2775, 2999.999];
    const phases = await readPhases(page, times);
    const scan = { viewport, phases, passed: false };
    report.scans.push(scan);
    for (const phase of phases) {
      assert.equal(phase.text, expected.title);
      assert.equal(phase.subtitle, expected.subtitle);
      assert.equal(phase.rootPointer, "none");
      assert(phase.bandOrigin.startsWith("0px "), `${viewport.name}: band does not start at the left edge`);
      assert.equal(phase.copyX, 0, "Text must never slide with the band");
      assert.equal(phase.copyY, 0, "Text must remain anchored while fading");
      assert.equal(phase.overflow, "hidden", "The outgoing band must be clipped");
      if (viewport.reduced || phase.time <= 2450) assert(Math.abs(phase.bandX) < .001);
      for (const rect of [phase.rect, phase.subtitleRect]) {
        assert(rect.x >= -1 && rect.right <= viewport.width + 1
          && rect.y >= -1 && rect.bottom <= viewport.height + 1, `${viewport.name}: type escapes the viewport`);
      }
      assert(phase.subtitleRect.y > phase.rect.bottom, "Subtitle must sit below the title");
    }
    if (viewport.reduced) {
      assert(phases.every(phase => phase.bandScale === 1 && phase.typeScale === 1 && phase.typeFilter === "none"));
      assert(phases.every(phase => phase.names.includes("map-title-separator-still")));
      assert.equal(phases[1].typeOpacity, 1);
      assert.equal(phases[1].typeShadow, phases[2].typeShadow, "Reduced motion must not flare");
    } else {
      const [start, quarter, half, threeQuarters, bandDone, typeArriving, bloom, hold, extendedHold, fading, exitStart, overlapping, faded, leave, laterLeave, end] = phases;
      assert.equal(start.bandScale, 0);
      assert(quarter.bandScale > .5 && quarter.bandScale < 1);
      assert(half.bandScale > quarter.bandScale && half.bandScale < 1);
      assert(threeQuarters.bandScale > half.bandScale && threeQuarters.bandScale < 1);
      assert(half.bandScale - quarter.bandScale > threeQuarters.bandScale - half.bandScale, "Band is not easing out");
      assert.equal(bandDone.bandScale, 1);
      assert.equal(quarter.bandCurve, "cubic-bezier(0.16, 0.84, 0.22, 1)");
      // Decimal keyframe percentages may round the boundary by microseconds.
      assert(phases.slice(0, 5).every(phase => phase.typeOpacity < .0001), "Type appeared before the band finished");
      assert(typeArriving.typeOpacity > .5 && typeArriving.typeOpacity < 1);
      assert.equal(bloom.typeOpacity, 1);
      assert.equal(bloom.typeScale, 1.025);
      assert.equal(bloom.typeColor, "rgb(255, 255, 246)");
      assert(bloom.typeShadow.includes("82px"), "Type has no luminous bloom");
      assert.equal(hold.typeFilter, "none");
      assert.equal(hold.typeScale, 1);
      assert.equal(hold.typeOpacity, 1);
      assert.equal(hold.subtitleOpacity, 1);
      assert.equal(extendedHold.typeOpacity, 1, "Title must remain readable until the shortened hold ends");
      assert.equal(extendedHold.subtitleOpacity, 1);
      assert.equal(extendedHold.rootOpacity, 1);
      assert.equal(extendedHold.copyOpacity, 1);
      assert(Math.abs(fading.copyOpacity - .5) < .01, "Both lines fade in place before the band moves");
      assert.equal(fading.bandX, 0);
      assert(Math.abs(exitStart.bandX) < .001);
      assert(exitStart.copyOpacity > 0 && exitStart.copyOpacity < .2, "The text is almost gone when the band starts");
      assert(overlapping.bandX > 0 && overlapping.copyOpacity > 0 && overlapping.copyOpacity < .1, "Band departure overlaps only the end of the fade");
      assert(faded.copyOpacity < .001);
      assert.equal(leave.copyOpacity, 0);
      for (const phase of [fading, exitStart, overlapping, faded, leave, laterLeave, end]) {
        assert.deepEqual(phase.rect, hold.rect, "Title moved during the fade");
        assert.deepEqual(phase.subtitleRect, hold.subtitleRect, "Subtitle moved during the fade");
      }
      assert(leave.bandX > 0 && laterLeave.bandX > leave.bandX, "Band must glide to the right");
      assert.equal(leave.bandScale, 1, "The departing band must not retract");
      assert(end.bandX >= viewport.width, "The band must fully clear the viewport");
      assert(end.rootOpacity < .0001);
      const [cleared, afterglow] = await readPhases(page, [2850, 2925]);
      assert(cleared.bandX >= viewport.width && cleared.rootOpacity > .999, "Band must clear before the backdrop fade");
      assert(afterglow.bandX >= viewport.width && afterglow.rootOpacity > 0 && afterglow.rootOpacity < 1, "Missing afterglow after band departure");
      scan.afterglow = { cleared, afterglow };
    }
    const clip = await page.evaluate(() => {
      const layer = document.querySelector("#map-title-transition");
      const rect = layer.getBoundingClientRect();
      const bandHeight = Number.parseFloat(getComputedStyle(layer, "::before").height);
      const y = Math.max(0, Math.floor(rect.top + rect.height / 2 - bandHeight / 2 - 24));
      return { x: Math.max(0, Math.ceil(rect.x)), y, width: Math.min(innerWidth, Math.floor(rect.width)), height: Math.min(innerHeight - y, Math.ceil(bandHeight + 48)) };
    });
    for (const time of viewport.reduced ? [100, 1840] : [150, 600, 735, 2200, 2350, 2450, 2625, 2775, 2850, 2925]) {
      await readPhases(page, [time]);
      await page.screenshot({ path: path.join(output, `${viewport.name}-${time}.jpg`), type: "jpeg", quality: 87, clip });
    }
    // The shared timeline also controls the POI gate; cleanup must still
    // remove every paused surface at the end of the shared lifecycle.
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const completed = await page.evaluate(() => ({
      state: document.querySelector("#japan-overlay").dataset.titleSeparatorState,
      duration: Number(document.querySelector("#japan-overlay").dataset.titleSeparatorEndsAt) - Number(document.querySelector("#japan-overlay").dataset.titleSeparatorStartedAt),
      animations: document.querySelector("#map-title-transition").getAnimations({ subtree: true }).length,
      opacity: getComputedStyle(document.querySelector("#map-title-transition")).opacity,
    }));
    assert.equal(completed.state, "complete");
    assert.equal(completed.animations, 0);
    assert.equal(completed.opacity, "0");
    assert(Math.abs(completed.duration - (viewport.reduced ? 1960 : 3000)) < 1);
    Object.assign(scan, { completed, passed: true });
    console.log(`${viewport.name}: band entrance, bloom, subtitle, stationary text fade, near-end band departure and lifecycle passed`);
    await page.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

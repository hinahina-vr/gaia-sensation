import { chromium } from "playwright-core";
import { seedHeardSoundArchive } from "./sound-archive-fixture.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [url = "http://127.0.0.1:4173/?soundMorph=1#sound", output = "artifacts/sound-transport-reference"] = process.argv.slice(2);
const outputDir = path.resolve(output);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const report = { errors: [], viewports: [] };
const assert = (value, message) => { if (!value) throw new Error(message); };
try {
  const page = await browser.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.setViewportSize({ width: 1701, height: 925 });
  await seedHeardSoundArchive(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#sound-layer.is-open");
  await page.locator('[data-sound-track="windowlight"]').evaluate(button => button.click());
  await page.waitForFunction(() => window.GaiaOpeningAudio.getPlaybackState().duration > 0);
  await page.waitForTimeout(2500);
  for (const viewport of [
    { name: "reference", width: 1701, height: 925 },
    { name: "4k", width: 3840, height: 2088 },
    { name: "laptop", width: 1366, height: 768 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.GaiaOpeningAudio.setVolume(.62); window.GaiaOpeningAudio.seek(19); });
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      const layout = document.querySelector(".sound-layout");
      return {
        play: box("#sound-play"), seek: box("#sound-progress"), time: box("#sound-current-time"),
        loop: box(".sound-time span"), volume: box(".sound-volume"), transport: box(".sound-transport"), rail: box(".sound-track-panel"),
        overflow: layout.scrollWidth > layout.clientWidth + 2,
        playing: document.querySelector("#sound-layer").dataset.playing,
        offset: Number.parseFloat(document.querySelector("#sound-progress").style.getPropertyValue("--sound-wave-y")),
      };
    });
    assert(!geometry.overflow, `${viewport.name}: horizontal overflow`);
    assert(geometry.playing === "true" && Number.isFinite(geometry.offset), `${viewport.name}: playback or waveform missing`);
    assert(geometry.volume.bottom < geometry.rail.top, `${viewport.name}: controls overlap tracks`);
    if (viewport.width > 920) {
      assert(geometry.time.bottom < geometry.loop.top && geometry.loop.bottom < geometry.volume.top, `${viewport.name}: metadata overlaps`);
      assert(Math.abs(geometry.offset) < geometry.seek.height / 2, `${viewport.name}: animated thumb leaves hit area`);
      assert(geometry.volume.width < geometry.transport.width * .6, `${viewport.name}: volume is not compact`);
    }
    report.viewports.push({ ...viewport, ...geometry });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`) });
    if (viewport.name === "reference") {
      await page.screenshot({ path: path.join(outputDir, "controls.png"), clip: {
        x: 0, y: Math.floor(geometry.transport.top - 24),
        width: Math.ceil(geometry.transport.right + 30),
        height: Math.ceil(geometry.volume.bottom - geometry.transport.top + 48),
      } });
    }
  }
  assert(!report.errors.length, report.errors.join(" | "));
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = String(error); throw error;
} finally {
  await writeFile(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log("Transport reference verified: playback, separated time/loop/volume, bounded seek handle, desktop/4K/laptop/mobile.");

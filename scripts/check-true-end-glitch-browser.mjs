import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/true-end-horizontal-glitch");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 390, 3840]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : width === 3840 ? 2160 : 900 } });
    page.on("pageerror", error => report.errors.push(error.message));
    const signatures = [];
    for (let run = 0; run < 3; run++) {
      await page.goto(`${base}/artifacts/true-end-glitch-preview.html?frame=50&run=${run}`);
      await page.waitForFunction(() => document.getAnimations().length > 0 && document.getAnimations().every(animation => animation.playState === "paused"));
      const scan = await page.evaluate(() => {
        const veil = document.querySelector(".novel-staff-roll-transition-veil");
        const targets = [[document.querySelector(".novel-staff-roll-stage"), null], [veil, "::before"], [veil, "::after"], [veil.querySelector(".novel-staff-roll-transition-noise"), null]];
        const frames = [];
        const animations = document.getAnimations();
        for (let time = 0; time <= 215; time += 3.5) {
          animations.forEach(animation => { animation.currentTime = time; });
          frames.push({ time, layers: targets.map(([node, pseudo]) => {
            const style = getComputedStyle(node, pseudo);
            const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
            return { x: matrix.m41, y: matrix.m42, opacity: Number(style.opacity) };
          }) });
        }
        animations.forEach(animation => { animation.currentTime = 62; });
        return { frames, signature: document.body.style.cssText, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      signatures.push(scan.signature);
      assert.equal(scan.overflow, 0);
      for (let layer = 0; layer < 4; layer++) {
        assert(scan.frames.every(frame => frame.layers[layer].y === 0), `Layer ${layer} moves vertically`);
        assert(new Set(scan.frames.map(frame => frame.layers[layer].x)).size >= 4, `Layer ${layer} has insufficient horizontal variation`);
      }
      const changeTimes = scan.frames.filter((frame, index) => index && frame.layers[3].x !== scan.frames[index - 1].layers[3].x).map(frame => frame.time);
      const gaps = changeTimes.slice(1).map((time, index) => time - changeTimes[index]);
      assert(new Set(gaps).size > 2, "Noise still moves at a metronomic interval");
      if (run === 0) await page.screenshot({ path: path.join(output, `${width}-horizontal-tear.png`) });
      report.scans.push({ width, run, ...scan });
    }
    assert.equal(new Set(signatures).size, 3, "Replays reuse the same glitch");
    await page.close();
    console.log(`${width}px: horizontal-only stage/bands/dropout/noise, irregular timing, different replays PASS`);
  }
  const reduced = await browser.newPage({ reducedMotion: "reduce" });
  await reduced.goto(`${base}/artifacts/true-end-glitch-preview.html`);
  await reduced.locator("#play").click();
  assert.equal(await reduced.locator(".novel-staff-roll-transition-veil").count(), 0);
  assert.equal(await reduced.evaluate(() => document.getAnimations().length), 0);
  await reduced.close();
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

import path from "node:path";
import { seedHeardSoundArchive } from "./sound-archive-fixture.mjs";
import { pathToFileURL } from "node:url";

const [playwrightRoot, chromePath, routeUrl = "http://127.0.0.1:4173/?soundMorph=1#sound"] = process.argv.slice(2);
if (!playwrightRoot || !chromePath) {
  throw new Error("usage: node scripts/measure-sound-render-browser.mjs <playwright-root> <chrome-path> [url]");
}

const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--disable-background-timer-throttling"],
});

const results = [];
try {
  for (const viewport of [
    { name: "desktop", width: 2048, height: 1114 },
    { name: "wide-4k", width: 3840, height: 2088 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await seedHeardSoundArchive(page);
    await page.goto(routeUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => document.querySelector("#sound-layer")?.classList.contains("is-open"), null, { timeout: 75_000 });
    await page.waitForFunction(() => document.querySelector("#sound-visualizer")?.dataset.renderer === "webgl", null, { timeout: 15_000 });
    await page.locator('[data-sound-track="opening"]').click();
    await page.waitForFunction(() => document.querySelector("#sound-visualizer")?.dataset.analysisActive === "true", null, { timeout: 15_000 });
    await page.waitForTimeout(700);

    const sample = await page.evaluate(async () => {
      const visualizer = document.querySelector("#sound-visualizer");
      const ribbon = document.querySelector(".sound-player-signal");
      const startWebglFrame = Number(visualizer?.dataset.webglFrame || 0);
      const startRibbonFrame = Number(ribbon?.dataset.frame || 0);
      const frameDeltas = [];
      const longTasks = [];
      let previousFrame = performance.now();
      let animationHandle = 0;
      const observer = typeof PerformanceObserver === "function"
        ? new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)))
        : null;
      observer?.observe({ type: "longtask", buffered: false });
      const startedAt = performance.now();
      await new Promise((resolve) => {
        const sampleFrame = (now) => {
          frameDeltas.push(now - previousFrame);
          previousFrame = now;
          if (now - startedAt >= 3_000) {
            resolve();
            return;
          }
          animationHandle = requestAnimationFrame(sampleFrame);
        };
        animationHandle = requestAnimationFrame(sampleFrame);
      });
      cancelAnimationFrame(animationHandle);
      observer?.disconnect();
      frameDeltas.sort((a, b) => a - b);
      const elapsed = performance.now() - startedAt;
      const percentile = (ratio) => frameDeltas[Math.min(frameDeltas.length - 1, Math.floor(frameDeltas.length * ratio))] || 0;
      return {
        renderer: visualizer?.dataset.renderer,
        geometryPoints: Number(visualizer?.dataset.geometryPoints || 0),
        renderScale: Number(visualizer?.dataset.renderScale || 1),
        backingWidth: visualizer?.width || 0,
        backingHeight: visualizer?.height || 0,
        rafFps: Number((frameDeltas.length / (elapsed / 1_000)).toFixed(1)),
        webglFps: Number(((Number(visualizer?.dataset.webglFrame || 0) - startWebglFrame) / (elapsed / 1_000)).toFixed(1)),
        ribbonFps: Number(((Number(ribbon?.dataset.frame || 0) - startRibbonFrame) / (elapsed / 1_000)).toFixed(1)),
        p95FrameMs: Number(percentile(0.95).toFixed(1)),
        maxFrameMs: Number(Math.max(...frameDeltas).toFixed(1)),
        longTaskCount: longTasks.length,
        longTaskTotalMs: Number(longTasks.reduce((sum, duration) => sum + duration, 0).toFixed(1)),
      };
    });
    const focusSample = await page.evaluate(async () => {
      const target = document.querySelector('[data-sound-track="moonbook"]');
      if (!(target instanceof HTMLElement)) throw new Error("moonbook focus target missing");
      document.activeElement?.blur?.();
      const longTasks = [];
      const observer = typeof PerformanceObserver === "function"
        ? new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)))
        : null;
      observer?.observe({ type: "longtask", buffered: false });
      const frameDeltas = [];
      let previousFrame = performance.now();
      let animationHandle = 0;
      let synchronousFocusMs = 0;
      const startedAt = performance.now();
      await new Promise((resolve) => {
        const sampleFrame = (now) => {
          frameDeltas.push(now - previousFrame);
          previousFrame = now;
          // Include the full 2.22-second comet flight and its settled state.
          if (now - startedAt >= 2_600) {
            resolve();
            return;
          }
          animationHandle = requestAnimationFrame(sampleFrame);
        };
        animationHandle = requestAnimationFrame(sampleFrame);
        const beforeFocus = performance.now();
        target.focus();
        synchronousFocusMs = performance.now() - beforeFocus;
      });
      cancelAnimationFrame(animationHandle);
      observer?.disconnect();
      frameDeltas.sort((a, b) => a - b);
      const percentile = (ratio) => frameDeltas[Math.min(frameDeltas.length - 1, Math.floor(frameDeltas.length * ratio))] || 0;
      return {
        synchronousFocusMs: Number(synchronousFocusMs.toFixed(1)),
        focusFps: Number((frameDeltas.length / ((performance.now() - startedAt) / 1_000)).toFixed(1)),
        focusP95FrameMs: Number(percentile(0.95).toFixed(1)),
        focusMaxFrameMs: Number(Math.max(...frameDeltas).toFixed(1)),
        focusLongTaskCount: longTasks.length,
        focusLongTaskTotalMs: Number(longTasks.reduce((sum, duration) => sum + duration, 0).toFixed(1)),
        morphFrames: Number(target.querySelector(".sound-track-morph-canvas")?.dataset.frame || 0),
      };
    });
    results.push({ viewport, ...sample, ...focusSample });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));

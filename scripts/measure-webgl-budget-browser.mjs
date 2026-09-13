import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [
  moduleRoot,
  executablePath,
  targetUrl,
  outputPath,
  label = "budget-pc",
  cpuRateArgument = "1",
  rendererMode = "hardware",
  durationArgument = "24000",
] = process.argv.slice(2);

if (!moduleRoot || !executablePath || !targetUrl || !outputPath) {
  throw new Error("Playwright root, browser executable, target URL, and output path are required");
}

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const cpuRate = Math.max(1, Number(cpuRateArgument) || 1);
const durationMs = Math.max(4_000, Number(durationArgument) || 24_000);
const mobile = /phone|mobile/iu.test(label);
const software = rendererMode === "software";
const viewport = mobile
  ? { width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false };

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: [
    "--no-first-run",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    ...(software ? ["--use-angle=swiftshader"] : []),
  ],
});

const percentile = (values, fraction) => {
  const sorted = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;
};

const summarize = (values) => ({
  samples: values.length,
  meanMs: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
  p50Ms: percentile(values, 0.5),
  p95Ms: percentile(values, 0.95),
  p99Ms: percentile(values, 0.99),
  maxMs: values.length ? Math.max(...values) : 0,
  over25ms: values.filter((value) => value > 25).length,
  over34ms: values.filter((value) => value > 34).length,
});

const report = {
  label,
  cpuRate,
  rendererMode,
  durationMs,
  viewport,
  targetUrl,
  startedAt: new Date().toISOString(),
  errors: { console: [], page: [], request: [] },
};

try {
  const browserSession = await browser.newBrowserCDPSession();
  try {
    const systemInfo = await browserSession.send("SystemInfo.getInfo");
    report.system = {
      gpuDevices: systemInfo.gpu?.devices?.map(({ vendorString, deviceString, driverVendor, driverVersion }) => ({
        vendorString,
        deviceString,
        driverVendor,
        driverVersion,
      })) || [],
      auxAttributes: systemInfo.gpu?.auxAttributes || {},
    };
  } finally {
    await browserSession.detach();
  }

  const context = await browser.newContext({
    viewport,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    serviceWorkers: "block",
  });
  await context.addInitScript(({ deviceMemory, hardwareConcurrency }) => {
    Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => deviceMemory });
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => hardwareConcurrency });
  }, mobile
    ? { deviceMemory: 2, hardwareConcurrency: 4 }
    : { deviceMemory: 4, hardwareConcurrency: 4 });

  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.console.push(message.text());
  });
  page.on("pageerror", (error) => report.errors.page.push(error.stack || error.message));
  page.on("requestfailed", (request) => report.errors.request.push({
    url: request.url(),
    reason: request.failure()?.errorText || "request failed",
  }));

  const session = await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
  const navigationStartedAt = performance.now();
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  report.navigationWallMs = performance.now() - navigationStartedAt;
  await page.waitForFunction(() => typeof globalThis.GaiaModeLoader?.load === "function", null, { timeout: 30_000 });
  await page.evaluate(() => globalThis.GaiaModeLoader.load("exploration"));
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true", null, { timeout: 90_000 });
  await page.evaluate(async () => {
    document.body.classList.remove("gaia-opening-active");
    for (const selector of ["#gaia-opening", "#novel-layer", "#true-end-layer"]) {
      const layer = document.querySelector(selector);
      if (!layer) continue;
      layer.hidden = true;
      layer.inert = true;
      layer.setAttribute("aria-hidden", "true");
    }
    globalThis.dispatchEvent(new CustomEvent("gaia:opening-complete"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    document.querySelector("[data-intro-path='map']")?.click();
    const startedAt = performance.now();
    while (performance.now() - startedAt < 10_000 && globalThis.GaiaMapObservationAdapter?.getState?.().introOpen) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    globalThis.GaiaMapObservationAdapter?.closeMap?.();
    globalThis.GaiaMapObservationAdapter?.selectMode?.(7);
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#gaia-canvas");
    return canvas && getComputedStyle(canvas).visibility === "visible" && getComputedStyle(canvas).opacity === "1";
  }, null, { timeout: 20_000 });
  await page.waitForTimeout(1_800);

  report.measurement = await page.evaluate(async (measurementDuration) => {
    const canvas = document.querySelector("#gaia-canvas");
    const gl = canvas?.getContext("webgl2");
    const debugRenderer = gl?.getExtension("WEBGL_debug_renderer_info");
    const originalDrawArrays = gl?.drawArrays;
    let drawCount = 0;
    if (gl && originalDrawArrays) {
      gl.drawArrays = function measuredDrawArrays(...args) {
        drawCount += 1;
        return originalDrawArrays.apply(this, args);
      };
    }
    const frameTimes = [];
    const stateSamples = [];
    const lodChanges = [];
    const longFrames = [];
    const onLodChange = (event) => lodChanges.push({ atMs: performance.now(), ...event.detail });
    addEventListener("gaia:lodchange", onLodChange);
    let observer = null;
    if (PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longFrames.push(entry.duration);
      });
      observer.observe({ type: "long-animation-frame", buffered: false });
    }
    const sampleState = () => stateSamples.push({
      atMs: performance.now(),
      level: globalThis.GaiaFrameBudgetGovernor?.getProfile?.().level || "unknown",
      width: canvas.width,
      height: canvas.height,
      pixels: canvas.width * canvas.height,
    });
    sampleState();
    const stateTimer = setInterval(sampleState, 1_000);
    const startedAt = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        frameTimes.push(now);
        if (now - startedAt >= measurementDuration) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    clearInterval(stateTimer);
    sampleState();
    observer?.disconnect();
    removeEventListener("gaia:lodchange", onLodChange);
    if (gl && originalDrawArrays) gl.drawArrays = originalDrawArrays;
    const intervals = frameTimes.slice(1).map((time, index) => time - frameTimes[index]);
    return {
      renderer: debugRenderer ? gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
      version: gl?.getParameter(gl.VERSION) || "",
      shadingLanguage: gl?.getParameter(gl.SHADING_LANGUAGE_VERSION) || "",
      initialProfile: stateSamples[0]?.level || "unknown",
      finalProfile: globalThis.GaiaFrameBudgetGovernor?.getProfile?.() || null,
      frames: frameTimes.length,
      drawCount,
      renderFps: drawCount / Math.max(0.001, (frameTimes.at(-1) - frameTimes[0]) / 1_000),
      elapsedMs: frameTimes.at(-1) - frameTimes[0],
      intervals,
      stateSamples,
      lodChanges,
      longFrames,
    };
  }, durationMs);

  const intervals = report.measurement.intervals;
  report.measurement.frameSummary = summarize(intervals);
  report.measurement.estimatedFps = intervals.length
    ? 1_000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
    : 0;
  report.measurement.windows = [];
  const windowStart = report.measurement.stateSamples[0]?.atMs || 0;
  for (let offset = 0; offset < durationMs; offset += 4_000) {
    const start = windowStart + offset;
    const end = start + 4_000;
    const values = [];
    let elapsed = report.measurement.stateSamples[0]?.atMs || 0;
    for (const value of intervals) {
      elapsed += value;
      if (elapsed >= start && elapsed < end) values.push(value);
    }
    report.measurement.windows.push({ offsetMs: offset, ...summarize(values) });
  }
  delete report.measurement.intervals;
  report.finishedAt = new Date().toISOString();

  await session.detach();
  await context.close();
} finally {
  await browser.close();
}

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Budget WebGL measurement complete: ${label} / ${rendererMode} / CPU x${cpuRate}`);

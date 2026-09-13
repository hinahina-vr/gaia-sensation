import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, targetUrl, label = "desktop", cpuRateArgument = "1"] = process.argv.slice(2);
if (!moduleRoot || !executablePath || !outputArgument || !targetUrl) {
  throw new Error("Playwright module root, browser executable, output directory, and target URL are required");
}

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument);
const cpuRate = Math.max(1, Number(cpuRateArgument) || 1);
const mobileProfile = /mobile/iu.test(label);
fs.mkdirSync(outputDir, { recursive: true });

const metricNames = new Set([
  "Documents",
  "Frames",
  "JSEventListeners",
  "Nodes",
  "LayoutCount",
  "RecalcStyleCount",
  "LayoutDuration",
  "RecalcStyleDuration",
  "ScriptDuration",
  "TaskDuration",
  "JSHeapUsedSize",
  "JSHeapTotalSize",
]);

const toMetricRecord = (items) => Object.fromEntries(
  items.filter((item) => metricNames.has(item.name)).map((item) => [item.name, item.value]),
);

const metricDelta = (start, end) => Object.fromEntries(
  [...metricNames]
    .filter((name) => Number.isFinite(start[name]) && Number.isFinite(end[name]))
    .map((name) => [name, end[name] - start[name]]),
);

const summarizeFrames = (frames) => {
  const sorted = frames.filter(Number.isFinite).slice().sort((left, right) => left - right);
  const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;
  return {
    samples: sorted.length,
    averageMs: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxMs: sorted.at(-1) || 0,
    over34ms: sorted.filter((value) => value > 34).length,
    over50ms: sorted.filter((value) => value > 50).length,
    estimatedFps: sorted.length ? 1000 / (sorted.reduce((sum, value) => sum + value, 0) / sorted.length) : 0,
  };
};

const traceEvents = [];
const report = {
  label,
  targetUrl,
  cpuRate,
  viewport: mobileProfile
    ? { width: 390, height: 844, deviceScaleFactor: 1 }
    : { width: 1440, height: 900, deviceScaleFactor: 1 },
  startedAt: new Date().toISOString(),
  errors: { console: [], page: [], responses404: [], requests: [] },
};

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: [
    "--no-first-run",
    "--disable-background-networking",
    "--enable-precise-memory-info",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
  ],
});

try {
  const browserSession = await browser.newBrowserCDPSession();
  try {
    const systemInfo = await browserSession.send("SystemInfo.getInfo");
    report.system = {
      modelName: systemInfo.modelName,
      modelVersion: systemInfo.modelVersion,
      gpuDevices: systemInfo.gpu?.devices?.map(({ vendorString, deviceString, driverVendor, driverVersion }) => ({
        vendorString,
        deviceString,
        driverVendor,
        driverVersion,
      })) || [],
      auxAttributes: systemInfo.gpu?.auxAttributes || {},
    };
  } catch (error) {
    report.system = { error: error.message };
  } finally {
    await browserSession.detach();
  }

  const context = await browser.newContext({
    viewport: report.viewport,
    locale: "ja-JP",
    reducedMotion: "no-preference",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  if (mobileProfile) {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 2 });
      Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 2 });
    });
  }
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.console.push(message.text());
  });
  page.on("pageerror", (error) => report.errors.page.push(error.stack || error.message));
  page.on("response", (response) => {
    if (response.status() === 404) report.errors.responses404.push(response.url());
  });
  page.on("requestfailed", (request) => report.errors.requests.push({
    url: request.url(),
    failure: request.failure()?.errorText || "request failed",
  }));

  await page.addInitScript(() => {
    const state = {
      timeOrigin: performance.timeOrigin,
      longTasks: [],
      events: [],
      layoutShifts: [],
      resources: [],
      paints: [],
      largestContentfulPaint: null,
      frameDeltas: [],
      observerErrors: [],
    };
    globalThis.__gaiaPerformanceProbe = state;
    const observe = (type, callback, options = {}) => {
      try {
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({ type, buffered: true, ...options });
      } catch (error) {
        state.observerErrors.push(`${type}: ${error.message}`);
      }
    };
    observe("longtask", (entries) => entries.forEach((entry) => state.longTasks.push({
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration,
      attribution: entry.attribution?.map((item) => ({
        name: item.name,
        containerType: item.containerType,
        containerName: item.containerName,
        containerSrc: item.containerSrc,
      })) || [],
    })));
    observe("event", (entries) => entries.forEach((entry) => state.events.push({
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration,
      processingStart: entry.processingStart,
      processingEnd: entry.processingEnd,
      interactionId: entry.interactionId,
    })), { durationThreshold: 16 });
    observe("layout-shift", (entries) => entries.forEach((entry) => {
      if (entry.hadRecentInput) return;
      state.layoutShifts.push({
        startTime: entry.startTime,
        value: entry.value,
        sources: entry.sources?.map((source) => ({
          previousRect: source.previousRect?.toJSON?.() || source.previousRect,
          currentRect: source.currentRect?.toJSON?.() || source.currentRect,
          node: source.node?.id || source.node?.className || source.node?.nodeName || "",
        })) || [],
      });
    }));
    observe("resource", (entries) => entries.forEach((entry) => state.resources.push({
      name: entry.name,
      initiatorType: entry.initiatorType,
      startTime: entry.startTime,
      duration: entry.duration,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      responseEnd: entry.responseEnd,
    })));
    observe("paint", (entries) => entries.forEach((entry) => state.paints.push({
      name: entry.name,
      startTime: entry.startTime,
    })));
    observe("largest-contentful-paint", (entries) => entries.forEach((entry) => {
      state.largestContentfulPaint = {
        startTime: entry.startTime,
        size: entry.size,
        element: entry.element?.id || entry.element?.className || entry.element?.nodeName || "",
        url: entry.url,
      };
    }));
    let previousFrame = 0;
    const sampleFrame = (now) => {
      if (previousFrame && state.frameDeltas.length < 5000) state.frameDeltas.push(now - previousFrame);
      previousFrame = now;
      requestAnimationFrame(sampleFrame);
    };
    requestAnimationFrame(sampleFrame);
  });

  const session = await context.newCDPSession(page);
  await session.send("Performance.enable", { timeDomain: "timeTicks" });
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.clearBrowserCache");
  await session.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
  await session.send("Profiler.enable");
  await session.send("Profiler.startPreciseCoverage", { callCount: true, detailed: true, allowTriggeredUpdates: false });

  session.on("Tracing.dataCollected", ({ value }) => traceEvents.push(...value));
  await session.send("Tracing.start", {
    transferMode: "ReportEvents",
    traceConfig: {
      recordMode: "recordContinuously",
      includedCategories: [
        "blink.user_timing",
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "loading",
        "v8.execute",
      ],
    },
  });

  const metricsBeforeNavigation = toMetricRecord((await session.send("Performance.getMetrics")).metrics);
  const navigationStartedAt = performance.now();
  const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  report.navigation = {
    status: response?.status() || 0,
    domContentLoadedWallMs: performance.now() - navigationStartedAt,
  };
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const metricsBeforeAnimation = toMetricRecord((await session.send("Performance.getMetrics")).metrics);
  const heapBeforeAnimation = await session.send("Runtime.getHeapUsage");
  const domBeforeAnimation = await session.send("Memory.getDOMCounters");

  await page.screenshot({ path: path.join(outputDir, `${label}-loaded.png`), fullPage: false });
  const soundButton = page.locator("#gaia-opening-sound-off");
  report.interaction = { soundOffVisible: await soundButton.isVisible().catch(() => false), clicked: false };
  if (report.interaction.soundOffVisible) {
    const clickStartedAt = performance.now();
    await soundButton.click({ timeout: 10000 });
    report.interaction.clicked = true;
    report.interaction.clickWallMs = performance.now() - clickStartedAt;
  }

  const animationSamples = [];
  for (let index = 0; index < 10; index += 1) {
    await page.waitForTimeout(1000);
    animationSamples.push({
      second: index + 1,
      metrics: toMetricRecord((await session.send("Performance.getMetrics")).metrics),
      heap: await session.send("Runtime.getHeapUsage"),
    });
  }
  const metricsAfterAnimation = toMetricRecord((await session.send("Performance.getMetrics")).metrics);
  const heapAfterAnimation = await session.send("Runtime.getHeapUsage");
  const domAfterAnimation = await session.send("Memory.getDOMCounters");

  await page.screenshot({ path: path.join(outputDir, `${label}-animation.png`), fullPage: false });
  const coverage = await session.send("Profiler.takePreciseCoverage");
  await session.send("Profiler.stopPreciseCoverage");
  await session.send("Profiler.disable");

  const tracingComplete = new Promise((resolve) => session.once("Tracing.tracingComplete", resolve));
  await session.send("Tracing.end");
  await tracingComplete;

  const browserProbe = await page.evaluate(() => {
    const probe = globalThis.__gaiaPerformanceProbe;
    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      ...probe,
      navigation: navigation?.toJSON?.() || null,
      memory: performance.memory ? {
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize: performance.memory.usedJSHeapSize,
      } : null,
      dom: {
        elements: document.querySelectorAll("*").length,
        canvases: [...document.querySelectorAll("canvas")].map((canvas) => ({
          id: canvas.id,
          className: canvas.className,
          width: canvas.width,
          height: canvas.height,
          visible: canvas.getClientRects().length > 0 && getComputedStyle(canvas).visibility !== "hidden",
        })),
        scripts: document.scripts.length,
        stylesheets: document.styleSheets.length,
        bodyClass: document.body.className,
        openingClass: document.querySelector("#gaia-opening")?.className || "",
      },
      supportedEntryTypes: PerformanceObserver.supportedEntryTypes,
    };
  });

  const traceLongTasks = traceEvents
    .filter((event) => event.ph === "X" && Number(event.dur) >= 50000)
    .map((event) => ({
      name: event.name,
      category: event.cat,
      startMs: event.ts / 1000,
      durationMs: event.dur / 1000,
      data: event.args?.data ? {
        type: event.args.data.type,
        url: event.args.data.url,
        scriptName: event.args.data.scriptName,
        functionName: event.args.data.functionName,
        stackTrace: event.args.data.stackTrace?.slice(0, 8),
      } : null,
    }))
    .sort((left, right) => right.durationMs - left.durationMs);

  const coverageSummary = coverage.result
    .filter((script) => script.url)
    .map((script) => {
      const totalBytes = script.functions.reduce((sum, fn) => sum + Math.max(0, fn.ranges[0]?.endOffset - fn.ranges[0]?.startOffset), 0);
      const usedBytes = script.functions.reduce((sum, fn) => sum + fn.ranges
        .filter((range) => range.count > 0)
        .reduce((rangeSum, range) => rangeSum + Math.max(0, range.endOffset - range.startOffset), 0), 0);
      return { url: script.url, totalBytes, usedBytes, functions: script.functions.length };
    })
    .sort((left, right) => right.totalBytes - left.totalBytes);

  report.metrics = {
    beforeNavigation: metricsBeforeNavigation,
    beforeAnimation: metricsBeforeAnimation,
    afterAnimation: metricsAfterAnimation,
    navigationDelta: metricDelta(metricsBeforeNavigation, metricsBeforeAnimation),
    animationDelta: metricDelta(metricsBeforeAnimation, metricsAfterAnimation),
    samples: animationSamples,
  };
  report.heap = { beforeAnimation: heapBeforeAnimation, afterAnimation: heapAfterAnimation };
  report.domCounters = { beforeAnimation: domBeforeAnimation, afterAnimation: domAfterAnimation };
  report.browser = {
    ...browserProbe,
    frames: summarizeFrames(browserProbe.frameDeltas),
    totalBlockingTimeMs: browserProbe.longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
    cumulativeLayoutShift: browserProbe.layoutShifts.reduce((sum, shift) => sum + shift.value, 0),
    resources: browserProbe.resources
      .slice()
      .sort((left, right) => right.decodedBodySize - left.decodedBodySize),
  };
  delete report.browser.frameDeltas;
  report.trace = {
    events: traceEvents.length,
    longTasks: traceLongTasks.slice(0, 100),
  };
  report.coverage = coverageSummary;
  report.finishedAt = new Date().toISOString();

  fs.writeFileSync(path.join(outputDir, `${label}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, `${label}-trace.json`), `${JSON.stringify({ traceEvents })}\n`);
  await session.detach();
  await context.close();
} catch (error) {
  report.failure = error.stack || String(error);
  fs.writeFileSync(path.join(outputDir, `${label}-failure.json`), `${JSON.stringify(report, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}

console.log(`Desktop performance measurement complete: ${label} (CPU x${cpuRate})`);

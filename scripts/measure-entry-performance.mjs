import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = process.env.GAIA_OUTPUT_DIR || 'artifacts/refactor-20260922/performance';
const samples = Number(process.env.PERF_SAMPLES || 3);
const collectCoverage = process.env.PERF_COVERAGE === 'true';
const baseline = process.env.GAIA_COMPARE_BASELINE;
const sourceFile = file => baseline && fs.existsSync(path.join(baseline, file)) ? path.join(baseline, file) : file;
fs.mkdirSync(output, { recursive: true });
const report = { base, measuredAt: new Date().toISOString(), collectCoverage, baseline: baseline || null, betweenSamplesMs: 2000,
  ancestor: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  hashes: Object.fromEntries(['gaia-mode-loader.js', 'index.html', 'opening.js', 'app.js', 'gaia-i18n.js', 'locales/ui-entry.bundle.js'].filter(file => fs.existsSync(sourceFile(file))).map(file => [file, createHash('sha256').update(fs.readFileSync(sourceFile(file))).digest('hex')])),
  samples: [], errors: [],
  scope: 'Local Chrome, cold cache; responseHeaders record the preview transport, not production. Mobile is emulated, not a physical device. External APIs blocked; map uses local fallback snapshots. Lab interaction durations are NOT field INP.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const mobile of [false, true]) for (let sample = 0; sample < samples; sample++) {
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 900 },
      isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'ja-JP' });
    await context.route('https://**', route => route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(120000);
    page.on('pageerror', error => report.errors.push(error.message));
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 });
    if (mobile) await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
      downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' });
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(4000);
      const probe = globalThis.__entryPerf = { longTasks: [], interactions: [], lcp: 0, cls: 0, ready: 0 };
      new PerformanceObserver(list => list.getEntries().forEach(entry => probe.longTasks.push({ start: entry.startTime, duration: entry.duration }))).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) { probe.lcp = entry.startTime; probe.lcpElement = entry.element?.className; } }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) probe.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.interactionId) probe.interactions.push({ name: entry.name, duration: entry.duration, id: entry.interactionId }); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      const check = () => {
        if (document.querySelector('#gaia-boot')?.hidden && document.querySelector('#gaia-opening-sound-modal.is-visible')) {
          probe.ready = performance.now();
        } else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    if (collectCoverage) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => __entryPerf.ready > 0);
    const result = await page.evaluate(() => ({ ...__entryPerf,
      paint: performance.getEntriesByType('paint').map(entry => ({ name: entry.name, time: entry.startTime })),
      navigation: performance.getEntriesByType('navigation').map(entry => ({ domContentLoaded: entry.domContentLoadedEventEnd, load: entry.loadEventEnd, protocol: entry.nextHopProtocol })),
      resources: performance.getEntriesByType('resource').map(entry => ({ url: entry.name, bytes: entry.encodedBodySize, transfer: entry.transferSize, end: entry.responseEnd, type: entry.initiatorType })),
    }));
    const row = { mobile, sample, cpuRate: mobile ? 4 : 1,
      responseHeaders: { encoding: response.headers()['content-encoding'] || 'identity', cache: response.headers()['cache-control'] },
      ready: result.ready, lcp: result.lcp, cls: result.cls,
      fcp: result.paint.find(entry => entry.name === 'first-contentful-paint')?.time,
      longTasksBeforeReady: result.longTasks.filter(task => task.start < result.ready), ...result };
    if (collectCoverage) {
      const coverage = await page.coverage.stopJSCoverage();
      row.coverage = coverage.filter(entry => entry.url.startsWith(base)).map(entry => ({
        url: entry.url, bytes: entry.source ? Buffer.byteLength(entry.source) : null,
        functions: entry.functions.map(fn => ({ name: fn.functionName, ranges: fn.ranges })),
      }));
    }
    if (sample === 0) await page.screenshot({ path: `${output}/${mobile ? 'mobile' : 'pc'}-sound-choice.png` });
    // Measure a real transition directly to the map once per profile. Keep its
    // interaction costs separate from cold boot and from field Web Vitals.
    if (sample === 0) {
      await page.locator('#gaia-opening-sound-off').click();
      await page.locator('#gaia-opening-skip').click();
      const start = await page.evaluate(() => performance.now());
      await page.locator('#gaia-opening-route-other').click();
      // Older comparison snapshots still lead to the intermediate menu.
      await page.waitForFunction(() => document.querySelector('#japan-layer')?.getAttribute('aria-hidden') === 'false'
        || document.querySelector('#intro-layer')?.getAttribute('aria-hidden') === 'false');
      const destination = await page.evaluate(() => document.querySelector('#japan-layer')?.getAttribute('aria-hidden') === 'false' ? 'map' : 'menu');
      row[destination === 'map' ? 'dataMap' : 'dataMenu'] = await page.evaluate(start => ({ elapsed: performance.now() - start,
        measures: performance.getEntriesByType('measure').map(entry => ({ name: entry.name, duration: entry.duration })),
        interactions: __entryPerf.interactions,
        resources: performance.getEntriesByType('resource').filter(entry => entry.startTime >= start).map(entry => ({ url: entry.name, bytes: entry.encodedBodySize, transfer: entry.transferSize })),
      }), start);
      await page.screenshot({ path: `${output}/${mobile ? 'mobile' : 'pc'}-data-${destination}.png` });
    }
    report.samples.push(row);
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ mobile, sample, ready: row.ready, lcp: row.lcp, cls: row.cls, fcp: row.fcp, map: row.dataMap?.elapsed, menu: row.dataMenu?.elapsed }));
    await context.close();
    // The faster menu can close while its background requests are still being
    // compressed by the local server. Let that work drain before the next run.
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
if (report.errors.length) throw new Error(JSON.stringify(report.errors));

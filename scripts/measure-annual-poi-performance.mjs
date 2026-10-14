import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/annual-poi-performance');
fs.mkdirSync(output, { recursive: true });
const base = process.env.GAIA_BASE_URL;
if (!base || new URL(base).hostname !== '127.0.0.1') throw new Error('Use a local preview URL');
const report = { scope: 'Installed headless Chrome; desktop/emulated mobile; real local annual observations. External requests blocked. Draw duration is CPU submission time, not presented FPS.', samples: [], errors: [] };
const baseline = process.env.GAIA_PREVIEW_BASELINE ? path.resolve(process.env.GAIA_PREVIEW_BASELINE) : null;
const files = ['index.html', 'gaia-mode-loader.js', 'src/exploration/index.js', 'src/exploration/marine-cod-exhibit.js',
  'src/exploration/annual-poi-renderer.js', 'src/exploration/prtr-biology-catalog.js', 'src/exploration/record-appearance.js'];
report.revision = { sha: execFileSync('git', ['--no-optional-locks', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', baselineOverlay: baseline,
  hashes: Object.fromEntries(files.filter(file => !baseline || fs.existsSync(path.join(baseline, file))).map(file =>
    [file, createHash('sha256').update(fs.readFileSync(baseline ? path.join(baseline, file) : file)).digest('hex')])) };
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
report.browser = browser.version();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, deviceScaleFactor: width < 900 ? 3 : 1, isMobile: width < 900, hasTouch: width < 900 });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    const pending = new Set();
    page.on('request', req => pending.add(req.url()));
    page.on('requestfinished', req => pending.delete(req.url()));
    page.on('requestfailed', req => pending.delete(req.url()));
    page.on('pageerror', error => { report.errors.push(error.message); console.error(error.message); });
    const timer = setInterval(() => { if (pending.size) console.log(`Navigation pending: ${pending.size} resources`, [...pending].slice(0, 4)); }, 20000);
    try { await page.goto(`${base}/#world-65`, { waitUntil: 'domcontentloaded' }); }
    finally { clearInterval(timer); }
    for (const number of [65, 49, 31, 69]) {
      await page.evaluate(number => { location.hash = `world-${number}`; }, number);
      await page.waitForFunction(number => globalThis.GaiaMarineCod?.definition.number === String(number) && GaiaMarineCod.getState().dataState === 'ready', number);
      await page.evaluate(() => GaiaMapPlayback.stop());
      await page.waitForFunction(() => document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState === 'complete'
        && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')
        && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro')
        && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
      const sample = await page.evaluate(async () => {
        const canvas = document.querySelector('#gaia-marine-cod-canvas'), samples = [];
        let last;
        const start = performance.now();
        while (performance.now() - start < 5000) {
          await new Promise(requestAnimationFrame);
          if (last !== canvas.dataset.codFrame) {
            last = canvas.dataset.codFrame;
            samples.push(Number(canvas.dataset.codDrawMs));
          }
        }
        samples.sort((a, b) => a - b);
        return { state: GaiaMarineCod.getState(), frames: samples.length, meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
          p50Ms: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)], samples };
      });
      await page.screenshot({ path: path.join(output, `${width}-${number}.png`) });
      report.samples.push({ width, number, ...sample }); console.log(JSON.stringify({ width, number, meanMs: sample.meanMs, p95Ms: sample.p95Ms, state: sample.state }));
    }
    await context.close();
  }
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
